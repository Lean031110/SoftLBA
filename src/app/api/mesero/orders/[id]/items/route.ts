// POST /api/mesero/orders/[id]/items - Añadir item a un pedido existente
// Reglas: solo si el pedido no está CANCELADO o COBRADO/ARCHIVADO
//
// v1.0-RC1-bloque1-2 (item 15): replica la lógica de creación de pedido:
//   - targetAreaId: DIRECTO → área del pedido (Salón); FINAL → product.areaId
//   - serveMode: 'now' para DIRECTO, 'with_order' para FINAL
//   - DIRECTO nace con status='SERVIDO' y decrementa stock atómicamente
//   - FINAL nace con status='PENDIENTE'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { decrementDirectoStock } from '@/lib/directo-stock'
import { recalculateOrderStatus } from '@/lib/order-state-machine'
import { z } from 'zod'

const AddItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  notes: z.string().max(300).optional().or(z.literal('')),
  serveMode: z.enum(['now', 'with_order']).optional(),
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
    if (!order) return NextResponse.json({ ok: false, error: 'Pedido no encontrado' }, { status: 404 })

    // Mesero solo puede editar sus pedidos
    if (user.role !== 'ADMIN' && order.userId !== user.id) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    // No se puede modificar si está cancelado, cobrado o archivado
    if (['CANCELADO', 'COBRADO', 'ARCHIVADO'].includes(order.status)) {
      return NextResponse.json(
        { ok: false, error: `No se puede añadir items a un pedido ${order.status.toLowerCase()}` },
        { status: 400 },
      )
    }

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
    const parsed = AddItemSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' },
        { status: 400 },
      )
    }
    const { productId, quantity, notes } = parsed.data

    const product = await db.product.findUnique({ where: { id: productId } })
    if (!product) return NextResponse.json({ ok: false, error: 'Producto no encontrado' }, { status: 404 })
    if (!product.isActive || !product.isAvailable) {
      return NextResponse.json({ ok: false, error: 'Producto no disponible' }, { status: 400 })
    }
    if (product.type === 'SUBPRODUCTO') {
      return NextResponse.json(
        { ok: false, error: 'Producto no vendible directamente' },
        { status: 400 },
      )
    }

    const isDirecto = product.type === 'DIRECTO'

    // v1.0-RC1-bloque1-2 (item 15): targetAreaId y serveMode igual que en creación.
    const targetAreaId = isDirecto ? order.areaId : (product.areaId || order.areaId)
    const serveMode = parsed.data.serveMode || (isDirecto ? 'now' : 'with_order')

    // v1.0-RC1-bloque1-2 (item 15): DIRECTO nace SERVIDO; FINAL nace PENDIENTE.
    const itemStatus = isDirecto ? 'SERVIDO' : 'PENDIENTE'

    // Si es DIRECTO, validar stock suficiente (cuando blockNegative=true).
    const config = await db.restaurantConfig.findFirst({ where: { id: 'config-1' } })
    const blockNegative = config?.blockNegativeStock ?? true

    // v1.0-RC1-bloque1-2 (item 15): crear item + decrementar stock en la misma transacción.
    const result = await db.$transaction(async (tx) => {
      const newItem = await tx.orderItem.create({
        data: {
          orderId: id,
          productId,
          quantity,
          unitPrice: product.price,
          notes: notes || null,
          status: itemStatus as any,
          targetAreaId,
          serveMode,
        },
        include: {
          product: { select: { id: true, name: true, code: true, price: true, unit: true, type: true } },
        },
      })

      if (isDirecto) {
        const res = await decrementDirectoStock(order.areaId, product.id, quantity, {
          blockNegative,
          orderNumber: order.number,
          reference: `${order.id}:item:${newItem.id}`,
          userId: user.id,
          unit: product.unit,
          tx,
        })
        if (!res.ok) {
          throw new Error(
            `Stock insuficiente de "${product.name}": ${res.message || 'no se pudo descontar'}`,
          )
        }
      }

      return newItem
    })

    // Recalcular totales del pedido
    const allItems = await db.orderItem.findMany({
      where: { orderId: id, status: { not: 'CANCELADO' } },
    })
    const newSubtotal = allItems.reduce((s, it) => s + it.quantity * it.unitPrice, 0)
    const newDiscountAmount = +(newSubtotal * (order.discountPct / 100)).toFixed(2)
    const newTotal = +(newSubtotal - newDiscountAmount).toFixed(2)

    await db.order.update({
      where: { id },
      data: {
        subtotal: newSubtotal,
        discountAmount: newDiscountAmount,
        total: newTotal,
      },
    })

    // Sincronizar estado del pedido (p.ej. si se añadió un DIRECTO SERVIDO,
    // pero hay FINAL pendiente, el pedido sigue en ENVIADO/EN_PREPARACION).
    await recalculateOrderStatus(id).catch(() => undefined)

    await audit({
      userId: user.id,
      action: 'ADD_ORDER_ITEM',
      entity: 'order-item',
      entityId: result.id,
      after: {
        orderId: id,
        productName: product.name,
        quantity,
        unitPrice: product.price,
        status: itemStatus,
        targetAreaId,
        serveMode,
      },
    })

    return NextResponse.json({ ok: true, item: result })
  } catch (e: any) {
    console.error('POST /api/mesero/orders/[id]/items', e)
    if (e?.message?.startsWith('Stock insuficiente')) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 400 })
    }
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
