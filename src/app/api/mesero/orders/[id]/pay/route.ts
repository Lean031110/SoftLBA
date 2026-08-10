// POST /api/mesero/orders/[id]/pay - Registrar pago(s) contra un pedido
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'

const PAYMENT_METHODS = [
  'EFECTIVO_CUP',
  'EFECTIVO_USD',
  'TRANSFERENCIA_CUP',
  'TRANSFERENCIA_USD',
  'ZELLE',
  'BANCARIA_USD',
  'COMBINADO',
] as const

const PaymentItemSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  currency: z.string().max(10).default('CUP'),
  amount: z.coerce.number().min(0.01),
  reference: z.string().max(120).optional().or(z.literal('')),
  notes: z.string().max(300).optional().or(z.literal('')),
})

const PaySchema = z.object({
  payments: z.array(PaymentItemSchema).min(1, 'Agrega al menos un pago'),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    // Solo ADMIN, CAJERO y MESERO con permiso CAN_COBRAR pueden cobrar
    if (!['ADMIN', 'CAJERO', 'MESERO'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    const { id } = await params

    const order = await db.order.findUnique({
      where: { id },
      include: { payments: true, items: true },
    })
    if (!order) {
      return NextResponse.json({ ok: false, error: 'Pedido no encontrado' }, { status: 404 })
    }
    if (user.role === 'MESERO' && order.userId !== user.id) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    if (order.status === 'CANCELADO') {
      return NextResponse.json({ ok: false, error: 'El pedido está cancelado' }, { status: 400 })
    }
    if (order.status === 'COBRADO' || order.status === 'ARCHIVADO') {
      return NextResponse.json({ ok: false, error: 'El pedido ya está cobrado' }, { status: 400 })
    }

    const json = await req.json().catch(() => null)
    if (!json) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
    const parsed = PaySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' },
        { status: 400 },
      )
    }
    const d = parsed.data

    // Total ya pagado
    const alreadyPaid = order.payments.reduce((s, p) => s + p.amount, 0)
    const totalPaid = d.payments.reduce((s, p) => s + p.amount, 0) + alreadyPaid

    // Permitir pagar hasta el total. Si excede, devolver error.
    if (totalPaid > order.total + 0.01) {
      return NextResponse.json(
        {
          ok: false,
          error: `El monto total (${totalPaid.toFixed(2)}) excede el total del pedido (${order.total.toFixed(2)})`,
        },
        { status: 400 },
      )
    }

    // Crear los pagos en transacción
    const result = await db.$transaction(async (tx) => {
      const createdPayments = []
      for (const p of d.payments) {
        const payment = await tx.payment.create({
          data: {
            orderId: order.id,
            userId: user.id,
            method: p.method,
            currency: p.currency,
            amount: p.amount,
            reference: p.reference || null,
            notes: p.notes || null,
          },
        })
        createdPayments.push(payment)
      }

      // Actualizar estado del pedido
      const newPaidTotal = totalPaid
      const isFullyPaid = newPaidTotal >= order.total - 0.01
      const newPaymentStatus = isFullyPaid ? 'PAGADO' : 'PARCIAL'
      const newOrderStatus = isFullyPaid ? 'COBRADO' : order.status

      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: newPaymentStatus,
          status: newOrderStatus,
          closedAt: isFullyPaid ? new Date() : order.closedAt,
        },
      })

      // Registrar entrada de financiamiento (venta)
      if (isFullyPaid) {
        await tx.financeEntry.create({
          data: {
            type: 'VENTA',
            category: 'Venta directa',
            description: `Venta pedido #${order.number}`,
            amount: order.total,
            currency: 'CUP',
            reference: order.id,
            userId: user.id,
            orderId: order.id,
          },
        })
      }

      return { updated, createdPayments, isFullyPaid, newPaidTotal }
    })

    for (const p of result.createdPayments) {
      await audit({
        userId: user.id,
        action: 'PAYMENT',
        entity: 'payment',
        entityId: p.id,
        after: {
          orderId: order.id,
          orderNumber: order.number,
          method: p.method,
          currency: p.currency,
          amount: p.amount,
          reference: p.reference,
        },
      })
    }
    await audit({
      userId: user.id,
      action: 'PAY_ORDER',
      entity: 'order',
      entityId: order.id,
      before: { status: order.status, paymentStatus: order.paymentStatus },
      after: {
        status: result.updated.status,
        paymentStatus: result.updated.paymentStatus,
        paidTotal: result.newPaidTotal,
        fullyPaid: result.isFullyPaid,
      },
    })

    // Si se pagó completamente, crear comprobante automáticamente
    if (result.isFullyPaid) {
      try {
        const config = await db.restaurantConfig.findFirst()
        const receiptDir = '/home/z/my-project/download/comprobantes'
        const fs = await import('fs')
        const path = await import('path')
        if (!fs.existsSync(receiptDir)) {
          fs.mkdirSync(receiptDir, { recursive: true })
        }
        const filename = `comprobante-${order.number}-${Date.now()}.json`
        const filePath = path.join(receiptDir, filename)
        const receiptData = {
          orderNumber: order.number,
          orderId: order.id,
          total: order.total,
          paymentMethod: result.createdPayments[0]?.method || 'EFECTIVO_CUP',
          restaurantName: config?.name || 'Restaurante',
          restaurantAddress: config?.address,
          restaurantPhone: config?.phone,
          createdAt: new Date().toISOString(),
        }
        fs.writeFileSync(filePath, JSON.stringify(receiptData, null, 2))
        await db.receipt.create({
          data: {
            orderId: order.id,
            orderNumber: order.number,
            filename,
            filePath,
            total: order.total,
            paymentMethod: result.createdPayments[0]?.method || null,
          },
        })
      } catch (e) {
        console.error('Error creando comprobante automático:', e)
      }
    }

    return NextResponse.json({
      ok: true,
      item: result.updated,
      payments: result.createdPayments,
      paidTotal: result.newPaidTotal,
      pendingTotal: Math.max(0, order.total - result.newPaidTotal),
      fullyPaid: result.isFullyPaid,
      wsPayload: {
        orderId: order.id,
        orderNumber: order.number,
        userId: order.userId,
        areaId: order.areaId,
        amount: totalPaid,
      },
    })
  } catch (e: any) {
    console.error('POST /api/mesero/orders/[id]/pay', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
