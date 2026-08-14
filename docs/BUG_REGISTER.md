# SoftLBA — Bug Register

**Última actualización:** v1.0.20-rc-final (2026-08-14)
**Owner:** Leandro + Super Z

Leyenda de severidad:
- **P0** — Crítico: bloquea publicación / pérdida de datos / seguridad
- **P1** — Alto: afecta flujo de producción diario
- **P2** — Medio: degradación UX o fragilidad
- **P3** — Bajo: cosmético / código limpio

---

## Bugs activos

| ID | Fecha | Área | Sev | Descripción | Estado |
|----|-------|------|-----|-------------|--------|
| BUG-013 | 2026-08-14 | FRONTEND | P0 | `use-current-user.ts` no redirige a `/login` en 401 → usuario queda con datos stale tras expirar sesión | 🔧 Pendiente |
| BUG-014 | 2026-08-14 | FRONTEND | P0 | `kitchen-dashboard.tsx:144-187` hace `socket.emit` directo con `XTransformPort=3003` hardcoded → código muerto (server rechaza eventos del cliente) pero consume conexiones | 🔧 Pendiente |
| BUG-015 | 2026-08-14 | PWA | P0 | `service-worker-register.tsx` no escucha `SW_UPDATED` → nuevas versiones se aplican silenciosamente mid-order, pueden perder datos | 🔧 Pendiente |
| BUG-016 | 2026-08-14 | REALTIME | P0 | `mini-services/realtime-service/index.ts:391-393` acepta token de `query.token` → token en logs y browser history | 🔧 Pendiente |
| BUG-017 | 2026-08-14 | REALTIME | P0 | `getAllowedOrigins()` auto-incluye todas las IPs locales → si el servidor tiene IP pública, CORS queda abierto | 🔧 Pendiente |
| BUG-018 | 2026-08-14 | META | P0 | 5 strings de versión distintas en la app (`v0.6.0`, `v0.15.0`, `v0.17.0`, `v1.0.19.5`, `softlba-v1.0.19.5`) → operador no puede saber qué versión está corriendo | 🔧 Pendiente |
| BUG-019 | 2026-08-14 | FRONTEND | P1 | 0 archivos `error.tsx` y 0 `loading.tsx` → un error no capturado tira toda la rama `/admin/*` | 🔧 Pendiente |
| BUG-020 | 2026-08-14 | FRONTEND | P1 | 0/48 páginas exportan `metadata` → todas comparten el mismo título en el navegador | 🔧 Pendiente |
| BUG-021 | 2026-08-14 | FRONTEND | P1 | 47/48 páginas usan `fetch()` directo → sin wrapper, sin retry, sin AbortController | 🔧 Pendiente |
| BUG-022 | 2026-08-14 | FRONTEND | P1 | `notification-bell.tsx:184` solicita `Notification.requestPermission()` sin gesto de usuario → bloqueado por Chrome ≥ 84 | 🔧 Pendiente |
| BUG-023 | 2026-08-14 | FRONTEND | P1 | `notification-bell.tsx:119` crea nuevo `AudioContext` por cada `playSound` → leak (browsers cap en ~6) | 🔧 Pendiente |
| BUG-024 | 2026-08-14 | REALTIME | P1 | `use-realtime.ts` abre 1 socket por componente → 2-3 sockets por página | 🔧 Pendiente |
| BUG-025 | 2026-08-14 | REALTIME | P1 | `auth:fail` en socket → desconexión permanente, sin recuperación automática | 🔧 Pendiente |
| BUG-026 | 2026-08-14 | A11Y | P1 | 38 botones de icono sin `aria-label` → lectores de pantalla no los anuncian | 🔧 Pendiente |
| BUG-027 | 2026-08-14 | A11Y | P1 | `kitchen-dashboard.tsx:291` `<CollapsibleTrigger asChild>` envuelve un `<div>` → no focusable por teclado | 🔧 Pendiente |
| BUG-028 | 2026-08-14 | A11Y | P1 | 7 tablas sin `overflow-x-auto` → overflow horizontal en móvil | 🔧 Pendiente |
| BUG-029 | 2026-08-14 | A11Y | P1 | 0 skip-to-content links en toda la app → navegación por teclado muy larga | 🔧 Pendiente |
| BUG-030 | 2026-08-14 | A11Y | P1 | `sw.js` Background Sync sin límite de cola ni TTL → crecimiento indefinido | 🔧 Pendiente |
| BUG-031 | 2026-08-14 | A11Y | P1 | `sw.js:299` `flushQueue` no elimina errores no-reintentables (401/403/422) → se quedan para siempre | 🔧 Pendiente |
| BUG-032 | 2026-08-14 | PWA | P1 | `manifest.json` `display: "fullscreen"` demasiado agresivo para POS; `orientation: "portrait-primary"` mal para tablets landscape | 🔧 Pendiente |
| BUG-033 | 2026-08-14 | PWA | P1 | `manifest.json` screenshots usan `/softlba-logo.png` → no son screenshots reales | 🔧 Pendiente |
| BUG-034 | 2026-08-14 | PWA | P1 | `manifest.json` faltan íconos 16x16, 32x32, 180x180 (apple-touch), 1024x1024 (splash) | 🔧 Pendiente |
| BUG-035 | 2026-08-14 | A11Y | P1 | Botones de cantidad en carrito `h-7 w-7` (28px) → bajo 44px mínimo WCAG 2.5.5 | 🔧 Pendiente |
| BUG-036 | 2026-08-14 | SECURITY | P1 | `middleware.ts` no setea headers `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security` → riesgo clickjacking | 🔧 Pendiente |
| BUG-037 | 2026-08-14 | FRONTEND | P1 | `panel-layout.tsx:211` usa `window.location.pathname` en vez de `usePathname()` → título de página stale tras navegación | 🔧 Pendiente |

### Resumen bugs activos

| Severidad | Cantidad |
|---|---|
| P0 | 6 |
| P1 | 18 |
| P2 | ~38 (ver FRONTEND_AUDIT.md) |
| P3 | ~31 (ver FRONTEND_AUDIT.md) |
| **Total activos** | **93** |

> **Para publicar v1.0.20:** los 6 P0 son bloqueadores. Los P1 son deseables pero no bloqueantes si hay un plan de corrección documentado.

---

## Bugs resueltos

| ID | Fecha | Área | Sev | Descripción | Corrección | Versión |
|----|-------|------|-----|-------------|------------|---------|
| BUG-001 | 2026-08-13 | CI | P0 | Integration tests fallan en GitHub Actions: servidor arranca pero health check no conecta | Servidor movido a STEP separado del workflow + health check estricto (`{ok:true}` real) | v1.0.20-rc9 + rc-final |
| BUG-002 | 2026-08-12 | SW | P0 | Login devuelve `offline-queued` — SW intercepta POST /api/auth/login | SW excluye rutas de auth de Background Sync | v1.0.19.5 |
| BUG-003 | 2026-08-12 | AUTH | P0 | Token mismatch: createSessionToken genera 5-part pero verifySessionToken acepta 4-part | Unificado a 5-part con compatibilidad legacy | v1.0.16 |
| BUG-004 | 2026-08-12 | SECURITY | P0 | /api/public/config expone datos operacionales (usdToCup, offlineWifiName) | Eliminados del endpoint público | v1.0.19.4 |
| BUG-005 | 2026-08-12 | REALTIME | P0 | Realtime acepta eventos de negocio del cliente (order:new, payment:done) | CLIENT_FORBIDDEN_EVENTS rechaza eventos | v1.0.19.2 |
| BUG-006 | 2026-08-12 | REALTIME | P0 | useRealtime intenta leer document.cookie (HttpOnly) | Fetch /api/auth/socket-token server-side | v1.0.19.2 |
| BUG-007 | 2026-08-12 | INVENTORY | P0 | ensureAreaInventory copiaba stock de InventoryItem (duplicación) | Crea con stock=0 | v1.0.16 |
| BUG-008 | 2026-08-12 | FINANCE | P0 | Payment.exchangeRate/convertedAmount/baseCurrency eliminados del schema | Restaurados del rc1 | v1.0.16 |
| BUG-009 | 2026-08-12 | ORDERS | P0 | DESPACHADO eliminado de OrderItemStatus | Restaurado | v1.0.16 |
| BUG-010 | 2026-08-12 | ORDERS | P0 | Order.shiftId eliminado (pérdida de trazabilidad de turnos) | Restaurado | v1.0.16 |
| BUG-011 | 2026-08-13 | HEALTH | P1 | /api/health hace fetch al servicio realtime (falla si no está) | Simplificado a solo DB check | v1.0.20-rc9 |
| BUG-012 | 2026-08-13 | PAY | P2 | Ruta hardcodeada /home/z/my-project en receiptDir | Usa process.cwd() | v1.0.19.5 |
| BUG-038 | 2026-08-14 | PAY | P0 | Idempotent pay retry devuelve 400 "El pedido ya está cobrado" en vez de 200 idempotente | Reordenado: parse body + check idempotencyKey ANTES de check status del pedido | v1.0.20-rc-final |
| BUG-039 | 2026-08-14 | TEST | P1 | Test de cancelación usaba producto DIRECTO (nace SERVIDO) → 400 | Test reescrito para buscar producto FINAL (nace PENDIENTE) | v1.0.20-rc-final |
| BUG-040 | 2026-08-14 | CI | P1 | Script `test:integration` en package.json usaba enfoque viejo ( Vitest globalSetup) | Reemplazado por `tests/integration/run.sh` determinista | v1.0.20-rc-final |

---

## Criterios de aceptación para cerrar v1.0.20

Antes de publicar v1.0.20 final, TODOS los siguientes deben cumplirse:

- [ ] Los 6 P0 activos están resueltos o documentados con workaround aceptado por Leandro
- [ ] E2E tests (Playwright) cubren los flujos F1, F4, F6, F9 de TEST_MATRIX.md
- [ ] CI pasa 5/5 jobs en `main` (quality, unit-tests, realtime-service, integration-tests, build)
- [ ] `npx tsc --noEmit` da 0 errores
- [ ] `bun run lint` da 0 errores
- [ ] `bun run build` SUCCESS
- [ ] Login + crear pedido + pagar verificado manualmente en preview
- [ ] Versión unificada a un único string en toda la app
- [ ] `docs/RELEASE_CHECKLIST.md` firmado
