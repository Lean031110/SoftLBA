// ============================================================
// Motor de estados centralizado para pedidos (Order) e items (OrderItem)
// ------------------------------------------------------------
// Toda transición de estado válida debe pasar por aquí. Esto evita
// lógica duplicada/hardcodeada en los endpoints de cocina y pizzería.
// ============================================================

import { db } from '@/lib/db'
import type { OrderStatus, OrderItemStatus } from '@prisma/client'

// Transiciones válidas para el estado de un pedido (Order.status)
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  CREADO: ['ENVIADO', 'CANCELADO'],
  ENVIADO: ['EN_PREPARACION', 'CANCELADO'],
  EN_PREPARACION: ['LISTO'],
  LISTO: ['SERVIDO', 'EN_PREPARACION'],
  SERVIDO: ['COBRADO'],
  COBRADO: ['ARCHIVADO'],
  ARCHIVADO: [],
  CANCELADO: [],
}

// Transiciones válidas para el estado de un item (OrderItem.status)
// v1.0-RC1-bloque1-2 (item 2): añadido DESPACHADO entre LISTO y SERVIDO.
// Flujo FINAL  (área de elaboración): PENDIENTE → EN_PREPARACION → LISTO → SERVIDO
// Flujo DIRECTO (Salón):              PENDIENTE → DESPACHADO → SERVIDO
// (En la creación, los DIRECTO nacen ya como SERVIDO; ver mesero/orders/route.ts)
export const ITEM_TRANSITIONS: Record<OrderItemStatus, OrderItemStatus[]> = {
  PENDIENTE: ['EN_PREPARACION', 'DESPACHADO', 'CANCELADO'],
  EN_PREPARACION: ['LISTO', 'CANCELADO'],
  LISTO: ['SERVIDO', 'DESPACHADO'],
  DESPACHADO: ['SERVIDO'],
  SERVIDO: [],
  CANCELADO: [],
}

/**
 * Verifica si un pedido puede pasar de `from` en `to`.
 * Estados no listados (o estados terminales) devuelven false.
 */
export function canTransitionOrder(
  from: OrderStatus | string,
  to: OrderStatus | string,
): boolean {
  if (!from || !to) return false
  const list = ORDER_TRANSITIONS[from as OrderStatus]
  if (!list) return false
  return list.includes(to as OrderStatus)
}

/**
 * Verifica si un item puede pasar de `from` en `to`.
 */
export function canTransitionItem(
  from: OrderItemStatus | string,
  to: OrderItemStatus | string,
): boolean {
  if (!from || !to) return false
  const list = ITEM_TRANSITIONS[from as OrderItemStatus]
  if (!list) return false
  return list.includes(to as OrderItemStatus)
}

/**
 * Lista los estados a los que puede transitar un pedido desde `status`.
 */
export function getValidOrderTransitions(status: OrderStatus | string): string[] {
  return ORDER_TRANSITIONS[status as OrderStatus] ?? []
}

/**
 * Lista los estados a los que puede transitar un item desde `status`.
 */
export function getValidItemTransitions(status: OrderItemStatus | string): string[] {
  return ITEM_TRANSITIONS[status as OrderItemStatus] ?? []
}

// ============================================================
// v1.0-RC1-bloque1-2 (item 6) — Recálculo del estado de un pedido
// ------------------------------------------------------------
// El estado del pedido se CALCULA a partir de los estados de sus items:
//   - Si todos los items están PENDIENTE          → ENVIADO
//   - Si al menos uno está EN_PREPARACION         → EN_PREPARACION
//   - Si todos están en estado terminal (LISTO /
//     DESPACHADO / SERVIDO / CANCELADO)           → LISTO
//   - Si el pedido está en estado terminal propio (COBRADO /
//     ARCHIVADO / CANCELADO) no se recalcula: se devuelve
//     el estado actual sin tocarlo.
// ============================================================

const ITEM_TERMINAL: OrderItemStatus[] = ['LISTO', 'DESPACHADO', 'SERVIDO', 'CANCELADO']
const ORDER_TERMINAL: OrderStatus[] = ['COBRADO', 'ARCHIVADO', 'CANCELADO']

/**
 * Recalcula el estado de un pedido a partir de los estados de sus items.
 * No afecta a pedidos en estado terminal (COBRADO/ARCHIVADO/CANCELADO).
 *
 * @param orderId ID del pedido
 * @param tx      Cliente de transacción opcional. Si se pasa, se usa; si no,
 *                se ejecuta contra el cliente global.
 * @returns El estado resultante (o el estado actual si no cambió).
 */
export async function recalculateOrderStatus(
  orderId: string,
  tx?: import('@prisma/client').Prisma.TransactionClient,
): Promise<OrderStatus> {
  const client = tx ?? db

  const order = await client.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  })
  if (!order) {
    throw new Error(`recalculateOrderStatus: order ${orderId} not found`)
  }

  // Estados terminales del pedido: no recalcular
  if (ORDER_TERMINAL.includes(order.status)) {
    return order.status
  }

  // Los pedidos en estado CREADO no han sido enviados a cocina todavía.
  // No los promocionamos automáticamente: deben pasar a ENVIADO explícitamente.
  const items = await client.orderItem.findMany({
    where: { orderId },
    select: { status: true },
  })
  if (items.length === 0) {
    return order.status
  }

  const activeItems = items.filter((it) => it.status !== 'CANCELADO')
  // Si todos los items están cancelados, conservar el estado (no decidir aquí).
  if (activeItems.length === 0) {
    return order.status
  }

  const allPending = activeItems.every((it) => it.status === 'PENDIENTE')
  const anyInPrep = activeItems.some((it) => it.status === 'EN_PREPARACION')
  const allTerminal = activeItems.every((it) => ITEM_TERMINAL.includes(it.status))

  let newStatus: OrderStatus
  if (allTerminal) {
    newStatus = 'LISTO'
  } else if (anyInPrep) {
    newStatus = 'EN_PREPARACION'
  } else if (allPending) {
    // Si el pedido ya estaba ENVIADO/EN_PREPARACION/LISTO pero todos los items
    // pendientes están PENDIENTE (porque se cancelaron los que habían avanzado),
    // lo dejamos en ENVIADO (no retroceder a CREADO).
    newStatus = 'ENVIADO'
  } else {
    // Caso mixto (algunos LISTO y otros PENDIENTE): en preparación.
    newStatus = 'EN_PREPARACION'
  }

  // Si no cambió, no actualizamos.
  if (newStatus === order.status) {
    return newStatus
  }

  await client.order.update({
    where: { id: orderId },
    data: { status: newStatus },
  })

  return newStatus
}
