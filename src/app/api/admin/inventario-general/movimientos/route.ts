// GET /api/admin/inventario-general/movimientos - Historial de movimientos con paginación y filtros
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
    const type = searchParams.get('type') || ''
    const productId = searchParams.get('productId') || ''
    const areaId = searchParams.get('areaId') || ''
    const from = searchParams.get('from') || ''
    const to = searchParams.get('to') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(100, Math.max(10, parseInt(searchParams.get('pageSize') || '20', 10)))

    const where: any = {}
    if (type) where.type = type
    if (productId) where.productId = productId
    if (areaId === 'null') {
      where.areaId = null
    } else if (areaId) {
      where.areaId = areaId
    }
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from + 'T00:00:00')
      if (to) where.createdAt.lte = new Date(to + 'T23:59:59.999')
    }

    const [total, items] = await Promise.all([
      db.stockMovement.count({ where }),
      db.stockMovement.findMany({
        where,
        include: {
          product: { select: { id: true, code: true, name: true, unit: true } },
          area: { select: { id: true, code: true, name: true } },
          user: { select: { id: true, username: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return NextResponse.json({
      ok: true,
      items,
      pagination: {
        page, pageSize,
        total, totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    })
  } catch (e: any) {
    console.error('GET /api/admin/inventario-general/movimientos', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
