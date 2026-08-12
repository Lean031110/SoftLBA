// PATCH /api/cocina/orders/[id]/items/[itemId]/status - Cambiar estado de un item individual
// FIX 1: usa el state machine centralizado para validar transiciones
// FIX 3: cuando un item pasa a LISTO, llama automáticamente a consumeRecipe()
//        para descontar los ingredientes de la receta del inventario.
// v1.0-RC1-bloque1-2 (items 4, 7): el item debe pertenecer a SALON (targetAreaId).
//   consumeRecipe se ejecuta DENTRO de la misma transacción que el cambio de estado,
//   para que si falla el descuento de stock, el item NO se marque como LISTO.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { canTransitionItem, recalculateOrderStatus } from '@/lib/order-state-machine'
import { consumeRecipe, InsufficientStockError } from '@/lib/recipe-consumer'
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

    // v1.0-RC1-bloque1-2 (item 4): verificar que el item pertenece a SALON.
    const salonArea = await db.area.findUnique({ where: { code: 'SALON' } })
    if (!salonArea) {
      return NextResponse.json(
        { ok: false, error: 'No existe el área SALON configurada' },
        { status: 500 },
      )
    }
    if (item.targetAreaId && item.targetAreaId !== salonArea.id) {
      return NextResponse.json(
        { ok: false, error: 'Este item no pertenece a cocina (área SALON)' },
        { status: 403 },
      )
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

    // v1.0-RC1-bloque1-2 (item 7): transacción única con consumeRecipe incluido.
    let recipeResult: Awaited<ReturnType<typeof consumeRecipe>> | null = null
    try {
      await db.$transaction(async (tx) => {
        // 1. Actualizar el item al nuevo estado.
        await tx.orderItem.update({
          where: { id: itemId },
          data: { status: newStatus as any },
        })

        // 2. Si el nuevo estado es LISTO, consumir receta DENTRO de la transacción.
        //    Si consumeRecipe lanza (p.ej. InsufficientStockError), toda la transacción
        //    se revierte y el item NO queda marcado como LISTO.
        if (newStatus === 'LISTO') {
          recipeResult = await consumeRecipe(
            item.productId,
            item.quantity,
            item.targetAreaId || order.areaId,
            order.id,
            item.id,
            user.id,
            tx,
          )
        }

        // 3. Recalcular el estado del pedido a partir de los items (item 6).
        await recalculateOrderStatus(order.id, tx)
      })
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        return NextResponse.json(
          {
            ok: false,
            error: `No se pudo marcar como LISTO: stock insuficiente de ingredientes`,
            details: err.details,
          },
          { status: 400 },
        )
      }
      throw err
    }

    // Auditar la sincronización de receta (si hubo)
    if (newStatus === 'LISTO' && recipeResult) {
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
