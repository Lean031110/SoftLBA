// GET /api/admin/help/[id]
// PATCH /api/admin/help/[id]
// DELETE /api/admin/help/[id]
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    const { id } = await params
    const found = await db.helpArticle.findUnique({ where: { id } })
    if (!found) return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })
    return NextResponse.json({ ok: true, item: found })
  } catch (e: any) {
    console.error('GET /api/admin/help/[id]', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

const PatchSchema = z.object({
  module: z.string().min(1).max(80).optional(),
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(20000).optional(),
  order: z.coerce.number().int().min(0).max(1000).optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }
    const { id } = await params
    const before = await db.helpArticle.findUnique({ where: { id } })
    if (!before) return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })

    const json = await req.json().catch(() => null)
    if (!json) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
    const parsed = PatchSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    }
    const d = parsed.data

    const updated = await db.helpArticle.update({ where: { id }, data: d })

    await audit({
      userId: user.id,
      action: 'UPDATE',
      entity: 'help',
      entityId: id,
      before: { module: before.module, title: before.title, isActive: before.isActive },
      after: { module: updated.module, title: updated.title, isActive: updated.isActive },
    })

    return NextResponse.json({ ok: true, item: updated })
  } catch (e: any) {
    console.error('PATCH /api/admin/help/[id]', e)
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
    const before = await db.helpArticle.findUnique({ where: { id } })
    if (!before) return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })

    await db.helpArticle.delete({ where: { id } })

    await audit({
      userId: user.id,
      action: 'DELETE',
      entity: 'help',
      entityId: id,
      before: { module: before.module, title: before.title },
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('DELETE /api/admin/help/[id]', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
