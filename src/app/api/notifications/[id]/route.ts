// DELETE /api/notifications/[id] - Eliminar una notificación del historial
// v1.1.0-rc1 (POS_RECONSTRUCTION): permite al usuario eliminar notificaciones
// individuales del historial para mantenerlo limpio.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    }
    const { id } = await params

    // Verificar que la notificación pertenece al usuario (o es ADMIN)
    const notif = await db.notification.findUnique({ where: { id } })
    if (!notif) {
      return NextResponse.json({ ok: false, error: 'Notificación no encontrada' }, { status: 404 })
    }
    if (notif.userId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    await db.notification.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('DELETE /api/notifications/[id]', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
