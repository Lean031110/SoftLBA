// POST /api/admin/cierre-diario/[id]/recalc - Recalcula totales del cierre
// Útil cuando se abrió el cierre y después llegaron más pedidos
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'

function dayStart(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
function dayEnd(d: Date) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN', 'CAJERO', 'MESERO_PRO'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const close = await db.dailyClose.findUnique({ where: { id } })
    if (!close) return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })
    if (close.status === 'BLOQUEADO') {
      return NextResponse.json({ ok: false, error: 'Cierre bloqueado' }, { status: 400 })
    }

    const start = dayStart(close.date)
    const end = dayEnd(close.date)

    const payments = await db.payment.findMany({
      where: { createdAt: { gte: start, lte: end } },
      include: { order: { select: { areaId: true, discountAmount: true } } },
    })

    let totalSales = 0
    let totalCash = 0
    let totalTransfer = 0
    let totalOther = 0
    let totalDiscount = 0
    const areaTotals = new Map<string, { total: number; count: number }>()

    for (const p of payments) {
      totalSales += p.amount
      if (p.method === 'EFECTIVO_CUP' || p.method === 'EFECTIVO_USD') totalCash += p.amount
      else if (p.method.startsWith('TRANSFERENCIA') || p.method === 'ZELLE' || p.method === 'BANCARIA_USD') totalTransfer += p.amount
      else totalOther += p.amount

      if (p.order) {
        totalDiscount += p.order.discountAmount || 0
        const aId = p.order.areaId
        if (!areaTotals.has(aId)) areaTotals.set(aId, { total: 0, count: 0 })
        const at = areaTotals.get(aId)!
        at.total += p.amount
        at.count += 1
      }
    }

    const mermas = await db.financeEntry.findMany({
      where: { type: 'MERMA', createdAt: { gte: start, lte: end } },
      select: { amount: true },
    })
    const totalWaste = mermas.reduce((s, m) => s + m.amount, 0)

    // Recalcular areas (limpiar y recrear)
    await db.dailyCloseArea.deleteMany({ where: { dailyCloseId: id } })
    for (const [areaId, v] of areaTotals.entries()) {
      await db.dailyCloseArea.create({
        data: { dailyCloseId: id, areaId, total: v.total, ordersCount: v.count },
      })
    }

    const updated = await db.dailyClose.update({
      where: { id },
      data: {
        totalSales,
        totalCash,
        totalTransfer,
        totalOther,
        totalDiscount,
        totalWaste,
        totalExpected: totalCash,
        difference: close.totalReal - totalCash,
      },
      include: {
        areas: { include: { area: true } },
        denominations: true,
      },
    })

    await audit({
      userId: user.id,
      action: 'RECALC_DAILY_CLOSE',
      entity: 'daily-close',
      entityId: id,
      before: { totalSales: close.totalSales, totalCash: close.totalCash, totalExpected: close.totalExpected },
      after: { totalSales, totalCash, totalExpected: totalCash },
      result: 'SUCCESS',
    })

    return NextResponse.json({ ok: true, item: updated })
  } catch (e: any) {
    console.error('POST /api/admin/cierre-diario/[id]/recalc', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
