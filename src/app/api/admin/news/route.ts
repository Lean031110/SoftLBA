// GET /api/admin/news - Listar noticias
// POST /api/admin/news - Crear noticia
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'

const TYPES = ['INFO', 'WARNING', 'PROMO', 'URGENT'] as const

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const type = searchParams.get('type') || ''
    const isActive = searchParams.get('isActive') || ''

    const where: any = {}
    if (q) {
      where.OR = [
        { title: { contains: q } },
        { content: { contains: q } },
      ]
    }
    if (type && TYPES.includes(type as any)) where.type = type
    if (isActive === 'true') where.isActive = true
    if (isActive === 'false') where.isActive = false

    const news = await db.news.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { publishedAt: 'desc' }],
    })

    return NextResponse.json({ ok: true, items: news })
  } catch (e: any) {
    console.error('GET /api/admin/news', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

const CreateSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
  type: z.enum(TYPES).default('INFO'),
  isPublic: z.boolean().default(true),
  isActive: z.boolean().default(true),
  priority: z.coerce.number().int().min(0).max(100).default(0),
  expiresAt: z.string().optional().or(z.literal('')),
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

    const created = await db.news.create({
      data: {
        title: d.title,
        content: d.content,
        type: d.type,
        isPublic: d.isPublic,
        isActive: d.isActive,
        priority: d.priority,
        expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
      },
    })

    await audit({
      userId: user.id,
      action: 'CREATE',
      entity: 'news',
      entityId: created.id,
      after: { title: created.title, type: created.type, isActive: created.isActive },
    })

    return NextResponse.json({ ok: true, item: created })
  } catch (e: any) {
    console.error('POST /api/admin/news', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
