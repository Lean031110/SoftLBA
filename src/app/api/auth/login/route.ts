// POST /api/auth/login
// v1.0.17: rate limiting por IP + dispositivo integrado.
import { NextRequest, NextResponse } from 'next/server'
import { login } from '@/lib/auth'
import {
  checkRateLimit,
  recordFailedAttempt,
  recordSuccessfulAttempt,
} from '@/lib/security/login-rate-limiter'
import { z } from 'zod'

const BodySchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1).max(100),
  deviceId: z.string().max(120).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const json = await req.json()
    const parsed = BodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Datos inválidos' }, { status: 400 })
    }

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown'
    const deviceId = parsed.data.deviceId

    // v1.0.17: verificar rate limit por IP + dispositivo antes de autenticar.
    const rateCheck = checkRateLimit(ip, deviceId)
    if (!rateCheck.ok) {
      const retryAfterSec = Math.ceil((rateCheck.retryAfterMs || 0) / 1000)
      return NextResponse.json(
        {
          ok: false,
          error: `Demasiados intentos fallidos. Intenta de nuevo en ${Math.ceil(retryAfterSec / 60)} minutos.`,
          reason: rateCheck.reason,
          retryAfter: retryAfterSec,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfterSec) },
        },
      )
    }

    const result = await login(parsed.data.username, parsed.data.password, ip)

    if (!result.ok) {
      // Registrar intento fallido para rate limiting.
      const failResult = recordFailedAttempt(ip, deviceId)
      if (!failResult.ok) {
        const retryAfterSec = Math.ceil((failResult.retryAfterMs || 0) / 1000)
        return NextResponse.json(
          {
            ok: false,
            error: `Demasiados intentos fallidos desde tu IP/dispositivo. Intenta en ${Math.ceil(retryAfterSec / 60)} minutos.`,
            reason: failResult.reason,
            retryAfter: retryAfterSec,
          },
          {
            status: 429,
            headers: { 'Retry-After': String(retryAfterSec) },
          },
        )
      }
      return NextResponse.json({ ok: false, error: result.error }, { status: 401 })
    }

    // Login exitoso: limpiar contadores de rate limit.
    recordSuccessfulAttempt(ip, deviceId)

    return NextResponse.json({
      ok: true,
      user: {
        id: result.user!.id,
        username: result.user!.username,
        role: result.user!.role,
        firstName: result.user!.firstName,
        lastName: result.user!.lastName,
        mustChangePass: result.mustChangePass,
      },
    })
  } catch (e: any) {
    console.error('login error', e)
    return NextResponse.json({ ok: false, error: 'Error interno del servidor' }, { status: 500 })
  }
}
