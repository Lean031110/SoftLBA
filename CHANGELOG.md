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
