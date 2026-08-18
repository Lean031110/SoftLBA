// scripts/dev-all.mjs
// FASE 2: Orquestador único de desarrollo.
//
// Arranca simultáneamente:
//   1. Next.js (puerto 3000)
//   2. Realtime service (puerto 3003)
//   3. Print Worker (cola de impresión cada 5s)
//
// Características:
//   - Muestra PIDs y URLs al inicio.
//   - Detecta puertos ocupados antes de arrancar.
//   - Propaga SIGINT/SIGTERM a todos los hijos.
//   - Si un hijo muere inesperadamente, lo marca claramente.
//   - Output prefijado por servicio: [next] [realtime] [print].
//   - Escribe logs a logs/dev-all.log (rotación manual por ahora).
//   - NO silencia errores reales.

import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, appendFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(__dirname, '..')

const LOG_DIR = join(ROOT, 'logs')
const LOG_FILE = join(LOG_DIR, 'dev-all.log')

mkdirSync(LOG_DIR, { recursive: true })

// ----- helpers --------------------------------------------------

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  appendFileSync(LOG_FILE, line + '\n')
}

function logChild(prefix, data) {
  const text = data.toString().trimEnd()
  if (!text) return
  for (const line of text.split('\n')) {
    const prefixed = `[${prefix}] ${line}`
    console.log(prefixed)
    appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${prefixed}\n`)
  }
}

async function checkPort(port) {
  // Devuelve true si el puerto está LIBRE, false si está ocupado.
  const { createServer } = await import('node:net')
  return new Promise((resolvePromise) => {
    const srv = createServer()
    srv.once('error', () => resolvePromise(false))
    srv.once('listening', () => {
      srv.close(() => resolvePromise(true))
    })
    srv.listen(port, '127.0.0.1')
  })
}

async function waitForPort(port, host, timeoutMs = 10000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const free = await checkPort(port)
    // Si checkPort devuelve true es que está libre (no responde nadie).
    // Aquí queremos lo opuesto: esperar a que el servicio escuche.
    if (!free) return true
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}

// ----- check puertos --------------------------------------------

const PORTS = [
  { name: 'Next.js',     port: 3000, hint: 'http://localhost:3000' },
  { name: 'Realtime',    port: 3003, hint: 'ws://localhost:3003' },
  { name: 'Print Worker', port: 3004, hint: 'http://localhost:3004/health' },
]

const occupied = []
for (const p of PORTS) {
  const free = await checkPort(p.port)
  if (!free) {
    occupied.push(p)
  }
}

if (occupied.length > 0) {
  log('')
  log('⚠️  Puertos ocupados detectados:')
  for (const p of occupied) {
    log(`     ${p.name} → :${p.port} (${p.hint})`)
  }
  log('')
  log('Deteniendo arranque. Libera los puertos o ajusta las variables de entorno:')
  log('  - REALTIME_PORT (default 3003)')
  log('  - PORT (default 3000 para Next)')
  log('')
  log('Para matar procesos que ocupen un puerto:')
  log('  lsof -i :3000   (Linux/Mac)')
  log('  netstat -ano | findstr :3000   (Windows)')
  process.exit(1)
}

// ----- arranque de servicios -----------------------------------

log('─────────────────────────────────────────────────────────────')
log('  SoftLBA — dev:all')
log('─────────────────────────────────────────────────────────────')

const children = []

function spawnService({ name, command, args, env, color }) {
  const child = spawn(command, args, {
    cwd: ROOT,
    env: { ...process.env, ...env, FORCE_COLOR: '1' },
    shell: process.platform === 'win32',
  })

  child.stdout?.on('data', (d) => logChild(name, d))
  child.stderr?.on('data', (d) => logChild(name, d))

  child.on('exit', (code, signal) => {
    if (shuttingDown) return
    log(`❌ [${name}] salió con code=${code} signal=${signal}`)
    // Si Next o Realtime caen, matamos al resto.
    if (name === 'next' || name === 'realtime') {
      log(`   El servicio ${name} es crítico — deteniendo dev:all.`)
      shutdown(1)
    }
  })

  child.on('error', (err) => {
    log(`❌ [${name}] error al spawn: ${err.message}`)
  })

  children.push({ name, child })
  log(`▶️  [${name}] PID ${child.pid} — ${command} ${args.join(' ')}`)
  return child
}

let shuttingDown = false

function shutdown(exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true
  log('')
  log('Deteniendo servicios...')
  for (const { name, child } of children) {
    if (!child.killed) {
      log(`   ⏹️  [${name}] SIGTERM → PID ${child.pid}`)
      try { child.kill('SIGTERM') } catch (e) { /* ignore */ }
    }
  }
  // Graceful 5s, luego SIGKILL.
  setTimeout(() => {
    for (const { name, child } of children) {
      if (!child.killed) {
        log(`   💀 [${name}] SIGKILL → PID ${child.pid}`)
        try { child.kill('SIGKILL') } catch (e) { /* ignore */ }
      }
    }
    process.exit(exitCode)
  }, 5000)
}

process.on('SIGINT', () => {
  log('\nSIGINT recibido.')
  shutdown(0)
})
process.on('SIGTERM', () => {
  log('SIGTERM recibido.')
  shutdown(0)
})

// Spawn de los 3 servicios
spawnService({
  name: 'next',
  command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
  args: ['next', 'dev', '-p', '3000'],
  env: { PORT: '3000' },
})

spawnService({
  name: 'realtime',
  command: process.platform === 'win32' ? 'bun.exe' : 'bun',
  args: ['run', 'mini-services/realtime-service/index.ts'],
  env: { REALTIME_PORT: '3003' },
})

spawnService({
  name: 'print',
  command: process.platform === 'win32' ? 'bun.exe' : 'bun',
  args: ['run', 'scripts/print-worker.ts'],
  env: { PRINT_WORKER_PORT: '3004' },
})

// ----- banner --------------------------------------------------

log('')
log('─────────────────────────────────────────────────────────────')
log('  SoftLBA — servicios activos')
log('─────────────────────────────────────────────────────────────')
log(`  Backend      →  http://localhost:3000`)
log(`  Realtime     →  ws://localhost:3003`)
log(`  Print Worker →  activo (cola cada 5s)`)
log(`  Health       →  http://localhost:3000/api/health`)
log(`  Logs         →  ${LOG_FILE}`)
log('─────────────────────────────────────────────────────────────')
log('  Ctrl+C para detener todos los servicios.')
log('─────────────────────────────────────────────────────────────')
log('')

// ----- health check tras 10s -----------------------------------

setTimeout(async () => {
  const nextFree = await checkPort(3000)
  const realtimeFree = await checkPort(3003)
  log('')
  log('─ Health check inicial ─')
  log(`  Backend   : ${nextFree ? '❌ no responde' : '🟢 OK'}`)
  log(`  Realtime  : ${realtimeFree ? '❌ no responde' : '🟢 OK'}`)
  log('')
}, 10000)
