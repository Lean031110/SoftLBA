// ============================================================
// Realtime Emitter - Emite eventos desde el servidor al servicio Socket.IO
// ------------------------------------------------------------
// v1.0.17 (CONSOLIDACIÓN):
//   - Llama al endpoint interno /api/internal/emit en vez de ir directo
//     al puerto 3003 (que no es accesible desde Edge runtime).
//   - Helpers de alto nivel: emitOrderNew, emitOrderStatus, emitPaymentDone.
//   - Fire-and-forget: si el servicio realtime no está disponible, la
//     operación de negocio NO falla (solo se loggea un warning).
// FASE 3: logger estructurado.
//
// ARQUITECTURA:
//   API → DB COMMIT → RealtimeEmitter → /api/internal/emit → Socket.IO → clientes
//
//   El frontend SOLO RECIBE eventos. El servidor DECIDE y EMITE.
// ============================================================

import { logger } from '@/lib/logger'

const INTERNAL_EMIT_URL =
  process.env.REALTIME_INTERNAL_URL ||
  'http://localhost:3000/api/internal/emit'

// v1.0.17: secreto compartido para autenticar llamadas internas.
const INTERNAL_SECRET = process.env.REALTIME_SECRET || 'dev-internal-secret-change-in-prod'

async function postEmit(room: string, event: string, data: any): Promise<void> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    await fetch(INTERNAL_EMIT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': INTERNAL_SECRET,
      },
      body: JSON.stringify({ room, event, data }),
      signal: controller.signal,
      cache: 'no-store',
    })
    clearTimeout(timeout)
  } catch (e) {
    // Fire-and-forget: no propagamos el error al caller.
    logger.warn('Realtime emit falló (fire-and-forget)', { err: (e as Error)?.message, room, event }, 'realtime')
  }
}

export async function emitToRoom(room: string, event: string, data: any): Promise<void> {
  await postEmit(room, event, data)
}

export async function emitToUser(userId: string, event: string, data: any): Promise<void> {
  await postEmit(`user:${userId}`, event, data)
}

export async function emitToRole(role: string, event: string, data: any): Promise<void> {
  await postEmit(`role:${role}`, event, data)
}

export async function emitToArea(areaId: string, event: string, data: any): Promise<void> {
  await postEmit(`area:${areaId}`, event, data)
}

export async function broadcast(event: string, data: any): Promise<void> {
  await postEmit('broadcast', event, data)
}

// ============================================================
// Helpers de alto nivel para eventos comunes.
// Llamar DESPUÉS del DB COMMIT.
// ============================================================

export async function emitOrderNew(params: {
  orderId: string
  orderNumber: number
  areaId: string
  userId?: string
  tableId?: string
  total: number
}): Promise<void> {
  await emitToArea(params.areaId, 'order:new', {
    orderId: params.orderId,
    orderNumber: params.orderNumber,
    userId: params.userId,
    areaId: params.areaId,
    tableId: params.tableId,
    total: params.total,
  })
}

export async function emitOrderStatus(params: {
  orderId: string
  orderNumber: number
  userId: string
  areaId: string
  status: string
}): Promise<void> {
  await emitToUser(params.userId, 'order:status', {
    orderId: params.orderId,
    orderNumber: params.orderNumber,
    userId: params.userId,
    areaId: params.areaId,
    status: params.status,
  })
}

export async function emitPaymentDone(params: {
  orderId: string
  orderNumber: number
  amount: number
  userId: string
}): Promise<void> {
  await emitToRole('ADMIN', 'payment:done', {
    orderId: params.orderId,
    orderNumber: params.orderNumber,
    amount: params.amount,
    userId: params.userId,
  })
  await emitToRole('CAJERO', 'payment:done', {
    orderId: params.orderId,
    orderNumber: params.orderNumber,
    amount: params.amount,
    userId: params.userId,
  })
}
