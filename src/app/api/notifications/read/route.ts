// POST /api/notifications/read - Marcar como leída una notificación o todas
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    }

    const body = await req.json()
    const { id, all } = body || {}

    if (all) {
      // Marcar todas como leídas
      await db.notification.updateMany({
        where: { userId: user.id, isRead: false },
        data: { isRead: true, readAt: new Date() },
      })
      return NextResponse.json({ ok: true, markedAll: true })
    }

    if (!id) {
      return NextResponse.json({ ok: false, error: 'Se requiere id o all=true' }, { status: 400 })
    }

    const notif = await db.notification.findFirst({
      where: { id, userId: user.id },
    })
    if (!notif) {
      return NextResponse.json({ ok: false, error: 'Notificación no encontrada' }, { status: 404 })
    }

    await db.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('notifications read error', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
