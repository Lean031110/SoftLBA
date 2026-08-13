// GET /api/health - Health check del sistema
// v1.0.20-rc9: NO fallar si realtime no está disponible en CI/tests.
// El health check debe ser simple: DB responde = OK.
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const checks: Record<string, { status: string; error?: string }> = {}

  // Check 1: Base de datos
  try {
    await db.$queryRaw`SELECT 1`
    checks.database = { status: 'ok' }
  } catch (e: any) {
    checks.database = { status: 'error', error: e.message }
  }

  // Determinar estado general: solo DB es obligatorio
  const dbOk = checks.database.status === 'ok'

  return NextResponse.json(
    { ok: dbOk, status: dbOk ? 'healthy' : 'unhealthy', checks },
    { status: dbOk ? 200 : 503 },
  )
}
