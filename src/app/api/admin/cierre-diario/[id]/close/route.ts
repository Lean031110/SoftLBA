// POST /api/admin/cierre-diario/[id]/close - Cerrar/bloquear
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'

const CloseSchema = z.object({
  action: z.enum(['close', 'lock']),
  observations: z.string().max(1000).optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN', 'CAJERO'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const json = await req.json().catch(() => ({}))
    const parsed = CloseSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    }
    const d = parsed.data

    const close = await db.dailyClose.findUnique({ where: { id } })
    if (!close) {
      return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })
    }

    if (d.action === 'close') {
      if (close.status === 'CERRADO' || close.status === 'BLOQUEADO') {
        return NextResponse.json({ ok: false, error: 'Ya está cerrado' }, { status: 400 })
      }
      const updated = await db.dailyClose.update({
        where: { id },
        data: {
          status: 'CERRADO',
          closedAt: new Date(),
          observations: d.observations || close.observations,
        },
      })
      await audit({
        userId: user.id,
        action: 'CLOSE_DAILY',
        entity: 'daily-close',
        entityId: id,
        after: { status: 'CERRADO' },
      })
      return NextResponse.json({ ok: true, item: updated })
    } else if (d.action === 'lock') {
      if (user.role !== 'ADMIN') {
        return NextResponse.json({ ok: false, error: 'Solo admin puede bloquear' }, { status: 403 })
      }
      if (close.status !== 'CERRADO') {
        return NextResponse.json({ ok: false, error: 'Debe estar cerrado primero' }, { status: 400 })
      }
      const updated = await db.dailyClose.update({
        where: { id },
        data: { status: 'BLOQUEADO' },
      })
      await audit({
        userId: user.id,
        action: 'LOCK_DAILY',
        entity: 'daily-close',
        entityId: id,
        after: { status: 'BLOQUEADO' },
      })
      return NextResponse.json({ ok: true, item: updated })
    }

    return NextResponse.json({ ok: false, error: 'Acción inválida' }, { status: 400 })
  } catch (e: any) {
    console.error('POST /api/admin/cierre-diario/[id]/close', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
