# SoftLBA — Release Checklist

**Versión:** v1.0.20-rc2
**Fecha:** 2026-08-13

---

## Criterios obligatorios para producción

### CI/CD
- [ ] CI green en GitHub Actions
- [ ] Quality job PASS (typecheck + lint)
- [ ] Unit tests job PASS
- [ ] Realtime service job PASS
- [ ] Integration tests job PASS
- [ ] Build job PASS

### TypeScript
- [ ] `npx tsc --noEmit` → 0 errores
- [ ] Realtime `npx tsc --noEmit` → 0 errores

### Lint
- [ ] `bun run lint` → 0 errores
- [ ] 0 warnings críticos

### Tests
- [ ] Unit tests: 0 failed
- [ ] Integration tests: 0 failed
- [ ] Concurrency tests: reales (no mocks)
- [ ] 0 skipped en suites críticas

### Realtime
- [ ] Token 5-part con authVersion
- [ ] Eventos del cliente rechazados
- [ ] Endpoint /emit con shared secret
- [ ] Typecheck independiente PASS

### Authentication
- [ ] Token HMAC con authVersion
- [ ] getCurrentUser() verifica authVersion
- [ ] bumpAuthVersion() invalida sesiones
- [ ] Rate limiting en login

### Authorization
- [ ] Ownership de pedidos verificado
- [ ] targetAreaId estricto en cocina/pizzería
- [ ] Endpoints administrativos requieren ADMIN
- [ ] Endpoint interno requiere localhost + secret

### Inventory
- [ ] InventoryService como fuente única
- [ ] consume/returnStock/transfer atómicos
- [ ] blockNegativeStock default true

### Orders
- [ ] DESPACHADO en OrderItemStatus
- [ ] DIRECTO nace como SERVIDO
- [ ] shiftId para trazabilidad

### Tables
- [ ] currentOrderId @unique
- [ ] takeTable atómico (WHERE status='LIBRE')
- [ ] releaseTable con ownership

### Payments
- [ ] idempotencyKey @unique
- [ ] exchangeRate/convertedAmount/baseCurrency

### Finance
- [ ] Snapshot histórico no recalculable
- [ ] Anulación con compensación

### PWA
- [ ] manifest.json existe
- [ ] Service worker funciona
- [ ] Rutas de auth excluidas de Background Sync
- [ ] No CDNs externos

### LAN
- [ ] output standalone
- [ ] Caddyfile existe
- [ ] Funciona sin Internet

### Database
- [ ] Schema válido
- [ ] Índices correctos
- [ ] Foreign keys correctas

### Backup
- [ ] scripts/backup.ts existe
- [ ] Backup model con checksum

### Security
- [ ] public/config no expone datos operacionales
- [ ] validateUrl en admin/config
- [ ] Cookies HttpOnly
- [ ] CORS configurable

### Documentation
- [ ] README actualizado
- [ ] CHANGELOG actualizado
- [ ] .env.example completo
- [ ] CONTRIBUTING.md

---

## Aprobación final

Solo cuando TODO esté marcado:

```
READY FOR PRODUCTION: v1.0.20
```

---

**Aprobado por:** _______________
**Fecha:** _______________
**Versión:** _______________
