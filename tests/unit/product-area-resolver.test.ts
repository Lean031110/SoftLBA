// Tests unitarios para ProductAreaResolver (FASE 2 — v1.0.3)
// ------------------------------------------------------------
// Cubre:
//   - resolveProductAreas (fallback legacy)
//   - resolveTargetArea
//   - resolveSaleArea
//   - canSellInArea
//   - requiresProduction
//   - isDirectNow
// ============================================================
import { describe, it, expect } from 'vitest'
import {
  resolveProductAreas,
  resolveTargetArea,
  resolveSaleArea,
  canSellInArea,
  requiresProduction,
  isDirectNow,
} from '../../src/lib/products/product-area-resolver'
import type { Product } from '@prisma/client'

type ProductPick = Pick<Product, 'type' | 'areaId' | 'saleAreaId' | 'productionAreaId' | 'dispatchMode'>

describe('ProductAreaResolver — resolveProductAreas', () => {
  it('usa campos nuevos si están seteados (DIRECTO)', () => {
    const p: ProductPick = {
      type: 'DIRECTO',
      areaId: 'legacy-1',
      saleAreaId: 'salon-id',
      productionAreaId: null,
      dispatchMode: 'NOW',
    }
    const r = resolveProductAreas(p)
    expect(r.saleAreaId).toBe('salon-id')
    expect(r.productionAreaId).toBeNull()
    expect(r.dispatchMode).toBe('NOW')
  })

  it('usa campos nuevos si están seteados (FINAL)', () => {
    const p: ProductPick = {
      type: 'FINAL',
      areaId: 'legacy-1',
      saleAreaId: 'salon-id',
      productionAreaId: 'cocina-id',
      dispatchMode: null,
    }
    const r = resolveProductAreas(p)
    expect(r.saleAreaId).toBe('salon-id')
    expect(r.productionAreaId).toBe('cocina-id')
  })

  it('fallback legacy para DIRECTO: areaId → saleAreaId, dispatchMode=NOW', () => {
    const p: ProductPick = {
      type: 'DIRECTO',
      areaId: 'salon-legacy',
      saleAreaId: null,
      productionAreaId: null,
      dispatchMode: null,
    }
    const r = resolveProductAreas(p)
    expect(r.saleAreaId).toBe('salon-legacy')
    expect(r.productionAreaId).toBeNull()
    expect(r.dispatchMode).toBe('NOW')
  })

  it('fallback legacy para SUBPRODUCTO: areaId → productionAreaId', () => {
    const p: ProductPick = {
      type: 'SUBPRODUCTO',
      areaId: 'cocina-legacy',
      saleAreaId: null,
      productionAreaId: null,
      dispatchMode: null,
    }
    const r = resolveProductAreas(p)
    expect(r.saleAreaId).toBeNull()
    expect(r.productionAreaId).toBe('cocina-legacy')
    expect(r.dispatchMode).toBeNull()
  })

  it('fallback legacy para FINAL: areaId → saleAreaId, productionAreaId=null', () => {
    const p: ProductPick = {
      type: 'FINAL',
      areaId: 'salon-legacy',
      saleAreaId: null,
      productionAreaId: null,
      dispatchMode: null,
    }
    const r = resolveProductAreas(p)
    expect(r.saleAreaId).toBe('salon-legacy')
    expect(r.productionAreaId).toBeNull() // no se puede inferir
  })

  it('DIRECTO sin areaId devuelve saleAreaId=null', () => {
    const p: ProductPick = {
      type: 'DIRECTO',
      areaId: null,
      saleAreaId: null,
      productionAreaId: null,
      dispatchMode: null,
    }
    const r = resolveProductAreas(p)
    expect(r.saleAreaId).toBeNull()
    expect(r.productionAreaId).toBeNull()
    expect(r.dispatchMode).toBe('NOW') // DIRECTO siempre tiene NOW por defecto
  })
})

describe('ProductAreaResolver — resolveTargetArea', () => {
  it('DIRECTO devuelve null (no va a producción)', () => {
    const p: ProductPick = {
      type: 'DIRECTO',
      areaId: null,
      saleAreaId: 'salon',
      productionAreaId: null,
      dispatchMode: 'NOW',
    }
    expect(resolveTargetArea(p)).toBeNull()
  })

  it('FINAL con productionAreaId devuelve productionAreaId', () => {
    const p: ProductPick = {
      type: 'FINAL',
      areaId: null,
      saleAreaId: 'salon',
      productionAreaId: 'cocina',
      dispatchMode: null,
    }
    expect(resolveTargetArea(p)).toBe('cocina')
  })

  it('FINAL sin productionAreaId lanza error', () => {
    const p: ProductPick = {
      type: 'FINAL',
      areaId: 'legacy-1',
      saleAreaId: null,
      productionAreaId: null,
      dispatchMode: null,
    }
    expect(() => resolveTargetArea(p)).toThrow(/productionAreaId/)
  })

  it('SUBPRODUCTO con productionAreaId lo devuelve', () => {
    const p: ProductPick = {
      type: 'SUBPRODUCTO',
      areaId: null,
      saleAreaId: null,
      productionAreaId: 'cocina',
      dispatchMode: null,
    }
    expect(resolveTargetArea(p)).toBe('cocina')
  })
})

describe('ProductAreaResolver — resolveSaleArea', () => {
  it('SUBPRODUCTO devuelve null (no se vende directo)', () => {
    const p: ProductPick = {
      type: 'SUBPRODUCTO',
      areaId: 'cocina',
      saleAreaId: null,
      productionAreaId: 'cocina',
      dispatchMode: null,
    }
    expect(resolveSaleArea(p)).toBeNull()
  })

  it('DIRECTO devuelve saleAreaId (fallback legacy)', () => {
    const p: ProductPick = {
      type: 'DIRECTO',
      areaId: 'salon',
      saleAreaId: null,
      productionAreaId: null,
      dispatchMode: null,  // null para que entre en fallback legacy
    }
    expect(resolveSaleArea(p)).toBe('salon')
  })

  it('FINAL devuelve saleAreaId', () => {
    const p: ProductPick = {
      type: 'FINAL',
      areaId: null,
      saleAreaId: 'salon',
      productionAreaId: 'cocina',
      dispatchMode: null,
    }
    expect(resolveSaleArea(p)).toBe('salon')
  })
})

describe('ProductAreaResolver — canSellInArea', () => {
  it('true si saleArea coincide', () => {
    const p: ProductPick = {
      type: 'DIRECTO',
      areaId: null,
      saleAreaId: 'salon',
      productionAreaId: null,
      dispatchMode: 'NOW',
    }
    expect(canSellInArea(p, 'salon')).toBe(true)
  })

  it('false si saleArea no coincide', () => {
    const p: ProductPick = {
      type: 'DIRECTO',
      areaId: null,
      saleAreaId: 'salon',
      productionAreaId: null,
      dispatchMode: 'NOW',
    }
    expect(canSellInArea(p, 'cocina')).toBe(false)
  })

  it('true si saleArea es null (disponible en todas)', () => {
    const p: ProductPick = {
      type: 'DIRECTO',
      areaId: null,
      saleAreaId: null,
      productionAreaId: null,
      dispatchMode: null,
    }
    expect(canSellInArea(p, 'any-area')).toBe(true)
  })

  it('false para SUBPRODUCTO', () => {
    const p: ProductPick = {
      type: 'SUBPRODUCTO',
      areaId: 'cocina',
      saleAreaId: null,
      productionAreaId: 'cocina',
      dispatchMode: null,
    }
    expect(canSellInArea(p, 'cocina')).toBe(false)
  })
})

describe('ProductAreaResolver — requiresProduction', () => {
  it('DIRECTO no requiere producción', () => {
    const p: ProductPick = {
      type: 'DIRECTO',
      areaId: null,
      saleAreaId: null,
      productionAreaId: null,
      dispatchMode: 'NOW',
    }
    expect(requiresProduction(p)).toBe(false)
  })

  it('FINAL requiere producción', () => {
    const p: ProductPick = {
      type: 'FINAL',
      areaId: null,
      saleAreaId: null,
      productionAreaId: 'cocina',
      dispatchMode: null,
    }
    expect(requiresProduction(p)).toBe(true)
  })

  it('SUBPRODUCTO requiere producción', () => {
    const p: ProductPick = {
      type: 'SUBPRODUCTO',
      areaId: null,
      saleAreaId: null,
      productionAreaId: 'cocina',
      dispatchMode: null,
    }
    expect(requiresProduction(p)).toBe(true)
  })
})

describe('ProductAreaResolver — isDirectNow', () => {
  it('true para DIRECTO con dispatchMode=NOW', () => {
    const p: ProductPick = {
      type: 'DIRECTO',
      areaId: null,
      saleAreaId: null,
      productionAreaId: null,
      dispatchMode: 'NOW',
    }
    expect(isDirectNow(p)).toBe(true)
  })

  it('false para DIRECTO con dispatchMode=WITH_ORDER', () => {
    const p: ProductPick = {
      type: 'DIRECTO',
      areaId: null,
      saleAreaId: null,
      productionAreaId: null,
      dispatchMode: 'WITH_ORDER',
    }
    expect(isDirectNow(p)).toBe(false)
  })

  it('false para FINAL', () => {
    const p: ProductPick = {
      type: 'FINAL',
      areaId: null,
      saleAreaId: null,
      productionAreaId: 'cocina',
      dispatchMode: null,
    }
    expect(isDirectNow(p)).toBe(false)
  })

  it('DIRECTO sin dispatchMode explicito usa fallback NOW (legacy)', () => {
    const p: ProductPick = {
      type: 'DIRECTO',
      areaId: 'salon',
      saleAreaId: null,
      productionAreaId: null,
      dispatchMode: null,
    }
    expect(isDirectNow(p)).toBe(true)
  })
})
