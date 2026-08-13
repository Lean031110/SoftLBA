// tests/integration/setup.ts
// ------------------------------------------------------------
// FASE 20: Arranca el servidor Next.js antes de los tests de
// integración y lo cierra al terminar.
// Esto elimina los ECONNREFUSED de CI.
// ============================================================
import { spawn, type ChildProcess } from 'child_process'
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'fs'
import { join } from 'path'

const PORT = 3099
const BASE_URL = `http://localhost:${PORT}`

let serverProcess: ChildProcess | null = null

// Crear .env de test si no existe
const testEnvPath = join(process.cwd(), '.env.test')
if (!existsSync(testEnvPath)) {
  writeFileSync(testEnvPath, `DATABASE_URL=file:./db/test-integration.db
NEXTAUTH_SECRET=test-secret-minimum-16-chars-long
REALTIME_SECRET=test-realtime-secret-minimum-16-chars
DEMO_USERS=true
COOKIE_SECURE=false
`)
}

async function waitForServer(url: string, timeoutMs = 60000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`)
      if (res.ok || res.status === 404) return
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`Server at ${url} did not start within ${timeoutMs}ms`)
}

export async function setupServer() {
  if (serverProcess) return BASE_URL

  // Ensure test DB directory exists
  mkdirSync(join(process.cwd(), 'db'), { recursive: true })

  // Remove old test DB
  const testDbPath = join(process.cwd(), 'db', 'test-integration.db')
  if (existsSync(testDbPath)) {
    rmSync(testDbPath)
  }

  // Push schema to test DB
  // Use the test env
  process.env.DATABASE_URL = `file:./db/test-integration.db`
  process.env.NEXTAUTH_SECRET = 'test-secret-minimum-16-chars-long'
  process.env.REALTIME_SECRET = 'test-realtime-secret-minimum-16-chars'
  process.env.DEMO_USERS = 'true'
  process.env.COOKIE_SECURE = 'false'

  // Run prisma db push
  const { execSync } = await import('child_process')
  execSync('npx prisma db push --accept-data-loss', {
    env: { ...process.env, DATABASE_URL: 'file:./db/test-integration.db' },
    stdio: 'pipe',
  })

  // Run seed
  try {
    execSync('bun run scripts/seed.ts', {
      env: { ...process.env, DATABASE_URL: 'file:./db/test-integration.db' },
      stdio: 'pipe',
    })
  } catch {
    // Seed may fail if data already exists, that's OK
  }

  // Start Next.js dev server on test port
  serverProcess = spawn('npx', ['next', 'dev', '-p', String(PORT)], {
    env: {
      ...process.env,
      DATABASE_URL: 'file:./db/test-integration.db',
      NEXTAUTH_SECRET: 'test-secret-minimum-16-chars-long',
      REALTIME_SECRET: 'test-realtime-secret-minimum-16-chars',
      DEMO_USERS: 'true',
      COOKIE_SECURE: 'false',
      PORT: String(PORT),
    },
    stdio: 'pipe',
    cwd: process.cwd(),
  })

  serverProcess.stdout?.on('data', (data) => {
    const msg = data.toString()
    if (msg.includes('Ready') || msg.includes('started')) {
      // Server is ready
    }
  })

  serverProcess.stderr?.on('data', (data) => {
    // Suppress stderr in tests
  })

  // Wait for server to be ready
  await waitForServer(BASE_URL, 120000)

  return BASE_URL
}

export async function teardownServer() {
  if (serverProcess) {
    serverProcess.kill('SIGTERM')
    serverProcess = null
    // Give it a moment to clean up
    await new Promise((r) => setTimeout(r, 2000))
  }
}

export { BASE_URL, PORT }
