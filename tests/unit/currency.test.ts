import { describe, it, expect } from 'vitest'
import { convertToCup, convertFromCup, getTotalInCurrency } from '../../src/lib/currency'

describe('Currency', () => {
  const usdToCupRate = 350

  describe('convertToCup', () => {
    it('convierte USD a CUP usando la tasa', () => {
      expect(convertToCup(10, 'USD', usdToCupRate)).toBe(3500)
    })

    it('no convierte CUP (misma moneda)', () => {
      expect(convertToCup(100, 'CUP', usdToCupRate)).toBe(100)
    })

    it('maneja montos decimales', () => {
      expect(convertToCup(5.5, 'USD', usdToCupRate)).toBe(1925)
    })

    it('maneja monto cero', () => {
      expect(convertToCup(0, 'USD', usdToCupRate)).toBe(0)
    })
  })

  describe('convertFromCup', () => {
    it('convierte CUP a USD', () => {
      expect(convertFromCup(3500, 'USD', usdToCupRate)).toBe(10)
    })

    it('no convierte CUP a CUP', () => {
      expect(convertFromCup(100, 'CUP', usdToCupRate)).toBe(100)
    })
  })

  describe('getTotalInCurrency', () => {
    it('suma pagos en CUP directamente', () => {
      const payments = [
        { amount: 100, currency: 'CUP' },
        { amount: 200, currency: 'CUP' },
      ]
      expect(getTotalInCurrency(payments, 'CUP', usdToCupRate)).toBe(300)
    })

    it('convierte USD a CUP al sumar', () => {
      const payments = [
        { amount: 100, currency: 'CUP' },
        { amount: 10, currency: 'USD' },
      ]
      expect(getTotalInCurrency(payments, 'CUP', usdToCupRate)).toBe(3600)
    })

    it('convierte CUP a USD al sumar', () => {
      const payments = [
        { amount: 700, currency: 'CUP' },
        { amount: 10, currency: 'USD' },
      ]
      expect(getTotalInCurrency(payments, 'USD', usdToCupRate)).toBe(12)
    })

    it('maneja array vacío', () => {
      expect(getTotalInCurrency([], 'CUP', usdToCupRate)).toBe(0)
    })
  })
})
