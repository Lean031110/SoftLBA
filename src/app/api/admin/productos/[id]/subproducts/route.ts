// GET /api/admin/productos/[id]/subproducts - Lista subproductos asociados a un producto final
// POST /api/admin/productos/[id]/subproducts - Añadir subproducto a un producto final
// DELETE /api/admin/productos/[id]/subproducts?subId=... - Quitar subproducto
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'

// GET: lista los subproductos de un producto final
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const product = await db.product.findUnique({ where: { id } })
    if (!product) return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })
    if (product.type !== 'FINAL') {
      return NextResponse.json({ ok: false, error: 'Solo los productos finales pueden tener subproductos' }, { status: 400 })
    }

    const subproducts = await db.productSubproduct.findMany({
      where: { finalProductId: id },
      include: {
        subproduct: {
          select: {
            id: true,
            code: true,
            name: true,
            unit: true,
            cost: true,
            type: true,
          },
        },
      },
      orderBy: { subproduct: { name: 'asc' } },
    })

    return NextResponse.json({ ok: true, items: subproducts })
  } catch (e: any) {
    console.error('GET subproducts', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

const AddSchema = z.object({
  subproductId: z.string().min(1),
  quantity: z.coerce.number().positive(),
})

// POST: añade un subproducto a un producto final
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
    const parsed = AddSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    }
    const { subproductId, quantity } = parsed.data

    const product = await db.product.findUnique({ where: { id } })
    if (!product) return NextResponse.json({ ok: false, error: 'Producto no encontrado' }, { status: 404 })
    if (product.type !== 'FINAL') {
      return NextResponse.json({ ok: false, error: 'Solo los productos finales pueden tener subproductos' }, { status: 400 })
    }

    const subproduct = await db.product.findUnique({ where: { id: subproductId } })
    if (!subproduct) return NextResponse.json({ ok: false, error: 'Subproducto no encontrado' }, { status: 404 })
    if (subproduct.type !== 'SUBPRODUCTO') {
      return NextResponse.json({ ok: false, error: 'El producto seleccionado no es un subproducto' }, { status: 400 })
    }

    // Upsert: si ya existe, actualizar cantidad; si no, crear
    const existing = await db.productSubproduct.findFirst({
      where: { finalProductId: id, subproductId },
    })

    let item
    if (existing) {
      item = await db.productSubproduct.update({
        where: { id: existing.id },
        data: { quantity },
      })
    } else {
      item = await db.productSubproduct.create({
        data: {
          finalProductId: id,
          subproductId,
          quantity,
        },
      })
    }

    await audit({
      userId: user.id,
      action: existing ? 'UPDATE_SUBPRODUCT' : 'ADD_SUBPRODUCT',
      entity: 'product-subproduct',
      entityId: item.id,
      after: { finalProductId: id, subproductId, quantity, subproductName: subproduct.name },
    })

    return NextResponse.json({ ok: true, item })
  } catch (e: any) {
    console.error('POST subproducts', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

// DELETE: quita un subproducto del producto final
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const subId = searchParams.get('subId')
    if (!subId) return NextResponse.json({ ok: false, error: 'subId requerido' }, { status: 400 })

    const existing = await db.productSubproduct.findFirst({
      where: { finalProductId: id, id: subId },
    })
    if (!existing) return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })

    await db.productSubproduct.delete({ where: { id: existing.id } })

    await audit({
      userId: user.id,
      action: 'REMOVE_SUBPRODUCT',
      entity: 'product-subproduct',
      entityId: existing.id,
      before: { finalProductId: id, subproductId: existing.subproductId, quantity: existing.quantity },
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('DELETE subproducts', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
