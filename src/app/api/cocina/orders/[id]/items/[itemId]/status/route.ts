// PATCH /api/cocina/orders/[id]/items/[itemId]/status - Cambiar estado de un item individual
// FIX 1: usa el state machine centralizado para validar transiciones
// FIX 3: cuando un item pasa a LISTO, llama automáticamente a consumeRecipe()
//        para descontar los ingredientes de la receta del inventario.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { canTransitionItem } from '@/lib/order-state-machine'
import { consumeRecipe } from '@/lib/recipe-consumer'
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

    const newStatus = parsed.data.status as 'EN_PREPARACION' | 'LISTO'

    // FIX 1: validar transición con el state machine
    if (!canTransitionItem(item.status, newStatus)) {
      return NextResponse.json(
        { ok: false, error: `No se puede pasar el item de ${item.status} a ${newStatus}` },
        { status: 400 },
      )
    }

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

    // FIX 3: consumir receta automáticamente cuando el item pasa a LISTO.
    // Se hace FUERA de la transacción anterior para no bloquearla.
    // consumeRecipe es idempotente, así que aunque se invoque varias
    // veces no descuenta dos veces.
    let recipeResult: { ok: boolean; alerts?: string[]; deductionsCount?: number } | null = null
    if (newStatus === 'LISTO') {
      try {
        recipeResult = await consumeRecipe(
          item.productId,
          item.quantity,
          item.targetAreaId || order.areaId,
          order.id,
          item.id,
          user.id,
        )
        await audit({
          userId: user.id,
          action: 'SYNC_RECIPE',
          entity: 'order-item',
          entityId: itemId,
          result: (recipeResult?.alerts?.length ?? 0) > 0 ? 'ALERT' : 'SUCCESS',
          after: {
            orderId: order.id,
            orderNumber: order.number,
            itemId,
            productId: item.productId,
            deductionsCount: recipeResult?.deductionsCount ?? 0,
            alertsCount: recipeResult?.alerts?.length ?? 0,
            alerts: recipeResult?.alerts ?? [],
          },
        })
      } catch (err) {
        console.error('consumeRecipe failed', err)
        // No bloqueamos el cambio de estado del item por un fallo de inventario.
      }
    }

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
      recipeSync: recipeResult,
    })
  } catch (e: any) {
    console.error('PATCH item status', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
