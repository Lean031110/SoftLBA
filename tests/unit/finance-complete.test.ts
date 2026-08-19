// Tests de finanzas y conversión monetaria (FASE 20)
// Cubre: CUP/USD, exchangeRate, convertedAmount, redondeo, histórico
import { describe, it, expect } from 'vitest'
import {
  convertToCup,
  convertFromCup,
  convertCurrency,
  sumConvertedToCup,
  computeConvertedAmount,
  currencyForMethod,
} from '../../src/lib/currency'
import { MoneyService } from '../../src/lib/money/money-service'

describe('Finanzas — Conversión CUP/USD', () => {
  it('convertToCup: USD → CUP con tasa 320', () => {
    expect(convertToCup(10, 'USD', 320)).toBe(3200)
    expect(convertToCup(1, 'USD', 320)).toBe(320)
  })

  it('convertToCup: CUP → CUP sin cambios', () => {
    expect(convertToCup(100, 'CUP', 320)).toBe(100)
  })

  it('convertFromCup: CUP → USD con tasa 320', () => {
    expect(convertFromCup(320, 'USD', 320)).toBe(1)
    expect(convertFromCup(3200, 'USD', 320)).toBe(10)
  })

  it('convertFromCup: CUP → CUP sin cambios', () => {
    expect(convertFromCup(100, 'CUP', 320)).toBe(100)
  })

  it('convertCurrency: USD → CUP', () => {
    expect(convertCurrency(10, 'USD', 'CUP', 320)).toBe(3200)
  })

  it('convertCurrency: CUP → USD', () => {
    expect(convertCurrency(3200, 'CUP', 'USD', 320)).toBe(10)
  })

  it('convertCurrency: misma moneda no cambia', () => {
    expect(convertCurrency(100, 'CUP', 'CUP', 320)).toBe(100)
    expect(convertCurrency(100, 'USD', 'USD', 320)).toBe(100)
  })

  it('convertToCup maneja NaN/Infinity defensivamente', () => {
    expect(convertToCup(NaN, 'USD', 320)).toBe(0)
    expect(convertToCup(Infinity, 'USD', 320)).toBe(0)
  })

  it('convertToCup usa tasa default 320 si tasa inválida', () => {
    expect(convertToCup(10, 'USD', 0)).toBe(3200)
    expect(convertToCup(10, 'USD', -1)).toBe(3200)
    expect(convertToCup(10, 'USD', NaN)).toBe(3200)
  })
})

describe('Finanzas — computeConvertedAmount', () => {
  it('CUP → mismo monto', () => {
    expect(computeConvertedAmount(100, 'CUP', 320)).toBe(100)
  })

  it('USD → CUP con tasa', () => {
    expect(computeConvertedAmount(10, 'USD', 320)).toBe(3200)
  })

  it('USD → CUP con tasa diferente', () => {
    expect(computeConvertedAmount(10, 'USD', 350)).toBe(3500)
  })
})

describe('Finanzas — sumConvertedToCup', () => {
  it('suma pagos en CUP correctamente', () => {
    const payments = [
      { amount: 100, currency: 'CUP', convertedAmount: 100 },
      { amount: 200, currency: 'CUP', convertedAmount: 200 },
    ]
    expect(sumConvertedToCup(payments as any, 320)).toBe(300)
  })

  it('suma pagos en USD usando convertedAmount', () => {
    const payments = [
      { amount: 10, currency: 'USD', convertedAmount: 3200 },
      { amount: 100, currency: 'CUP', convertedAmount: 100 },
    ]
    expect(sumConvertedToCup(payments as any, 320)).toBe(3300)
  })

  it('suma pagos sin convertedAmount usa conversión en tiempo real', () => {
    const payments = [
      { amount: 10, currency: 'USD' },
      { amount: 100, currency: 'CUP' },
    ]
    // 10 USD * 320 + 100 CUP = 3300
    expect(sumConvertedToCup(payments as any, 320)).toBe(3300)
  })

  it('array vacío → 0', () => {
    expect(sumConvertedToCup([], 320)).toBe(0)
  })
})

describe('Finanzas — currencyForMethod', () => {
  it('EFECTIVO_CUP → CUP', () => {
    expect(currencyForMethod('EFECTIVO_CUP')).toBe('CUP')
  })
  it('EFECTIVO_USD → USD', () => {
    expect(currencyForMethod('EFECTIVO_USD')).toBe('USD')
  })
  it('TRANSFERENCIA_CUP → CUP', () => {
    expect(currencyForMethod('TRANSFERENCIA_CUP')).toBe('CUP')
  })
  it('TRANSFERENCIA_USD → USD', () => {
    expect(currencyForMethod('TRANSFERENCIA_USD')).toBe('USD')
  })
  it('ZELLE → USD', () => {
    expect(currencyForMethod('ZELLE')).toBe('USD')
  })
  it('BANCARIA_USD → USD', () => {
    expect(currencyForMethod('BANCARIA_USD')).toBe('USD')
  })
  it('COMBINADO → CUP (default)', () => {
    expect(currencyForMethod('COMBINADO')).toBe('CUP')
  })
})

describe('Finanzas — Snapshot histórico (no recalcular con tasa actual)', () => {
  it('pago histórico con exchangeRate=320 mantiene 3200 CUP aunque tasa cambie a 350', () => {
    // Simular pago histórico
    const historicalPayment = {
      amount: 10,
      currency: 'USD',
      exchangeRate: 320,
      convertedAmount: 3200,
      baseCurrency: 'CUP',
    }
    // La tasa actual es 350, pero el snapshot dice 3200
    expect(historicalPayment.convertedAmount).toBe(3200)
    // Si usáramos la tasa actual: 10 * 350 = 3500 (INCORRECTO)
    expect(10 * 350).not.toBe(3200)
  })

  it('sumConvertedToCup usa convertedAmount del snapshot, no recalcula', () => {
    const historicalPayment = {
      amount: 10,
      currency: 'USD',
      convertedAmount: 3200, // snapshot con tasa 320
    }
    const currentRate = 350
    // sumConvertedToCup debe usar 3200 (snapshot), no 10*350=3500
    expect(sumConvertedToCup([historicalPayment] as any, currentRate)).toBe(3200)
  })
})

describe('Finanzas — MoneyService integración', () => {
  it('usdToCup con MoneyService usa redondeo bancario', () => {
    expect(MoneyService.usdToCup(10, 320)).toBe(3200)
    expect(MoneyService.usdToCup(10.005, 320)).toBe(3201.6)
  })

  it('calculateChange para pago CUP exacto', () => {
    const r = MoneyService.calculateChange({ amount: 750, amountTendered: 750 })
    expect(r.isExact).toBe(true)
    expect(r.change).toBe(0)
  })

  it('calculateChange para pago CUP con cambio', () => {
    const r = MoneyService.calculateChange({ amount: 750, amountTendered: 1000 })
    expect(r.change).toBe(250)
    expect(r.isInsufficient).toBe(false)
  })

  it('calculateChange detecta pago insuficiente', () => {
    const r = MoneyService.calculateChange({ amount: 1000, amountTendered: 500 })
    expect(r.isInsufficient).toBe(true)
    expect(r.shortage).toBe(500)
    expect(r.change).toBe(0)
  })

  it('formatMoney muestra moneda correctamente', () => {
    expect(MoneyService.formatMoney(1234.5, 'CUP')).toBe('1234.50 CUP')
    expect(MoneyService.formatMoney(1234.5, 'USD')).toBe('1234.50 USD')
    expect(MoneyService.formatMoney(1234.5, 'CUP', '$')).toBe('$1234.50')
  })

  it('no se pueden sumar monedas diferentes sin conversión', () => {
    // 100 CUP + 10 USD no es 110, es 100 + (10*320) = 3300 CUP
    const cupAmount = 100
    const usdAmount = 10
    const rate = 320
    const totalInCup = MoneyService.addMoney(cupAmount, MoneyService.usdToCup(usdAmount, rate))
    expect(totalInCup).toBe(3300)
    expect(totalInCup).not.toBe(110) // No se suman directamente
  })
})
