// tests/unit/status-config.test.ts
// v1.0.20-FRONTEND-03: Tests para src/lib/status-config.ts

import { describe, it, expect } from 'vitest'
import {
  ORDER_STATUS_CONFIG,
  TABLE_STATUS_CONFIG,
  ORDER_ITEM_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
  USER_STATUS_CONFIG,
  getOrderStatusConfig,
  getTableStatusConfig,
  getOrderItemStatusConfig,
  getPaymentStatusConfig,
} from '../../src/lib/status-config'

describe('status-config — mapas centralizados', () => {
  describe('ORDER_STATUS_CONFIG', () => {
    it('tiene entradas para los 9 estados de orden', () => {
      const expected = [
        'CREADO',
        'ENVIADO',
        'EN_PREPARACION',
        'LISTO',
        'SERVIDO',
        'DESPACHADO',
        'COBRADO',
        'CANCELADO',
        'ARCHIVADO',
      ]
      for (const s of expected) {
        expect(ORDER_STATUS_CONFIG[s as keyof typeof ORDER_STATUS_CONFIG]).toBeDefined()
      }
    })

    it('cada entrada tiene label, badgeClasses y dotColor', () => {
      for (const [, config] of Object.entries(ORDER_STATUS_CONFIG)) {
        expect(typeof config.label).toBe('string')
        expect(config.label.length).toBeGreaterThan(0)
        expect(typeof config.badgeClasses).toBe('string')
        expect(config.badgeClasses).toContain('bg-')
        expect(typeof config.dotColor).toBe('string')
        expect(config.dotColor).toContain('bg-')
      }
    })

    it('CANCELADO usa colores rojos (destructive)', () => {
      expect(ORDER_STATUS_CONFIG.CANCELADO.badgeClasses).toContain('bg-red')
      expect(ORDER_STATUS_CONFIG.CANCELADO.badgeClasses).toContain('text-red')
    })

    it('LISTO usa colores verdes (success)', () => {
      expect(ORDER_STATUS_CONFIG.LISTO.badgeClasses).toContain('bg-emerald')
    })

    it('CANCELADO y LISTO tienen labels distintos', () => {
      expect(ORDER_STATUS_CONFIG.CANCELADO.label).not.toBe(ORDER_STATUS_CONFIG.LISTO.label)
    })
  })

  describe('TABLE_STATUS_CONFIG', () => {
    it('tiene 5 estados de mesa', () => {
      expect(Object.keys(TABLE_STATUS_CONFIG).length).toBe(5)
    })

    it('LIBRE es verde, OCUPADA es roja', () => {
      expect(TABLE_STATUS_CONFIG.LIBRE.badgeClasses).toContain('bg-emerald')
      expect(TABLE_STATUS_CONFIG.OCUPADA.badgeClasses).toContain('bg-red')
    })
  })

  describe('ORDER_ITEM_STATUS_CONFIG', () => {
    it('tiene 6 estados de item', () => {
      expect(Object.keys(ORDER_ITEM_STATUS_CONFIG).length).toBe(6)
    })

    it('PENDIENTE es gris neutro (no verde/rojo)', () => {
      expect(ORDER_ITEM_STATUS_CONFIG.PENDIENTE.badgeClasses).toContain('bg-stone')
    })

    it('LISTO es verde', () => {
      expect(ORDER_ITEM_STATUS_CONFIG.LISTO.badgeClasses).toContain('bg-emerald')
    })
  })

  describe('PAYMENT_STATUS_CONFIG', () => {
    it('tiene 3 estados de pago', () => {
      expect(Object.keys(PAYMENT_STATUS_CONFIG).length).toBe(3)
    })

    it('PAGADO es verde, PENDIENTE es amber', () => {
      expect(PAYMENT_STATUS_CONFIG.PAGADO.badgeClasses).toContain('bg-emerald')
      expect(PAYMENT_STATUS_CONFIG.PENDIENTE.badgeClasses).toContain('bg-amber')
    })
  })

  describe('USER_STATUS_CONFIG', () => {
    it('tiene 2 estados (active/inactive)', () => {
      expect(Object.keys(USER_STATUS_CONFIG).length).toBe(2)
    })
  })
})

describe('status-config — helpers con fallback', () => {
  describe('getOrderStatusConfig', () => {
    it('devuelve config correcta para status válido', () => {
      const cfg = getOrderStatusConfig('ENVIADO')
      expect(cfg.label).toBe('Enviado')
      expect(cfg.badgeClasses).toContain('bg-blue')
    })

    it('devuelve fallback genérico para status desconocido', () => {
      const cfg = getOrderStatusConfig('STATUS_INVENTADO')
      expect(cfg.label).toBe('STATUS_INVENTADO')
      expect(cfg.badgeClasses).toContain('bg-stone')
    })

    it('no crashea con string vacío', () => {
      const cfg = getOrderStatusConfig('')
      expect(cfg.label).toBe('')
      expect(cfg.badgeClasses).toBeTruthy()
    })
  })

  describe('getTableStatusConfig', () => {
    it('devuelve config para LIBRE', () => {
      const cfg = getTableStatusConfig('LIBRE')
      expect(cfg.label).toBe('Libre')
    })

    it('fallback para desconocido', () => {
      const cfg = getTableStatusConfig('INVALID')
      expect(cfg.label).toBe('INVALID')
    })
  })

  describe('getOrderItemStatusConfig', () => {
    it('devuelve config para PENDIENTE', () => {
      const cfg = getOrderItemStatusConfig('PENDIENTE')
      expect(cfg.label).toBe('Pendiente')
    })
  })

  describe('getPaymentStatusConfig', () => {
    it('devuelve config para PAGADO', () => {
      const cfg = getPaymentStatusConfig('PAGADO')
      expect(cfg.label).toBe('Pagado')
    })
  })
})
