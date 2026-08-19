// PATCH /api/admin/finanzas/entries/[id] - Actualizar entrada
// DELETE /api/admin/finanzas/entries/[id] - Eliminar entrada
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'

const PatchSchema = z.object({
  type: z.enum(['INGRESO', 'EGRESO', 'GASTO', 'SALARIO']).optional(),
  category: z.string().min(1).max(80).optional(),
  description: z.string().min(1).max(300).optional(),
  amount: z.coerce.number().refine((n) => n !== 0).optional(),
  currency: z.string().max(10).optional(),
  reference: z.string().max(200).optional().or(z.literal('')).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const json = await req.json().catch(() => null)
    if (!json) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
    const parsed = PatchSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    }
    const d = parsed.data

    const existing = await db.financeEntry.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })
    }

    const data: any = {}
    if (d.type !== undefined) data.type = d.type
    if (d.category !== undefined) data.category = d.category
    if (d.description !== undefined) data.description = d.description
    if (d.amount !== undefined) data.amount = Math.abs(d.amount)
    if (d.currency !== undefined) data.currency = d.currency
    if (d.reference !== undefined) data.reference = d.reference || null

    const updated = await db.financeEntry.update({ where: { id }, data })

    await audit({
      userId: user.id,
      action: 'UPDATE',
      entity: 'finance-entry',
      entityId: id,
      before: existing,
      after: updated,
    })

    return NextResponse.json({ ok: true, item: updated })
  } catch (e: any) {
    console.error('PATCH /api/admin/finanzas/entries/[id]', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const existing = await db.financeEntry.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })
    }

    await db.financeEntry.delete({ where: { id } })

    await audit({
      userId: user.id,
      action: 'DELETE',
      entity: 'finance-entry',
      entityId: id,
      before: existing,
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('DELETE /api/admin/finanzas/entries/[id]', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
