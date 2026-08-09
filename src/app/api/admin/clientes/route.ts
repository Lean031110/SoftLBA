// GET /api/admin/clientes - Lista con búsqueda
// POST /api/admin/clientes - Crear
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
    const q = (searchParams.get('q') || '').trim()

    const where: any = {}
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { phone: { contains: q } },
        { email: { contains: q } },
      ]
    }

    const items = await db.customer.findMany({
      where,
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ ok: true, items })
  } catch (e: any) {
    console.error('GET /api/admin/clientes', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().max(40).optional().or(z.literal('')),
  email: z.string().email().max(120).optional().or(z.literal('')),
  address: z.string().max(300).optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
  preferences: z.string().max(500).optional().or(z.literal('')),
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

    const created = await db.customer.create({
      data: {
        name: d.name,
        phone: d.phone || null,
        email: d.email || null,
        address: d.address || null,
        notes: d.notes || null,
        preferences: d.preferences || null,
      },
    })

    await audit({
      userId: user.id,
      action: 'CREATE',
      entity: 'customer',
      entityId: created.id,
      after: created,
    })

    return NextResponse.json({ ok: true, item: created })
  } catch (e: any) {
    console.error('POST /api/admin/clientes', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
