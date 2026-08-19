// GET /api/admin/audit - Listar auditoría con filtros y paginación
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const action = (searchParams.get('action') || '').trim()
    const entity = (searchParams.get('entity') || '').trim()
    const userId = (searchParams.get('userId') || '').trim()
    const from = (searchParams.get('from') || '').trim()
    const to = (searchParams.get('to') || '').trim()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(100, Math.max(10, parseInt(searchParams.get('pageSize') || '25', 10)))

    const where: any = {}
    if (action) where.action = { contains: action }
    if (entity) where.entity = { contains: entity }
    if (userId) where.userId = userId
    if (q) {
      where.OR = [
        { action: { contains: q } },
        { entity: { contains: q } },
        { ipAddress: { contains: q } },
      ]
    }
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to) {
        const toDate = new Date(to)
        toDate.setDate(toDate.getDate() + 1)
        where.createdAt.lt = toDate
      }
    }

    const [total, items] = await Promise.all([
      db.auditLog.count({ where }),
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: {
            select: { id: true, username: true, firstName: true, lastName: true },
          },
        },
      }),
    ])

    return NextResponse.json({
      ok: true,
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    })
  } catch (e: any) {
    console.error('GET /api/admin/audit', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
