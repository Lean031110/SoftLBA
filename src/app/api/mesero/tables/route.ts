// GET /api/mesero/tables - Mesas por área
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN', 'MESERO', 'MESERO_PRO'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const areaId = searchParams.get('areaId') || ''

    const where: any = { isActive: true }
    if (areaId) where.areaId = areaId

    const tables = await db.table.findMany({
      where,
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        areaId: true,
        capacity: true,
        isActive: true,
      },
    })

    return NextResponse.json({ ok: true, items: tables })
  } catch (e: any) {
    console.error('GET /api/mesero/tables', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
