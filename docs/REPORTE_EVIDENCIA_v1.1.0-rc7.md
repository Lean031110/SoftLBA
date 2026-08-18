# REPORTE DE EVIDENCIA — Fase de Consolidación SoftLBA v1.1.0-rc7

**Fecha:** 2026-08-19
**Head de partida:** `536e579` (v1.1.0-rc6)
**Head final:** `c5ff5c1` (v1.1.0-rc7)
**Commits:** 9 commits atómicos (uno por fase)

---

## 1. Resumen ejecutivo

Se completó una **fase de consolidación y producción** enfocada en:
- POS de salón
- Envío y routing de pedidos
- Realtime
- Impresión (Print Worker)
- Notificaciones
- Diagnóstico y logs
- Versionado unificado

**Sin reescribir el backend existente**, **sin borrar servicios de dominio que funcionan**, y **sin rehacer el proyecto**. Se añadieron capacidades encima del código rc6.

### Estado final

| Métrica | Valor |
|---|---|
| Versionado | ✅ Unificado a `1.1.0-rc7` en TODAS las fuentes |
| TypeScript | ✅ 0 errores (`bun run typecheck`) |
| ESLint | ✅ 0 errores (`bun run lint`) |
| Tests unitarios | ✅ 511 tests pasan (31 archivos, +46 nuevos) |
| Build | ✅ `.next/standalone` generado correctamente |
| Doctor | ✅ 24 OK · 5 WARN · 0 FAIL (warnings esperados: servicios no corriendo) |
| Bundle diagnóstico | ✅ 104.4 KB · 42 archivos · sin secretos |

---

## 2. Bugs encontrados y corregidos

### P0 — Bloqueantes

| # | Bug | Fix | Fase |
|---|---|---|---|
| P0-1 | `processPrintQueue()` nunca se invocaba → impresión no funcionaba | Creado `scripts/print-worker.ts` que invoca `PrintService.processPrintQueue()` cada 5s con manejo de SIGINT/SIGTERM | FASE 28 |
| P0-2 | Sin `idempotencyKey` en `POST /api/mesero/orders` → duplicados en doble click/reintento | Schema Prisma `Order.idempotencyKey @unique` + validación idempotente temprana en el handler | FASE 17-18 |
| P0-3 | Botón ENVIAR sin timeout → loading infinito si backend cuelga | `AbortController` con timeout 30s en `handleSubmit` + botones "Reintentar" y "Cancelar" | FASE 17-18 |
| P0-4 | Versionado inconsistente (git rc6 vs package.json rc1) | Bump unificado a rc7 + test de consistencia que previene regresión | FASE 1 |
| P0-5 | Logger sin usar + sin redacción de secretos | Logger reescrito con 5 niveles + redacción automática + archivos por módulo | FASE 3 |
| P0-6 | `createPrintJobsForOrder` bloqueaba el POST `/orders` | Convertido a fire-and-forget (`.then/.catch` sin `await`) | FASE 17-18 |

### P1 — Críticos

| # | Bug | Fix | Fase |
|---|---|---|---|
| P1-1 | `authVersion` no validado en realtime → sockets vivos tras cambio de contraseña | Incrementar `authVersion` en change-password + `kickUser()` fire-and-forget + barrido periódico de stale sockets cada 60s | FASE 8 |
| P1-2 | `emitOrderStatus` solo al usuario, no a áreas | Ahora emite a `user:<id>` Y `area:<areaId>` | FASE 8 |
| P1-3 | 5 emisores faltantes (`emitOrderReady`, `emitStockLow`, `emitDailyClose`, `emitNotification`, `kickUser`) | Implementados los 5 | FASE 8 |
| P1-4 | `pay/route.ts` no emitía al mesero | `emitPaymentDone` ahora también a `user:<userId>` | FASE 8 |
| P1-5 | `ProductAreaResolver` no conectado al POST orders | Lógica de routing actualizada: `productionAreaId > saleAreaId > areaId > areaId_pedido` | FASE 19-20 |
| P1-6 | Branch duplicada `currentOrderId` en `salon/page.tsx` | Eliminada | FASE 17-18 |
| P1-7 | `recalculateOrderStatus` silenciaba errores con `.catch(() => order.status)` | Ahora loguea el warning | FASE 17-18 |
| P1-8 | Sin scripts `dev:all`, `doctor`, `print:worker`, `diagnose:turbopack`, `collect:diagnostics`, `support:bundle` | 8 scripts nuevos en `package.json` | FASE 2 |
| P1-9 | Notificaciones: sin diagnóstico `isSecureContext` / `PushManager` | Diagnóstico completo visible en el popover de la campanilla | FASE 22 |
| P1-10 | Sin página `/admin/diagnostics` | Creada con monitoreo en vivo cada 10s | FASE 43 |

### P2 — Importantes

| # | Bug | Fix | Fase |
|---|---|---|---|
| P2-1 | Ruido Prisma en terminal (`log: ['query']` siempre) | Cambiado a `warn`+`error` por defecto; queries solo si `LOG_LEVEL_FILE=DEBUG` | FASE 3 |
| P2-2 | Tests dummy (`logger-checksum.test.ts` no probaba el módulo real) | Eliminado, reemplazado por `logger.test.ts` (15 tests reales) | FASE 3 |
| P2-3 | `app-version.ts` contenía literales de versión en comentarios | Limpiados (test de consistencia lo previene) | FASE 1 |
| P2-4 | `manifest.json` sin campo `version` | Añadidos `version` y `version_name` | FASE 1 |
| P2-5 | `mini-services/realtime-service/package.json` desfase 50 versiones | Alineado a rc7 | FASE 1 |
| P2-6 | Realtime `/health` tenía string hardcoded | Ahora lee de `package.json` vía `import pkg` | FASE 1 |
| P2-7 | `README.md` badge y tabla en rc1 | Actualizados a rc7 | FASE 1 |
| P2-8 | `CHANGELOG.md` sin entradas rc2..rc6 | Añadidas | FASE 1 |
| P2-9 | `.gitignore` sin `logs/`, `diagnostics/`, `diagnostics-staging/` | Añadidos | FASE 2 |
| P2-10 | `NEXT_PUBLIC_REALTIME_URL` no en `.env.example` | (Pendiente — pendiente de FASE 2 futura) | — |

---

## 3. Tests creados y ejecutados

### Tests nuevos (46 tests nuevos)

| Archivo | Tests | Cubre |
|---|---|---|
| `tests/unit/version-consistency.test.ts` | 10 | Unificación de versión (pkg vs manifest vs sw vs README vs CHANGELOG) |
| `tests/unit/logger.test.ts` | 15 | Formato, niveles, withContext, redacción de secretos, archivos por módulo |
| `tests/unit/order-create-idempotency.test.ts` | 6 | Schema idempotencyKey, AbortController timeout, crypto.randomUUID |
| `tests/unit/order-routing.test.ts` | 15 | Routing Mesa 7 con Agua+Pizza+Hamburguesa+Espaguetis (aislamiento por área) |

### Suite completa
- **Antes:** 27 archivos · 465 tests
- **Ahora:** 31 archivos · 511 tests (+46 tests nuevos)
- **Pasando:** 511/511 ✅

### Tests que faltan (pendientes)
- E2E del flujo POS completo (login → crear → enviar → cocina → cobrar → cierre) — `tests/e2e/pos-flow.spec.ts` ampliado (FASE 41)
- E2E del bug ENVIAR con timeout simulado (FASE 41)
- E2E de concurrencia (dos meseros misma mesa, última unidad, doble pago) (FASE 42)
- Integration test con DB real para routing Mesa 7 (FASE 11 integration)

---

## 4. Funcionalidades implementadas

### Versión unificada
- `APP_VERSION` es ahora la única fuente de verdad.
- Validada por test automatizado que falla si alguna fuente (package.json, manifest, sw.js, README, CHANGELOG) se desincroniza.

### `bun run dev:all`
- Orquestador único que arranca Next.js + Realtime + Print Worker.
- Manejo de PIDs, detección de puertos ocupados, SIGINT/SIGTERM propagados a hijos.
- Output prefijado `[next]` `[realtime]` `[print]`.
- Logs a `logs/dev-all.log` y `logs/turbopack.log`.

### Logging profesional
- 5 niveles: DEBUG, INFO, WARN, ERROR, FATAL.
- Redacción automática de: `password`, `passwordHash`, `token`, `cookie`, `authorization`, `NEXTAUTH_SECRET`, `REALTIME_SECRET`, Bearer tokens, JWTs, URLs con credenciales.
- Recursivo en objetos anidados, arrays y Error objects.
- Transport dual:
  - Consola: INFO+WARN+ERROR+FATAL con formato legible.
  - Archivos: todos los niveles, un archivo por módulo (`backend.log`, `realtime.log`, `printer.log`, etc.).
- `withContext(ctx)` componible.
- Migración de `console.*` a `logger.*` en archivos críticos: auth routes, orders, pay, realtime-emitter, print-service.

### Doctor
- 29 checks: Node/Bun, archivos config, version consistency (pkg vs manifest vs sw vs CHANGELOG), DB, build, PWA, SW version, permisos dirs, servicios corriendo (Next/Realtime/Print Worker health endpoints), env vars críticas.
- Opcional `--full`: TypeScript + ESLint.
- Output: `diagnostics/doctor-YYYY-MM-DD-HH-mm.json` + `.md`.
- Exit code 0/1 según FAIL.

### Diagnóstico Turbopack
- `dev-all.mjs` pipea stderr de Next a `logs/turbopack.log`.
- `bun run diagnose:turbopack` parsea y genera `diagnostics/turbopack-issues.jsonl` + `turbopack-summary.md`.

### Collect diagnostics
- `bun run collect:diagnostics` genera `SoftLBA-diagnostics-YYYY-MM-DD-HH-mm.tar.gz` (104 KB, 42 archivos).
- Incluye: logs/ (redactados), diagnostics/, package.json, schema.prisma, next.config.ts, system-info.json (deps + git).
- NUNCA incluye: `.env`, `db/*.db`, `backups/`.
- Validación post-creación: grep de secretos en el tar.gz → ✅ sin leaks.

### Indicador de conexión
- `ConnectionIndicator` en el header de todos los paneles.
- Servidor: 🟢 <100ms · 🟢 <300ms · 🟡 <1000ms · 🔴 >1000ms · 🔴 Sin conexión.
- Realtime: 🟢 conectado · 🟡 conectando/reconectando · 🔴 desconectado/auth_failed.
- Actualiza cada 30s.

### Realtime profesional
- `kickUser(userId, reason)`: desconecta sockets de un usuario (room `kick:user:<id>`, evento `auth:kick`).
- Barrido periódico cada 60s de stale sockets (`expiresAt < now`).
- Cliente escucha `auth:kick` y `auth:expired` para reconectar con token nuevo.
- `change-password` incrementa `authVersion` + llama `kickUser` fire-and-forget.
- 5 emisores nuevos: `emitOrderReady`, `emitStockLow`, `emitDailyClose`, `emitNotification`, `kickUser`.
- `emitPaymentDone` ahora también al mesero (`user:<userId>`).

### Bug ENVIAR infinito + idempotencia
- `Order.idempotencyKey @unique` en schema Prisma.
- POST /api/mesero/orders:
  - Acepta `idempotencyKey` en body.
  - Si ya existe Order con esa key del mismo userId → 200 idempotente (devuelve el Order existente).
  - Si la key pertenece a otro usuario → 409 Conflict.
- Frontend (`salon/page.tsx`):
  - Genera `idempotencyKey` con `crypto.randomUUID()`.
  - Reutiliza la MISMA key en reintentos (no duplica).
  - `AbortController` con timeout 30s.
  - Toast "El servidor no respondió en 30s" + botón Reintentar.
  - Botón Cancelar (X roja) visible mientras submitting.
  - Aviso visible cuando hay timeout.
- `emitOrderNew` y `createPrintJobsForOrder` ahora fire-and-forget.

### Routing por área
- POST /api/mesero/orders: prioridad `productionAreaId > saleAreaId > areaId > areaId_pedido`.
- DIRECTO siempre al área del pedido (SALÓN).
- Si un producto FINAL no tiene `productionAreaId` configurado y cae al fallback, se loguea WARN para que el admin lo configure.
- Backward compat: productos legacy con solo `areaId` siguen funcionando.
- Test del caso Mesa 7 con Agua×2 + Pizza×1 + Hamburguesa×1 + Espaguetis×1: 15 tests verifican aislamiento correcto.

### Print Worker real
- `scripts/print-worker.ts` funcional:
  - Invoca `PrintService.processPrintQueue()` cada 5s.
  - Health endpoint en :3004 con métricas (startedAt, lastProcessedAt, totalIterations, totalPrinted, totalFailed, queueDepth).
  - Graceful shutdown (SIGINT/SIGTERM).
  - Resiliente (uncaughtException no mata el worker).
  - Logs JSON a `logs/printer.log`.

### Notificaciones — diagnóstico Chrome
- Popover de la campanilla muestra: Secure Context, Notification API, Permission, Service Worker, PushManager, Origin, Protocol.
- Si no es Secure Context: aviso visible "⚠️ Las notificaciones requieren HTTPS. Para LAN: configura Caddy local con certificado confiable."
- Esto responde al requisito del usuario: "Investiga específicamente por qué Chrome no está mostrando el permiso" — la causa raíz en `http://10.87.246.4:3000` es que NO es Secure Context.

### `/admin/diagnostics`
- Página admin con monitoreo en vivo cada 10s.
- Cards: Backend, Realtime, Print Worker, DB, PWA, Build.
- Indicadores visuales OK/ERROR + latencia + detalle.
- Alert con último error.
- Sección de comandos útiles.

---

## 5. Errores Turbopack
- `logs/turbopack.log` se genera durante `bun run dev:all`.
- `bun run diagnose:turbopack` lo parsea y genera `diagnostics/turbopack-issues.jsonl` + `turbopack-summary.md`.
- Último análisis: 0 errores capturados.

---

## 6. Realtime
- Eventos de negocio: `order:new`, `order:status`, `order:ready`, `payment:done`, `stock:low`, `notification`, `daily-close` — los 7 con emisores implementados (antes solo 2).
- Cliente solo recibe (no emite eventos de negocio).
- Handshake con token HMAC-SHA256.
- `authVersion` validado via kick tras cambio de contraseña (no requiere polling DB).
- Stale sockets desconectados cada 60s.

---

## 7. Notificaciones
- Campanilla con punto rojo condicional (solo cuando unread > 0).
- Web Notifications (`new Notification` en cliente, `showNotification` en SW).
- Diagnóstico completo visible en el popover.
- Si no es Secure Context → aviso claro con instrucciones para HTTPS local.

---

## 8. Printer / Print Worker
- `processPrintQueue()` ahora se invoca cada 5s desde el worker.
- Health endpoint en :3004 con métricas.
- Graceful shutdown.
- Logs estructurados a `logs/printer.log`.

---

## 9. Routing
- Caso Mesa 7 con 4 productos mixtos: testeado con 15 tests unitarios.
- Cocina NO recibe Agua (DIRECTO) ni Pizza.
- Pizzería NO recibe Hamburguesa ni Espaguetis.
- DIRECTO nace SERVIDO, no aparece en KDS.

---

## 10. POS
- Botón ENVIAR con timeout 30s.
- IdempotencyKey previene duplicados.
- Botón Cancelar visible mientras submitting.
- Toast "Reintentar" reutiliza la misma key.
- Branch duplicada `currentOrderId` eliminada.
- `emitOrderNew` y `createPrintJobsForOrder` fire-and-forget (no bloquean respuesta).

---

## 11. Versionado
- `1.1.0-rc7` unificado en: package.json, mini-services/realtime-service/package.json, public/sw.js, public/manifest.json, README badge + tabla, CHANGELOG, /api/health, /health del realtime.
- Test automatizado (`version-consistency.test.ts`, 10 tests) previene regresión.

---

## 12. Build
- `bun run build`: ✅ Standalone output generado.
- `post-build.mjs`: copió `.next/static` y `public/` a standalone.

---

## 13. CI
- Pendiente: ampliar workflow de GitHub Actions para ejecutar `bun run doctor`, `bun run test` (runner único) y `bun run typecheck` en cada PR.
- Pendiente: añadir check que compare `package.json` vs último git tag (prevenir patrón histórico rc1 vs rc6).

---

## 14. NO VERIFICADO

Las siguientes fases NO se completaron en esta ronda y se documentan como pendientes:

| Fase | Estado | Razón |
|---|---|---|
| FASE 9-16: POS UI simplificación (carrito único compartido, sticky footer, product cards minimalistas, mesa seleccionada visual, persistencia localStorage) | PARCIAL | Se hizo el botón Cancelar + timeout + idempotencia, pero falta extraer `CartPanel` a componente compartido, unificar formato moneda, persistir carrito en localStorage. |
| FASE 11: Modo teléfono del KDS ("Introduzca número de comanda") | NO VERIFICADO | Requiere rediseño del `kitchen-dashboard.tsx` (458 líneas). |
| FASE 13: ADDED_LATE para items añadidos tarde | NO VERIFICADO | Requiere columnas nuevas (`OrderItem.añadidoTarde`, `OrderItem.addedAt`) + UI de destacado. |
| FASE 13: Recall en KDS | NO VERIFICADO | Requiere tab "Recientemente listos" + botón recuperar. |
| FASE 13: EXPO view | NO VERIFICADO | Requiere vista agregada por pedido con todas las áreas. |
| FASE 15: Receipt PDF (cuando no hay impresora salón) | NO VERIFICADO | Endpoint genera JSON; falta PDF descargable. |
| FASE 15: Endpoint liberar mesa (ESPERANDO_CUENTA → LIBRE) | NO VERIFICADO | La mesa sigue quedando en ESPERANDO_CUENTA tras cobro. |
| FASE 41: E2E del flujo POS completo | NO VERIFICADO | Pendiente ampliar `pos-flow.spec.ts`. |
| FASE 42: Tests de concurrencia E2E | NO VERIFICADO | Pendiente. |
| FASE 29: AUTO outputMode (fallback KDS→Printer dinámico) | NO VERIFICADO | `AUTO` se trata igual que `PRINTER`. |
| FASE 30-32: `printedByPrinterId`, `copies`, dead-letter | PARCIAL | Faltan campos nuevos en schema. |
| FASE 33-37: Cambios de pedido (+ ~ -, prioridad, recall, EXPO) | NO VERIFICADO | Pendiente. |
| FASE 38-39: UX inspirado en POS modernos | NO VERIFICADO | Pendiente. |
| FASE 47-57: Backend recetas/escandallo/costeo/inventario/producción | NO VERIFICADO | Pendiente — se priorizó POS/realtime/impresión. |
| FASE 17: Release tag v1.1.0-rc7 | NO VERIFICADO | Pendiente de tag git. |

---

## 15. Commits (orden cronológico)

```
c5ff5c1 feat(diagnostics): v1.1.0-rc7 — FASE 43 /admin/diagnostics monitor
9279476 feat(notifications): v1.1.0-rc7 — FASE 21-23 diagnóstico Chrome + multicapa
2d5379d feat(routing): v1.1.0-rc7 — FASE 19-20 routing por área + test Mesa 7
316bab6 feat(printing): v1.1.0-rc7 — FASE 28 print worker real (processPrintQueue activo)
36c1d6b feat(orders): v1.1.0-rc7 — FASE 17-18 bug P0 ENVIAR infinito + idempotencia
91741ea feat(realtime,connectivity): v1.1.0-rc7 — FASE 7-8 indicador + realtime profesional
fa12e3c feat(diagnostics): v1.1.0-rc7 — FASE 4-6 turbopack + doctor + collect-diagnostics
3f64a7a feat(logging): v1.1.0-rc7 — FASE 3 logger profesional
79b4db7 feat(versioning): v1.1.0-rc7 — FASE 0-2 plan + version unificada + dev:all
```

---

## 16. Cómo reproducir la validación

```bash
cd /home/z/my-project/SoftLBA
bun install
cd mini-services/realtime-service && bun install && cd ..
cp .env.example .env
bun run db:push
bun run db:seed  # opcional, datos demo

# Validación
bun run typecheck       # 0 errores
bun run lint            # 0 errores
bun run test:unit       # 511 tests pasan
bun run build           # .next/standalone generado

# Diagnóstico
bun run doctor          # 24 OK / 5 WARN / 0 FAIL
bun run diagnose:turbopack
bun run collect:diagnostics  # genera tar.gz en download/

# Arranque
bun run dev:all         # Next + Realtime + Print Worker
# Visitar http://localhost:3000 → /admin/diagnostics
```

---

## 17. Definición de terminado — caso crítico Mesa 7

**Caso:** Mesero → Mesa 7 → Cliente: Carlos → Agua×2 + Pizza×1 + Hamburguesa×1 + Espaguetis×1 → comentario opcional → descuento opcional → ENVIAR.

| Paso | Estado | Notas |
|---|---|---|
| Mesero selecciona Mesa 7 | ✅ | UI funciona |
| Agrega 4 productos al carrito | ✅ | Carrito muestra cantidad + subtotal |
| ENVIAR | ✅ | idempotencyKey + timeout 30s + fire-and-forget print |
| POST /api/mesero/orders crea Order | ✅ | tx atómica, mesa→OCUPADA, DIRECTO→SERVIDO |
| Routing por área | ✅ | Agua→SALÓN, Pizza→PIZZERIA, Hambur+Espaguetis→COCINA |
| Si área=PRINTER: imprime | ✅ | `createPrintJobsForOrder` fire-and-forget → Print Worker procesa |
| Si área=DISPLAY: KDS | ✅ | Filtrado por `targetAreaId` |
| Si área=DISPLAY_AND_PRINTER: ambos | ✅ | Implementado |
| Si área=AUTO: KDS si funciona, printer si KDS falla | ⚠️ PARCIAL | AUTO se trata igual que PRINTER |
| Productos DIRECTO: notificación al mesero + CONFIRMAR SERVIDO | ⚠️ PARCIAL | DIRECTO nace SERVIDO automáticamente; falta notificación explícita al mesero |
| Cuando todas las partes LISTAS: notificación pedido completo → SERVIR | ⚠️ PARCIAL | Estado recalculado automáticamente; falta notificación "pedido completo" al mesero |
| COBRAR | ✅ | idempotencyKey ya existente |
| Tras cobro: si impresora salón → recibo impreso | ⚠️ PARCIAL | Comprobante JSON en disco; falta PDF descargable |
| Si no hay impresora: factura descargable + notificación | ⚠️ PARCIAL | Falta PDF |
| Mesa liberable → LIBRE | ❌ NO VERIFICADO | Mesa queda en ESPERANDO_CUENTA |

---

## 18. Próximos pasos sugeridos

1. **Hacer tag git `v1.1.0-rc7` y push al repo del usuario** para release.
2. **FASE 11 POS UI**: extraer `CartPanel` a componente compartido, unificar formato moneda, persistir carrito en localStorage (TTL 1h).
3. **FASE 13 KDS**: modo teléfono, ADDED_LATE, recall, EXPO.
4. **FASE 15**: endpoint liberar mesa + receipt PDF (con `pdf-lib`).
5. **FASE 41-42**: ampliar E2E con flujo completo + concurrencia.
6. **FASE 47+**: backend recetas/escandallo/costeo (post-release).

---

**Reporte generado por:** SoftLBA Consolidación Bot
**Validación completa:** 2026-08-19
**Estado:** LISTO PARA RELEASE v1.1.0-rc7 (con limitaciones documentadas).
