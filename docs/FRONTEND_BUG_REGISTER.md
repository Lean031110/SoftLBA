# SoftLBA — Frontend Bug Register

**Última actualización:** 2026-08-14
**Fuente de verdad:** `docs/FRONTEND_MASTER_PLAN.md` sección 44
**Formato:** IDs `FE-NNN` (Frontend Bug)

Leyenda de severidad:
- **P0** — Crítico: bloquea publicación / pérdida de datos / seguridad
- **P1** — Alto: afecta flujo de producción diario
- **P2** — Medio: degradación UX o fragilidad
- **P3** — Bajo: cosmético / código limpio

---

## Bugs activos

| ID | Fecha | Sev | Módulo | Síntoma | Causa verificada | Fix plan | Estado |
|----|-------|-----|--------|---------|------------------|----------|--------|
| (ninguno P0/P1 activo tras FRONTEND-02) | | | | | | | |

Pendientes para FRONTEND-05+ (POS Mesero) y siguientes fases:
- P2: aria-labels en 31 icon buttons restantes (ver auditoría FRONTEND-02).
- P2: tablas admin/productos aún en desktop-first con overflow-x-auto.
- P3: tipado `any` en use-realtime callbacks (data?: any).
- P3: virtualización de listas largas (productos con 200+ items).

---

## Bugs resueltos (historial)

| ID | Fecha | Sev | Módulo | Síntoma | Fix | Versión | Commit |
|----|-------|-----|--------|---------|-----|---------|--------|
| FE-001 | 2026-08-14 | P0 | PWA | Operaciones POST (crear pedido, pagar, transferir) devuelven `202 offline-queued` aunque el servidor esté disponible | SW reescrito: `handleMutationRequest` hace try-network-first; solo encola si la operación está en `OFFLINE_ALLOWED_OPERATIONS` (lista vacía por defecto); si no, devuelve 503 `SERVIDOR_NO_DISPONIBLE` | v1.0.20-rc14 | 4fe8998 |
| FE-002 | 2026-08-14 | P0 | HYDRATION | React reporta `Hydration failed because the server rendered text didn't match the client` | Creado `src/lib/app-version.ts` + `src/lib/use-mounted.ts` (useSyncExternalStore); eliminados 2 `suppressHydrationWarning` parches en `panel-layout.tsx` y `admin/page.tsx`; movido `new Date()` a `useEffect` en `comprobante/page.tsx`; reemplazado `Math.random()` por valor fijo en `ui/sidebar.tsx` | v1.0.20-rc14 | 4fe8998 |
| FE-003 | 2026-08-14 | P0 | PAY | Doble click en "Cobrar" o reintento por timeout crea múltiples `Payment` rows | Creado `src/lib/idempotency.ts` con `IdempotencyManager` + `paymentsFingerprint()`; integrado en `handlePay()` en `mesero/pedidos/[id]/page.tsx` — la key se reutiliza mientras no cambien los pagos y se limpia tras 200 OK | v1.0.20-rc14 | 4fe8998 |
| FE-004 | 2026-08-14 | P0 | CONNECTIVITY | App no distingue "Internet caído pero LAN funciona" de "LAN caída" | Creado `src/hooks/use-connectivity.ts` con 5 estados: `INITIALIZING`, `LOCAL_SERVER_AVAILABLE`, `LOCAL_SERVER_UNREACHABLE`, `RECONNECTING`, `NO_NETWORK`; pollea `/api/health` cada 30s (5s cuando cae); combina con `navigator.onLine` | v1.0.20-rc14 | 4fe8998 |
| FE-005 | 2026-08-14 | P1 | AUTH | `use-current-user.ts` no redirige a `/login` en 401 → usuario queda con datos stale tras expirar sesión | Migrado a `apiGet()` de `src/lib/api.ts`; apiFetch detecta 401 y redirige a `/login?expired=1` antes de lanzar ApiError | v1.0.20-rc15 | cbb42f0 |
| FE-006 | 2026-08-14 | P1 | CONNECTIVITY | Hook `useConnectivity` creado pero no integrado en UI | Creado `src/components/layout/connectivity-banner.tsx` con banner amarillo (UNREACHABLE/RECONNECTING) o rojo (NO_NETWORK); integrado en PanelLayout arriba del skip-link | v1.0.20-rc15 | cbb42f0 |
| FE-007 | 2026-08-14 | P1 | AUDIO | `use-beep.ts` crea AudioContext pero nunca lo cierra → memory leak (browsers cap en ~6 contextos) | Agregado `useEffect` cleanup que llama `ctx.close()` al desmontar; tests cubren creación perezosa, reutilización singleton, cleanup | v1.0.20-rc15 | cbb42f0 |
| FE-008 | 2026-08-14 | P1 | REALTIME | `kitchen-dashboard` lanza N fetches paralelos sin abort cuando llegan eventos realtime múltiples → race condition con stale state | Agregado `AbortController` para cancelar fetches viejos, `loadingRef` para dedupe, `debounceTimerRef` (50ms) para eventos realtime; cleanup al desmontar | v1.0.20-rc15 | cbb42f0 |
| FE-009 | 2026-08-14 | P1 | KDS | Tabs de cocina no son sticky → con 30+ pedidos el cocinero no puede cambiar de tab sin scroll arriba | Agregado `sticky top-16 z-20 bg-background` al contenedor de tabs | v1.0.20-rc16 | 3a01fa0 |
| FE-010 | 2026-08-14 | P1 | KDS | Botones "Empezar"/"Listo" de items son h-7 (28px) → inusables con guantes/manos mojadas en cocina | Subidos a h-10 (40px) con icono+texto colapsable (`hidden sm:inline`); aria-labels descriptivos con nombre de producto | v1.0.20-rc16 | 3a01fa0 |
| FE-011 | 2026-08-14 | P1 | POS | Botones de acción (Cobrar/Cancelar/Actualizar) en pedido detail no son sticky → desaparecen al scrollear items | Contenedor sticky bottom-0 z-20 backdrop-blur en mobile/tablet; lg:static en desktop para no interferir | v1.0.20-rc16 | 3a01fa0 |
| FE-012 | 2026-08-14 | P1 | POS | FAB del carrito (fixed bottom-4 h-14) tapa la última fila de productos en mobile | Agregado `pb-24 lg:pb-0` al contenedor de productos (96px de espacio inferior en mobile) | v1.0.20-rc16 | 3a01fa0 |
| FE-013 | 2026-08-14 | P2 | ADMIN | Tabla de usuarios en mobile requiere scroll horizontal (7 columnas) — UX deficiente | Agregada vista mobile como cards con acciones táctiles h-10 + aria-labels descriptivos; tabla original se mantiene en desktop (md+) | v1.0.20-rc17 | 6ff5084 |
| FE-014 | 2026-08-14 | P2 | CODE | `<Toaster />` shadcn montado pero nunca recibe toasts (toda la app usa sonner) → dead code + TOAST_LIMIT=1 silenciaba notificaciones | Eliminado `<Toaster />` y su import en `src/app/layout.tsx` | v1.0.20-rc17 | 6ff5084 |
| FE-015 | 2026-08-14 | P2 | A11Y | 0 respeto a `prefers-reduced-motion` en toda la app → usuarios con sensibilidad al movimiento no pueden reducir animaciones | Agregada media query `@media (prefers-reduced-motion: reduce)` en `src/app/globals.css` que reduce animation/transition-duration a 0.01ms | v1.0.20-rc17 | 6ff5084 |
| FE-019 | 2026-08-14 | P1 | SHELL | Sidebar con 20 items en lista plana → en mobile no se distinguía admin vs operativas | NAV_ITEMS agrupados en 3 secciones (Administración/Operativas/Sistema) con `getNavSections(role)`; títulos uppercase + `min-h-10` (40px) por item; `aria-label` y `aria-current` | v1.0.20-rc19 | (pendiente push) |
| FE-020 | 2026-08-14 | P1 | A11Y | Header buttons `size-9` (36px) → por debajo del umbral táctil recomendado (40px) en mobile | Mobile menu trigger, ThemeToggle, NotificationBell bumped a `h-10 w-10 md:h-9 md:w-9` (40px mobile, 36px desktop) | v1.0.20-rc19 | 5538184 |
| FE-021 | 2026-08-14 | P1 | POS | Botones de filtro de categoría en nuevo-pedido son `h-7` (28px) → propensos a tap erróneo con 8 categorías visibles | Subidos a `h-9` (36px) con `text-xs sm:text-sm`; agregado `role="group"` + `aria-label="Filtro por categoría"` + `aria-pressed` por botón | v1.0.20-rc20 | (pendiente push) |
| FE-022 | 2026-08-14 | P1 | A11Y | Botón volver en nuevo-pedido sin `aria-label` + `size-9` (36px) → screen readers no lo anuncian | Agregado `aria-label="Volver a pedidos del mesero"` + `h-10 w-10 md:h-9 md:w-9` (40px mobile) + icono `h-5 w-5` | v1.0.20-rc20 | (pendiente push) |
| FE-023 | 2026-08-14 | P1 | CODE | `CartContent` en nuevo-pedido usa `: any` en props → pierde tipado, viola sección 47 prohibiciones | Creado `type CartContentProps` con 17 props tipados explícitamente; TS valida callers | v1.0.20-rc20 | (pendiente push) |
| FE-024 | 2026-08-14 | P1 | POS | Filtros de búsqueda y categoría en nuevo-pedido no son sticky → al scrollear 20+ productos desaparecen | Card de filtros `sticky top-16 z-20` en mobile (`lg:static`); ScrollArea `max-h-[50vh] lg:max-h-[70vh]` adaptativo | v1.0.20-rc20 | ff66d69 |
| FE-025 | 2026-08-15 | P1 | POS | Botones "Ver"/"Actualizar"/"Nuevo pedido" en lista de pedidos son `size="sm"` (32px) → táctil pequeño | Subidos a `h-9 px-3` (36px) con icono `h-4 w-4`; texto colapsable `hidden sm:inline`; aria-label descriptivo por pedido | v1.0.20-rc21 | (pendiente push) |
| FE-026 | 2026-08-15 | P1 | CODE | `STATUS_COLORS`/`STATUS_LABELS` hardcoded en mesero/page.tsx y pedidos/[id] → duplicación de colores | Migrado a `<StatusBadge kind="order" />` y `<StatusBadge kind="payment" />` usando mapas de `src/lib/status-config.ts` (FRONTEND-03) | v1.0.20-rc21 | (pendiente push) |
| FE-027 | 2026-08-15 | P1 | A11Y | Botón volver en detalle de pedido sin aria-label + `size="icon"` (36px) | `aria-label="Volver a la lista de pedidos"` + `h-10 w-10 md:h-9 md:w-9` (40px mobile) | v1.0.20-rc21 | (pendiente push) |
| FE-028 | 2026-08-15 | P2 | CODE | `Date.now()` en render de lista de pedidos → hydration mismatch potencial | Reemplazado por `elapsedMinutes()` helper de `src/lib/order-utils.ts` | v1.0.20-rc21 | a24644c |
| FE-029 | 2026-08-15 | P1 | KDS | Sound button en cocina `size="sm"` (32px) + aria-label "Toggle sonido" no descriptivo | Subido a `h-9 px-3` (36px); aria-label dinámico "Desactivar/Activar sonido de notificaciones"; aria-pressed; texto colapsable | v1.0.20-rc22 | (pendiente push) |
| FE-030 | 2026-08-15 | P1 | CODE | `STATUS_COLORS`/`STATUS_LABELS` hardcoded en kitchen-dashboard + item badges con 3 condicionales inline | Migrado a `<StatusBadge kind="order" />` y `<StatusBadge kind="item" />` usando mapas de `src/lib/status-config.ts` | v1.0.20-rc22 | (pendiente push) |
| FE-031 | 2026-08-15 | P1 | A11Y | `<CollapsibleTrigger asChild>` envuelve `<div>` → no focusable por teclado (WCAG 2.1.1) | Cambiado a `<button type="button">` con `aria-expanded` + `aria-controls` + `focus-visible:ring-2` | v1.0.20-rc22 | (pendiente push) |
| FE-032 | 2026-08-15 | P2 | CODE | `elapsedMin` local duplica `elapsedMinutes` de order-utils + `text-[10px]` ilegible | Eliminado helper local, usa `elapsedMinutes()`; badge de minutos a `text-xs` (12px) | v1.0.20-rc22 | 8423244 |
| FE-033 | 2026-08-15 | P0 | KDS | **KDS muestra skeletons eternos y nunca renderiza pedidos** — `load()` limpia `loadingRef` pero nunca llama `setLoading(false)` | Agregado `setLoading(false)` después del fetch exitoso + en catch de error | v1.0.20-rc23 | 2bb6046 |
| FE-034 | 2026-08-15 | P1 | POS | Productos DIRECTO muestran tipo como texto crudo "DIRECTO" en `text-[10px]` ilegible + stock negativo confuso ("Stock: -20") + sin aria-label | Badge azul "Directo" / amber "Preparación" + "Sin stock" en rojo para stock ≤ 0 + aria-label descriptivo con tipo, stock y nombre | v1.0.20-rc24 | 8d133be |
| FE-035 | 2026-08-15 | P1 | CODE | `STATUS_COLORS`/`STATUS_LABELS` duplicados en admin/page.tsx (8 estados) — mismo mapa que order-utils | Migrado a `<StatusBadge kind="order" />` usando mapas de `src/lib/status-config.ts` | v1.0.20-rc25 | (pendiente push) |
| FE-036 | 2026-08-15 | P1 | CODE | `STATUS_COLORS`/`STATUS_LABELS` duplicados en cierre-diario/page.tsx + [id]/page.tsx (4 estados específicos) | Nuevo `CIERRE_DIARIO_STATUS_CONFIG` en status-config.ts + `kind="cierre-diario"` en StatusBadge + helper `getCierreDiarioStatusConfig()` | v1.0.20-rc25 | b21c9b1 |
| FE-037 | 2026-08-15 | P1 | SECURITY | `/api/help` devuelve TODOS los artículos a cualquier usuario autenticado — COCINA ve ayuda de pedidos/cierre que no le corresponde | Nuevo `MODULES_BY_ROLE` en API filtra módulos por rol: COCINA solo ve inventario+sistema, MESERO solo pedidos+sistema, ADMIN ve todos | v1.0.20-rc26 | (pendiente push) |
| FE-038 | 2026-08-15 | P1 | A11Y | Botón volver en `/ayuda` sin aria-label + `size="icon"` (36px) | `aria-label="Volver al panel principal"` + `h-10 w-10 md:h-9 md:w-9` (40px mobile) | v1.0.20-rc26 | (pendiente push) |

---

## Convención de IDs

- `FE-NNN` — Frontend bug identificado en este register
- `BUG-NNN` — Bug de backend o general (en `docs/BUG_REGISTER.md`)
- No reutilizar IDs; si un bug se reabre, marcar como `REOPENED` con fecha

---

## Reglas

1. **No marcar como resuelto** sin commit + test + verificación en CI.
2. **No eliminar** bugs resueltos — son historial.
3. **No esconder** bugs activos bajo `suppressHydrationWarning` o `any`.
4. Cada fix debe referenciar el ID en el commit message.
5. Si un bug se reproduce después de marcado resuelto, reabrir con `REOPENED` y nueva fecha.
