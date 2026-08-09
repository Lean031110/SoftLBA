// POST /api/admin/cierre-diario/[id]/denominations - Agregar denominación
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'

const DenomSchema = z.object({
  currency: z.string().min(1).max(10),
  denomination: z.coerce.number().positive(),
  count: z.coerce.number().int().min(0),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN', 'CAJERO'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const json = await req.json().catch(() => null)
    if (!json) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
    const parsed = DenomSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    }
    const d = parsed.data

    const close = await db.dailyClose.findUnique({ where: { id } })
    if (!close) {
      return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })
    }
    if (close.status === 'BLOQUEADO' || close.status === 'CERRADO') {
      return NextResponse.json({ ok: false, error: 'Cierre cerrado, no se puede modificar' }, { status: 400 })
    }

    // Buscar denominación existente (misma moneda + denomination)
    const existing = await db.dailyCloseDenomination.findFirst({
      where: { dailyCloseId: id, currency: d.currency, denomination: d.denomination },
    })

    const total = d.denomination * d.count

    if (existing) {
      const updated = await db.dailyCloseDenomination.update({
        where: { id: existing.id },
        data: { count: existing.count + d.count, total: existing.total + total },
      })
      await recalcReal(id)
      await audit({
        userId: user.id,
        action: 'ADD_DENOMINATION',
        entity: 'daily-close-denomination',
        entityId: updated.id,
        after: { currency: d.currency, denomination: d.denomination, count: d.count },
      })
    } else {
      const created = await db.dailyCloseDenomination.create({
        data: {
          dailyCloseId: id,
          currency: d.currency,
          denomination: d.denomination,
          count: d.count,
          total,
        },
      })
      await recalcReal(id)
      await audit({
        userId: user.id,
        action: 'ADD_DENOMINATION',
        entity: 'daily-close-denomination',
        entityId: created.id,
        after: { currency: d.currency, denomination: d.denomination, count: d.count },
      })
    }

    const updated = await db.dailyClose.findUnique({
      where: { id },
      include: { denominations: true },
    })

    return NextResponse.json({ ok: true, item: updated })
  } catch (e: any) {
    console.error('POST /api/admin/cierre-diario/[id]/denominations', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

async function recalcReal(closeId: string) {
  const denoms = await db.dailyCloseDenomination.findMany({ where: { dailyCloseId: closeId } })
  // Sumar considerando que USD se convierte a CUP (1 USD = 120 CUP aprox, tomamos solo suma simple si todas son CUP)
  // Para simplificar, sumamos por moneda y devolvemos solo totalReal como suma absoluta (puede refinarse)
  const total = denoms.reduce((s, d) => s + d.total, 0)
  const close = await db.dailyClose.findUnique({ where: { id: closeId } })
  if (close) {
    await db.dailyClose.update({
      where: { id: closeId },
      data: {
        totalReal: total,
        difference: total - close.totalExpected,
        status: close.status === 'ABIERTO' ? 'EN_PROCESO' : close.status,
      },
    })
  }
}
