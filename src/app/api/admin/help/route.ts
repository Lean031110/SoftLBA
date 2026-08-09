// GET /api/admin/help - Listar artículos de ayuda (admin ve todos)
// POST /api/admin/help - Crear artículo
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    const { searchParams } = new URL(req.url)
    const moduleQ = (searchParams.get('module') || '').trim()
    const q = (searchParams.get('q') || '').trim()
    const isActive = searchParams.get('isActive') || ''

    const where: any = {}
    if (moduleQ) where.module = { contains: moduleQ }
    if (q) {
      where.OR = [
        { title: { contains: q } },
        { content: { contains: q } },
      ]
    }
    if (isActive === 'true') where.isActive = true
    if (isActive === 'false') where.isActive = false

    const items = await db.helpArticle.findMany({
      where,
      orderBy: [{ module: 'asc' }, { order: 'asc' }, { title: 'asc' }],
    })
    return NextResponse.json({ ok: true, items })
  } catch (e: any) {
    console.error('GET /api/admin/help', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

const CreateSchema = z.object({
  module: z.string().min(1).max(80),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(20000),
  order: z.coerce.number().int().min(0).max(1000).default(0),
  isActive: z.boolean().default(true),
})

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    const json = await req.json().catch(() => null)
    if (!json) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
    const parsed = CreateSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    }
    const d = parsed.data

    const created = await db.helpArticle.create({
      data: {
        module: d.module,
        title: d.title,
        content: d.content,
        order: d.order,
        isActive: d.isActive,
      },
    })

    await audit({
      userId: user.id,
      action: 'CREATE',
      entity: 'help',
      entityId: created.id,
      after: { module: created.module, title: created.title },
    })

    return NextResponse.json({ ok: true, item: created })
  } catch (e: any) {
    console.error('POST /api/admin/help', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
