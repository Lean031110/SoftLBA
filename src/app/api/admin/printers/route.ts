// GET /api/admin/printers - Listar impresoras
// POST /api/admin/printers - Crear impresora
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { z } from 'zod'

const PrinterSchema = z.object({
  name: z.string().min(1).max(80),
  areaId: z.string().optional().or(z.literal('')),
  ipAddress: z.string().max(100).optional().or(z.literal('')),
  port: z.coerce.number().min(1).max(65535).default(9100),
  protocol: z.enum(['ESCPOS', 'CUPS', 'RAW']).default('ESCPOS'),
  paperWidth: z.coerce.number().min(58).max(80).default(80),
  charsPerLine: z.coerce.number().min(16).max(64).default(48),
  header: z.string().max(500).optional().or(z.literal('')),
  footer: z.string().max(500).optional().or(z.literal('')),
  copies: z.coerce.number().min(1).max(10).default(1),
  isActive: z.boolean().default(true),
})

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })

  const printers = await db.printer.findMany({
    include: { area: { select: { id: true, name: true, code: true } } },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ ok: true, items: printers })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
  const parsed = PrinterSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
  }
  const d = parsed.data

  const printer = await db.printer.create({
    data: {
      name: d.name,
      areaId: d.areaId || null,
      ipAddress: d.ipAddress || null,
      port: d.port,
      protocol: d.protocol,
      paperWidth: d.paperWidth,
      charsPerLine: d.charsPerLine,
      header: d.header || null,
      footer: d.footer || null,
      copies: d.copies,
      isActive: d.isActive,
    },
  })
  return NextResponse.json({ ok: true, item: printer }, { status: 201 })
}
