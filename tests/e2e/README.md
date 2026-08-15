# E2E Tests — SoftLBA

## Setup

Los tests E2E usan Playwright. Para correrlos:

```bash
# Instalar browsers (solo primera vez)
npx playwright install chromium

# Correr todos los E2E
bun run test:e2e

# Ver UI
npx playwright test --ui
```

## Flujos cubiertos

| ID | Flujo | Estado |
|----|-------|--------|
| F1 | Login → mesero → nuevo pedido → pagar → cierre | ✅ básico |
| F4 | Login admin → crear usuario → reset password | pendiente |
| F6 | Login admin → cierre diario → recalc → close | pendiente |
| F9 | PWA offline → crear pedido → Background Sync | pendiente |

## Notas

- Los tests asumen que el servidor Next.js está corriendo en :3000
  (automático en dev con `bun run dev`).
- Usan la DB de desarrollo (`db/custom.db`) — los tests limpian sus datos.
- Para CI, ver `.github/workflows/ci.yml` job `e2e-tests` (PENDIENTE).
