// GET /api/admin/respaldos/[id]/download - Descargar archivo de backup
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { promises as fs } from 'fs'
import path from 'path'

const BACKUP_DIR = path.join(process.cwd(), 'backups')

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const backup = await db.backup.findUnique({ where: { id } })
    if (!backup) {
      return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })
    }

    const filePath = path.join(BACKUP_DIR, backup.filename)
    try {
      await fs.access(filePath)
    } catch {
      return NextResponse.json({ ok: false, error: 'Archivo no encontrado en disco' }, { status: 404 })
    }

    const data = await fs.readFile(filePath)

    await audit({
      userId: user.id,
      action: 'BACKUP_DOWNLOAD',
      entity: 'backup',
      entityId: id,
    })

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${backup.filename}"`,
        'Content-Length': String(backup.size),
      },
    })
  } catch (e: any) {
    console.error('GET /api/admin/respaldos/[id]/download', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
