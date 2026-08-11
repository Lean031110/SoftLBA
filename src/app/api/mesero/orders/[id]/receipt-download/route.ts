// GET /api/mesero/orders/[id]/receipt-download - Descargar comprobante del pedido
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET(
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

    if (user.role !== 'ADMIN' && order.userId !== user.id) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const config = await db.restaurantConfig.findFirst()

    // Generar HTML del comprobante
    const restaurantName = config?.name || 'Restaurante'
    const address = config?.address || ''
    const phone = config?.phone || ''
    const email = config?.email || ''
    const receiptHeader = config?.receiptHeader || ''
    const receiptFooter = config?.receiptFooter || '¡Gracias por su visita!'
    const symbol = config?.currencySymbol || '$'

    const itemsHtml = order.items
      .filter((it) => it.status !== 'CANCELADO')
      .map((it) => `
        <tr>
          <td style="text-align:center;width:40px;">${it.quantity}</td>
          <td>${it.product.name}${it.notes ? `<br><small style="color:#666;">${it.notes}</small>` : ''}</td>
          <td style="text-align:right;">${symbol}${(it.unitPrice * it.quantity).toFixed(2)}</td>
        </tr>
      `).join('')

    const paymentsHtml = order.payments.map((p) => `
      <tr>
        <td colspan="2">${p.method.replace(/_/g, ' ')}</td>
        <td style="text-align:right;">${symbol}${p.amount.toFixed(2)}</td>
      </tr>
    `).join('')

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Comprobante #${order.number}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  body { font-family: 'Courier New', monospace; width: 72mm; margin: 4mm auto; font-size: 11px; color: #000; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .divider { border-top: 1px dashed #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 0; vertical-align: top; }
  .total { font-size: 13px; font-weight: bold; }
  .small { font-size: 9px; color: #666; }
</style></head><body>
  ${receiptHeader ? `<div class="center bold">${receiptHeader.replace(/\n/g, '<br>')}</div>` : ''}
  <div class="center bold" style="font-size:14px;">${restaurantName}</div>
  ${address ? `<div class="center small">${address}</div>` : ''}
  ${phone ? `<div class="center small">Tel: ${phone}</div>` : ''}
  ${email ? `<div class="center small">${email}</div>` : ''}
  <div class="divider"></div>
  <table>
    <tr><td colspan="2"><span class="bold">Pedido #:</span> ${order.number}</td><td style="text-align:right;">${new Date(order.createdAt).toLocaleString('es-CU')}</td></tr>
    <tr><td colspan="2"><span class="bold">Mesero:</span> ${order.user.firstName || order.user.username}</td><td></td></tr>
    <tr><td colspan="2"><span class="bold">Mesa:</span> ${order.table ? order.table.name : 'Para llevar'}</td><td></td></tr>
    ${order.customerName ? `<tr><td colspan="2"><span class="bold">Cliente:</span> ${order.customerName}</td><td></td></tr>` : ''}
  </table>
  <div class="divider"></div>
  <table>
    <tr class="bold"><td style="width:40px;">Cant.</td><td>Producto</td><td style="text-align:right;">Importe</td></tr>
    ${itemsHtml}
  </table>
  <div class="divider"></div>
  <table>
    <tr><td colspan="2">Subtotal</td><td style="text-align:right;">${symbol}${order.subtotal.toFixed(2)}</td></tr>
    ${order.discountAmount > 0 ? `<tr><td colspan="2">Descuento (${order.discountPct}%)</td><td style="text-align:right;">-${symbol}${order.discountAmount.toFixed(2)}</td></tr>` : ''}
    <tr class="total"><td colspan="2">TOTAL</td><td style="text-align:right;">${symbol}${order.total.toFixed(2)}</td></tr>
  </table>
  ${paymentsHtml ? `<div class="divider"></div><table>${paymentsHtml}</table>` : ''}
  <div class="divider"></div>
  <div class="center bold">${receiptFooter}</div>
  <div class="center small">Emitido: ${new Date().toLocaleString('es-CU')}</div>
</body></html>`

    return NextResponse.json({
      ok: true,
      html,
      orderNumber: order.number,
    })
  } catch (e: any) {
    console.error('GET receipt-download', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
