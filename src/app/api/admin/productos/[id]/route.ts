// GET /api/admin/productos/[id]
// PATCH /api/admin/productos/[id] - editar o toggle
// DELETE /api/admin/productos/[id] - desactivar (isActive=false)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'

const TYPES = ['DIRECTO', 'FINAL', 'SUBPRODUCTO'] as const

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    const { id } = await params
    const found = await db.product.findUnique({ where: { id } })
    if (!found) return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })
    return NextResponse.json({ ok: true, item: found })
  } catch (e: any) {
    console.error('GET /api/admin/productos/[id]', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

const PatchSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional().or(z.literal('')),
  type: z.enum(TYPES).optional(),
  category: z.string().max(80).optional().or(z.literal('')),
  unit: z.string().min(1).max(40).optional(),
  cost: z.coerce.number().min(0).optional(),
  price: z.coerce.number().min(0).optional(),
  minStock: z.coerce.number().min(0).optional(),
  isActive: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  imageUrl: z.string().max(500).optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
  areaId: z.string().optional().or(z.literal('')),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    const { id } = await params
    const before = await db.product.findUnique({ where: { id } })
    if (!before) return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })

    const json = await req.json().catch(() => null)
    if (!json) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
    const parsed = PatchSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    }
    const d = parsed.data

    if (d.code && d.code !== before.code) {
      const dup = await db.product.findUnique({ where: { code: d.code } })
      if (dup) return NextResponse.json({ ok: false, error: 'El código ya existe' }, { status: 400 })
    }

    const data: any = {}
    for (const [k, v] of Object.entries(d)) {
      if (v !== undefined) {
        if (v === '' && ['description', 'category', 'imageUrl', 'notes', 'areaId'].includes(k)) {
          data[k] = null
        } else {
          data[k] = v
        }
      }
    }

    const updated = await db.product.update({ where: { id }, data })

    await audit({
      userId: user.id,
      action: 'UPDATE',
      entity: 'product',
      entityId: id,
      before: {
        code: before.code, name: before.name, type: before.type,
        price: before.price, cost: before.cost,
        isActive: before.isActive, isAvailable: before.isAvailable,
      },
      after: {
        code: updated.code, name: updated.name, type: updated.type,
        price: updated.price, cost: updated.cost,
        isActive: updated.isActive, isAvailable: updated.isAvailable,
      },
    })

    return NextResponse.json({ ok: true, item: updated })
  } catch (e: any) {
    console.error('PATCH /api/admin/productos/[id]', e)
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
    const before = await db.product.findUnique({ where: { id } })
    if (!before) return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })

    const updated = await db.product.update({ where: { id }, data: { isActive: false } })

    await audit({
      userId: user.id,
      action: 'DEACTIVATE',
      entity: 'product',
      entityId: id,
      before: { code: before.code, name: before.name, isActive: before.isActive },
      after: { code: updated.code, name: updated.name, isActive: false },
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('DELETE /api/admin/productos/[id]', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
