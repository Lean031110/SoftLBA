// POST /api/mesero/orders/[id]/items - Añadir item a un pedido existente
// Reglas: solo si el pedido no está CANCELADO o COBRADO/ARCHIVADO
//         el item se añade con status PENDIENTE
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'

const AddItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  notes: z.string().max(300).optional().or(z.literal('')),
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

    // Crear item con status PENDIENTE
    const newItem = await db.orderItem.create({
      data: {
        orderId: id,
        productId,
        quantity,
        unitPrice: product.price,
        notes: notes || null,
        status: 'PENDIENTE',
      },
      include: {
        product: { select: { id: true, name: true, code: true, price: true, unit: true } },
      },
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

    await audit({
      userId: user.id,
      action: 'ADD_ORDER_ITEM',
      entity: 'order-item',
      entityId: newItem.id,
      after: { orderId: id, productName: product.name, quantity, unitPrice: product.price },
    })

    return NextResponse.json({ ok: true, item: newItem })
  } catch (e: any) {
    console.error('POST /api/mesero/orders/[id]/items', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
