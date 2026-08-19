// POST /api/mesero/orders/[id]/print - Imprimir comprobante en impresora térmica ESC/POS
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { generateReceipt, sendToPrinter } from '@/lib/escpos'

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
      include: {
        items: { include: { product: true } },
        payments: true,
        area: true,
        table: true,
        user: { select: { firstName: true, lastName: true, username: true } },
      },
    })
    if (!order) return NextResponse.json({ ok: false, error: 'Pedido no encontrado' }, { status: 404 })

    const config = await db.restaurantConfig.findFirst()
    if (!config || !config.printerEnabled || !config.printerIp || !config.printerPort) {
      return NextResponse.json({ ok: false, error: 'Impresora no configurada' }, { status: 400 })
    }

    const commands = generateReceipt({
      restaurantName: config.name || 'Restaurante',
      address: config.address,
      phone: config.phone,
      header: config.receiptHeader,
      footer: config.receiptFooter,
      orderNumber: order.number,
      orderId: order.id,
      waiterName: order.user.firstName || order.user.username,
      tableName: order.table ? order.table.name : 'Para llevar',
      customerName: order.customerName,
      items: order.items.filter((it) => it.status !== 'CANCELADO').map((it) => ({
        name: it.product.name, quantity: it.quantity, unitPrice: it.unitPrice, notes: it.notes,
      })),
      subtotal: order.subtotal, discountPct: order.discountPct, discountAmount: order.discountAmount,
      total: order.total, payments: order.payments.map((p) => ({ method: p.method, amount: p.amount })),
      currencySymbol: config.currencySymbol || '$', createdAt: order.createdAt.toISOString(),
    })

    const result = await sendToPrinter(config.printerIp, config.printerPort, commands)
    if (result.ok) {
      await db.receipt.updateMany({ where: { orderId: order.id }, data: { printed: true } }).catch(() => {})
      return NextResponse.json({ ok: true, message: 'Comprobante enviado a impresora' })
    }
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
  } catch (e: any) {
    console.error('POST print', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
