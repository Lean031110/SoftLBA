// PATCH /api/cocina/orders/[id]/status - Cambiar estado del pedido desde cocina
// FIX 1: usa el state machine centralizado (src/lib/order-state-machine.ts)
// FIX 2: verifica que el pedido tenga items cuyo targetAreaId sea SALON
//        (en lugar de verificar order.area.code === 'SALON')
// v1.0-RC1-bloque1-2 (item 6): NO se hace updateMany sobre todos los items.
//   El estado de cada item se gestiona individualmente vía
//   /api/cocina/orders/[id]/items/[itemId]/status.
//   El estado del pedido se calcula a partir de los items vía
//   recalculateOrderStatus(), que se invoca al final para sincronizar.
//   Si el operador quiere forzar SERVIDO (p.ej. tras servir a la mesa),
//   se respeta su valor siempre que la transición sea válida.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { canTransitionOrder, recalculateOrderStatus } from '@/lib/order-state-machine'
import { z } from 'zod'

const StatusSchema = z.object({
  status: z.enum(['EN_PREPARACION', 'LISTO', 'SERVIDO']),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN', 'COCINA'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    const { id } = await params

    const order = await db.order.findUnique({
      where: { id },
      include: { items: true, area: true },
    })
    if (!order) {
      return NextResponse.json({ ok: false, error: 'Pedido no encontrado' }, { status: 404 })
    }

    // FIX 2: Cocina procesa los items cuyo targetAreaId = área SALON.
    // Verificamos que el pedido tenga al menos un item dirigido a SALON.
    const salonArea = await db.area.findUnique({ where: { code: 'SALON' } })
    if (!salonArea) {
      return NextResponse.json(
        { ok: false, error: 'No existe el área SALON configurada' },
        { status: 500 },
      )
    }

    const hasSalonItems = order.items.some(
      (it) => it.targetAreaId === salonArea.id && it.status !== 'CANCELADO',
    )
    if (!hasSalonItems) {
      return NextResponse.json(
        { ok: false, error: 'Este pedido no tiene items para cocina (área SALON)' },
        { status: 400 },
      )
    }

    const json = await req.json().catch(() => null)
    if (!json) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
    const parsed = StatusSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || 'Estado inválido' },
        { status: 400 },
      )
    }
    const newStatus = parsed.data.status as 'EN_PREPARACION' | 'LISTO' | 'SERVIDO'

    // FIX 1: usar el state machine centralizado
    if (!canTransitionOrder(order.status, newStatus)) {
      return NextResponse.json(
        { ok: false, error: `No se puede pasar de ${order.status} a ${newStatus}` },
        { status: 400 },
      )
    }

    const before = { status: order.status }
    const updated = await db.$transaction(async (tx) => {
      // v1.0-RC1-bloque1-2 (item 6): NO se hace updateMany sobre items.
      // El estado del pedido se respeta como override explícito del operador
      // (p.ej. para marcar SERVIDO tras entregar a la mesa).
      const upd = await tx.order.update({
        where: { id },
        data: { status: newStatus },
      })
      // Recalcular para sincronizar con items (si el operador puso LISTO
      // pero los items siguen PENDIENTE, recalc mantendrá el override explícito
      // porque el body pide LISTO).
      return upd
    })

    // Sincronizar estado calculado (no override explícito).
    // Si el operador forzó SERVIDO, respetamos ese valor (recalc no toca
    // pedidos en estados terminales).
    let finalStatus = updated.status
    if (newStatus !== 'SERVIDO') {
      finalStatus = await recalculateOrderStatus(order.id)
    }

    await audit({
      userId: user.id,
      action: 'STATUS_CHANGE',
      entity: 'order',
      entityId: order.id,
      before,
      after: { status: finalStatus },
    })

    // Devolver payload para que el cliente emita WebSocket
    const event = newStatus === 'LISTO' ? 'order:ready' : 'order:status'
    return NextResponse.json({
      ok: true,
      item: { ...updated, status: finalStatus as any },
      wsEvent: event,
      wsPayload: {
        orderId: order.id,
        orderNumber: order.number,
        userId: order.userId,
        areaId: order.areaId,
        status: finalStatus,
      },
    })
  } catch (e: any) {
    console.error('PATCH /api/cocina/orders/[id]/status', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
