// src/components/shared/product-type-badge.tsx
// Badge visual para distinguir productos DIRECTO vs FINAL.
// Reutilizable en POS, KDS, admin.
//
// Reglas:
// - Sin lógica de negocio.
// - Solo visualización.
// - DIRECTO: badge discreto (el producto se despacha inmediato).
// - FINAL: badge "Prep." (requiere preparación).

import { cn } from '@/lib/utils'

interface Props {
  type: 'DIRECTO' | 'FINAL' | 'SUBPRODUCTO' | string
  size?: 'xs' | 'sm'
  className?: string
}

export function ProductTypeBadge({ type, size = 'xs', className }: Props) {
  if (type === 'SUBPRODUCTO') {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-stone-100 text-stone-600 dark:bg-stone-900 dark:text-stone-400',
          size === 'xs' && 'text-[10px]',
          size === 'sm' && 'text-xs',
          className,
        )}
      >
        Sub.
      </span>
    )
  }
  if (type === 'DIRECTO') {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
          size === 'xs' && 'text-[10px]',
          size === 'sm' && 'text-xs',
          className,
        )}
      >
        Directo
      </span>
    )
  }
  // FINAL (requiere preparación)
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
        size === 'xs' && 'text-[10px]',
        size === 'sm' && 'text-xs',
        className,
      )}
    >
      Prep.
    </span>
  )
}
