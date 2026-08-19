// src/components/shared/money.tsx
// Primitive de visualización de dinero.
// Reutilizable en POS, KDS, receipts, admin.
//
// Reglas:
// - Sin lógica de negocio (cálculos en backend/MoneyService).
// - Solo formato + moneda + className opcional.
// - Si la cantidad es 0, mostrar "$0" (no "$0.00" para no saturar UI).
// - Acepta number o string (de string de la API).

import { cn } from '@/lib/utils'

interface MoneyProps {
  amount: number | string | null | undefined
  currency?: string // default: '$'
  decimals?: 0 | 2 // default: 0 para CUP (los precios suelen ser enteros)
  className?: string
  /** Tamaño visual. */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Color: default hereda, muted para secondary. */
  variant?: 'default' | 'muted' | 'success' | 'danger'
}

export function Money({
  amount,
  currency = '$',
  decimals = 0,
  className,
  size = 'md',
  variant = 'default',
}: MoneyProps) {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0)
  if (Number.isNaN(num)) {
    return <span className={cn('font-mono', className)}>{currency}—</span>
  }
  const formatted = num.toLocaleString('es-CU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

  const sizeClass = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl font-semibold',
    xl: 'text-3xl font-bold',
  }[size]

  const variantClass = {
    default: '',
    muted: 'text-muted-foreground',
    success: 'text-emerald-600 dark:text-emerald-400',
    danger: 'text-red-600 dark:text-red-400',
  }[variant]

  return (
    <span className={cn('font-mono tabular-nums', sizeClass, variantClass, className)}>
      {currency}
      {formatted}
    </span>
  )
}
