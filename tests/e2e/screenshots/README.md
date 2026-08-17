# Visual Regression — Baseline Screenshots

Este directorio contiene las capturas de referencia (baseline) para los
tests de regresión visual en `tests/e2e/visual-regression.spec.ts`.

## Generar baseline inicial

```bash
# Asegurar que el servidor está corriendo en :3000
npx next dev -p 3000 &

# Generar baseline
npx playwright test --config=tests/e2e/playwright.config.ts \
  visual-regression.spec.ts --update-snapshots
```

## Comparar contra baseline

```bash
npx playwright test --config=tests/e2e/playwright.config.ts \
  visual-regression.spec.ts
```

## Viewports

| Nombre | Resolución | Dispositivo |
|--------|-----------|-------------|
| mobile | 375x667 | iPhone SE |
| tablet | 768x1024 | iPad |
| desktop | 1280x720 | Laptop |

## Páginas capturadas

10 páginas × 3 viewports = 30 capturas.
