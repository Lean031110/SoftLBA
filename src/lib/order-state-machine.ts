// ============================================================
// Motor de estados centralizado para pedidos (Order) e items (OrderItem)
// ------------------------------------------------------------
// Toda transición de estado válida debe pasar por aquí. Esto evita
// lógica duplicada/hardcodeada en los endpoints de cocina y pizzería.
// ============================================================

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
export const ITEM_TRANSITIONS: Record<OrderItemStatus, OrderItemStatus[]> = {
  PENDIENTE: ['EN_PREPARACION', 'CANCELADO'],
  EN_PREPARACION: ['LISTO', 'CANCELADO'],
  LISTO: ['SERVIDO'],
  SERVIDO: [],
  CANCELADO: [],
}

/**
 * Verifica si un pedido puede pasar de `from` a `to`.
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
 * Verifica si un item puede pasar de `from` a `to`.
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
