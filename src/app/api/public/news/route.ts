// GET /api/public/news - Noticias públicas
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const news = await db.news.findMany({
    where: {
      isActive: true,
      isPublic: true,
      AND: [
        {
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
      ],
    },
    orderBy: [{ priority: 'desc' }, { publishedAt: 'desc' }],
    take: 20,
  })
  return NextResponse.json({ ok: true, news })
}
