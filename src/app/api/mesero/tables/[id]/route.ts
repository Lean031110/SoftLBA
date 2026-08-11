// PATCH /api/mesero/tables/[id] - Cambiar estado de una mesa
//   Estados válidos: LIBRE, OCUPADA, RESERVADA, ESPERANDO_CUENTA, LIMPIEZA
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { hasPerm, PERMISSIONS } from '@/lib/permissions/permissions-v2'
import { z } from 'zod'

const TABLE_STATUSES = [
  'LIBRE',
  'OCUPADA',
  'RESERVADA',
  'ESPERANDO_CUENTA',
  'LIMPIEZA',
] as const

const PatchSchema = z.object({
  status: z.enum(TABLE_STATUSES),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    // Solo meseros/admin pueden cambiar el estado de la mesa.
    if (!hasPerm(user.role, PERMISSIONS.ORDER_CREATE)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    const { id } = await params

    const existing = await db.table.findUnique({ where: { id } })
    if (!existing || !existing.isActive) {
      return NextResponse.json({ ok: false, error: 'Mesa no encontrada o inactiva' }, { status: 404 })
    }

    const json = await req.json().catch(() => null)
    if (!json) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
    const parsed = PatchSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || 'Estado inválido' },
        { status: 400 },
      )
    }
    const d = parsed.data

    const updated = await db.table.update({
      where: { id },
      data: { status: d.status },
    })

    await audit({
      userId: user.id,
      action: 'TABLE_STATUS_CHANGE',
      entity: 'table',
      entityId: id,
      before: { status: existing.status },
      after: { status: updated.status },
    })

    return NextResponse.json({ ok: true, item: updated })
  } catch (e: any) {
    console.error('PATCH /api/mesero/tables/[id]', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
