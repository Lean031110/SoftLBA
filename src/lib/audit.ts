// ============================================================
// Helpers de auditoría - registra acciones en AuditLog
// ============================================================

import { db } from '@/lib/db'
import { headers } from 'next/headers'

export async function audit(opts: {
  userId?: string
  action: string
  entity: string
  entityId?: string
  before?: any
  after?: any
  result?: string
}) {
  try {
    const h = await headers()
    const ip = h.get('x-forwarded-for') || h.get('x-real-ip') || 'unknown'
    const ua = h.get('user-agent') || undefined

    await db.auditLog.create({
      data: {
        userId: opts.userId || null,
        action: opts.action,
        entity: opts.entity,
        entityId: opts.entityId,
        before: opts.before ? JSON.stringify(opts.before) : null,
        after: opts.after ? JSON.stringify(opts.after) : null,
        ipAddress: ip,
        userAgent: ua,
        result: opts.result || 'SUCCESS',
      },
    })
  } catch (e) {
    console.error('audit log failed', e)
  }
}
