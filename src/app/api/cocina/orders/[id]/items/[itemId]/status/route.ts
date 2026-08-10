// PATCH /api/cocina/orders/[id]/items/[itemId]/status - Cambiar estado de un item individual
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'

const ItemStatusSchema = z.object({
  status: z.enum(['EN_PREPARACION', 'LISTO']),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN', 'COCINA'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    const { id, itemId } = await params

    const order = await db.order.findUnique({
      where: { id },
      include: { items: true, area: true },
    })
    if (!order) return NextResponse.json({ ok: false, error: 'Pedido no encontrado' }, { status: 404 })

    const item = await db.orderItem.findFirst({ where: { id: itemId, orderId: id } })
    if (!item) return NextResponse.json({ ok: false, error: 'Item no encontrado' }, { status: 404 })
    if (item.status === 'CANCELADO') {
      return NextResponse.json({ ok: false, error: 'Item cancelado' }, { status: 400 })
    }

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
    const parsed = ItemStatusSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Estado inválido' }, { status: 400 })
    }

    const newStatus = parsed.data.status
    const before = { status: item.status }

    await db.$transaction(async (tx) => {
      // Actualizar el item
      await tx.orderItem.update({
        where: { id: itemId },
        data: { status: newStatus as any },
      })

      // Verificar si todos los items del área de cocina están listos
      const areaItems = order.items.filter(
        (it) => it.targetAreaId === order.areaId && it.status !== 'CANCELADO'
      )
      const allReady = areaItems.every(
        (it) => it.id === itemId ? newStatus === 'LISTO' : it.status === 'LISTO' || it.status === 'SERVIDO'
      )

      // Si algún item está en preparación, el pedido pasa a EN_PREPARACION
      if (newStatus === 'EN_PREPARACION' && order.status === 'ENVIADO') {
        await tx.order.update({ where: { id }, data: { status: 'EN_PREPARACION' } })
      }

      // Si todos los items de esta área están listos, verificar si todas las áreas terminaron
      if (allReady) {
        // Obtener todos los items del pedido (todas las áreas)
        const allItems = await tx.orderItem.findMany({
          where: { orderId: id, status: { not: 'CANCELADO' } },
        })
        const allItemsReady = allItems.every((it) => it.status === 'LISTO' || it.status === 'SERVIDO')

        if (allItemsReady) {
          await tx.order.update({ where: { id }, data: { status: 'LISTO' } })
        }
      }
    })

    await audit({
      userId: user.id,
      action: 'ITEM_STATUS_CHANGE',
      entity: 'order-item',
      entityId: itemId,
      before,
      after: { status: newStatus },
    })

    return NextResponse.json({
      ok: true,
      wsEvent: newStatus === 'LISTO' ? 'order:status' : 'order:status',
      wsPayload: {
        orderId: order.id,
        orderNumber: order.number,
        userId: order.userId,
        areaId: order.areaId,
        status: newStatus,
      },
    })
  } catch (e: any) {
    console.error('PATCH item status', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
