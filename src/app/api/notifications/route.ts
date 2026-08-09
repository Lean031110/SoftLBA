// GET /api/notifications - Lista notificaciones del usuario actual
// POST /api/notifications - Crea notificación (solo ADMIN)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const onlyUnread = searchParams.get('unread') === 'true'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)

    const where: any = { userId: user.id }
    if (onlyUnread) where.isRead = false

    const notifications = await db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const unreadCount = await db.notification.count({
      where: { userId: user.id, isRead: false },
    })

    return NextResponse.json({
      ok: true,
      notifications,
      unreadCount,
    })
  } catch (e: any) {
    console.error('notifications GET error', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

const CreateSchema = {
  parse(body: any) {
    if (!body || typeof body !== 'object') throw new Error('Invalid body')
    if (!body.title || typeof body.title !== 'string') throw new Error('title required')
    if (!body.message || typeof body.message !== 'string') throw new Error('message required')
    return {
      title: body.title,
      message: body.message,
      type: body.type || 'INFO',
      userId: body.userId || null,
      data: body.data || null,
    }
  },
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    }
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const body = await req.json()
    const data = CreateSchema.parse(body)

    const notif = await db.notification.create({
      data: {
        userId: data.userId,
        title: data.title,
        message: data.message,
        type: data.type,
        data: data.data ? JSON.stringify(data.data) : null,
      },
    })

    await audit({
      userId: user.id,
      action: 'CREATE_NOTIFICATION',
      entity: 'notification',
      entityId: notif.id,
      after: data,
      result: 'SUCCESS',
    })

    return NextResponse.json({ ok: true, item: notif })
  } catch (e: any) {
    console.error('notifications POST error', e)
    return NextResponse.json({ ok: false, error: e.message || 'Error interno' }, { status: 500 })
  }
}
