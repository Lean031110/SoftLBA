// tests/e2e/visual-regression.spec.ts
// v1.0.20-FRONTEND-14: Visual regression — capturas de pantallas clave.
//
// Plan sección 38: capturar login, dashboard, nuevo pedido, cocina,
// pizzeria, admin, ayuda en mobile (375x667), tablet (768x1024) y
// desktop (1280x720).
//
// Las capturas se guardan en tests/e2e/screenshots/ como baseline.
// En CI, se comparan contra el baseline anterior. Si hay diferencias
// visuales, el test falla y el revisor debe actualizar el baseline.
//
// Uso:
//   # Generar baseline inicial:
//   npx playwright test --config=tests/e2e/playwright.config.ts visual-regression.spec.ts --update-snapshots
//
//   # Comparar contra baseline:
//   npx playwright test --config=tests/e2e/playwright.config.ts visual-regression.spec.ts

import { test, expect } from '@playwright/test'

const SCREENSHOTS_DIR = 'tests/e2e/screenshots'

// Viewports del plan sección 37.
const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 720 },
]

// Páginas clave del plan sección 38.
const PAGES = [
  { name: 'home', path: '/', requiresAuth: false },
  { name: 'login', path: '/login', requiresAuth: false },
  { name: 'offline', path: '/offline', requiresAuth: false },
  { name: 'admin-dashboard', path: '/admin', requiresAuth: true },
  { name: 'admin-usuarios', path: '/admin/usuarios', requiresAuth: true },
  { name: 'mesero', path: '/mesero', requiresAuth: true },
  { name: 'mesero-nuevo-pedido', path: '/mesero/nuevo-pedido', requiresAuth: true },
  { name: 'cocina', path: '/cocina', requiresAuth: true },
  { name: 'pizzeria', path: '/pizzeria', requiresAuth: true },
  { name: 'ayuda', path: '/ayuda', requiresAuth: true },
]

test.describe('Visual Regression', () => {
  for (const viewport of VIEWPORTS) {
    test.describe(`Viewport: ${viewport.name} (${viewport.width}x${viewport.height})`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
      })

      for (const pg of PAGES) {
        test(`${pg.name} @ ${viewport.name}`, async ({ page, context }) => {
          // Login si la página requiere auth
          if (pg.requiresAuth) {
            await context.clearCookies()
            await page.goto('/login')
            await page.fill('#username', 'admin')
            await page.fill('#password', 'admin123')
            await page.click('button[type="submit"]')
            await page.waitForURL('**/admin', { timeout: 15000 }).catch(() => {})
          }

          // Navegar a la página
          await page.goto(pg.path)
          // Esperar a que cargue — usar networkidle para asegurar que
          // todas las peticiones terminaron.
          await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
          // Dar tiempo extra para animaciones y renders.
          await page.waitForTimeout(1500)

          // Tomar captura full-page
          await expect(page).toHaveScreenshot(
            `${pg.name}-${viewport.name}.png`,
            {
              maxDiffPixelRatio: 0.05, // 5% de tolerancia
              threshold: 0.3,
              animations: 'disabled',
              fullPage: true,
            },
          )
        })
      }
    })
  }
})
