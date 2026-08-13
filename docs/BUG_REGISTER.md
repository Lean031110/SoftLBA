# SoftLBA — Bug Register

**Última actualización:** v1.0.20-rc9

## Bugs activos

| ID | Fecha | Área | Severidad | Descripción | Estado |
|----|-------|------|-----------|------------|--------|
| BUG-001 | 2026-08-13 | CI | P0 | Integration tests fallan en GitHub Actions: servidor arranca pero health check no conecta | 🔧 En investigación |

## Bugs resueltos

| ID | Fecha | Área | Severidad | Descripción | Corrección | Versión |
|----|-------|------|-----------|------------|------------|---------|
| BUG-002 | 2026-08-12 | SW | P0 | Login devuelve `offline-queued` — SW intercepta POST /api/auth/login | SW excluye rutas de auth de Background Sync | v1.0.19.5 |
| BUG-003 | 2026-08-12 | AUTH | P0 | Token mismatch: createSessionToken genera 5-part pero verifySessionToken acepta 4-part | Unificado a 5-part con compatibilidad legacy | v1.0.16 |
| BUG-004 | 2026-08-12 | SECURITY | P0 | /api/public/config expone datos operacionales (usdToCup, offlineWifiName) | Eliminados del endpoint público | v1.0.19.4 |
| BUG-005 | 2026-08-12 | REALTIME | P0 | Realtime acepta eventos de negocio del cliente (order:new, payment:done) | CLIENT_FORBIDDEN_EVENTS rechaza eventos | v1.0.19.2 |
| BUG-006 | 2026-08-12 | REALTIME | P0 | useRealtime intenta leer document.cookie (HttpOnly) | Fetch /api/auth/socket-token server-side | v1.0.19.2 |
| BUG-007 | 2026-08-12 | INVENTORY | P0 | ensureAreaInventory copiaba stock de InventoryItem (duplicación) | Crea con stock=0 | v1.0.16 |
| BUG-008 | 2026-08-12 | FINANCE | P0 | Payment.exchangeRate/convertedAmount/baseCurrency eliminados del schema | Restaurados del rc1 | v1.0.16 |
| BUG-009 | 2026-08-12 | ORDERS | P0 | DESPACHADO eliminado de OrderItemStatus | Restaurado | v1.0.16 |
| BUG-010 | 2026-08-12 | ORDERS | P0 | Order.shiftId eliminado (pérdida de trazabilidad de turnos) | Restaurado | v1.0.16 |
| BUG-011 | 2026-08-12 | HEALTH | P1 | /api/health hace fetch al servicio realtime (falla si no está) | Simplificado a solo DB check | v1.0.20-rc9 |
| BUG-012 | 2026-08-13 | PAY | P2 | Ruta hardcodeada /home/z/my-project en receiptDir | Usa process.cwd() | v1.0.19.5 |
