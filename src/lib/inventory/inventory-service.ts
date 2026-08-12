// InventoryService — Fuente única de verdad para movimientos de stock
// FASE 1 (issues P0 #1, #15, #16, #17, #29)
import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'

type TxClient = Prisma.TransactionClient

export interface TransferOptions {
  idempotencyKey?: string
  userId: string
  reason?: string
  reference?: string
  unit?: string
}

export interface ConsumeOptions extends TransferOptions {
  blockNegative?: boolean
  orderNumber?: number
}

export interface ReturnOptions extends TransferOptions {
  orderNumber?: number
}

export interface OperationResult {
  ok: boolean
  source: 'area' | 'general' | 'none'
  areaId: string | null
  stockBefore: number | null
  stockAfter: number | null
  insufficient: boolean
  message?: string
  idempotent?: boolean
}

export async function ensureAreaInventory(
  areaId: string,
  productId: string,
  tx?: TxClient,
): Promise<{ id: string; stock: number; reserved: number; minStock: number; createdAt: boolean } | null> {
  const client = tx ?? db
  const existing = await client.areaInventory.findUnique({
    where: { areaId_productId: { areaId, productId } },
  })
  if (existing) return { ...existing, createdAt: false }
  const created = await client.areaInventory.create({
    data: { areaId, productId, stock: 0, reserved: 0, minStock: 0 },
  })
  return { ...created, createdAt: true }
}

function assertNonNegative(quantity: number, label = 'quantity'): void {
  if (typeof quantity !== 'number' || Number.isNaN(quantity)) {
    throw new Error(`InventoryService: ${label} debe ser número válido (recibido: ${quantity})`)
  }
  if (quantity < 0) {
    throw new Error(`InventoryService: ${label} no puede ser negativo (recibido: ${quantity})`)
  }
}

export async function transfer(params: {
  from: { areaId: string; productId: string }
  to: { areaId: string; productId: string }
  quantity: number
  options?: TransferOptions
  tx?: TxClient
}): Promise<OperationResult> {
  assertNonNegative(params.quantity, 'quantity')
  if (params.quantity === 0) {
    return { ok: true, source: 'area', areaId: params.to.areaId, stockBefore: null, stockAfter: null, insufficient: false, idempotent: true }
  }
  return db.$transaction(async (tx) => {
    const t = params.tx ?? tx
    await ensureAreaInventory(params.to.areaId, params.to.productId, t)
    const upd = await t.areaInventory.updateMany({
      where: { areaId: params.from.areaId, productId: params.from.productId, stock: { gte: params.quantity } },
      data: { stock: { decrement: params.quantity } },
    })
    if (upd.count === 0) {
      const fromInv = await t.areaInventory.findUnique({
        where: { areaId_productId: params.from },
        select: { stock: true },
      })
      return { ok: false, source: 'area', areaId: params.from.areaId, stockBefore: fromInv?.stock ?? 0, stockAfter: fromInv?.stock ?? 0, insufficient: true, message: `Stock insuficiente en origen` }
    }
    await t.areaInventory.update({
      where: { areaId_productId: { areaId: params.to.areaId, productId: params.to.productId } },
      data: { stock: { increment: params.quantity } },
    })
    const opts = params.options
    await t.stockMovement.create({
      data: {
        type: 'TRASLADO', productId: params.from.productId, areaId: params.from.areaId,
        quantity: params.quantity, unit: opts?.unit ?? 'unidad',
        reason: opts?.reason ?? `Traslado`, reference: opts?.reference ?? `TRASLADO`, userId: opts?.userId ?? 'system',
      },
    })
    const reloaded = await t.areaInventory.findUnique({
      where: { areaId_productId: { areaId: params.to.areaId, productId: params.to.productId } },
      select: { stock: true },
    })
    return { ok: true, source: 'area', areaId: params.to.areaId, stockBefore: null, stockAfter: reloaded?.stock ?? null, insufficient: false }
  })
}

export async function consume(params: {
  areaId: string; productId: string; quantity: number; options: ConsumeOptions; tx?: TxClient
}): Promise<OperationResult> {
  assertNonNegative(params.quantity, 'quantity')
  if (params.quantity === 0) {
    return { ok: true, source: 'area', areaId: params.areaId, stockBefore: null, stockAfter: null, insufficient: false, idempotent: true }
  }
  const opts = params.options
  const blockNegative = opts.blockNegative ?? true

  // v1.0.17: si se pasa tx, usarlo directamente (no crear nueva transacción).
  // Si no se pasa tx, crear una nueva.
  const exec = async (t: TxClient): Promise<OperationResult> => {
    await ensureAreaInventory(params.areaId, params.productId, t)
    const before = await t.areaInventory.findUnique({
      where: { areaId_productId: { areaId: params.areaId, productId: params.productId } },
      select: { stock: true, id: true },
    })
    const stockBefore = before?.stock ?? 0
    if (blockNegative && stockBefore < params.quantity) {
      return { ok: false, source: 'area', areaId: params.areaId, stockBefore, stockAfter: stockBefore, insufficient: true, message: `Stock insuficiente` }
    }
    const where: Prisma.AreaInventoryWhereInput = { areaId: params.areaId, productId: params.productId }
    if (blockNegative) where.stock = { gte: params.quantity }
    const upd = await t.areaInventory.updateMany({ where, data: { stock: { decrement: params.quantity } } })
    if (blockNegative && upd.count === 0) {
      return { ok: false, source: 'area', areaId: params.areaId, stockBefore, stockAfter: stockBefore, insufficient: true, message: `Stock insuficiente por concurrencia` }
    }
    const reloaded = await t.areaInventory.findUnique({
      where: { areaId_productId: { areaId: params.areaId, productId: params.productId } },
      select: { stock: true },
    })
    await t.stockMovement.create({
      data: {
        type: 'SALIDA', productId: params.productId, areaId: params.areaId,
        quantity: params.quantity, unit: opts.unit ?? 'unidad',
        reason: opts.orderNumber ? `Pedido #${opts.orderNumber}` : 'Venta directa',
        reference: opts.reference ?? 'CONSUMO', userId: opts.userId,
      },
    })
    return { ok: true, source: 'area', areaId: params.areaId, stockBefore, stockAfter: reloaded?.stock ?? null, insufficient: false }
  }

  if (params.tx) return exec(params.tx)
  return db.$transaction(exec)
}

export async function returnStock(params: {
  areaId: string; productId: string; quantity: number; options: ReturnOptions; tx?: TxClient
}): Promise<OperationResult> {
  assertNonNegative(params.quantity, 'quantity')
  if (params.quantity === 0) {
    return { ok: true, source: 'area', areaId: params.areaId, stockBefore: null, stockAfter: null, insufficient: false, idempotent: true }
  }
  const opts = params.options
  const exec = async (t: TxClient): Promise<OperationResult> => {
    await ensureAreaInventory(params.areaId, params.productId, t)
    const before = await t.areaInventory.findUnique({
      where: { areaId_productId: { areaId: params.areaId, productId: params.productId } },
      select: { stock: true },
    })
    const stockBefore = before?.stock ?? 0
    const updated = await t.areaInventory.update({
      where: { areaId_productId: { areaId: params.areaId, productId: params.productId } },
      data: { stock: { increment: params.quantity } },
    })
    await t.stockMovement.create({
      data: {
        type: 'ENTRADA', productId: params.productId, areaId: params.areaId,
        quantity: params.quantity, unit: opts.unit ?? 'unidad',
        reason: opts.orderNumber ? `Devolución #${opts.orderNumber}` : 'Devolución',
        reference: opts.reference ?? 'RETURN', userId: opts.userId,
      },
    })
    return { ok: true, source: 'area', areaId: params.areaId, stockBefore, stockAfter: updated.stock, insufficient: false }
  }
  if (params.tx) return exec(params.tx)
  return db.$transaction(exec)
}

export async function auditDuplicatedStock(tx?: TxClient) {
  const client = tx ?? db
  const products = await client.product.findMany({
    where: { isActive: true },
    include: { inventory: true, areaStocks: true },
  })
  const duplicated: any[] = []
  let withGeneral = 0, withArea = 0
  for (const p of products) {
    const general = p.inventory?.stock ?? 0
    const areaSum = p.areaStocks.reduce((s, a) => s + a.stock, 0)
    if (general > 0) withGeneral++
    if (areaSum > 0) withArea++
    if (general > 0 && areaSum > 0) {
      duplicated.push({ productId: p.id, productName: p.name, generalStock: general, areaStockSum: areaSum, totalAccounted: general + areaSum })
    }
  }
  return { totalProducts: products.length, withGeneralStock: withGeneral, withAreaStock: withArea, duplicated }
}

export const InventoryService = { ensureAreaInventory, transfer, consume, returnStock, auditDuplicatedStock }
export default InventoryService
