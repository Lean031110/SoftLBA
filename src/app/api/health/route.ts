// GET /api/health - Health check del sistema
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function GET() {
  const start = Date.now()
  const checks: Record<string, { status: string; latency?: number; error?: string }> = {}

  // Check 1: Base de datos
  try {
    const dbStart = Date.now()
    await db.$queryRaw`SELECT 1`
    checks.database = { status: 'ok', latency: Date.now() - dbStart }
  } catch (e: any) {
    checks.database = { status: 'error', error: e.message }
  }

  // Check 2: Memoria (aproximada)
  const memUsage = process.memoryUsage()
  checks.memory = {
    status: 'ok',
    latency: 0,
  }

  // Check 3: Uptime
  const uptime = process.uptime()

  // Check 4: Realtime service
  try {
    const rtStart = Date.now()
    const res = await fetch('http://localhost:3003/?EIO=4&transport=polling', {
      signal: AbortSignal.timeout(2000),
    })
    checks.realtime = { status: res.ok ? 'ok' : 'error', latency: Date.now() - rtStart }
  } catch (e: any) {
    checks.realtime = { status: 'error', error: e.message }
  }

  // Determinar estado general
  const allOk = Object.values(checks).every((c) => c.status === 'ok')
  const totalLatency = Date.now() - start

  const response = {
    status: allOk ? 'healthy' : 'degraded',
    uptime: Math.floor(uptime),
    timestamp: new Date().toISOString(),
    version: '0.20.0',
    latency: totalLatency,
    checks,
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
    },
  }

  logger.info('Health check', { status: response.status, latency: totalLatency })

  return NextResponse.json(response, { status: allOk ? 200 : 503 })
}
