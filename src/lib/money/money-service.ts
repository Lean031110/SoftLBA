// MoneyService — Manejo seguro de dinero (issues #30, #31, #32, #33)
// FASE 8 (v1.0.9)
import { convertToCup, convertFromCup } from '@/lib/currency'

export type CurrencyCode = 'CUP' | 'USD'
export const SUPPORTED_CURRENCIES: readonly CurrencyCode[] = ['CUP', 'USD'] as const

export function validateCurrency(cur: string): asserts cur is CurrencyCode {
  const upper = (cur || '').toUpperCase()
  if (upper !== 'CUP' && upper !== 'USD') {
    throw new Error(`Moneda inválida: ${cur}. Solo se soportan CUP y USD.`)
  }
}

export function isValidCurrency(cur: string): cur is CurrencyCode {
  const upper = (cur || '').toUpperCase()
  return upper === 'CUP' || upper === 'USD'
}

export function roundHalfToEven(value: number): number {
  if (!Number.isFinite(value)) return 0
  return parseFloat(value.toFixed(2))
}

export function roundTo(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return 0
  return parseFloat((value).toFixed(decimals))
}

export function addMoney(a: number, b: number): number {
  return roundHalfToEven((a || 0) + (b || 0))
}

export function subtractMoney(a: number, b: number): number {
  return roundHalfToEven((a || 0) - (b || 0))
}

export function multiplyMoney(amount: number, factor: number): number {
  return roundHalfToEven((amount || 0) * (factor || 0))
}

export function usdToCup(usdAmount: number, usdToCupRate: number): number {
  return roundHalfToEven(convertToCup(usdAmount, 'USD', usdToCupRate))
}

export function cupToUsd(cupAmount: number, usdToCupRate: number): number {
  return roundHalfToEven(convertFromCup(cupAmount, 'USD', usdToCupRate))
}

export function toBaseCurrency(amount: number, currency: string, usdToCupRate: number): number {
  return roundHalfToEven(convertToCup(amount, currency, usdToCupRate))
}

export function formatMoney(amount: number, currency: string = 'CUP', symbol?: string): string {
  const rounded = roundHalfToEven(amount)
  if (symbol) return `${symbol}${rounded.toFixed(2)}`
  return `${rounded.toFixed(2)} ${currency.toUpperCase()}`
}

export interface CashCalculation {
  amount: number
  amountTendered: number
  change: number
  isExact: boolean
  isInsufficient: boolean
  shortage: number
}

export function calculateChange(params: { amount: number; amountTendered: number }): CashCalculation {
  const amount = roundHalfToEven(params.amount)
  const amountTendered = roundHalfToEven(params.amountTendered)
  if (amountTendered < amount) {
    return { amount, amountTendered, change: 0, isExact: false, isInsufficient: true, shortage: roundHalfToEven(amount - amountTendered) }
  }
  const change = roundHalfToEven(amountTendered - amount)
  return { amount, amountTendered, change, isExact: change === 0, isInsufficient: false, shortage: 0 }
}

export type PaymentMethodCode =
  | 'EFECTIVO_CUP' | 'EFECTIVO_USD' | 'TRANSFERENCIA_CUP' | 'TRANSFERENCIA_USD'
  | 'ZELLE' | 'BANCARIA_USD' | 'COMBINADO'

export function isCombinedMethod(method: string): boolean {
  return method === 'COMBINADO'
}

export function isValidPaymentMethod(method: string): method is PaymentMethodCode {
  return ['EFECTIVO_CUP', 'EFECTIVO_USD', 'TRANSFERENCIA_CUP', 'TRANSFERENCIA_USD', 'ZELLE', 'BANCARIA_USD', 'COMBINADO'].includes(method)
}

export function expectedCurrencyForMethod(method: PaymentMethodCode): CurrencyCode | null {
  switch (method) {
    case 'EFECTIVO_CUP':
    case 'TRANSFERENCIA_CUP':
      return 'CUP'
    case 'EFECTIVO_USD':
    case 'TRANSFERENCIA_USD':
    case 'ZELLE':
    case 'BANCARIA_USD':
      return 'USD'
    case 'COMBINADO':
      return null
  }
}

export function requiresCashInfo(method: PaymentMethodCode): boolean {
  return method === 'EFECTIVO_CUP' || method === 'EFECTIVO_USD'
}

export const MoneyService = {
  validateCurrency, isValidCurrency, roundHalfToEven, roundTo,
  addMoney, subtractMoney, multiplyMoney, usdToCup, cupToUsd,
  toBaseCurrency, formatMoney, calculateChange, isCombinedMethod,
  isValidPaymentMethod, expectedCurrencyForMethod, requiresCashInfo,
}
export default MoneyService
