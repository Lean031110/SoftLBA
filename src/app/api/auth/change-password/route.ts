// POST /api/auth/change-password
// Permite cambiar la contraseña (requiere sesión activa)
// Si mustChangePass=true, debe usarse para completar el primer acceso
// FASE 3: logger estructurado con redacción de secretos.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser, hashPassword, verifyPassword } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { kickUser } from '@/lib/realtime-emitter'

const BodySchema = z.object({
  currentPassword: z.string().min(1).max(100),
  newPassword: z.string().min(6).max(100),
})

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { currentPassword, newPassword } = parsed.data

    // Validar longitud mínima de la nueva contraseña
    if (newPassword.length < 6) {
      return NextResponse.json(
        { ok: false, error: 'La nueva contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      )
    }

    // Obtener user completo para verificar hash
    const fullUser = await db.user.findUnique({ where: { id: user.id } })
    if (!fullUser) {
      return NextResponse.json({ ok: false, error: 'Usuario no encontrado' }, { status: 404 })
    }

    // Verificar contraseña actual
    const valid = await verifyPassword(currentPassword, fullUser.passwordHash)
    if (!valid) {
      return NextResponse.json({ ok: false, error: 'Contraseña actual incorrecta' }, { status: 400 })
    }

    // No permitir misma contraseña
    if (currentPassword === newPassword) {
      return NextResponse.json(
        { ok: false, error: 'La nueva contraseña no puede ser igual a la actual' },
        { status: 400 }
      )
    }

    // Hashear y actualizar
    const newHash = await hashPassword(newPassword)
    // FASE 8: incrementar authVersion para invalidar tokens/sessions existentes.
    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        mustChangePass: false,
        authVersion: { increment: 1 },
      },
    })

    // FASE 8: kick inmediato de sockets existentes (no esperar expiración).
    // Fire-and-forget: si el realtime está caído, el cambio de authVersion
    // igual invalidará en el próximo handshake.
    kickUser(user.id, `password_changed (authVersion=${updated.authVersion})`).catch(() => {})

    await audit({
      userId: user.id,
      action: 'CHANGE_PASSWORD',
      entity: 'user',
      entityId: user.id,
      before: { mustChangePass: fullUser.mustChangePass },
      after: { mustChangePass: false, authVersion: updated.authVersion },
      result: 'SUCCESS',
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    logger.error('Change password error', { err: e?.message, stack: e?.stack }, 'auth')
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
