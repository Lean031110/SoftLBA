// GET /api/admin/print-jobs - Listar cola de impresión
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || ''

  const where: any = {}
  if (status) where.status = status

  const jobs = await db.printJob.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      order: { select: { id: true, number: true, tableId: true } },
      area: { select: { id: true, name: true, code: true } },
      printer: { select: { id: true, name: true } },
    },
  })
  return NextResponse.json({ ok: true, items: jobs })
}
