// POST /api/mesero/orders/[id]/pay - Registrar pago(s) contra un pedido
//
// v1.0-RC1-bloque2-3 (items 19-20) — Conversión monetaria CUP/USD:
//   - Cada Payment persiste: exchangeRate (snapshot de RestaurantConfig.usdToCup),
//     convertedAmount (monto en CUP usando exchangeRate) y baseCurrency='CUP'.
//   - La comparación con `order.total` (que está en CUP) usa `convertedAmount`
//     en lugar de `amount` crudo. Antes se mezclaban USD+CUP y un pago de 1 USD
//     contaba como 1 contra el total en CUP.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import {
  computeConvertedAmount,
  sumConvertedToCup,
  currencyForMethod,
} from '@/lib/currency'
import { emitPaymentDone } from '@/lib/realtime-emitter'
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
  // v1.0.17: idempotencyKey para prevenir doble pago por reintento.
  idempotencyKey: z.string().min(8).max(120).optional(),
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

    // Verificar que todos los productos estén listos antes de cobrar
    // v1.0-RC1-bloque1-2: incluir DESPACHADO como estado terminal válido.
    const pendingItems = order.items.filter(
      (it) =>
        it.status !== 'LISTO' &&
        it.status !== 'DESPACHADO' &&
        it.status !== 'CANCELADO' &&
        it.status !== 'SERVIDO',
    )
    if (pendingItems.length > 0) {
      return NextResponse.json(
        { ok: false, error: `No se puede cobrar: ${pendingItems.length} producto(s) aún no están listos. Espera a que todas las áreas terminen.` },
        { status: 400 },
      )
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

    // v1.0.17: idempotencia — si llega idempotencyKey, verificar si ya existe.
    if (d.idempotencyKey) {
      const existing = await db.payment.findFirst({
        where: { idempotencyKey: d.idempotencyKey },
        include: { order: { select: { id: true, number: true } } },
      })
      if (existing) {
        if (existing.orderId !== order.id) {
          return NextResponse.json(
            { ok: false, error: 'idempotencyKey ya usado para otro pedido' },
            { status: 409 },
          )
        }
        // Retornar resultado anterior (idempotencia).
        return NextResponse.json({
          ok: true,
          idempotent: true,
          message: 'Pago ya procesado anteriormente con este idempotencyKey',
          orderId: order.id,
        })
      }
    }

    // v1.0-RC1-bloque2-3 (items 19-20): cargar la tasa USD→CUP configurada para
    // snapshot en cada pago y para conversión al comparar con el total (CUP).
    const config = await db.restaurantConfig.findFirst({ where: { id: 'config-1' } })
    const usdToCupRate = config?.usdToCup || 320

    // Normalizar moneda de cada pago según el método (defensivo: si el cliente
    // manda currency='CUP' para un método *_USD, lo sobreescribimos a 'USD').
    const normalizedPayments = d.payments.map((p) => {
      const methodCurrency = currencyForMethod(p.method)
      // Si el método determina una moneda explícita, esa gana.
      const currency =
        p.method === 'COMBINADO'
          ? (p.currency || 'CUP').toUpperCase()
          : methodCurrency
      const convertedAmount = computeConvertedAmount(p.amount, currency, usdToCupRate)
      return { ...p, currency, convertedAmount, exchangeRate: usdToCupRate }
    })

    // Total ya pagado (en CUP equivalente usando convertedAmount almacenado)
    const alreadyPaidCup = sumConvertedToCup(order.payments, usdToCupRate)
    // Total de los nuevos pagos (en CUP equivalente)
    const newPaidCup = normalizedPayments.reduce((s, p) => s + p.convertedAmount, 0)
    const totalPaidCup = alreadyPaidCup + newPaidCup

    // v1.0-RC1-bloque2-3 (item 20): comparar contra order.total (en CUP) usando
    // el equivalente en CUP, no la suma cruda de montos en distintas monedas.
    if (totalPaidCup > order.total + 0.01) {
      return NextResponse.json(
        {
          ok: false,
          error: `El monto total (${totalPaidCup.toFixed(2)} CUP) excede el total del pedido (${order.total.toFixed(2)} CUP)`,
        },
        { status: 400 },
      )
    }

    // Crear los pagos en transacción
    let idempotencyKeyToUse: string | undefined = d.idempotencyKey
    const result = await db.$transaction(async (tx) => {
      const createdPayments: any[] = []
      for (const p of normalizedPayments) {
        const payment = await tx.payment.create({
          data: {
            orderId: order.id,
            userId: user.id,
            method: p.method,
            currency: p.currency,
            amount: p.amount,
            reference: p.reference || null,
            notes: p.notes || null,
            exchangeRate: p.exchangeRate,
            convertedAmount: p.convertedAmount,
            baseCurrency: 'CUP',
            // v1.0.17: persistir idempotencyKey solo en el primer pago.
            idempotencyKey: idempotencyKeyToUse,
          },
        })
        createdPayments.push(payment)
        idempotencyKeyToUse = undefined
      }

      // Actualizar estado del pedido
      const newPaidTotal = totalPaidCup
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

      // v1.0-RC1-bloque1-2 (item 12): al cobrar completamente, marcar mesa como
      // ESPERANDO_CUENTA (el cliente aún está terminando / esperando comprobante).
      if (isFullyPaid && order.tableId) {
        await tx.table.update({
          where: { id: order.tableId },
          data: { status: 'ESPERANDO_CUENTA' },
        })
      }

      // NOTA: No se crea FinanceEntry aquí. La única fuente de verdad para finanzas
      // es el cierre diario (close/route.ts), que crea un FinanceEntry VENTA por cada
      // método de pago al cerrar la caja. Esto evita la doble contabilización.
      // Los pagos quedan registrados en la tabla Payment.

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
          exchangeRate: p.exchangeRate,
          convertedAmount: p.convertedAmount,
          baseCurrency: p.baseCurrency,
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
        paidTotalCup: totalPaidCup,
        fullyPaid: result.isFullyPaid,
      },
    })

    // Si se pagó completamente, crear comprobante automáticamente
    if (result.isFullyPaid) {
      try {
        const config = await db.restaurantConfig.findFirst()
        const fs = await import('fs')
        const nodePath = await import('path')
        const receiptDir = nodePath.join(process.cwd(), 'download', 'comprobantes')
        if (!fs.existsSync(receiptDir)) {
          fs.mkdirSync(receiptDir, { recursive: true })
        }
        const filename = `comprobante-${order.number}-${Date.now()}.json`
        const filePath = nodePath.join(receiptDir, filename)
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

    // v1.0.17: emitir payment:done DESPUÉS del DB COMMIT.
    if (result.isFullyPaid) {
      await emitPaymentDone({
        orderId: order.id,
        orderNumber: order.number,
        amount: totalPaidCup,
        userId: order.userId,
      })
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
        amount: totalPaidCup,
      },
    })
  } catch (e: any) {
    console.error('POST /api/mesero/orders/[id]/pay', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
