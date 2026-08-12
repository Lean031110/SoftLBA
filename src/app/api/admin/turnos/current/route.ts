// GET /api/admin/turnos/current - Turno actual del usuario logueado
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPerm, PERMISSIONS } from '@/lib/permissions/permissions-v2'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!hasPerm(user.role, PERMISSIONS.DAILY_CLOSE)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const current = await db.workShift.findFirst({
      where: { userId: user.id, status: 'OPEN' },
      orderBy: { startTime: 'desc' },
      include: {
        user: { select: { id: true, username: true, firstName: true, lastName: true, role: true } },
        area: { select: { id: true, name: true, code: true } },
      },
    })

    return NextResponse.json({ ok: true, item: current })
  } catch (e: any) {
    console.error('GET /api/admin/turnos/current', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
