// GET /api/pizzeria/orders - Pedidos pendientes para pizzería
// Pizzería ve los items cuyo targetAreaId es el área de PIZZERIA
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

const ACTIVE_STATUS = ['ENVIADO', 'EN_PREPARACION', 'LISTO', 'SERVIDO']

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN', 'PIZZERIA', 'COCINA'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || ''
    const includeServed = searchParams.get('served') === 'true'

    // Pizzería prepara los items cuyo targetAreaId es PIZZERIA
    const pizzeriaArea = await db.area.findUnique({ where: { code: 'PIZZERIA' } })
    if (!pizzeriaArea) {
      return NextResponse.json({ ok: true, items: [] })
    }

    // Buscar pedidos que tengan al menos un item con targetAreaId = PIZZERIA
    const orders = await db.order.findMany({
      where: {
        status: status ? status : { in: includeServed ? ACTIVE_STATUS : ['ENVIADO', 'EN_PREPARACION', 'LISTO'] },
        items: {
          some: {
            targetAreaId: pizzeriaArea.id,
            status: { not: 'CANCELADO' },
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
      include: {
        area: { select: { id: true, name: true, code: true } },
        table: { select: { id: true, name: true, code: true } },
        user: { select: { id: true, firstName: true, lastName: true, username: true } },
        items: {
          where: {
            targetAreaId: pizzeriaArea.id,
            status: { not: 'CANCELADO' },
          },
          include: {
            product: { select: { id: true, name: true, code: true, unit: true, notes: true } },
          },
        },
      },
      take: 100,
    })

    const items = orders.map((o) => ({
      id: o.id,
      number: o.number,
      status: o.status,
      customerName: o.customerName,
      notes: o.notes,
      total: o.total,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      area: o.area,
      table: o.table,
      user: o.user,
      items: o.items.map((it) => ({
        id: it.id,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        notes: it.notes,
        status: it.status,
        serveMode: it.serveMode,
        product: it.product,
      })),
    }))

    return NextResponse.json({ ok: true, items })
  } catch (e: any) {
    console.error('GET /api/pizzeria/orders', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
