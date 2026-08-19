// src/app/api/mesero/orders/[id]/items/[itemId]/serve/route.ts
// FASE 5 — Confirmar servido para producto DIRECTO.

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { recalculateOrderStatus } from '@/lib/order-state-machine'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const { id: orderId, itemId } = await params
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN', 'MESERO', 'MESERO_PRO'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const item = await db.orderItem.findUnique({
      where: { id: itemId },
      include: { order: true, product: { select: { name: true } } },
    })
    if (!item) return NextResponse.json({ ok: false, error: 'Item no encontrado' }, { status: 404 })
    if (item.orderId !== orderId) return NextResponse.json({ ok: false, error: 'Item no pertenece al pedido' }, { status: 400 })

    if (!['LISTO', 'DESPACHADO', 'SERVIDO'].includes(item.status)) {
      return NextResponse.json({ ok: false, error: `No se puede marcar como servido: el item está ${item.status}` }, { status: 400 })
    }
    if (item.status === 'SERVIDO') {
      return NextResponse.json({ ok: true, item, alreadyServed: true })
    }

    const updated = await db.orderItem.update({
      where: { id: itemId },
      data: { status: 'SERVIDO' },
    })

    const finalStatus = await recalculateOrderStatus(orderId).catch((err) => {
      logger.warn('recalculateOrderStatus falló tras servir item', { err: (err as Error)?.message, orderId }, 'orders')
      return item.order.status
    })

    await audit({
      userId: user.id,
      action: 'ITEM_SERVED',
      entity: 'order-item',
      entityId: itemId,
      after: { orderId, itemId, status: 'SERVIDO', orderStatus: finalStatus, productName: item.product.name },
    })

    logger.info('Item servido', { orderId, itemId, orderStatus: finalStatus }, 'orders')

    return NextResponse.json({ ok: true, item: updated, orderStatus: finalStatus })
  } catch (e: any) {
    logger.error('POST serve item', { err: (e as Error)?.message }, 'api')
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
