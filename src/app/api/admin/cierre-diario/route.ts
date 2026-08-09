// GET /api/admin/cierre-diario - Lista de cierres
// POST /api/admin/cierre-diario - Abrir nuevo cierre
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN', 'CAJERO', 'MESERO_PRO'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(100, Math.max(10, parseInt(searchParams.get('pageSize') || '20', 10)))

    const [total, items] = await Promise.all([
      db.dailyClose.count(),
      db.dailyClose.findMany({
        include: {
          user: { select: { id: true, username: true, firstName: true, lastName: true } },
          areas: { include: { area: { select: { id: true, name: true, code: true } } } },
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return NextResponse.json({
      ok: true,
      items,
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    })
  } catch (e: any) {
    console.error('GET /api/admin/cierre-diario', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

const OpenSchema = z.object({
  date: z.string().optional(),
  observations: z.string().max(500).optional().or(z.literal('')),
})

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

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN', 'CAJERO', 'MESERO_PRO'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const json = await req.json().catch(() => ({}))
    const parsed = OpenSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    }
    const d = parsed.data

    const date = d.date ? dayStart(new Date(d.date + 'T00:00:00')) : dayStart(new Date())

    const existing = await db.dailyClose.findUnique({ where: { date } })
    if (existing) {
      return NextResponse.json({ ok: false, error: 'Ya existe un cierre para esa fecha' }, { status: 400 })
    }

    // Calcular totales del día (pagos + financeEntries)
    const start = date
    const end = dayEnd(date)

    const payments = await db.payment.findMany({
      where: { createdAt: { gte: start, lte: end } },
      include: { order: { select: { areaId: true, discountAmount: true, total: true } } },
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

    // Sumar mermas del día
    const mermas = await db.financeEntry.findMany({
      where: {
        type: 'MERMA',
        createdAt: { gte: start, lte: end },
      },
      select: { amount: true },
    })
    const totalWaste = mermas.reduce((s, m) => s + m.amount, 0)

    const totalExpected = totalCash // El efectivo esperado en caja es solo el efectivo

    const created = await db.$transaction(async (tx) => {
      const close = await tx.dailyClose.create({
        data: {
          date,
          userId: user.id,
          status: 'ABIERTO',
          totalSales,
          totalCash,
          totalTransfer,
          totalOther,
          totalDiscount,
          totalWaste,
          totalExpected,
          totalReal: 0,
          difference: -totalExpected,
          observations: d.observations || null,
        },
      })

      // Crear DailyCloseArea para cada área con ventas
      for (const [areaId, v] of areaTotals.entries()) {
        await tx.dailyCloseArea.create({
          data: {
            dailyCloseId: close.id,
            areaId,
            total: v.total,
            ordersCount: v.count,
          },
        })
      }

      return close
    })

    await audit({
      userId: user.id,
      action: 'OPEN_DAILY_CLOSE',
      entity: 'daily-close',
      entityId: created.id,
      after: { date, totalSales, totalCash },
    })

    return NextResponse.json({ ok: true, item: created })
  } catch (e: any) {
    console.error('POST /api/admin/cierre-diario', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
