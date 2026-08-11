// POST /api/admin/respaldos/restore - Restaurar desde archivo (FIX 23-25: con verificación de checksum)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { hasPerm, PERMISSIONS } from '@/lib/permissions/permissions-v2'
import { fileSha256 } from '@/lib/checksum'
import { z } from 'zod'
import { promises as fs } from 'fs'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'db', 'custom.db')
const BACKUP_DIR = path.join(process.cwd(), 'backups')

const RestoreSchema = z.object({
  backupId: z.string().min(1).optional(),
  filename: z.string().min(1).optional(),
  confirm: z.boolean().refine((v) => v === true, 'Debes confirmar la restauración'),
})

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'NO_AUTENTICADO' }, { status: 401 })
    if (!hasPerm(user.role, PERMISSIONS.BACKUP_RESTORE)) {
      return NextResponse.json({ ok: false, error: 'SIN_PERMISO' }, { status: 403 })
    }

    const json = await req.json().catch(() => null)
    if (!json) return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
    const parsed = RestoreSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    }
    const d = parsed.data

    let filename: string
    let storedChecksum: string | null = null
    if (d.backupId) {
      const backup = await db.backup.findUnique({ where: { id: d.backupId } })
      if (!backup) {
        return NextResponse.json({ ok: false, error: 'Backup no encontrado' }, { status: 404 })
      }
      filename = backup.filename
      storedChecksum = backup.checksum
    } else if (d.filename) {
      filename = d.filename
    } else {
      return NextResponse.json({ ok: false, error: 'Debe proporcionar backupId o filename' }, { status: 400 })
    }

    // ============================================================
    // FIX 10 - Prevenir path traversal:
    //   - Validar que el filename no contenga '..' ni separadores de ruta.
    //   - Usar path.basename() para eliminar cualquier prefijo de path.
    //   - Construir la ruta final y verificar con path.resolve() que
    //     realmente queda dentro de BACKUP_DIR.
    // ============================================================
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json(
        { ok: false, error: 'Nombre de archivo inválido (caracteres prohibidos)' },
        { status: 400 },
      )
    }
    const safeName = path.basename(filename)
    if (!safeName || safeName !== filename) {
      return NextResponse.json(
        { ok: false, error: 'Nombre de archivo inválido' },
        { status: 400 },
      )
    }

    const backupPath = path.resolve(BACKUP_DIR, safeName)
    // Verificación final: la ruta resuelta debe estar dentro de BACKUP_DIR
    const resolvedBackupDir = path.resolve(BACKUP_DIR)
    if (!backupPath.startsWith(resolvedBackupDir + path.sep) && backupPath !== resolvedBackupDir) {
      return NextResponse.json(
        { ok: false, error: 'Acceso a ruta fuera del directorio de backups' },
        { status: 400 },
      )
    }

    try {
      await fs.access(backupPath)
    } catch {
      return NextResponse.json({ ok: false, error: 'Archivo de backup no encontrado en disco' }, { status: 404 })
    }

    // FIX 23-25 — Verificación de checksum SHA-256.
    //   Recalculamos el hash del archivo a restaurar y lo comparamos con el
    //   guardado en el registro de Backup. Si el registro tiene checksum y
    //   no coincide, rechazamos la restauración (archivo corrupto o manipulado).
    //   Si el registro NO tiene checksum (backups antiguos creados antes de
    //   este fix), se omite la verificación pero se loguea como advertencia.
    let actualChecksum: string | null = null
    try {
      actualChecksum = await fileSha256(backupPath)
    } catch (e) {
      console.error('No se pudo calcular checksum del archivo de backup', e)
      return NextResponse.json(
        { ok: false, error: 'No se pudo calcular el checksum del archivo' },
        { status: 500 },
      )
    }
    if (storedChecksum) {
      if (storedChecksum !== actualChecksum) {
        await audit({
          userId: user.id,
          action: 'BACKUP_RESTORE_CHECKSUM_FAIL',
          entity: 'backup',
          after: {
            filename,
            storedChecksum,
            actualChecksum,
          },
          result: 'FAILURE',
        })
        return NextResponse.json(
          {
            ok: false,
            error: 'Checksum SHA-256 no coincide. El archivo puede estar corrupto o manipulado.',
            details: {
              stored: storedChecksum,
              actual: actualChecksum,
            },
          },
          { status: 400 },
        )
      }
    } else {
      // Backward compat: backup sin checksum (anterior al fix). Loguear y continuar.
      console.warn(`Backup ${filename} no tiene checksum guardado; omitiendo verificación.`)
    }

    // Hacer un backup automático del estado actual antes de restaurar (por seguridad)
    const ts = new Date()
    const autoBackup = `pre-restore-${ts.getFullYear()}${ts.getMonth() + 1}${ts.getDate()}-${ts.getHours()}${ts.getMinutes()}${ts.getSeconds()}.db`
    const autoBackupPath = path.join(BACKUP_DIR, autoBackup)
    try {
      // Checkpoint antes de copiar para tener todo en el archivo principal
      try {
        await db.$executeRawUnsafe('PRAGMA wal_checkpoint(FULL)')
      } catch {}
      await fs.copyFile(DB_PATH, autoBackupPath)
      const stat = await fs.stat(autoBackupPath)
      // FIX 23-25 — Guardar checksum del auto-backup pre-restore también
      const autoChecksum = await fileSha256(autoBackupPath)
      await db.backup.create({
        data: {
          filename: autoBackup,
          size: stat.size,
          type: 'auto-pre-restore',
          status: 'COMPLETED',
          notes: `Auto-backup previo a restaurar ${filename}`,
          checksum: autoChecksum,
        },
      })
      // Checkpoint de nuevo para asegurar el registro en el archivo
      try {
        await db.$executeRawUnsafe('PRAGMA wal_checkpoint(FULL)')
      } catch {}
    } catch (e) {
      console.error('No se pudo hacer auto-backup', e)
    }

    // Restaurar: copiar el archivo de backup sobre custom.db
    await fs.copyFile(backupPath, DB_PATH)

    // Eliminar WAL y SHM para que Prisma lea el estado restaurado
    try {
      await fs.unlink(DB_PATH + '-wal')
    } catch {}
    try {
      await fs.unlink(DB_PATH + '-shm')
    } catch {}

    await audit({
      userId: user.id,
      action: 'BACKUP_RESTORE',
      entity: 'backup',
      after: { restoredFrom: filename, checksumVerified: !!storedChecksum, checksum: actualChecksum },
    })

    return NextResponse.json({ ok: true, restoredFrom: filename, checksumVerified: !!storedChecksum })
  } catch (e: any) {
    console.error('POST /api/admin/respaldos/restore', e)
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
