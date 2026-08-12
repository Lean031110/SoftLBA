// Tests unitarios para MoneyService (FASE 8 — v1.0.9)
// ------------------------------------------------------------
// Cubre:
//   - roundHalfToEven (redondeo bancario)
//   - addMoney, subtractMoney, multiplyMoney
//   - usdToCup, cupToUsd, toBaseCurrency
//   - formatMoney
//   - calculateChange (issue #33)
//   - validateCurrency, isValidCurrency (issue #31)
//   - isCombinedMethod, expectedCurrencyForMethod, requiresCashInfo (issues #31, #32)
// ============================================================
import { describe, it, expect } from 'vitest'
import {
  roundHalfToEven,
  roundTo,
  addMoney,
  subtractMoney,
  multiplyMoney,
  usdToCup,
  cupToUsd,
  toBaseCurrency,
  formatMoney,
  calculateChange,
  validateCurrency,
  isValidCurrency,
  isCombinedMethod,
  isValidPaymentMethod,
  expectedCurrencyForMethod,
  requiresCashInfo,
} from '../../src/lib/money/money-service'

describe('MoneyService — roundHalfToEven', () => {
  it('redondea a 2 decimales', () => {
    // toFixed(2) en V8 hace round-half-to-even
    expect(roundHalfToEven(1.234)).toBe(1.23)
    expect(roundHalfToEven(1.235)).toBe(1.24)
    expect(roundHalfToEven(1.999)).toBe(2.0)
    expect(roundHalfToEven(0.5)).toBe(0.5)
  })

  it('maneja números no finitos', () => {
    expect(roundHalfToEven(NaN)).toBe(0)
    expect(roundHalfToEven(Infinity)).toBe(0)
    expect(roundHalfToEven(-Infinity)).toBe(0)
  })

  it('maneja negativos', () => {
    expect(roundHalfToEven(-1.234)).toBe(-1.23)
    expect(roundHalfToEven(-1.5)).toBe(-1.5)
  })
})

describe('MoneyService — roundTo', () => {
  it('redondea a N decimales', () => {
    expect(roundTo(1.2345, 0)).toBe(1)
    expect(roundTo(1.2345, 1)).toBe(1.2)
    expect(roundTo(1.2345, 2)).toBe(1.23)
    expect(roundTo(1.2345, 3)).toBe(1.234)
  })
})

describe('MoneyService — addMoney / subtractMoney / multiplyMoney', () => {
  it('addMoney suma con redondeo', () => {
    // 0.1+0.2 = 0.30000000000000004 sin redondeo, con redondeo a 2 decimales = 0.3
    expect(addMoney(0.1, 0.2)).toBe(0.3)
    expect(addMoney(1.5, 1.5)).toBe(3)
    expect(addMoney(0, 0)).toBe(0)
  })

  it('subtractMoney resta con redondeo', () => {
    expect(subtractMoney(1.0, 0.3)).toBe(0.7) // 1.0-0.3 = 0.7000000000000001 sin redondeo
    expect(subtractMoney(100, 33.33)).toBe(66.67)
  })

  it('multiplyMoney multiplica con redondeo', () => {
    expect(multiplyMoney(10.005, 3)).toBe(30.02)
    expect(multiplyMoney(0, 100)).toBe(0)
  })

  it('maneja null/undefined defensivamente', () => {
    expect(addMoney(null as any, 5)).toBe(5)
    expect(multiplyMoney(undefined as any, 5)).toBe(0)
  })
})

describe('MoneyService — usdToCup / cupToUsd / toBaseCurrency', () => {
  it('usdToCup convierte con tasa', () => {
    expect(usdToCup(10, 320)).toBe(3200)
    expect(usdToCup(1, 320)).toBe(320)
    expect(usdToCup(0, 320)).toBe(0)
  })

  it('cupToUsd convierte con tasa', () => {
    expect(cupToUsd(320, 320)).toBe(1)
    expect(cupToUsd(3200, 320)).toBe(10)
  })

  it('toBaseCurrency deja CUP sin cambios', () => {
    expect(toBaseCurrency(100, 'CUP', 320)).toBe(100)
  })

  it('toBaseCurrency convierte USD a CUP', () => {
    expect(toBaseCurrency(10, 'USD', 320)).toBe(3200)
  })

  it('redondea resultado a 2 decimales', () => {
    expect(usdToCup(10.005, 320)).toBe(3201.6)
  })
})

describe('MoneyService — formatMoney', () => {
  it('formatea con currency', () => {
    expect(formatMoney(1234.5, 'CUP')).toBe('1234.50 CUP')
    expect(formatMoney(1234.5, 'USD')).toBe('1234.50 USD')
  })

  it('formatea con symbol', () => {
    expect(formatMoney(1234.5, 'CUP', '$')).toBe('$1234.50')
    expect(formatMoney(0, 'CUP', '$')).toBe('$0.00')
  })
})

describe('MoneyService — calculateChange (issue #33)', () => {
  it('calcula cambio cuando amountTendered > amount', () => {
    const r = calculateChange({ amount: 750, amountTendered: 1000 })
    expect(r.change).toBe(250)
    expect(r.isExact).toBe(false)
    expect(r.isInsufficient).toBe(false)
    expect(r.shortage).toBe(0)
  })

  it('detecta pago exacto', () => {
    const r = calculateChange({ amount: 750, amountTendered: 750 })
    expect(r.change).toBe(0)
    expect(r.isExact).toBe(true)
    expect(r.isInsufficient).toBe(false)
  })

  it('detecta pago insuficiente', () => {
    const r = calculateChange({ amount: 1000, amountTendered: 500 })
    expect(r.change).toBe(0)
    expect(r.isExact).toBe(false)
    expect(r.isInsufficient).toBe(true)
    expect(r.shortage).toBe(500)
  })

  it('redondea decimales correctamente', () => {
    const r = calculateChange({ amount: 100.5, amountTendered: 200.55 })
    expect(r.change).toBe(100.05)
  })
})

describe('MoneyService — currency validation (issue #31)', () => {
  it('isValidCurrency acepta CUP y USD', () => {
    expect(isValidCurrency('CUP')).toBe(true)
    expect(isValidCurrency('USD')).toBe(true)
    expect(isValidCurrency('cup')).toBe(true) // case insensitive
    expect(isValidCurrency('usd')).toBe(true)
  })

  it('isValidCurrency rechaza otros', () => {
    expect(isValidCurrency('EUR')).toBe(false)
    expect(isValidCurrency('ABC')).toBe(false)
    expect(isValidCurrency('')).toBe(false)
    expect(isValidCurrency(null as any)).toBe(false)
  })

  it('validateCurrency no lanza para CUP/USD', () => {
    expect(() => validateCurrency('CUP')).not.toThrow()
    expect(() => validateCurrency('USD')).not.toThrow()
  })

  it('validateCurrency lanza para inválido', () => {
    expect(() => validateCurrency('EUR')).toThrow(/Moneda inválida/)
    expect(() => validateCurrency('XYZ')).toThrow(/Moneda inválida/)
  })
})

describe('MoneyService — payment method validation (issues #31, #32)', () => {
  it('isValidPaymentMethod acepta métodos válidos', () => {
    expect(isValidPaymentMethod('EFECTIVO_CUP')).toBe(true)
    expect(isValidPaymentMethod('EFECTIVO_USD')).toBe(true)
    expect(isValidPaymentMethod('TRANSFERENCIA_CUP')).toBe(true)
    expect(isValidPaymentMethod('TRANSFERENCIA_USD')).toBe(true)
    expect(isValidPaymentMethod('ZELLE')).toBe(true)
    expect(isValidPaymentMethod('BANCARIA_USD')).toBe(true)
    expect(isValidPaymentMethod('COMBINADO')).toBe(true)
  })

  it('isValidPaymentMethod rechaza inválidos', () => {
    expect(isValidPaymentMethod('EFECTIVO')).toBe(false)
    expect(isValidPaymentMethod('')).toBe(false)
    expect(isValidPaymentMethod('CASH')).toBe(false)
  })

  it('isCombinedMethod detecta método legacy', () => {
    expect(isCombinedMethod('COMBINADO')).toBe(true)
    expect(isCombinedMethod('EFECTIVO_CUP')).toBe(false)
  })

  it('expectedCurrencyForMethod mapea correctamente', () => {
    expect(expectedCurrencyForMethod('EFECTIVO_CUP')).toBe('CUP')
    expect(expectedCurrencyForMethod('TRANSFERENCIA_CUP')).toBe('CUP')
    expect(expectedCurrencyForMethod('EFECTIVO_USD')).toBe('USD')
    expect(expectedCurrencyForMethod('TRANSFERENCIA_USD')).toBe('USD')
    expect(expectedCurrencyForMethod('ZELLE')).toBe('USD')
    expect(expectedCurrencyForMethod('BANCARIA_USD')).toBe('USD')
    expect(expectedCurrencyForMethod('COMBINADO')).toBe(null)
  })

  it('requiresCashInfo solo para efectivo', () => {
    expect(requiresCashInfo('EFECTIVO_CUP')).toBe(true)
    expect(requiresCashInfo('EFECTIVO_USD')).toBe(true)
    expect(requiresCashInfo('TRANSFERENCIA_CUP')).toBe(false)
    expect(requiresCashInfo('ZELLE')).toBe(false)
  })
})
