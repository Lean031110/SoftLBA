// GET /api/admin/inventario-general - Lista de inventario general con filtros
// POST /api/admin/inventario-general - Movimiento de stock (ENTRADA/SALIDA/AJUSTE/MERMA/COMPRA)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'

const MOVEMENT_TYPES = ['ENTRADA', 'SALIDA', 'AJUSTE', 'MERMA', 'COMPRA'] as const

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const lowStock = searchParams.get('lowStock') === 'true'

    const where: any = {}
    if (q) {
      where.product = {
        OR: [
          { code: { contains: q } },
          { name: { contains: q } },
        ],
      }
    }

    const items = await db.inventoryItem.findMany({
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

    const filtered = lowStock
      ? items.filter((i) => i.stock <= (i.product.minStock || 0))
      : items

    return NextResponse.json({ ok: true, items: filtered })
  } catch (e: any) {
    console.error('GET /api/admin/inventario-general', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

const MoveSchema = z.object({
  productId: z.string().min(1),
  type: z.enum(MOVEMENT_TYPES),
  quantity: z.coerce.number().refine((n) => n !== 0, 'Cantidad debe ser distinta de 0'),
  reason: z.string().max(300).optional().or(z.literal('')),
  reference: z.string().max(200).optional().or(z.literal('')),
  unitCost: z.coerce.number().min(0).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const json = await req.json().catch(() => null)
    if (!json) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
    const parsed = MoveSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    }
    const d = parsed.data

    const item = await db.inventoryItem.findUnique({
      where: { productId: d.productId },
      include: { product: true },
    })
    if (!item) {
      return NextResponse.json({ ok: false, error: 'Producto no tiene inventario general' }, { status: 404 })
    }

    const qty = Math.abs(d.quantity)
    const before = item.stock
    let after = before

    switch (d.type) {
      case 'ENTRADA':
      case 'COMPRA':
        after = before + qty
        break
      case 'SALIDA':
      case 'MERMA':
        after = before - qty
        if (after < 0) {
          return NextResponse.json({ ok: false, error: 'Stock insuficiente para salida' }, { status: 400 })
        }
        break
      case 'AJUSTE':
        after = before + d.quantity
        break
    }

    await db.$transaction(async (tx) => {
      await tx.inventoryItem.update({
        where: { productId: d.productId },
        data: { stock: after },
      })

      await tx.stockMovement.create({
        data: {
          type: d.type,
          productId: d.productId,
          areaId: null,
          quantity: d.type === 'AJUSTE' ? d.quantity : qty,
          unit: item.product.unit,
          reason: d.reason || null,
          reference: d.reference || null,
          userId: user.id,
        },
      })

      if (d.type === 'COMPRA') {
        const newCost = d.unitCost !== undefined ? d.unitCost : item.product.cost
        await tx.product.update({
          where: { id: d.productId },
          data: { cost: newCost },
        })
        await tx.financeEntry.create({
          data: {
            type: 'COMPRA',
            category: 'Inventario',
            description: `Compra de ${item.product.name} (${qty} ${item.product.unit})`,
            amount: qty * newCost,
            currency: 'CUP',
            reference: d.reference || null,
            userId: user.id,
          },
        })
      }

      if (d.type === 'MERMA') {
        await tx.financeEntry.create({
          data: {
            type: 'MERMA',
            category: 'Merma',
            description: `Merma de ${item.product.name} (${qty} ${item.product.unit})`,
            amount: qty * item.product.cost,
            currency: 'CUP',
            userId: user.id,
          },
        })
      }
    })

    await audit({
      userId: user.id,
      action: 'STOCK_MOVEMENT',
      entity: 'inventory',
      entityId: d.productId,
      before: { stock: before, type: d.type, qty: d.quantity },
      after: { stock: after },
    })

    const updated = await db.inventoryItem.findUnique({
      where: { productId: d.productId },
      include: { product: true },
    })

    return NextResponse.json({ ok: true, item: updated })
  } catch (e: any) {
    console.error('POST /api/admin/inventario-general', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
