// GET /api/admin/historicos - Históricos organizados por día/semana/mes/año
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'daily' // daily, weekly, monthly, yearly
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(100, Math.max(10, parseInt(searchParams.get('pageSize') || '20', 10)))

    // Construir rango de fechas
    let dateFrom: Date | undefined
    let dateTo: Date | undefined
    if (from) dateFrom = new Date(from + 'T00:00:00')
    if (to) dateTo = new Date(to + 'T23:59:59.999')

    const where: any = {}
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = dateFrom
      if (dateTo) where.createdAt.lte = dateTo
    }

    // Solo pedidos no cancelados
    where.status = { not: 'CANCELADO' }

    // Obtener pedidos del rango
    const orders = await db.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, username: true } },
        area: { select: { id: true, name: true, code: true } },
        table: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, code: true, price: true } },
          },
        },
        payments: true,
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    const total = await db.order.count({ where })

    // Agrupar según el tipo
    const grouped: Record<string, any> = {}

    for (const order of orders) {
      let key: string
      const d = new Date(order.createdAt)

      if (type === 'daily') {
        key = d.toISOString().slice(0, 10) // YYYY-MM-DD
      } else if (type === 'weekly') {
        const year = d.getFullYear()
        const start = new Date(d)
        start.setDate(d.getDate() - d.getDay())
        const weekNum = Math.ceil(((d.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + 1) / 7)
        key = `${year}-S${String(weekNum).padStart(2, '0')}`
      } else if (type === 'monthly') {
        key = d.toISOString().slice(0, 7) // YYYY-MM
      } else {
        key = String(d.getFullYear()) // YYYY
      }

      if (!grouped[key]) {
        grouped[key] = {
          period: key,
          orders: [],
          totalSales: 0,
          totalOrders: 0,
          totalDiscount: 0,
          items: [],
        }
      }

      grouped[key].orders.push({
        id: order.id,
        number: order.number,
        status: order.status,
        total: order.total,
        subtotal: order.subtotal,
        discountAmount: order.discountAmount,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        closedAt: order.closedAt,
        user: order.user,
        area: order.area,
        table: order.table,
        itemsCount: order.items.length,
        payments: order.payments.map((p) => ({
          method: p.method,
          amount: p.amount,
          currency: p.currency,
        })),
      })
      grouped[key].totalSales += order.total
      grouped[key].totalOrders += 1
      grouped[key].totalDiscount += order.discountAmount || 0

      // Acumular items para top productos
      for (const item of order.items) {
        if (item.status === 'CANCELADO') continue
        const existing = grouped[key].items.find((i: any) => i.productId === item.productId)
        if (existing) {
          existing.quantity += item.quantity
          existing.revenue += item.quantity * item.unitPrice
        } else {
          grouped[key].items.push({
            productId: item.productId,
            productName: item.product.name,
            productCode: item.product.code,
            quantity: item.quantity,
            revenue: item.quantity * item.unitPrice,
          })
        }
      }
    }

    // Ordenar items por cantidad en cada grupo
    for (const key of Object.keys(grouped)) {
      grouped[key].items.sort((a: any, b: any) => b.quantity - a.quantity)
    }

    // Convertir a array y ordenar por periodo descendente
    const result = Object.values(grouped).sort((a: any, b: any) => b.period.localeCompare(a.period))

    // Estadísticas resumidas
    const allPayments = await db.payment.findMany({
      where: where.createdAt ? { createdAt: where.createdAt } : {},
      select: { method: true, amount: true },
    })

    const methodSummary: Record<string, number> = {}
    for (const p of allPayments) {
      methodSummary[p.method] = (methodSummary[p.method] || 0) + p.amount
    }

    return NextResponse.json({
      ok: true,
      type,
      items: result,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      summary: {
        totalOrders: total,
        totalSales: result.reduce((s: number, g: any) => s + g.totalSales, 0),
        methodSummary,
      },
    })
  } catch (e: any) {
    console.error('GET /api/admin/historicos', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
