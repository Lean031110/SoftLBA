// GET/DELETE/PATCH /api/admin/printers/[id] - CRUD individual
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { z } from 'zod'

const PatchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  areaId: z.string().optional().or(z.literal('')),
  ipAddress: z.string().max(100).optional().or(z.literal('')),
  port: z.coerce.number().min(1).max(65535).optional(),
  protocol: z.enum(['ESCPOS', 'CUPS', 'RAW']).optional(),
  paperWidth: z.coerce.number().min(58).max(80).optional(),
  charsPerLine: z.coerce.number().min(16).max(64).optional(),
  header: z.string().max(500).optional().or(z.literal('')),
  footer: z.string().max(500).optional().or(z.literal('')),
  copies: z.coerce.number().min(1).max(10).optional(),
  isActive: z.boolean().optional(),
  model: z.string().max(100).optional().or(z.literal('')),
  location: z.string().max(100).optional().or(z.literal('')),
  fallbackPrinterId: z.string().optional().or(z.literal('')),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })

  const { id } = await params
  const printer = await db.printer.findUnique({
    where: { id },
    include: {
      area: { select: { id: true, name: true, code: true } },
      fallbackPrinter: { select: { id: true, name: true } },
    },
  })
  if (!printer) return NextResponse.json({ ok: false, error: 'No encontrada' }, { status: 404 })
  return NextResponse.json({ ok: true, item: printer })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
  }
  const d = parsed.data

  const data: any = {}
  if (d.name !== undefined) data.name = d.name
  if (d.areaId !== undefined) data.areaId = d.areaId || null
  if (d.ipAddress !== undefined) data.ipAddress = d.ipAddress || null
  if (d.port !== undefined) data.port = d.port
  if (d.protocol !== undefined) data.protocol = d.protocol
  if (d.paperWidth !== undefined) data.paperWidth = d.paperWidth
  if (d.charsPerLine !== undefined) data.charsPerLine = d.charsPerLine
  if (d.header !== undefined) data.header = d.header || null
  if (d.footer !== undefined) data.footer = d.footer || null
  if (d.copies !== undefined) data.copies = d.copies
  if (d.isActive !== undefined) data.isActive = d.isActive
  if (d.model !== undefined) data.model = d.model || null
  if (d.location !== undefined) data.location = d.location || null
  if (d.fallbackPrinterId !== undefined) data.fallbackPrinterId = d.fallbackPrinterId || null

  const printer = await db.printer.update({ where: { id }, data })
  return NextResponse.json({ ok: true, item: printer })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })

  const { id } = await params
  await db.printer.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
