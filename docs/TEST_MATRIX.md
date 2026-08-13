# SoftLBA — Test Matrix

**Última actualización:** v1.0.20-rc9

## Matriz de cobertura de tests

| Área | Unit | Integration | E2E | Concurrency | Security | Estado |
|------|------|-------------|-----|-------------|----------|--------|
| AUTH | ✅ 18 | ✅ | ❌ | ❌ | ✅ | PASS |
| USERS | ❌ | ❌ | ❌ | ❌ | ❌ | NOT TESTED |
| ROLES | ❌ | ❌ | ❌ | ❌ | ❌ | NOT TESTED |
| PERMISSIONS | ✅ 10 | ❌ | ❌ | ❌ | ❌ | PARTIAL |
| PRODUCTS | ✅ 24 | ❌ | ❌ | ❌ | ❌ | PARTIAL |
| CATEGORIES | ❌ | ❌ | ❌ | ❌ | ❌ | NOT TESTED |
| AREAS | ❌ | ❌ | ❌ | ❌ | ❌ | NOT TESTED |
| TABLES | ✅ 35 | ✅ | ❌ | ✅ | ❌ | PARTIAL |
| ORDERS | ✅ 50 | ✅ | ❌ | ✅ | ❌ | PARTIAL |
| ORDER ITEMS | ✅ | ❌ | ❌ | ❌ | ❌ | PARTIAL |
| KITCHEN | ✅ | ✅ | ❌ | ❌ | ✅ | PARTIAL |
| PIZZERIA | ✅ | ✅ | ❌ | ❌ | ✅ | PARTIAL |
| SALON | ❌ | ❌ | ❌ | ❌ | ❌ | NOT TESTED |
| DIRECT | ✅ | ❌ | ❌ | ❌ | ❌ | PARTIAL |
| INVENTORY | ✅ 28 | ✅ | ❌ | ✅ | ❌ | PARTIAL |
| RECIPES | ✅ | ❌ | ❌ | ❌ | ❌ | PARTIAL |
| PAYMENTS | ✅ | ✅ | ❌ | ✅ | ❌ | PARTIAL |
| CASH | ❌ | ❌ | ❌ | ❌ | ❌ | NOT TESTED |
| FINANCE | ✅ 68 | ❌ | ❌ | ❌ | ❌ | PARTIAL |
| MULTICURRENCY | ✅ | ❌ | ❌ | ❌ | ❌ | PARTIAL |
| REALTIME | ✅ 20 | ❌ | ❌ | ❌ | ✅ | PARTIAL |
| NOTIFICATIONS | ❌ | ❌ | ❌ | ❌ | ❌ | NOT TESTED |
| PWA | ✅ | ❌ | ❌ | ❌ | ❌ | PARTIAL |
| OFFLINE | ❌ | ❌ | ❌ | ❌ | ❌ | NOT TESTED |
| BACKUP | ✅ | ❌ | ❌ | ❌ | ❌ | PARTIAL |
| RESTORE | ❌ | ❌ | ❌ | ❌ | ❌ | NOT TESTED |
| ADMIN | ❌ | ❌ | ❌ | ❌ | ❌ | NOT TESTED |

## Resumen

- **Total unit tests:** 375
- **Integration tests:** 3 archivos (api, concurrency, db-integration)
- **E2E tests:** 0 (pendiente — FASE U)
- **Áreas NOT TESTED:** 7 (USERS, CATEGORIES, AREAS, SALON, CASH, NOTIFICATIONS, RESTORE)
- **Áreas PARTIAL:** 14
- **Áreas PASS:** 1 (AUTH)

## Próximos pasos

1. Completar tests de USERS, CATEGORIES, AREAS
2. Crear E2E para flujo POS crítico
3. Probar OFFLINE y RESTORE
4. Frontend audit (FASE D-T)
