// GET /api/admin/respaldos - Lista de backups
// POST /api/admin/respaldos - Crear backup manual
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { z } from 'zod'
import { promises as fs } from 'fs'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'db', 'custom.db')
const BACKUP_DIR = path.join(process.cwd(), 'backups')

async function ensureBackupDir() {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true })
  } catch {}
}

function pad(n: number) { return n.toString().padStart(2, '0') }

function timestampName() {
  const d = new Date()
  return `backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.db`
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const items = await db.backup.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ ok: true, items })
  } catch (e: any) {
    console.error('GET /api/admin/respaldos', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}

const CreateSchema = z.object({
  notes: z.string().max(500).optional().or(z.literal('')),
  type: z.string().max(20).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const json = await req.json().catch(() => ({}))
    const parsed = CreateSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    }
    const d = parsed.data

    await ensureBackupDir()

    // Verificar que el archivo DB existe
    try {
      await fs.access(DB_PATH)
    } catch {
      return NextResponse.json({ ok: false, error: 'Base de datos no encontrada' }, { status: 500 })
    }

    // Forzar checkpoint de WAL para que todos los datos estén en el archivo principal
    try {
      await db.$executeRawUnsafe('PRAGMA wal_checkpoint(FULL)')
    } catch {}

    const filename = timestampName()
    const target = path.join(BACKUP_DIR, filename)

    // Copiar el archivo
    await fs.copyFile(DB_PATH, target)

    const stat = await fs.stat(target)

    const created = await db.backup.create({
      data: {
        filename,
        size: stat.size,
        type: d.type || 'manual',
        status: 'COMPLETED',
        notes: d.notes || null,
      },
    })

    await audit({
      userId: user.id,
      action: 'BACKUP_CREATE',
      entity: 'backup',
      entityId: created.id,
      after: { filename, size: stat.size },
    })

    return NextResponse.json({ ok: true, item: created })
  } catch (e: any) {
    console.error('POST /api/admin/respaldos', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
