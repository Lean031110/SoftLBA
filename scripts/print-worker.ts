// scripts/print-worker.ts
// FASE 28 — Print Worker funcional (v2 con imports estáticos).
//
// Procesa la cola de PrintJobs cada 5s invocando PrintService.processPrintQueue().
//
// v2 (fix definitivo):
//   - IMPORTS ESTÁTICOS en lugar de dynamic import.
//     Bun a veces no resuelve bien la cadena de dynamic imports en scripts
//     standalone. Los imports estáticos se resuelven al cargar el módulo,
//     que es el patrón más confiable.
//   - Diagnóstico en arranque: log de typeof db, db.printJob, etc.
//   - Health endpoint en :3004 con métricas.
//   - Graceful shutdown.

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

// === IMPORTS ESTÁTICOS (fix definitivo) =====================
// Antes usábamos dynamic import dentro de processQueueIteration, lo que
// causaba que la cadena de resolución ('../src/lib/print/print-service' → '../db'
// → '@prisma/client') se resolviera en tiempo de ejecución con posible
// pérdida de contexto. Con imports estáticos al inicio del módulo, Bun
// resuelve toda la cadena al cargar el archivo, y si algo falla, el error
// es claro e inmediato (no cada 5s silenciosamente).

import { db } from '../src/lib/db'
import { processPrintQueue } from '../src/lib/print/print-service'

const PORT = parseInt(process.env.PRINT_WORKER_PORT || '3004', 10)
const INTERVAL_MS = parseInt(process.env.PRINT_WORKER_INTERVAL_MS || '5000', 10)

// === Diagnóstico en arranque =================================
// Esto nos dice inmediatamente si db se cargó bien.
log('INFO', `Arranque Print Worker v2 — diagnóstico de imports:`, {
  dbType: typeof db,
  dbIsUndefined: db === undefined,
  dbIsNull: db === null,
  printJobType: typeof db?.printJob,
  printJobFindManyType: typeof db?.printJob?.findMany,
  processPrintQueueType: typeof processPrintQueue,
  cwd: process.cwd(),
  databaseUrlSet: !!process.env.DATABASE_URL,
  nodeEnv: process.env.NODE_ENV || '(unset)',
})

if (db === undefined || db === null) {
  log('FATAL', 'db es undefined/null — la cadena de imports falló silenciosamente. Abortando.')
  process.exit(1)
}

if (typeof db?.printJob?.findMany !== 'function') {
  log('FATAL', 'db.printJob.findMany no es función — Prisma client mal generado o schema desactualizado', {
    dbKeys: Object.keys(db).slice(0, 30),
  })
  log('INFO', 'Intenta: bun run db:generate && bun install')
  process.exit(1)
}

if (typeof processPrintQueue !== 'function') {
  log('FATAL', 'processPrintQueue no es función — print-service.ts no exportó correctamente')
  process.exit(1)
}

log('INFO', '✅ Diagnóstico OK: db y processPrintQueue cargados correctamente')

// === Métricas ===
const metrics = {
  startedAt: Date.now(),
  lastProcessedAt: 0,
  lastProcessedDurationMs: 0,
  totalIterations: 0,
  totalPrinted: 0,
  totalFailed: 0,
  lastError: null as string | null,
  queueDepth: 0,
  processing: false,
}

// === Health endpoint ===
const server = createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        ok: true,
        service: 'print-worker',
        version: '1.1.0-rc7-v2',
        port: PORT,
        pid: process.pid,
        uptime: Math.floor(process.uptime()),
        uptimeHuman: `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`,
        interval: INTERVAL_MS,
        metrics: {
          ...metrics,
          lastProcessedAt: metrics.lastProcessedAt
            ? new Date(metrics.lastProcessedAt).toISOString()
            : null,
        },
      }),
    )
    return
  }
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ ok: false, error: 'Not found' }))
})

server.listen(PORT, '127.0.0.1', () => {
  log('INFO', `Print Worker iniciado en puerto ${PORT} (PID ${process.pid})`)
  log('INFO', `Intervalo: ${INTERVAL_MS}ms`)
  log('INFO', `Health: http://127.0.0.1:${PORT}/health`)
})

// === Ciclo principal ===
async function processQueueIteration(): Promise<void> {
  if (metrics.processing) {
    return
  }
  metrics.processing = true
  const t0 = Date.now()
  try {
    const result = await processPrintQueue()
    metrics.lastProcessedAt = Date.now()
    metrics.lastProcessedDurationMs = metrics.lastProcessedAt - t0
    metrics.totalIterations++
    metrics.totalPrinted += result.printed
    metrics.totalFailed += result.failed
    metrics.lastError = null

    if (result.processed > 0) {
      log('INFO', `Cola procesada`, {
        processed: result.processed,
        printed: result.printed,
        failed: result.failed,
        durationMs: metrics.lastProcessedDurationMs,
      })
    }

    try {
      const pending = await db.printJob.count({ where: { status: 'PENDING' } })
      const printing = await db.printJob.count({ where: { status: 'PRINTING' } })
      metrics.queueDepth = pending + printing
    } catch {
      // No fatal.
    }
  } catch (e: any) {
    metrics.lastError = e?.message || String(e)
    log('ERROR', 'Error procesando cola', { err: e?.message, stack: e?.stack })
  } finally {
    metrics.processing = false
  }
}

log('INFO', 'Iniciando ciclo de procesamiento de cola...')
const interval = setInterval(processQueueIteration, INTERVAL_MS)

// Iteración inmediata al arranque.
processQueueIteration().catch((e) => {
  log('ERROR', 'Error en iteración inicial', { err: e?.message })
})

// === Graceful shutdown ===
let shuttingDown = false

async function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  log('INFO', `${signal} recibido — cerrando Print Worker...`)
  clearInterval(interval)

  const startWait = Date.now()
  while (metrics.processing && Date.now() - startWait < 10_000) {
    await new Promise((r) => setTimeout(r, 200))
  }

  server.close(() => {
    log('INFO', `Print Worker detenido. Estadísticas:`, {
      totalIterations: metrics.totalIterations,
      totalPrinted: metrics.totalPrinted,
      totalFailed: metrics.totalFailed,
      uptimeSeconds: Math.floor((Date.now() - metrics.startedAt) / 1000),
    })
    process.exit(0)
  })

  setTimeout(() => process.exit(0), 5000)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

process.on('uncaughtException', (err) => {
  log('FATAL', `Uncaught exception: ${err.message}`, { stack: err.stack })
  metrics.lastError = err.message
})

process.on('unhandledRejection', (reason) => {
  log('FATAL', `Unhandled rejection: ${String(reason)}`)
  metrics.lastError = String(reason)
})
