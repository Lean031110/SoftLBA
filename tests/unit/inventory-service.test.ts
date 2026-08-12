// Tests unitarios para InventoryService (FASE 1 — v1.0.2, issues #1, #17)
// ------------------------------------------------------------
// Mock del db para tests que no requieren SQLite real.
// ============================================================
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/lib/db', () => {
  const mockAreaInventory = {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
  }
  const mockStockMovement = {
    create: vi.fn(),
  }
  const mockProduct = {
    findMany: vi.fn(),
  }
  const mockInventoryItem = {
    findUnique: vi.fn(),
  }
  return {
    db: {
      areaInventory: mockAreaInventory,
      stockMovement: mockStockMovement,
      product: mockProduct,
      inventoryItem: mockInventoryItem,
      $transaction: vi.fn(async (cb: any) => cb({
        areaInventory: mockAreaInventory,
        stockMovement: mockStockMovement,
        product: mockProduct,
        inventoryItem: mockInventoryItem,
      })),
    },
  }
})

import { InventoryService } from '../../src/lib/inventory/inventory-service'
import { db } from '../../src/lib/db'

const mockAreaInventory = db.areaInventory as any
const mockStockMovement = db.stockMovement as any
const mockProduct = db.product as any
const mockInventoryItem = db.inventoryItem as any

describe('InventoryService — ensureAreaInventory (issue #1 fix)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna existente si ya hay AreaInventory', async () => {
    mockAreaInventory.findUnique.mockResolvedValue({
      id: 'inv-1',
      stock: 50,
      reserved: 0,
      minStock: 5,
    })
    const r = await InventoryService.ensureAreaInventory('area-1', 'prod-1')
    expect(r?.id).toBe('inv-1')
    expect(r?.stock).toBe(50)
    expect(r?.createdAt).toBe(false)
  })

  it('crea con stock=0 si no existe (NO copia de InventoryItem)', async () => {
    mockAreaInventory.findUnique.mockResolvedValue(null)
    mockAreaInventory.create.mockResolvedValue({
      id: 'inv-new',
      stock: 0,  // ← FIX #1: 0, no copiado
      reserved: 0,
      minStock: 0,
    })
    const r = await InventoryService.ensureAreaInventory('area-1', 'prod-1')
    expect(r?.id).toBe('inv-new')
    expect(r?.stock).toBe(0)  // ← FIX crítico
    expect(r?.createdAt).toBe(true)
  })
})

describe('InventoryService — consume (issue #17)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('consume stock exitosamente cuando hay suficiente', async () => {
    mockAreaInventory.findUnique
      .mockResolvedValueOnce(null)  // ensureAreaInventory: no existe
      .mockResolvedValueOnce({ stock: 50, id: 'inv-1' })  // antes
      .mockResolvedValueOnce({ stock: 45 })  // después (reloaded)
    mockAreaInventory.create.mockResolvedValue({ id: 'inv-new', stock: 0 })
    mockAreaInventory.updateMany.mockResolvedValue({ count: 1 })
    mockStockMovement.create.mockResolvedValue({})

    const r = await InventoryService.consume({
      areaId: 'area-1',
      productId: 'prod-1',
      quantity: 5,
      options: { userId: 'user-1', reference: 'TEST', unit: 'unidad' },
    })

    expect(r.ok).toBe(true)
    expect(r.stockBefore).toBe(50)
    expect(r.stockAfter).toBe(45)
  })

  it('falla si stock insuficiente y blockNegative=true', async () => {
    mockAreaInventory.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ stock: 3, id: 'inv-1' })
    mockAreaInventory.create.mockResolvedValue({ id: 'inv-new', stock: 0 })

    const r = await InventoryService.consume({
      areaId: 'area-1',
      productId: 'prod-1',
      quantity: 5,  // más de lo disponible (3)
      options: { userId: 'user-1', reference: 'TEST', unit: 'unidad', blockNegative: true },
    })

    expect(r.ok).toBe(false)
    expect(r.insufficient).toBe(true)
    expect(r.message).toMatch(/Stock insuficiente/)
  })

  it('quantity=0 retorna idempotente sin tocar DB', async () => {
    const r = await InventoryService.consume({
      areaId: 'area-1',
      productId: 'prod-1',
      quantity: 0,
      options: { userId: 'user-1', reference: 'TEST', unit: 'unidad' },
    })
    expect(r.ok).toBe(true)
    expect(r.idempotent).toBe(true)
  })

  it('lanza error si quantity es negativa', async () => {
    await expect(
      InventoryService.consume({
        areaId: 'area-1',
        productId: 'prod-1',
        quantity: -5,
        options: { userId: 'user-1', reference: 'TEST', unit: 'unidad' },
      }),
    ).rejects.toThrow(/no puede ser negativo/)
  })

  it('lanza error si quantity es NaN', async () => {
    await expect(
      InventoryService.consume({
        areaId: 'area-1',
        productId: 'prod-1',
        quantity: NaN,
        options: { userId: 'user-1', reference: 'TEST', unit: 'unidad' },
      }),
    ).rejects.toThrow(/debe ser número válido/)
  })
})

describe('InventoryService — returnStock', () => {
  beforeEach(() => vi.clearAllMocks())

  it('incrementa stock al devolver', async () => {
    mockAreaInventory.findUnique
      .mockResolvedValueOnce(null)  // ensureAreaInventory
      .mockResolvedValueOnce({ stock: 10 })  // before
    mockAreaInventory.create.mockResolvedValue({ id: 'inv-new', stock: 0 })
    mockAreaInventory.update.mockResolvedValue({ stock: 15 })
    mockStockMovement.create.mockResolvedValue({})

    const r = await InventoryService.returnStock({
      areaId: 'area-1',
      productId: 'prod-1',
      quantity: 5,
      options: { userId: 'user-1', reference: 'TEST', unit: 'unidad' },
    })

    expect(r.ok).toBe(true)
    expect(r.stockBefore).toBe(10)
    expect(r.stockAfter).toBe(15)
  })

  it('quantity=0 retorna idempotente', async () => {
    const r = await InventoryService.returnStock({
      areaId: 'area-1',
      productId: 'prod-1',
      quantity: 0,
      options: { userId: 'user-1', reference: 'TEST', unit: 'unidad' },
    })
    expect(r.ok).toBe(true)
    expect(r.idempotent).toBe(true)
  })
})

describe('InventoryService — transfer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('transfiere stock de origen a destino atómicamente', async () => {
    mockAreaInventory.findUnique
      .mockResolvedValueOnce(null)  // ensureAreaInventory destino
      .mockResolvedValueOnce({ stock: 30 })  // after reloaded
    mockAreaInventory.create.mockResolvedValue({ id: 'inv-dest', stock: 0 })
    mockAreaInventory.updateMany.mockResolvedValue({ count: 1 })  // decrement origen OK
    mockAreaInventory.update.mockResolvedValue({ stock: 20 })  // increment destino
    mockStockMovement.create.mockResolvedValue({})

    const r = await InventoryService.transfer({
      from: { areaId: 'central', productId: 'prod-1' },
      to: { areaId: 'salon', productId: 'prod-1' },
      quantity: 20,
      options: { userId: 'user-1', reference: 'TRASLADO', unit: 'unidad' },
    })

    expect(r.ok).toBe(true)
    expect(r.areaId).toBe('salon')
  })

  it('falla si origen no tiene stock suficiente', async () => {
    mockAreaInventory.findUnique.mockResolvedValue(null)
    mockAreaInventory.create.mockResolvedValue({ id: 'inv', stock: 0 })
    mockAreaInventory.updateMany.mockResolvedValue({ count: 0 })  // no se actualizó

    const r = await InventoryService.transfer({
      from: { areaId: 'central', productId: 'prod-1' },
      to: { areaId: 'salon', productId: 'prod-1' },
      quantity: 100,
      options: { userId: 'user-1', reference: 'TRASLADO', unit: 'unidad' },
    })

    expect(r.ok).toBe(false)
    expect(r.insufficient).toBe(true)
    expect(r.message).toMatch(/Stock insuficiente en origen/)
  })
})

describe('InventoryService — auditDuplicatedStock (issue #1 detection)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('detecta productos con stock duplicado', async () => {
    // Mock de findMany que retorna productos con relaciones include.
    mockProduct.findMany.mockResolvedValue([
      {
        id: 'p1', name: 'Coca Cola', isActive: true,
        inventory: { stock: 50 },
        areaStocks: [{ stock: 30 }, { stock: 20 }],
      },
      {
        id: 'p2', name: 'Pizza', isActive: true,
        inventory: null,
        areaStocks: [{ stock: 5 }],
      },
    ])

    const audit = await InventoryService.auditDuplicatedStock()
    expect(audit.totalProducts).toBe(2)
    expect(audit.withGeneralStock).toBe(1)
    expect(audit.withAreaStock).toBe(2)
    expect(audit.duplicated).toHaveLength(1)
    expect(audit.duplicated[0].productName).toBe('Coca Cola')
    expect(audit.duplicated[0].generalStock).toBe(50)
    expect(audit.duplicated[0].areaStockSum).toBe(50)
  })

  it('retorna lista vacía si no hay duplicados', async () => {
    mockProduct.findMany.mockResolvedValue([
      {
        id: 'p1', name: 'Item A', isActive: true,
        inventory: { stock: 10 },
        areaStocks: [],  // Sin stock en áreas → no duplicado
      },
    ])
    const audit = await InventoryService.auditDuplicatedStock()
    expect(audit.duplicated).toHaveLength(0)
  })
})
