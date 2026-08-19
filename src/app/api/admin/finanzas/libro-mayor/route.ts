// GET /api/admin/finanzas/libro-mayor - Libro mayor resumido por categoría
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from') || ''
    const to = searchParams.get('to') || ''

    const where: any = {}
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from + 'T00:00:00')
      if (to) where.createdAt.lte = new Date(to + 'T23:59:59.999')
    }

    const entries = await db.financeEntry.findMany({
      where,
      select: { type: true, category: true, amount: true },
    })

    const map = new Map<string, { type: string; total: number; count: number }>()
    for (const e of entries) {
      const key = `${e.type}|${e.category}`
      if (!map.has(key)) map.set(key, { type: e.type, total: 0, count: 0 })
      const v = map.get(key)!
      v.total += e.amount
      v.count += 1
    }

    const items = Array.from(map.entries()).map(([key, v]) => {
      const [type, category] = key.split('|')
      return { type, category, total: v.total, count: v.count }
    }).sort((a, b) => b.total - a.total)

    return NextResponse.json({ ok: true, items })
  } catch (e: any) {
    console.error('GET /api/admin/finanzas/libro-mayor', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
