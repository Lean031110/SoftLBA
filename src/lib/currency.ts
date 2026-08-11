// ============================================================
// Utilidades de conversión monetaria CUP/USD - Sistema SoftLBA
// ============================================================
// Tasa de cambio configurable en RestaurantConfig.usdToCup
// (por defecto 320: 1 USD = 320 CUP).
// Las conversiones son puramente aritméticas (sin redondeo bancario)
// porque los montos provienen ya de los pagos registrados.
// ============================================================

export type Currency = 'CUP' | 'USD'

export interface PaymentLike {
  amount: number
  currency: string
  method?: string
}

// ============================================================
// Conversión básica
// ============================================================

/**
 * Convierte un monto a CUP usando la tasa USD→CUP.
 * - Si `currency` ya es CUP, retorna el monto sin cambios.
 * - Si `currency` es USD, multiplica por `usdToCupRate`.
 * - Cualquier otra moneda se trata como CUP (defensivo).
 */
export function convertToCup(amount: number, currency: string, usdToCupRate: number): number {
  if (!Number.isFinite(amount)) return 0
  const rate = Number.isFinite(usdToCupRate) && usdToCupRate > 0 ? usdToCupRate : 320
  const cur = (currency || 'CUP').toUpperCase()
  if (cur === 'USD') return amount * rate
  return amount
}

/**
 * Convierte un monto desde CUP hacia `targetCurrency` usando la tasa USD→CUP.
 * - Si targetCurrency es CUP, retorna el monto sin cambios.
 * - Si targetCurrency es USD, divide por `usdToCupRate`.
 */
export function convertFromCup(
  amount: number,
  targetCurrency: string,
  usdToCupRate: number,
): number {
  if (!Number.isFinite(amount)) return 0
  const rate = Number.isFinite(usdToCupRate) && usdToCupRate > 0 ? usdToCupRate : 320
  const cur = (targetCurrency || 'CUP').toUpperCase()
  if (cur === 'USD') return amount / rate
  return amount
}

/**
 * Convierte un monto desde su moneda origen hacia otra moneda destino,
 * pasando por CUP como pivote. Útil para convertir USD→CUP o CUP→USD.
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  usdToCupRate: number,
): number {
  const from = (fromCurrency || 'CUP').toUpperCase()
  const to = (toCurrency || 'CUP').toUpperCase()
  if (from === to) return amount
  const inCup = convertToCup(amount, from, usdToCupRate)
  return convertFromCup(inCup, to, usdToCupRate)
}

// ============================================================
// Totales agregados
// ============================================================

/**
 * Suma todos los pagos de un array convirtiéndolos a `targetCurrency`.
 *
 * @param payments Lista de pagos con campos `amount` y `currency`.
 * @param targetCurrency Moneda destino ('CUP' o 'USD').
 * @param usdToCupRate Tasa USD→CUP.
 * @returns Monto total en la moneda destino.
 */
export function getTotalInCurrency(
  payments: PaymentLike[],
  targetCurrency: string,
  usdToCupRate: number,
): number {
  const target = (targetCurrency || 'CUP').toUpperCase()
  let total = 0
  for (const p of payments) {
    total += convertCurrency(p.amount, p.currency, target, usdToCupRate)
  }
  return total
}

// ============================================================
// Clasificación por método + moneda (para cierres diarios)
// ============================================================

/**
 * Determina si un método de pago corresponde a efectivo.
 * Métodos considerados efectivo: EFECTIVO_CUP, EFECTIVO_USD
 */
export function isCashMethod(method: string): boolean {
  return method === 'EFECTIVO_CUP' || method === 'EFECTIVO_USD'
}

/**
 * Determina si un método de pago corresponde a transferencia/banco.
 * Métodos: TRANSFERENCIA_CUP, TRANSFERENCIA_USD, ZELLE, BANCARIA_USD
 */
export function isTransferMethod(method: string): boolean {
  if (!method) return false
  if (method.startsWith('TRANSFERENCIA')) return true
  if (method === 'ZELLE' || method === 'BANCARIA_USD') return true
  return false
}

/**
 * Determina la moneda de un método de pago basado en su nombre.
 * - Métodos que terminan en _USD → USD
 * - ZELLE, BANCARIA_USD → USD
 * - Resto → CUP
 */
export function currencyForMethod(method: string): Currency {
  if (!method) return 'CUP'
  const m = method.toUpperCase()
  if (m.endsWith('_USD') || m === 'ZELLE' || m === 'BANCARIA_USD') return 'USD'
  return 'CUP'
}

/**
 * Clasifica una lista de pagos en totales por (método, moneda) y por tipo (efectivo/transferencia).
 *
 * Devuelve un objeto con:
 *   - totalCashCUP, totalCashUSD
 *   - totalTransferCUP, totalTransferUSD
 *   - totalOther (pago combinado u otros)
 *   - totalCUP (en CUP equivalente)
 *   - totalUSD (en USD equivalente)
 *   - byMethod: Record<method, number> en su moneda original
 */
export interface PaymentBreakdown {
  totalCashCUP: number
  totalCashUSD: number
  totalTransferCUP: number
  totalTransferUSD: number
  totalOther: number
  totalCUP: number
  totalUSD: number
  byMethod: Record<string, number>
}

export function breakdownPayments(
  payments: PaymentLike[],
  usdToCupRate: number,
): PaymentBreakdown {
  const result: PaymentBreakdown = {
    totalCashCUP: 0,
    totalCashUSD: 0,
    totalTransferCUP: 0,
    totalTransferUSD: 0,
    totalOther: 0,
    totalCUP: 0,
    totalUSD: 0,
    byMethod: {},
  }

  for (const p of payments) {
    const method = p.method || ''
    const amount = Number.isFinite(p.amount) ? p.amount : 0
    const currency = currencyForMethod(method)

    result.byMethod[method] = (result.byMethod[method] || 0) + amount

    if (isCashMethod(method)) {
      if (currency === 'USD') result.totalCashUSD += amount
      else result.totalCashCUP += amount
    } else if (isTransferMethod(method)) {
      if (currency === 'USD') result.totalTransferUSD += amount
      else result.totalTransferCUP += amount
    } else {
      // COMBINADO u otros: contarlo en "other" y sumarlo al total en su moneda
      result.totalOther += amount
      // Si COMBINADO viene con currency USD lo tratamos como USD; si no, como CUP
      if ((p.currency || '').toUpperCase() === 'USD') {
        result.totalTransferUSD += amount
      } else {
        result.totalTransferCUP += amount
      }
    }

    // Totales en CUP y USD equivalentes
    result.totalCUP += convertToCup(amount, currency, usdToCupRate)
  }

  result.totalUSD = result.totalCUP / (usdToCupRate > 0 ? usdToCupRate : 320)
  return result
}

// ============================================================
// Formateo
// ============================================================

/**
 * Formatea un monto con la moneda y símbolo dados.
 */
export function formatCurrency(amount: number, currency: string, symbol = '$'): string {
  const safe = Number.isFinite(amount) ? amount : 0
  const cur = (currency || 'CUP').toUpperCase()
  const rounded = Math.round(safe * 100) / 100
  return `${symbol}${rounded.toFixed(2)} ${cur}`
}
