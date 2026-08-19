// POST /api/admin/printers/[id]/test - Probar impresora
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { testPrinter } from '@/lib/print/print-service'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })

  const { id } = await params
  const result = await testPrinter(id)
  return NextResponse.json(result, { status: result.ok ? 200 : 503 })
}
