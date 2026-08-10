// GET /api/admin/areas - Lista de áreas activas
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const areas = await db.area.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, description: true },
    })

    return NextResponse.json({ ok: true, items: areas })
  } catch (e: any) {
    console.error('GET /api/admin/areas', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
