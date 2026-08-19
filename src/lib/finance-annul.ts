// ============================================================
// v1.0-RC1-bloque2-3 (item 23) — Helper compartido de anulación
// ============================================================
// Lógica extraída de POST /api/admin/finanzas/entries/[id]/annul
// para que DELETE /api/admin/finanzas/entries/[id] pueda reusarla sin
// duplicar código.
//
// Efectos:
//   - Marca la entrada original como status=ANNULLED, annulledById=<user>,
//     annulledAt=now(), annulReason=<reason>.
//   - Crea una entrada compensatoria (EGRESO si era INGRESO/VENTA, o
//     INGRESO si era EGRESO/GASTO/SALARIO/MERMA/AJUSTE/COMPRA), con el
//     mismo monto, moneda, categoría y referencia al original.
//   - Enlaza ambas entradas vía `annulCompensationEntryId` (en la original)
//     y `compensatedBy` (en la nueva).
//   - Propaga `exchangeRate` / `convertedAmount` / `baseCurrency` de la
//     entrada original a la compensatoria para mantener consistencia
//     contable (item 22).
// ============================================================

import { db } from '@/lib/db'

function compensationType(t: string): 'INGRESO' | 'EGRESO' {
  if (t === 'INGRESO' || t === 'VENTA') return 'EGRESO'
  return 'INGRESO'
}

export interface AnnulResult {
  annulled: any
  compensation: any
}

export async function annulFinanceEntry(
  entryId: string,
  userId: string,
  reason: string,
): Promise<AnnulResult> {
  const existing = await db.financeEntry.findUnique({ where: { id: entryId } })
  if (!existing) {
    throw new AnnulError('NOT_FOUND', 'Entrada no encontrada')
  }
  if (existing.status === 'ANNULLED') {
    throw new AnnulError('ALREADY_ANNULLED', 'La entrada ya está anulada')
  }

  const compType = compensationType(existing.type)
  const compDescription = `[Anulación] ${existing.description}`

  const [annulled, compensation] = await db.$transaction(async (tx) => {
    const comp = await tx.financeEntry.create({
      data: {
        type: compType,
        category: existing.category,
        description: compDescription,
        amount: existing.amount,
        currency: existing.currency,
        // v1.0-RC1-bloque2-3 (item 22): mantener snapshot de conversión
        exchangeRate: existing.exchangeRate,
        convertedAmount: existing.convertedAmount,
        baseCurrency: existing.baseCurrency,
        reference: existing.reference,
        userId,
        orderId: existing.orderId,
        dailyCloseId: existing.dailyCloseId,
        status: 'ACTIVE',
      },
    })
    const ann = await tx.financeEntry.update({
      where: { id: entryId },
      data: {
        status: 'ANNULLED',
        annulledById: userId,
        annulledAt: new Date(),
        annulReason: reason,
        annulCompensationEntryId: comp.id,
      },
    })
    return [ann, comp] as const
  })

  return { annulled, compensation }
}

export class AnnulError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'AnnulError'
  }
}
