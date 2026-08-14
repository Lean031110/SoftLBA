# SoftLBA — Test Matrix

**Última actualización:** v1.0.20-rc-final (2026-08-14)
**Owner:** Leandro + Super Z

---

## Resumen ejecutivo

| Métrica | Valor | Meta v1.0.20 |
|---|---|---|
| **Unit tests** | 375 passing (20 archivos) | ≥ 375 ✅ |
| **Integration tests** | 27 passing (3 archivos) | ≥ 27 ✅ |
| **E2E tests (Playwright)** | 0 | PENDIENTE (FASE U) |
| **Concurrencia** | 4 escenarios cubiertos | ✅ |
| **Seguridad** | 6 suites dedicadas | ✅ |
| **TSC errors** | 0 | ✅ |
| **ESLint errors** | 0 | ✅ |
| **Build** | SUCCESS | ✅ |
| **Cobertura de flujos POS críticos** | 0% | 100% (BLOCKER para v1.0.20) |

> **Métrica principal (definida por el usuario):** _"Los flujos reales que importan funcionan"_, no "tenemos N tests".

---

## Matriz por área funcional

| Área | Unit | Integration | E2E | Concurrency | Security | Estado | Notas |
|------|------|-------------|-----|-------------|----------|--------|-------|
| AUTH (login/logout/me) | ✅ 18 | ✅ 5 | ❌ | ❌ | ✅ | PASS | token 5-part, authVersion, rate-limit |
| USERS (CRUD usuarios) | ❌ | ❌ | ❌ | ❌ | ❌ | NOT TESTED | bloqueador v1.0.20 |
| ROLES (asignación/cambio) | ❌ | ❌ | ❌ | ❌ | ❌ | NOT TESTED | bloqueador v1.0.20 |
| PERMISSIONS (RBAC) | ✅ 10 | ❌ | ❌ | ❌ | ❌ | PARTIAL | sin test de rutas protegidas |
| PRODUCTS (CRUD) | ✅ 24 | ❌ | ❌ | ❌ | ❌ | PARTIAL | sin test de baja/activación |
| CATEGORIES | ❌ | ❌ | ❌ | ❌ | ❌ | NOT TESTED | |
| AREAS (multi-área) | ✅ 8 | ✅ 1 | ❌ | ❌ | ❌ | PARTIAL | ProductAreaResolver cubre lógica |
| TABLES (mesas) | ✅ 35 | ✅ 4 | ❌ | ✅ 1 | ❌ | PASS | atomicidad currentOrderId |
| ORDERS (pedidos) | ✅ 50 | ✅ 5 | ❌ | ✅ 1 | ❌ | PARTIAL | falta flujo split + transfer-table |
| ORDER ITEMS | ✅ | ❌ | ❌ | ❌ | ❌ | PARTIAL | sin test de cambio de status |
| KITCHEN (cocina) | ✅ | ✅ 2 | ❌ | ❌ | ✅ | PARTIAL | auth check ok |
| PIZZERIA | ✅ | ✅ 2 | ❌ | ❌ | ✅ | PARTIAL | auth check ok |
| SALON | ❌ | ❌ | ❌ | ❌ | ❌ | NOT TESTED | no existe área separada |
| DIRECT (productos directos) | ✅ | ✅ indirecto | ❌ | ❌ | ❌ | PARTIAL | nacen SERVIDO |
| INVENTORY (inventario) | ✅ 28 | ✅ 5 | ❌ | ✅ 2 | ❌ | PASS | InventoryService cubre |
| RECIPES (recetas) | ✅ | ❌ | ❌ | ❌ | ❌ | PARTIAL | sin test de consumo |
| PAYMENTS (pagos) | ✅ | ✅ 2 | ❌ | ✅ 1 | ❌ | PASS | idempotencia arreglada v1.0.20-rc-final |
| CASH (efectivo) | ❌ | ❌ | ❌ | ❌ | ❌ | NOT TESTED | falta denominaciones |
| FINANCE (finanzas) | ✅ 68 | ❌ | ❌ | ❌ | ❌ | PARTIAL | sin anulación real |
| MULTICURRENCY (CUP/USD) | ✅ | ❌ | ❌ | ❌ | ❌ | PARTIAL | conversión cubierta |
| REALTIME (socket.io) | ✅ 20 | ❌ | ❌ | ❌ | ✅ | PARTIAL | sin test de reconexión |
| NOTIFICATIONS | ❌ | ❌ | ❌ | ❌ | ❌ | NOT TESTED | |
| PWA (service worker) | ✅ | ❌ | ❌ | ❌ | ❌ | PARTIAL | sin test de BG Sync |
| OFFLINE | ❌ | ❌ | ❌ | ❌ | ❌ | NOT TESTED | bloqueador v1.0.20 |
| BACKUP (respaldos) | ✅ | ❌ | ❌ | ❌ | ❌ | PARTIAL | sin test de restore |
| RESTORE (restauración) | ❌ | ❌ | ❌ | ❌ | ❌ | NOT TESTED | bloqueador v1.0.20 |
| ADMIN (panel admin) | ❌ | ❌ | ❌ | ❌ | ❌ | NOT TESTED | |
| AUDIT (auditoría) | ✅ | ❌ | ❌ | ❌ | ❌ | PARTIAL | audit() helper cubierto |
| CIERRE DIARIO | ❌ | ❌ | ❌ | ❌ | ❌ | NOT TESTED | bloqueador v1.0.20 |
| TURNOS (shifts) | ❌ | ❌ | ❌ | ❌ | ❌ | NOT TESTED | |
| EXPORT (datos) | ❌ | ❌ | ❌ | ❌ | ❌ | NOT TESTED | |
| HELP (ayuda) | ❌ | ❌ | ❌ | ❌ | ❌ | NOT TESTED | |

---

## Cobertura de flujos POS críticos

Esta es la **tabla principal** que determina si v1.0.20 puede publicarse.

| # | Flujo | Pasos cubiertos por tests | Estado | Bloqueador |
|---|-------|---------------------------|--------|------------|
| F1 | Login → mesero → nuevo pedido → pagar → cierre | login (✅) + crear pedido (✅) + pagar (✅) + idempotencia (✅) | **PARCIAL** | Falta: impresión, cierre diario |
| F2 | Login → cocina → marcar item listo → servir | cocina auth (✅) + items status (❌) | **PARCIAL** | Falta: status change endpoint test |
| F3 | Login → pizzeria → marcar item listo → servir | pizzeria auth (✅) + items status (❌) | **PARCIAL** | Idem F2 |
| F4 | Login admin → crear usuario → reset password → logout | users CRUD (❌) | **NO CUBIERTO** | Bloqueador |
| F5 | Login admin → inventario → traslado entre áreas | transfer atomic (✅) + db test (✅) | **PASS** | — |
| F6 | Login admin → cierre diario → recalc → close | cierre (❌) | **NO CUBIERTO** | Bloqueador |
| F7 | Login admin → finanzas → asiento → anular | finance unit (✅) + annul unit (✅) | **PASS** | — |
| F8 | Login admin → backup → restore | backup unit (✅) + restore (❌) | **PARCIAL** | Falta restore real |
| F9 | PWA offline → crear pedido → Background Sync → sync online | offline (❌) | **NO CUBIERTO** | Bloqueador |
| F10 | Concurrency: 2 pedidos simultáneos no chocan número | concurrency test (✅) | **PASS** | — |
| F11 | Concurrency: stock=1, 2 consumes simultáneos → 1 éxito | concurrency test (✅) | **PASS** | — |
| F12 | Realtime: server emite order:new, kitchen lo recibe | realtime unit (✅) + e2e (❌) | **PARCIAL** | Falta test de socket.io end-to-end |
| F13 | Auth: token expira → siguiente request → 401 → redirect /login | auth unit (✅) + e2e (❌) | **PARCIAL** | Falta test de expiración real |
| F14 | Multi-área: pedido con producto FINAL → consume receta en COCINA | ProductAreaResolver (✅) + recipe-consumer (✅) | **PASS** | — |
| F15 | Multi-currency: pago en USD contra pedido en CUP → conversión correcta | currency unit (✅) + pay integration (✅) | **PASS** | — |

**Resumen flujos:** 7 PASS / 7 PARCIAL / 4 NO CUBIERTO = 18 flujos críticos.

> **Para publicar v1.0.20:** los 4 NO CUBIERTO deben ser al menos PARCIAL (con test básico del happy path).

---

## Detalle de suites por archivo

### Unit tests (20 archivos, 375 tests)

| Archivo | Tests | Área |
|---|---|---|
| `audit-business-rules.test.ts` | 12 | AUDIT |
| `auth-integration.test.ts` | 8 | AUTH |
| `auth-token.test.ts` | 18 | AUTH / TOKEN |
| `currency.test.ts` | 10 | MULTICURRENCY |
| `finance-complete.test.ts` | 30 | FINANCE |
| `install-backup-audit.test.ts` | 6 | BACKUP / INSTALL |
| `inventory-concurrency.test.ts` | 8 | INVENTORY / CONCURRENCY |
| `inventory-service.test.ts` | 28 | INVENTORY |
| `logger-checksum.test.ts` | 4 | AUDIT / LOGGER |
| `login-rate-limiter.test.ts` | 12 | AUTH / SECURITY |
| `money-service.test.ts` | 15 | MULTICURRENCY |
| `order-state-machine.test.ts` | 22 | ORDERS |
| `permissions.test.ts` | 10 | PERMISSIONS |
| `product-area-resolver.test.ts` | 8 | AREAS / PRODUCTS |
| `realtime-auth.test.ts` | 20 | REALTIME / SECURITY |
| `security-audit.test.ts` | 18 | SECURITY |
| `state-machine-complete.test.ts` | 25 | ORDERS |
| `table-service.test.ts` | 35 | TABLES |
| `tables-payments-concurrency.test.ts` | 25 | TABLES / PAYMENTS / CONCURRENCY |
| `url-validator.test.ts` | 13 | SECURITY |

### Integration tests (3 archivos, 27 tests)

| Archivo | Tests | Área |
|---|---|---|
| `tests/integration/api.test.ts` | 15 | AUTH / PEDIDOS / COCINA / PIZZERIA / CONFIG |
| `tests/integration/concurrency.test.ts` | 2 | CONCURRENCY / IDEMPOTENCIA |
| `tests/integration/db-integration.test.ts` | 10 | INVENTORY / TABLES / CONCURRENCY DB |

### Cómo correr los tests

```bash
# Unit (rápidos, < 5s)
npx vitest run tests/unit/

# Integration (requiere servidor Next.js corriendo en :3099)
bun run test:integration   # script determinista que arranca servidor + corre tests
# o manualmente:
npx next dev -p 3099 &
INTEGRATION_BASE_URL=http://127.0.0.1:3099 npx vitest run tests/integration/

# CI workflow (GitHub Actions)
# .github/workflows/ci.yml → job "integration-tests"
```

---

## Strategia de testing

### Principios

1. **No false-green:** si falta un fixture, el test FALLA (no `return`). Si la respuesta no es 200, se hace assert del código recibido.
2. **Determinismo:** el servidor arranca como proceso SIBLING del test runner (no como child de Vitest). El health check espera `{ok: true}` real, no 404.
3. **Asserts concretos:** se valida `data.ok === true`, `data.item.status === 'CANCELADO'`, etc. No se acepta `[200,400,409]`.
4. **Cleanup estricto:** cada test crea sus fixtures (áreas TEST-*, productos TEST-*) y los borra en `afterAll`.

### Antipatrones prohibidos

- `if (!fixture) return` — debe ser `expect(fixture).toBeTruthy()`.
- `expect([200, 400]).toContain(res.status)` — debe ser un código único esperado.
- `.catch(() => {})` — el error debe propagarse o loguearse explícitamente.
- Tests que dependen del orden de ejecución (compartir estado entre `it`).

---

## Próximos pasos (roadmap)

### Bloqueadores para v1.0.20

1. **E2E (Playwright)** de los flujos F1, F4, F6, F9 (4 flujos NO CUBIERTOS).
2. **Tests de USERS CRUD** (crear, editar, desactivar, reset password).
3. **Tests de CIERRE DIARIO** (recalc, denominations, close).
4. **Tests de RESTORE** (restaurar backup en DB de prueba).

### Mejoras deseables (post v1.0.20)

1. Tests de NOTIFICATIONS (marcar leído, bulk read).
2. Tests de TURNOS (abrir/cerrar shift).
3. Tests de EXPORT (CSV/PDF de pedidos, finanzas).
4. Tests de OFFLINE + BG Sync (con Playwright + Service Worker mock).
5. Tests de REALTIME reconexión (simular disconnect/reconnect).

### Mejora arquitectónica

- Centralizar todas las llamadas `fetch()` en `src/lib/api.ts` (wrapper con: 401→redirect, AbortController, retry con backoff, toast en error). Ver `docs/FRONTEND_AUDIT.md` sección "Top 10 fixes".
