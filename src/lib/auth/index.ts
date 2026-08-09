// ============================================================
// Utilidades de autenticación - Sistema de Restaurante Cuba
// ============================================================
// Usa cookies firmadas para mantener la sesión activa.
// El token incluye: userId, role, expiresAt, firma HMAC.
// ============================================================

import { cookies } from 'next/headers'
import { createHmac, randomBytes } from 'crypto'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { UserRole } from '@/lib/permissions'
import { verifySessionToken as verifyTokenEdge } from './token'

const SESSION_COOKIE = 'rc_session'
const SECRET = process.env.NEXTAUTH_SECRET || 'cuba-restaurante-secret-key-change-in-prod'
const SESSION_TTL_HOURS = 12

// ============================================================
// Generación y verificación de tokens
// ============================================================

function sign(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('hex')
}

export function createSessionToken(userId: string, role: UserRole): string {
  const expiresAt = Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000
  const payload = `${userId}.${role}.${expiresAt}`
  const signature = sign(payload)
  return `${payload}.${signature}`
}

export async function verifySessionToken(token: string) {
  return verifyTokenEdge(token)
}

// ============================================================
// API Server: obtener usuario actual desde cookies
// ============================================================

export async function getCurrentUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await verifySessionToken(token)
  if (!session) return null

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
      mustChangePass: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      lastLoginAt: true,
    },
  })

  if (!user || !user.isActive) return null
  return user
}

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) throw new Error('NO_AUTENTICADO')
  return user
}

export async function requireRole(...roles: UserRole[]) {
  const user = await requireUser()
  if (!roles.includes(user.role)) throw new Error('SIN_PERMISO')
  return user
}

// ============================================================
// Login / Logout
// ============================================================

export async function login(username: string, password: string, ipAddress?: string) {
  const user = await db.user.findUnique({ where: { username } })
  if (!user) return { ok: false, error: 'Usuario o contraseña incorrectos' }
  if (!user.isActive) return { ok: false, error: 'Usuario inactivo. Contacta al administrador.' }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { ok: false, error: 'Usuario bloqueado temporalmente. Intenta más tarde.' }
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    const failedAttempts = user.failedAttempts + 1
    const lockedUntil = failedAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null
    await db.user.update({
      where: { id: user.id },
      data: { failedAttempts, lockedUntil },
    })
    return { ok: false, error: 'Usuario o contraseña incorrectos' }
  }

  // Reset intentos fallidos y registrar login
  await db.user.update({
    where: { id: user.id },
    data: {
      failedAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: ipAddress,
    },
  })

  // Audit log
  await db.auditLog.create({
    data: {
      userId: user.id,
      action: 'LOGIN',
      entity: 'user',
      entityId: user.id,
      ipAddress,
      result: 'SUCCESS',
    },
  })

  const token = createSessionToken(user.id, user.role)
  const cookieStore = await cookies()
  const expiresAt = Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(expiresAt),
  })

  return { ok: true, user, mustChangePass: user.mustChangePass }
}

export async function logout() {
  const user = await getCurrentUser()
  if (user) {
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGOUT',
        entity: 'user',
        entityId: user.id,
        result: 'SUCCESS',
      },
    })
  }
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

// ============================================================
// Helpers de contraseña
// ============================================================

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export function generateRandomPassword(length = 10): string {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  const bytes = randomBytes(length)
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length]
  }
  return result
}

// ============================================================
// Helpers para API routes (sin cookies server)
// ============================================================

export async function getCurrentUserFromRequest(req: Request) {
  // En API routes de Next.js también podemos usar cookies() server
  return getCurrentUser()
}
