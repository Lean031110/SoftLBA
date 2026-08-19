// Tests de concurrencia de inventario (FASE 22)
// Cubre: stock=1 dos usuarios compran, doble consumo, doble devolución
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/lib/db', () => {
  const mockAreaInventory = {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  }
  const mockStockMovement = { create: vi.fn() }
  const mockProduct = { findMany: vi.fn() }
  const mockInventoryItem = { findUnique: vi.fn() }
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

describe('Concurrencia — Última unidad de inventario', () => {
  beforeEach(() => vi.clearAllMocks())

  it('Usuario A compra última unidad → éxito (count=1)', async () => {
    // Stock = 1, Usuario A compra 1
    mockAreaInventory.findUnique
      .mockResolvedValueOnce(null) // ensureAreaInventory
      .mockResolvedValueOnce({ stock: 1, id: 'inv-1' }) // before
      .mockResolvedValueOnce({ stock: 0 }) // after reloaded
    mockAreaInventory.create.mockResolvedValue({ id: 'inv-new', stock: 0 })
    mockAreaInventory.updateMany.mockResolvedValue({ count: 1 }) // éxito
    mockStockMovement.create.mockResolvedValue({})

    const r = await InventoryService.consume({
      areaId: 'area-1',
      productId: 'prod-1',
      quantity: 1,
      options: { userId: 'user-A', reference: 'TEST-A', unit: 'unidad', blockNegative: true },
    })

    expect(r.ok).toBe(true)
    expect(r.stockBefore).toBe(1)
    expect(r.stockAfter).toBe(0)
    expect(r.insufficient).toBe(false)
  })

  it('Usuario B compra misma unidad simultáneamente → rechazo (count=0)', async () => {
    // Stock = 0 (Usuario A ya compró), Usuario B intenta comprar 1
    mockAreaInventory.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ stock: 0, id: 'inv-1' }) // before = 0
    mockAreaInventory.create.mockResolvedValue({ id: 'inv-new', stock: 0 })

    const r = await InventoryService.consume({
      areaId: 'area-1',
      productId: 'prod-1',
      quantity: 1,
      options: { userId: 'user-B', reference: 'TEST-B', unit: 'unidad', blockNegative: true },
    })

    expect(r.ok).toBe(false)
    expect(r.insufficient).toBe(true)
    expect(r.message).toMatch(/Stock insuficiente/)
  })

  it('updateMany con condición stock >= quantity garantiza atomicidad', async () => {
    mockAreaInventory.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ stock: 5, id: 'inv-1' })
      .mockResolvedValueOnce({ stock: 3 })
    mockAreaInventory.create.mockResolvedValue({ id: 'inv-new', stock: 0 })
    mockAreaInventory.updateMany.mockResolvedValue({ count: 1 })
    mockStockMovement.create.mockResolvedValue({})

    await InventoryService.consume({
      areaId: 'area-1',
      productId: 'prod-1',
      quantity: 2,
      options: { userId: 'user-A', reference: 'TEST', unit: 'unidad', blockNegative: true },
    })

    // Verificar que updateMany usó la condición stock: { gte: 2 }
    expect(mockAreaInventory.updateMany).toHaveBeenCalledWith({
      where: { areaId: 'area-1', productId: 'prod-1', stock: { gte: 2 } },
      data: { stock: { decrement: 2 } },
    })
  })

  it('Si updateMany devuelve count=0, es por concurrencia (otro proceso se llevó el stock)', async () => {
    mockAreaInventory.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ stock: 1, id: 'inv-1' })
    mockAreaInventory.create.mockResolvedValue({ id: 'inv-new', stock: 0 })
    // count=0 significa que la condición stock >= 1 no se cumplió
    // (otro proceso concurrente decrementó el stock entre el findUnique y el updateMany)
    mockAreaInventory.updateMany.mockResolvedValue({ count: 0 })

    const r = await InventoryService.consume({
      areaId: 'area-1',
      productId: 'prod-1',
      quantity: 1,
      options: { userId: 'user-B', reference: 'TEST', unit: 'unidad', blockNegative: true },
    })

    expect(r.ok).toBe(false)
    expect(r.insufficient).toBe(true)
    expect(r.message).toMatch(/concurrencia/)
  })
})

describe('Concurrencia — Doble devolución', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returnStock es idempotente con quantity=0', async () => {
    const r = await InventoryService.returnStock({
      areaId: 'area-1',
      productId: 'prod-1',
      quantity: 0,
      options: { userId: 'user-A', reference: 'TEST', unit: 'unidad' },
    })
    expect(r.ok).toBe(true)
    expect(r.idempotent).toBe(true)
  })

  it('returnStock no usa updateMany condicional (siempre incrementa)', async () => {
    mockAreaInventory.findUnique.mockResolvedValue({ stock: 10 })
    mockAreaInventory.update.mockResolvedValue({ stock: 15 })
    mockAreaInventory.create.mockResolvedValue({ id: 'inv', stock: 0 })
    mockStockMovement.create.mockResolvedValue({})

    await InventoryService.returnStock({
      areaId: 'area-1',
      productId: 'prod-1',
      quantity: 5,
      options: { userId: 'user-A', reference: 'TEST', unit: 'unidad' },
    })

    // Verificar que usa update (no updateMany) — siempre incrementa
    expect(mockAreaInventory.update).toHaveBeenCalled()
    expect(mockAreaInventory.updateMany).not.toHaveBeenCalled()
  })
})

describe('Concurrencia — Stock negativo bloqueado', () => {
  beforeEach(() => vi.clearAllMocks())

  it('blockNegative=true impide stock negativo', async () => {
    mockAreaInventory.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ stock: 3, id: 'inv-1' })
    mockAreaInventory.create.mockResolvedValue({ id: 'inv', stock: 0 })

    const r = await InventoryService.consume({
      areaId: 'area-1',
      productId: 'prod-1',
      quantity: 5, // más de lo disponible (3)
      options: { userId: 'user-A', reference: 'TEST', unit: 'unidad', blockNegative: true },
    })

    expect(r.ok).toBe(false)
    expect(r.insufficient).toBe(true)
  })

  it('blockNegative=false permite stock negativo', async () => {
    mockAreaInventory.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ stock: 3, id: 'inv-1' })
      .mockResolvedValueOnce({ stock: -2 })
    mockAreaInventory.create.mockResolvedValue({ id: 'inv', stock: 0 })
    mockAreaInventory.updateMany.mockResolvedValue({ count: 1 })
    mockStockMovement.create.mockResolvedValue({})

    const r = await InventoryService.consume({
      areaId: 'area-1',
      productId: 'prod-1',
      quantity: 5,
      options: { userId: 'user-A', reference: 'TEST', unit: 'unidad', blockNegative: false },
    })

    expect(r.ok).toBe(true)
    // Con blockNegative=false, no usa condición stock >= quantity
    expect(mockAreaInventory.updateMany).toHaveBeenCalledWith({
      where: { areaId: 'area-1', productId: 'prod-1' },
      data: { stock: { decrement: 5 } },
    })
  })

  it('quantity negativa lanza error', async () => {
    await expect(
      InventoryService.consume({
        areaId: 'area-1',
        productId: 'prod-1',
        quantity: -5,
        options: { userId: 'user-A', reference: 'TEST', unit: 'unidad' },
      }),
    ).rejects.toThrow(/no puede ser negativo/)
  })

  it('quantity NaN lanza error', async () => {
    await expect(
      InventoryService.consume({
        areaId: 'area-1',
        productId: 'prod-1',
        quantity: NaN,
        options: { userId: 'user-A', reference: 'TEST', unit: 'unidad' },
      }),
    ).rejects.toThrow(/debe ser número válido/)
  })
})

describe('Concurrencia — Transferencia atómica', () => {
  beforeEach(() => vi.clearAllMocks())

  it('transferencia falla si origen no tiene stock suficiente', async () => {
    mockAreaInventory.findUnique.mockResolvedValue(null)
    mockAreaInventory.create.mockResolvedValue({ id: 'inv', stock: 0 })
    mockAreaInventory.updateMany.mockResolvedValue({ count: 0 }) // stock insuficiente en origen

    const r = await InventoryService.transfer({
      from: { areaId: 'central', productId: 'prod-1' },
      to: { areaId: 'salon', productId: 'prod-1' },
      quantity: 100,
      options: { userId: 'user-A', reference: 'TRASLADO', unit: 'unidad' },
    })

    expect(r.ok).toBe(false)
    expect(r.insufficient).toBe(true)
    expect(r.message).toMatch(/Stock insuficiente en origen/)
  })

  it('transferencia usa updateMany condicional en origen (atómico)', async () => {
    mockAreaInventory.findUnique
      .mockResolvedValueOnce(null) // ensureAreaInventory destino
      .mockResolvedValueOnce({ stock: 30 }) // reloaded after
    mockAreaInventory.create.mockResolvedValue({ id: 'inv-dest', stock: 0 })
    mockAreaInventory.updateMany.mockResolvedValue({ count: 1 })
    mockAreaInventory.update.mockResolvedValue({ stock: 20 })
    mockStockMovement.create.mockResolvedValue({})

    const r = await InventoryService.transfer({
      from: { areaId: 'central', productId: 'prod-1' },
      to: { areaId: 'salon', productId: 'prod-1' },
      quantity: 20,
      options: { userId: 'user-A', reference: 'TRASLADO', unit: 'unidad' },
    })

    expect(r.ok).toBe(true)
    // Verificar que updateMany en origen usó condición stock >= quantity
    expect(mockAreaInventory.updateMany).toHaveBeenCalledWith({
      where: { areaId: 'central', productId: 'prod-1', stock: { gte: 20 } },
      data: { stock: { decrement: 20 } },
    })
  })
})
