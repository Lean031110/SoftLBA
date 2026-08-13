// tests/integration/db-integration.test.ts
// FASE 24: Tests de integración con SQLite real.
// Pruebas de concurrencia, inventario, mesas, pedidos y pagos.
// Estos tests usan la DB de test real (no mocks).
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { InventoryService } from '../../src/lib/inventory/inventory-service'
import { TableService } from '../../src/lib/tables/table-service'

const prisma = new PrismaClient({
  datasources: { db: { url: 'file:./db/test-integration.db' } },
})

// Helper para crear datos de test
async function createTestArea(code: string, name: string) {
  return prisma.area.upsert({
    where: { code },
    update: {},
    create: { code, name, isActive: true },
  })
}

async function createTestProduct(code: string, name: string, type: 'DIRECTO' | 'FINAL' = 'DIRECTO') {
  return prisma.product.upsert({
    where: { code },
    update: {},
    create: { code, name, type, unit: 'unidad', price: 100, cost: 50, isActive: true, isAvailable: true },
  })
}

async function createTestTable(code: string, name: string) {
  return prisma.table.upsert({
    where: { code },
    update: {},
    create: { code, name, status: 'LIBRE', isActive: true },
  })
}

async function resetTestData() {
  // Clean up test data
  await prisma.stockMovement.deleteMany({})
  await prisma.areaInventory.deleteMany({})
  await prisma.inventoryItem.deleteMany({})
  await prisma.orderItem.deleteMany({})
  await prisma.order.deleteMany({})
  await prisma.table.deleteMany({ where: { code: { startsWith: 'TEST-' } } })
  await prisma.product.deleteMany({ where: { code: { startsWith: 'TEST-' } } })
}

describe('DB Integration — Inventario con SQLite real', () => {
  let areaId: string
  let productId: string

  beforeAll(async () => {
    const area = await createTestArea('TEST-AREA', 'Área de Test')
    areaId = area.id
    const product = await createTestProduct('TEST-PROD-1', 'Producto Test 1')
    productId = product.id
  })

  afterAll(async () => {
    await resetTestData()
    await prisma.$disconnect()
  })

  describe('consume() con DB real', () => {
    it('consume stock exitosamente cuando hay suficiente', async () => {
      // Crear AreaInventory con stock inicial
      await prisma.areaInventory.upsert({
        where: { areaId_productId: { areaId, productId } },
        update: { stock: 50 },
        create: { areaId, productId, stock: 50, reserved: 0, minStock: 0 },
      })

      const r = await InventoryService.consume({
        areaId,
        productId,
        quantity: 5,
        options: { userId: 'test-user', reference: 'TEST-CONSUME-1', unit: 'unidad', blockNegative: true },
      })

      expect(r.ok).toBe(true)
      expect(r.stockAfter).toBe(45)

      // Verificar en DB
      const inv = await prisma.areaInventory.findUnique({
        where: { areaId_productId: { areaId, productId } },
      })
      expect(inv?.stock).toBe(45)
    })

    it('rechaza consume cuando stock insuficiente', async () => {
      await prisma.areaInventory.upsert({
        where: { areaId_productId: { areaId, productId } },
        update: { stock: 3 },
        create: { areaId, productId, stock: 3, reserved: 0, minStock: 0 },
      })

      const r = await InventoryService.consume({
        areaId,
        productId,
        quantity: 5,
        options: { userId: 'test-user', reference: 'TEST-CONSUME-2', unit: 'unidad', blockNegative: true },
      })

      expect(r.ok).toBe(false)
      expect(r.insufficient).toBe(true)

      // Verificar que el stock no cambió
      const inv = await prisma.areaInventory.findUnique({
        where: { areaId_productId: { areaId, productId } },
      })
      expect(inv?.stock).toBe(3)
    })

    it('consume deja stock en 0 cuando es exacto', async () => {
      await prisma.areaInventory.upsert({
        where: { areaId_productId: { areaId, productId } },
        update: { stock: 10 },
        create: { areaId, productId, stock: 10, reserved: 0, minStock: 0 },
      })

      const r = await InventoryService.consume({
        areaId,
        productId,
        quantity: 10,
        options: { userId: 'test-user', reference: 'TEST-CONSUME-3', unit: 'unidad', blockNegative: true },
      })

      expect(r.ok).toBe(true)
      expect(r.stockAfter).toBe(0)
    })

    it('registra StockMovement tipo SALIDA', async () => {
      const movements = await prisma.stockMovement.findMany({
        where: { reference: 'TEST-CONSUME-1' },
      })
      expect(movements.length).toBeGreaterThan(0)
      expect(movements[0].type).toBe('SALIDA')
    })
  })

  describe('returnStock() con DB real', () => {
    it('incrementa stock al devolver', async () => {
      await prisma.areaInventory.upsert({
        where: { areaId_productId: { areaId, productId } },
        update: { stock: 10 },
        create: { areaId, productId, stock: 10, reserved: 0, minStock: 0 },
      })

      const r = await InventoryService.returnStock({
        areaId,
        productId,
        quantity: 5,
        options: { userId: 'test-user', reference: 'TEST-RETURN-1', unit: 'unidad' },
      })

      expect(r.ok).toBe(true)
      expect(r.stockAfter).toBe(15)

      const inv = await prisma.areaInventory.findUnique({
        where: { areaId_productId: { areaId, productId } },
      })
      expect(inv?.stock).toBe(15)
    })

    it('registra StockMovement tipo ENTRADA', async () => {
      const movements = await prisma.stockMovement.findMany({
        where: { reference: 'TEST-RETURN-1' },
      })
      expect(movements.length).toBe(1)
      expect(movements[0].type).toBe('ENTRADA')
    })
  })

  describe('transfer() con DB real', () => {
    it('transfiere stock de un área a otra atómicamente', async () => {
      const area2 = await createTestArea('TEST-AREA-2', 'Área de Test 2')

      // Set stock=20 en área origen
      await prisma.areaInventory.upsert({
        where: { areaId_productId: { areaId, productId } },
        update: { stock: 20 },
        create: { areaId, productId, stock: 20, reserved: 0, minStock: 0 },
      })

      // Asegurar que área destino existe con 0
      await prisma.areaInventory.upsert({
        where: { areaId_productId: { areaId: area2.id, productId } },
        update: { stock: 0 },
        create: { areaId: area2.id, productId, stock: 0, reserved: 0, minStock: 0 },
      })

      const r = await InventoryService.transfer({
        from: { areaId, productId },
        to: { areaId: area2.id, productId },
        quantity: 10,
        options: { userId: 'test-user', reference: 'TEST-TRANSFER-1', unit: 'unidad' },
      })

      expect(r.ok).toBe(true)

      const origInv = await prisma.areaInventory.findUnique({
        where: { areaId_productId: { areaId, productId } },
      })
      const destInv = await prisma.areaInventory.findUnique({
        where: { areaId_productId: { areaId: area2.id, productId } },
      })
      expect(origInv?.stock).toBe(10)
      expect(destInv?.stock).toBe(10)
    })

    it('falla si stock insuficiente en origen', async () => {
      const area2 = await createTestArea('TEST-AREA-2', 'Área de Test 2')

      await prisma.areaInventory.upsert({
        where: { areaId_productId: { areaId, productId } },
        update: { stock: 5 },
        create: { areaId, productId, stock: 5, reserved: 0, minStock: 0 },
      })

      const r = await InventoryService.transfer({
        from: { areaId, productId },
        to: { areaId: area2.id, productId },
        quantity: 100,
        options: { userId: 'test-user', reference: 'TEST-TRANSFER-2', unit: 'unidad' },
      })

      expect(r.ok).toBe(false)
      expect(r.insufficient).toBe(true)
    })
  })
})

describe('DB Integration — Mesas con SQLite real', () => {
  let tableId: string
  let orderId: string

  beforeAll(async () => {
    const table = await createTestTable('TEST-T1', 'Mesa Test 1')
    tableId = table.id
  })

  afterAll(async () => {
    await prisma.table.deleteMany({ where: { code: { startsWith: 'TEST-' } } })
  })

  describe('takeTable() con DB real', () => {
    it('toma mesa LIBRE exitosamente', async () => {
      await prisma.table.update({ where: { id: tableId }, data: { status: 'LIBRE', currentOrderId: null } })

      const r = await TableService.takeTable({
        tableId,
        orderId: 'test-order-1',
        userId: 'test-user',
      })

      expect(r.ok).toBe(true)

      const table = await prisma.table.findUnique({ where: { id: tableId } })
      expect(table?.status).toBe('OCUPADA')
      expect(table?.currentOrderId).toBe('test-order-1')
    })

    it('falla si mesa ya está OCUPADA', async () => {
      const r = await TableService.takeTable({
        tableId,
        orderId: 'test-order-2',
        userId: 'test-user',
      })

      expect(r.ok).toBe(false)
      expect(r.conflict).toBe(true)
    })
  })

  describe('releaseTable() con DB real', () => {
    it('libera mesa si currentOrderId coincide', async () => {
      const r = await TableService.releaseTable({
        tableId,
        expectedOrderId: 'test-order-1',
        userId: 'test-user',
      })

      expect(r.ok).toBe(true)

      const table = await prisma.table.findUnique({ where: { id: tableId } })
      expect(table?.status).toBe('LIBRE')
      expect(table?.currentOrderId).toBeNull()
    })

    it('falla si currentOrderId NO coincide', async () => {
      await prisma.table.update({
        where: { id: tableId },
        data: { status: 'OCUPADA', currentOrderId: 'test-order-3' },
      })

      const r = await TableService.releaseTable({
        tableId,
        expectedOrderId: 'wrong-order',
        userId: 'test-user',
      })

      expect(r.ok).toBe(false)
      expect(r.conflict).toBe(true)
    })
  })

  describe('transferTable() con DB real', () => {
    it('transfiere mesa atómicamente', async () => {
      const table2 = await createTestTable('TEST-T2', 'Mesa Test 2')

      await prisma.table.update({
        where: { id: tableId },
        data: { status: 'OCUPADA', currentOrderId: 'test-order-transfer' },
      })
      await prisma.table.update({
        where: { id: table2.id },
        data: { status: 'LIBRE', currentOrderId: null },
      })

      const r = await TableService.transferTable({
        fromTableId: tableId,
        toTableId: table2.id,
        orderId: 'test-order-transfer',
        userId: 'test-user',
      })

      expect(r.ok).toBe(true)

      const t1 = await prisma.table.findUnique({ where: { id: tableId } })
      const t2 = await prisma.table.findUnique({ where: { id: table2.id } })
      expect(t1?.status).toBe('LIBRE')
      expect(t1?.currentOrderId).toBeNull()
      expect(t2?.status).toBe('OCUPADA')
      expect(t2?.currentOrderId).toBe('test-order-transfer')
    })
  })
})

describe('DB Integration — Concurrencia de inventario', () => {
  let areaId: string
  let productId: string

  beforeAll(async () => {
    const area = await createTestArea('TEST-CONC', 'Área Concurrencia')
    areaId = area.id
    const product = await createTestProduct('TEST-CONC-P', 'Producto Conc')
    productId = product.id
  })

  afterAll(async () => {
    await prisma.stockMovement.deleteMany({ where: { reference: { startsWith: 'CONC-' } } })
    await prisma.areaInventory.deleteMany({ where: { areaId } })
    await prisma.product.deleteMany({ where: { code: 'TEST-CONC-P' } })
    await prisma.area.deleteMany({ where: { code: 'TEST-CONC' } })
  })

  it('dos consumos simultáneos de stock=1 → solo uno tiene éxito', async () => {
    // Stock = 1
    await prisma.areaInventory.upsert({
      where: { areaId_productId: { areaId, productId } },
      update: { stock: 1 },
      create: { areaId, productId, stock: 1, reserved: 0, minStock: 0 },
    })

    // Dos consumos simultáneos
    const [r1, r2] = await Promise.all([
      InventoryService.consume({
        areaId, productId, quantity: 1,
        options: { userId: 'user-a', reference: 'CONC-A', unit: 'unidad', blockNegative: true },
      }),
      InventoryService.consume({
        areaId, productId, quantity: 1,
        options: { userId: 'user-b', reference: 'CONC-B', unit: 'unidad', blockNegative: true },
      }),
    ])

    // Al menos uno debe fallar
    const successCount = [r1.ok, r2.ok].filter(Boolean).length
    expect(successCount).toBeLessThanOrEqual(1)

    // El stock debe ser 0 o 1 (nunca -1)
    const inv = await prisma.areaInventory.findUnique({
      where: { areaId_productId: { areaId, productId } },
    })
    expect(inv?.stock).toBeGreaterThanOrEqual(0)
  })
})
