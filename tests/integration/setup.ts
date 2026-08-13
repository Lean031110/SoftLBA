// tests/integration/setup.ts
// ------------------------------------------------------------
// Helper para tests de integración.
// El servidor es arrancado por global-setup.ts UNA sola vez.
// Este módulo solo provee la URL base.
// ============================================================

export const BASE_URL = process.env.INTEGRATION_BASE_URL || 'http://localhost:3099'
export const PORT = 3099
export const TEST_DB_PATH = process.env.INTEGRATION_TEST_DB || ''

// Estas funciones son no-ops porque el servidor se maneja en global-setup
export async function setupServer(): Promise<string> {
  if (!process.env.INTEGRATION_BASE_URL) {
    throw new Error('INTEGRATION_BASE_URL not set. global-setup.ts must run first.')
  }
  return BASE_URL
}

export async function teardownServer(): Promise<void> {
  // No-op: el servidor se cierra en global-setup.ts
}
