// POST /api/mesero/orders/[id]/cancel - Cancelar pedido
// Reglas: se puede cancelar si ningún item está en preparación o más avanzado
//         lo cancelado se guarda como cancelado (trazabilidad)
//
// v1.0.17 (CONSOLIDACIÓN): usa InventoryService.returnStock() para devolver
// stock de productos DIRECTO. Ya no hay lógica de inventario inline.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { InventoryService } from '@/lib/inventory/inventory-service'
import { z } from 'zod'

const CancelSchema = z.object({
  reason: z.string().max(300).optional().or(z.literal('')),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN', 'MESERO', 'MESERO_PRO'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    const { id } = await params

    const order = await db.order.findUnique({
      where: { id },
      include: { items: { include: { product: true } }, area: true },
    })
    if (!order) {
      return NextResponse.json({ ok: false, error: 'Pedido no encontrado' }, { status: 404 })
    }
    if (user.role !== 'ADMIN' && order.userId !== user.id) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    if (['CANCELADO', 'COBRADO', 'ARCHIVADO'].includes(order.status)) {
      return NextResponse.json(
        { ok: false, error: `No se puede cancelar un pedido ${order.status.toLowerCase()}` },
        { status: 400 },
      )
    }

    // Verificar que NINGÚN item esté en preparación o más avanzado
    const activeItems = order.items.filter(
      (it) => it.status !== 'CANCELADO' && it.status !== 'PENDIENTE',
    )
    if (activeItems.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `No se puede cancelar el pedido porque ${activeItems.length} item(s) ya están en preparación o listos. Cancela los items pendientes individualmente.`,
        },
        { status: 400 },
      )
    }

    const json = await req.json().catch(() => ({}))
    const parsed = CancelSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' },
        { status: 400 },
      )
    }
    const reason = parsed.data.reason || 'Cancelado por mesero'

    // Transacción: marcar cancelado, devolver stock directo y registrar movimiento
    const updated = await db.$transaction(async (tx) => {
      const before = { status: order.status, paymentStatus: order.paymentStatus }
      const upd = await tx.order.update({
        where: { id },
        data: {
          status: 'CANCELADO',
          closedAt: new Date(),
          notes: order.notes ? `${order.notes}\n[CANCELADO] ${reason}` : `[CANCELADO] ${reason}`,
        },
      })

      // v1.0-RC1-bloque1-2 (item 12): liberar mesa asociada al pedido.
      if (order.tableId) {
        await tx.table.update({
          where: { id: order.tableId },
          data: { status: 'LIBRE' },
        })
      }

      // v1.0.17: usar InventoryService.returnStock() para devolver stock DIRECTO.
      // Ya no hay lógica inline de inventario.
      for (const it of order.items) {
        if (it.status === 'CANCELADO') continue
        if (it.product.type !== 'DIRECTO') continue

        await InventoryService.returnStock({
          areaId: order.areaId,
          productId: it.productId,
          quantity: it.quantity,
          options: {
            orderNumber: order.number,
            reference: order.id,
            userId: user.id,
            unit: it.product.unit,
          },
          tx,
        })

        // Marcar item como cancelado
        await tx.orderItem.update({
          where: { id: it.id },
          data: { status: 'CANCELADO' },
        })
      }

      return { upd, before }
    })

    await audit({
      userId: user.id,
      action: 'CANCEL',
      entity: 'order',
      entityId: order.id,
      before: updated.before,
      after: { status: 'CANCELADO', reason },
    })

    return NextResponse.json({
      ok: true,
      item: updated.upd,
      wsPayload: {
        orderId: order.id,
        orderNumber: order.number,
        userId: order.userId,
        areaId: order.areaId,
        status: 'CANCELADO',
      },
    })
  } catch (e: any) {
    console.error('POST /api/mesero/orders/[id]/cancel', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
