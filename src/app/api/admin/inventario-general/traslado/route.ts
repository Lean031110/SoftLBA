// POST /api/admin/inventario-general/traslado - Trasladar stock de general a un área
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'

const TrasladoSchema = z.object({
  productId: z.string().min(1),
  areaId: z.string().min(1),
  quantity: z.coerce.number().positive('Cantidad debe ser positiva'),
  reason: z.string().max(300).optional().or(z.literal('')),
})

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const json = await req.json().catch(() => null)
    if (!json) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
    const parsed = TrasladoSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    }
    const d = parsed.data

    const item = await db.inventoryItem.findUnique({
      where: { productId: d.productId },
      include: { product: true },
    })
    if (!item) {
      return NextResponse.json({ ok: false, error: 'Producto sin inventario general' }, { status: 404 })
    }
    if (item.stock < d.quantity) {
      return NextResponse.json({ ok: false, error: 'Stock insuficiente en inventario general' }, { status: 400 })
    }

    const area = await db.area.findUnique({ where: { id: d.areaId } })
    if (!area) {
      return NextResponse.json({ ok: false, error: 'Área no encontrada' }, { status: 404 })
    }

    await db.$transaction(async (tx) => {
      await tx.inventoryItem.update({
        where: { productId: d.productId },
        data: { stock: { decrement: d.quantity } },
      })

      const existing = await tx.areaInventory.findUnique({
        where: { areaId_productId: { areaId: d.areaId, productId: d.productId } },
      })
      if (existing) {
        await tx.areaInventory.update({
          where: { id: existing.id },
          data: { stock: { increment: d.quantity } },
        })
      } else {
        await tx.areaInventory.create({
          data: {
            areaId: d.areaId,
            productId: d.productId,
            stock: d.quantity,
            minStock: 0,
          },
        })
      }

      await tx.stockMovement.create({
        data: {
          type: 'TRASLADO',
          productId: d.productId,
          areaId: d.areaId,
          quantity: d.quantity,
          unit: item.product.unit,
          reason: d.reason || `Traslado a ${area.name}`,
          reference: area.code,
          userId: user.id,
        },
      })
    })

    await audit({
      userId: user.id,
      action: 'TRASLADO',
      entity: 'inventory',
      entityId: d.productId,
      after: { to: area.name, qty: d.quantity },
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('POST /api/admin/inventario-general/traslado', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
