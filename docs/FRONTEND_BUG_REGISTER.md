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
| (ninguno P0 activo tras FRONTEND-01) | | | | | | | |

---

## Bugs resueltos (historial)

| ID | Fecha | Sev | Módulo | Síntoma | Fix | Versión | Commit |
|----|-------|-----|--------|---------|-----|---------|--------|
| FE-001 | 2026-08-14 | P0 | PWA | Operaciones POST (crear pedido, pagar, transferir) devuelven `202 offline-queued` aunque el servidor esté disponible | SW reescrito: `handleMutationRequest` hace try-network-first; solo encola si la operación está en `OFFLINE_ALLOWED_OPERATIONS` (lista vacía por defecto); si no, devuelve 503 `SERVIDOR_NO_DISPONIBLE` | v1.0.20-rc14 | (pendiente push) |
| FE-002 | 2026-08-14 | P0 | HYDRATION | React reporta `Hydration failed because the server rendered text didn't match the client` | Creado `src/lib/app-version.ts` + `src/lib/use-mounted.ts` (useSyncExternalStore); eliminados 2 `suppressHydrationWarning` parches en `panel-layout.tsx` y `admin/page.tsx`; movido `new Date()` a `useEffect` en `comprobante/page.tsx`; reemplazado `Math.random()` por valor fijo en `ui/sidebar.tsx` | v1.0.20-rc14 | (pendiente push) |
| FE-003 | 2026-08-14 | P0 | PAY | Doble click en "Cobrar" o reintento por timeout crea múltiples `Payment` rows | Creado `src/lib/idempotency.ts` con `IdempotencyManager` + `paymentsFingerprint()`; integrado en `handlePay()` en `mesero/pedidos/[id]/page.tsx` — la key se reutiliza mientras no cambien los pagos y se limpia tras 200 OK | v1.0.20-rc14 | (pendiente push) |
| FE-004 | 2026-08-14 | P0 | CONNECTIVITY | App no distingue "Internet caído pero LAN funciona" de "LAN caída" | Creado `src/hooks/use-connectivity.ts` con 5 estados: `INITIALIZING`, `LOCAL_SERVER_AVAILABLE`, `LOCAL_SERVER_UNREACHABLE`, `RECONNECTING`, `NO_NETWORK`; pollea `/api/health` cada 30s (5s cuando cae); combina con `navigator.onLine` | v1.0.20-rc14 | (pendiente push) |

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
