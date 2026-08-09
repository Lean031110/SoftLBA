// GET /api/admin/finanzas - Resumen por rango de fechas
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

function parseRange(from: string, to: string) {
  const f = from ? new Date(from + 'T00:00:00') : new Date(new Date().setHours(0, 0, 0, 0))
  const t = to ? new Date(to + 'T23:59:59.999') : new Date(new Date().setHours(23, 59, 59, 999))
  return { gte: f, lte: t }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN', 'CAJERO'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from') || ''
    const to = searchParams.get('to') || ''
    const range = parseRange(from, to)

    const entries = await db.financeEntry.findMany({
      where: { createdAt: { gte: range.gte, lte: range.lte } },
      include: {
        user: { select: { id: true, username: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const totals = entries.reduce((acc, e) => {
      if (e.type === 'INGRESO' || e.type === 'VENTA') acc.ingresos += e.amount
      else acc.egresos += e.amount
      switch (e.type) {
        case 'VENTA': acc.ventas += e.amount; break
        case 'COMPRA': acc.compras += e.amount; break
        case 'SALARIO': acc.salarios += e.amount; break
        case 'MERMA': acc.mermas += e.amount; break
      }
      return acc
    }, { ingresos: 0, egresos: 0, ventas: 0, compras: 0, salarios: 0, mermas: 0 })

    return NextResponse.json({
      ok: true,
      range: { from: range.gte, to: range.lte },
      totals: { ...totals, balance: totals.ingresos - totals.egresos },
      items: entries,
    })
  } catch (e: any) {
    console.error('GET /api/admin/finanzas', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
