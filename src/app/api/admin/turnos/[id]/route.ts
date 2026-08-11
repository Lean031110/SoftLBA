// PATCH /api/admin/turnos/[id] - Cerrar turno (registrar closingCash, endTime)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { hasPerm, PERMISSIONS } from '@/lib/permissions/permissions-v2'
import { z } from 'zod'

const PatchSchema = z.object({
  closingCash: z.coerce.number().min(0).optional(),
  observations: z.string().max(500).optional().or(z.literal('')),
  // status solo puede pasarse a CLOSED (no se puede reabrir por esta vía)
  status: z.literal('CLOSED').optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!hasPerm(user.role, PERMISSIONS.DAILY_CLOSE)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    const { id } = await params

    const existing = await db.workShift.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Turno no encontrado' }, { status: 404 })
    }
    if (existing.status === 'CLOSED') {
      return NextResponse.json({ ok: false, error: 'El turno ya está cerrado' }, { status: 400 })
    }

    // Un usuario solo puede cerrar su propio turno, salvo ADMIN
    if (user.role !== 'ADMIN' && existing.userId !== user.id) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const json = await req.json().catch(() => ({}))
    const parsed = PatchSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' },
        { status: 400 },
      )
    }
    const d = parsed.data

    const updated = await db.workShift.update({
      where: { id },
      data: {
        status: 'CLOSED',
        endTime: new Date(),
        closingCash: d.closingCash !== undefined ? d.closingCash : existing.closingCash,
        observations: d.observations !== undefined ? d.observations || null : existing.observations,
      },
      include: {
        user: { select: { id: true, username: true, firstName: true, lastName: true, role: true } },
        area: { select: { id: true, name: true, code: true } },
      },
    })

    await audit({
      userId: user.id,
      action: 'WORK_SHIFT_CLOSE',
      entity: 'work-shift',
      entityId: id,
      before: {
        status: existing.status,
        openingCash: existing.openingCash,
      },
      after: {
        status: updated.status,
        endTime: updated.endTime,
        closingCash: updated.closingCash,
        observations: updated.observations,
      },
    })

    return NextResponse.json({ ok: true, item: updated })
  } catch (e: any) {
    console.error('PATCH /api/admin/turnos/[id]', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
