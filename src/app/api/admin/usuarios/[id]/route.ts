// GET /api/admin/usuarios/[id]
// PATCH /api/admin/usuarios/[id] - editar
// DELETE /api/admin/usuarios/[id] - desactivar (no borrar)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'

const ROLES = ['ADMIN', 'MESERO', 'COCINA', 'PIZZERIA', 'CAJERO'] as const

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    const { id } = await params
    const found = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        mustChangePass: true,
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
        updatedAt: true,
        profile: true,
        sessions: {
          where: { expiresAt: { gt: new Date() } },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, ipAddress: true, userAgent: true, createdAt: true, expiresAt: true },
        },
      },
    })
    if (!found) return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })

    // Obtener historial de accesos (login/logout) de los últimos 30 días
    const accessHistory = await db.auditLog.findMany({
      where: {
        userId: id,
        action: { in: ['LOGIN', 'LOGOUT'] },
        createdAt: { gt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        action: true,
        ipAddress: true,
        userAgent: true,
        result: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ ok: true, item: found, accessHistory })
  } catch (e: any) {
    console.error('GET /api/admin/usuarios/[id]', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

const PatchSchema = z.object({
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  role: z.enum(ROLES).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(40).optional().or(z.literal('')),
  mobile: z.string().max(40).optional().or(z.literal('')),
  address: z.string().max(200).optional().or(z.literal('')),
  idNumber: z.string().max(40).optional().or(z.literal('')),
  bio: z.string().max(500).optional().or(z.literal('')),
  isActive: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    const { id } = await params
    const before = await db.user.findUnique({ where: { id } })
    if (!before) return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })

    const json = await req.json().catch(() => null)
    if (!json) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
    const parsed = PatchSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    }
    const d = parsed.data

    if (d.email) {
      const dup = await db.user.findFirst({ where: { email: d.email, NOT: { id } } })
      if (dup) return NextResponse.json({ ok: false, error: 'El email ya está en uso' }, { status: 400 })
    }

    const data: any = {}
    if (d.firstName !== undefined) data.firstName = d.firstName
    if (d.lastName !== undefined) data.lastName = d.lastName
    if (d.role !== undefined) data.role = d.role
    if (d.email !== undefined) data.email = d.email || null
    if (d.phone !== undefined) data.phone = d.phone || null
    if (d.mobile !== undefined) data.mobile = d.mobile || null
    if (d.address !== undefined) data.address = d.address || null
    if (d.idNumber !== undefined) data.idNumber = d.idNumber || null
    if (d.bio !== undefined) data.bio = d.bio || null
    if (d.isActive !== undefined) data.isActive = d.isActive

    const updated = await db.user.update({ where: { id }, data })

    await audit({
      userId: user.id,
      action: 'UPDATE',
      entity: 'user',
      entityId: id,
      before: {
        firstName: before.firstName,
        lastName: before.lastName,
        role: before.role,
        email: before.email,
        phone: before.phone,
        isActive: before.isActive,
      },
      after: {
        firstName: updated.firstName,
        lastName: updated.lastName,
        role: updated.role,
        email: updated.email,
        phone: updated.phone,
        isActive: updated.isActive,
      },
    })

    return NextResponse.json({ ok: true, item: { id: updated.id, username: updated.username } })
  } catch (e: any) {
    console.error('PATCH /api/admin/usuarios/[id]', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    const { id } = await params
    const before = await db.user.findUnique({ where: { id } })
    if (!before) return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })

    if (id === user.id) {
      return NextResponse.json({ ok: false, error: 'No puedes desactivar tu propio usuario' }, { status: 400 })
    }

    const updated = await db.user.update({ where: { id }, data: { isActive: false } })

    await audit({
      userId: user.id,
      action: 'DEACTIVATE',
      entity: 'user',
      entityId: id,
      before: { username: before.username, isActive: before.isActive },
      after: { username: updated.username, isActive: false },
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('DELETE /api/admin/usuarios/[id]', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
