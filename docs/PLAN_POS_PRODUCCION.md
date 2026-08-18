# PLAN DE PRODUCCIÓN — POS / REALTIME / IMPRESIÓN / RECETAS

> Documento contractual de la fase de consolidación y producción de SoftLBA.
> Creado: 2026-08-19
> Head de partida: `536e579` (`feat(printing): v1.1.0-rc6`)
> Regla: **no reescribir**, **no borrar backend existente**, **no eliminar servicios de dominio que funcionan**.
> Solo auditoría + consolidación + producción.

---

## 0. DIAGNÓSTICO ACTUAL

### 0.1 Versionado — 🔴 CRÍTICO

| Fuente | Valor actual | ¿Correcto? |
|---|---|---|
| Git tag latest | `v1.1.0-rc6` | ✅ verdad operativa |
| HEAD commit | `v1.1.0-rc6` | ✅ |
| `print-service.ts` header | `v1.1.0-rc6` | ✅ |
| `package.json` raíz | `1.1.0-rc1` | ❌ 5 RCs atrás |
| `src/lib/app-version.ts` | derivado de `package.json` | ❌ arrastra rc1 |
| `/api/health` | `1.1.0-rc1` | ❌ |
| `/health` realtime | `'1.1.0-rc1'` hardcoded | ❌ |
| `public/sw.js` `SW_VERSION` | `"softlba-v1.1.0-rc1"` | ❌ |
| `mini-services/realtime-service/package.json` | `1.0.19.2` | ❌❌ ~50 versiones atrás |
| `README.md` badge | `1.1.0--rc1` | ❌ |
| `CHANGELOG.md` última entrada | `[1.1.0-rc1]` | ❌ faltan rc2..rc6 |
| `public/manifest.json` | sin `version` | ❌ |

**Patrón recurrente**: el CHANGELOG ya advertía en rc1 que "package.json estaba estancado en rc14 durante 19 versiones". Se repite el mismo problema con rc1 vs rc2..rc6.

### 0.2 Scripts de desarrollo — 🟡 INCOMPLETO

**Existen (19):** `dev`, `build`, `start`, `lint`, `db:push/generate/migrate/reset/seed`, `backup`, `logo`, `simulate`, `realtime`, `test:unit`, `test:integration`, `test:integration:server`, `test:integration:run`, `test:e2e`, `test:e2e:install`.

**Faltan (8):**
- `dev:all` — orquestador Next.js + realtime + print worker.
- `test` — runner único.
- `typecheck` — `tsc --noEmit` en raíz.
- `doctor` — health check del entorno.
- `diagnose:turbopack` — análisis de errores Turbopack.
- `collect:diagnostics` — bundle sanitizado para IA.
- `support:bundle` — bundle para soporte.
- `print:worker` — proceso worker que invoque `processPrintQueue()`.

### 0.3 POS de Salón — 🔴 BUGS P0/P1

#### Bugs P0 (bloqueantes)
1. **`processPrintQueue()` NUNCA se invoca.** La función está definida en `print-service.ts:340` pero ningún archivo la llama. Los `PrintJob` quedan en `PENDING` eternamente. **La impresión no funciona en producción.**
2. **Sin `idempotencyKey` en `POST /api/mesero/orders`.** El schema Zod no lo acepta. Cualquier reintento/doble-click = pedido duplicado.

#### Bugs P1 (críticos)
3. **Botón ENVIAR sin timeout/AbortController.** Si el backend cuelga (p. ej. `createPrintJobsForOrder` lento), el spinner gira indefinidamente. No hay "Reintentar" ni "Cancelar".
4. **`createPrintJobsForOrder` bloquea el POST `/orders`.** Se ejecuta ANTES de responder al cliente. Si la DB cuelga ahí, todo cuelga.
5. **`recalculateOrderStatus` se ejecuta FUERA de la tx principal** y su `.catch(() => order.status)` silencia errores.
6. **`emitOrderStatus` solo emite al `userId`.** La cocina no recibe WS de cambio de estado de pedido (solo item-level).
7. **Branch muerta `currentOrderId`** en `salon/page.tsx:242-246`. Las dos ramas del `if` hacen lo mismo. No se usa `POST /api/mesero/orders/[id]/items` para añadir a pedido existente.
8. **Mesas no-LIBRE seleccionables en salon.** El backend rechaza, pero UX deficiente.
9. **Mesa → `ESPERANDO_CUENTA` eternamente tras cobro.** No hay endpoint para liberar a `LIBRE`/`LIMPIEZA`.
10. **`POST /api/mesero/orders/[id]/items`** sin idempotencyKey + sin emit realtime + sin crear PrintJob del item añadido.

#### Bugs P2 (importantes)
11. **`ProductAreaResolver` existe pero NO se usa en la creación del pedido.** La lógica está duplicada inline en `orders/route.ts`.
12. **`pay/route.ts`**: comprobante JSON en disco (no PDF). Sin emit al `order.userId` (mesero no sabe que le cobraron).
13. **Dos implementaciones de carrito paralelas** (`CartPanel` en salon, `CartContent` en nuevo-pedido). Inconsistencia de formato de moneda (`toFixed(0)` vs `formatCurrency`).
14. **`sendToPrinter` codifica con `latin1`** — sin acentos ni emojis.
15. **`realtime-emitter`**: solo `emitOrderNew` y `emitPaymentDone` existen. Faltan `emitOrderReady`, `emitOrderStatus` (a áreas), `emitStockLow`, `emitDailyClose`, `emitNotification`.

### 0.4 Realtime — 🟠 ALTO

| Aspecto | Estado |
|---|---|
| Frontend emite eventos de negocio | ❌ No (correcto: solo recibe) |
| Handshake con token | ✅ HMAC-SHA256 con `NEXTAUTH_SECRET` |
| `authVersion` validado contra DB | ❌ No — socket vivo hasta 12h tras cambio de rol/contraseña |
| Rooms por rol/usuario/área/broadcast | ✅ |
| Área derivada del backend | ✅ (en `emitToArea`) |
| Heartbeat | ✅ ping/pong + Socket.IO built-in |
| Limpieza de stale sockets | ⚠️ Solo en disconnect. Sin barrido periódico |
| Replay de eventos perdidos | ❌ No existe |
| Deduplicación (`clientOperationId`) | ❌ Se acepta pero se ignora |
| `NEXT_PUBLIC_REALTIME_URL` en `.env.example` | ❌ Falta |
| `ROLE_TO_AREAS` mapa | ⚠️ Definido pero siempre vacío (código muerto) |
| 5 de 7 eventos nunca se emiten | ⚠️ `order:ready`, `order:status`, `stock:low`, `daily-close`, `notification` |

### 0.5 Impresión — 🔴 CRÍTICO

| Aspecto | Estado |
|---|---|
| Print Worker como proceso separado | ❌ No existe |
| `bun run print:worker` script | ❌ No existe |
| `processPrintQueue()` invocada por alguien | ❌ Nadie |
| Retry/backoff | ⚠️ `attempts` existe, no se usa para delay |
| Fallback a `fallbackPrinterId` | ⚠️ Implementado en `processPrintQueue` pero nunca ejecutado |
| Respeta `outputMode` (PRINTER/DISPLAY/DISPLAY_AND_PRINTER/AUTO) | ⚠️ `AUTO` se trata igual que `PRINTER` |
| Ticket filtrado por área | ✅ En `createPrintJobsForOrder` (ruta A) |
| `printedByPrinterId` (trazabilidad de fallback) | ❌ No existe el campo; se sobrescribe `printerId` |
| Dos rutas paralelas divergentes | ⚠️ Ruta A (cola PrintJob, rota) vs Ruta B (escpos directo con `RestaurantConfig.printerIp/port`) |

### 0.6 Notificaciones — 🟡 MEDIO

| Aspecto | Estado |
|---|---|
| Campanilla con punto | ✅ Solo cuando `unread > 0` |
| Web Notifications (`new Notification`) | ✅ En cliente |
| `ServiceWorkerRegistration.showNotification()` | ✅ En SW, pero sin `pushManager.subscribe()` |
| Diagnóstico `isSecureContext` | ❌ No se verifica |
| Diagnóstico `Notification.permission` | ✅ |
| Diagnóstico `PushManager` | ❌ No existe |
| Pantalla `/notificaciones` | ❌ No existe (solo popover) |
| `playSound()` definido pero sin uso | ⚠️ Código muerto |

### 0.7 KDS — 🟡 MEDIO

| Aspecto | Estado |
|---|---|
| Estados en UI | 3 tabs (Pendientes/En preparación/Listos). State machine define 9 |
| Modo teléfono "introduzca comanda" | ❌ No existe |
| Filtrado por área | ✅ `targetAreaId` SALON vs PIZZERIA |
| `ADDED_LATE` para items añadidos tarde | ❌ No existe |
| Cambios + ~ - en KDS | ❌ Read-only sobre cantidades |
| Recall | ❌ No existe |
| EXPO | ❌ No existe |
| `DESPACHADO` en state machine | ⚠️ Definido pero no expuesto en UI |

### 0.8 Logging — 🔴 CRÍTICO

| Aspecto | Estado |
|---|---|
| Logger estructurado | ⚠️ Existe en `src/lib/logger/index.ts` pero **0 imports en `src/`** |
| Niveles | ⚠️ Solo DEBUG/INFO/WARN/ERROR (falta FATAL) |
| Redacción de secretos | ❌ Inexistente |
| Logs por módulo (archivos) | ❌ Inexistentes |
| Ruido Prisma | ❌ `db.ts` usa `log: ['query']` siempre (incluso en prod) |
| `/admin/diagnostics` | ❌ No existe |
| `logs/`, `diagnostics/`, `turbopack/` dirs | ❌ Ninguno existe |
| Scripts `doctor`, `diagnose:turbopack`, `collect:diagnostics`, `support:bundle` | ❌ Todos ausentes |

### 0.9 Tests — 🟡 MEDIO

- ✅ 522 tests totales (488 unit + 36 integration + 26 e2e).
- ✅ Cobertura amplia de concurrencia (3 niveles) y idempotencia (24 unit + 1 integration + 1 e2e).
- ❌ **No existe test del bug "ENVIAR infinito"** (timeout/idempotencia en creación de pedido).
- ❌ **No existe test del routing multi-área con 4 productos** (Agua+Pizza+Hamburguesa+Espaguetis). El test actual valida por `productName.includes()` (frágil).
- ❌ **No existe E2E del flujo POS completo** (login → crear → enviar → cocina → cobrar → cierre).
- ⚠️ `fullyParallel: false` + `workers: 1` en Playwright (DB SQLite no soporta concurrencia).
- ⚠️ `tests/unit/logger-checksum.test.ts` es "dummy" (no importa el módulo real, prueba `crypto.createHash` directo).

### 0.10 Recetas / Escandallo / Costeo — 🟡 INCOMPLETO

| Capacidad | Estado |
|---|---|
| Receta con ingredientes + yield | ✅ Limitado a 1 receta por producto |
| Subrecetas / BOM multi-nivel | ❌ `ProductSubproduct` desconectado de `Recipe` |
| Merma por receta | ❌ Solo MERMA manual de inventario |
| Histórico de costos | ❌ `Product.cost` se sobreescribe |
| Versionado v1/v2/v3 | ❌ `productId @unique` lo impide |
| `calculateRecipeCost()` | ❌ Inline en handler GET |
| `calculateFoodCost()` / `calculateMargin()` | ❌ Inline en frontend |
| `recalculateAffectedRecipes()` | ❌ Cambios de costo no se propagan |
| Consumo al vender (auto) | ✅ `consumeRecipe()` idempotente + transaccional |
| `ProductionBatch` (lotes) | ❌ Ausente |
| Ideal vs Actual (food cost) | ❌ Solo Teórico vs Físico agregado |
| Food Cost % persistente | ❌ No en schema |
| Costo por porción | ⚠️ BUG: `totalCost` no se divide por `yield` |
| Inventario por área | ✅ `AreaInventory` + `InventoryService` |
| Movimientos de stock (6 tipos) | ✅ |
| Conteo físico + varianza | ✅ (pero no food-cost) |
| Traslados entre áreas | ✅ `InventoryService.transfer()` |
| Idempotencia de consumo | ✅ `reference: recipe-sync:${itemId}` |
| `blockNegativeStock` | ✅ |

---

## 1. PROBLEMAS ENCONTRADOS (PRIORIZADOS)

### P0 — Bloqueantes (impiden producción)

| # | Problema | Fase |
|---|---|---|
| P0-1 | `processPrintQueue()` nunca se llama → impresión no funciona | F8 |
| P0-2 | Sin `idempotencyKey` en `POST /api/mesero/orders` → duplicados | F6 |
| P0-3 | Botón ENVIAR sin timeout → "ENVIAR infinito" | F6 |
| P0-4 | Versionado inconsistente (rc1 vs rc6) | F1 |
| P0-5 | Logger sin usar + sin redacción de secretos | F3 |
| P0-6 | `createPrintJobsForOrder` bloquea el POST `/orders` | F8 |

### P1 — Críticos (rompen UX o auditoría)

| # | Problema | Fase |
|---|---|---|
| P1-1 | Realtime: `authVersion` no validado contra DB | F8 |
| P1-2 | Realtime: sin replay de eventos perdidos | F8 |
| P1-3 | Realtime: 5 emisores faltantes | F8 |
| P1-4 | `recalculateOrderStatus` fuera de tx + silencioso | F6 |
| P1-5 | `emitOrderStatus` solo al usuario, no a áreas | F8 |
| P1-6 | Mesa → `ESPERANDO_CUENTA` eterna tras cobro | F6 |
| P1-7 | `ProductAreaResolver` no conectado al POST orders | F5 |
| P1-8 | Comprobante JSON en disco, no PDF | F8 |
| P1-9 | Carrito duplicado (salon vs nuevo-pedido) | F4 |
| P1-10 | KDS: sin ADDED_LATE, sin recall, sin EXPO, sin modo teléfono | F9 |
| P1-11 | Notificaciones: sin diagnóstico `isSecureContext`/`PushManager` | F7 |
| P1-12 | Sin scripts `dev:all`, `doctor`, `print:worker`, `diagnose:turbopack`, `collect:diagnostics`, `support:bundle` | F2/F5/F8 |

### P2 — Importantes (deuda técnica)

| # | Problema | Fase |
|---|---|---|
| P2-1 | `sendToPrinter` con `latin1` (sin acentos/emojis) | F8 |
| P2-2 | `AUTO` outputMode = `PRINTER` (sin fallback dinámico KDS→Printer) | F8 |
| P2-3 | `printedByPrinterId` no existe; fallback sobrescribe `printerId` | F8 |
| P2-4 | `pay/route.ts` sin emit al `order.userId` (mesero no sabe que cobraron) | F8 |
| P2-5 | Inconsistencia formato moneda (`toFixed(0)` vs `formatCurrency`) | F4 |
| P2-6 | `playSound()` definido pero muerto en `notification-bell.tsx` | F7 |
| P2-7 | `ROLE_TO_AREAS` siempre vacío (código muerto) | F8 |
| P2-8 | `tests/unit/logger-checksum.test.ts` no prueba el módulo real | F3 |
| P2-9 | `db.ts` con `log: ['query']` siempre (ruido en prod) | F3 |
| P2-10 | `DELETE /api/admin/printers/[id]` no verifica PrintJobs pendientes | F8 |
| P2-11 | `processPrintQueue()` no usa `copies` del `Printer` | F8 |
| P2-12 | No hay dead-letter ni límite de reintentos en PrintJob | F8 |
| P2-13 | Recipe `totalCost` no divide por `yield` (food cost incorrecto) | F10 |
| P2-14 | `Caddyfile` no proxya `/socket.io/` al 3003 | F2 |
| P2-15 | `NEXT_PUBLIC_REALTIME_URL` no está en `.env.example` | F2 |

---

## 2. ARQUITECTURA OBJETIVO

### 2.1 Procesos en desarrollo (`bun run dev:all`)

```
┌────────────────────────────────────────────────────────────────┐
│                    dev:all orchestrator                        │
│                  (scripts/dev-all.mjs)                         │
└────┬───────────────────┬───────────────────┬───────────────────┘
     │                   │                   │
     ▼                   ▼                   ▼
┌─────────┐         ┌──────────┐         ┌─────────────┐
│ Next.js │         │ Realtime │         │ Print Worker │
│  :3000  │         │  :3003   │         │  (queue)    │
└────┬────┘         └────┬─────┘         └──────┬──────┘
     │                   │                      │
     │ POST /api/...      │                      │
     │ commit DB          │                      │
     │ → /api/internal/emit ──┐                 │
     │                         ▼                 │
     │                  Socket.IO ◀──────────┐   │
     │                  (clientes escuchan)  │   │
     │                                      │   │
     └──── createPrintJobsForOrder ─────────┴───┤
                                                │
                                  processPrintQueue()
                                  (cada 5s, con lock)
                                                │
                                                ▼
                                          ESC/POS TCP
                                          Printer(s)
```

### 2.2 Flujo de pedido objetivo

```
Mesero → Mesa 7 (LIBRE)
   ↓
   Selecciona productos: Agua×2, Pizza×1, Hamburguesa×1, Espaguetis×1
   ↓
   Carrito (único, sticky):
     - cliente opcional
     - comentario opcional
     - descuento opcional (según permiso)
     - subtotal / descuento / total
   ↓
   ENVIAR (con idempotencyKey + timeout 30s + Reintentar/Cancelar)
   ↓
POST /api/mesero/orders  (acepta idempotencyKey)
   ↓
   TX:
     - crear Order + OrderItems
       - DIRECTO (Agua) → targetAreaId=SALON, status=SERVIDO, decremento stock atómico
       - FINAL (Pizza) → targetAreaId=PIZZERIA, status=PENDIENTE
       - FINAL (Hamburguesa) → targetAreaId=COCINA, status=PENDIENTE
       - FINAL (Espaguetis) → targetAreaId=COCINA, status=PENDIENTE
     - mesa → OCUPADA
     - Order.idempotencyKey (nueva columna)
   COMMIT
   ↓
   Fire-and-forget (NO bloquea respuesta):
     - recalcular estado (dentro de tx)
     - audit
     - emitOrderNew a cada área afectada:
         area:PIZZERIA → order:new (solo Pizza)
         area:COCINA   → order:new (solo Hamburguesa + Espaguetis)
         user:<userId> → order:new (confirmación al mesero)
     - createPrintJobsForOrder (por área, según outputMode):
         PIZZERIA PRINTER → PrintJob PENDING (solo Pizza)
         COCINA   PRINTER → PrintJob PENDING (solo Hambur+Espaguetis)
         SALÓN    (solo DIRECTO) → no PrintJob (espera cobro)
   ↓
   Print Worker (cada 5s):
     - take 10 PENDING
     - mark PRINTING
     - sendToPrinter (5s timeout)
     - si fail → fallbackPrinter si activo → marcar PRINTED con printedByPrinterId
     - si fail total → FAILED + backoff exponencial (1s, 2s, 4s, 8s, 16s) hasta 5 intentos → DEAD
   ↓
   Cocina recibe WS order:new (solo Hambur+Espaguetis)
   Pizzería recibe WS order:new (solo Pizza)
   Mesero recibe WS order:new (confirmación)
   ↓
   KDS Cocina: ticket #1050 (Hamburguesa + Espaguetis)
   KDS Pizzería: ticket #1050 (Pizza)
   ↓
   Cocina: [EN PREPARACIÓN] → [LISTO]
   Pizzería: [EN PREPARACIÓN] → [LISTO]
   ↓
   emitOrderReady a user:<mesero> (por área)
   ↓
   Mesero: marca SERVIDO (o cocina marca SERVIDO si todas las áreas OK → EXPO)
   ↓
   Cobro: POST /api/mesero/orders/[id]/pay (con idempotencyKey ya existente)
     → COBRADO
     → si Printer SALÓN activo → PrintJob de recibo automático
     → si no → generar PDF descargable + notificación al mesero
     → mesa → ESPERANDO_CUENTA → (endpoint liberar) → LIBRE
```

### 2.3 Arquitectura de logging

```
┌─────────────────────────────────────────────────────────────┐
│  Aplicación (Next.js API routes, components, lib/*)         │
│  Realtime service                                           │
│  Print worker                                               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
                ┌─────────────────┐
                │   logger.ts     │
                │  (redactor)    │
                └──────┬──────────┘
                       │
            ┌──────────┴───────────┐
            ▼                      ▼
     ┌─────────────┐        ┌─────────────┐
     │   Terminal   │        │   Archivos  │
     │ (INFO+WARN+ │        │ logs/*.log  │
     │  ERROR+FATAL│        │ (todos los  │
     │  solamente)  │        │  niveles)   │
     └─────────────┘        └──────┬──────┘
                                   │
                            ┌──────┴──────┐
                            │ Diagnóstico │
                            │  scripts    │
                            └─────────────┘
```

- **Terminal**: solo INFO (selectivo), WARN, ERROR, FATAL. Sin ruido Prisma/Next/Turbopack.
- **Archivos**: `logs/backend.log`, `logs/realtime.log`, `logs/printer.log`, `logs/frontend.log`, `logs/prisma.log`, `logs/turbopack.log`, `logs/dev-all.log`.
- **Redacción**: claves `password`, `passwordHash`, `token`, `secret`, `cookie`, `authorization`, `NEXTAUTH_SECRET`, `REALTIME_SECRET` → `[REDACTED]`.

### 2.4 Arquitectura de impresión unificada

- **Una sola ruta de impresión**: todo pasa por `PrintJob` + `processPrintQueue()`.
- **Eliminar** la ruta B (`POST /api/mesero/orders/[id]/print` con `RestaurantConfig.printerIp/port`). Ese endpoint pasa a crear un `PrintJob` de tipo `RECEIPT` y dejar que el worker lo procese.
- **Nuevo campo** `PrintJob.printedByPrinterId` (no sobrescribe `printerId`).
- **Nuevo campo** `PrintJob.jobType`: `PRODUCTION` | `RECEIPT` | `TEST`.
- **Backoff exponencial**: `attempts` → `nextRetryAt = createdAt + min(attempts * 2^attempts, 300)`.
- **Dead-letter**: tras 5 intentos → `status='DEAD'`, requiere `retryPrintJob` manual.

---

## 3. PRIORIDADES

Orden estricto según la consigna del usuario:

1. **PLAN** (este documento) — FASE 0
2. **DIAGNÓSTICO** (auditoría ya hecha arriba) — FASE 0
3. **VERSIONADO** unificado — FASE 1
4. **`dev:all` script** — FASE 2
5. **LOGGING profesional** — FASE 3
6. **TURBOPACK** captura — FASE 4
7. **`doctor`** — FASE 5
8. **`collect:diagnostics`** — FASE 6
9. **INDICADOR de conexión** — FASE 7
10. **REALTIME** profesional — FASE 8
11. **POS** minimalista — FASE 9
12. **BUG ENVIAR infinito** + idempotencia — FASE 10
13. **ROUTING** por área + DIRECTO — FASE 11
14. **NOTIFICACIONES** multicapa — FASE 12
15. **KDS** (2 estados + modo teléfono + ADDED_LATE + recall + EXPO) — FASE 13
16. **PRINT SERVICE** + worker — FASE 14
17. **RECEIPT** de pago — FASE 15
18. **TESTS** reales — FASE 16
19. **RELEASE** — FASE 17
20. **RECETAS/ESCANDALLO/COSTEO/INVENTARIO/PRODUCCIÓN** — FASE 18+

---

## 4. PLAN DE IMPLEMENTACIÓN

### FASE 0 — PLAN + DIAGNÓSTICO ✅ (este documento)

- [x] Auditoría completa (6 áreas).
- [x] Documento `docs/PLAN_POS_PRODUCCION.md` creado.
- [x] Lista de bugs P0/P1/P2.
- [x] Arquitectura objetivo.
- [ ] (después de cada fase) tests + typecheck + lint + build.

### FASE 1 — VERSIONADO UNIFICADO

**Objetivo**: una sola fuente `APP_VERSION`.

**Cambios**:
- Bump `package.json` a `1.1.0-rc7` (siguiente RC post-consolidación).
- Bump `mini-services/realtime-service/package.json` a `1.1.0-rc7`.
- `mini-services/realtime-service/index.ts`: eliminar string hardcoded, leer de `package.json` con `import pkg from './package.json'` (Bun lo soporta).
- `public/sw.js`: derivar `SW_VERSION` del build (inyectado por `scripts/post-build.mjs`).
- `public/manifest.json`: añadir `"version": "1.1.0-rc7"` y `"version_name": "1.1.0-rc7"`.
- `README.md`: actualizar badge y tabla.
- `CHANGELOG.md`: añadir entradas rc2..rc7.
- Test nuevo `tests/unit/version-consistency.test.ts`: compara `pkg.version` contra último git tag y falla si divergen.

**Criterio de terminado**:
- `bun run test:unit` pasa.
- `/api/health` y `/health` del realtime devuelven el mismo valor.
- `manifest.json` contiene `version`.
- `git tag --points-at HEAD` coincide con `pkg.version`.

### FASE 2 — `bun run dev:all`

**Objetivo**: un solo comando levanta Next + Realtime + Print Worker.

**Cambios**:
- Crear `scripts/dev-all.mjs`: spawn 3 procesos (`next dev`, `bun run mini-services/realtime-service/index.ts`, `bun run scripts/print-worker.ts`).
- Manejo de:
  - PIDs (tabla impresa al inicio).
  - Detección de puertos ocupados (3000, 3003).
  - SIGINT/SIGTERM propagados a hijos.
  - Si un hijo muere → log + marcar cuál falló + decidir si matar a los demás.
  - Output prefijado por servicio: `[next]`, `[realtime]`, `[print]`.
- `package.json`:
  - `"dev:all": "node scripts/dev-all.mjs"`
  - `"print:worker": "bun run scripts/print-worker.ts"`
- `.env.example`: añadir `NEXT_PUBLIC_REALTIME_URL=http://localhost:3003`.
- `Caddyfile`: añadir proxy `/socket.io/` → `softlba:3003`.

**Criterio de terminado**:
- `bun run dev:all` arranca los 3 procesos.
- Output muestra PIDs y URLs.
- `Ctrl+C` mata a los 3 limpiamente.
- Si Next cae, los otros 2 también (configurable: `--keep-alive`).

### FASE 3 — LOGGING PROFESIONAL

**Objetivo**: logger estructurado, redactado, con archivos por módulo.

**Cambios**:
- Reescribir `src/lib/logger/index.ts`:
  - 5 niveles: DEBUG, INFO, WARN, ERROR, FATAL.
  - `redact(data)`: itera claves recursivamente, reemplaza valores sensibles.
  - `transport` dual:
    - Console (con prefijo `[LEVEL] [module]`): solo INFO+WARN+ERROR+FATAL.
    - File append (con rotación diaria): todos los niveles.
  - API: `logger.debug/info/warn/error/fatal(msg, data?, module?)`.
- Crear `logs/` dir (gitignored, creado al arranque).
- `src/lib/db.ts`: cambiar `log: ['query']` → `log: ['warn', 'error']` en prod.
- Reemplazar progresivamente `console.*` en archivos críticos:
  - `src/app/api/auth/*` (maneja tokens/contraseñas).
  - `src/app/api/mesero/orders/route.ts`.
  - `src/app/api/mesero/orders/[id]/pay/route.ts`.
  - `src/lib/print/print-service.ts`.
  - `mini-services/realtime-service/index.ts`.
- Test real `tests/unit/logger.test.ts`: importa el módulo, mockea `console.*`, prueba formato, redacción, niveles.
- Test `tests/unit/logger-redaction.test.ts`: pasa payloads con secretos, verifica que no aparezcan en output.

**Criterio de terminado**:
- `grep -r 'console\.' src/app/api/auth/` → 0 resultados sin logger.
- `bun run test:unit -- logger` pasa.
- `logs/backend.log` se crea al arrancar.
- Pasar `{ password: 'x' }` al logger → output contiene `[REDACTED]`.

### FASE 4 — TURBOPACK

**Objetivo**: capturar errores Turbopack/Next/TS/WebSocket.

**Cambios**:
- `scripts/dev-all.mjs` (FASE 2): pipear stderr de Next a `logs/turbopack.log`.
- Crear `scripts/diagnose-turbopack.mjs`: parse `logs/turbopack.log`, extrae errores, escribe `diagnostics/turbopack-issues.jsonl` (1 error por línea) y `diagnostics/turbopack-summary.md`.
- `package.json`: `"diagnose:turbopack": "node scripts/diagnose-turbopack.mjs"`.
- Cada entrada JSONL: `{ timestamp, type, file, line, column, message, stack?, component? }`.

**Criterio de terminado**:
- `bun run dev:all` escribe `logs/turbopack.log`.
- `bun run diagnose:turbopack` genera `diagnostics/turbopack-summary.md`.
- Si hay 0 errores → "✅ 0 errores Turbopack".

### FASE 5 — `bun run doctor`

**Objetivo**: health check exhaustivo del entorno.

**Cambios**:
- Crear `scripts/doctor.ts`:
  - Node/Bun versión.
  - Puertos 3000/3003 libres.
  - `DATABASE_URL` presente.
  - Prisma generado.
  - DB reachable (`SELECT 1`).
  - Migraciones aplicadas.
  - Next.js build OK.
  - Realtime service `/health` reachable.
  - Print worker reachable (via health endpoint nuevo).
  - Variables de entorno críticas presentes (no valor).
  - PWA: `manifest.json` + `sw.js` existen.
  - Service Worker: parse `sw.js`.
  - WebSocket: test conexión al 3003.
  - Permisos: `db/`, `download/`, `backups/`, `logs/` escribibles.
  - TypeScript: `tsc --noEmit` pasa.
  - ESLint: `eslint .` pasa.
  - Git: estado limpio + último commit + tag actual.
  - Versión consistente entre `package.json`, git tag, `sw.js`, `manifest.json`.
- Output: `diagnostics/doctor-YYYY-MM-DD-HH-mm.json` + `.md`.

**Criterio de terminado**:
- `bun run doctor` genera ambos archivos.
- Marca ✅/❌ en cada check.
- Exit code 0 si todos pasan, 1 si alguno falla.

### FASE 6 — `bun run collect:diagnostics`

**Objetivo**: bundle sanitizado para enviar a IA/soporte.

**Cambios**:
- Crear `scripts/collect-diagnostics.mjs`:
  - Empaqueta `diagnostics/`, `logs/`, `tests-results/`, `turbopack/`, health, version info, git status, git commit, system info, browser diagnostics.
  - Excluye: `.env`, `*.secret`, tokens, cookies, contraseñas, DB completa, backups privados.
  - Opción `--include-db-schema`: genera `prisma/schema.prisma` (sin datos).
  - Output: `SoftLBA-diagnostics-YYYY-MM-DD.tar.gz`.
- `package.json`: `"collect:diagnostics": "node scripts/collect-diagnostics.mjs"`.

**Criterio de terminado**:
- `bun run collect:diagnostics` genera el tar.gz.
- `grep -i 'password\|secret\|token\|cookie' SoftLBA-diagnostics-*.tar.gz` → 0 resultados (excepto `[REDACTED]`).

### FASE 7 — INDICADOR DE CONEXIÓN

**Objetivo**: badge HTTP + Realtime en la barra del POS.

**Cambios**:
- Mejorar `src/hooks/use-connectivity.ts`:
  - Latencia medida (ms).
  - Estado: `🟢 <50ms` / `🟡 <300ms` / `🔴 >300ms o sin conexión`.
  - Último check timestamp.
- Crear `src/hooks/use-realtime-health.ts`: ping al 3003 cada 30s, latencia.
- Componente `src/components/layout/connection-indicator.tsx`:
  - Servidor: 🟢 24ms
  - Realtime: 🟢 conectado
- Integrar en `panel-layout.tsx` header.

**Criterio de terminado**:
- El badge se ve en `/mesero/salon`, `/cocina`, `/pizzeria`, `/admin`.
- Latencia actualiza cada 30s.
- Si servidor cae → 🔴 "Sin conexión".
- Si realtime cae → 🔴 "Realtime desconectado".

### FASE 8 — REALTIME PROFESIONAL

**Objetivo**: dispatcher de eventos, areas por DB, authVersion, replay.

**Cambios**:
- `mini-services/realtime-service/index.ts`:
  - Eliminar `ROLE_TO_AREAS` muerto.
  - Añadir validación periódica de `authVersion`: cada 60s, scan `clients`, comparar `authVersion` del socket contra DB (vía endpoint interno nuevo `/api/internal/user-version`). Si divergen → `socket.disconnect()`.
  - Añadir barrido de stale sockets: cada 60s, si `expiresAt < now` → disconnect.
  - Implementar replay: tabla nueva `RealtimeEvent` (retención 1h). En handshake, cliente manda `lastEventId`. Server replay desde ahí.
  - Implementar dedup: `clientOperationId` en `RealtimeEmit` con TTL 5min.
- `src/lib/realtime-emitter.ts`: añadir `emitOrderReady`, `emitOrderStatus` (a áreas), `emitStockLow`, `emitDailyClose`, `emitNotification`.
- `src/app/api/internal/emit/route.ts`: aceptar `clientOperationId`, dedup.
- Nuevo endpoint `POST /api/internal/kick-user`: invalida todos los sockets de un usuario (usado al cambiar contraseña/rol).
- Tests: `tests/unit/realtime-auth.test.ts` ampliado con authVersion.

**Criterio de terminado**:
- Cambiar contraseña → sockets existentes se desconectan en ≤60s.
- Cocina NO recibe eventos de PIZZERIA (test E2E).
- Replay: desconectar 10s, reconectar, recibir eventos perdidos.

### FASE 9 — POS MINIMALISTA

**Objetivo**: UI simple, rápida, touch-friendly.

**Cambios en `src/app/mesero/salon/page.tsx`**:
- Unificar carrito: extraer `src/components/pos/cart-panel.tsx` compartido.
- Eliminar `src/app/mesero/nuevo-pedido/page.tsx` (redirección a `/mesero/salon`).
- Product cards minimalistas: nombre + precio + imagen opcional + estado + botón `+`. Sin banners enormes.
- Mesa seleccionada: borde + icono + indicador distinguible sin color.
- Sticky footer en móvil: carrito siempre visible con cantidad + total + botón ENVIAR.
- Formato moneda unificado vía `formatMoney()` (FASE 10).
- Persistir carrito en localStorage (TTL 1h).
- Persistir `lastOrderId` en localStorage.

**Criterio de terminado**:
- 1 producto en carrito → UI funciona.
- 30 productos en carrito → UI funciona, botón ENVIAR siempre visible.
- Refresh → carrito persiste.
- Mesa seleccionada se distingue de ocupada.

### FASE 10 — BUG ENVIAR INFINITO + IDEMPOTENCIA

**Objetivo**: nunca loading infinito, nunca duplicar.

**Cambios**:
- Schema Prisma: añadir `Order.idempotencyKey String? @unique`.
- `POST /api/mesero/orders`:
  - Aceptar `idempotencyKey` en body.
  - Si ya existe Order con esa key → devolver ese order (200 idempotente).
  - Mover `createPrintJobsForOrder` a fire-and-forget (NO await). Responder al cliente inmediatamente tras commit.
  - `recalculateOrderStatus` DENTRO de la tx.
- `salon/page.tsx`:
  - `handleSubmit`: generar `idempotencyKey` (`crypto.randomUUID()`), enviar en body.
  - `AbortController` con timeout 30s.
  - Si timeout → toast "El servidor no respondió" + botones [Reintentar] [Cancelar].
  - Botón desactivado mientras procesa (ya hecho).
  - Reintentar usa la MISMA `idempotencyKey` (no duplica).
- `POST /api/mesero/orders/[id]/items`: añadir `idempotencyKey`, emit realtime, crear PrintJob.
- Test `tests/unit/order-idempotency.test.ts`: doble POST con misma key → 1 solo order.
- Test E2E `tests/e2e/pos-flow.spec.ts`: ampliar con timeout simulado.

**Criterio de terminado**:
- Doble click en ENVIAR → 1 solo pedido.
- Servidor tarda 60s → cliente ve "Reintentar/Cancelar" a los 30s.
- Reintentar → mismo pedido (no duplica).
- Cancelar → carrito se mantiene, usuario puede editar.

### FASE 11 — ROUTING POR ÁREA + DIRECTO

**Objetivo**: cada área recibe solo lo suyo.

**Cambios**:
- `POST /api/mesero/orders`: usar `ProductAreaResolver` (ya existe) en vez de lógica inline.
- Validar que `product.areaId` esté seteado para productos FINAL (si no → 400 "Producto sin área de producción").
- Productos DIRECTO: ya correctos (targetAreaId=SALON, status=SERVIDO, no PrintJob, no KDS).
- Test `tests/integration/order-routing.test.ts`: crear pedido con Agua×2 + Pizza×1 + Hamburguesa×1 + Espaguetis×1, verificar:
  - `GET /api/cocina/orders` devuelve solo Hambur+Espaguetis.
  - `GET /api/pizzeria/orders` devuelve solo Pizza.
  - Order items DIRECTO nacen SERVIDO.
  - PrintJobs creados solo para PIZZERIA y COCINA (no SALON).

**Criterio de terminado**:
- Test pasa con 4 productos mixtos.
- Cocina nunca recibe Pizza.
- Pizzería nunca recibe Hamburguesa.
- DIRECTO no aparece en KDS.

### FASE 12 — NOTIFICACIONES MULTICAPA

**Objetivo**: interna + realtime + Web Notification + Service Worker.

**Cambios**:
- `src/components/layout/notification-bell.tsx`:
  - Eliminar `playSound()` muerto.
  - Diagnóstico de `isSecureContext`, `Notification.permission`, `PushManager`, `navigator.serviceWorker`.
  - Si no `isSecureContext` → toast "Las notificaciones del navegador requieren HTTPS" + link a docs de Caddy local HTTPS.
  - Usar `ServiceWorkerRegistration.showNotification()` en vez de `new Notification()` en móvil.
  - Punto rojo solo cuando: hay no leídas O hay acción pendiente O permisos no activados.
- Crear `src/app/notificaciones/page.tsx`: listado completo.
- Documentar HTTPS local con Caddy en `docs/HTTPS_LOCAL.md`.

**Criterio de terminado**:
- En HTTP no-localhost → toast informativo.
- En HTTPS → notificaciones funcionan.
- Punto rojo solo cuando hay pendientes.

### FASE 13 — KDS

**Objetivo**: 2 estados (EN_PREPARACION, LISTO) + modo teléfono + ADDED_LATE + recall + EXPO.

**Cambios**:
- `src/components/kitchen/kitchen-dashboard.tsx`:
  - Simplificar a 2 estados principales: `EN_PREPARACION` / `LISTO`.
  - Modo teléfono: si `useMobile()` y no "modo KDS completo" → input "Introduzca número de comanda" → mostrar solo esa.
  - ADDED_LATE: items añadidos a pedido en preparación → badge "🔴 AÑADIDO 21:43" + destacar.
  - Recall: tab "Recientemente listos" (últimos 30 min) con botón "Recuperar".
  - EXPO: tab "Expo" muestra pedidos con todas las áreas LISTO → botón "Listo para servir".
- `OrderItem.añadidoTarde Boolean` (nueva columna) + `OrderItem.addedAt DateTime` (nueva columna).
- `POST /api/mesero/orders/[id]/items`: si el pedido ya tiene items en EN_PREPARACION → marcar nuevos como `añadidoTarde=true`.
- `tests/e2e/kitchen-flow.spec.ts`: ampliar con ADDED_LATE y recall.

**Criterio de terminado**:
- Añadir item a pedido en preparación → KDS lo muestra con badge rojo "AÑADIDO".
- Recall funciona.
- EXPO solo muestra pedidos con todas las áreas listas.

### FASE 14 — PRINT SERVICE + WORKER

**Objetivo**: impresión de producción real.

**Cambios**:
- Schema Prisma:
  - `PrintJob.printedByPrinterId String?` (nueva, no sobrescribe `printerId`).
  - `PrintJob.jobType String @default("PRODUCTION")` (PRODUCTION/RECEIPT/TEST).
  - `PrintJob.deadLetterAt DateTime?`.
  - `PrintJob.nextRetryAt DateTime?`.
- `src/lib/print/print-service.ts`:
  - `sendToPrinter`: usar `utf8` en vez de `latin1` (acentos/emojis).
  - `processPrintQueue`: backoff exponencial. Si `attempts >= 5` → `status='DEAD'`.
  - Respetar `copies` del Printer.
  - `AUTO` mode: si hay sockets vivos en `role:COCINA` (o el rol del área) → no imprimir; si no → crear PrintJob.
- `scripts/print-worker.ts`:
  - `setInterval(() => PrintService.processPrintQueue(), 5000)`.
  - Lock distribuido (con DB row en `SystemLock` o similar) para múltiples instancias.
  - Graceful shutdown.
  - Health endpoint en `/health` del worker (puerto 3004).
- `POST /api/mesero/orders/[id]/print`: cambiar a crear `PrintJob` de tipo `RECEIPT`, no imprimir directo.
- `deploy/linux/softlba-printer.service` (nuevo).
- `docker-compose.yml`: añadir servicio printer.

**Criterio de terminado**:
- `bun run dev:all` arranca print worker.
- Crear pedido con área PRINTER → PrintJob PENDING → 5s después → PRINTED.
- Si impresora cae → fallback → `printedByPrinterId` registra la real.
- Tras 5 fallos → DEAD.
- Tickets con acentos se imprimen correctamente.

### FASE 15 — RECEIPT DE PAGO

**Objetivo**: recibo automático al cobrar.

**Cambios**:
- `POST /api/mesero/orders/[id]/pay`:
  - Si Printer SALÓN activo → crear `PrintJob` tipo `RECEIPT`.
  - Si no → generar PDF del recibo (con `pdf-lib` o similar) → guardar en `download/recibos/order-{id}.pdf` → notificación al mesero con link.
  - Emit `payment:done` al `order.userId` (mesero).
- Mesa → `ESPERANDO_CUENTA`. Nuevo endpoint `POST /api/mesero/tables/[id]/liberar` → `LIBRE`.

**Criterio de terminado**:
- Cobrar con impresora → recibo impreso.
- Cobrar sin impresora → PDF descargable + notificación.
- Mesa liberable desde UI.

### FASE 16 — TESTS REALES

**Objetivo**: cobertura de los flujos críticos.

**Cambios**:
- `tests/integration/order-routing.test.ts` (FASE 11).
- `tests/integration/order-idempotency.test.ts` (FASE 10).
- `tests/e2e/pos-flow.spec.ts` ampliado: login → crear → enviar → cocina → cobrar → cierre.
- `tests/e2e/send-button.spec.ts`: simular timeout del servidor, doble click.
- `tests/e2e/concurrency.spec.ts`: dos meseros misma mesa, última unidad, doble pago.
- `tests/unit/logger-redaction.test.ts` (FASE 3).
- `tests/unit/version-consistency.test.ts` (FASE 1).
- `tests/unit/print-worker.test.ts`: mock de impresora, verificar estados.
- `tests/unit/realtime-authversion.test.ts`: invalidación.

**Criterio de terminado**:
- `bun run test` (nuevo script runner único) pasa.
- Cobertura ≥ 80% en `src/lib/print/`, `src/lib/realtime-emitter.ts`, `src/lib/idempotency.ts`.

### FASE 17 — RELEASE

**Objetivo**: tag + tarball + GitHub release.

**Cambios**:
- `scripts/create-release.sh` ya existe. Mejorarlo para validar consistencia de versión.
- Tag `v1.2.0-rc1` (post-consolidación).
- `CHANGELOG.md` completo.
- `README.md` actualizado con scripts nuevos (`dev:all`, `doctor`, etc.).
- `SECURITY.md` actualizado con política de redacción.

### FASE 18+ — RECETAS / ESCANDALLO / COSTEO / INVENTARIO / PRODUCCIÓN

Solo después de FASE 17. Incluye:

- Schema: `RecipeVersion`, `ProductCostHistory`, `ProductionBatch`, `RecipeCostSnapshot`.
- Servicios: `calculateRecipeCost()`, `calculateFoodCost()`, `calculateMargin()`, `recalculateAffectedRecipes()`.
- Subrecetas con explosión recursiva (guard anti-ciclos).
- Merma por receta (campos `wastePct`).
- Histórico de costos.
- Versionado v1/v2/v3.
- Food Cost % persistente.
- Varianza Ideal vs Actual.
- ProductionBatch (lotes).

---

## 5. TESTS REQUERIDOS

### Unit
- `version-consistency.test.ts` (FASE 1)
- `logger.test.ts` (FASE 3)
- `logger-redaction.test.ts` (FASE 3)
- `order-idempotency.test.ts` (FASE 10)
- `print-worker.test.ts` (FASE 14)
- `realtime-authversion.test.ts` (FASE 8)

### Integration
- `order-routing.test.ts` (FASE 11) — caso Mesa 7 con Agua+Pizza+Hamburguesa+Espaguetis.
- `order-idempotency.test.ts` (FASE 10).
- `print-queue.test.ts` (FASE 14).
- `realtime-replay.test.ts` (FASE 8).

### E2E
- `pos-flow.spec.ts` ampliado (FASE 16).
- `send-button.spec.ts` — timeout, doble click, reintentar (FASE 16).
- `concurrency.spec.ts` — dos meseros misma mesa, última unidad, doble pago (FASE 16).
- `kitchen-flow.spec.ts` ampliado con ADDED_LATE y recall (FASE 13).
- `notifications.spec.ts` — diagnóstico Chrome, HTTPS (FASE 12).

---

## 6. CRITERIOS DE TERMINADO

### Por fase (gate obligatorio)
1. Tests nuevos pasan.
2. `bun run typecheck` pasa.
3. `bun run lint` pasa.
4. `bun run build` pasa (cuando aplique).
5. Entrada en `worklog.md` con qué se hizo.
6. Commit separado por fase.
7. Si una fase crítica queda rota → NO continuar.

### Global (FASE FINAL)
- `bun run dev:all` arranca los 3 servicios.
- Flujo Mesa 7 → Agua×2 + Pizza×1 + Hamburguesa×1 + Espaguetis×1 → ENVIAR → rutea correctamente a 3 áreas → imprime → cocina → cobra → recibe.
- Sin loading infinito.
- Sin pedidos duplicados.
- Notificaciones funcionan en HTTPS.
- `bun run doctor` → todo ✅.
- Reporte de evidencia con bugs encontrados/corregidos, tests creados/ejecutados, errores Turbopack, logs, realtime, notifications, printer, routing, POS, versionado, build.

---

## 7. RIESGOS

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Migración de schema rompe DB existente | Media | Alto | `prisma migrate dev` + backup automático antes |
| Cambios en `orders/route.ts` rompen tests existentes | Alta | Medio | Mantener API pública + tests antes de refactor |
| Print worker consume muchos recursos | Baja | Medio | Limitar concurrencia + sleep 5s entre ciclos |
| authVersion validation añade latencia | Media | Bajo | Poll cada 60s, no por evento |
| `dev:all` complejo de mantener | Media | Bajo | Usar `concurrently`-like simple, sin dependencias externas |
| Eliminar `nuevo-pedido/page.tsx` rompe bookmarks | Baja | Bajo | Redirect 308 a `/mesero/salon` |
| Cambios en logger rompen código que usa `console.*` | Baja | Bajo | Migración gradual, `console.*` sigue funcionando |
| Realtime replay añade complejidad | Media | Medio | Retención corta (1h), solo para clientes autenticados |
| ProductionBatch (FASE 18+) retrasa release | Alta | Bajo | Solo iniciar tras FASE 17 cerrada |

---

## 8. FUNCIONALIDADES PENDIENTES (post-release)

- Modo offline real con cola (hoy `OFFLINE_ALLOWED_OPERATIONS = []`).
- Push notifications VAPID (hoy sin subscription).
- Multi-tenant.
- Reporting avanzado (BI).
- Integración con balanza.
- Multi-almacén.
- Recetas con variante por estación.
- Menu engineering (matriz de profitability).
- Forecasting de inventario.
- App móvil nativa (TWA o React Native).

---

## 9. CONVENCIÓN DE COMMITS

Cada fase = 1 commit (o varios si la fase es grande).

Formato:
```
feat(<scope>): <fase> <descripción corta>

- Detalle 1
- Detalle 2

Refs: docs/PLAN_POS_PRODUCCION.md#fase-N
```

Scopes: `versioning`, `scripts`, `logging`, `diagnostics`, `realtime`, `pos`, `printing`, `kds`, `notifications`, `tests`, `recipes`.

---

## 10. ESTADO DE EJECUCIÓN

| Fase | Estado | Commit |
|---|---|---|
| FASE 0 — Plan | ✅ Completado | — |
| FASE 1 — Versionado | ⏳ Pendiente | — |
| FASE 2 — dev:all | ⏳ Pendiente | — |
| FASE 3 — Logging | ⏳ Pendiente | — |
| FASE 4 — Turbopack | ⏳ Pendiente | — |
| FASE 5 — Doctor | ⏳ Pendiente | — |
| FASE 6 — Collect diagnostics | ⏳ Pendiente | — |
| FASE 7 — Indicador conexión | ⏳ Pendiente | — |
| FASE 8 — Realtime | ⏳ Pendiente | — |
| FASE 9 — POS | ⏳ Pendiente | — |
| FASE 10 — Enviar + idempotencia | ⏳ Pendiente | — |
| FASE 11 — Routing + DIRECTO | ⏳ Pendiente | — |
| FASE 12 — Notificaciones | ⏳ Pendiente | — |
| FASE 13 — KDS | ⏳ Pendiente | — |
| FASE 14 — Print worker | ⏳ Pendiente | — |
| FASE 15 — Receipt | ⏳ Pendiente | — |
| FASE 16 — Tests | ⏳ Pendiente | — |
| FASE 17 — Release | ⏳ Pendiente | — |
| FASE 18+ — Recetas | ⏳ Pendiente | — |

---

**Documento vivo.** Se actualiza tras cada fase con el commit correspondiente.
