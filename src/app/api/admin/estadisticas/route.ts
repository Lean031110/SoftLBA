// GET /api/admin/estadisticas - Estadísticas agregadas
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
    const period = searchParams.get('period') || 'daily' // daily, weekly, monthly, yearly
    const date = searchParams.get('date') || new Date().toISOString().slice(0, 10)

    // Calcular rango según el periodo
    let start: Date
    let end: Date
    const d = new Date(date + 'T00:00:00')

    if (period === 'daily') {
      start = new Date(d)
      start.setHours(0, 0, 0, 0)
      end = new Date(d)
      end.setHours(23, 59, 59, 999)
    } else if (period === 'weekly') {
      start = new Date(d)
      start.setDate(d.getDate() - d.getDay())
      start.setHours(0, 0, 0, 0)
      end = new Date(start)
      end.setDate(start.getDate() + 6)
      end.setHours(23, 59, 59, 999)
    } else if (period === 'monthly') {
      start = new Date(d.getFullYear(), d.getMonth(), 1)
      end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
    } else {
      // yearly
      start = new Date(d.getFullYear(), 0, 1)
      end = new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999)
    }

    // Obtener pedidos del rango
    const orders = await db.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { not: 'CANCELADO' },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, username: true } },
        area: { select: { id: true, name: true } },
        items: {
          where: { status: { not: 'CANCELADO' } },
          include: {
            product: { select: { id: true, name: true, code: true, category: true, price: true } },
          },
        },
        payments: true,
      },
    })

    // Calcular estadísticas
    let totalSales = 0
    let totalOrders = 0
    let totalCash = 0
    let totalTransfer = 0
    let totalDiscount = 0
    const productMap: Record<string, { name: string; code: string; category: string; quantity: number; revenue: number }> = {}
    const waiterMap: Record<string, { name: string; username: string; orders: number; sales: number }> = {}
    const methodSummary: Record<string, { count: number; total: number }> = {}
    const areaSummary: Record<string, { name: string; orders: number; sales: number }> = {}

    for (const order of orders) {
      totalSales += order.total
      totalOrders += 1
      totalDiscount += order.discountAmount || 0

      // Por método de pago
      for (const payment of order.payments) {
        if (!methodSummary[payment.method]) {
          methodSummary[payment.method] = { count: 0, total: 0 }
        }
        methodSummary[payment.method].count += 1
        methodSummary[payment.method].total += payment.amount

        if (payment.method === 'EFECTIVO_CUP' || payment.method === 'EFECTIVO_USD') {
          totalCash += payment.amount
        } else {
          totalTransfer += payment.amount
        }
      }

      // Por mesero/dependiente
      const waiterKey = order.user.id
      const waiterName = `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim() || order.user.username
      if (!waiterMap[waiterKey]) {
        waiterMap[waiterKey] = { name: waiterName, username: order.user.username, orders: 0, sales: 0 }
      }
      waiterMap[waiterKey].orders += 1
      waiterMap[waiterKey].sales += order.total

      // Por producto
      for (const item of order.items) {
        const prodKey = item.productId
        if (!productMap[prodKey]) {
          productMap[prodKey] = {
            name: item.product.name,
            code: item.product.code,
            category: item.product.category || 'Sin categoría',
            quantity: 0,
            revenue: 0,
          }
        }
        productMap[prodKey].quantity += item.quantity
        productMap[prodKey].revenue += item.quantity * item.unitPrice
      }

      // Por área (usar targetAreaId de items si está disponible)
      const areaId = order.areaId
      const areaName = order.area?.name || 'Desconocida'
      // Para áreas de items, ya tenemos order.area
      if (!areaSummary[areaId]) {
        areaSummary[areaId] = { name: areaName, orders: 0, sales: 0 }
      }
      areaSummary[areaId].orders += 1
      areaSummary[areaId].sales += order.total
    }

    // Convertir a arrays y ordenar
    const topProducts = Object.values(productMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 20)

    const topWaiters = Object.values(waiterMap)
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10)

    const methods = Object.entries(methodSummary)
      .map(([method, data]) => ({ method, count: data.count, total: data.total }))
      .sort((a, b) => b.total - a.total)

    const areas = Object.values(areaSummary)
      .sort((a, b) => b.sales - a.sales)

    // Mermas del periodo
    const mermas = await db.financeEntry.findMany({
      where: {
        type: 'MERMA',
        createdAt: { gte: start, lte: end },
      },
      select: { amount: true, category: true, description: true, createdAt: true },
    })
    const totalWaste = mermas.reduce((s, m) => s + m.amount, 0)

    // Descuadres (diferencia en cierres diarios)
    const dailyCloses = await db.dailyClose.findMany({
      where: {
        date: { gte: start, lte: end },
      },
      select: { difference: true, date: true, status: true },
    })
    const totalDiscrepancy = dailyCloses.reduce((s, d) => s + Math.abs(d.difference), 0)

    // Datos para gráfico de ventas por día
    const dailyData: { day: string; sales: number; orders: number }[] = []
    const tempData: Record<string, { sales: number; orders: number }> = {}
    for (const order of orders) {
      const day = new Date(order.createdAt).toISOString().slice(0, 10)
      if (!tempData[day]) tempData[day] = { sales: 0, orders: 0 }
      tempData[day].sales += order.total
      tempData[day].orders += 1
    }
    for (const [day, data] of Object.entries(tempData)) {
      dailyData.push({ day, ...data })
    }
    dailyData.sort((a, b) => a.day.localeCompare(b.day))

    return NextResponse.json({
      ok: true,
      period,
      date,
      range: { start: start.toISOString(), end: end.toISOString() },
      summary: {
        totalSales,
        totalOrders,
        totalCash,
        totalTransfer,
        totalDiscount,
        totalWaste,
        totalDiscrepancy,
        averageTicket: totalOrders > 0 ? totalSales / totalOrders : 0,
      },
      topProducts,
      topWaiters,
      methods,
      areas,
      mermas,
      dailyCloses: dailyCloses.map((d) => ({
        date: d.date,
        difference: d.difference,
        status: d.status,
      })),
      chartData: dailyData,
    })
  } catch (e: any) {
    console.error('GET /api/admin/estadisticas', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
