// scripts/print-worker.ts
// FASE 2 (stub funcional) / FASE 14 (completo)
//
// Worker que procesa la cola de PrintJobs cada 5s.
// En FASE 2: arranca, expone /health en :3004, y duerme.
// En FASE 14: invoca PrintService.processPrintQueue() con lock + backoff.

import { createServer } from 'http'
import { appendFileSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'

const ROOT = resolve(__dirname, '..')
const LOG_DIR = join(ROOT, 'logs')
const LOG_FILE = join(LOG_DIR, 'printer.log')

mkdirSync(LOG_DIR, { recursive: true })

function log(level: 'INFO' | 'WARN' | 'ERROR' | 'FATAL', msg: string, data?: any) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    module: 'print-worker',
    message: msg,
    ...(data ? { data } : {}),
  }
  const line = JSON.stringify(entry)
  console.log(line)
  appendFileSync(LOG_FILE, line + '\n')
}

const PORT = parseInt(process.env.PRINT_WORKER_PORT || '3004', 10)

// Health endpoint
const server = createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        ok: true,
        service: 'print-worker',
        port: PORT,
        uptime: Math.floor(process.uptime()),
        pid: process.pid,
        // stub: en FASE 14 se añadirá lastProcessedAt, queueDepth, etc.
        stub: true,
      }),
    )
    return
  }
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ ok: false, error: 'Not found' }))
})

server.listen(PORT, '127.0.0.1', () => {
  log('INFO', `Print Worker iniciado en puerto ${PORT} (PID ${process.pid})`)
  log('INFO', 'STUB FASE 2 — no procesa cola todavía. Implementación completa en FASE 14.')
})

// === Ciclo principal (stub) ====================================
// En FASE 14, este ciclo invocará PrintService.processPrintQueue().
// Por ahora solo mantiene el proceso vivo y registra que está esperando.
let cycle = 0
const TICK_MS = 5000

const interval = setInterval(() => {
  cycle++
  // Stub: solo log cada 12 ciclos (1 min) para no llenar el log.
  if (cycle % 12 === 0) {
    log('INFO', `Tick #${cycle} — esperando implementación FASE 14`)
  }
}, TICK_MS)

// === Graceful shutdown =========================================
let shuttingDown = false

async function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  log('INFO', `${signal} recibido — cerrando Print Worker...`)
  clearInterval(interval)
  server.close(() => {
    log('INFO', 'Print Worker detenido.')
    process.exit(0)
  })
  // Forzar salida tras 3s si el server no se cierra.
  setTimeout(() => process.exit(0), 3000)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

process.on('uncaughtException', (err) => {
  log('FATAL', `Uncaught exception: ${err.message}`, { stack: err.stack })
  // No salir: el worker debe ser resiliente.
})

process.on('unhandledRejection', (reason) => {
  log('FATAL', `Unhandled rejection: ${String(reason)}`)
})
