// GET /api/admin/recipes/[id] - Detalle con ingredientes
// PATCH /api/admin/recipes/[id] - Actualizar
// DELETE /api/admin/recipes/[id] - Eliminar
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const recipe = await db.recipe.findUnique({
      where: { id },
      include: {
        product: true,
        ingredients: {
          include: {
            product: { select: { id: true, code: true, name: true, unit: true, cost: true, type: true } },
          },
        },
      },
    })
    if (!recipe) {
      return NextResponse.json({ ok: false, error: 'No encontrada' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, item: recipe })
  } catch (e: any) {
    console.error('GET /api/admin/recipes/[id]', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

const IngredientSchema = z.object({
  id: z.string().optional(),
  productId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unit: z.string().min(1).max(40),
  notes: z.string().max(300).optional().or(z.literal('')),
})

const PatchSchema = z.object({
  yield: z.coerce.number().positive().optional(),
  preparationTime: z.coerce.number().min(0).optional(),
  instructions: z.string().max(5000).optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
  ingredients: z.array(IngredientSchema).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const json = await req.json().catch(() => null)
    if (!json) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
    const parsed = PatchSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    }
    const d = parsed.data

    const recipe = await db.recipe.findUnique({ where: { id } })
    if (!recipe) {
      return NextResponse.json({ ok: false, error: 'No encontrada' }, { status: 404 })
    }

    const before = await db.recipe.findUnique({
      where: { id },
      include: { ingredients: true },
    })

    await db.$transaction(async (tx) => {
      const data: any = {}
      if (d.yield !== undefined) data.yield = d.yield
      if (d.preparationTime !== undefined) data.preparationTime = d.preparationTime
      if (d.instructions !== undefined) data.instructions = d.instructions || null
      if (d.notes !== undefined) data.notes = d.notes || null

      if (Object.keys(data).length > 0) {
        await tx.recipe.update({ where: { id }, data })
      }

      if (d.ingredients) {
        // Borrar todos y recrear (enfoque simple)
        await tx.recipeIngredient.deleteMany({ where: { recipeId: id } })
        await tx.recipeIngredient.createMany({
          data: d.ingredients.map((i) => ({
            recipeId: id,
            productId: i.productId,
            quantity: i.quantity,
            unit: i.unit,
            notes: i.notes || null,
          })),
        })
      }
    })

    await audit({
      userId: user.id,
      action: 'UPDATE',
      entity: 'recipe',
      entityId: id,
      before: before ? { ingredients: before.ingredients.length } : null,
      after: { ingredients: d.ingredients?.length },
    })

    const updated = await db.recipe.findUnique({
      where: { id },
      include: {
        product: true,
        ingredients: { include: { product: true } },
      },
    })

    return NextResponse.json({ ok: true, item: updated })
  } catch (e: any) {
    console.error('PATCH /api/admin/recipes/[id]', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const recipe = await db.recipe.findUnique({ where: { id } })
    if (!recipe) {
      return NextResponse.json({ ok: false, error: 'No encontrada' }, { status: 404 })
    }

    await db.recipe.delete({ where: { id } })

    await audit({
      userId: user.id,
      action: 'DELETE',
      entity: 'recipe',
      entityId: id,
      before: { productId: recipe.productId },
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('DELETE /api/admin/recipes/[id]', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
