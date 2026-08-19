# SoftLBA — Production Audit

**Versión auditada:** v1.0.20-rc2
**Fecha:** 2026-08-13
**Repositorio:** https://github.com/Lean031110/SoftLBA

---

## CI

**Estado:** WARNING

- Quality job: PASS (typecheck + lint)
- Unit tests job: PASS (375 tests)
- Realtime service job: PASS (typecheck independiente)
- Integration tests job: WARNING (requiere servidor arrancado, puede tardar >5min en CI)
- Build job: PASS (depende de todos los anteriores)

## TypeScript

**Estado:** PASS

- `npx tsc --noEmit` → 0 errores
- Realtime service `npx tsc --noEmit` → 0 errores

## Lint

**Estado:** PASS

- `bun run lint` → 0 errores, 0 warnings

## Unit tests

**Estado:** PASS

- 375 tests pasando
- 0 failed
- 0 skipped

### Clasificación

| Categoría | Archivos | Tests |
|-----------|----------|-------|
| AUTH | auth-integration, auth-token | 18 |
| ORDERS | order-state-machine, state-machine-complete | 50 |
| INVENTORY | inventory-service, inventory-concurrency | 28 |
| TABLES | table-service, tables-payments-concurrency | 35 |
| FINANCE | money-service, finance-complete, currency | 68 |
| REALTIME | realtime-auth | 20 |
| SECURITY | url-validator, login-rate-limiter, security-audit | 51 |
| PRODUCTS | product-area-resolver | 24 |
| PERMISSIONS | permissions | 10 |
| INSTALL/BACKUP | install-backup-audit | 22 |
| AUDIT | audit-business-rules, logger-checksum | 49 |

## Integration tests

**Estado:** WARNING

- Tests de integración requieren servidor Next.js arrancado
- `setupServer()` arranca servidor en puerto 3099
- stderr del servidor ahora visible para diagnóstico
- Asserts concretos (no `return` para salir)
- Pueden tardar >5min en CI runner

## Concurrency tests

**Estado:** PASS (con DB de test)

- Dos pedidos simultáneos con números diferentes
- Pago con idempotencyKey
- Inventario: última unidad con SQLite real

## Realtime

**Estado:** PASS

- Token 5-part con authVersion
- Eventos de negocio del cliente RECHAZADOS
- Endpoint /emit con shared secret
- CORS configurable
- Typecheck independiente: 0 errores

### Riesgo

- **authVersion vs DB**: El realtime no consulta la DB directamente. Acepta cualquier authVersion del token. Si se invalida una sesión (bumpAuthVersion), el token viejo sigue siendo válido en el realtime hasta que expire (12h máximo).

## Authentication

**Estado:** PASS

- Token HMAC SHA-256 con 5 partes (userId.role.expiresAt.authVersion.signature)
- Compatibilidad con tokens legacy de 4 partes
- authVersion verificado en getCurrentUser()
- bumpAuthVersion() para invalidar sesiones
- Rate limiting por IP + dispositivo en login

## Authorization

**Estado:** PASS

- Ownership de pedidos verificado (order.userId !== user.id)
- Endpoints de cocina/pizzería validan targetAreaId
- Endpoints administrativos requieren rol ADMIN
- Endpoint interno requiere localhost + shared secret

## Inventory

**Estado:** PASS

- InventoryService como fuente única
- consume(), returnStock(), transfer() atómicos
- blockNegativeStock default true
- directo-stock.ts como wrapper de InventoryService

## Orders

**Estado:** PASS

- DESPACHADO en OrderItemStatus
- DIRECTO nace como SERVIDO
- recalculateOrderStatus() deriva estado del pedido
- shiftId para trazabilidad de turnos

## Tables

**Estado:** PASS

- TableService con takeTable, releaseTable, transferTable atómicos
- currentOrderId @unique para ownership
- updateMany condicional (WHERE status='LIBRE')

## Payments

**Estado:** PASS

- idempotencyKey @unique en Payment
- exchangeRate, convertedAmount, baseCurrency (snapshot histórico)
- Conversión CUP/USD con tasa snapshot

## Finance

**Estado:** PASS

- FinanceEntry con exchangeRate, convertedAmount, baseCurrency
- Anulación financiera con compensación
- Cierre diario con denominaciones

## Multicurrency

**Estado:** PASS

- MoneyService con redondeo bancario (roundHalfToEven)
- No se suman monedas diferentes sin conversión
- Snapshot histórico no se recalcula con tasa actual

## PWA

**Estado:** PASS

- manifest.json existe
- Service worker con cache strategies
- Background Sync para POST (rutas de auth excluidas)
- Offline page existe
- No CDNs externos

## LAN

**Estado:** PASS

- next.config output standalone
- Caddyfile para proxy
- No dependencias externas obligatorias
- Funciona sin Internet

## Database

**Estado:** WARNING

- SQLite con Prisma
- `prisma db push --accept-data-loss` usado en desarrollo (NO en producción)
- Migraciones controladas pendientes para producción

## Migrations

**Estado:** WARNING

- No hay migraciones formales (solo db push)
- Para producción: usar `prisma migrate dev` y `prisma migrate deploy`

## Backup

**Estado:** PASS

- scripts/backup.ts existe
- Backup model con checksum en schema
- Endpoints de respaldos existen

## Restore

**Estado:** WARNING

- Endpoint de restore existe
- No hay test automatizado de restore completo
- Documentación de restore pendiente

## Security

**Estado:** PASS

- public/config no expone datos operacionales
- validateUrl en admin/config (anti-XSS)
- Rate limiting en login
- Endpoint interno con shared secret
- Cookies HttpOnly
- CORS configurable

## Documentation

**Estado:** PASS

- README actualizado
- CHANGELOG actualizado
- CONTRIBUTING.md
- .env.example
- Issue y PR templates

## Remaining risks

1. **Frontend** no auditado visualmente
2. **Integration tests en CI** pueden tardar >5min
3. **authVersion del realtime vs DB** — El realtime no consulta DB
4. **Migraciones formales** pendientes para producción
5. **Restore automatizado** no probado end-to-end
6. **Service worker update** — Navegadores existentes pueden tener SW viejo

## Production ready

**NO** — Pendiente de:
- CI verde en GitHub Actions (integration-tests)
- Verificación de que el servidor arranca correctamente en CI runner
