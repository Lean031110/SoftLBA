// GET /api/admin/finanzas/entries - Lista con filtros
// POST /api/admin/finanzas/entries - Crear ingreso/egreso manual
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'

const TYPES = ['INGRESO', 'EGRESO', 'GASTO', 'SALARIO'] as const

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN', 'CAJERO'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || ''
    const category = (searchParams.get('category') || '').trim()
    const from = searchParams.get('from') || ''
    const to = searchParams.get('to') || ''
    const q = (searchParams.get('q') || '').trim()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(100, Math.max(10, parseInt(searchParams.get('pageSize') || '20', 10)))

    const where: any = {}
    if (type) where.type = type
    if (category) where.category = { contains: category }
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from + 'T00:00:00')
      if (to) where.createdAt.lte = new Date(to + 'T23:59:59.999')
    }
    if (q) {
      where.OR = [
        { description: { contains: q } },
        { reference: { contains: q } },
      ]
    }

    const [total, items] = await Promise.all([
      db.financeEntry.count({ where }),
      db.financeEntry.findMany({
        where,
        include: {
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
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    })
  } catch (e: any) {
    console.error('GET /api/admin/finanzas/entries', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

const CreateSchema = z.object({
  type: z.enum(TYPES),
  category: z.string().min(1).max(80),
  description: z.string().min(1).max(300),
  amount: z.coerce.number().refine((n) => n !== 0, 'Monto debe ser distinto de 0'),
  currency: z.string().max(10).default('CUP'),
  reference: z.string().max(200).optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
})

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN', 'CAJERO'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const json = await req.json().catch(() => null)
    if (!json) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
    const parsed = CreateSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    }
    const d = parsed.data

    const created = await db.financeEntry.create({
      data: {
        type: d.type,
        category: d.category,
        description: d.description,
        amount: Math.abs(d.amount),
        currency: d.currency,
        reference: d.reference || null,
        userId: user.id,
      },
    })

    await audit({
      userId: user.id,
      action: 'CREATE',
      entity: 'finance-entry',
      entityId: created.id,
      after: created,
    })

    return NextResponse.json({ ok: true, item: created })
  } catch (e: any) {
    console.error('POST /api/admin/finanzas/entries', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
