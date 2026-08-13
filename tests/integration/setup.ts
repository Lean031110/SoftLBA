// tests/integration/setup.ts
// v1.0.20-rc9: El servidor se arranca como un STEP separado del workflow.
// Este módulo solo valida que el servidor está disponible y devuelve la URL.
// No arranca ni mata el servidor — eso lo hace el workflow.
export const BASE_URL = process.env.INTEGRATION_BASE_URL || 'http://127.0.0.1:3099'
export const PORT = 3099

export async function setupServer(): Promise<string> {
  // Verificar que el servidor responde
  const maxRetries = 30
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`)
      if (res.status === 200) {
        const data = await res.json()
        if (data.ok === true) {
          console.log(`[setup] Server healthy at ${BASE_URL}`)
          return BASE_URL
        }
      }
      console.log(`[setup] Server responded ${res.status}, retrying...`)
    } catch {
      // Not ready
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`[setup] Server at ${BASE_URL} not healthy after ${maxRetries} retries`)
}

export async function teardownServer(): Promise<void> {
  // No-op: el servidor se maneja en el workflow
}
