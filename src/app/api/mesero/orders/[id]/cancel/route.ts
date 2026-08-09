// POST /api/mesero/orders/[id]/cancel - Cancelar pedido
// Reglas: se puede cancelar si ningún item está en preparación o más avanzado
//         lo cancelado se guarda como cancelado (trazabilidad)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
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
      include: { items: true, area: true },
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

      // Devolver stock de productos DIRECTO al área correspondiente
      // Solo para items que no estaban cancelados ya
      for (const it of order.items) {
        if (it.status === 'CANCELADO') continue
        const product = await tx.product.findUnique({ where: { id: it.productId } })
        if (!product || product.type !== 'DIRECTO') continue

        // Buscar en el área primero
        const areaInv = await tx.areaInventory.findUnique({
          where: { areaId_productId: { areaId: order.areaId, productId: product.id } },
        })
        if (areaInv) {
          await tx.areaInventory.update({
            where: { id: areaInv.id },
            data: { stock: areaInv.stock + it.quantity },
          })
          await tx.stockMovement.create({
            data: {
              type: 'ENTRADA',
              productId: product.id,
              areaId: order.areaId,
              quantity: it.quantity,
              unit: product.unit,
              reason: `Devolución por cancelación de pedido #${order.number}`,
              reference: order.id,
              userId: user.id,
            },
          })
        } else {
          // Sino al inventario general
          const genInv = await tx.inventoryItem.findUnique({ where: { productId: product.id } })
          if (genInv) {
            await tx.inventoryItem.update({
              where: { id: genInv.id },
              data: { stock: genInv.stock + it.quantity },
            })
            await tx.stockMovement.create({
              data: {
                type: 'ENTRADA',
                productId: product.id,
                areaId: null,
                quantity: it.quantity,
                unit: product.unit,
                reason: `Devolución por cancelación de pedido #${order.number}`,
                reference: order.id,
                userId: user.id,
              },
            })
          }
        }

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
