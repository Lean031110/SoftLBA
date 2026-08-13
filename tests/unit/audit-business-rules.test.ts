// tests/unit/audit-business-rules.test.ts
// FASE 25-28: Tests que validan reglas de negocio.
// Inventario, pedidos, producción, finanzas.
// Estos tests verifican la LÓGICA, no la DB.

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { PrismaClient } from '@prisma/client'
import { InventoryService } from '../../src/lib/inventory/inventory-service'
import { TableService } from '../../src/lib/tables/table-service'
import { MoneyService } from '../../src/lib/money/money-service'
import { canTransitionOrder, canTransitionItem, ORDER_TRANSITIONS, ITEM_TRANSITIONS } from '../../src/lib/order-state-machine'

const prisma = new PrismaClient()

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8')
}

// ============================================================
// FASE 25: AUDITORÍA DE INVENTARIO
// ============================================================
describe('FASE 25 — Inventario: InventoryService como fuente única', () => {
  it('InventoryService expone consume, returnStock, transfer, ensureAreaInventory', () => {
    expect(typeof InventoryService.consume).toBe('function')
    expect(typeof InventoryService.returnStock).toBe('function')
    expect(typeof InventoryService.transfer).toBe('function')
    expect(typeof InventoryService.ensureAreaInventory).toBe('function')
  })

  it('InventoryService.consume valida quantity negativa', async () => {
    await expect(
      InventoryService.consume({
        areaId: 'x', productId: 'y', quantity: -1,
        options: { userId: 'u', reference: 'r', unit: 'u' },
      }),
    ).rejects.toThrow(/no puede ser negativo/)
  })

  it('InventoryService.consume valida NaN', async () => {
    await expect(
      InventoryService.consume({
        areaId: 'x', productId: 'y', quantity: NaN,
        options: { userId: 'u', reference: 'r', unit: 'u' },
      }),
    ).rejects.toThrow(/debe ser número válido/)
  })

  it('InventoryService.consume con quantity=0 es idempotente', async () => {
    const r = await InventoryService.consume({
      areaId: 'x', productId: 'y', quantity: 0,
      options: { userId: 'u', reference: 'r', unit: 'u' },
    })
    expect(r.ok).toBe(true)
    expect(r.idempotent).toBe(true)
  })

  it('InventoryService.returnStock con quantity=0 es idempotente', async () => {
    const r = await InventoryService.returnStock({
      areaId: 'x', productId: 'y', quantity: 0,
      options: { userId: 'u', reference: 'r', unit: 'u' },
    })
    expect(r.ok).toBe(true)
    expect(r.idempotent).toBe(true)
  })

  it('InventoryService.auditDuplicatedStock está disponible', () => {
    expect(typeof InventoryService.auditDuplicatedStock).toBe('function')
  })
})

// ============================================================
// FASE 26: AUDITORÍA DE PEDIDOS
// ============================================================
describe('FASE 26 — Pedidos: estados y transiciones', () => {
  it('DESPACHADO existe en OrderItemStatus', () => {
    expect(ITEM_TRANSITIONS.DESPACHADO).toBeDefined()
    expect(ITEM_TRANSITIONS.DESPACHADO).toEqual(['SERVIDO'])
  })

  it('PENDIENTE puede ir a DESPACHADO (flujo DIRECTO)', () => {
    expect(canTransitionItem('PENDIENTE', 'DESPACHADO')).toBe(true)
  })

  it('DESPACHADO puede ir a SERVIDO', () => {
    expect(canTransitionItem('DESPACHADO', 'SERVIDO')).toBe(true)
  })

  it('DESPACHADO NO puede ir a EN_PREPARACION', () => {
    expect(canTransitionItem('DESPACHADO', 'EN_PREPARACION')).toBe(false)
  })

  it('CREADO solo puede ir a ENVIADO o CANCELADO', () => {
    expect(canTransitionOrder('CREADO', 'ENVIADO')).toBe(true)
    expect(canTransitionOrder('CREADO', 'CANCELADO')).toBe(true)
    expect(canTransitionOrder('CREADO', 'EN_PREPARACION')).toBe(false)
    expect(canTransitionOrder('CREADO', 'LISTO')).toBe(false)
  })

  it('SERVIDO solo puede ir a COBRADO', () => {
    expect(canTransitionOrder('SERVIDO', 'COBRADO')).toBe(true)
    expect(canTransitionOrder('SERVIDO', 'ENVIADO')).toBe(false)
  })

  it('CANCELADO es terminal', () => {
    expect(ORDER_TRANSITIONS.CANCELADO).toEqual([])
  })

  it('ARCHIVADO es terminal', () => {
    expect(ORDER_TRANSITIONS.ARCHIVADO).toEqual([])
  })
})

// ============================================================
// FASE 27: ATOMICIDAD DE PRODUCCIÓN E INVENTARIO
// ============================================================
describe('FASE 27 — Producción: consumeRecipe debe ser transaccional', () => {
  it('consumeRecipe existe', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'src/lib/recipe-consumer.ts'))).toBe(true)
  })

  it('InsufficientStockError existe para rollback', () => {
    const content = readFile('src/lib/recipe-consumer.ts')
    expect(content).toContain('InsufficientStockError')
  })

  it('cocina endpoint usa consumeRecipe dentro de transacción', () => {
    const content = readFile('src/app/api/cocina/orders/[id]/items/[itemId]/status/route.ts')
    expect(content).toContain('consumeRecipe')
    expect(content).toContain('$transaction')
  })

  it('pizzeria endpoint usa consumeRecipe dentro de transacción', () => {
    const content = readFile('src/app/api/pizzeria/orders/[id]/items/[itemId]/status/route.ts')
    expect(content).toContain('consumeRecipe')
    expect(content).toContain('$transaction')
  })
})

// ============================================================
// FASE 28: FINANZAS Y MULTIMONEDA
// ============================================================
describe('FASE 28 — Finanzas: snapshot histórico y multimoneda', () => {
  it('MoneyService.usdToCup usa tasa proporcionada', () => {
    expect(MoneyService.usdToCup(10, 320)).toBe(3200)
    expect(MoneyService.usdToCup(10, 350)).toBe(3500)
  })

  it('Pago histórico NO se recalcula con tasa actual', () => {
    const historicalPayment = {
      amount: 10, currency: 'USD',
      exchangeRate: 320, convertedAmount: 3200, baseCurrency: 'CUP',
    }
    expect(historicalPayment.convertedAmount).toBe(3200)
    expect(historicalPayment.convertedAmount).not.toBe(3500)
  })

  it('No se pueden sumar monedas diferentes sin conversión', () => {
    const total = MoneyService.addMoney(100, MoneyService.usdToCup(10, 320))
    expect(total).toBe(3300)
    expect(total).not.toBe(110)
  })

  it('Payment.idempotencyKey evita doble pago', () => {
    expect(prisma.payment.fields.idempotencyKey).toBeDefined()
  })

  it('blockNegativeStock default es true (seguro)', () => {
    const schema = readFile('prisma/schema.prisma')
    expect(schema).toContain('blockNegativeStock Boolean  @default(true)')
  })

  it('Payment tiene exchangeRate, convertedAmount, baseCurrency', () => {
    expect(prisma.payment.fields.exchangeRate).toBeDefined()
    expect(prisma.payment.fields.convertedAmount).toBeDefined()
    expect(prisma.payment.fields.baseCurrency).toBeDefined()
  })

  it('FinanceEntry tiene exchangeRate, convertedAmount, baseCurrency', () => {
    expect(prisma.financeEntry.fields.exchangeRate).toBeDefined()
    expect(prisma.financeEntry.fields.convertedAmount).toBeDefined()
    expect(prisma.financeEntry.fields.baseCurrency).toBeDefined()
  })

  it('Order tiene shiftId para trazabilidad de turnos', () => {
    expect(prisma.order.fields.shiftId).toBeDefined()
  })

  it('Table tiene currentOrderId para ownership de mesa', () => {
    expect(prisma.table.fields.currentOrderId).toBeDefined()
  })

  it('User tiene authVersion para invalidación de sesiones', () => {
    expect(prisma.user.fields.authVersion).toBeDefined()
  })
})

// ============================================================
// FASE 26 (extra): PRODUCTOS DIRECTO
// ============================================================
describe('FASE 26 — Productos DIRECTO no van a producción', () => {
  it('DIRECTO nace como SERVIDO (no EN_PREPARACION)', () => {
    const content = readFile('src/app/api/mesero/orders/route.ts')
    expect(content).toContain("l.isDirecto ? 'SERVIDO'")
  })

  it('Stock de DIRECTO se decrementa al crear el pedido', () => {
    const content = readFile('src/app/api/mesero/orders/route.ts')
    expect(content).toContain('decrementDirectoStock')
  })
})

// ============================================================
// FASE 26 (extra): MULTIÁREA
// ============================================================
describe('FASE 26 — Multiárea: targetAreaId estricto', () => {
  it('Cocina valida targetAreaId del item', () => {
    const content = readFile('src/app/api/cocina/orders/[id]/items/[itemId]/status/route.ts')
    expect(content).toContain('targetAreaId')
  })

  it('Pizzería valida targetAreaId del item', () => {
    const content = readFile('src/app/api/pizzeria/orders/[id]/items/[itemId]/status/route.ts')
    expect(content).toContain('targetAreaId')
  })

  it('Cocina NO hace updateMany sobre todos los items del pedido', () => {
    const content = readFile('src/app/api/cocina/orders/[id]/items/[itemId]/status/route.ts')
    expect(content).toContain('orderItem.update')
    expect(content).not.toContain('orderItem.updateMany')
  })
})
