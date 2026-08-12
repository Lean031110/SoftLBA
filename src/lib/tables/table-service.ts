// TableService — Operaciones atómicas con mesas (issues #18, #19, #20)
// FASE 4 (v1.0.5)
import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'

type TxClient = Prisma.TransactionClient

export interface TableOperationResult {
  ok: boolean
  tableId: string
  previousStatus?: string
  newStatus?: string
  message?: string
  conflict?: boolean
}

export async function takeTable(params: {
  tableId: string; orderId: string; userId: string; tx?: TxClient
}): Promise<TableOperationResult> {
  const client = params.tx ?? db
  const upd = await client.table.updateMany({
    where: { id: params.tableId, status: 'LIBRE' },
    data: { status: 'OCUPADA', currentOrderId: params.orderId },
  })
  if (upd.count === 0) {
    return { ok: false, tableId: params.tableId, conflict: true, message: 'La mesa ya está ocupada o no existe' }
  }
  return { ok: true, tableId: params.tableId, previousStatus: 'LIBRE', newStatus: 'OCUPADA' }
}

export async function releaseTable(params: {
  tableId: string; expectedOrderId: string; userId: string; newStatus?: string; tx?: TxClient
}): Promise<TableOperationResult> {
  const client = params.tx ?? db
  const newStatus = params.newStatus ?? 'LIBRE'
  const upd = await client.table.updateMany({
    where: { id: params.tableId, currentOrderId: params.expectedOrderId },
    data: { status: newStatus, currentOrderId: null },
  })
  if (upd.count === 0) {
    return { ok: false, tableId: params.tableId, conflict: true, message: 'La mesa ya no tiene el pedido especificado como activo' }
  }
  return { ok: true, tableId: params.tableId, newStatus }
}

export async function transferTable(params: {
  fromTableId: string; toTableId: string; orderId: string; userId: string; tx?: TxClient
}): Promise<TableOperationResult> {
  if (params.fromTableId === params.toTableId) {
    return { ok: false, tableId: params.fromTableId, message: 'Mesa origen y destino son la misma' }
  }
  if (params.tx) return transferTableInTx(params.tx, params)
  return db.$transaction(async (tx) => transferTableInTx(tx, params))
}

async function transferTableInTx(tx: TxClient, params: {
  fromTableId: string; toTableId: string; orderId: string; userId: string
}): Promise<TableOperationResult> {
  const takeDest = await tx.table.updateMany({
    where: { id: params.toTableId, status: 'LIBRE' },
    data: { status: 'OCUPADA', currentOrderId: params.orderId },
  })
  if (takeDest.count === 0) {
    return { ok: false, tableId: params.toTableId, conflict: true, message: 'La mesa destino ya está ocupada' }
  }
  const releaseOrig = await tx.table.updateMany({
    where: { id: params.fromTableId, currentOrderId: params.orderId },
    data: { status: 'LIBRE', currentOrderId: null },
  })
  if (releaseOrig.count === 0) {
    throw new Error('ROLLBACK_TRANSFER: la mesa origen ya no tenía el pedido')
  }
  await tx.order.update({ where: { id: params.orderId }, data: { tableId: params.toTableId } }).catch(() => {})
  return { ok: true, tableId: params.toTableId, previousStatus: 'LIBRE', newStatus: 'OCUPADA' }
}

export async function canTakeTable(tableId: string, tx?: TxClient): Promise<boolean> {
  const client = tx ?? db
  const t = await client.table.findUnique({ where: { id: tableId }, select: { status: true, isActive: true } })
  if (!t || !t.isActive) return false
  return t.status === 'LIBRE'
}

export const TableService = { takeTable, releaseTable, transferTable, canTakeTable }
export default TableService
