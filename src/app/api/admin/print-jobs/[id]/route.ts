// PATCH /api/admin/print-jobs/[id] - Reintentar o cancelar un print job
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const action = body.action // 'retry' | 'cancel'

  const job = await db.printJob.findUnique({ where: { id } })
  if (!job) return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })

  if (action === 'retry') {
    const updated = await db.printJob.update({
      where: { id },
      data: { status: 'PENDING', attempts: job.attempts + 1, error: null },
    })
    return NextResponse.json({ ok: true, item: updated })
  }
  if (action === 'cancel') {
    const updated = await db.printJob.update({
      where: { id },
      data: { status: 'CANCELLED' },
    })
    return NextResponse.json({ ok: true, item: updated })
  }
  return NextResponse.json({ ok: false, error: 'Acción inválida' }, { status: 400 })
}
