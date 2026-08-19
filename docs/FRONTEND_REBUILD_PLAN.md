# FRONTEND REBUILD PLAN — SoftLBA v2

> Documento de seguimiento de la reestructuración del frontend operacional.
> Fuente de verdad: `docs/SOFTLBA_PLAN_REESTRUCTURACION.md`
> Rama: `refactor/frontend-v2` (creada desde `origin/main` HEAD `f25c356`)
> Safety tag: `pre-frontend-rebuild`

---

## Estado inicial (Fase 0)

**Fecha:** 2026-08-19
**Head partida:** `f25c356` (fix(sandbox): preview gateway + CORS + Socket.IO path)
**Rama trabajo:** `refactor/frontend-v2`
**Safety tag:** `pre-frontend-rebuild` (pusheada a GitHub)

### Diagnóstico inicial

| Métrica | Valor |
|---|---|
| `bun run doctor` | ✅ 29 OK · 0 WARN · 0 FAIL |
| `bun run typecheck` | ✅ 0 errores |
| `bun run lint` | ✅ 0 errores |
| `bun run test:unit` | ✅ 511 tests pasan (31 archivos) |
| `bun run build` | ✅ Standalone generado |
| Servicios corriendo | Next :3000 · Realtime :3003 · Print Worker :3004 |

### Bundle de diagnóstico generado
- `download/SoftLBA-diagnostics-2026-08-19-*.tar.gz` (creado por `bun run collect:diagnostics`)

---

## Inventario de rutas frontend (Fase 0)

### Rutas a CONSERVAR (administración + sistema base)

| Ruta | Estado | Acción |
|---|---|---|
| `/` (home pública) | ✅ Funciona | Conservar (puede ajustarse visualmente) |
| `/login` | ✅ Funciona | Conservar |
| `/logout` | ✅ Funciona | Conservar |
| `/offline` | ✅ Funciona | Conservar |
| `/primer-acceso` | ✅ Funciona | Conservar |
| `/perfil` | ✅ Funciona | Conservar |
| `/ayuda` | ✅ Funciona | Conservar |
| `/admin/*` (40+ rutas) | ✅ Funciona | **CONSERVAR INTACTO** (Fase 1) |

### Rutas a REEMPLAZAR (frontend operacional)

| Ruta actual | Nueva ruta (Fase 2) | Acción |
|---|---|---|
| `/mesero/salon` | `/pos` | Reconstruir desde cero (Fase 3) |
| `/mesero/nuevo-pedido` | (eliminar) | Era POS legacy, redirigir a `/pos` |
| `/mesero/pedidos/[id]` | `/pos/orders/[id]` | Reconstruir con detalle claro |
| `/mesero/pedidos/[id]/comprobante` | `/pos/orders/[id]/receipt` | Reconstruir |
| `/mesero` | `/pos` (redirect) | Redirección |
| `/cocina` | `/cocina` (reconstruir) | Reconstruir KDS (Fase 6) |
| `/pizzeria` | `/pizzeria` (reconstruir) | Reconstruir KDS (Fase 6) |
| (nuevo) | `/expo` | Crear en Fase 6 (futuro) |

### Componentes a CONSERVAR

| Componente | Estado | Acción |
|---|---|---|
| `src/components/admin/*` | ✅ | Conservar |
| `src/components/ui/*` (shadcn) | ✅ | Conservar (primitives) |
| `src/components/layout/panel-layout.tsx` | ✅ | Conservar (usado por admin) |
| `src/components/layout/notification-bell.tsx` | ✅ | Conservar (mejorar Fase 12) |
| `src/components/layout/connectivity-banner.tsx` | ✅ | Conservar |
| `src/components/layout/connection-indicator.tsx` | ✅ | Conservar |
| `src/components/realtime/realtime-provider.tsx` | ✅ | Conservar |
| `src/components/service-worker-register.tsx` | ✅ | Conservar |
| `src/components/theme-provider.tsx` | ✅ | Conservar |
| `src/components/loading.tsx` | ✅ | Conservar |

### Componentes a REEMPLAZAR

| Componente actual | Nuevo componente (Fase 2) | Acción |
|---|---|---|
| `src/app/mesero/salon/page.tsx` (784 líneas) | `src/app/pos/page.tsx` | Reconstruir minimalista (Fase 3) |
| `src/app/mesero/nuevo-pedido/page.tsx` (701 líneas) | (eliminar) | Redirigir |
| `src/app/mesero/pedidos/[id]/page.tsx` (661 líneas) | `src/app/pos/orders/[id]/page.tsx` | Reconstruir |
| `src/components/kitchen/kitchen-dashboard.tsx` (458 líneas) | `src/components/production/kds-dashboard.tsx` | Reconstruir KDS (Fase 6) |
| Carrito inline en salon + nuevo-pedido (duplicado) | `src/components/pos/cart-panel.tsx` compartido | Unificar (Fase 3) |

---

## Inventario de APIs utilizadas por cada pantalla

### APIs públicas (sin auth)
- `GET /api/public/config` — configuración del restaurante
- `GET /api/public/news` — noticias activas
- `GET /api/public/products` — catálogo público

### APIs de auth
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/change-password`
- `PATCH /api/auth/profile`
- `GET /api/auth/socket-token`

### APIs usadas por POS de Salón (a reconstruir)
- `GET /api/mesero/areas` — lista de áreas
- `GET /api/mesero/tables` — mesas
- `GET /api/mesero/products` — productos del área
- `POST /api/mesero/orders` — crear pedido (con idempotencyKey)
- `GET /api/mesero/orders` — lista de pedidos
- `GET /api/mesero/orders/[id]` — detalle
- `POST /api/mesero/orders/[id]/items` — añadir item (Fase 10)
- `PATCH /api/mesero/orders/[id]/items/[itemId]` — editar/cancelar item (Fase 10)
- `POST /api/mesero/orders/[id]/pay` — cobrar
- `POST /api/mesero/orders/[id]/cancel` — cancelar
- `POST /api/mesero/orders/[id]/print` — reimprimir (Fase 8)
- `GET /api/mesero/orders/[id]/receipt-download` — recibo (Fase 9)
- `POST /api/mesero/orders/[id]/split` — dividir cuenta
- `POST /api/mesero/orders/[id]/transfer-table` — cambiar mesa
- `GET /api/mesero/tables/[id]` — detalle mesa

### APIs usadas por KDS Cocina (a reconstruir)
- `GET /api/cocina/orders` — pedidos de cocina (filtra por targetAreaId=SALON)
- `PATCH /api/cocina/orders/[id]/status` — cambiar estado del pedido
- `PATCH /api/cocina/orders/[id]/items/[itemId]/status` — cambiar estado de item

### APIs usadas por KDS Pizzería (a reconstruir)
- `GET /api/pizzeria/orders` — pedidos de pizzería (filtra por targetAreaId=PIZZERIA)
- `PATCH /api/pizzeria/orders/[id]/status`
- `PATCH /api/pizzeria/orders/[id]/items/[itemId]/status`

### APIs de notificaciones
- `GET /api/notifications`
- `POST /api/notifications/read`
- `DELETE /api/notifications/[id]`

### APIs administrativas (CONSERVAR, no tocar en Fase 0-15)
- `src/app/api/admin/*` (54+ rutas) — todas se conservan intactas

### APIs internas
- `POST /api/internal/emit` — emite eventos Socket.IO desde el backend

### APIs de salud/diagnóstico
- `GET /api/health`
- `GET /api/help`
- `GET /api/route` (root)

---

## Servicios backend a CONSERVAR (Fase 1)

| Servicio | Archivo | Estado | Acción |
|---|---|---|---|
| Prisma client | `src/lib/db.ts` | ✅ | Conservar |
| Auth | `src/lib/auth/index.ts`, `token.ts` | ✅ | Conservar |
| Permissions v2 | `src/lib/permissions/permissions-v2.ts` | ✅ | Conservar |
| InventoryService | `src/lib/inventory/inventory-service.ts` | ✅ | Conservar |
| TableService | `src/lib/tables/table-service.ts` | ✅ | Conservar |
| MoneyService | `src/lib/money/money-service.ts` | ✅ | Conservar |
| ProductAreaResolver | `src/lib/products/product-area-resolver.ts` | ✅ | Conservar (Fase 4 ya lo integra) |
| PrintService | `src/lib/print/print-service.ts` | ✅ | Conservar (mejorar Fase 8) |
| Realtime emitter | `src/lib/realtime-emitter.ts` | ✅ | Conservar (mejorar Fase 11) |
| OrderStateMachine | `src/lib/order-state-machine.ts` | ✅ | Conservar |
| Idempotency | `src/lib/idempotency.ts` | ✅ | Conservar |
| Logger | `src/lib/logger/index.ts` | ✅ | Conservar |
| Recipe consumer | `src/lib/recipe-consumer.ts` | ✅ | Conservar (Fase 18 amplía) |
| Directo stock | `src/lib/directo-stock.ts` | ✅ | Conservar |
| Audit | `src/lib/audit.ts` | ✅ | Conservar |
| Currency | `src/lib/currency.ts` | ✅ | Conservar |
| Status config | `src/lib/status-config.ts` | ✅ | Conservar |
| Realtime service | `mini-services/realtime-service/index.ts` | ✅ | Conservar (mejorar Fase 11) |
| Print worker | `scripts/print-worker.ts` | ✅ | Conservar (mejorar Fase 8) |
| Doctor | `scripts/doctor.ts` | ✅ | Conservar |
| Diagnose turbopack | `scripts/diagnose-turbopack.mjs` | ✅ | Conservar |
| Collect diagnostics | `scripts/collect-diagnostics.mjs` | ✅ | Conservar |
| Dev all | `scripts/dev-all.mjs` | ✅ | Conservar |

---

## Plan de ejecución fase por fase

### Fase 0 — Preparación y respaldo ✅
- [x] Rama `refactor/frontend-v2` creada
- [x] Safety tag `pre-frontend-rebuild` creado y pusheado
- [x] `bun run doctor` ejecutado (29 OK · 0 WARN · 0 FAIL)
- [x] typecheck + lint + tests ejecutados (511 tests OK)
- [x] Bundle de diagnóstico generado
- [x] Inventario de rutas frontend guardado (este doc)
- [x] Inventario de APIs por pantalla guardado (este doc)
- [x] `docs/FRONTEND_REBUILD_PLAN.md` creado (este doc)
- [x] `docs/SOFTLBA_PLAN_REESTRUCTURACION.md` guardado como fuente de verdad

### Fase 1 — Definir frontera de conservación ✅ (en este doc)
- [x] Lista de conservar (admin + backend + servicios)
- [x] Lista de reemplazar (POS, KDS, components duplicados)

### Fase 2 — Arquitectura de frontend nueva ⏳ PENDIENTE
- [ ] Crear `src/app/pos/`, `src/app/production/`, `src/app/expo/`
- [ ] Crear `src/components/pos/`, `src/components/production/`, `src/components/shared/`
- [ ] Mover components comunes a `src/components/shared/`
- [ ] Mantener `/mesero/salon` con redirect a `/pos` durante la transición
- [ ] No borrar `/mesero/*` hasta que `/pos/*` esté validado

### Fase 3 — POS de Salón desde cero ⏳ PENDIENTE
- [ ] `src/app/pos/page.tsx` minimalista (teléfono + tablet + desktop)
- [ ] `src/components/pos/cart-panel.tsx` compartido (una sola representación)
- [ ] `src/components/pos/product-card.tsx` minimalista
- [ ] `src/components/pos/table-selector.tsx`
- [ ] `src/components/pos/category-bar.tsx`
- [ ] Cliente opcional, comentario opcional, descuento condicional
- [ ] Botón ENVIAR persistente con idempotencyKey + timeout 30s + Reintentar/Cancelar
- [ ] Reutilizar `POST /api/mesero/orders` (ya tiene idempotencyKey)

### Fase 4 — Flujo de pedido real ⏳ PENDIENTE
- [ ] Test E2E: Mesa 7 + Carlos + Agua×2 + Pizza + Hamburguesa + Espaguetis
- [ ] Verificar routing: SALÓN=Agua, PIZZERÍA=Pizza, COCINA=Hambur+Espaguetis
- [ ] Test integration con SQLite real

### Fase 5 — Producto directo ⏳ PENDIENTE
- [ ] DIRECTO no aparece en KDS (ya verificado en Fase anterior)
- [ ] DIRECTO nace SERVIDO (ya implementado)
- [ ] Notificación al mesero "Agua mineral — Mesa 7"
- [ ] Botón "Confirmar servido" en el POS

### Fase 6 — Producción: cocina y pizzería ⏳ PENDIENTE
- [ ] `src/components/production/kds-dashboard.tsx` reutilizable
- [ ] `src/app/cocina/page.tsx` reconstruido
- [ ] `src/app/pizzeria/page.tsx` reconstruido
- [ ] Estados simplificados: EN_PREPARACION / LISTO
- [ ] Tickets grandes, antigüedad, prioridad, notas
- [ ] Recall (Fase 10 del plan original)

### Fase 7 — Modo teléfono para elaboradores ⏳ PENDIENTE
- [ ] `src/components/production/phone-comanda-input.tsx`
- [ ] Si `useMobile()` y no "modo KDS completo" → input "Introduzca comanda"
- [ ] Mostrar solo esa comanda, items de esa estación
- [ ] Acciones EN PREPARACIÓN / LISTO
- [ ] Volver a pantalla input al completar

### Fase 8 — Impresión ⏳ PENDIENTE
- [ ] Verificar que `createPrintJobsForOrder` sea fire-and-forget (ya hecho)
- [ ] Verificar Print Worker procesa cola cada 5s (ya hecho)
- [ ] Verificar tickets por estación (no pedido completo)
- [ ] Mejorar `sendToPrinter` para soportar UTF-8 (acentos/emojis)
- [ ] Implementar `copies` del Printer
- [ ] Implementar `AUTO` mode (fallback KDS→Printer dinámico)
- [ ] `printedByPrinterId` para trazabilidad de fallback

### Fase 9 — Recibo después del pago ⏳ PENDIENTE
- [ ] Si Printer SALÓN activo → PrintJob tipo RECEIPT automático
- [ ] Si no → generar PDF descargable (con `pdf-lib` o similar)
- [ ] Notificación al mesero con link
- [ ] `emitPaymentDone` al `order.userId` (ya hecho)

### Fase 10 — Modificaciones de pedidos ⏳ PENDIENTE
- [ ] Schema: `OrderItem.añadidoTarde Boolean`, `OrderItem.addedAt DateTime`
- [ ] `POST /api/mesero/orders/[id]/items`: marcar ADDED_LATE si pedido en preparación
- [ ] KDS: badge "🔴 AÑADIDO 21:43" + destacar
- [ ] PrintJob: reimprimir solo item añadido como "AÑADIDO"
- [ ] Cambios + ~ - en KDS
- [ ] Recall

### Fase 11 — Realtime ⏳ PENDIENTE
- [ ] Verificar aislamiento (ya hecho en Fase 8 anterior)
- [ ] authVersion kick (ya hecho)
- [ ] Replay de eventos perdidos (pendiente)
- [ ] Deduplicación con clientOperationId (pendiente)

### Fase 12 — Notificaciones ⏳ PENDIENTE
- [ ] Diagnóstico Chrome en campanilla (ya hecho)
- [ ] Punto solo cuando: hay no leídas O acción pendiente O permisos no activos
- [ ] HTTPS local documentado (Caddy con cert confiable)

### Fase 13 — Indicador de conexión ⏳ PENDIENTE
- [ ] `ConnectionIndicator` (ya implementado)
- [ ] Verificar latencia + estado en todos los paneles

### Fase 14 — Desarrollo local ⏳ PENDIENTE
- [ ] `bun run dev:all` (ya implementado)
- [ ] Verificar shutdown correcto

### Fase 15 — Logging y diagnóstico ⏳ PENDIENTE
- [ ] `logs/backend.log`, `realtime.log`, `printer.log`, `frontend.log`, `turbopack.log`, `dev-all.log` (ya implementado)
- [ ] `bun run doctor`, `diagnose:turbopack`, `collect:diagnostics`, `support:bundle` (ya implementados)
- [ ] Verificar que bundle no contiene secretos (ya validado)

### Fase 16 — Tests ⏳ PENDIENTE
- [ ] 20 casos obligatorios del plan
- [ ] Integration con SQLite real
- [ ] E2E con Playwright
- [ ] Pruebas manuales documentadas

### Fase 17 — Backend que falte ⏳ PENDIENTE
- [ ] Identificar gaps cuando la nueva UX lo demande
- [ ] Mejorar APIs existentes si son insuficientes

### Fase 18 — Escandallo y recetas ⏳ PENDIENTE
- [ ] Schema: `RecipeVersion`, `ProductCostHistory`, `ProductionBatch`
- [ ] Servicios: `calculateRecipeCost`, `calculateFoodCost`, `calculateMargin`, `recalculateAffectedRecipes`
- [ ] Subrecetas con explosión recursiva
- [ ] Merma por receta
- [ ] Histórico de costos
- [ ] Versionado v1/v2/v3
- [ ] Food Cost % persistente

### Fase 19 — Escandallo avanzado ⏳ PENDIENTE
- [ ] Modelo conceptual completo
- [ ] Recálculo automático al cambiar precio de ingrediente
- [ ] Histórico no modificable retrospectivamente

### Fase 20 — Backoffice futuro ⏳ PENDIENTE
- [ ] Solo cambios mínimos para soportar: áreas, impresoras, output mode, KDS, routing, recetas, escandallo, costes

---

## Reglas de ejecución

1. **Una fase a la vez**: no empezar Fase N+1 hasta que Fase N tenga typecheck + lint + tests verdes.
2. **Commits atómicos**: un commit por sub-tarea significativa.
3. **No borrar hasta reemplazar**: mantener `/mesero/*` hasta que `/pos/*` esté validado, entonces redirigir.
4. **Sin mocks en producción**: si una funcionalidad requiere mock para pasar tests, documentarla como NO_VERIFICADO.
5. **Documentar contradicciones**: si el código actual contradice el plan, detenerse y registrar la decisión antes de continuar.

---

## Registro de avance

| Fase | Estado | Commit | Fecha | Notas |
|---|---|---|---|---|
| 0 | ✅ Completada | (este commit) | 2026-08-19 | Rama + tag + doctor + inventario |
| 1 | ✅ Completada | (este commit) | 2026-08-19 | Listas conservar/reemplazar definidas |
| 2 | ⏳ Pendiente | — | — | Crear estructura de carpetas nueva |
| 3 | ⏳ Pendiente | — | — | POS desde cero |
| ... | ... | — | — | ... |

---

## Decisiones y contradicciones

(Cualquier contradicción entre el código actual y el plan se documenta aquí antes de continuar.)

### 2026-08-19
- **Decisión**: el `vitest.config.ts` no estaba en el workspace del skill fullstack-dev. Se restauró desde `origin/main`. No es una contradicción con el plan, solo un fix de entorno.
- **Decisión**: el workspace del skill fullstack-dev NO es el repo SoftLBA real — es un boilerplate Next.js. Se configuró el remote de SoftLBA y se creó la rama `refactor/frontend-v2` desde `origin/main`. El código actual del workspace es idéntico a `f25c356`.
