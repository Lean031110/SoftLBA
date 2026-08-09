// GET /api/help - Vista pública de artículos activos (para usuarios autenticados)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })

    // Cualquier usuario autenticado puede ver los artículos activos
    const items = await db.helpArticle.findMany({
      where: { isActive: true },
      orderBy: [{ module: 'asc' }, { order: 'asc' }, { title: 'asc' }],
      select: { id: true, module: true, title: true, content: true, order: true },
    })

    return NextResponse.json({ ok: true, items, role: user.role })
  } catch (e: any) {
    console.error('GET /api/help', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
