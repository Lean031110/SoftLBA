// GET /api/mesero/orders/[id] - Detalle de pedido
// PATCH /api/mesero/orders/[id] - Editar notas/descuento (solo si CREADO/ENVIADO)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN', 'MESERO'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    const { id } = await params

    const order = await db.order.findUnique({
      where: { id },
      include: {
        area: { select: { id: true, name: true, code: true } },
        table: { select: { id: true, name: true, code: true } },
        user: { select: { id: true, firstName: true, lastName: true, username: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, code: true, price: true, unit: true } },
          },
        },
        payments: {
          include: { user: { select: { id: true, firstName: true, lastName: true, username: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ ok: false, error: 'Pedido no encontrado' }, { status: 404 })
    }

    // Mesero solo puede ver sus pedidos
    if (user.role !== 'ADMIN' && order.userId !== user.id) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const paidTotal = order.payments.reduce((s, p) => s + p.amount, 0)

    return NextResponse.json({
      ok: true,
      item: {
        ...order,
        paidTotal,
        pendingTotal: Math.max(0, order.total - paidTotal),
      },
    })
  } catch (e: any) {
    console.error('GET /api/mesero/orders/[id]', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

const PatchSchema = z.object({
  notes: z.string().max(500).optional(),
  discountPct: z.coerce.number().min(0).max(100).optional(),
  customerName: z.string().max(120).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN', 'MESERO'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    const { id } = await params

    const order = await db.order.findUnique({ where: { id }, include: { items: true } })
    if (!order) {
      return NextResponse.json({ ok: false, error: 'Pedido no encontrado' }, { status: 404 })
    }
    if (user.role !== 'ADMIN' && order.userId !== user.id) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    // Solo se puede editar si está en estado CREADO o ENVIADO
    if (!['CREADO', 'ENVIADO'].includes(order.status)) {
      return NextResponse.json(
        { ok: false, error: 'No se puede editar un pedido en este estado' },
        { status: 400 },
      )
    }

    const json = await req.json().catch(() => null)
    if (!json) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
    const parsed = PatchSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' },
        { status: 400 },
      )
    }
    const d = parsed.data
    const before = {
      notes: order.notes,
      discountPct: order.discountPct,
      customerName: order.customerName,
      subtotal: order.subtotal,
      discountAmount: order.discountAmount,
      total: order.total,
    }

    // Recalcular si cambió el descuento
    let newDiscountAmount = order.discountAmount
    let newTotal = order.total
    if (d.discountPct !== undefined) {
      newDiscountAmount = +(order.subtotal * (d.discountPct / 100)).toFixed(2)
      newTotal = +(order.subtotal - newDiscountAmount).toFixed(2)
    }

    const updated = await db.order.update({
      where: { id },
      data: {
        notes: d.notes !== undefined ? d.notes || null : order.notes,
        discountPct: d.discountPct !== undefined ? d.discountPct : order.discountPct,
        discountAmount: newDiscountAmount,
        total: newTotal,
        customerName: d.customerName !== undefined ? d.customerName || null : order.customerName,
      },
    })

    await audit({
      userId: user.id,
      action: 'UPDATE',
      entity: 'order',
      entityId: order.id,
      before,
      after: {
        notes: updated.notes,
        discountPct: updated.discountPct,
        customerName: updated.customerName,
        discountAmount: updated.discountAmount,
        total: updated.total,
      },
    })

    return NextResponse.json({ ok: true, item: updated })
  } catch (e: any) {
    console.error('PATCH /api/mesero/orders/[id]', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
