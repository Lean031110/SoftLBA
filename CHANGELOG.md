# Changelog

Todos los cambios notables de SoftLBA se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-1.1.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

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
