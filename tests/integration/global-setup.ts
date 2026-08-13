// tests/integration/global-setup.ts
// ------------------------------------------------------------
// Arranca el servidor Next.js UNA sola vez antes de TODOS los tests
// de integración. Se cierra al terminar todos los tests.
// Esto evita EADDRINUSE cuando múltiples archivos de test intentan
// arrancar el servidor en el mismo puerto.
// ============================================================
import { spawn, type ChildProcess, execSync } from 'child_process'
import { mkdirSync, existsSync, rmSync, unlinkSync } from 'fs'
import { join, resolve } from 'path'
import * as http from 'http'

const PORT = 3099
const BASE_URL = `http://localhost:${PORT}`
const TEST_DB_PATH = resolve(process.cwd(), 'db', 'test-integration.db')

let serverProcess: ChildProcess | null = null
let serverStderr: string[] = []
let serverStdout: string[] = []

async function waitForServer(baseUrl: string, timeoutMs = 120000): Promise<void> {
  const start = Date.now()
  // On CI runners, localhost may resolve to IPv6 (::1) which fetch can't reach.
  // Try multiple hostnames.
  const hosts = ['127.0.0.1', 'localhost', '0.0.0.0']

  while (Date.now() - start < timeoutMs) {
    for (const host of hosts) {
      const url = `http://${host}:${PORT}`
      try {
        // Use http.get instead of fetch for better IPv4/IPv6 compat
        const ok = await new Promise<boolean>((resolve) => {
          const req = http.get(`${url}/api/health`, (res: any) => {
            res.resume()
            resolve(res.statusCode === 200 || res.statusCode === 404)
          })
          req.on('error', () => resolve(false))
          req.setTimeout(3000, () => { req.destroy(); resolve(false) })
        })
        if (ok) {
          console.log(`[global-setup] Server responded at ${url}`)
          process.env.INTEGRATION_BASE_URL = url
          return
        }
      } catch {
        // Not ready
      }
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  const stderrLog = serverStderr.join('\n')
  const stdoutLog = serverStdout.join('\n')
  throw new Error(
    `Server at ${baseUrl} did not start within ${timeoutMs}ms.\n` +
    `=== STDOUT (últimas 20 líneas) ===\n${stdoutLog.split('\n').slice(-20).join('\n')}\n` +
    `=== STDERR (últimas 30 líneas) ===\n${stderrLog.split('\n').slice(-30).join('\n')}`
  )
}

export async function setup() {
  console.log('[global-setup] Starting...')

  // Ensure db directory exists
  mkdirSync(join(process.cwd(), 'db'), { recursive: true })

  // Remove old test DB
  if (existsSync(TEST_DB_PATH)) {
    rmSync(TEST_DB_PATH)
  }
  for (const ext of ['-wal', '-shm', '-journal']) {
    const p = TEST_DB_PATH + ext
    if (existsSync(p)) unlinkSync(p)
  }

  const testEnv = {
    ...process.env,
    DATABASE_URL: `file:${TEST_DB_PATH}`,
    NEXTAUTH_SECRET: 'test-secret-minimum-16-chars-long',
    REALTIME_SECRET: 'test-realtime-secret-minimum-16-chars',
    DEMO_USERS: 'true',
    COOKIE_SECURE: 'false',
    NODE_ENV: 'development',
  }

  // Push schema
  console.log('[global-setup] Pushing schema...')
  execSync('npx prisma db push --accept-data-loss', {
    env: testEnv as any,
    stdio: 'pipe',
    cwd: process.cwd(),
  })

  // Seed
  console.log('[global-setup] Seeding...')
  try {
    execSync('bun run scripts/seed.ts', {
      env: testEnv as any,
      stdio: 'pipe',
      cwd: process.cwd(),
    })
  } catch (err: any) {
    console.warn('[global-setup] Seed failed (may be OK):', err.message?.slice(0, 200))
  }

  // Start Next.js
  console.log(`[global-setup] Starting Next.js on port ${PORT}...`)
  serverStderr = []
  serverStdout = []

  // Use bun to run next dev — more reliable in CI
  serverProcess = spawn('bun', ['run', 'dev', '--', '-p', String(PORT)], {
    env: { ...testEnv, PORT: String(PORT) } as any,
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: process.cwd(),
    shell: true,
  })

  const proc = serverProcess

  proc.stdout?.on('data', (data) => {
    const msg = data.toString()
    serverStdout.push(msg)
    if (msg.includes('Ready') || msg.includes('Error') || msg.includes('error')) {
      console.log('[server:stdout]', msg.trim())
    }
  })

  proc.stderr?.on('data', (data) => {
    const msg = data.toString()
    serverStderr.push(msg)
    console.error('[server:stderr]', msg.trim())
  })

  proc.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[global-setup] Server exited with code ${code}`)
    }
  })

  await waitForServer(BASE_URL, 120000)
  console.log('[global-setup] Server is ready.')

  // Store BASE_URL globally for tests to use
  process.env.INTEGRATION_BASE_URL = BASE_URL
  process.env.INTEGRATION_TEST_DB = TEST_DB_PATH
}

export async function teardown() {
  if (serverProcess) {
    console.log('[global-setup] Shutting down server...')
    serverProcess.kill('SIGTERM')
    await new Promise((r) => setTimeout(r, 3000))
    try {
      serverProcess.kill('SIGKILL')
    } catch {
      // Already dead
    }
    serverProcess = null
    console.log('[global-setup] Server shut down.')
  }
}
