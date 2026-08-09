// POST /api/auth/logout
import { NextResponse } from 'next/server'
import { logout } from '@/lib/auth'

export async function POST() {
  try {
    await logout()
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'Error al cerrar sesión' }, { status: 500 })
  }
}
