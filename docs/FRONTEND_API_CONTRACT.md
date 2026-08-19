# SoftLBA — Frontend API Contract

**Última actualización:** 2026-08-14
**Versión base:** v1.0.20-rc13 + FRONTEND-01
**Fuente de verdad:** código en `src/app/api/**`

> Documenta cada endpoint que el frontend consume. Cuando el frontend necesite
> una API que no exista, primero se documenta aquí, luego se implementa con test.

---

## Convención de respuesta

Todas las respuestas JSON siguen el formato:

```json
{
  "ok": true | false,
  "data"?: "...",
  "error"?: "MESSAGE_CODE",
  "items"?: [],
  "item"?: {}
}
```

**Códigos HTTP permitidos por contrato** (no se aceptan arbitrarios):

| Código | Significado | Cuándo |
|--------|-------------|--------|
| 200 | OK | Operación exitosa |
| 201 | Created | Recurso creado (raro; normalmente usamos 200 con `ok:true`) |
| 202 | Accepted | **SOLO** para operaciones offline-queued diseñadas explícitamente |
| 400 | Bad Request | Validación falló (sin modificar estado) |
| 401 | Unauthorized | Sesión inválida o expirada |
| 403 | Forbidden | Sesión válida pero sin permiso |
| 404 | Not Found | Recurso no existe |
| 409 | Conflict | Recurso en estado conflictivo (ej: idempotencyKey usado para otro pedido) |
| 429 | Too Many Requests | Rate limit |
| 500 | Internal Server Error | Bug del servidor |
| 503 | Service Unavailable | **SOLO** para "Servidor local no disponible" (no para offline-queued) |

**Prohibido:** aceptar `[200, 400, 409]` como "ok" en tests.

---

## Endpoints de FRONTEND-01

### GET /api/health

**Auth:** NO requerida (pública).
**Permission:** ninguno.
**Purpose:** El frontend lo usa para detectar si el servidor local está disponible (independientemente de `navigator.onLine`).
**Request:** sin body.
**Response 200:**
```json
{
  "ok": true,
  "status": "healthy",
  "checks": {
    "database": { "status": "ok" }
  }
}
```
**Response 503:**
```json
{
  "ok": false,
  "status": "unhealthy",
  "checks": {
    "database": { "status": "error", "error": "..." }
  }
}
```
**Errors:** 500 si hay error interno.
**Idempotency:** Sí (GET).
**Realtime side effects:** Ninguno.
**Frontend consumers:**
- `src/hooks/use-connectivity.ts` (FRONTEND-01) — poll cada N segundos para distinguir LAN de Internet.

---

### POST /api/auth/login

**Auth:** NO requerida (es el login).
**Permission:** ninguno.
**Request:**
```json
{ "username": "string", "password": "string" }
```
**Response 200:**
```json
{
  "ok": true,
  "user": {
    "id": "...",
    "username": "...",
    "role": "ADMIN|MESERO|MESERO_PRO|COCINA|PIZZERIA|CAJERO",
    "firstName": "...",
    "lastName": "...",
    "mustChangePass": false
  }
}
```
Set-Cookie: `rc_session=...; HttpOnly; SameSite=Strict`
**Response 401:** `{ "ok": false, "error": "CREDENCIALES_INVALIDAS" }`
**Response 429:** `{ "ok": false, "error": "DEMASIADOS_INTENTOS", "retryAfter": 60 }` con header `Retry-After: 60`
**Idempotency:** NO (no usa idempotencyKey).
**Realtime side effects:** Ninguno.
**SW behavior:** NO debe ser interceptado por Background Sync (`public/sw.js:174-181`).

---

### POST /api/mesero/orders/[id]/pay

**Auth:** Sí.
**Permission:** ADMIN, CAJERO, MESERO (con ownership del pedido).
**Purpose:** Registra uno o más pagos contra un pedido. Soporta idempotencia.
**Request:**
```json
{
  "payments": [
    {
      "method": "EFECTIVO_CUP|EFECTIVO_USD|TRANSFERENCIA_CUP|TRANSFERENCIA_USD|ZELLE|BANCARIA_USD|COMBINADO",
      "amount": 0.01,
      "currency": "CUP|USD",
      "reference": "string?",
      "notes": "string?"
    }
  ],
  "idempotencyKey": "string (min 8, max 120, optional)"
}
```
**Response 200 (primer pago):**
```json
{
  "ok": true,
  "fullyPaid": true,
  "order": { "id": "...", "status": "COBRADO", "paymentStatus": "PAGADO" }
}
```
**Response 200 (reintento idempotente con mismo idempotencyKey):**
```json
{
  "ok": true,
  "idempotent": true,
  "message": "Pago ya procesado anteriormente con este idempotencyKey",
  "orderId": "..."
}
```
**Response 400:** Pedido cancelado / ya cobrado / items pendientes / monto excede total.
**Response 401:** Sin sesión.
**Response 403:** Sin permiso o no es dueño del pedido.
**Response 404:** Pedido no existe.
**Response 409:** `idempotencyKey` ya usado para OTRO pedido.
**Idempotency:** SÍ — si llega `idempotencyKey` y ya existe Payment con esa key para el MISMO pedido, se devuelve 200 idempotente sin crear nuevo Payment.
**Realtime side effects:** Si el pago se completa, el servidor emite `payment:done` vía realtime-service (`emitPaymentDone` en `src/lib/realtime-emitter.ts`).
**Frontend consumers:**
- `src/app/mesero/pedidos/[id]/page.tsx` (FRONTEND-01) — `handlePay()` debe generar `idempotencyKey` y reutilizarlo en reintentos automáticos.

---

### GET /api/auth/me

**Auth:** Sí (cookie HttpOnly).
**Permission:** cualquier rol autenticado.
**Response 200:**
```json
{
  "ok": true,
  "user": { ... } | null
}
```
Si no hay sesión válida, devuelve `{ "ok": true, "user": null }` (no 401 — es un check "suave").
**Idempotency:** Sí (GET).
**Frontend consumers:** `useCurrentUser()` hook, `PanelLayout`.

---

### GET /api/auth/socket-token

**Auth:** Sí.
**Permission:** cualquier rol autenticado.
**Purpose:** Devuelve un token efímero para autenticar el handshake de Socket.IO
(el frontend no puede leer la cookie HttpOnly).
**Response 200:**
```json
{
  "ok": true,
  "token": "5-part-token",
  "expiresAt": 1234567890000
}
```
**Response 401:** Sin sesión.
**Idempotency:** Sí (GET).
**Frontend consumers:** `useRealtime()` hook → `fetchSocketToken()`.

---

## Endpoints pendientes de documentar

Los siguientes endpoints existen pero no se han documentado formalmente todavía.
Se documentarán en sus fases correspondientes (FRONTEND-02..18):

- `POST /api/mesero/orders` (crear pedido)
- `POST /api/mesero/orders/[id]/cancel` (cancelar)
- `POST /api/mesero/orders/[id]/items` (agregar items)
- `POST /api/mesero/orders/[id]/split` (dividir)
- `POST /api/mesero/orders/[id]/transfer-table` (cambiar mesa)
- `GET /api/mesero/areas`
- `GET /api/mesero/products`
- `GET /api/mesero/tables`
- `GET /api/cocina/orders`
- `PATCH /api/cocina/orders/[id]/items/[itemId]/status`
- `GET /api/pizzeria/orders`
- `GET /api/admin/dashboard`
- `GET /api/admin/usuarios`
- `POST /api/admin/usuarios`
- `GET /api/admin/finanzas/...`
- `POST /api/admin/cierre-diario/[id]/close`
- `GET /api/public/config`
- `GET /api/public/products`
- `GET /api/notifications`

---

## Reglas para agregar/modificar endpoints

1. Documentar PRIMERO en este archivo (path, method, auth, permission, request, response, errors, idempotency, realtime side effects).
2. Modificar el backend de forma mínima (sin romper contrato existente).
3. Agregar tests en `tests/unit/` y/o `tests/integration/`.
4. Actualizar `docs/FRONTEND_BUG_REGISTER.md` si la API nueva corrige un bug.
5. Hacer commit con referencia al FE-NNN que resuelve.
6. Solo entonces integrar el frontend.
