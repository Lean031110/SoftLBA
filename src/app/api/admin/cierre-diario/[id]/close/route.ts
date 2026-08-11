// POST /api/admin/cierre-diario/[id]/close - Cerrar/bloquear
// Al cerrar: crea entradas en FinanceEntry con el resumen del día (ventas por método, mermas)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'
import { breakdownPayments } from '@/lib/currency'

const CloseSchema = z.object({
  action: z.enum(['close', 'lock']),
  observations: z.string().max(1000).optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN', 'CAJERO', 'MESERO_PRO'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const json = await req.json().catch(() => ({}))
    const parsed = CloseSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    }
    const d = parsed.data

    const close = await db.dailyClose.findUnique({
      where: { id },
      include: { areas: true },
    })
    if (!close) {
      return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })
    }

    if (d.action === 'close') {
      if (close.status === 'CERRADO' || close.status === 'BLOQUEADO') {
        return NextResponse.json({ ok: false, error: 'Ya está cerrado' }, { status: 400 })
      }

      // Recalcular totales finales antes de cerrar
      const start = new Date(close.date)
      start.setHours(0, 0, 0, 0)
      const end = new Date(close.date)
      end.setHours(23, 59, 59, 999)

      const payments = await db.payment.findMany({
        where: { createdAt: { gte: start, lte: end } },
      })

      // Cargar tasa USD→CUP configurada (default 320)
      const config = await db.restaurantConfig.findFirst()
      const usdToCupRate = config?.usdToCup || 320

      // Calcular ventas por método y moneda usando librería de conversión
      const breakdown = breakdownPayments(payments, usdToCupRate)
      const methodTotals: Record<string, number> = { ...breakdown.byMethod }

      // Totales agregados (en CUP equivalente) para persistir en DailyClose
      const totalCash = breakdown.totalCashCUP + breakdown.totalCashUSD * usdToCupRate
      const totalTransfer =
        breakdown.totalTransferCUP + breakdown.totalTransferUSD * usdToCupRate
      const totalOther = breakdown.totalOther
      const totalSales = breakdown.totalCUP

      // Mermas del día
      const mermas = await db.financeEntry.findMany({
        where: { type: 'MERMA', createdAt: { gte: start, lte: end } },
        select: { amount: true },
      })
      const totalWaste = mermas.reduce((s, m) => s + m.amount, 0)

      // Cerrar y crear entradas en FinanceEntry en una transacción
      const updated = await db.$transaction(async (tx) => {
        // Actualizar el cierre con los totales finales
        const closeUpdated = await tx.dailyClose.update({
          where: { id },
          data: {
            status: 'CERRADO',
            closedAt: new Date(),
            observations: d.observations || close.observations,
            totalSales,
            totalCash,
            totalTransfer,
            totalOther,
            totalWaste,
            totalExpected: totalCash,
            difference: close.totalReal - totalCash,
          },
        })

        // Borrar entradas anteriores del mismo cierre (si se reabre y vuelve a cerrar)
        await tx.financeEntry.deleteMany({
          where: { dailyCloseId: id },
        })

        // Crear entradas en FinanceEntry por cada método de pago con ventas
        const methodLabels: Record<string, string> = {
          EFECTIVO_CUP: 'Ventas en Efectivo CUP',
          EFECTIVO_USD: 'Ventas en Efectivo USD',
          TRANSFERENCIA_CUP: 'Ventas por Transferencia CUP',
          TRANSFERENCIA_USD: 'Ventas por Transferencia USD',
          ZELLE: 'Ventas por Zelle',
          BANCARIA_USD: 'Ventas Bancarias USD',
          COMBINADO: 'Ventas con Pago Combinado',
        }

        for (const [method, amount] of Object.entries(methodTotals)) {
          if (amount <= 0) continue
          await tx.financeEntry.create({
            data: {
              type: 'VENTA',
              category: method,
              description: `${methodLabels[method] || method} - Cierre del ${close.date.toLocaleDateString('es-CU')}`,
              amount,
              currency: method.includes('USD') ? 'USD' : 'CUP',
              reference: id,
              userId: user.id,
              dailyCloseId: id,
            },
          })
        }

        // Si hubo mermas, crear entrada resumen de mermas
        if (totalWaste > 0) {
          await tx.financeEntry.create({
            data: {
              type: 'MERMA',
              category: 'RESUMEN_MERMAS',
              description: `Total de mermas del día - Cierre del ${close.date.toLocaleDateString('es-CU')}`,
              amount: totalWaste,
              currency: 'CUP',
              reference: id,
              userId: user.id,
              dailyCloseId: id,
            },
          })
        }

        return closeUpdated
      })

      await audit({
        userId: user.id,
        action: 'CLOSE_DAILY',
        entity: 'daily-close',
        entityId: id,
        after: {
          status: 'CERRADO',
          totalSales,
          totalCash,
          totalTransfer,
          totalWaste,
          totalCashCUP: breakdown.totalCashCUP,
          totalCashUSD: breakdown.totalCashUSD,
          totalTransferCUP: breakdown.totalTransferCUP,
          totalTransferUSD: breakdown.totalTransferUSD,
          usdToCupRate,
        },
      })
      return NextResponse.json({ ok: true, item: updated })
    } else if (d.action === 'lock') {
      if (user.role !== 'ADMIN') {
        return NextResponse.json({ ok: false, error: 'Solo admin puede bloquear' }, { status: 403 })
      }
      if (close.status !== 'CERRADO') {
        return NextResponse.json({ ok: false, error: 'Debe estar cerrado primero' }, { status: 400 })
      }
      const updated = await db.dailyClose.update({
        where: { id },
        data: { status: 'BLOQUEADO' },
      })
      await audit({
        userId: user.id,
        action: 'LOCK_DAILY',
        entity: 'daily-close',
        entityId: id,
        after: { status: 'BLOQUEADO' },
      })
      return NextResponse.json({ ok: true, item: updated })
    }

    return NextResponse.json({ ok: false, error: 'Acción inválida' }, { status: 400 })
  } catch (e: any) {
    console.error('POST /api/admin/cierre-diario/[id]/close', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
