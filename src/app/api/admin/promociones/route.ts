// GET /api/admin/promociones - Lista
// POST /api/admin/promociones - Crear
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const active = searchParams.get('active') || ''
    const type = searchParams.get('type') || ''

    const where: any = {}
    if (active === 'true') where.isActive = true
    if (active === 'false') where.isActive = false
    if (type) where.type = type

    const items = await db.promotion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ ok: true, items })
  } catch (e: any) {
    console.error('GET /api/admin/promociones', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().or(z.literal('')),
  type: z.enum(['GENERAL', 'CLIENTE', 'PRODUCTO']).default('GENERAL'),
  discountPct: z.coerce.number().min(0).max(100).default(0),
  discountAmount: z.coerce.number().min(0).default(0),
  startDate: z.string().min(1),
  endDate: z.string().optional().or(z.literal('')),
  isActive: z.boolean().default(true),
  customerId: z.string().optional().or(z.literal('')),
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
    const parsed = CreateSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    }
    const d = parsed.data

    const created = await db.promotion.create({
      data: {
        name: d.name,
        description: d.description || null,
        type: d.type,
        discountPct: d.discountPct,
        discountAmount: d.discountAmount,
        startDate: new Date(d.startDate + 'T00:00:00'),
        endDate: d.endDate ? new Date(d.endDate + 'T23:59:59') : null,
        isActive: d.isActive,
        customerId: d.customerId || null,
      },
    })

    await audit({
      userId: user.id,
      action: 'CREATE',
      entity: 'promotion',
      entityId: created.id,
      after: created,
    })

    return NextResponse.json({ ok: true, item: created })
  } catch (e: any) {
    console.error('POST /api/admin/promociones', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
