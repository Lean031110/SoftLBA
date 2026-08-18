// tests/unit/order-routing.test.ts
// FASE 19-20 + FASE 40: Test del routing por área con pedido mixto.
//
// Escenario (Mesa 7):
//   - Agua ×2 (DIRECTO)     → SALÓN, status=SERVIDO
//   - Pizza ×1 (FINAL)      → PIZZERIA, status=PENDIENTE
//   - Hamburguesa ×1 (FINAL)→ COCINA, status=PENDIENTE
//   - Espaguetis ×1 (FINAL) → COCINA, status=PENDIENTE
//
// Verifica:
//   - DIRECTO no aparece en KDS de Cocina ni Pizzería.
//   - Pizza solo en Pizzería.
//   - Hamburguesa+Espaguetis solo en Cocina.
//   - Pizza NUNCA en Cocina.
//   - Hamburguesa NUNCA en Pizzería.
//
// Como test unitario sin DB real, simulamos el routing con la lógica
// del POST orders (productionAreaId > saleAreaId > areaId > areaId pedido).
// El test de integration con DB real está en tests/integration/.

import { describe, it, expect } from 'vitest'

// Tipos mínimos para el test.
interface ProductLike {
  id: string
  name: string
  type: 'DIRECTO' | 'FINAL' | 'SUBPRODUCTO'
  areaId?: string | null
  saleAreaId?: string | null
  productionAreaId?: string | null
  price: number
}

interface AreaLike {
  id: string
  code: string
  name: string
}

interface ItemInput {
  productId: string
  quantity: number
}

// Función que replica la lógica de routing del POST /api/mesero/orders
// (FASE 19-20: productionAreaId > saleAreaId > areaId > areaId del pedido).
function resolveItemRouting(
  item: ItemInput,
  products: ProductLike[],
  pedidoAreaId: string,
): {
  targetAreaId: string
  serveMode: 'now' | 'with_order'
  isDirecto: boolean
  initialStatus: 'SERVIDO' | 'PENDIENTE'
} {
  const p = products.find((pp) => pp.id === item.productId)
  if (!p) throw new Error(`Producto ${item.productId} no encontrado`)
  const isDirecto = p.type === 'DIRECTO'

  let targetAreaId: string
  if (isDirecto) {
    targetAreaId = pedidoAreaId
  } else {
    targetAreaId = p.productionAreaId || p.saleAreaId || p.areaId || pedidoAreaId
  }

  return {
    targetAreaId,
    serveMode: isDirecto ? 'now' : 'with_order',
    isDirecto,
    initialStatus: isDirecto ? 'SERVIDO' : 'PENDIENTE',
  }
}

describe('FASE 19-20 — Routing por área (Mesa 7: Agua+Pizza+Hamburguesa+Espaguetis)', () => {
  // Setup: 3 áreas y 4 productos.
  const AREAS: AreaLike[] = [
    { id: 'salon-id', code: 'SALON', name: 'Salón' },
    { id: 'cocina-id', code: 'COCINA', name: 'Cocina' },
    { id: 'pizzeria-id', code: 'PIZZERIA', name: 'Pizzería' },
  ]

  const PRODUCTS: ProductLike[] = [
    {
      id: 'agua-id',
      name: 'Agua Mineral',
      type: 'DIRECTO',
      // DIRECTO no necesita productionAreaId — se queda en el área del pedido.
      areaId: 'salon-id',
      saleAreaId: 'salon-id',
      price: 100,
    },
    {
      id: 'pizza-id',
      name: 'Pizza Margarita',
      type: 'FINAL',
      areaId: 'pizzeria-id',
      productionAreaId: 'pizzeria-id',
      saleAreaId: 'salon-id',
      price: 450,
    },
    {
      id: 'hamburguesa-id',
      name: 'Hamburguesa',
      type: 'FINAL',
      areaId: 'cocina-id',
      productionAreaId: 'cocina-id',
      saleAreaId: 'salon-id',
      price: 350,
    },
    {
      id: 'espaguetis-id',
      name: 'Espaguetis',
      type: 'FINAL',
      areaId: 'cocina-id',
      productionAreaId: 'cocina-id',
      saleAreaId: 'salon-id',
      price: 400,
    },
  ]

  // Pedido de la Mesa 7 con 4 productos mixtos.
  const pedidoAreaId = 'salon-id' // El mesero pertenece a SALON.
  const items: ItemInput[] = [
    { productId: 'agua-id', quantity: 2 },
    { productId: 'pizza-id', quantity: 1 },
    { productId: 'hamburguesa-id', quantity: 1 },
    { productId: 'espaguetis-id', quantity: 1 },
  ]

  // Ejecutar routing para cada item.
  const routing = items.map((i) => ({
    input: i,
    ...resolveItemRouting(i, PRODUCTS, pedidoAreaId),
  }))

  it('Agua (DIRECTO) → SALÓN (área del pedido), SERVIDO', () => {
    const agua = routing.find((r) => r.input.productId === 'agua-id')!
    expect(agua.targetAreaId).toBe('salon-id')
    expect(agua.isDirecto).toBe(true)
    expect(agua.serveMode).toBe('now')
    expect(agua.initialStatus).toBe('SERVIDO')
  })

  it('Pizza (FINAL) → PIZZERIA, PENDIENTE', () => {
    const pizza = routing.find((r) => r.input.productId === 'pizza-id')!
    expect(pizza.targetAreaId).toBe('pizzeria-id')
    expect(pizza.isDirecto).toBe(false)
    expect(pizza.serveMode).toBe('with_order')
    expect(pizza.initialStatus).toBe('PENDIENTE')
  })

  it('Hamburguesa (FINAL) → COCINA, PENDIENTE', () => {
    const h = routing.find((r) => r.input.productId === 'hamburguesa-id')!
    expect(h.targetAreaId).toBe('cocina-id')
    expect(h.isDirecto).toBe(false)
    expect(h.initialStatus).toBe('PENDIENTE')
  })

  it('Espaguetis (FINAL) → COCINA, PENDIENTE', () => {
    const e = routing.find((r) => r.input.productId === 'espaguetis-id')!
    expect(e.targetAreaId).toBe('cocina-id')
    expect(e.isDirecto).toBe(false)
    expect(e.initialStatus).toBe('PENDIENTE')
  })

  // Validaciones de aislamiento entre áreas.
  it('Cocina NO recibe Agua (DIRECTO)', () => {
    const itemsEnCocina = routing.filter((r) => r.targetAreaId === 'cocina-id')
    const agua = itemsEnCocina.find((r) => r.input.productId === 'agua-id')
    expect(agua).toBeUndefined()
  })

  it('Cocina NO recibe Pizza', () => {
    const itemsEnCocina = routing.filter((r) => r.targetAreaId === 'cocina-id')
    const pizza = itemsEnCocina.find((r) => r.input.productId === 'pizza-id')
    expect(pizza).toBeUndefined()
  })

  it('Pizzería NO recibe Hamburguesa', () => {
    const itemsEnPizzeria = routing.filter((r) => r.targetAreaId === 'pizzeria-id')
    const h = itemsEnPizzeria.find((r) => r.input.productId === 'hamburguesa-id')
    expect(h).toBeUndefined()
  })

  it('Pizzería NO recibe Espaguetis', () => {
    const itemsEnPizzeria = routing.filter((r) => r.targetAreaId === 'pizzeria-id')
    const e = itemsEnPizzeria.find((r) => r.input.productId === 'espaguetis-id')
    expect(e).toBeUndefined()
  })

  it('Pizzería NO recibe Agua (DIRECTO)', () => {
    const itemsEnPizzeria = routing.filter((r) => r.targetAreaId === 'pizzeria-id')
    const agua = itemsEnPizzeria.find((r) => r.input.productId === 'agua-id')
    expect(agua).toBeUndefined()
  })

  it('SALÓN recibe SOLO Agua (DIRECTO)', () => {
    const itemsEnSalon = routing.filter((r) => r.targetAreaId === 'salon-id')
    expect(itemsEnSalon.length).toBe(1)
    expect(itemsEnSalon[0].input.productId).toBe('agua-id')
  })

  // Resumen del routing.
  it('routing total: 4 items → 3 áreas (SALÓN=1, PIZZERIA=1, COCINA=2)', () => {
    expect(routing.length).toBe(4)
    const byArea = routing.reduce<Record<string, number>>((acc, r) => {
      acc[r.targetAreaId] = (acc[r.targetAreaId] || 0) + 1
      return acc
    }, {})
    expect(byArea['salon-id']).toBe(1)
    expect(byArea['pizzeria-id']).toBe(1)
    expect(byArea['cocina-id']).toBe(2)
  })

  it('estados iniciales: 1 SERVIDO (Agua) + 3 PENDIENTE (Pizza+Hambur+Espaguetis)', () => {
    const servido = routing.filter((r) => r.initialStatus === 'SERVIDO')
    const pendiente = routing.filter((r) => r.initialStatus === 'PENDIENTE')
    expect(servido.length).toBe(1)
    expect(servido[0].input.productId).toBe('agua-id')
    expect(pendiente.length).toBe(3)
    expect(pendiente.map((p) => p.input.productId).sort()).toEqual(
      ['espaguetis-id', 'hamburguesa-id', 'pizza-id'],
    )
  })
})

describe('FASE 19-20 — Backward compat con productos sin productionAreaId', () => {
  // Productos legacy que solo tienen areaId (sin productionAreaId).
  it('Producto FINAL con solo areaId → usa areaId como targetAreaId', () => {
    const product: ProductLike = {
      id: 'p1',
      name: 'Producto legacy',
      type: 'FINAL',
      areaId: 'cocina-id',
      // Sin productionAreaId ni saleAreaId
      productionAreaId: null,
      saleAreaId: null,
      price: 100,
    }
    const result = resolveItemRouting(
      { productId: 'p1', quantity: 1 },
      [product],
      'salon-id',
    )
    expect(result.targetAreaId).toBe('cocina-id')
    expect(result.isDirecto).toBe(false)
  })

  it('Producto FINAL sin ningún área → fallback al área del pedido + warning', () => {
    // El POST orders loguea un warning en este caso. Aquí solo validamos
    // que el fallback funciona y no crashea.
    const product: ProductLike = {
      id: 'p2',
      name: 'Producto sin área',
      type: 'FINAL',
      areaId: null,
      productionAreaId: null,
      saleAreaId: null,
      price: 100,
    }
    const result = resolveItemRouting(
      { productId: 'p2', quantity: 1 },
      [product],
      'salon-id',
    )
    expect(result.targetAreaId).toBe('salon-id')
  })

  it('productionAreaId toma prioridad sobre areaId', () => {
    const product: ProductLike = {
      id: 'p3',
      name: 'Producto con áreas distintas',
      type: 'FINAL',
      areaId: 'cocina-id', // legacy
      productionAreaId: 'pizzeria-id', // explícito
      saleAreaId: 'salon-id',
      price: 100,
    }
    const result = resolveItemRouting(
      { productId: 'p3', quantity: 1 },
      [product],
      'salon-id',
    )
    // productionAreaId gana.
    expect(result.targetAreaId).toBe('pizzeria-id')
  })
})
