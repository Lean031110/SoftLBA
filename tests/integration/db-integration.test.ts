// tests/integration/db-integration.test.ts
// B: Tests con DB real. Usa la MISMA DB del servidor (test-integration.db).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { InventoryService } from '../../src/lib/inventory/inventory-service'
import { TableService } from '../../src/lib/tables/table-service'
import { resolve } from 'path'

// Use the SAME DATABASE_URL as the CI env — do NOT create a separate PrismaClient
const prisma = new PrismaClient()

async function createTestArea(code: string, name: string) {
  return prisma.area.upsert({ where: { code }, update: {}, create: { code, name, isActive: true } })
}
async function createTestProduct(code: string, name: string, type: 'DIRECTO' | 'FINAL' = 'DIRECTO') {
  return prisma.product.upsert({ where: { code }, update: {}, create: { code, name, type, unit: 'unidad', price: 100, cost: 50, isActive: true, isAvailable: true } })
}
async function createTestTable(code: string, name: string) {
  return prisma.table.upsert({ where: { code }, update: { status: 'LIBRE', currentOrderId: null, isActive: true }, create: { code, name, status: 'LIBRE', isActive: true } })
}
async function ensureTestUser() {
  return prisma.user.upsert({ where: { username: 'test-integration-user' }, update: {}, create: { username: 'test-integration-user', passwordHash: '$2a$10$test', role: 'ADMIN', isActive: true, mustChangePass: false } })
}

describe('DB Integration — Inventario', () => {
  let areaId: string, productId: string, userId: string
  beforeAll(async () => {
    const area = await createTestArea('TEST-AREA', 'Área Test'); areaId = area.id
    const product = await createTestProduct('TEST-PROD-1', 'Producto Test 1'); productId = product.id
    const user = await ensureTestUser(); userId = user.id
    expect(areaId).toBeTruthy(); expect(productId).toBeTruthy(); expect(userId).toBeTruthy()
  })
  afterAll(async () => {
    await prisma.stockMovement.deleteMany({ where: { reference: { startsWith: 'TEST-' } } })
    await prisma.areaInventory.deleteMany({ where: { areaId } })
    await prisma.product.deleteMany({ where: { code: { startsWith: 'TEST-' } } })
    await prisma.area.deleteMany({ where: { code: { startsWith: 'TEST-' } } })
  })

  it('consume stock exitosamente', async () => {
    await prisma.areaInventory.upsert({ where: { areaId_productId: { areaId, productId } }, update: { stock: 50 }, create: { areaId, productId, stock: 50, reserved: 0, minStock: 0 } })
    const r = await InventoryService.consume({ areaId, productId, quantity: 5, options: { userId, reference: 'TEST-CONSUME-1', unit: 'unidad', blockNegative: true } })
    expect(r.ok).toBe(true); expect(r.stockAfter).toBe(45)
  })
  it('rechaza consume insuficiente', async () => {
    await prisma.areaInventory.upsert({ where: { areaId_productId: { areaId, productId } }, update: { stock: 3 }, create: { areaId, productId, stock: 3, reserved: 0, minStock: 0 } })
    const r = await InventoryService.consume({ areaId, productId, quantity: 5, options: { userId, reference: 'TEST-CONSUME-2', unit: 'unidad', blockNegative: true } })
    expect(r.ok).toBe(false); expect(r.insufficient).toBe(true)
  })
  it('consume exacto deja stock en 0', async () => {
    await prisma.areaInventory.upsert({ where: { areaId_productId: { areaId, productId } }, update: { stock: 10 }, create: { areaId, productId, stock: 10, reserved: 0, minStock: 0 } })
    const r = await InventoryService.consume({ areaId, productId, quantity: 10, options: { userId, reference: 'TEST-CONSUME-3', unit: 'unidad', blockNegative: true } })
    expect(r.ok).toBe(true); expect(r.stockAfter).toBe(0)
  })
  it('returnStock incrementa', async () => {
    await prisma.areaInventory.upsert({ where: { areaId_productId: { areaId, productId } }, update: { stock: 10 }, create: { areaId, productId, stock: 10, reserved: 0, minStock: 0 } })
    const r = await InventoryService.returnStock({ areaId, productId, quantity: 5, options: { userId, reference: 'TEST-RETURN-1', unit: 'unidad' } })
    expect(r.ok).toBe(true); expect(r.stockAfter).toBe(15)
  })
  it('transfer atómico', async () => {
    const area2 = await createTestArea('TEST-AREA-2', 'Área 2')
    await prisma.areaInventory.upsert({ where: { areaId_productId: { areaId, productId } }, update: { stock: 20 }, create: { areaId, productId, stock: 20, reserved: 0, minStock: 0 } })
    await prisma.areaInventory.upsert({ where: { areaId_productId: { areaId: area2.id, productId } }, update: { stock: 0 }, create: { areaId: area2.id, productId, stock: 0, reserved: 0, minStock: 0 } })
    const r = await InventoryService.transfer({ from: { areaId, productId }, to: { areaId: area2.id, productId }, quantity: 10, options: { userId, reference: 'TEST-TRANSFER-1', unit: 'unidad' } })
    expect(r.ok).toBe(true)
  })
})

describe('DB Integration — Mesas', () => {
  let tableId: string, userId: string
  beforeAll(async () => {
    const table = await createTestTable('TEST-T1', 'Mesa 1'); tableId = table.id
    const user = await ensureTestUser(); userId = user.id
    expect(tableId).toBeTruthy(); expect(userId).toBeTruthy()
  })
  afterAll(async () => { await prisma.table.deleteMany({ where: { code: { startsWith: 'TEST-T' } } }) })

  it('takeTable LIBRE → éxito', async () => {
    await prisma.table.update({ where: { id: tableId }, data: { status: 'LIBRE', currentOrderId: null } })
    const r = await TableService.takeTable({ tableId, orderId: 'test-order-1', userId })
    expect(r.ok).toBe(true)
  })
  it('takeTable OCUPADA → conflicto', async () => {
    const r = await TableService.takeTable({ tableId, orderId: 'test-order-2', userId })
    expect(r.ok).toBe(false); expect(r.conflict).toBe(true)
  })
  it('releaseTable coincide → éxito', async () => {
    const r = await TableService.releaseTable({ tableId, expectedOrderId: 'test-order-1', userId })
    expect(r.ok).toBe(true)
  })
  it('releaseTable no coincide → conflicto', async () => {
    await prisma.table.update({ where: { id: tableId }, data: { status: 'OCUPADA', currentOrderId: 'test-3' } })
    const r = await TableService.releaseTable({ tableId, expectedOrderId: 'wrong', userId })
    expect(r.ok).toBe(false); expect(r.conflict).toBe(true)
  })
})

describe('DB Integration — Concurrencia', () => {
  let areaId: string, productId: string, userId: string
  beforeAll(async () => {
    const area = await createTestArea('TEST-CONC', 'Conc'); areaId = area.id
    const product = await createTestProduct('TEST-CONC-P', 'Conc'); productId = product.id
    const user = await ensureTestUser(); userId = user.id
    expect(areaId).toBeTruthy(); expect(productId).toBeTruthy(); expect(userId).toBeTruthy()
  })
  afterAll(async () => {
    await prisma.stockMovement.deleteMany({ where: { reference: { startsWith: 'CONC-' } } })
    await prisma.areaInventory.deleteMany({ where: { areaId } })
    await prisma.product.deleteMany({ where: { code: 'TEST-CONC-P' } })
    await prisma.area.deleteMany({ where: { code: 'TEST-CONC' } })
  })

  it('stock=1: dos consumos simultáneos → máximo 1 éxito', async () => {
    await prisma.areaInventory.upsert({ where: { areaId_productId: { areaId, productId } }, update: { stock: 1 }, create: { areaId, productId, stock: 1, reserved: 0, minStock: 0 } })
    const [r1, r2] = await Promise.all([
      InventoryService.consume({ areaId, productId, quantity: 1, options: { userId, reference: 'CONC-A', unit: 'unidad', blockNegative: true } }),
      InventoryService.consume({ areaId, productId, quantity: 1, options: { userId, reference: 'CONC-B', unit: 'unidad', blockNegative: true } }),
    ])
    const successCount = [r1.ok, r2.ok].filter(Boolean).length
    expect(successCount).toBeLessThanOrEqual(1)
    const inv = await prisma.areaInventory.findUnique({ where: { areaId_productId: { areaId, productId } } })
    expect(inv?.stock).toBeGreaterThanOrEqual(0)
  })
})
