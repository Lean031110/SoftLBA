// POST /api/mesero/orders/[id]/split - Dividir cuenta de un pedido
// ------------------------------------------------------------
// Recibe:
//   items: Array<{ itemId: string, quantity: number }>
//   - itemId: ID de un OrderItem del pedido original
//   - quantity: cantidad a mover al nuevo pedido (debe ser > 0 y <= la
//     cantidad del item original)
// Efectos:
//   - Crea un nuevo pedido (parentOrderId = pedido original) con los
//     items especificados.
//   - Si quantity === item.quantity, el item se mueve por completo.
//   - Si quantity < item.quantity, se reduce la cantidad en el original
//     y se crea un nuevo OrderItem con la cantidad indicada.
//   - Recalcula subtotal/discountAmount/total de ambos pedidos
//     (preservando el discountPct del original).
//   - El nuevo pedido no tiene descuento propio (discountPct=0) salvo que
//     se especifique en el body (opcional `discountPct`).
//   - Genera un nuevo número de pedido atómico vía OrderSequence.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { hasPerm, PERMISSIONS } from '@/lib/permissions/permissions-v2'
import { z } from 'zod'

const SplitItemSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.coerce.number().min(0.01),
})

const SplitSchema = z.object({
  items: z.array(SplitItemSchema).min(1, 'Debes indicar al menos un item para dividir'),
  discountPct: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().max(500).optional().or(z.literal('')),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!hasPerm(user.role, PERMISSIONS.ORDER_EDIT)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    const { id } = await params

    const order = await db.order.findUnique({
      where: { id },
      include: { items: true },
    })
    if (!order) {
      return NextResponse.json({ ok: false, error: 'Pedido no encontrado' }, { status: 404 })
    }
    // Permisos: mesero solo divide sus propios pedidos; admin cualquiera
    if (user.role !== 'ADMIN' && order.userId !== user.id) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    // No permitir dividir pedidos en estados terminales
    if (['CANCELADO', 'ARCHIVADO'].includes(order.status)) {
      return NextResponse.json(
        { ok: false, error: 'No se puede dividir un pedido cancelado o archivado' },
        { status: 400 },
      )
    }
    // No permitir dividir si ya está cobrado
    if (order.paymentStatus === 'PAGADO') {
      return NextResponse.json(
        { ok: false, error: 'No se puede dividir un pedido ya pagado' },
        { status: 400 },
      )
    }

    const json = await req.json().catch(() => null)
    if (!json) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
    const parsed = SplitSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' },
        { status: 400 },
      )
    }
    const d = parsed.data

    // Validar que todos los itemId existen y pertenecen al pedido original,
    // y que las cantidades son válidas (<= cantidad del item original).
    // Acumulamos por itemId por si el cliente envía duplicados.
    const requestedByItemId = new Map<string, number>()
    for (const r of d.items) {
      requestedByItemId.set(r.itemId, (requestedByItemId.get(r.itemId) || 0) + r.quantity)
    }
    for (const [itemId, requestedQty] of requestedByItemId.entries()) {
      const item = order.items.find((it) => it.id === itemId)
      if (!item) {
        return NextResponse.json(
          { ok: false, error: `Item ${itemId} no pertenece al pedido` },
          { status: 400 },
        )
      }
      if (item.status === 'CANCELADO') {
        return NextResponse.json(
          { ok: false, error: `El item "${item.id}" está cancelado` },
          { status: 400 },
        )
      }
      if (requestedQty > item.quantity + 0.0001) {
        return NextResponse.json(
          {
            ok: false,
            error: `Cantidad solicitada (${requestedQty}) excede la del item (${item.quantity})`,
          },
          { status: 400 },
        )
      }
    }

    // Generar nuevo número de pedido atómicamente (FIX 5)
    const nextNumber = await db.$transaction(async (tx) => {
      const seq = await tx.orderSequence.upsert({
        where: { id: 1 },
        update: { nextNumber: { increment: 1 } },
        create: { id: 1, nextNumber: 1001 },
      })
      return seq.nextNumber - 1
    })
    const exists = await db.order.findUnique({ where: { number: nextNumber }, select: { id: true } })
    let finalNumber = nextNumber
    if (exists) {
      const lastOrder = await db.order.findFirst({ orderBy: { number: 'desc' }, select: { number: true } })
      finalNumber = (lastOrder?.number || 1000) + 1
    }

    // Transacción: actualizar original + crear nuevo pedido
    const result = await db.$transaction(async (tx) => {
      // 1) Preparar lineas del nuevo pedido y ajustes al original
      const newItems: Array<{
        productId: string
        quantity: number
        unitPrice: number
        discount: number
        notes: string | null
        status: any
        targetAreaId: string | null
        serveMode: string | null
      }> = []
      const itemsToDelete: string[] = [] // items del original cuyo qty llegó a 0
      const itemsToUpdate: Array<{ id: string; quantity: number }> = []

      for (const [itemId, requestedQty] of requestedByItemId.entries()) {
        const item = order.items.find((it) => it.id === itemId)!
        const remaining = +(item.quantity - requestedQty).toFixed(4)
        if (remaining <= 0.0001) {
          // El item se mueve por completo al nuevo pedido
          itemsToDelete.push(itemId)
          newItems.push({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            notes: item.notes,
            status: item.status,
            targetAreaId: item.targetAreaId,
            serveMode: item.serveMode,
          })
        } else {
          // Reducir cantidad en el original, crear item con la cantidad movida
          itemsToUpdate.push({ id: itemId, quantity: remaining })
          newItems.push({
            productId: item.productId,
            quantity: requestedQty,
            unitPrice: item.unitPrice,
            discount: item.discount,
            notes: item.notes,
            status: item.status,
            targetAreaId: item.targetAreaId,
            serveMode: item.serveMode,
          })
        }
      }

      // 2) Aplicar ajustes al pedido original (delete + update)
      if (itemsToDelete.length > 0) {
        await tx.orderItem.deleteMany({ where: { id: { in: itemsToDelete } } })
      }
      for (const it of itemsToUpdate) {
        await tx.orderItem.update({ where: { id: it.id }, data: { quantity: it.quantity } })
      }

      // 3) Recalcular totales del pedido original
      const originalItemsAfter = await tx.orderItem.findMany({
        where: { orderId: order.id },
        select: { quantity: true, unitPrice: true, discount: true },
      })
      const newSubtotal = originalItemsAfter.reduce(
        (s, i) => s + (i.unitPrice * i.quantity - i.discount),
        0,
      )
      const newDiscountAmount = +(newSubtotal * (order.discountPct / 100)).toFixed(2)
      const newTotal = +(newSubtotal - newDiscountAmount).toFixed(2)
      const updatedOriginal = await tx.order.update({
        where: { id: order.id },
        data: {
          subtotal: newSubtotal,
          discountAmount: newDiscountAmount,
          total: newTotal,
        },
      })

      // 4) Crear nuevo pedido (con parentOrderId) y sus items
      const childSubtotal = newItems.reduce(
        (s, i) => s + (i.unitPrice * i.quantity - i.discount),
        0,
      )
      const childDiscountPct = d.discountPct ?? 0
      const childDiscountAmount = +(childSubtotal * (childDiscountPct / 100)).toFixed(2)
      const childTotal = +(childSubtotal - childDiscountAmount).toFixed(2)

      const childOrder = await tx.order.create({
        data: {
          number: finalNumber,
          userId: user.id,
          areaId: order.areaId,
          tableId: order.tableId,
          customerName: order.customerName,
          status: order.status, // Mantiene el estado actual del pedido original
          subtotal: childSubtotal,
          discountPct: childDiscountPct,
          discountAmount: childDiscountAmount,
          total: childTotal,
          notes: d.notes || null,
          paymentStatus: 'PENDIENTE',
          parentOrderId: order.id,
          items: {
            create: newItems.map((l) => ({
              productId: l.productId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              discount: l.discount,
              notes: l.notes,
              status: l.status,
              targetAreaId: l.targetAreaId,
              serveMode: l.serveMode,
            })),
          },
        },
        include: {
          items: { include: { product: { select: { id: true, name: true, code: true, price: true } } } },
          area: true,
          table: true,
        },
      })

      return { updatedOriginal, childOrder, newSubtotal, newDiscountAmount, newTotal, childSubtotal, childTotal }
    })

    // Auditar
    await audit({
      userId: user.id,
      action: 'ORDER_SPLIT',
      entity: 'order',
      entityId: order.id,
      before: {
        subtotal: order.subtotal,
        discountAmount: order.discountAmount,
        total: order.total,
        itemsCount: order.items.length,
      },
      after: {
        original: {
          subtotal: result.newSubtotal,
          discountAmount: result.newDiscountAmount,
          total: result.newTotal,
        },
        child: {
          orderId: result.childOrder.id,
          orderNumber: result.childOrder.number,
          subtotal: result.childSubtotal,
          total: result.childTotal,
          itemsCount: result.childOrder.items.length,
        },
      },
    })

    return NextResponse.json({
      ok: true,
      originalOrder: result.updatedOriginal,
      childOrder: result.childOrder,
    })
  } catch (e: any) {
    console.error('POST /api/mesero/orders/[id]/split', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
