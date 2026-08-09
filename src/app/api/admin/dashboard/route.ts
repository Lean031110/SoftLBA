// GET /api/admin/dashboard - Estadísticas del dashboard
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
  if (!['ADMIN', 'CAJERO'].includes(user.role)) {
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
    salesTodayAgg,
    pendingOrders,
    lowStockItems,
    newsCount,
    customersCount,
  ] = await Promise.all([
    db.user.count({ where: { isActive: true } }),
    db.product.count(),
    db.product.count({ where: { isActive: true } }),
    db.order.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
    db.payment.aggregate({
      _sum: { amount: true },
      where: { createdAt: { gte: today, lt: tomorrow } },
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
  ])

  // Ventas por método
  const salesByMethod = await db.payment.groupBy({
    by: ['method'],
    _sum: { amount: true },
    _count: true,
    where: { createdAt: { gte: today, lt: tomorrow } },
  })

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
      salesToday: salesTodayAgg._sum.amount || 0,
      pendingOrders,
      newsCount,
      customersCount,
    },
    salesByMethod: salesByMethod.map((s) => ({
      method: s.method,
      total: s._sum.amount || 0,
      count: s._count,
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
