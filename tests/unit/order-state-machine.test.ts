import { describe, it, expect } from 'vitest'
import {
  canTransitionOrder,
  canTransitionItem,
  getValidOrderTransitions,
  getValidItemTransitions,
} from '../../src/lib/order-state-machine'

describe('Order State Machine', () => {
  describe('canTransitionOrder', () => {
    it('permite transiciones válidas', () => {
      expect(canTransitionOrder('CREADO', 'ENVIADO')).toBe(true)
      expect(canTransitionOrder('ENVIADO', 'EN_PREPARACION')).toBe(true)
      expect(canTransitionOrder('EN_PREPARACION', 'LISTO')).toBe(true)
      expect(canTransitionOrder('LISTO', 'SERVIDO')).toBe(true)
      expect(canTransitionOrder('SERVIDO', 'COBRADO')).toBe(true)
      expect(canTransitionOrder('COBRADO', 'ARCHIVADO')).toBe(true)
    })

    it('permite cancelar desde CREADO', () => {
      expect(canTransitionOrder('CREADO', 'CANCELADO')).toBe(true)
    })

    it('permite cancelar desde ENVIADO', () => {
      expect(canTransitionOrder('ENVIADO', 'CANCELADO')).toBe(true)
    })

    it('no permite cancelar desde EN_PREPARACION', () => {
      expect(canTransitionOrder('EN_PREPARACION', 'CANCELADO')).toBe(false)
    })

    it('no permite saltarse estados', () => {
      expect(canTransitionOrder('CREADO', 'COBRADO')).toBe(false)
      expect(canTransitionOrder('ENVIADO', 'SERVIDO')).toBe(false)
      expect(canTransitionOrder('CREADO', 'LISTO')).toBe(false)
    })

    it('no permite transiciones desde estados terminales', () => {
      expect(canTransitionOrder('CANCELADO', 'CREADO')).toBe(false)
      expect(canTransitionOrder('ARCHIVADO', 'COBRADO')).toBe(false)
    })

    it('permite volver a preparación desde LISTO', () => {
      expect(canTransitionOrder('LISTO', 'EN_PREPARACION')).toBe(true)
    })
  })

  describe('canTransitionItem', () => {
    it('permite transiciones válidas', () => {
      expect(canTransitionItem('PENDIENTE', 'EN_PREPARACION')).toBe(true)
      expect(canTransitionItem('PENDIENTE', 'CANCELADO')).toBe(true)
      expect(canTransitionItem('EN_PREPARACION', 'LISTO')).toBe(true)
      expect(canTransitionItem('EN_PREPARACION', 'CANCELADO')).toBe(true)
      expect(canTransitionItem('LISTO', 'SERVIDO')).toBe(true)
    })

    it('no permite saltarse estados', () => {
      expect(canTransitionItem('PENDIENTE', 'LISTO')).toBe(false)
      expect(canTransitionItem('PENDIENTE', 'SERVIDO')).toBe(false)
    })

    it('no permite transiciones desde estados terminales', () => {
      expect(canTransitionItem('CANCELADO', 'PENDIENTE')).toBe(false)
      expect(canTransitionItem('SERVIDO', 'LISTO')).toBe(false)
    })
  })

  describe('getValidOrderTransitions', () => {
    it('devuelve transiciones válidas para CREADO', () => {
      const transitions = getValidOrderTransitions('CREADO')
      expect(transitions).toContain('ENVIADO')
      expect(transitions).toContain('CANCELADO')
      expect(transitions.length).toBe(2)
    })

    it('devuelve array vacío para estados terminales', () => {
      expect(getValidOrderTransitions('CANCELADO')).toEqual([])
      expect(getValidOrderTransitions('ARCHIVADO')).toEqual([])
    })
  })

  describe('getValidItemTransitions', () => {
    it('devuelve transiciones válidas para PENDIENTE', () => {
      const transitions = getValidItemTransitions('PENDIENTE')
      expect(transitions).toContain('EN_PREPARACION')
      expect(transitions).toContain('CANCELADO')
    })

    it('devuelve array vacío para SERVIDO', () => {
      expect(getValidItemTransitions('SERVIDO')).toEqual([])
    })
  })
})
