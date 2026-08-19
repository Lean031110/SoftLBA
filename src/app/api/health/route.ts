// GET /api/health - Health check del sistema
// v1.1.0-rc1: incluye versión de la app en la respuesta.
// El health check debe ser simple: DB responde = OK.
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { APP_VERSION } from '@/lib/app-version'

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
    {
      ok: dbOk,
      status: dbOk ? 'healthy' : 'unhealthy',
      version: APP_VERSION,
      checks,
    },
    { status: dbOk ? 200 : 503 },
  )
}
