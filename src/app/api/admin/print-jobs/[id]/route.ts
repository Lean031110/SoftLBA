// PATCH /api/admin/print-jobs/[id] - Reintentar o cancelar usando PrintService
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { retryPrintJob, cancelPrintJob } from '@/lib/print/print-service'

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

  if (action === 'retry') {
    const result = await retryPrintJob(id)
    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  }
  if (action === 'cancel') {
    await cancelPrintJob(id)
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ ok: false, error: 'Acción inválida' }, { status: 400 })
}
