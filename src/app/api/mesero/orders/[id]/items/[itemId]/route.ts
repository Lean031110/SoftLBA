// PATCH /api/mesero/orders/[id]/items/[itemId] - Editar cantidad/notas de un item
//   - Solo si el item no está en preparación (PENDIENTE)
// DELETE /api/mesero/orders/[id]/items/[itemId] - Cancelar item
//   - Solo si el item está PENDIENTE (no en preparación)
//   - El item se marca como CANCELADO, NO se borra (trazabilidad)
//   - Recalcula totales del pedido
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'

const PatchItemSchema = z.object({
  quantity: z.coerce.number().positive().optional(),
  notes: z.string().max(300).optional().or(z.literal('')),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN', 'MESERO', 'MESERO_PRO'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    const { id, itemId } = await params

    const order = await db.order.findUnique({ where: { id } })
    if (!order) return NextResponse.json({ ok: false, error: 'Pedido no encontrado' }, { status: 404 })
    if (user.role !== 'ADMIN' && order.userId !== user.id) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    if (['CANCELADO', 'COBRADO', 'ARCHIVADO'].includes(order.status)) {
      return NextResponse.json(
        { ok: false, error: 'No se puede editar items de un pedido cancelado/cobrado' },
        { status: 400 },
      )
    }

    const item = await db.orderItem.findFirst({ where: { id: itemId, orderId: id } })
    if (!item) return NextResponse.json({ ok: false, error: 'Item no encontrado' }, { status: 404 })

    // Solo se puede editar si el item está PENDIENTE
    if (item.status !== 'PENDIENTE') {
      return NextResponse.json(
        { ok: false, error: `No se puede editar un item en estado ${item.status}` },
        { status: 400 },
      )
    }

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
    const parsed = PatchItemSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' },
        { status: 400 },
      )
    }
    const d = parsed.data
    const before = { quantity: item.quantity, notes: item.notes }

    const data: any = {}
    if (d.quantity !== undefined) data.quantity = d.quantity
    if (d.notes !== undefined) data.notes = d.notes || null

    const updated = await db.orderItem.update({ where: { id: itemId }, data })

    // Recalcular totales del pedido
    await recalcOrderTotals(id)

    await audit({
      userId: user.id,
      action: 'UPDATE_ORDER_ITEM',
      entity: 'order-item',
      entityId: itemId,
      before,
      after: data,
    })

    return NextResponse.json({ ok: true, item: updated })
  } catch (e: any) {
    console.error('PATCH /api/mesero/orders/[id]/items/[itemId]', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN', 'MESERO', 'MESERO_PRO'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    const { id, itemId } = await params

    const order = await db.order.findUnique({ where: { id } })
    if (!order) return NextResponse.json({ ok: false, error: 'Pedido no encontrado' }, { status: 404 })
    if (user.role !== 'ADMIN' && order.userId !== user.id) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    if (['CANCELADO', 'COBRADO', 'ARCHIVADO'].includes(order.status)) {
      return NextResponse.json(
        { ok: false, error: 'No se puede cancelar items de un pedido cancelado/cobrado' },
        { status: 400 },
      )
    }

    const item = await db.orderItem.findFirst({ where: { id: itemId, orderId: id } })
    if (!item) return NextResponse.json({ ok: false, error: 'Item no encontrado' }, { status: 404 })

    // Solo se puede cancelar si está PENDIENTE (no en preparación)
    if (item.status !== 'PENDIENTE') {
      return NextResponse.json(
        { ok: false, error: `No se puede cancelar un item en estado ${item.status}. Ya está en preparación.` },
        { status: 400 },
      )
    }

    // Soft delete: marcar como CANCELADO, no borrar
    const updated = await db.orderItem.update({
      where: { id: itemId },
      data: { status: 'CANCELADO' },
    })

    // Recalcular totales
    await recalcOrderTotals(id)

    await audit({
      userId: user.id,
      action: 'CANCEL_ORDER_ITEM',
      entity: 'order-item',
      entityId: itemId,
      before: { status: 'PENDIENTE', quantity: item.quantity, unitPrice: item.unitPrice },
      after: { status: 'CANCELADO' },
    })

    return NextResponse.json({ ok: true, item: updated })
  } catch (e: any) {
    console.error('DELETE /api/mesero/orders/[id]/items/[itemId]', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

// Helper: recalcular totales del pedido tras añadir/cancelar/editar items
async function recalcOrderTotals(orderId: string) {
  const items = await db.orderItem.findMany({
    where: { orderId, status: { not: 'CANCELADO' } },
  })
  const subtotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)
  const order = await db.order.findUnique({ where: { id: orderId } })
  if (!order) return
  const discountAmount = +(subtotal * (order.discountPct / 100)).toFixed(2)
  const total = +(subtotal - discountAmount).toFixed(2)
  await db.order.update({
    where: { id: orderId },
    data: { subtotal, discountAmount, total },
  })
}
