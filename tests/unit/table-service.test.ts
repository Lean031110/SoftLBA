// Tests unitarios para TableService (FASE 4 — v1.0.5, issues #18, #19, #20)
// ------------------------------------------------------------
// Como TableService usa db (Prisma), mockeamos el cliente para tests
// que no requieren DB real.
// ============================================================
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock del módulo db antes de importar TableService.
vi.mock('../../src/lib/db', () => {
  const mockTable = {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  }
  const mockOrder = {
    update: vi.fn(),
  }
  return {
    db: {
      table: mockTable,
      order: mockOrder,
      $transaction: vi.fn(async (cb: any) => cb({
        table: mockTable,
        order: mockOrder,
      })),
    },
  }
})

// Importar DESPUÉS del mock.
import { TableService } from '../../src/lib/tables/table-service'
import { db } from '../../src/lib/db'

const mockTable = db.table as any
const mockOrder = db.order as any

describe('TableService — takeTable (issue #18)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('toma mesa LIBRE exitosamente', async () => {
    mockTable.updateMany.mockResolvedValue({ count: 1 })
    const r = await TableService.takeTable({
      tableId: 'mesa-1',
      orderId: 'order-1',
      userId: 'user-1',
    })
    expect(r.ok).toBe(true)
    expect(r.previousStatus).toBe('LIBRE')
    expect(r.newStatus).toBe('OCUPADA')
  })

  it('falla si la mesa ya está ocupada (count=0)', async () => {
    mockTable.updateMany.mockResolvedValue({ count: 0 })
    const r = await TableService.takeTable({
      tableId: 'mesa-2',
      orderId: 'order-2',
      userId: 'user-2',
    })
    expect(r.ok).toBe(false)
    expect(r.conflict).toBe(true)
    expect(r.message).toMatch(/ya está ocupada/)
  })

  it('usa updateMany con condición WHERE status=LIBRE', async () => {
    mockTable.updateMany.mockResolvedValue({ count: 1 })
    await TableService.takeTable({
      tableId: 'mesa-3',
      orderId: 'order-3',
      userId: 'user-3',
    })
    expect(mockTable.updateMany).toHaveBeenCalledWith({
      where: { id: 'mesa-3', status: 'LIBRE' },
      data: { status: 'OCUPADA', currentOrderId: 'order-3' },
    })
  })
})

describe('TableService — releaseTable (issue #19)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('libera mesa si currentOrderId coincide', async () => {
    mockTable.updateMany.mockResolvedValue({ count: 1 })
    const r = await TableService.releaseTable({
      tableId: 'mesa-1',
      expectedOrderId: 'order-1',
      userId: 'user-1',
    })
    expect(r.ok).toBe(true)
    expect(r.newStatus).toBe('LIBRE')
  })

  it('falla si currentOrderId NO coincide (otro pedido tomó la mesa)', async () => {
    mockTable.updateMany.mockResolvedValue({ count: 0 })
    const r = await TableService.releaseTable({
      tableId: 'mesa-1',
      expectedOrderId: 'order-old',
      userId: 'user-1',
    })
    expect(r.ok).toBe(false)
    expect(r.conflict).toBe(true)
    expect(r.message).toMatch(/ya no tiene el pedido/)
  })

  it('respeta newStatus personalizado (LIMPIEZA)', async () => {
    mockTable.updateMany.mockResolvedValue({ count: 1 })
    const r = await TableService.releaseTable({
      tableId: 'mesa-1',
      expectedOrderId: 'order-1',
      userId: 'user-1',
      newStatus: 'LIMPIEZA',
    })
    expect(r.newStatus).toBe('LIMPIEZA')
  })

  it('usa updateMany con condición WHERE currentOrderId=expected', async () => {
    mockTable.updateMany.mockResolvedValue({ count: 1 })
    await TableService.releaseTable({
      tableId: 'mesa-x',
      expectedOrderId: 'order-x',
      userId: 'user-x',
    })
    expect(mockTable.updateMany).toHaveBeenCalledWith({
      where: { id: 'mesa-x', currentOrderId: 'order-x' },
      data: { status: 'LIBRE', currentOrderId: null },
    })
  })
})

describe('TableService — transferTable (issue #20)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('transfiere exitosamente cuando destino está LIBRE', async () => {
    // Primera llamada: tomar destino (count=1). Segunda: liberar origen (count=1).
    mockTable.updateMany
      .mockResolvedValueOnce({ count: 1 }) // take dest
      .mockResolvedValueOnce({ count: 1 }) // release orig
    mockOrder.update.mockResolvedValue({})

    const r = await TableService.transferTable({
      fromTableId: 'mesa-orig',
      toTableId: 'mesa-dest',
      orderId: 'order-1',
      userId: 'user-1',
    })
    expect(r.ok).toBe(true)
    expect(r.tableId).toBe('mesa-dest')
  })

  it('falla si destino está OCUPADO', async () => {
    mockTable.updateMany.mockResolvedValueOnce({ count: 0 }) // take dest fails
    const r = await TableService.transferTable({
      fromTableId: 'mesa-orig',
      toTableId: 'mesa-dest-busy',
      orderId: 'order-1',
      userId: 'user-1',
    })
    expect(r.ok).toBe(false)
    expect(r.conflict).toBe(true)
  })

  it('falla si origen ya no tiene el pedido (currentOrderId cambió)', async () => {
    mockTable.updateMany
      .mockResolvedValueOnce({ count: 1 }) // take dest OK
      .mockResolvedValueOnce({ count: 0 }) // release orig fails
    mockOrder.update.mockResolvedValue({})

    await expect(
      TableService.transferTable({
        fromTableId: 'mesa-orig',
        toTableId: 'mesa-dest',
        orderId: 'order-1',
        userId: 'user-1',
      }),
    ).rejects.toThrow(/ROLLBACK_TRANSFER/)
  })

  it('rechaza si from y to son la misma mesa', async () => {
    const r = await TableService.transferTable({
      fromTableId: 'mesa-1',
      toTableId: 'mesa-1',
      orderId: 'order-1',
      userId: 'user-1',
    })
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/misma/)
  })
})

describe('TableService — canTakeTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('true si mesa está LIBRE y activa', async () => {
    mockTable.findUnique.mockResolvedValue({ status: 'LIBRE', isActive: true })
    const r = await TableService.canTakeTable('mesa-1')
    expect(r).toBe(true)
  })

  it('false si mesa está OCUPADA', async () => {
    mockTable.findUnique.mockResolvedValue({ status: 'OCUPADA', isActive: true })
    const r = await TableService.canTakeTable('mesa-1')
    expect(r).toBe(false)
  })

  it('false si mesa no existe', async () => {
    mockTable.findUnique.mockResolvedValue(null)
    const r = await TableService.canTakeTable('missing')
    expect(r).toBe(false)
  })

  it('false si mesa está inactiva', async () => {
    mockTable.findUnique.mockResolvedValue({ status: 'LIBRE', isActive: false })
    const r = await TableService.canTakeTable('mesa-1')
    expect(r).toBe(false)
  })
})
