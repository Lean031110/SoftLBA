// ============================================================
// Helpers para gestión atómica de stock de productos DIRECTO.
// ------------------------------------------------------------
// v1.0-RC1-bloque1-2 (items 9, 10, 16, 17).
// Centraliza la lógica para:
//   - Decrementar stock de un producto DIRECTO al vendérselo (item 9)
//   - Incrementar stock al devolver (cancelar item o pedido) (items 16, 17)
//   - Migrar automáticamente un InventoryItem a AreaInventory si no
//     existe en el área (item 10).
// Todos los helpers aceptan un TransactionClient opcional para
// integrarse en transacciones del llamador.
// ============================================================

import { db } from '@/lib/db'
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
 * Asegura que exista un AreaInventory para (areaId, productId).
 * Si no existe pero existe un InventoryItem con stock > 0, lo crea
 * con el stock del InventoryItem (migración automática — item 10).
 * Devuelve el AreaInventory (existente o recién creado) o null si no
 * había ninguno de los dos.
 */
export async function ensureAreaInventory(
  areaId: string,
  productId: string,
  tx?: TxClient,
): Promise<{ id: string; stock: number; reserved: number; minStock: number; createdAt: boolean } | null> {
  const client = tx ?? db

  const existing = await client.areaInventory.findUnique({
    where: { areaId_productId: { areaId, productId } },
  })
  if (existing) {
    return { ...existing, createdAt: false }
  }

  // Migración automática desde InventoryItem (item 10).
  const genInv = await client.inventoryItem.findUnique({ where: { productId } })
  if (!genInv) {
    return null
  }

  const created = await client.areaInventory.create({
    data: {
      areaId,
      productId,
      stock: genInv.stock,
      reserved: genInv.reserved,
      minStock: 0,
    },
  })
  return { ...created, createdAt: true }
}

/**
 * Decrementa stock de un producto DIRECTO desde el área del pedido (item 9).
 * Usa updateMany con condición `stock >= quantity` para garantizar atomicidad
 * incluso bajo concurrencia.
 *
 * - Si no existe AreaInventory, intenta migración automática (item 10).
 * - Si blockNegative=true y no hay stock suficiente, retorna ok=false con
 *   insufficient=true (NO lanza excepción; el llamador decide qué hacer).
 * - Si blockNegative=false y no hay stock suficiente, descuenta igual
 *   (el stock puede quedar negativo) — comportamiento legacy.
 *
 * También registra un StockMovement SALIDA con la reference indicada.
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
  const client = opts.tx ?? db

  // Migración automática (item 10): asegura AreaInventory.
  const areaInv = await ensureAreaInventory(areaId, productId, client)

  if (areaInv) {
    const stockBefore = areaInv.stock

    if (opts.blockNegative && stockBefore < quantity) {
      return {
        ok: false,
        source: 'area',
        areaId,
        stockBefore,
        stockAfter: stockBefore,
        insufficient: true,
        message: `Stock insuficiente (disponible: ${stockBefore}, requerido: ${quantity})`,
      }
    }

    // Decremento atómico con condición de stock (item 9).
    if (opts.blockNegative) {
      const upd = await client.areaInventory.updateMany({
        where: {
          areaId,
          productId,
          stock: { gte: quantity },
        },
        data: {
          stock: { decrement: quantity },
          reserved: { decrement: Math.min(areaInv.reserved, quantity) },
        },
      })
      if (upd.count === 0) {
        // Otro proceso concurrente se llevó el stock.
        return {
          ok: false,
          source: 'area',
          areaId,
          stockBefore,
          stockAfter: stockBefore,
          insufficient: true,
          message: `Stock insuficiente por concurrencia`,
        }
      }
    } else {
      // Modo legacy: permite stock negativo.
      await client.areaInventory.update({
        where: { id: areaInv.id },
        data: {
          stock: { decrement: quantity },
          reserved: { decrement: Math.min(areaInv.reserved, quantity) },
        },
      })
    }

    const reloaded = await client.areaInventory.findUnique({
      where: { areaId_productId: { areaId, productId } },
      select: { stock: true },
    })

    await client.stockMovement.create({
      data: {
        type: 'SALIDA',
        productId,
        areaId,
        quantity,
        unit: opts.unit,
        reason: opts.orderNumber ? `Pedido #${opts.orderNumber}` : 'Venta directa',
        reference: opts.reference,
        userId: opts.userId,
      },
    })

    return {
      ok: true,
      source: 'area',
      areaId,
      stockBefore,
      stockAfter: reloaded?.stock ?? null,
      insufficient: (stockBefore ?? 0) < quantity,
    }
  }

  // Fallback: inventario general (legacy — para retrocompatibilidad
  // cuando no existe ni AreaInventory ni InventoryItem migrable).
  const genInv = await client.inventoryItem.findUnique({ where: { productId } })
  if (!genInv) {
    return {
      ok: false,
      source: 'none',
      areaId: null,
      stockBefore: null,
      stockAfter: null,
      insufficient: true,
      message: `No existe inventario para el producto`,
    }
  }
  const stockBefore = genInv.stock
  if (opts.blockNegative && stockBefore < quantity) {
    return {
      ok: false,
      source: 'general',
      areaId: null,
      stockBefore,
      stockAfter: stockBefore,
      insufficient: true,
      message: `Stock insuficiente (disponible: ${stockBefore}, requerido: ${quantity})`,
    }
  }

  if (opts.blockNegative) {
    const upd = await client.inventoryItem.updateMany({
      where: { productId, stock: { gte: quantity } },
      data: {
        stock: { decrement: quantity },
        reserved: { decrement: Math.min(genInv.reserved, quantity) },
      },
    })
    if (upd.count === 0) {
      return {
        ok: false,
        source: 'general',
        areaId: null,
        stockBefore,
        stockAfter: stockBefore,
        insufficient: true,
        message: `Stock insuficiente por concurrencia`,
      }
    }
  } else {
    await client.inventoryItem.update({
      where: { id: genInv.id },
      data: {
        stock: { decrement: quantity },
        reserved: { decrement: Math.min(genInv.reserved, quantity) },
      },
    })
  }

  const reloaded = await client.inventoryItem.findUnique({
    where: { productId },
    select: { stock: true },
  })

  await client.stockMovement.create({
    data: {
      type: 'SALIDA',
      productId,
      areaId: null,
      quantity,
      unit: opts.unit,
      reason: opts.orderNumber ? `Pedido #${opts.orderNumber}` : 'Venta directa',
      reference: opts.reference,
      userId: opts.userId,
    },
  })

  return {
    ok: true,
    source: 'general',
    areaId: null,
    stockBefore,
    stockAfter: reloaded?.stock ?? null,
    insufficient: stockBefore < quantity,
  }
}

/**
 * Devuelve stock al AreaInventory del área (al cancelar item o pedido).
 * Si no existe AreaInventory pero existe InventoryItem, devuelve a este último.
 * Registra StockMovement ENTADA.
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
  const client = opts.tx ?? db

  // Preferimos AreaInventory del área del pedido.
  const areaInv = await client.areaInventory.findUnique({
    where: { areaId_productId: { areaId, productId } },
  })
  if (areaInv) {
    const stockBefore = areaInv.stock
    const updated = await client.areaInventory.update({
      where: { id: areaInv.id },
      data: { stock: { increment: quantity } },
    })
    await client.stockMovement.create({
      data: {
        type: 'ENTRADA',
        productId,
        areaId,
        quantity,
        unit: opts.unit,
        reason: opts.orderNumber
          ? `Devolución por cancelación de pedido #${opts.orderNumber}`
          : 'Devolución por cancelación de item',
        reference: opts.reference,
        userId: opts.userId,
      },
    })
    return {
      ok: true,
      source: 'area',
      areaId,
      stockBefore,
      stockAfter: updated.stock,
      insufficient: false,
    }
  }

  // Fallback al inventario general.
  const genInv = await client.inventoryItem.findUnique({ where: { productId } })
  if (genInv) {
    const stockBefore = genInv.stock
    const updated = await client.inventoryItem.update({
      where: { id: genInv.id },
      data: { stock: { increment: quantity } },
    })
    await client.stockMovement.create({
      data: {
        type: 'ENTRADA',
        productId,
        areaId: null,
        quantity,
        unit: opts.unit,
        reason: opts.orderNumber
          ? `Devolución por cancelación de pedido #${opts.orderNumber}`
          : 'Devolución por cancelación de item',
        reference: opts.reference,
        userId: opts.userId,
      },
    })
    return {
      ok: true,
      source: 'general',
      areaId: null,
      stockBefore,
      stockAfter: updated.stock,
      insufficient: false,
    }
  }

  // No había inventario: crearlo en el área del pedido para no perder el stock.
  const created = await client.areaInventory.create({
    data: {
      areaId,
      productId,
      stock: quantity,
      reserved: 0,
      minStock: 0,
    },
  })
  await client.stockMovement.create({
    data: {
      type: 'ENTRADA',
      productId,
      areaId,
      quantity,
      unit: opts.unit,
      reason: opts.orderNumber
        ? `Devolución por cancelación de pedido #${opts.orderNumber} (sin inventario previo)`
        : 'Devolución por cancelación de item (sin inventario previo)',
      reference: opts.reference,
      userId: opts.userId,
    },
  })
  return {
    ok: true,
    source: 'area',
    areaId,
    stockBefore: 0,
    stockAfter: created.stock,
    insufficient: false,
  }
}
