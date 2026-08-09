// GET /api/admin/usuarios - Listar usuarios con filtros
// POST /api/admin/usuarios - Crear usuario
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hashPassword, generateRandomPassword } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'

const ROLES = ['ADMIN', 'MESERO', 'MESERO_PRO', 'COCINA', 'PIZZERIA', 'CAJERO'] as const

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .replace(/\.{2,}/g, '.')
}

async function generateUniqueUsername(first: string, last: string): Promise<string> {
  const base = slugify(`${first}.${last}`) || slugify(first) || 'usuario'
  let candidate = base
  let n = 1
  while (await db.user.findUnique({ where: { username: candidate } })) {
    n += 1
    candidate = `${base}${n}`
  }
  return candidate
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const role = searchParams.get('role') || ''
    const isActive = searchParams.get('isActive') || ''

    const where: any = {}
    if (q) {
      where.OR = [
        { username: { contains: q } },
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { email: { contains: q } },
        { phone: { contains: q } },
        { mobile: { contains: q } },
      ]
    }
    if (role && ROLES.includes(role as any)) where.role = role
    if (isActive === 'true') where.isActive = true
    if (isActive === 'false') where.isActive = false

    const users = await db.user.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        mustChangePass: true,
        firstName: true,
        lastName: true,
        phone: true,
        mobile: true,
        address: true,
        idNumber: true,
        bio: true,
        avatarUrl: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ ok: true, items: users })
  } catch (e: any) {
    console.error('GET /api/admin/usuarios', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

const CreateSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  role: z.enum(ROLES),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(40).optional().or(z.literal('')),
  mobile: z.string().max(40).optional().or(z.literal('')),
  address: z.string().max(200).optional().or(z.literal('')),
  idNumber: z.string().max(40).optional().or(z.literal('')),
  bio: z.string().max(500).optional().or(z.literal('')),
  username: z.string().min(2).max(50).optional(),
  password: z.string().min(6).max(50).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!['ADMIN'].includes(user.role)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const json = await req.json().catch(() => null)
    if (!json) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
    const parsed = CreateSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    }
    const d = parsed.data

    const username = (d.username || '').trim()
      ? (d.username as string).trim()
      : await generateUniqueUsername(d.firstName, d.lastName)

    const exists = await db.user.findUnique({ where: { username } })
    if (exists) {
      return NextResponse.json({ ok: false, error: 'El username ya existe' }, { status: 400 })
    }

    if (d.email) {
      const emailExists = await db.user.findUnique({ where: { email: d.email } })
      if (emailExists) {
        return NextResponse.json({ ok: false, error: 'El email ya está en uso' }, { status: 400 })
      }
    }

    const plainPassword = (d.password || '').trim() || generateRandomPassword(10)
    const passwordHash = await hashPassword(plainPassword)

    const created = await db.user.create({
      data: {
        username,
        firstName: d.firstName,
        lastName: d.lastName,
        role: d.role,
        email: d.email || null,
        phone: d.phone || null,
        mobile: d.mobile || null,
        address: d.address || null,
        idNumber: d.idNumber || null,
        bio: d.bio || null,
        passwordHash,
        mustChangePass: true,
        isActive: true,
      },
    })

    await audit({
      userId: user.id,
      action: 'CREATE',
      entity: 'user',
      entityId: created.id,
      after: {
        username: created.username,
        firstName: created.firstName,
        lastName: created.lastName,
        role: created.role,
        email: created.email,
      },
    })

    return NextResponse.json({
      ok: true,
      item: {
        id: created.id,
        username: created.username,
        firstName: created.firstName,
        lastName: created.lastName,
        role: created.role,
        email: created.email,
      },
      password: plainPassword,
    })
  } catch (e: any) {
    console.error('POST /api/admin/usuarios', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
