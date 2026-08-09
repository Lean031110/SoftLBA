// GET /api/admin/cierre-diario/[id] - Detalle del cierre
// PATCH /api/admin/cierre-diario/[id] - Actualizar observaciones / conteo
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN', 'CAJERO', 'MESERO_PRO'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const close = await db.dailyClose.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, firstName: true, lastName: true } },
        areas: { include: { area: true } },
        denominations: { orderBy: { currency: 'asc' } },
        financeEntries: { orderBy: { createdAt: 'desc' } },
      },
    })

    if (!close) {
      return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, item: close })
  } catch (e: any) {
    console.error('GET /api/admin/cierre-diario/[id]', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

const PatchSchema = z.object({
  observations: z.string().max(1000).optional(),
  totalReal: z.coerce.number().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN', 'CAJERO', 'MESERO_PRO'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const json = await req.json().catch(() => null)
    if (!json) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
    const parsed = PatchSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    }
    const d = parsed.data

    const close = await db.dailyClose.findUnique({ where: { id } })
    if (!close) {
      return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })
    }
    if (close.status === 'BLOQUEADO') {
      return NextResponse.json({ ok: false, error: 'Cierre bloqueado, no se puede modificar' }, { status: 400 })
    }

    const data: any = {}
    if (d.observations !== undefined) data.observations = d.observations || null
    if (d.totalReal !== undefined) {
      data.totalReal = d.totalReal
      data.difference = d.totalReal - close.totalExpected
      if (close.status === 'ABIERTO') data.status = 'EN_PROCESO'
    }

    const updated = await db.dailyClose.update({ where: { id }, data })

    await audit({
      userId: user.id,
      action: 'UPDATE_DAILY_CLOSE',
      entity: 'daily-close',
      entityId: id,
      after: data,
    })

    return NextResponse.json({ ok: true, item: updated })
  } catch (e: any) {
    console.error('PATCH /api/admin/cierre-diario/[id]', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
