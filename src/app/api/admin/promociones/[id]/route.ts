// GET /api/admin/promociones/[id] - Detalle
// PATCH /api/admin/promociones/[id] - Actualizar
// DELETE /api/admin/promociones/[id] - Eliminar
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const item = await db.promotion.findUnique({ where: { id } })
    if (!item) {
      return NextResponse.json({ ok: false, error: 'No encontrada' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, item })
  } catch (e: any) {
    console.error('GET /api/admin/promociones/[id]', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

const PatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional().or(z.literal('')),
  type: z.enum(['GENERAL', 'CLIENTE', 'PRODUCTO']).optional(),
  discountPct: z.coerce.number().min(0).max(100).optional(),
  discountAmount: z.coerce.number().min(0).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional().or(z.literal('')),
  isActive: z.boolean().optional(),
  customerId: z.string().optional().or(z.literal('')),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const json = await req.json().catch(() => null)
    if (!json) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
    const parsed = PatchSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    }
    const d = parsed.data

    const existing = await db.promotion.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'No encontrada' }, { status: 404 })
    }

    const data: any = {}
    if (d.name !== undefined) data.name = d.name
    if (d.description !== undefined) data.description = d.description || null
    if (d.type !== undefined) data.type = d.type
    if (d.discountPct !== undefined) data.discountPct = d.discountPct
    if (d.discountAmount !== undefined) data.discountAmount = d.discountAmount
    if (d.startDate !== undefined) data.startDate = new Date(d.startDate + 'T00:00:00')
    if (d.endDate !== undefined) data.endDate = d.endDate ? new Date(d.endDate + 'T23:59:59') : null
    if (d.isActive !== undefined) data.isActive = d.isActive
    if (d.customerId !== undefined) data.customerId = d.customerId || null

    const updated = await db.promotion.update({ where: { id }, data })

    await audit({
      userId: user.id,
      action: 'UPDATE',
      entity: 'promotion',
      entityId: id,
      before: existing,
      after: updated,
    })

    return NextResponse.json({ ok: true, item: updated })
  } catch (e: any) {
    console.error('PATCH /api/admin/promociones/[id]', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const existing = await db.promotion.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'No encontrada' }, { status: 404 })
    }

    // Soft delete: desactivar en lugar de borrar el registro (trazabilidad)
    const updated = await db.promotion.update({
      where: { id },
      data: { isActive: false },
    })

    await audit({
      userId: user.id,
      action: 'DEACTIVATE',
      entity: 'promotion',
      entityId: id,
      before: { name: existing.name, isActive: existing.isActive },
      after: { name: updated.name, isActive: false },
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('DELETE /api/admin/promociones/[id]', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
