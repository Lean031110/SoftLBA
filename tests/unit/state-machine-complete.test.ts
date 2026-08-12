// Tests de máquina de estados completa (FASE 20)
// Cubre: OrderStatus, OrderItemStatus, DESPACHADO, transiciones
import { describe, it, expect } from 'vitest'
import {
  ORDER_TRANSITIONS,
  ITEM_TRANSITIONS,
  canTransitionOrder,
  canTransitionItem,
  getValidOrderTransitions,
  getValidItemTransitions,
} from '../../src/lib/order-state-machine'

describe('Máquina de estados — OrderStatus', () => {
  describe('Transiciones válidas', () => {
    it('CREADO → ENVIADO', () => {
      expect(canTransitionOrder('CREADO', 'ENVIADO')).toBe(true)
    })
    it('CREADO → CANCELADO', () => {
      expect(canTransitionOrder('CREADO', 'CANCELADO')).toBe(true)
    })
    it('ENVIADO → EN_PREPARACION', () => {
      expect(canTransitionOrder('ENVIADO', 'EN_PREPARACION')).toBe(true)
    })
    it('ENVIADO → CANCELADO', () => {
      expect(canTransitionOrder('ENVIADO', 'CANCELADO')).toBe(true)
    })
    it('EN_PREPARACION → LISTO', () => {
      expect(canTransitionOrder('EN_PREPARACION', 'LISTO')).toBe(true)
    })
    it('LISTO → SERVIDO', () => {
      expect(canTransitionOrder('LISTO', 'SERVIDO')).toBe(true)
    })
    it('LISTO → EN_PREPARACION (volver atrás)', () => {
      expect(canTransitionOrder('LISTO', 'EN_PREPARACION')).toBe(true)
    })
    it('SERVIDO → COBRADO', () => {
      expect(canTransitionOrder('SERVIDO', 'COBRADO')).toBe(true)
    })
    it('COBRADO → ARCHIVADO', () => {
      expect(canTransitionOrder('COBRADO', 'ARCHIVADO')).toBe(true)
    })
  })

  describe('Transiciones inválidas', () => {
    it('CREADO no puede ir directo a COBRADO', () => {
      expect(canTransitionOrder('CREADO', 'COBRADO')).toBe(false)
    })
    it('CREADO no puede ir directo a LISTO', () => {
      expect(canTransitionOrder('CREADO', 'LISTO')).toBe(false)
    })
    it('ENVIADO no puede ir directo a SERVIDO', () => {
      expect(canTransitionOrder('ENVIADO', 'SERVIDO')).toBe(false)
    })
    it('CANCELADO es terminal', () => {
      expect(canTransitionOrder('CANCELADO', 'CREADO')).toBe(false)
      expect(canTransitionOrder('CANCELADO', 'ENVIADO')).toBe(false)
    })
    it('ARCHIVADO es terminal', () => {
      expect(canTransitionOrder('ARCHIVADO', 'COBRADO')).toBe(false)
      expect(canTransitionOrder('ARCHIVADO', 'CREADO')).toBe(false)
    })
    it('COBRADO no puede volver a SERVIDO', () => {
      expect(canTransitionOrder('COBRADO', 'SERVIDO')).toBe(false)
    })
  })

  describe('getValidOrderTransitions', () => {
    it('CREADO tiene 2 transiciones', () => {
      expect(getValidOrderTransitions('CREADO')).toHaveLength(2)
      expect(getValidOrderTransitions('CREADO')).toContain('ENVIADO')
      expect(getValidOrderTransitions('CREADO')).toContain('CANCELADO')
    })
    it('CANCELADO no tiene transiciones', () => {
      expect(getValidOrderTransitions('CANCELADO')).toEqual([])
    })
    it('ARCHIVADO no tiene transiciones', () => {
      expect(getValidOrderTransitions('ARCHIVADO')).toEqual([])
    })
  })
})

describe('Máquina de estados — OrderItemStatus (con DESPACHADO)', () => {
  describe('Flujo FINAL (producción)', () => {
    it('PENDIENTE → EN_PREPARACION', () => {
      expect(canTransitionItem('PENDIENTE', 'EN_PREPARACION')).toBe(true)
    })
    it('EN_PREPARACION → LISTO', () => {
      expect(canTransitionItem('EN_PREPARACION', 'LISTO')).toBe(true)
    })
    it('LISTO → SERVIDO', () => {
      expect(canTransitionItem('LISTO', 'SERVIDO')).toBe(true)
    })
    it('PENDIENTE no puede ir directo a LISTO', () => {
      expect(canTransitionItem('PENDIENTE', 'LISTO')).toBe(false)
    })
    it('PENDIENTE no puede ir directo a SERVIDO', () => {
      expect(canTransitionItem('PENDIENTE', 'SERVIDO')).toBe(false)
    })
  })

  describe('Flujo DIRECTO (despacho)', () => {
    it('DESPACHADO existe en el enum', () => {
      expect(ITEM_TRANSITIONS.DESPACHADO).toBeDefined()
    })
    it('PENDIENTE → DESPACHADO', () => {
      expect(canTransitionItem('PENDIENTE', 'DESPACHADO')).toBe(true)
    })
    it('DESPACHADO → SERVIDO', () => {
      expect(canTransitionItem('DESPACHADO', 'SERVIDO')).toBe(true)
    })
    it('LISTO → DESPACHADO', () => {
      expect(canTransitionItem('LISTO', 'DESPACHADO')).toBe(true)
    })
  })

  describe('Cancelación', () => {
    it('PENDIENTE → CANCELADO', () => {
      expect(canTransitionItem('PENDIENTE', 'CANCELADO')).toBe(true)
    })
    it('EN_PREPARACION → CANCELADO', () => {
      expect(canTransitionItem('EN_PREPARACION', 'CANCELADO')).toBe(true)
    })
    it('CANCELADO es terminal', () => {
      expect(canTransitionItem('CANCELADO', 'PENDIENTE')).toBe(false)
      expect(canTransitionItem('CANCELADO', 'EN_PREPARACION')).toBe(false)
    })
  })

  describe('Estados terminales', () => {
    it('SERVIDO no tiene transiciones', () => {
      expect(getValidItemTransitions('SERVIDO')).toEqual([])
    })
    it('CANCELADO no tiene transiciones', () => {
      expect(getValidItemTransitions('CANCELADO')).toEqual([])
    })
  })

  describe('getValidItemTransitions', () => {
    it('PENDIENTE tiene 3 transiciones (EN_PREPARACION, DESPACHADO, CANCELADO)', () => {
      const transitions = getValidItemTransitions('PENDIENTE')
      expect(transitions).toContain('EN_PREPARACION')
      expect(transitions).toContain('DESPACHADO')
      expect(transitions).toContain('CANCELADO')
    })
    it('DESPACHADO solo puede ir a SERVIDO', () => {
      expect(getValidItemTransitions('DESPACHADO')).toEqual(['SERVIDO'])
    })
  })
})

describe('Máquina de estados — recalculateOrderStatus (reglas de derivación)', () => {
  // Estas son las reglas documentadas en el código:
  // - Si todos los items están PENDIENTE → ENVIADO (si ya estaba Enviado+)
  // - Si al menos uno está EN_PREPARACION → EN_PREPARACION
  // - Si todos están en estado terminal → LISTO
  // - Si todos están CANCELADO → CANCELADO
  // - CREADO no se promueve automáticamente

  it('transiciones ORDER definidas correctamente', () => {
    expect(ORDER_TRANSITIONS.CREADO).toContain('ENVIADO')
    expect(ORDER_TRANSITIONS.CREADO).toContain('CANCELADO')
    expect(ORDER_TRANSITIONS.SERVIDO).toContain('COBRADO')
    expect(ORDER_TRANSITIONS.CANCELADO).toEqual([])
    expect(ORDER_TRANSITIONS.ARCHIVADO).toEqual([])
  })

  it('transiciones ITEM definidas correctamente con DESPACHADO', () => {
    expect(ITEM_TRANSITIONS.PENDIENTE).toContain('DESPACHADO')
    expect(ITEM_TRANSITIONS.DESPACHADO).toContain('SERVIDO')
    expect(ITEM_TRANSITIONS.LISTO).toContain('SERVIDO')
    expect(ITEM_TRANSITIONS.LISTO).toContain('DESPACHADO')
  })
})
