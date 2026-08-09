// GET /api/admin/cierre-diario/current - Cierre de hoy o el último abierto
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN', 'CAJERO'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    // Hoy
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayClose = await db.dailyClose.findUnique({
      where: { date: today },
      include: {
        user: { select: { id: true, username: true, firstName: true, lastName: true } },
        areas: { include: { area: true } },
        denominations: true,
      },
    })

    if (todayClose) {
      return NextResponse.json({ ok: true, item: todayClose })
    }

    // Último abierto
    const lastOpen = await db.dailyClose.findFirst({
      where: { status: { in: ['ABIERTO', 'EN_PROCESO'] } },
      include: {
        user: { select: { id: true, username: true, firstName: true, lastName: true } },
        areas: { include: { area: true } },
        denominations: true,
      },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json({ ok: true, item: lastOpen })
  } catch (e: any) {
    console.error('GET /api/admin/cierre-diario/current', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
