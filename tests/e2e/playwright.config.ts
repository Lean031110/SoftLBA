// tests/e2e/playwright.config.ts
// v1.0.20-rc-final: Configuración Playwright para E2E tests de SoftLBA.

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './',
  fullyParallel: false, // Secuencial — los tests comparten DB
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // 1 worker — DB SQLite no soporta concurrencia bien
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // No arrancamos servidor aquí — se asume que ya está corriendo (bun run dev).
  // En CI, el workflow lo arranca en un step separado.
  // webServer: {
  //   command: 'bun run dev',
  //   port: 3000,
  //   reuseExistingServer: !process.env.CI,
  // },
})
