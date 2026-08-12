// GET /api/admin/turnos - Listar turnos (con filtros)
// POST /api/admin/turnos - Abrir nuevo turno
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { hasPerm, PERMISSIONS } from '@/lib/permissions/permissions-v2'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!hasPerm(user.role, PERMISSIONS.DAILY_CLOSE)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || '' // OPEN | CLOSED
    const userId = searchParams.get('userId') || ''
    const from = searchParams.get('from') || ''
    const to = searchParams.get('to') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(100, Math.max(10, parseInt(searchParams.get('pageSize') || '20', 10)))

    const where: any = {}
    if (status) where.status = status
    if (userId) where.userId = userId
    if (from || to) {
      where.startTime = {}
      if (from) where.startTime.gte = new Date(from + 'T00:00:00')
      if (to) where.startTime.lte = new Date(to + 'T23:59:59.999')
    }

    const [total, items] = await Promise.all([
      db.workShift.count({ where }),
      db.workShift.findMany({
        where,
        include: {
          user: { select: { id: true, username: true, firstName: true, lastName: true, role: true } },
          area: { select: { id: true, name: true, code: true } },
        },
        orderBy: { startTime: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return NextResponse.json({
      ok: true,
      items,
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    })
  } catch (e: any) {
    console.error('GET /api/admin/turnos', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

const OpenSchema = z.object({
  areaId: z.string().min(1).optional(),
  openingCash: z.coerce.number().min(0).default(0),
  observations: z.string().max(500).optional().or(z.literal('')),
})

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!hasPerm(user.role, PERMISSIONS.DAILY_CLOSE)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const json = await req.json().catch(() => ({}))
    const parsed = OpenSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' },
        { status: 400 },
      )
    }
    const d = parsed.data

    // Validar área (si viene)
    if (d.areaId) {
      const area = await db.area.findUnique({ where: { id: d.areaId } })
      if (!area || !area.isActive) {
        return NextResponse.json({ ok: false, error: 'Área inválida o inactiva' }, { status: 400 })
      }
    }

    // No permitir abrir turno si ya hay uno OPEN para este usuario
    const existingOpen = await db.workShift.findFirst({
      where: { userId: user.id, status: 'OPEN' },
    })
    if (existingOpen) {
      return NextResponse.json(
        { ok: false, error: 'Ya tienes un turno abierto. Ciérralo antes de abrir uno nuevo.' },
        { status: 400 },
      )
    }

    const created = await db.workShift.create({
      data: {
        userId: user.id,
        areaId: d.areaId || null,
        startTime: new Date(),
        status: 'OPEN',
        openingCash: d.openingCash,
        observations: d.observations || null,
      },
      include: {
        user: { select: { id: true, username: true, firstName: true, lastName: true, role: true } },
        area: { select: { id: true, name: true, code: true } },
      },
    })

    await audit({
      userId: user.id,
      action: 'WORK_SHIFT_OPEN',
      entity: 'work-shift',
      entityId: created.id,
      after: {
        userId: created.userId,
        areaId: created.areaId,
        openingCash: created.openingCash,
        startTime: created.startTime,
      },
    })

    return NextResponse.json({ ok: true, item: created })
  } catch (e: any) {
    console.error('POST /api/admin/turnos', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
