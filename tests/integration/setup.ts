// tests/integration/setup.ts
// ------------------------------------------------------------
// Arranca el servidor Next.js antes de los tests de integración
// y lo cierra al terminar.
//
// v1.0.20-rc2 (P1): stderr VISIBLE para diagnóstico de CI.
// Si el servidor falla, el error se imprime y el test falla.
// ============================================================
import { spawn, type ChildProcess, execSync } from 'child_process'
import { mkdirSync, existsSync, rmSync, unlinkSync } from 'fs'
import { join, resolve } from 'path'

const PORT = 3099
const BASE_URL = `http://localhost:${PORT}`

// Usar path absoluto para la DB de test
const TEST_DB_PATH = resolve(join(process.cwd(), 'db', 'test-integration.db'))

let serverProcess: ChildProcess | null = null
let serverStderr: string[] = []
let serverStdout: string[] = []

async function waitForServer(url: string, timeoutMs = 120000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`)
      if (res.ok || res.status === 404) return
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  // Timeout — imprimir stderr para diagnóstico
  const stderrLog = serverStderr.join('\n')
  const stdoutLog = serverStdout.join('\n')
  throw new Error(
    `Server at ${url} did not start within ${timeoutMs}ms.\n` +
    `=== STDOUT (últimas 20 líneas) ===\n${stdoutLog.split('\n').slice(-20).join('\n')}\n` +
    `=== STDERR (últimas 30 líneas) ===\n${stderrLog.split('\n').slice(-30).join('\n')}`
  )
}

export async function setupServer() {
  if (serverProcess) return BASE_URL

  // Asegurar que el directorio db existe
  mkdirSync(join(process.cwd(), 'db'), { recursive: true })

  // Eliminar DB de test anterior
  if (existsSync(TEST_DB_PATH)) {
    rmSync(TEST_DB_PATH)
  }
  // Eliminar WAL/SHM
  for (const ext of ['-wal', '-shm', '-journal']) {
    const p = TEST_DB_PATH + ext
    if (existsSync(p)) unlinkSync(p)
  }

  // Configurar variables de entorno para el proceso
  const testEnv = {
    ...process.env,
    DATABASE_URL: `file:${TEST_DB_PATH}`,
    NEXTAUTH_SECRET: 'test-secret-minimum-16-chars-long',
    REALTIME_SECRET: 'test-realtime-secret-minimum-16-chars',
    DEMO_USERS: 'true',
    COOKIE_SECURE: 'false',
    NODE_ENV: 'development',
  }

  // Exportar variables para que el proceso hijo las herede
  process.env.DATABASE_URL = `file:${TEST_DB_PATH}`
  process.env.NEXTAUTH_SECRET = 'test-secret-minimum-16-chars-long'
  process.env.REALTIME_SECRET = 'test-realtime-secret-minimum-16-chars'
  process.env.DEMO_USERS = 'true'
  process.env.COOKIE_SECURE = 'false'

  // Push schema a la DB de test
  console.log('[setup] Pushing schema to test DB...')
  try {
    execSync('npx prisma db push --accept-data-loss', {
      env: testEnv as any,
      stdio: 'pipe',
      cwd: process.cwd(),
    })
    console.log('[setup] Schema pushed successfully.')
  } catch (err: any) {
    throw new Error(`[setup] Failed to push schema: ${err.message}\n${err.stderr?.toString() || ''}`)
  }

  // Ejecutar seed
  console.log('[setup] Seeding test DB...')
  try {
    execSync('bun run scripts/seed.ts', {
      env: testEnv as any,
      stdio: 'pipe',
      cwd: process.cwd(),
    })
    console.log('[setup] Seed completed.')
  } catch (err: any) {
    // Seed puede fallar si los datos ya existen — no es fatal
    console.warn('[setup] Seed failed (may be OK if data exists):', err.message?.slice(0, 200))
  }

  // Arrancar Next.js dev server
  console.log(`[setup] Starting Next.js on port ${PORT}...`)
  serverStderr = []
  serverStdout = []

  serverProcess = spawn('npx', ['next', 'dev', '-p', String(PORT)], {
    env: testEnv as any,
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: process.cwd(),
    shell: true,
  })

  const proc = serverProcess

  // Capturar stdout para diagnóstico
  proc.stdout?.on('data', (data) => {
    const msg = data.toString()
    serverStdout.push(msg)
    // Imprimir líneas que contengan "Ready" o "Error" para CI
    if (msg.includes('Ready') || msg.includes('Error') || msg.includes('error')) {
      console.log('[server:stdout]', msg.trim())
    }
  })

  // P1: NO suprimir stderr — mostrarlo para diagnóstico
  proc.stderr?.on('data', (data) => {
    const msg = data.toString()
    serverStderr.push(msg)
    // Imprimir siempre stderr para CI
    console.error('[server:stderr]', msg.trim())
  })

  // Detectar si el proceso termina prematuramente
  proc.on('exit', (code, signal) => {
    if (code !== 0 && code !== null) {
      console.error(`[setup] Server process exited with code ${code}`)
      const stderrLog = serverStderr.join('\n')
      const stdoutLog = serverStdout.join('\n')
      console.error(`[setup] STDOUT:\n${stdoutLog.split('\n').slice(-20).join('\n')}`)
      console.error(`[setup] STDERR:\n${stderrLog.split('\n').slice(-30).join('\n')}`)
    }
  })

  // Esperar a que el servidor esté listo
  await waitForServer(BASE_URL, 120000)
  console.log('[setup] Server is ready.')

  return BASE_URL
}

export async function teardownServer() {
  if (serverProcess) {
    console.log('[setup] Shutting down server...')
    serverProcess.kill('SIGTERM')
    // Esperar a que termine
    await new Promise((r) => setTimeout(r, 3000))
    // Si sigue vivo, forzar
    try {
      serverProcess.kill('SIGKILL')
    } catch {
      // Ya terminó
    }
    serverProcess = null
    console.log('[setup] Server shut down.')
  }
}

export { BASE_URL, PORT }
