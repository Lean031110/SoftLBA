// src/components/ui/status-badge.tsx
// v1.0.20-FRONTEND-03: Badge tipado para estados de SoftLBA.
//
// Problema que resuelve:
// - 54+ badges con clases hardcoded tipo `bg-emerald-100 text-emerald-800`
//   dispersos por la app. Cada página tenía su propio mapa de colores.
// - Sin tipado: pasar 'CREADO' vs 'creado' vs 'Creado' causaba bugs silenciosos.
//
// Solución:
// - Un solo componente que consume los mapas en src/lib/status-config.ts.
// - Variantes por tipo de status: order, table, item, payment, user.
// - Soporta `size` para compactar en tablas vs destacar en headers.
// - Fallback seguro para status desconocidos (no rompe el render).

import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  getOrderStatusConfig,
  getTableStatusConfig,
  getOrderItemStatusConfig,
  getPaymentStatusConfig,
  USER_STATUS_CONFIG,
} from '@/lib/status-config'

type StatusKind = 'order' | 'table' | 'item' | 'payment' | 'user-active'

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Tipo de status. Determina qué mapa de configuración usar. */
  kind: StatusKind
  /** Valor del status (ej: 'ENVIADO', 'LIBRE', 'PAGADO', true/false para user-active). */
  value: string | boolean
  /** Tamaño del badge. 'sm' para tablas compactas, 'md' (default) para headers. */
  size?: 'sm' | 'md'
  /** Mostrar un punto de color antes del label. Útil para conexiones o estado activo. */
  showDot?: boolean
  /** Sobreescribir el label (ej: traducir o abreviar). Por defecto usa el del mapa. */
  labelOverride?: string
}

/**
 * Badge tipado para estados de SoftLBA.
 *
 * @example
 * <StatusBadge kind="order" value="ENVIADO" />
 * <StatusBadge kind="table" value="LIBRE" size="sm" />
 * <StatusBadge kind="user-active" value={user.isActive} />
 */
export function StatusBadge({
  kind,
  value,
  size = 'md',
  showDot = false,
  labelOverride,
  className,
  ...props
}: StatusBadgeProps) {
  let label: string
  let badgeClasses: string
  let dotColor = 'bg-stone-400'

  if (kind === 'user-active') {
    const isActive = value === true
    const config = isActive ? USER_STATUS_CONFIG.active : USER_STATUS_CONFIG.inactive
    label = labelOverride ?? config.label
    badgeClasses = config.badgeClasses
    dotColor = isActive ? 'bg-emerald-500' : 'bg-red-500'
  } else {
    const strValue = String(value)
    if (kind === 'order') {
      const cfg = getOrderStatusConfig(strValue)
      label = labelOverride ?? cfg.label
      badgeClasses = cfg.badgeClasses
      dotColor = cfg.dotColor
    } else if (kind === 'table') {
      const cfg = getTableStatusConfig(strValue)
      label = labelOverride ?? cfg.label
      badgeClasses = cfg.badgeClasses
    } else if (kind === 'item') {
      const cfg = getOrderItemStatusConfig(strValue)
      label = labelOverride ?? cfg.label
      badgeClasses = cfg.badgeClasses
    } else {
      // payment
      const cfg = getPaymentStatusConfig(strValue)
      label = labelOverride ?? cfg.label
      badgeClasses = cfg.badgeClasses
    }
  }

  return (
    <Badge
      variant="secondary"
      className={cn(
        badgeClasses,
        size === 'sm' && 'text-[10px] px-1.5 py-0',
        size === 'md' && 'text-xs',
        className,
      )}
      {...props}
    >
      {showDot && (
        <span
          className={cn('inline-block w-1.5 h-1.5 rounded-full mr-1.5', dotColor)}
          aria-hidden="true"
        />
      )}
      {label}
    </Badge>
  )
}
