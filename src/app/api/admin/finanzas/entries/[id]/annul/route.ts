// POST /api/admin/finanzas/entries/[id]/annul - Anular entrada financiera (FIX 21-22)
// ------------------------------------------------------------
// Recibe:
//   reason: string (motivo de anulación, obligatorio)
// Efectos:
//   - Marca la entrada original como status=ANNULLED, annulledById=<user>,
//     annulledAt=now(), annulReason=<reason>.
//   - Crea una entrada compensatoria (type EGRESO si original era INGRESO/VENTA,
//     o type INGRESO si original era EGRESO/GASTO/SALARIO/MERMA/AJUSTE/COMPRA),
//     con el mismo monto, moneda, categoría y referencia al original.
//   - Enlaza ambas entradas vía `annulCompensationEntryId` en la original y
//     `compensatedBy` en la nueva.
//   - Audit log con before/after de ambas entradas.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { hasPerm, PERMISSIONS } from '@/lib/permissions/permissions-v2'
import { z } from 'zod'

const AnnulSchema = z.object({
  reason: z.string().min(3, 'Motivo de anulación obligatorio (mínimo 3 caracteres)').max(500),
})

// Tipo opuesto para la entrada compensatoria:
//   INGRESO/VENTA → EGRESO (devolución)
//   EGRESO/GASTO/SALARIO/MERMA/AJUSTE/COMPRA → INGRESO (reembolso)
function compensationType(t: string): 'INGRESO' | 'EGRESO' {
  if (t === 'INGRESO' || t === 'VENTA') return 'EGRESO'
  return 'INGRESO'
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!hasPerm(user.role, PERMISSIONS.FINANCE_EDIT)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    const { id } = await params

    const existing = await db.financeEntry.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Entrada no encontrada' }, { status: 404 })
    }
    if (existing.status === 'ANNULLED') {
      return NextResponse.json({ ok: false, error: 'La entrada ya está anulada' }, { status: 400 })
    }

    const json = await req.json().catch(() => null)
    if (!json) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
    const parsed = AnnulSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' },
        { status: 400 },
      )
    }
    const d = parsed.data

    const compType = compensationType(existing.type)
    const compDescription = `[Anulación] ${existing.description}`

    // Transacción: anular original + crear compensatoria + enlazar
    const [annulled, compensation] = await db.$transaction(async (tx) => {
      const comp = await tx.financeEntry.create({
        data: {
          type: compType,
          category: existing.category,
          description: compDescription,
          amount: existing.amount,
          currency: existing.currency,
          reference: existing.reference,
          userId: user.id,
          orderId: existing.orderId,
          dailyCloseId: existing.dailyCloseId,
          status: 'ACTIVE',
        },
      })
      const ann = await tx.financeEntry.update({
        where: { id },
        data: {
          status: 'ANNULLED',
          annulledById: user.id,
          annulledAt: new Date(),
          annulReason: d.reason,
          annulCompensationEntryId: comp.id,
        },
      })
      return [ann, comp] as const
    })

    await audit({
      userId: user.id,
      action: 'FINANCE_ENTRY_ANNUL',
      entity: 'finance-entry',
      entityId: id,
      before: {
        status: existing.status,
        type: existing.type,
        amount: existing.amount,
        currency: existing.currency,
      },
      after: {
        status: annulled.status,
        annulReason: annulled.annulReason,
        annulledAt: annulled.annulledAt,
        compensationEntryId: compensation.id,
        compensationType: compensation.type,
        compensationAmount: compensation.amount,
      },
    })

    return NextResponse.json({
      ok: true,
      annulled,
      compensation,
    })
  } catch (e: any) {
    console.error('POST /api/admin/finanzas/entries/[id]/annul', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
