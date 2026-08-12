// ProductAreaResolver — Deriva áreas del producto (issue P0 #2)
// FASE 2 (v1.0.3)
import type { Product } from '@prisma/client'

export type DispatchMode = 'NOW' | 'WITH_ORDER'

export interface ResolvedProductAreas {
  saleAreaId: string | null
  productionAreaId: string | null
  dispatchMode: DispatchMode | null
}

export function resolveProductAreas(product: Pick<Product, 'type' | 'areaId' | 'saleAreaId' | 'productionAreaId' | 'dispatchMode'>): ResolvedProductAreas {
  if (product.saleAreaId !== null || product.productionAreaId !== null || product.dispatchMode !== null) {
    return {
      saleAreaId: product.saleAreaId,
      productionAreaId: product.productionAreaId,
      dispatchMode: (product.dispatchMode as DispatchMode | null) ?? null,
    }
  }
  switch (product.type) {
    case 'DIRECTO':
      return { saleAreaId: product.areaId ?? null, productionAreaId: null, dispatchMode: 'NOW' }
    case 'SUBPRODUCTO':
      return { saleAreaId: null, productionAreaId: product.areaId ?? null, dispatchMode: null }
    case 'FINAL':
    default:
      return { saleAreaId: product.areaId ?? null, productionAreaId: null, dispatchMode: null }
  }
}

export function resolveTargetArea(product: Pick<Product, 'type' | 'areaId' | 'saleAreaId' | 'productionAreaId' | 'dispatchMode'>): string | null {
  const resolved = resolveProductAreas(product)
  if (product.type === 'DIRECTO') return null
  if (!resolved.productionAreaId) {
    throw new Error(`Producto ${product.type} requiere productionAreaId seteado.`)
  }
  return resolved.productionAreaId
}

export function resolveSaleArea(product: Pick<Product, 'type' | 'areaId' | 'saleAreaId' | 'productionAreaId' | 'dispatchMode'>): string | null {
  if (product.type === 'SUBPRODUCTO') return null
  return resolveProductAreas(product).saleAreaId
}

export function canSellInArea(product: Pick<Product, 'type' | 'areaId' | 'saleAreaId' | 'productionAreaId' | 'dispatchMode'>, areaId: string): boolean {
  // v1.0.15: SUBPRODUCTO no se puede vender directamente.
  if (product.type === 'SUBPRODUCTO') return false
  const saleArea = resolveSaleArea(product)
  if (saleArea === null) return true
  return saleArea === areaId
}

export function requiresProduction(product: Pick<Product, 'type' | 'areaId' | 'saleAreaId' | 'productionAreaId' | 'dispatchMode'>): boolean {
  return product.type !== 'DIRECTO'
}

export function isDirectNow(product: Pick<Product, 'type' | 'areaId' | 'saleAreaId' | 'productionAreaId' | 'dispatchMode'>): boolean {
  if (product.type !== 'DIRECTO') return false
  return resolveProductAreas(product).dispatchMode === 'NOW'
}

export const ProductAreaResolver = { resolveProductAreas, resolveTargetArea, resolveSaleArea, canSellInArea, requiresProduction, isDirectNow }
export default ProductAreaResolver
