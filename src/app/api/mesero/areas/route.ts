// GET /api/mesero/areas - Áreas activas donde el mesero puede operar
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN', 'MESERO', 'MESERO_PRO'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    // El mesero solo puede operar en SALON y PIZZERIA
    const allowedCodes = ['SALON', 'PIZZERIA']
    const where: any = { isActive: true }
    if (user.role !== 'ADMIN') {
      where.code = { in: allowedCodes }
    }

    const areas = await db.area.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isActive: true,
      },
    })

    return NextResponse.json({ ok: true, items: areas })
  } catch (e: any) {
    console.error('GET /api/mesero/areas', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
