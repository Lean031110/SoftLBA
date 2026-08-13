# Changelog

Todos los cambios notables de SoftLBA se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-1.1.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

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
