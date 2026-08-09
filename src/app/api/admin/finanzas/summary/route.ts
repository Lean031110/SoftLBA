// GET /api/admin/finanzas/summary - Totales por día/rango/semana/mes
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

type Period = 'today' | 'week' | 'month' | 'range'

function getRange(period: Period, from?: string, to?: string) {
  const now = new Date()
  let start: Date
  let end = new Date(now)
  end.setHours(23, 59, 59, 999)

  switch (period) {
    case 'today':
      start = new Date(now)
      start.setHours(0, 0, 0, 0)
      break
    case 'week': {
      // Lunes como inicio de semana
      const day = now.getDay() // 0 dom ... 6 sáb
      const diff = day === 0 ? 6 : day - 1
      start = new Date(now)
      start.setDate(now.getDate() - diff)
      start.setHours(0, 0, 0, 0)
      break
    }
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    case 'range':
    default:
      start = from ? new Date(from + 'T00:00:00') : new Date(now)
      start.setHours(0, 0, 0, 0)
      if (to) {
        end = new Date(to + 'T23:59:59.999')
      }
      break
  }
  return { gte: start, lte: end }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const period = (searchParams.get('period') as Period) || 'today'
    const from = searchParams.get('from') || ''
    const to = searchParams.get('to') || ''
    const range = getRange(period, from, to)

    const entries = await db.financeEntry.findMany({
      where: { createdAt: { gte: range.gte, lte: range.lte } },
      orderBy: { createdAt: 'asc' },
    })

    // Totales por día (gráfico)
    const byDay = new Map<string, { ingresos: number; egresos: number }>()
    for (const e of entries) {
      const dayKey = e.createdAt.toISOString().slice(0, 10)
      if (!byDay.has(dayKey)) byDay.set(dayKey, { ingresos: 0, egresos: 0 })
      const d = byDay.get(dayKey)!
      if (e.type === 'INGRESO' || e.type === 'VENTA') d.ingresos += e.amount
      else d.egresos += e.amount
    }

    const chartData = Array.from(byDay.entries())
      .map(([day, v]) => ({ day, ...v }))
      .sort((a, b) => a.day.localeCompare(b.day))

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
      period,
      range: { from: range.gte, to: range.lte },
      totals: { ...totals, balance: totals.ingresos - totals.egresos, count: entries.length },
      chartData,
    })
  } catch (e: any) {
    console.error('GET /api/admin/finanzas/summary', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
