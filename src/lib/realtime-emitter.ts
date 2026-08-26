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
import { requireRuntimeSecret, requireRuntimeUrl } from '@/lib/environment'

function internalEmitUrl(): string {
  return requireRuntimeUrl('REALTIME_INTERNAL_URL')
}

async function postEmit(room: string, event: string, data: any): Promise<void> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    await fetch(internalEmitUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': requireRuntimeSecret('REALTIME_SECRET'),
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
  // FASE 8: emitir al mesero Y al área afectada (no solo al usuario).
  await emitToUser(params.userId, 'order:status', {
    orderId: params.orderId,
    orderNumber: params.orderNumber,
    userId: params.userId,
    areaId: params.areaId,
    status: params.status,
  })
  // También notificar al área (para que cocina/pizzería sepa el cambio global).
  await emitToArea(params.areaId, 'order:status', {
    orderId: params.orderId,
    orderNumber: params.orderNumber,
    userId: params.userId,
    areaId: params.areaId,
    status: params.status,
  })
}

// FASE 8: emitOrderReady — emite al mesero cuando una área marca LISTO.
// Permite que el mesero sepa que puede pasar a recoger el pedido.
export async function emitOrderReady(params: {
  orderId: string
  orderNumber: number
  userId: string
  areaId: string
  areaName?: string
}): Promise<void> {
  await emitToUser(params.userId, 'order:ready', {
    orderId: params.orderId,
    orderNumber: params.orderNumber,
    userId: params.userId,
    areaId: params.areaId,
    areaName: params.areaName,
    readyAt: new Date().toISOString(),
  })
}

// FASE 8: emitStockLow — emite alerta de stock bajo.
export async function emitStockLow(params: {
  productId: string
  productName: string
  areaId: string
  currentStock: number
  minStock: number
  unit: string
}): Promise<void> {
  const payload = {
    productId: params.productId,
    productName: params.productName,
    areaId: params.areaId,
    currentStock: params.currentStock,
    minStock: params.minStock,
    unit: params.unit,
    alertedAt: new Date().toISOString(),
  }
  await emitToRole('ADMIN', 'stock:low', payload)
  // También al área afectada para que cocina/pizzería sepa.
  await emitToArea(params.areaId, 'stock:low', payload)
}

// FASE 8: emitDailyClose — emite cuando se cierra un día.
export async function emitDailyClose(params: {
  dailyCloseId: string
  date: string
  totalSales: number
  totalOrders: number
}): Promise<void> {
  const payload = {
    dailyCloseId: params.dailyCloseId,
    date: params.date,
    totalSales: params.totalSales,
    totalOrders: params.totalOrders,
    closedAt: new Date().toISOString(),
  }
  await emitToRole('ADMIN', 'daily-close', payload)
  await emitToRole('CAJERO', 'daily-close', payload)
}

// FASE 8: emitNotification — emite notificación a un usuario o rol.
export async function emitNotification(params: {
  userId?: string
  role?: string
  notificationId: string
  type: string
  title: string
  message: string
  data?: Record<string, unknown>
}): Promise<void> {
  const payload = {
    notificationId: params.notificationId,
    type: params.type,
    title: params.title,
    message: params.message,
    data: params.data,
    createdAt: new Date().toISOString(),
  }
  if (params.userId) {
    await emitToUser(params.userId, 'notification', payload)
  } else if (params.role) {
    await emitToRole(params.role, 'notification', payload)
  } else {
    await broadcast('notification', payload)
  }
}

// FASE 8: kickUser — pide al servicio realtime que desconecte todos los
// sockets de un usuario. Útil cuando cambia contraseña/rol/permisos.
// No espera respuesta (fire-and-forget); el mini-servicio aplica el kick.
export async function kickUser(userId: string, reason: string): Promise<void> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    // Reutilizamos el mismo endpoint /emit pero con room especial "kick:user:<id>".
    await fetch(internalEmitUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': requireRuntimeSecret('REALTIME_SECRET'),
      },
      body: JSON.stringify({
        room: `kick:user:${userId}`,
        event: 'auth:kick',
        data: { userId, reason, kickedAt: new Date().toISOString() },
      }),
      signal: controller.signal,
      cache: 'no-store',
    })
    clearTimeout(timeout)
  } catch (e) {
    logger.warn('kickUser falló (fire-and-forget)', { err: (e as Error)?.message, userId }, 'realtime')
  }
}

export async function emitPaymentDone(params: {
  orderId: string
  orderNumber: number
  amount: number
  userId: string
}): Promise<void> {
  // FASE 8: también emitir al mesero que creó el pedido.
  const payload = {
    orderId: params.orderId,
    orderNumber: params.orderNumber,
    amount: params.amount,
    userId: params.userId,
  }
  await emitToRole('ADMIN', 'payment:done', payload)
  await emitToRole('CAJERO', 'payment:done', payload)
  await emitToUser(params.userId, 'payment:done', payload)
}
