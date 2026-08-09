// GET /api/admin/inventario/compare - Comparación teórico vs físico por área
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

    if (!areaId) {
      return NextResponse.json({ ok: false, error: 'areaId requerido' }, { status: 400 })
    }

    // Stock teórico actual del área
    const items = await db.areaInventory.findMany({
      where: { areaId },
      include: {
        product: {
          select: { id: true, code: true, name: true, unit: true, cost: true, category: true },
        },
      },
      orderBy: { product: { name: 'asc' } },
    })

    // Último conteo físico por producto en el área
    const lastPhysicals = await db.physicalStock.findMany({
      where: { areaId },
      orderBy: { createdAt: 'desc' },
    })
    const physicalMap = new Map<string, { countedQty: number; observedQty: number | null; createdAt: Date }>()
    for (const p of lastPhysicals) {
      if (!physicalMap.has(p.productId)) {
        physicalMap.set(p.productId, {
          countedQty: p.countedQty,
          observedQty: p.observedQty,
          createdAt: p.createdAt,
        })
      }
    }

    const result = items.map((i) => {
      const phys = physicalMap.get(i.productId)
      const counted = phys?.countedQty ?? null
      const theoretical = i.stock
      const diff = counted !== null ? counted - theoretical : null
      return {
        id: i.id,
        product: i.product,
        unit: i.product.unit,
        theoretical,
        counted,
        observed: phys?.observedQty ?? null,
        diff,
        diffValue: diff !== null ? diff * i.product.cost : null,
        lastCountAt: phys?.createdAt ?? null,
        minStock: i.minStock,
      }
    })

    return NextResponse.json({ ok: true, items: result })
  } catch (e: any) {
    console.error('GET /api/admin/inventario/compare', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
