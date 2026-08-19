// ============================================================
// directo-stock.ts — Wrapper de compatibilidad para InventoryService
// ------------------------------------------------------------
// FASE 1 (CONSOLIDACIÓN v1.0.17):
//   Este archivo era la implementación original de gestión de stock
//   de productos DIRECTO. Ahora delega a InventoryService que es la
//   FUENTE ÚNICA DE VERDAD para todos los movimientos de inventario.
//
//   Se mantiene para no romper imports existentes, pero toda la lógica
//   está en InventoryService.
//
// Cambios clave respecto a la versión anterior:
//   - ensureAreaInventory() YA NO copia stock de InventoryItem (eso era
//     un bug que duplicaba la existencia). Crea con stock=0.
//   - El fallback a InventoryItem (inventario general) se mantiene para
//     retrocompatibilidad con productos que no tienen AreaInventory.
//   - Toda operación es atómica con updateMany condicional.
// ============================================================

import { InventoryService } from '@/lib/inventory/inventory-service'
import type { Prisma } from '@prisma/client'

type TxClient = Prisma.TransactionClient

export interface DirectoStockResult {
  ok: boolean
  source: 'area' | 'general' | 'none'
  areaId: string | null
  stockBefore: number | null
  stockAfter: number | null
  insufficient: boolean
  message?: string
}

/**
 * @deprecated Usar InventoryService.ensureAreaInventory() directamente.
 */
export async function ensureAreaInventory(
  areaId: string,
  productId: string,
  tx?: TxClient,
): Promise<{ id: string; stock: number; reserved: number; minStock: number; createdAt: boolean } | null> {
  return InventoryService.ensureAreaInventory(areaId, productId, tx)
}

/**
 * Decrementa stock de un producto DIRECTO.
 * @deprecated Usar InventoryService.consume() directamente.
 */
export async function decrementDirectoStock(
  areaId: string,
  productId: string,
  quantity: number,
  opts: {
    blockNegative: boolean
    orderNumber?: number
    reference: string
    userId: string
    unit: string
    tx?: TxClient
  },
): Promise<DirectoStockResult> {
  const result = await InventoryService.consume({
    areaId,
    productId,
    quantity,
    options: {
      blockNegative: opts.blockNegative,
      orderNumber: opts.orderNumber,
      reference: opts.reference,
      userId: opts.userId,
      unit: opts.unit,
    },
    tx: opts.tx,
  })
  return result as DirectoStockResult
}

/**
 * Devuelve stock al área (al cancelar item o pedido).
 * @deprecated Usar InventoryService.returnStock() directamente.
 */
export async function returnDirectoStock(
  areaId: string,
  productId: string,
  quantity: number,
  opts: {
    orderNumber?: number
    reference: string
    userId: string
    unit: string
    tx?: TxClient
  },
): Promise<DirectoStockResult> {
  const result = await InventoryService.returnStock({
    areaId,
    productId,
    quantity,
    options: {
      orderNumber: opts.orderNumber,
      reference: opts.reference,
      userId: opts.userId,
      unit: opts.unit,
    },
    tx: opts.tx,
  })
  return result as DirectoStockResult
}
