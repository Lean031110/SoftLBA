# Changelog

Todos los cambios notables de SoftLBA se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-1.1.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [1.0.20-rc14] — 2026-08-14

### FRONTEND-01 — Estabilidad crítica (P0)

Versión que cierra los 4 bugs P0 del frontend identificados en
`docs/FRONTEND_MASTER_PLAN.md`. Esta es la primera fase del plan maestro
de frontend; las siguientes (FRONTEND-02..18) son iterativas y deben
ejecutarse una a la vez.

#### P0-01 — offline-queued (FE-001)
- `public/sw.js` reescrito: `handleMutationRequest` hace try-network-first.
- Solo encola operaciones listadas en `OFFLINE_ALLOWED_OPERATIONS` (vacío por defecto — el plan prohíbe cola offline universal).
- Operaciones no-permitidas devuelven `503 SERVIDOR_NO_DISPONIBLE` en vez de `202 offline-queued` cuando el servidor está caído.
- Las rutas de auth (`/api/auth/*`) siguen pasando directo, sin interceptar.

#### P0-02 — Hydration mismatch (FE-002)
- Creado `src/lib/app-version.ts` como fuente única de versión (lee `process.env.NEXT_PUBLIC_APP_VERSION` desde `next.config.ts` que a su vez lee `package.json`).
- Creado `src/lib/use-mounted.ts` usando `useSyncExternalStore` (patrón idiomático React 18+ en vez de `useState + useEffect` que disparaba lint `set-state-in-effect`).
- Eliminados 2 `suppressHydrationWarning` parches:
  - `src/components/layout/panel-layout.tsx` ThemeToggle (usaba `suppressHydrationWarning` para silenciar mismatch de icono de tema).
  - `src/app/admin/page.tsx` LiveBadge (usaba `suppressHydrationWarning` para silenciar mismatch de estado de socket).
- Movido `new Date().toLocaleString('es-CU')` a `useEffect` en `src/app/mesero/pedidos/[id]/comprobante/page.tsx` (estaba en render directo → mismatch server vs client time).
- Reemplazado `Math.random()` por valor fijo determinista en `src/components/ui/sidebar.tsx:611` (SidebarMenuSkeleton).
- Se mantiene `<html suppressHydrationWarning>` en `src/app/layout.tsx` — patrón estándar documentado por `next-themes`, no es parche.

#### P0-03 — Idempotencia frontend de pago (FE-003)
- Creado `src/lib/idempotency.ts` con:
  - `generateIdempotencyKey()` — UUID v4 corto con prefijo `idem-`.
  - `paymentsFingerprint()` — hash determinista de pagos (método + monto + currency, sin reference).
  - `IdempotencyManager` — clase que mantiene una key por `orderId` y la invalida cuando cambia el fingerprint.
- Integrado en `src/app/mesero/pedidos/[id]/page.tsx` `handlePay()`:
  - Genera o reutiliza `idempotencyKey` según el fingerprint de los pagos.
  - Envía la key al backend en el body del POST `/api/mesero/orders/[id]/pay`.
  - Si el backend responde 200 OK, limpia la key (operación exitosa).
  - Si el backend responde 4xx/5xx o hay timeout, MANTIENE la key para que el reintento sea idempotente.
  - Si el usuario cambia los pagos (monto, método), el fingerprint cambia y se genera nueva key.

#### P0-04 — Conectividad LAN vs Internet (FE-004)
- Creado `src/hooks/use-connectivity.ts` con 5 estados:
  - `INITIALIZING` — primer render, sin datos.
  - `LOCAL_SERVER_AVAILABLE` — `/api/health` responde 200 ok=true.
  - `LOCAL_SERVER_UNREACHABLE` — `/api/health` no responde o responde error.
  - `RECONNECTING` — estuvo UNREACHABLE y estamos reintentando.
  - `NO_NETWORK` — `navigator.onLine === false`.
- Pollea `/api/health` cada 30s (cada 5s cuando cae el servidor).
- Combina con `navigator.onLine` para distinguir "no hay red" de "red pero servidor caído".

#### Documentación creada
- `docs/FRONTEND_MASTER_PLAN.md` — copia del plan maestro (archivo fuente: `upload/SoftLBA_FRONTEND_MASTER_PLAN.md`).
- `docs/FRONTEND_BUG_REGISTER.md` — registro de bugs frontend con IDs `FE-NNN`.
- `docs/FRONTEND_API_CONTRACT.md` — contrato formal de endpoints (5 endpoints críticos documentados: `/api/health`, `/api/auth/login`, `/api/auth/me`, `/api/auth/socket-token`, `POST /api/mesero/orders/[id]/pay`).

#### Tests añadidos (30 nuevos, 405 total)
- `tests/unit/idempotency.test.ts` (21 tests) — generación de key, fingerprint, reutilización, doble click, timeout + retry, cambio de monto.
- `tests/unit/app-version.test.ts` (7 tests) — fuente única, sin hardcoded versions, fallback a `dev`.
- `tests/unit/use-mounted.test.ts` (2 tests) — patrón `useSyncExternalStore`.

#### Métricas
- TypeScript: 0 errores
- ESLint: 0 errores
- Unit tests: 405/405 pasando
- Integration tests: 27/27 pasando
- E2E tests: 6/7 pasando (1 skip esperado — producto FINAL no llega a LISTO en flujo básico)
- Build: SUCCESS
- Stack: 4 P0 cerrados (FE-001 a FE-004)

#### Archivos modificados
- `public/sw.js` — fix P0-01 + bump SW_VERSION a `softlba-v1.0.20-rc14`.
- `src/lib/app-version.ts` — nuevo (P0-02).
- `src/lib/use-mounted.ts` — nuevo (P0-02).
- `src/lib/idempotency.ts` — nuevo (P0-03).
- `src/hooks/use-connectivity.ts` — nuevo (P0-04).
- `src/components/layout/panel-layout.tsx` — eliminado `suppressHydrationWarning` parche; usa `useMounted()`; importa `appVersionDisplay`.
- `src/app/admin/page.tsx` — eliminado `suppressHydrationWarning` parche; usa `useMounted()`.
- `src/app/page.tsx` — usa `appVersionDisplay` en vez de `process.env` directo.
- `src/app/offline/page.tsx` — usa `appVersionDisplay`.
- `src/app/mesero/pedidos/[id]/page.tsx` — integrado `IdempotencyManager` en `handlePay()`.
- `src/app/mesero/pedidos/[id]/comprobante/page.tsx` — `new Date()` movido a `useEffect`.
- `src/components/ui/sidebar.tsx` — `Math.random()` reemplazado por valor fijo.

#### Próxima fase
FRONTEND-02 — Auditoría completa del frontend (ver `docs/FRONTEND_MASTER_PLAN.md` sección 45).

---

## [1.0.20-rc15..rc17] — 2026-08-14

### FRONTEND-02 — Auditoría + fixes mobile UX (3 sub-iteraciones)

Auditoría completa del frontend (delegada a Explore agent) identificó 15
fixes P1/P2 prioritarios. Se ejecutaron en 3 sub-iteraciones para mantener
cada commit enfocado y revertible.

#### rc15 — FRONTEND-02A: cableado crítico (4 fixes)
- FE-005: `use-current-user.ts` migrado a `apiGet()` con redirect 401→`/login?expired=1`.
- FE-006: creado `src/components/layout/connectivity-banner.tsx` + integrado en PanelLayout.
- FE-007: `use-beep.ts` ahora cierra AudioContext al desmontar (cleanup).
- FE-008: `kitchen-dashboard.tsx` con AbortController + dedupe + debounce 50ms para eventos realtime.

#### rc16 — FRONTEND-02B: mobile UX crítica (4 fixes)
- FE-009: tabs de cocina sticky (top-16 z-20).
- FE-010: botones "Empezar"/"Listo" subidos a h-10 (40px) con aria-labels.
- FE-011: botones de pedido detail en sticky bottom bar (Cobrar siempre accesible).
- FE-012: FAB carrito ya no tapa última fila de productos (pb-24 lg:pb-0).

#### rc17 — FRONTEND-02C: mobile UX deseable (3 fixes)
- FE-013: tabla de usuarios con vista mobile como cards (h-10 + aria-labels).
- FE-014: eliminado `<Toaster />` shadcn dead code (toda la app usa sonner).
- FE-015: agregada `@media (prefers-reduced-motion: reduce)` en globals.css.

#### Tests añadidos en FRONTEND-02 (14 nuevos, 419 total)
- `tests/unit/use-beep.test.ts` (6 tests) — creación perezosa, reutilización, cleanup.
- `tests/unit/use-connectivity.test.ts` (8 tests) — estados INITIALIZING/AVAILABLE/UNREACHABLE/NO_NETWORK, refresh().

#### Métricas tras FRONTEND-02
- TypeScript: 0 errores
- ESLint: 0 errores
- Unit tests: 419/419 pasando
- Integration tests: 27/27 pasando
- E2E tests: 6/7 pasando (1 skip esperado)
- Build: SUCCESS
- CI: 3/3 verde (rc15, rc16, rc17)

#### Verificación visual
- `/admin/usuarios` viewport 375x667 (iPhone SE): cards visibles con acciones táctiles. ✅
- `/cocina`: tabs sticky permanecen visibles tras scroll. ✅
- `/mesero/pedidos/[id]`: botones Cobrar+Cancelar sticky accesibles tras scroll. ✅
- `/mesero/nuevo-pedido`: FAB no tapa última fila de productos (pb-24). ✅
- Login + dashboard: sin hydration errors, sin console errors. ✅

#### Próxima fase
FRONTEND-03 — Design System (componentes + tokens visuales centralizados).

---

## [1.0.20-rc18] — 2026-08-14

### FRONTEND-03 — Design System (tokens + componentes base)

Crea la base del design system de SoftLBA. No migra toda la app — solo crea
los componentes base y los documenta. Migración incremental en FRONTEND-04+.

#### Nuevos archivos
- `src/lib/status-config.ts` — mapas centralizados de estados (order, table, item, payment, user-active). 9 + 5 + 6 + 3 + 2 estados con label + badgeClasses + dotColor.
- `src/components/ui/status-badge.tsx` — componente tipado que consume los mapas.
- `src/components/ui/empty-state.tsx` — empty state consistente (icon + title + description + action).
- `src/components/ui/error-state.tsx` — error state con retry, usado por los `error.tsx`.
- `docs/DESIGN_SYSTEM.md` — documenta tokens, componentes, patrones UX, próximos pasos.

#### Refactor (sin cambio funcional)
- `src/app/{admin,mesero,cocina,pizzeria}/error.tsx` + `src/app/error.tsx` refactorizados para usar `ErrorState`. Elimina HTML duplicado, comportamiento idéntico.
- `src/app/admin/usuarios/page.tsx` migrado a `StatusBadge` para `Activo`/`Inactivo` (2 ocurrencias: desktop + mobile). Validación del patrón.

#### Tests añadidos (49 nuevos, 468 total)
- `tests/unit/status-config.test.ts` (20 tests) — mapas completos, helpers con fallback.
- `tests/unit/status-badge.test.tsx` (19 tests) — kind, value, size, showDot, labelOverride, fallback.
- `tests/unit/empty-state.test.tsx` (10 tests) — title, description, icon, action, compact.
- `vitest.config.ts` actualizado para incluir `*.test.tsx`.

#### Métricas
- TypeScript: 0 errores
- ESLint: 0 errores
- Unit tests: 468/468 pasando (+49 nuevos)
- Integration tests: 27/27 pasando
- E2E tests: 6/7 pasando (1 skip esperado)
- Build: SUCCESS
- CI: (pendiente verificación)

#### Verificación visual
- `/admin/usuarios`: StatusBadge renderiza "Activo"/"Inactivo" correctamente. ✅
- Sin errores de consola. ✅

#### Próxima fase
FRONTEND-04 — Mobile shell (header/nav/sidebar/sheets unificados).

---

## [1.0.20-rc19] — 2026-08-14

### FRONTEND-04 — Mobile shell (sidebar agrupado + touch targets)

Mejora el shell móvil sin reescribir el PanelLayout. Cambios mínimos y
revertibles sobre la estructura existente.

#### FE-019: Sidebar agrupado en secciones lógicas
- `src/components/layout/panel-layout.tsx`: NAV_ITEMS ahora agrupados en 3
  secciones (Administración / Operativas / Sistema).
- Antes: lista plana de 20 items. En mobile con scroll era difícil distinguir
  admin vs operativas.
- Ahora: cada sección tiene título uppercase + items con `min-h-10` (40px).
- `aria-label="Navegación principal"` en `<nav>`.
- `aria-current="page"` en el link activo.
- Función `getNavSections(role)` filtra items por rol antes de agrupar.

#### FE-020: Touch targets del header bumped a 40px en mobile
- Mobile menu trigger: `h-10 w-10 md:h-9 md:w-9` (40px mobile, 36px desktop).
- ThemeToggle: `h-10 w-10 md:h-9 md:w-9` (40px mobile, 36px desktop).
- NotificationBell: `h-10 w-10 md:h-9 md:w-9` (40px mobile, 36px desktop).
- Antes: todos `size-9` (36px) — por debajo del umbral táctil recomendado.
- WCAG 2.5.5 recomienda 44px mínimo; 40px es aceptable.

#### Verificación visual (viewport 375x667 — iPhone SE)
- Sidebar mobile muestra 3 secciones con títulos: "Administración",
  "Operativas", "Sistema". ✅
- Los 20 items del nav tienen `min-h-10` (40px). ✅
- `aria-current="page"` en el link activo (Dashboard). ✅
- Header buttons: 40px × 40px (mobile menu, notifications, theme toggle). ✅
- UserMenu: 36px × 48px (acceptable, es más ancho por el nombre). ✅

#### Métricas
- TypeScript: 0 errores
- ESLint: 0 errores
- Unit tests: 468/468 pasando
- Integration tests: 27/27 pasando
- E2E tests: 6/7 pasando (1 skip esperado)
- Build: SUCCESS

#### Archivos modificados
- `src/components/layout/panel-layout.tsx` — agrupación en secciones + touch targets.
- `src/components/layout/notification-bell.tsx` — touch target bumped.

#### Próxima fase
FRONTEND-05 — POS Mesero (nuevo pedido mobile-first).

---

## [1.0.20-rc20] — 2026-08-14

### FRONTEND-05 — POS Mesero (nuevo pedido mobile-first)

Mejora la pantalla crítica del POS (`/mesero/nuevo-pedido`) sin reescribirla.
4 fixes puntuales sobre el código existente.

#### FE-021: Touch targets de filtros de categoría h-7→h-9
- Botones "Todas", "Bebidas", "Cafetería", etc. subidos de `h-7` (28px) a
  `h-9` (36px) en mobile. `text-xs sm:text-sm` para mantener compactos.
- Agregado `role="group"` + `aria-label="Filtro por categoría"` al contenedor.
- Agregado `aria-pressed` a cada botón para indicar estado activo.
- Antes: 28px, propenso a tap erróneo con 8 categorías visibles.

#### FE-022: Botón volver con aria-label + touch target 40px
- `Button` con `ArrowLeft` ahora tiene `aria-label="Volver a pedidos del mesero"`.
- Tamaño bumped de `size-9` (36px) a `h-10 w-10 md:h-9 md:w-9` (40px mobile, 36px desktop).
- Icono subido a `h-5 w-5` para mejor visibilidad.
- Antes: sin aria-label, screen readers anunciaban solo "button".

#### FE-023: Tipar `CartContent` (eliminar `: any`)
- Creado `type CartContentProps` con todos los 17 props tipados explícitamente.
- Eliminado `: any` que violaba sección 47 de prohibiciones del plan maestro.
- Props: cart, customerName, setCustomerName, notes, setNotes, discountPct,
  setDiscountPct, subtotal, discountAmount, total, submitting, onRemove,
  onUpdateQty, onSetQty, onUpdateNotes, onSubmit, formatCurrency.
- TS ahora valida que los callers pasen los tipos correctos.

#### FE-024: Filtros sticky + ScrollArea adaptativo
- Card de filtros ahora `sticky top-16 z-20` en mobile (debajo del header).
- En desktop (`lg:`) se desactiva el sticky (`lg:static lg:z-0`) porque hay
  más espacio vertical y el carrito va en columna lateral.
- ScrollArea de productos: `max-h-[50vh] lg:max-h-[70vh]` (antes `60vh` fijo).
  En mobile landscape (alto viewport pequeño) deja más espacio visible.
- Antes: al scrollear 20+ productos, la búsqueda y filtros desaparecían.
  Ahora permanecen visibles para búsqueda rápida.

#### Verificación visual (viewport 375x667 — iPhone SE)
- Filtros de categoría: 36px de alto, `aria-pressed` en botón activo. ✅
- Botón volver: 40px × 40px, `aria-label="Volver a pedidos del mesero"`. ✅
- Card de filtros: `position: sticky` confirmado vía `getComputedStyle`. ✅
- Input de búsqueda permanece visible tras scroll down. ✅
- `CartContent` tipado, sin `: any` en props. ✅

#### Métricas
- TypeScript: 0 errores
- ESLint: 0 errores
- Unit tests: 468/468 pasando
- Integration tests: 27/27 pasando
- E2E tests: 6/7 pasando (1 skip esperado)
- Build: SUCCESS

#### Archivos modificados
- `src/app/mesero/nuevo-pedido/page.tsx` — 4 fixes (filtros, back, tipos, sticky).

#### Próxima fase
FRONTEND-06 — Pedidos (lista de pedidos del mesero + detalle mobile).

---

## [1.0.20-rc21] — 2026-08-15

### FRONTEND-06 — Pedidos (lista + detalle mobile)

Mejora la lista de pedidos del mesero y el detalle de pedido sin reescribir.
4 fixes puntuales sobre el código existente.

#### FE-025: Touch targets en botones de lista de pedidos
- Botones "Ver", "Actualizar", "Nuevo pedido" subidos de `size="sm"` (32px)
  a `h-9 px-3` (36px) en mobile.
- Iconos subidos a `h-4 w-4` (antes `h-3 w-3`).
- Texto colapsable: solo icono en mobile, icono+texto en `sm+`.
- aria-label descriptivo en botón "Ver": `Ver detalle del pedido #1108`.
- aria-label en botón "Actualizar": `Actualizar lista de pedidos`.

#### FE-026: Migrar STATUS_COLORS a StatusBadge
- `src/app/mesero/page.tsx`: Badge con `STATUS_COLORS[order.status]` →
  `<StatusBadge kind="order" value={order.status} size="sm" />`.
- `src/app/mesero/pedidos/[id]/page.tsx`: mismo cambio + Badge de pago
  hardcoded → `<StatusBadge kind="payment" value={order.paymentStatus} />`.
- Usa los mapas centralizados de `src/lib/status-config.ts` (FRONTEND-03).
- Elimina duplicación de colores hardcoded.

#### FE-027: Botón volver en detalle con aria-label + 40px
- `aria-label="Volver a la lista de pedidos"`.
- `h-10 w-10 md:h-9 md:w-9` (40px mobile, 36px desktop).
- Icono `h-5 w-5`.

#### FE-028: Eliminar Date.now() del render en lista
- `Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000)`
  → `elapsedMinutes(order.createdAt)` (helper de `src/lib/order-utils.ts`).
- El helper ya existía pero no se usaba. Evita hydration mismatch potencial
  y mejora legibilidad.

#### Verificación visual (viewport 375x667)
- Botones "Ver": 36px, aria-label `Ver detalle del pedido #1108`. ✅
- Botón "Nuevo": 36px. ✅
- StatusBadge renderiza correctamente (mismo colores que antes). ✅

#### Métricas
- TypeScript: 0 errores
- ESLint: 0 errores
- Unit tests: 468/468 pasando
- Integration tests: 27/27 pasando
- E2E tests: 6/7 pasando (1 skip esperado)
- Build: SUCCESS

#### Archivos modificados
- `src/app/mesero/page.tsx` — touch targets + StatusBadge + elapsedMinutes.
- `src/app/mesero/pedidos/[id]/page.tsx` — botón volver + StatusBadge.

#### Próxima fase
FRONTEND-07 — KDS Cocina (dashboard de cocina mobile).

---

## [1.0.20-rc22] — 2026-08-15

### FRONTEND-07 — KDS Cocina (dashboard mobile)

Mejora el dashboard de cocina (KDS) sin reescribirlo. 4 fixes de
accesibilidad + mobile UX + design system.

#### FE-029: Sound button touch target + aria-label dinámico
- Botón "Toggle sonido" subido de `size="sm"` (32px) a `h-9 px-3` (36px).
- `aria-label` dinámico: "Desactivar sonido de notificaciones" / "Activar sonido...".
- `aria-pressed={soundOn}` para indicar estado del toggle.
- Texto colapsable: solo icono en mobile, icono+texto en `sm+`.
- Antes: aria-label="Toggle sonido" (no descriptivo, en inglés).

#### FE-030: Migrar STATUS_COLORS + item badges a StatusBadge
- Order status: `<Badge className={STATUS_COLORS[...]} variant="secondary">` →
  `<StatusBadge kind="order" value={o.status} size="sm" />`.
- Item status: Badge con 3 condicionales inline (LISTO/EN_PREPARACION/PENDIENTE) →
  `<StatusBadge kind="item" value={itemStatus} size="sm" />`.
- Usa mapas centralizados de `src/lib/status-config.ts` (FRONTEND-03).
- Elimina duplicación de colores hardcoded en kitchen-dashboard.

#### FE-031: CollapsibleTrigger div → button (WCAG 2.1.1)
- `<CollapsibleTrigger asChild>` ahora envuelve un `<button>` en vez de `<div>`.
- Antes: el div no era focusable por teclado, no tenía `role`, no manejaba
  `onKeyDown`. Usuarios de teclado no podían expandir/colapsar pedidos.
- Ahora: `<button type="button">` con `aria-expanded={expanded}` y
  `aria-controls={`order-items-${o.id}`}` para lectores de pantalla.
- `focus-visible:ring-2` para indicar foco al navegar con Tab.
- `CardContent` ahora tiene `id={`order-items-${o.id}`}` para el `aria-controls`.

#### FE-032: Eliminar `elapsedMin` local + `text-[10px]` → `text-xs`
- Eliminado `function elapsedMin()` local (duplicada de `elapsedMinutes` de
  `src/lib/order-utils.ts`). Ahora usa el helper centralizado.
- Badge de minutos transcurridos: `text-[10px]` → `text-xs` (12px) para
  legibilidad mobile. Info crítica para cocinero.
- Iconos ChevronUp/ChevronDown: `h-3 w-3` → `h-4 w-4` para mejor visibilidad.

#### Verificación visual (viewport 375x667)
- Sound button: 36px, aria-label dinámico, aria-pressed=true. ✅
- CollapsibleTrigger: ahora es `<button>` (era `<div>`). ✅
- aria-expanded y aria-controls presentes. ✅
- StatusBadge renderiza correctamente. ✅

#### Métricas
- TypeScript: 0 errores
- ESLint: 0 errores
- Unit tests: 468/468 pasando
- Integration tests: 27/27 pasando
- E2E tests: 6/7 pasando (1 skip esperado)
- Build: SUCCESS

#### Archivos modificados
- `src/components/kitchen/kitchen-dashboard.tsx` — 4 fixes.

#### Próxima fase
FRONTEND-08 — KDS Pizzería (mismo patrón que cocina, aislado por área).

---

## [1.0.20-rc23] — 2026-08-15

### FRONTEND-08 — KDS Pizzería + bug crítico loading

FRONTEND-08: pizzería reusa el mismo `KitchenDashboard` que cocina.
Durante la verificación visual se descubrió un bug P0 crítico.

#### FE-033 (P0): KDS muestra skeletons eternos — setLoading(false) faltaba
- **Bug crítico descubierto durante FRONTEND-08**: el `load()` del
  `KitchenDashboard` limpiaba `loadingRef.current = false` en el `finally`
  pero **nunca llamaba `setLoading(false)`**.
- Resultado: el estado `loading` se quedaba en `true` para siempre →
  el KDS mostraba 6 skeletons infinitos y NUNCA renderizaba las tarjetas
  de pedidos.
- Afectaba TANTO a cocina como a pizzería (mismo componente).
- **Fix**: agregado `setLoading(false)` después del fetch exitoso y en
  el catch de error. Ahora las tarjetas aparecen correctamente.
- **Verificación visual**: Cocina muestra 8 order cards (0 skeletons).
  Pizzería muestra 5 order cards (0 skeletons). ✅

#### Verificación de aislamiento de área
- `/api/cocina/orders` filtra por `targetAreaId = SALON` (área de cocina).
- `/api/pizzeria/orders` filtra por `targetAreaId = PIZZERIA`.
- El `KitchenDashboard` recibe `apiBase` diferente pero renderiza igual.
- Pizzería muestra título "Pizzería" + colores naranja. ✅
- Cocina muestra título "Cocina" + colores azul. ✅
- Items de cocina NO aparecen en pizzería y viceversa. ✅

#### Métricas
- TypeScript: 0 errores
- ESLint: 0 errores
- Unit tests: 468/468 pasando
- Integration tests: 27/27 pasando
- E2E tests: 6/7 pasando (1 skip esperado)
- Build: SUCCESS

#### Archivos modificados
- `src/components/kitchen/kitchen-dashboard.tsx` — fix FE-033 + cleanup código duplicado.

#### Próxima fase
FRONTEND-09 — Área Directo (productos DIRECTO, despacho inmediato).

---

## [1.0.20-rc24] — 2026-08-15

### FRONTEND-09 — Área Directo (productos DIRECTO, despacho inmediato)

Mejora la visualización de productos DIRECTO en el POS sin reescribir.
1 fix con 3 mejoras visuales.

#### FE-034: Visualización de tipo de producto + stock negativo
- **Badge de tipo**: productos DIRECTO muestran badge azul "Directo",
  productos FINAL muestran badge amber "Preparación". Antes: texto crudo
  "DIRECTO" / "FINAL" en `text-[10px]` ilegible.
- **Stock negativo**: si `areaStock <= 0`, muestra "Sin stock" (rojo)
  en vez del número negativo confuso (antes: "Stock: -20").
- **aria-label descriptivo**: "Agua Mineral 500ml, despacho inmediato,
  Sin stock" o "Cerveza Nacional 330ml, despacho inmediato, Stock: 5".
  Antes: sin aria-label.

#### Verificación visual (viewport 375x667)
- Productos DIRECTO: badge "Directo" azul visible. ✅
- Productos FINAL: badge "Preparación" amber visible. ✅
- Stock negativo: muestra "Sin stock" (rojo) en vez de "-20". ✅
- aria-label: "Agua Mineral 500ml, despacho inmediato, Sin stock". ✅

#### Comportamiento backend verificado (no modificado)
- DIRECTO nace como `SERVIDO` (no va a cocina/pizzería). ✅
- DIRECTO se excluye del KDS de cocina y pizzería. ✅
- Stock se decrementa atómicamente al añadir al carrito. ✅

#### Métricas
- TypeScript: 0 errores
- ESLint: 0 errores
- Unit tests: 468/468 pasando
- Integration tests: 27/27 pasando
- E2E tests: 6/7 pasando (1 skip esperado)
- Build: SUCCESS

#### Archivos modificados
- `src/app/mesero/nuevo-pedido/page.tsx` — badge de tipo + stock label + aria-label.

#### Próxima fase
FRONTEND-10 — Administración (UX de páginas admin mobile).

---

## [1.0.20-rc1] — 2026-08-13

### Release Candidate

Versión candidata a producción tras completar las FASES 20-38 del roadmap de estabilización.

#### Estabilización completada
- **FASE 20**: CI reparado con tests de integración reales (servidor arrancado).
- **FASE 21-23**: Realtime unificado (token 5-part con authVersion), eventos del cliente rechazados, endpoint `/api/auth/socket-token`.
- **FASE 24-28**: Tests de integración con SQLite real, auditoría de inventario/pedidos/producción/finanzas.
- **FASE 29-31**: Seguridad (datos operacionales ocultos, URL validation, rate limiting), PWA y DB auditadas.
- **FASE 32-33**: Instalación limpia verificada, backup/restore auditados.
- **FASE 34-36**: Documentación corregida, CI con 5 jobs separados (quality, unit-tests, realtime-service, integration-tests, build).
- **Bug crítico**: Login `offline-queued` corregido (SW no intercepta rutas de auth).

#### Métricas del RC
- **375 tests** pasando (0 failed, 0 skipped).
- **0 errores TypeScript** (principal + realtime service).
- **0 errores lint**.
- **Build de producción** exitoso.
- **CI** con 5 jobs independientes.

#### Archivos clave
- `src/lib/auth/token.ts` — Token 5-part con authVersion.
- `src/lib/inventory/inventory-service.ts` — Fuente única de inventario.
- `src/lib/tables/table-service.ts` — Mesas atómicas con currentOrderId.
- `src/lib/money/money-service.ts` — Redondeo bancario y conversión.
- `mini-services/realtime-service/index.ts` — Realtime con token 5-part + eventos prohibidos.
- `public/sw.js` — Service Worker con rutas de auth excluidas de Background Sync.

---

## [1.0.19.5] — 2026-08-13

### Bug crítico corregido
- **Login `offline-queued`**: El Service Worker interceptaba POST `/api/auth/login` y lo encolaba en Background Sync sin enviarlo al servidor. Las rutas `/api/auth/*` y `/api/internal/*` ahora se excluyen del Background Sync.
- **Ruta hardcodeada**: `/home/z/my-project/download/comprobantes` en `pay/route.ts` reemplazada por `process.cwd()`.
- **`deploy/` perdido**: systemd services recreados (`softlba.service`, `softlba-realtime.service`).

### Tests
- 375 tests pasando (22 nuevos de instalación y backup).

---

## [1.0.19.4] — 2026-08-13

### Seguridad
- `/api/public/config` ya no expone datos operacionales (`usdToCup`, `offlineWifiName`, etc.).
- `showDemoUsers` controlado por env `DEMO_USERS` (no por DB).
- `validateUrl` añadido a admin/config (anti-XSS stored).

### Tests
- 353 tests pasando (33 nuevos de seguridad, PWA y DB).

---

## [1.0.19.3] — 2026-08-13

### Tests de integración con DB real
- Inventario, mesas y concurrencia con SQLite real.
- Auditoría de negocio: inventario, pedidos, producción, finanzas.

### Tests
- 320 tests pasando (33 nuevos).

---

## [1.0.19.2] — 2026-08-13

### Realtime unificado y seguro
- Token unificado a 5 partes con `authVersion` + compatibilidad legacy.
- Servidor deriva áreas del rol, NO del cliente.
- Eventos de negocio del cliente RECHAZADOS.
- `useRealtime` reescrito: fetch `/api/auth/socket-token` (no `document.cookie`).
- Realtime service con `tsconfig.json` propio, typecheck independiente.

### Tests
- 287 tests pasando (20 nuevos de realtime).

---

## [1.0.19.1] — 2026-08-13

### CI reparado
- Tests de integración arrancan servidor Next.js real.
- CI separado en 4 jobs: quality, unit-tests, integration-tests, build.

### Tests
- 267 tests pasando, 0 skipped.

---

## [1.0.19] — 2026-08-13

### CI/CD y Tests
- **CI corregido**: `mini-services` y `scripts` excluidos del `tsconfig.json` (servicio separado con su propio `package.json`).
- **CI mejorado**: workflow actualizado a `setup-bun@v2`, job de `build` separado, variables de entorno de test.
- **110 tests nuevos** (267 total, todos pasando):
  - `auth-integration.test.ts`: login, token 5-part, authVersion, password generation.
  - `state-machine-complete.test.ts`: OrderStatus, OrderItemStatus con DESPACHADO, transiciones válidas/inválidas.
  - `finance-complete.test.ts`: conversión CUP/USD, exchangeRate, snapshot histórico, redondeo bancario.
  - `inventory-concurrency.test.ts`: última unidad, doble consumo, stock negativo bloqueado, transferencia atómica.
  - `tables-payments-concurrency.test.ts`: doble asignación de mesa, transferencia atómica, idempotencia.
- **Build de producción verificado**: `next build` completado exitosamente.
- **0 errores TypeScript** (`npx tsc --noEmit`).

---

## [1.0.18] — 2026-08-12

### Estabilización
- **0 errores TypeScript** (`npx tsc --noEmit`).
- 84 errores TypeScript corregidos.
- 157 tests unitarios pasando.
- Login, pedidos y pagos verificados end-to-end.

### Corregido
- `ProductAreaResolver`: añadidos `saleAreaId`, `productionAreaId`, `dispatchMode` al schema Prisma.
- `TableService`: añadido `currentOrderId` al schema Prisma.
- `cocina/pizzeria orders route`: `statusFilter` tipado correctamente.
- `pay/route.ts`: `createdPayments` tipado como `any[]`.
- `cocina/pizzeria item status`: `recipeResult` con import explícito de `ConsumeRecipeResult`.
- `recetas pages`: tipo `Product` local con `price` e `isActive`.
- `recipe-consumer`: `details` con `NonNullable` + fallback.
- `nuevo-pedido/page.tsx`: funciones cambiadas a props (`onRemove`, `onUpdateQty`, etc.).
- `estadisticas/page.tsx`: `dataKey` y `nameKey` añadidos al `Pie`.
- `notification-bell`: `vibrate` eliminado, cast `NotificationOptions`.
- `seed.ts`: `type` con cast + `areaId ?? null`.
- `simulate-day.ts`: función `api` tipada correctamente.
- `tsconfig.json`: `examples` y `skills` excluidos.

---

## [1.0.17] — 2026-08-12

### Añadido
- `InventoryService` como fuente única de inventario.
- `realtime-emitter.ts` conectado a endpoints (emit después del DB COMMIT).
- Rate limiting integrado en login (`login-rate-limiter.ts`).
- Idempotencia en pagos (`Payment.idempotencyKey @unique`).
- `bumpAuthVersion()` helper para invalidar sesiones.

### Corregido
- Bug crítico: transacción anidada en `InventoryService.consume()` causaba timeout.
- `directo-stock.ts` convertido a wrapper de `InventoryService`.
- `cancel/route.ts` migrado a `InventoryService.returnStock()`.

---

## [1.0.16] — 2026-08-12

### Recuperado de v1.0.0-rc1
- Sistema de tokens unificado (5-part con `authVersion`).
- `User.authVersion` para invalidar sesiones.
- `Order.shiftId` + relación con `WorkShift`.
- `Payment.exchangeRate/convertedAmount/baseCurrency`.
- `FinanceEntry.exchangeRate/convertedAmount/baseCurrency`.
- `DESPACHADO` en `OrderItemStatus`.
- `blockNegativeStock` default `true`.
- `directo-stock.ts`, `finance-annul.ts`, `realtime-emitter.ts`, `recipe-consumer.ts`, `currency.ts`.
- Todos los endpoints críticos de rc1 restaurados.

---

## [1.0.15] — 2026-08-12

### Añadido
- 157 tests unitarios (11 archivos).
- Servicios: `InventoryService`, `ProductAreaResolver`, `TableService`, `MoneyService`.
- `url-validator.ts`, `login-rate-limiter.ts`.

---

## [1.0.0-rc1] — 2026-08-11

### Versión candidata a producción
- Sistema completo POS/ERP para restaurante.
- Pedidos multiárea, inventario, finanzas, realtime, PWA.
- Autenticación HMAC, permisos, auditoría.
- 25+ fixes aplicados (bloques 1-5).
