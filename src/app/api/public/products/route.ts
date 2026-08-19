// GET /api/public/products - Productos disponibles para la carta pública
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const products = await db.product.findMany({
    where: {
      isActive: true,
      isAvailable: true,
      type: { in: ['DIRECTO', 'FINAL'] },
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      price: true,
      category: true,
      imageUrl: true,
      type: true,
    },
  })
  return NextResponse.json({ ok: true, products })
}
