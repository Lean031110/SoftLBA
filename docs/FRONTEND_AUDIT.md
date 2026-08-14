# SoftLBA — Frontend Audit

**Fecha:** 2026-08-14
**Versión auditada:** v1.0.20-rc2 (código) → v1.0.20-rc-final (con fixes)
**Auditor:** Super Z (Z.ai)
**Alcance:** 48 páginas, 56 componentes (8 custom + 48 shadcn/ui), 5 hooks, PWA (sw.js + manifest.json), realtime hook + mini-service

---

## Resumen ejecutivo

| Severidad | Cantidad | Acción requerida |
|---|---|---|
| **P0 — Crítico** | 6 | Bloquea publicación v1.0.20 |
| **P1 — Alto** | 23 | Debe corregirse antes de producción o con plan documentado |
| **P2 — Medio** | 38 | Backlog de calidad |
| **P3 — Bajo** | 31 | Limpieza / cosmético |
| **Total** | **98** | — |

La auditoría se centra en los componentes **custom** (no en shadcn/ui, que es librería externa) y en los patrones transversales (fetch, hooks, SW, realtime).

---

## P0 — Críticos (bloqueadores v1.0.20)

### P0-1. `use-current-user.ts` no redirige a `/login` en 401

**Archivo:** `src/hooks/use-current-user.ts`

Si la sesión expira (TTL 12h), `user` queda cached en estado React. Las llamadas posteriores a `/api/...` retornan 401 con `{ ok: false, error: 'SESION_EXPIRADA' }`, pero ninguna página intercepta esto para redirigir a `/login`. El usuario ve errores genéricos ("Error al cargar") y debe navegar manualmente a `/logout`.

**Fix propuesto:**
- Crear wrapper `apiFetch()` en `src/lib/api.ts` que intercepte 401 y llame `window.location.href = '/login?expired=1'`.
- Reemplazar todos los `fetch()` crudos por `apiFetch()` (ver P1-4).
- En `useCurrentUser`, escuchar 401 y limpiar estado.

### P0-2. `kitchen-dashboard.tsx` emite eventos socket directamente

**Archivo:** `src/components/kitchen/kitchen-dashboard.tsx:144-147, 181-187`

```ts
// Código problemático:
const socket = io('/?XTransformPort=3003', { transports: ['websocket'] })
socket.emit(data.wsEvent || 'order:status', data.wsPayload)
setTimeout(() => socket.disconnect(), 1000)
```

- **Hardcoded** `XTransformPort=3003` (bypassa `NEXT_PUBLIC_REALTIME_URL`).
- Crea una conexión nueva **por cada cambio de status** (leak de conexiones).
- **El server rechaza estos eventos** (`CLIENT_FORBIDDEN_EVENTS` en `mini-services/realtime-service/index.ts:370-378`) → código muerto que no funciona pero consume recursos.
- Si el server se config mal, esto se vuelve explotable.

**Fix propuesto:** Eliminar el bloque de socket.emit y usar la API REST (`POST /api/cocina/orders/[id]/status`) que ya emite el evento server-side vía `realtime-emitter.ts`.

### P0-3. `service-worker-register.tsx` no escucha `SW_UPDATED`

**Archivo:** `src/components/service-worker-register.tsx`

El SW (`public/sw.js:79-82`) envía `postMessage({ type: 'SW_UPDATED', version })` a todos los clientes cuando se activa una nueva versión. Pero `service-worker-register.tsx` **nunca registra un listener** para este mensaje.

Resultado: las nuevas versiones se aplican **silenciosamente en la próxima navegación**. Si el usuario está en medio de crear un pedido (con items en el carrito), la página se recarga sin avisar y pierde el estado.

**Fix propuesto:**
```tsx
useEffect(() => {
  const handler = (event: MessageEvent) => {
    if (event.data?.type === 'SW_UPDATED') {
      toast.info('Nueva versión disponible', {
        description: 'Click para actualizar',
        action: { label: 'Actualizar', onClick: () => window.location.reload() },
      })
    }
  }
  navigator.serviceWorker.addEventListener('message', handler)
  return () => navigator.serviceWorker.removeEventListener('message', handler)
}, [])
```

### P0-4. Realtime service acepta token de query param

**Archivo:** `mini-services/realtime-service/index.ts:391-393`

```ts
const token = socket.handshake.auth.token || socket.handshake.query.token
```

Aceptar el token de `query.token` hace que:
- Aparezca en logs de proxy (Nginx, Caddy).
- Se guarde en browser history si la URL se comparte.
- Sea visible en DevTools Network tab.

**Fix propuesto:** Eliminar el fallback a `query.token`. Solo aceptar `auth.token`.

### P0-5. Realtime service CORS auto-incluye IPs locales

**Archivo:** `mini-services/realtime-service/index.ts:113-145` (`getAllowedOrigins()`)

La función agrega automáticamente `http://localhost`, `http://127.0.0.1`, y todas las interfaces de red locales a la lista de orígenes permitidos. Si el servidor tiene una IP pública (VPS, Cloud), esa IP queda en la lista CORS → **cualquiera puede conectarse al socket desde un navegador en otro dominio**.

**Fix propuesto:**
- Solo leer orígenes de `process.env.REALTIME_ALLOWED_ORIGINS` (CSV).
- Si no está seteado, default a `http://localhost:3000` solo en dev.
- Lanzar error en producción si no hay env var explícita.

### P0-6. 5 strings de versión distintas en la app

| Archivo | Versión mostrada |
|---|---|
| `public/sw.js:12` | `softlba-v1.0.19.5` |
| `public/sw.js:41, 65` | `v0.17.0` (en logs) |
| `src/app/offline/page.tsx:162` | `v0.15.0` |
| `src/app/page.tsx:245` | `v0.6.0` |
| `src/components/layout/panel-layout.tsx:303` | `v0.6.0` |
| `package.json` | `1.0.20-rc2` |

El operador no puede determinar qué versión está corriendo en producción mirando la UI. Para un POS donde los bugs pueden costar dinero, esto es crítico.

**Fix propuesto:**
- Exponer la versión de `package.json` vía `process.env.NEXT_PUBLIC_APP_VERSION` (Next.js lo hace automático).
- Reemplazar todos los strings hardcoded por `NEXT_PUBLIC_APP_VERSION`.
- Mostrar la versión en un único lugar visible (footer del panel admin, no en 5 lugares distintos).

---

## P1 — Altos (afectan producción diaria)

### P1-1. Todas las páginas son client components

**48/48 páginas** tienen `'use client'` en la primera línea. Cero server components.

**Impacto:**
- Bundle JS grande (toda la lógica de fetch + estado va al cliente).
- Sin SSR data prefetch → white flash en navegación.
- Sin SEO (título, meta tags, OG) por página.
- Sin streaming con `<Suspense>`.

**Páginas que DEBERÍAN ser server components:**
- `/` (home pública, marketing)
- `/login` (form simple)
- `/ayuda` (estático)
- `/offline` (estático)
- `/logout` (debería ser server action)

**Páginas híbridas recomendadas:** Server component para layout + datos iniciales, client component para interactividad. Patrones: `app/admin/usuarios/page.tsx` → server fetch + pasaje de props a `<UsersTable items={...} />` client.

### P1-2. 0/48 páginas exportan `metadata`

Solo `src/app/layout.tsx` exporta metadata (título "SoftLBA - Sistema de Restaurante"). Todas las páginas comparten el mismo título.

**Fix:** Cada `page.tsx` debe exportar:
```ts
export const metadata = {
  title: 'Cocina — SoftLBA',
  description: 'Panel de cocina en tiempo real',
}
```

### P1-3. Cero archivos `loading.tsx` y `error.tsx`

```
find src/app -name 'loading.tsx' → 0
find src/app -name 'error.tsx'   → 0
```

Un error no capturado en cualquier página **tira toda la rama del layout padre**. Por ejemplo, un error en `/admin/usuarios/page.tsx` tira todo `/admin/*` porque `PanelLayout` los envuelve.

**Fix mínimo:** Crear `src/app/admin/error.tsx`, `src/app/mesero/error.tsx`, `src/app/cocina/error.tsx`, `src/app/pizzeria/error.tsx` con un boundary que muestre "Algo salió mal — recargar" y un botón `reset()`.

### P1-4. 47/48 páginas usan `fetch()` directo

84 llamadas a `fetch()` crudo en páginas. Sin wrapper centralizado. Cada página re-implementa:
- `setLoading(true)` / `setLoading(false)`
- `try { ... } catch (e) { setError(...) }`
- `if (!data.ok) setError(data.error)`
- Sin `AbortController` → fetch continúa tras unmount

**Fix:** Crear `src/lib/api.ts`:
```ts
export async function apiFetch<T>(path: string, opts?: RequestInit & { signal?: AbortSignal }): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin', ...opts })
  if (res.status === 401) {
    window.location.href = '/login?expired=1'
    throw new Error('Sesión expirada')
  }
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'Error desconocido')
  return data as T
}
```

### P1-5. Sin role guards client-side

El middleware (`src/middleware.ts`) protege rutas server-side, pero en el cliente:
- `PanelLayout:218` muestra pantalla en blanco si no hay user.
- Las páginas de admin se renderizan (con useEffect de fetch) antes de que el middleware haga redirect.

**Fix:** Usar `useCurrentUser()` + early return con redirect en `PanelLayout`:
```tsx
if (!loading && !user) {
  router.replace('/login?redirect=' + pathname)
  return <Loading />
}
```

### P1-6. `panel-layout.tsx` usa `window.location.pathname` en vez de `usePathname()`

**Línea 211-215:** Usa `window.location.pathname` + `requestAnimationFrame` para setear `currentPath`. El título de la página (`<h1>` en línea 274) se queda stale tras navegación client-side.

**Fix:** Reemplazar con `const pathname = usePathname()` (ya importado en `SidebarNav:102`).

### P1-7. `notification-bell.tsx` solicita permiso de notificaciones sin gesto

**Línea 184-194:** Llama `Notification.requestPermission()` 3 segundos después del mount, sin interacción del usuario. Chrome ≥ 84 bloquea esto silenciosamente.

**Fix:** Solo solicitar permiso cuando el usuario haga click en un botón "Activar notificaciones".

### P1-8. `notification-bell.tsx` crea nuevo `AudioContext` por playSound

**Línea 119-136:** `new (window.AudioContext || ...)()` en cada llamada. Browsers cap en ~6 contextos activos. Para un turno de 8h con cientos de notificaciones, esto se rompe.

**Fix:** Reusar `useBeep` (que ya crea un solo AudioContext) o crear un contexto singleton en el módulo.

### P1-9. `use-realtime.ts` abre múltiples sockets por página

5 componentes llaman `useRealtime`: `KitchenDashboard`, `NotificationBell`, `AdminDashboard`, `MeseroDashboard`, `PedidoDetalle`. Una página típica tiene `NotificationBell` (en `PanelLayout`) + el componente de la página = 2 sockets.

**Fix:** Mover a un singleton vía React Context:
```tsx
const RealtimeContext = createContext<RealtimeAPI>(...)
export function RealtimeProvider({ children }) {
  const api = useRealtime(...) // 1 sola vez
  return <RealtimeContext.Provider value={api}>{children}</RealtimeContext.Provider>
}
export const useRealtimeContext = () => useContext(RealtimeContext)
```

### P1-10. `auth:fail` en socket → desconexión permanente

**Línea 104-109:** Cuando el token del socket es inválido, se limpia `tokenCache` y se desconecta, pero **no se re-autentica automáticamente**. El usuario queda sin realtime hasta que navega a otra página.

**Fix:** En `auth:fail`, hacer `tokenCache = null` y llamar `connect()` inmediatamente para re-fetchear el token y reconectar.

### P1-11. Sin indicador visible de "realtime desconectado"

`NotificationBell:257-259` muestra un punto verde cuando conectado, pero la ausencia del punto es la única señal de desconexión. Fácil de perder.

**Fix:** Mostrar banner / toast cuando `connected === false` por más de 10 segundos.

### P1-12. `kitchen-dashboard.tsx` tabs no accesibles por teclado

**Línea 242-253:** Tabs implementadas con `<Button>` sin `role="tab"`, `aria-selected`, `aria-controls`, ni navegación con flechas. Viola WCAG 2.1.1 (keyboard) y 4.1.2 (role/state).

**Fix:** Usar `@radix-ui/react-tabs` (ya está en dependencias) o implementar manualmente con ARIA.

### P1-13. `kitchen-dashboard.tsx` Collapsible trigger no focusable

**Línea 291-319:** `<CollapsibleTrigger asChild>` envuelve `<div className="cursor-pointer p-4 pb-3">`. Un `<div>` no es focusable, no tiene `role="button"`, no tiene `tabIndex`, no maneja `onKeyDown`. Keyboard users no pueden expandir/colapsar tarjetas de pedido.

**Fix:** Reemplazar el `<div>` con un `<button>` o agregar `role="button" tabIndex={0} onKeyDown`.

### P1-14. 38 botones de icono sin `aria-label`

Estos son `size="icon"` sin texto visible ni `aria-label`. Lectores de pantalla los anuncian como "button" sin contexto.

**Ejemplos:**
- `panel-layout.tsx:251` (mobile menu trigger)
- `notification-bell.tsx:331` (mark as read)
- `subproduct-manager.tsx:233` (add button loading state)
- 22 botones de "volver" (`<Link asChild><Button size="icon">`)
- 11 botones de eliminar/editar en listas

**Fix mecánico:** Agregar `aria-label="Volver"`, `aria-label="Eliminar usuario"`, etc.

### P1-15. 7 tablas sin `overflow-x-auto`

Las tablas desbordan horizontalmente en móvil (320-375px):

- `src/app/admin/usuarios/page.tsx:203`
- `src/app/admin/productos/page.tsx:205`
- `src/app/admin/recetas/nuevo/page.tsx:262`
- `src/app/admin/recetas/[id]/page.tsx:294`
- `src/app/admin/ayuda/page.tsx:165`
- `src/app/admin/cierre-diario/[id]/page.tsx:316, 391`
- `src/app/admin/noticias/page.tsx:194`

**Fix:** Envolver cada `<Table>` con `<div className="overflow-x-auto"><Table>...</Table></div>`.

### P1-16. 0 skip-to-content links

Ninguna página tiene un link "Saltar al contenido principal". Keyboard users deben tabular a través de todo el sidebar (20+ items) + header antes de llegar al contenido.

**Fix:** Agregar al inicio de `PanelLayout`:
```tsx
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50">
  Saltar al contenido
</a>
<main id="main-content">{children}</main>
```

### P1-17. Background Sync sin límite de cola ni TTL

**Archivo:** `public/sw.js:259-280` (`enqueueRequest`)

IndexedDB store crece indefinidamente. Un usuario offline por una semana puede encolar cientos de requests. No hay TTL → requests de hace 30 días se siguen reintentando.

**Fix:**
- Limitar cola a 50 entries (FIFO).
- Agregar `enqueuedAt` timestamp y descartar entries > 24h.

### P1-18. `flushQueue` no elimina errores no-reintentables

**Archivo:** `public/sw.js:299-313`

Solo verifica `res.ok`. Errores 401 (sesión expirada), 403 (sin permiso), 422 (validación) se quedan en la cola para siempre.

**Fix:**
```js
if ([400, 401, 403, 404, 422].includes(res.status)) {
  // No reintentable, eliminar
  await db.delete(id)
}
```

### P1-19. `manifest.json` display demasiado agresivo

`display: "fullscreen"` oculta barra de URL y gestos de navegación. Para un POS donde el usuario puede necesitar ver la hora, batería, etc., es mejor `standalone`.

`orientation: "portrait-primary"` fuerza portrait. Tablets en cocina suelen estar en landscape.

**Fix:**
```json
"display": "standalone",
"display_override": ["standalone", "minimal-ui"],
"orientation": "any"
```

### P1-20. `manifest.json` screenshots usan logo

Ambos `screenshots` apuntan a `/softlba-logo.png`. No son screenshots reales. La UI de instalación de PWA en Android/desktop no muestra preview.

**Fix:** Tomar screenshots reales de:
- Cocina dashboard (1280x800 landscape)
- Mesero nuevo pedido (390x844 portrait)
- Admin panel (1280x800)

### P1-21. `manifest.json` faltan íconos

Solo tiene 192x192 y 512x512. Faltan:
- 16x16, 32x32 (favicon browser tab)
- 180x180 (apple-touch-icon)
- 256x256, 384x384 (Android home)
- 1024x1024 (iOS splash screen)

Todos apuntan al mismo `/softlba-logo.png` que probablemente no está renderizado a esas resoluciones.

### P1-22. Botones de cantidad `h-7 w-7` (28px) — bajo 44px

WCAG 2.5.5 recomienda 44x44px mínimo touch target. Afecta:
- `mesero/nuevo-pedido/page.tsx:519, 532, 543` (cart quantity)
- `notification-bell.tsx:281, 329` (action buttons)
- `kitchen-dashboard.tsx:356-378` (item actions)
- `panel-layout.tsx:251` (mobile menu trigger)

**Fix:** Cambiar a `h-10 w-10` (40px) o `h-11 w-11` (44px).

### P1-23. Sin headers de seguridad en middleware

**Archivo:** `src/middleware.ts`

No setea:
- `X-Frame-Options: DENY` (clickjacking)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` (HTTPS)
- `Content-Security-Policy` (XSS mitigation)

Para un POS que maneja dinero, esto es crítico.

**Fix:**
```ts
const response = NextResponse.next()
response.headers.set('X-Frame-Options', 'DENY')
response.headers.set('X-Content-Type-Options', 'nosniff')
response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
if (process.env.NODE_ENV === 'production') {
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
}
return response
```

---

## P2 — Medios (backlog)

Ver resumen ejecutivo. Los más relevantes:

1. **13 instancias de `.catch(() => {})`** que silencian errores.
2. `use-toast.ts:11` `TOAST_LIMIT = 1` — toasts críticos (order:ready) se reemplazan silenciosamente.
3. `use-current-user.ts` sin protección de race condition ni cleanup en unmount.
4. `use-mobile.ts` hydration mismatch potencial (initial `undefined`).
5. `use-beep.ts` AudioContext nunca se cierra en unmount.
6. `kitchen-dashboard.tsx:117-121` polling cada 5s + WebSocket — redundante.
7. `subproduct-manager.tsx:107` usa `confirm()` nativo (no themeable, no a11y).
8. `subproduct-manager.tsx:51` hardcoded `pageSize=200` — trunca silenciosamente.
9. 25+ usos de `text-[10px]` — falla WCAG 1.4.4 (text resize 200%).
10. 20+ usos de `text-stone-400` / `text-slate-400` en fondo blanco — falla WCAG AA (contraste 3.0:1, requiere 4.5:1).
11. `audit-diff-dialog.tsx:153-173` `diffObjects` shallow — cambios anidados se muestran como reemplazo completo.
12. `panel-layout.tsx:218` pantalla en blanco si no hay user, sin redirect.
13. `notification-bell.tsx:111` `setTimeout(() => notif.close(), 10000)` no se limpia en unmount.
14. Sin `AbortController` en ningún fetch client → race conditions en unmount.
15. `sw.js:41, 65` comentarios dicen "v0.17.0" (stale).
16. `offline/page.tsx:162` muestra `v0.15.0` (stale).
17. `page.tsx:245` muestra `v0.6.0` (stale).
18. Doble sistema de toasts (shadcn + Sonner) — UX inconsistente.
19. `manifest.json` todos los PNG apuntan al mismo archivo → pixelated en tamaños no-nativos.
20. Sin `prefers-reduced-motion` respect en animaciones.
21. `theme-color` meta hardcoded para light y dark.
22. `notification-bell.tsx` sin `aria-label` en dot de conexión.
23. `subproduct-manager.tsx:233` botón add sin `aria-label` en estado loading.
24. `kitchen-dashboard.tsx:234` `aria-label="Toggle sonido"` no descriptivo.
25. Sin `aria-describedby` en diálogos.
26. Indicador unread color-only en notification-bell (color-blind unfriendly).
27. `use-current-user.ts` error nunca mostrado por consumidores.
28. `panel-layout.tsx` `requestAnimationFrame` para path tracking — race condition.
29. `kitchen-dashboard.tsx` sin `min-w-0` en flex containers — truncation issues.
30-38. (Ver sección P2 del reporte completo.)

---

## P3 — Bajos (cosmético)

1. `use-realtime.ts:53, 135` `areaId` dead code (en opts + dep array, sin uso).
2. `use-mobile.ts` hardcoded 768 duplica Tailwind `md`.
3. `loading.tsx` innecesario `'use client'`.
4. `cocina/page.tsx`, `pizzeria/page.tsx` podrían ser server components.
5. `logout/page.tsx` debería ser server action.
6. `offline/page.tsx` podría ser server-rendered.
7. `subproduct-manager.tsx:38` sin validación de props.
8. `audit-diff-dialog.tsx:24-28` sin validación de tipo de props.
9. `kitchen-dashboard.tsx:60` sin validación de props.
10. `notification-bell.tsx:93` `data?: any` tipo inseguro.
11. `kitchen-dashboard.tsx` dynamic `import('socket.io-client')` dentro de handler — debería ser top-level o eliminado.
12. `use-toast.ts:12` `TOAST_REMOVE_DELAY = 1000000` — magic number.
13. Drift de strings de versión (5 versiones distintas).
14. `sw.js:41, 65` comentarios dicen "v0.17.0" — stale.
15. `realtime-emitter.ts:19` URL hardcoded (server-side).
16. `panel-layout.tsx` `currentPath` solo seteado on mount.
17. `notification-bell.tsx` `load` no memoizado.
18. `useBeep.ts:42` catch vacío.
19. `use-current-user.ts:35` mensaje de error hardcoded, sin i18n.
20. `use-mobile.ts` initial `undefined` causa false-negative en SSR.
21. `kitchen-dashboard.tsx` tabs no responsive (3 cols fijas).
22. `kitchen-dashboard.tsx:311` `text-[10px]` time badge.
23. `manifest.json` `prefer_related_applications: false` redundante.
24. `sw.js` sin exponential backoff en flushQueue.
25. `sw.js` no cachea GET API responses (offline dashboard fails).
26. `panel-layout.tsx:293` texto footer redundante.
27-31. (Ver sección P3 del reporte completo.)

---

## Top 10 fixes recomendados (por impacto)

1. **Agregar `error.tsx` y `loading.tsx`** en root + cada sección (`/admin`, `/mesero`, `/cocina`, `/pizzeria`). Previene white-screen crashes.
2. **Centralizar API calls en `src/lib/api.ts`** con: 401→redirect, AbortController, retry con backoff, toast en error.
3. **Eliminar `kitchen-dashboard.tsx:144-147, 181-187` socket.emit directo** y usar `POST /api/cocina/orders/[id]/status` (que ya emite server-side).
4. **Agregar listener `SW_UPDATED` en `service-worker-register.tsx`** con toast "Nueva versión disponible — click para actualizar".
5. **Agregar `aria-label` a los 38 botones de icono** (fix mecánico).
6. **Hacer `useRealtime` singleton** vía React Context — elimina 5x sockets duplicados por página.
7. **Convertir `/`, `/login`, `/ayuda`, `/offline` a server components** con `export const metadata` — SEO + performance.
8. **Agregar 7 `overflow-x-auto` wrappers** alrededor de tablas en admin pages.
9. **Reemplazar `confirm()` con `AlertDialog`** en 3 lugares — a11y + theming.
10. **Bump touch targets a ≥40px** (`h-10`) en carrito, menu móvil, notification bell.

---

## Estado actual (v1.0.20-rc-final)

### Lo que ya está bien

✅ Backend estabilizado: 375 unit tests + 27 integration tests passing
✅ Token 5-part con authVersion unificado
✅ InventoryService como fuente única de inventario
✅ TableService con operaciones atómicas
✅ MoneyService con banker's rounding y multi-currency
✅ ProductAreaResolver para multi-área
✅ Realtime server rechaza eventos del cliente
✅ SW excluye rutas de auth de Background Sync
✅ `/api/health` retorna `{ok: true}` real (no 404)
✅ Integration tests deterministas (servidor como STEP, no child de Vitest)
✅ Idempotencia de pagos arreglada (BUG-038)
✅ TSC 0 errores, ESLint 0 errores, build SUCCESS

### Lo que falta para v1.0.20 final

❌ 6 P0 del frontend audit
❌ E2E tests (Playwright) para flujos F1, F4, F6, F9
❌ Headers de seguridad en middleware
❌ Unificar strings de versión
❌ Documentar plan de corrección de P1 (o corregirlos)

### Recomendación

**NO publicar v1.0.20 final** hasta que:
1. Los 6 P0 estén resueltos o aceptados con workaround por Leandro
2. E2E tests cubran los 4 flujos críticos no testeados
3. CI pase 5/5 verde en `main`

Publicar **v1.0.20-rc-final** como tag para que Leandro pueda probar localmente con `bun install && bun run test:integration` y validar que los flujos POS funcionan end-to-end.
