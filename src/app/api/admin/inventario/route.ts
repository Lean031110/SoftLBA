// GET /api/admin/inventario - Lista items por área (filtrar por areaId)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN', 'COCINA', 'PIZZERIA'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const areaId = searchParams.get('areaId') || ''
    const q = (searchParams.get('q') || '').trim()
    const lowStock = searchParams.get('lowStock') === 'true'

    // Áreas accesibles según rol
    let areas: { id: string; code: string; name: string }[] = []
    const allAreas = await db.area.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    })
    if (user.role === 'ADMIN') {
      areas = allAreas
    } else if (user.role === 'COCINA') {
      areas = allAreas.filter((a) => a.code === 'COCINA' || a.code === 'SALON')
    } else if (user.role === 'PIZZERIA') {
      areas = allAreas.filter((a) => a.code === 'PIZZERIA')
    }

    // Si no se especifica areaId, devolver solo las áreas accesibles
    if (!areaId) {
      return NextResponse.json({ ok: true, areas, items: [] })
    }

    // Verificar que el área esté permitida
    if (!areas.some((a) => a.id === areaId)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const where: any = { areaId }
    if (q) {
      where.product = {
        OR: [
          { code: { contains: q } },
          { name: { contains: q } },
        ],
      }
    }

    let items = await db.areaInventory.findMany({
      where,
      include: {
        product: {
          select: {
            id: true, code: true, name: true, type: true,
            category: true, unit: true, cost: true, price: true,
            minStock: true, isActive: true,
          },
        },
      },
      orderBy: { product: { name: 'asc' } },
    })

    if (lowStock) {
      items = items.filter((i) => i.stock <= (i.minStock || 0))
    }

    return NextResponse.json({ ok: true, areas, items })
  } catch (e: any) {
    console.error('GET /api/admin/inventario', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
