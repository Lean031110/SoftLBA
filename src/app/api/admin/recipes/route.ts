// GET /api/admin/recipes - Lista de recetas
// POST /api/admin/recipes - Crear receta con ingredientes
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const recipes = await db.recipe.findMany({
      include: {
        product: { select: { id: true, code: true, name: true, category: true, price: true } },
        ingredients: {
          include: {
            product: { select: { id: true, code: true, name: true, unit: true, cost: true } },
          },
        },
      },
      orderBy: { product: { name: 'asc' } },
    })

    const items = recipes.map((r) => {
      const totalCost = r.ingredients.reduce((s, i) => s + i.quantity * i.product.cost, 0)
      return { ...r, totalCost }
    })

    return NextResponse.json({ ok: true, items })
  } catch (e: any) {
    console.error('GET /api/admin/recipes', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

const IngredientSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unit: z.string().min(1).max(40),
  notes: z.string().max(300).optional().or(z.literal('')),
})

const CreateSchema = z.object({
  productId: z.string().min(1),
  yield: z.coerce.number().positive().default(1),
  preparationTime: z.coerce.number().min(0).default(0),
  instructions: z.string().max(5000).optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
  ingredients: z.array(IngredientSchema).min(1, 'Agrega al menos un ingrediente'),
})

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const json = await req.json().catch(() => null)
    if (!json) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
    const parsed = CreateSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    }
    const d = parsed.data

    const product = await db.product.findUnique({ where: { id: d.productId } })
    if (!product) {
      return NextResponse.json({ ok: false, error: 'Producto no encontrado' }, { status: 404 })
    }

    const existing = await db.recipe.findUnique({ where: { productId: d.productId } })
    if (existing) {
      return NextResponse.json({ ok: false, error: 'Ya existe una receta para este producto' }, { status: 400 })
    }

    // Validar que los ingredientes no sean del mismo producto (no recursivo)
    if (d.ingredients.some((i) => i.productId === d.productId)) {
      return NextResponse.json({ ok: false, error: 'Un producto no puede ser ingrediente de su propia receta' }, { status: 400 })
    }

    const created = await db.$transaction(async (tx) => {
      const recipe = await tx.recipe.create({
        data: {
          productId: d.productId,
          yield: d.yield,
          preparationTime: d.preparationTime,
          instructions: d.instructions || null,
          notes: d.notes || null,
          ingredients: {
            create: d.ingredients.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              unit: i.unit,
              notes: i.notes || null,
            })),
          },
        },
        include: {
          ingredients: { include: { product: true } },
        },
      })
      return recipe
    })

    await audit({
      userId: user.id,
      action: 'CREATE',
      entity: 'recipe',
      entityId: created.id,
      after: { productId: d.productId, ingredients: d.ingredients.length },
    })

    return NextResponse.json({ ok: true, item: created })
  } catch (e: any) {
    console.error('POST /api/admin/recipes', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
