// GET /api/auth/profile - Devuelve perfil completo del usuario actual
// PATCH /api/auth/profile - Actualiza perfil del usuario actual
// FASE 3: logger estructurado.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    }

    const fullUser = await db.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        phone: true,
        mobile: true,
        address: true,
        idNumber: true,
        bio: true,
        avatarUrl: true,
        lastLoginAt: true,
        lastLoginIp: true,
        createdAt: true,
        profile: true,
      },
    })

    if (!fullUser) {
      return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, user: fullUser })
  } catch (e: any) {
    logger.error('profile GET error', { err: (e as Error)?.message }, 'auth')
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

const UpdateSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().max(50).optional().nullable(),
  mobile: z.string().max(50).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  idNumber: z.string().max(50).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
  avatarUrl: z.string().max(500).optional().nullable(),
  email: z.string().email().max(200).optional().nullable(),
})

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const data: any = {}
    for (const [k, v] of Object.entries(parsed.data)) {
      if (v !== undefined) {
        // Convertir string vacío a null para campos opcionales
        if (typeof v === 'string' && v === '' && ['phone', 'mobile', 'address', 'idNumber', 'bio', 'avatarUrl', 'email'].includes(k)) {
          data[k] = null
        } else {
          data[k] = v
        }
      }
    }

    // Verificar email único si se está cambiando
    if (data.email) {
      const existing = await db.user.findFirst({
        where: { email: data.email, NOT: { id: user.id } },
      })
      if (existing) {
        return NextResponse.json({ ok: false, error: 'El correo ya está en uso' }, { status: 400 })
      }
    }

    const before = await db.user.findUnique({ where: { id: user.id } })
    const updated = await db.user.update({
      where: { id: user.id },
      data: data,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        phone: true,
        mobile: true,
        address: true,
        idNumber: true,
        bio: true,
        avatarUrl: true,
        lastLoginAt: true,
        lastLoginIp: true,
      },
    })

    await audit({
      userId: user.id,
      action: 'UPDATE_PROFILE',
      entity: 'user',
      entityId: user.id,
      before: before ? {
        firstName: before.firstName,
        lastName: before.lastName,
        phone: before.phone,
        mobile: before.mobile,
        address: before.address,
        idNumber: before.idNumber,
        bio: before.bio,
        email: before.email,
      } : null,
      after: data,
      result: 'SUCCESS',
    })

    return NextResponse.json({ ok: true, user: updated })
  } catch (e: any) {
    logger.error('profile PATCH error', { err: (e as Error)?.message }, 'auth')
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
