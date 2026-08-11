// GET /api/admin/dashboard - Estadísticas del dashboard
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { getTotalInCurrency } from '@/lib/currency'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
  if (!['ADMIN', 'MESERO_PRO'].includes(user.role)) {
    return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const [
    totalUsers,
    totalProducts,
    activeProducts,
    ordersToday,
    paymentsToday,
    pendingOrders,
    lowStockItems,
    newsCount,
    customersCount,
    config,
  ] = await Promise.all([
    db.user.count({ where: { isActive: true } }),
    db.product.count(),
    db.product.count({ where: { isActive: true } }),
    db.order.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
    db.payment.findMany({
      where: { createdAt: { gte: today, lt: tomorrow } },
      select: { amount: true, currency: true, method: true },
    }),
    db.order.count({
      where: {
        status: { in: ['CREADO', 'ENVIADO', 'EN_PREPARACION', 'LISTO'] },
      },
    }),
    db.areaInventory.findMany({
      where: { stock: { lte: 5 } },
      include: { product: { select: { name: true, code: true } }, area: { select: { name: true } } },
      take: 10,
    }),
    db.news.count({ where: { isActive: true } }),
    db.customer.count(),
    db.restaurantConfig.findFirst({ select: { usdToCup: true, currency: true } }),
  ])

  const usdToCupRate = config?.usdToCup || 320
  // Total ventas del día en CUP equivalente (convierte USD→CUP usando tasa configurada)
  const salesTodayCUP = getTotalInCurrency(paymentsToday, 'CUP', usdToCupRate)
  const salesTodayUSD = getTotalInCurrency(paymentsToday, 'USD', usdToCupRate)

  // Ventas por método (en CUP equivalente para comparación)
  const salesByMethodMap = new Map<string, { totalCUP: number; totalOriginal: number; count: number }>()
  for (const p of paymentsToday) {
    const cur = (p.currency || 'CUP').toUpperCase()
    const inCUP = cur === 'USD' ? p.amount * usdToCupRate : p.amount
    const entry = salesByMethodMap.get(p.method || 'OTHER') || { totalCUP: 0, totalOriginal: 0, count: 0 }
    entry.totalCUP += inCUP
    entry.totalOriginal += p.amount
    entry.count += 1
    salesByMethodMap.set(p.method || 'OTHER', entry)
  }

  // Ventas por área
  const salesByArea = await db.order.groupBy({
    by: ['areaId'],
    _sum: { total: true },
    _count: true,
    where: { createdAt: { gte: today, lt: tomorrow }, status: { not: 'CANCELADO' } },
  })
  const areas = await db.area.findMany()
  const salesByAreaNamed = salesByArea.map((s) => ({
    area: areas.find((a) => a.id === s.areaId)?.name || 'Desconocida',
    total: s._sum.total || 0,
    count: s._count,
  }))

  // Últimos pedidos
  const recentOrders = await db.order.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { firstName: true, lastName: true, username: true } },
      area: { select: { name: true } },
    },
  })

  return NextResponse.json({
    ok: true,
    stats: {
      totalUsers,
      totalProducts,
      activeProducts,
      ordersToday,
      salesToday: salesTodayCUP,
      salesTodayUSD,
      salesTodayCUP,
      pendingOrders,
      newsCount,
      customersCount,
      usdToCupRate,
    },
    salesByMethod: Array.from(salesByMethodMap.entries()).map(([method, v]) => ({
      method,
      total: v.totalOriginal,
      totalCUP: v.totalCUP,
      count: v.count,
    })),
    salesByArea: salesByAreaNamed,
    lowStock: lowStockItems,
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      number: o.number,
      status: o.status,
      total: o.total,
      createdAt: o.createdAt,
      user: o.user.firstName ? `${o.user.firstName} ${o.user.lastName}` : o.user.username,
      area: o.area.name,
    })),
  })
}
