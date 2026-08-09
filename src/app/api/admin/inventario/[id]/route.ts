// GET /api/admin/inventario/[id] - Detalle del item
// PATCH /api/admin/inventario/[id] - Ajustar stock
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
    if (!['ADMIN', 'COCINA', 'PIZZERIA'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const item = await db.areaInventory.findUnique({
      where: { id },
      include: { product: true, area: true },
    })
    if (!item) {
      return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })
    }

    const movements = await db.stockMovement.findMany({
      where: { productId: item.productId, areaId: item.areaId },
      include: {
        user: { select: { id: true, username: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({ ok: true, item, movements })
  } catch (e: any) {
    console.error('GET /api/admin/inventario/[id]', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

const PatchSchema = z.object({
  stock: z.coerce.number(),
  reason: z.string().max(300).optional().or(z.literal('')),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN', 'COCINA', 'PIZZERIA'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const json = await req.json().catch(() => null)
    if (!json) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
    const parsed = PatchSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    }
    const d = parsed.data

    const item = await db.areaInventory.findUnique({
      where: { id },
      include: { product: true, area: true },
    })
    if (!item) {
      return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })
    }

    const before = item.stock
    const diff = d.stock - before

    await db.$transaction(async (tx) => {
      await tx.areaInventory.update({
        where: { id },
        data: { stock: d.stock },
      })
      await tx.stockMovement.create({
        data: {
          type: 'AJUSTE',
          productId: item.productId,
          areaId: item.areaId,
          quantity: diff,
          unit: item.product.unit,
          reason: d.reason || 'Ajuste manual',
          userId: user.id,
        },
      })
    })

    await audit({
      userId: user.id,
      action: 'AREA_STOCK_ADJUST',
      entity: 'area-inventory',
      entityId: id,
      before: { stock: before },
      after: { stock: d.stock },
    })

    const updated = await db.areaInventory.findUnique({
      where: { id },
      include: { product: true, area: true },
    })

    return NextResponse.json({ ok: true, item: updated })
  } catch (e: any) {
    console.error('PATCH /api/admin/inventario/[id]', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
