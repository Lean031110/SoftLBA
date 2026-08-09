// PATCH /api/pizzeria/orders/[id]/status - Cambiar estado del pedido desde pizzería
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'

const VALID_TRANSITIONS: Record<string, string[]> = {
  ENVIADO: ['EN_PREPARACION', 'LISTO'],
  EN_PREPARACION: ['LISTO'],
  LISTO: ['SERVIDO', 'EN_PREPARACION'],
  SERVIDO: [],
}

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
    if (!['ADMIN', 'PIZZERIA', 'COCINA'].includes(user.role)) {
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

    // Validar que sea del área pizzería
    if (order.area.code !== 'PIZZERIA') {
      return NextResponse.json(
        { ok: false, error: 'Este pedido no corresponde a pizzería' },
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
    const newStatus = parsed.data.status

    const allowed = VALID_TRANSITIONS[order.status] || []
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        { ok: false, error: `No se puede pasar de ${order.status} a ${newStatus}` },
        { status: 400 },
      )
    }

    const before = { status: order.status }
    const updated = await db.$transaction(async (tx) => {
      const upd = await tx.order.update({
        where: { id },
        data: { status: newStatus },
      })

      const newItemStatus =
        newStatus === 'EN_PREPARACION' ? 'EN_PREPARACION' :
        newStatus === 'LISTO' ? 'LISTO' :
        newStatus === 'SERVIDO' ? 'SERVIDO' : 'PENDIENTE'

      if (newItemStatus !== 'PENDIENTE') {
        await tx.orderItem.updateMany({
          where: { orderId: order.id, status: { not: 'CANCELADO' } },
          data: { status: newItemStatus as any },
        })
      }

      return upd
    })

    await audit({
      userId: user.id,
      action: 'STATUS_CHANGE',
      entity: 'order',
      entityId: order.id,
      before,
      after: { status: newStatus },
    })

    const event = newStatus === 'LISTO' ? 'order:ready' : 'order:status'
    return NextResponse.json({
      ok: true,
      item: updated,
      wsEvent: event,
      wsPayload: {
        orderId: order.id,
        orderNumber: order.number,
        userId: order.userId,
        areaId: order.areaId,
        status: newStatus,
      },
    })
  } catch (e: any) {
    console.error('PATCH /api/pizzeria/orders/[id]/status', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
