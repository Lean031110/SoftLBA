// GET /api/admin/productos - Listar con filtros
// POST /api/admin/productos - Crear
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'

const TYPES = ['DIRECTO', 'FINAL', 'SUBPRODUCTO'] as const

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const type = searchParams.get('type') || ''
    const category = (searchParams.get('category') || '').trim()
    const isActive = searchParams.get('isActive') || ''
    const isAvailable = searchParams.get('isAvailable') || ''

    const where: any = {}
    if (q) {
      where.OR = [
        { code: { contains: q } },
        { name: { contains: q } },
        { description: { contains: q } },
      ]
    }
    if (type && TYPES.includes(type as any)) where.type = type
    if (category) where.category = { contains: category }
    if (isActive === 'true') where.isActive = true
    if (isActive === 'false') where.isActive = false
    if (isAvailable === 'true') where.isAvailable = true
    if (isAvailable === 'false') where.isAvailable = false

    const products = await db.product.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json({ ok: true, items: products })
  } catch (e: any) {
    console.error('GET /api/admin/productos', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

const CreateSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().or(z.literal('')),
  type: z.enum(TYPES),
  category: z.string().max(80).optional().or(z.literal('')),
  unit: z.string().min(1).max(40),
  cost: z.coerce.number().min(0).default(0),
  price: z.coerce.number().min(0).default(0),
  minStock: z.coerce.number().min(0).default(0),
  isActive: z.boolean().default(true),
  isAvailable: z.boolean().default(true),
  imageUrl: z.string().max(500).optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
})

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const json = await req.json().catch(() => null)
    if (!json) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
    const parsed = CreateSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    }
    const d = parsed.data

    const existing = await db.product.findUnique({ where: { code: d.code } })
    if (existing) {
      return NextResponse.json({ ok: false, error: 'El código ya existe' }, { status: 400 })
    }

    const created = await db.product.create({
      data: {
        code: d.code,
        name: d.name,
        description: d.description || null,
        type: d.type,
        category: d.category || null,
        unit: d.unit,
        cost: d.cost,
        price: d.price,
        minStock: d.minStock,
        isActive: d.isActive,
        isAvailable: d.isAvailable,
        imageUrl: d.imageUrl || null,
        notes: d.notes || null,
      },
    })

    await audit({
      userId: user.id,
      action: 'CREATE',
      entity: 'product',
      entityId: created.id,
      after: {
        code: created.code,
        name: created.name,
        type: created.type,
        price: created.price,
        cost: created.cost,
      },
    })

    return NextResponse.json({ ok: true, item: created })
  } catch (e: any) {
    console.error('POST /api/admin/productos', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
