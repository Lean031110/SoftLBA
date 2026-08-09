// GET /api/mesero/products - Productos finales y directos activos/disponibles
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN', 'MESERO'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const category = (searchParams.get('category') || '').trim()
    const areaId = searchParams.get('areaId') || ''

    // Solo productos de tipo FINAL o DIRECTO (vendibles al cliente)
    const where: any = {
      isActive: true,
      isAvailable: true,
      type: { in: ['FINAL', 'DIRECTO'] },
    }
    if (q) {
      where.OR = [
        { code: { contains: q } },
        { name: { contains: q } },
        { description: { contains: q } },
      ]
    }
    if (category) {
      where.category = category
    }

    const products = await db.product.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        type: true,
        category: true,
        unit: true,
        price: true,
        cost: true,
        imageUrl: true,
        notes: true,
      },
    })

    // Si se especifica área, adjuntar stock de esa área
    let areaStocksMap: Record<string, number | null> = {}
    if (areaId) {
      const areaInv = await db.areaInventory.findMany({
        where: { areaId },
        select: { productId: true, stock: true, reserved: true },
      })
      areaStocksMap = Object.fromEntries(
        areaInv.map((i) => [i.productId, i.stock - i.reserved]),
      )
    }

    const items = products.map((p) => ({
      ...p,
      areaStock: areaStocksMap[p.id] !== undefined ? areaStocksMap[p.id] : null,
    }))

    // Lista de categorías para filtros
    const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[]

    return NextResponse.json({ ok: true, items, categories })
  } catch (e: any) {
    console.error('GET /api/mesero/products', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
