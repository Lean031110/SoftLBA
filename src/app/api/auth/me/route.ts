// GET /api/auth/me - Devuelve usuario actual
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, user: null }, { status: 200 })
    }
    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        mustChangePass: user.mustChangePass,
      },
    })
  } catch (e) {
    return NextResponse.json({ ok: false, user: null }, { status: 500 })
  }
}
