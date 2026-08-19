// POST /api/admin/inventario/physical-stock - Registrar conteo físico de un área
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'

const ItemSchema = z.object({
  productId: z.string().min(1),
  countedQty: z.coerce.number(),
  observation: z.string().max(300).optional().or(z.literal('')),
})

const PhysicalSchema = z.object({
  areaId: z.string().min(1),
  items: z.array(ItemSchema).min(1),
})

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN', 'COCINA', 'PIZZERIA'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const json = await req.json().catch(() => null)
    if (!json) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
    const parsed = PhysicalSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    }
    const d = parsed.data

    const area = await db.area.findUnique({ where: { id: d.areaId } })
    if (!area) {
      return NextResponse.json({ ok: false, error: 'Área no encontrada' }, { status: 404 })
    }

    // Crear los registros de PhysicalStock
    const created = await db.$transaction(async (tx) => {
      const items: any[] = []
      for (const it of d.items) {
        const current = await tx.areaInventory.findUnique({
          where: { areaId_productId: { areaId: d.areaId, productId: it.productId } },
        })
        const observedQty = current?.stock ?? 0
        const item = await tx.physicalStock.create({
          data: {
            productId: it.productId,
            areaId: d.areaId,
            countedQty: it.countedQty,
            observedQty,
            observation: it.observation || null,
            userId: user.id,
          },
        })
        items.push(item)
      }
      return items
    })

    await audit({
      userId: user.id,
      action: 'PHYSICAL_STOCK',
      entity: 'physical-stock',
      entityId: d.areaId,
      after: { area: area.name, count: created.length },
    })

    return NextResponse.json({ ok: true, count: created.length })
  } catch (e: any) {
    console.error('POST /api/admin/inventario/physical-stock', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
