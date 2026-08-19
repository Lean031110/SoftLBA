// POST /api/admin/finanzas/entries/[id]/annul - Anular entrada financiera (FIX 21-22)
// ------------------------------------------------------------
// Recibe:
//   reason: string (motivo de anulación, obligatorio)
// Efectos (ver `src/lib/finance-annul.ts`):
//   - Marca la entrada original como status=ANNULLED, annulledById=<user>,
//     annulledAt=now(), annulReason=<reason>.
//   - Crea una entrada compensatoria (type EGRESO si original era INGRESO/VENTA,
//     o type INGRESO si original era EGRESO/GASTO/SALARIO/MERMA/AJUSTE/COMPRA),
//     con el mismo monto, moneda, categoría y referencia al original.
//   - Enlaza ambas entradas vía `annulCompensationEntryId` en la original y
//     `compensatedBy` en la nueva.
//   - Audit log con before/after de ambas entradas.
//
// v1.0-RC1-bloque2-3 (item 23): la lógica de anulación fue extraída al
// helper `annulFinanceEntry` en `src/lib/finance-annul.ts` para que
// DELETE /api/admin/finanzas/entries/[id] pueda reusarla.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { hasPerm, PERMISSIONS } from '@/lib/permissions/permissions-v2'
import { annulFinanceEntry, AnnulError } from '@/lib/finance-annul'
import { z } from 'zod'

const AnnulSchema = z.object({
  reason: z.string().min(3, 'Motivo de anulación obligatorio (mínimo 3 caracteres)').max(500),
})

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

    const { annulled, compensation } = await annulFinanceEntry(id, user.id, d.reason)

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
    if (e instanceof AnnulError) {
      if (e.code === 'NOT_FOUND') {
        return NextResponse.json({ ok: false, error: e.message }, { status: 404 })
      }
      if (e.code === 'ALREADY_ANNULLED') {
        return NextResponse.json({ ok: false, error: e.message }, { status: 400 })
      }
    }
    console.error('POST /api/admin/finanzas/entries/[id]/annul', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
