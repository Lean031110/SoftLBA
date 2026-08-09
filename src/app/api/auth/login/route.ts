// POST /api/auth/login
import { NextRequest, NextResponse } from 'next/server'
import { login } from '@/lib/auth'
import { z } from 'zod'

const BodySchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1).max(100),
})

export async function POST(req: NextRequest) {
  try {
    const json = await req.json()
    const parsed = BodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Datos inválidos' }, { status: 400 })
    }

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const result = await login(parsed.data.username, parsed.data.password, ip)

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 401 })
    }

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
