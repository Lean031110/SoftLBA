// GET /api/admin/clientes/[id] - Detalle
// PATCH /api/admin/clientes/[id] - Actualizar
// DELETE /api/admin/clientes/[id] - Eliminar
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

    const item = await db.customer.findUnique({ where: { id } })
    if (!item) {
      return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, item })
  } catch (e: any) {
    console.error('GET /api/admin/clientes/[id]', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

const PatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  phone: z.string().max(40).optional().or(z.literal('')),
  email: z.string().email().max(120).optional().or(z.literal('')),
  address: z.string().max(300).optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
  preferences: z.string().max(500).optional().or(z.literal('')),
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

    const existing = await db.customer.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })
    }

    const data: any = {}
    if (d.name !== undefined) data.name = d.name
    if (d.phone !== undefined) data.phone = d.phone || null
    if (d.email !== undefined) data.email = d.email || null
    if (d.address !== undefined) data.address = d.address || null
    if (d.notes !== undefined) data.notes = d.notes || null
    if (d.preferences !== undefined) data.preferences = d.preferences || null

    const updated = await db.customer.update({ where: { id }, data })

    await audit({
      userId: user.id,
      action: 'UPDATE',
      entity: 'customer',
      entityId: id,
      before: existing,
      after: updated,
    })

    return NextResponse.json({ ok: true, item: updated })
  } catch (e: any) {
    console.error('PATCH /api/admin/clientes/[id]', e)
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

    const existing = await db.customer.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })
    }

    await db.customer.delete({ where: { id } })

    await audit({
      userId: user.id,
      action: 'DELETE',
      entity: 'customer',
      entityId: id,
      before: existing,
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('DELETE /api/admin/clientes/[id]', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
