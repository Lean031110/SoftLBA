// GET /api/admin/recipes/by-product/[productId] - Receta por producto
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  try {
    const { productId } = await params
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const recipe = await db.recipe.findUnique({
      where: { productId },
      include: {
        product: true,
        ingredients: {
          include: { product: true },
        },
      },
    })

    if (!recipe) {
      return NextResponse.json({ ok: true, item: null })
    }

    return NextResponse.json({ ok: true, item: recipe })
  } catch (e: any) {
    console.error('GET /api/admin/recipes/by-product/[productId]', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
