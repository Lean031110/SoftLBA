// POST /api/admin/usuarios/[id]/reset-password - resetear contraseña
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hashPassword, generateRandomPassword } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'

const BodySchema = z.object({
  password: z.string().min(6).max(50).optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    const { id } = await params
    const before = await db.user.findUnique({ where: { id }, select: { id: true, username: true, mustChangePass: true } })
    if (!before) return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })

    const json = await req.json().catch(() => ({}))
    const parsed = BodySchema.safeParse(json || {})
    const plainPassword = (parsed.success && parsed.data.password?.trim()) || generateRandomPassword(10)
    const passwordHash = await hashPassword(plainPassword)

    await db.user.update({
      where: { id },
      data: {
        passwordHash,
        mustChangePass: true,
        failedAttempts: 0,
        lockedUntil: null,
      },
    })

    await audit({
      userId: user.id,
      action: 'RESET_PASSWORD',
      entity: 'user',
      entityId: id,
      before: { username: before.username, mustChangePass: before.mustChangePass },
      after: { username: before.username, mustChangePass: true },
    })

    return NextResponse.json({ ok: true, password: plainPassword })
  } catch (e: any) {
    console.error('POST /api/admin/usuarios/[id]/reset-password', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
