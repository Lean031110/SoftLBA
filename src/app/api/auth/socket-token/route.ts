// GET /api/auth/socket-token
// ------------------------------------------------------------
// v1.0.19.2 (FASE 22): El frontend no puede leer la cookie HttpOnly
// rc_session. Este endpoint server-side la lee y retorna el token
// para que el frontend lo use en el handshake de Socket.IO.
// FASE 3: logger estructurado.
// ============================================================
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken } from '@/lib/auth/token'
import { logger } from '@/lib/logger'

const SESSION_COOKIE = 'rc_session'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value
    if (!token) {
      return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    }

    const session = await verifySessionToken(token)
    if (!session) {
      return NextResponse.json({ ok: false, error: 'SESION_EXPIRADA' }, { status: 401 })
    }

    return NextResponse.json({
      ok: true,
      token,
      userId: session.userId,
      expiresAt: session.expiresAt,
    })
  } catch (e) {
    logger.error('socket-token error', { err: (e as Error)?.message }, 'auth')
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
