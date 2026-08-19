// GET /api/admin/news/[id]
// PATCH /api/admin/news/[id]
// DELETE /api/admin/news/[id]
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'

const TYPES = ['INFO', 'WARNING', 'PROMO', 'URGENT'] as const

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    const { id } = await params
    const found = await db.news.findUnique({ where: { id } })
    if (!found) return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })
    return NextResponse.json({ ok: true, item: found })
  } catch (e: any) {
    console.error('GET /api/admin/news/[id]', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

const PatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(5000).optional(),
  type: z.enum(TYPES).optional(),
  isPublic: z.boolean().optional(),
  isActive: z.boolean().optional(),
  priority: z.coerce.number().int().min(0).max(100).optional(),
  expiresAt: z.string().optional().or(z.literal('')),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    const { id } = await params
    const before = await db.news.findUnique({ where: { id } })
    if (!before) return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })

    const json = await req.json().catch(() => null)
    if (!json) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
    const parsed = PatchSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    }
    const d = parsed.data

    const data: any = {}
    if (d.title !== undefined) data.title = d.title
    if (d.content !== undefined) data.content = d.content
    if (d.type !== undefined) data.type = d.type
    if (d.isPublic !== undefined) data.isPublic = d.isPublic
    if (d.isActive !== undefined) data.isActive = d.isActive
    if (d.priority !== undefined) data.priority = d.priority
    if (d.expiresAt !== undefined) data.expiresAt = d.expiresAt ? new Date(d.expiresAt) : null

    const updated = await db.news.update({ where: { id }, data })

    await audit({
      userId: user.id,
      action: 'UPDATE',
      entity: 'news',
      entityId: id,
      before: { title: before.title, type: before.type, isActive: before.isActive, isPublic: before.isPublic },
      after: { title: updated.title, type: updated.type, isActive: updated.isActive, isPublic: updated.isPublic },
    })

    return NextResponse.json({ ok: true, item: updated })
  } catch (e: any) {
    console.error('PATCH /api/admin/news/[id]', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    const { id } = await params
    const before = await db.news.findUnique({ where: { id } })
    if (!before) return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })

    await db.news.delete({ where: { id } })

    await audit({
      userId: user.id,
      action: 'DELETE',
      entity: 'news',
      entityId: id,
      before: { title: before.title, type: before.type },
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('DELETE /api/admin/news/[id]', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
