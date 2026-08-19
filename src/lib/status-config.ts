// src/lib/status-config.ts
// v1.0.20-FRONTEND-03: mapas centralizados de estados de SoftLBA.
//
// Problema que resuelve:
// - 54+ badges coloridos hardcoded con clases tipo `bg-emerald-100 text-emerald-800`
//   dispersos por toda la app.
// - Status maps (`{ ENVIADO: 'Enviado', ... }`) duplicados en cada página.
// - 103+ referencias a status de order en UI, cada una con su propia lógica
//   de label + color + icono.
//
// Solución:
// - Una sola fuente de verdad para cada tipo de status: orden, mesa, usuario,
//   pago, item, finance entry.
// - Mapas: `label`, `badgeClasses` (Tailwind), `dotColor`, `icon`.
// - Componente `StatusBadge` consume estos mapas directamente.

// === ORDER STATUS ===
export type OrderStatus =
  | 'CREADO'
  | 'ENVIADO'
  | 'EN_PREPARACION'
  | 'LISTO'
  | 'SERVIDO'
  | 'DESPACHADO'
  | 'COBRADO'
  | 'CANCELADO'
  | 'ARCHIVADO'

export const ORDER_STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; badgeClasses: string; dotColor: string }
> = {
  CREADO: {
    label: 'Creado',
    badgeClasses: 'bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-200',
    dotColor: 'bg-stone-400',
  },
  ENVIADO: {
    label: 'Enviado',
    badgeClasses: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    dotColor: 'bg-blue-500',
  },
  EN_PREPARACION: {
    label: 'En preparación',
    badgeClasses: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    dotColor: 'bg-amber-500',
  },
  LISTO: {
    label: 'Listo',
    badgeClasses: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    dotColor: 'bg-emerald-500',
  },
  SERVIDO: {
    label: 'Servido',
    badgeClasses: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    dotColor: 'bg-emerald-600',
  },
  DESPACHADO: {
    label: 'Despachado',
    badgeClasses: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    dotColor: 'bg-emerald-600',
  },
  COBRADO: {
    label: 'Cobrado',
    badgeClasses: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    dotColor: 'bg-blue-600',
  },
  CANCELADO: {
    label: 'Cancelado',
    badgeClasses: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    dotColor: 'bg-red-500',
  },
  ARCHIVADO: {
    label: 'Archivado',
    badgeClasses: 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400',
    dotColor: 'bg-stone-400',
  },
}

// === TABLE STATUS ===
export type TableStatus = 'LIBRE' | 'OCUPADA' | 'RESERVADA' | 'ESPERANDO_CUENTA' | 'LIMPIEZA'

export const TABLE_STATUS_CONFIG: Record<
  TableStatus,
  { label: string; badgeClasses: string }
> = {
  LIBRE: {
    label: 'Libre',
    badgeClasses: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  },
  OCUPADA: {
    label: 'Ocupada',
    badgeClasses: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  },
  RESERVADA: {
    label: 'Reservada',
    badgeClasses: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  },
  ESPERANDO_CUENTA: {
    label: 'Esperando cuenta',
    badgeClasses: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  LIMPIEZA: {
    label: 'Limpieza',
    badgeClasses: 'bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-200',
  },
}

// === ORDER ITEM STATUS ===
export type OrderItemStatus =
  | 'PENDIENTE'
  | 'EN_PREPARACION'
  | 'LISTO'
  | 'DESPACHADO'
  | 'SERVIDO'
  | 'CANCELADO'

export const ORDER_ITEM_STATUS_CONFIG: Record<
  OrderItemStatus,
  { label: string; badgeClasses: string }
> = {
  PENDIENTE: {
    label: 'Pendiente',
    badgeClasses: 'bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-200',
  },
  EN_PREPARACION: {
    label: 'Preparando',
    badgeClasses: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  },
  LISTO: {
    label: 'Listo',
    badgeClasses: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  },
  DESPACHADO: {
    label: 'Despachado',
    badgeClasses: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  },
  SERVIDO: {
    label: 'Servido',
    badgeClasses: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  },
  CANCELADO: {
    label: 'Cancelado',
    badgeClasses: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  },
}

// === PAYMENT STATUS ===
export type PaymentStatus = 'PENDIENTE' | 'PARCIAL' | 'PAGADO'

export const PAYMENT_STATUS_CONFIG: Record<
  PaymentStatus,
  { label: string; badgeClasses: string }
> = {
  PENDIENTE: {
    label: 'Pendiente',
    badgeClasses: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  },
  PARCIAL: {
    label: 'Parcial',
    badgeClasses: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  PAGADO: {
    label: 'Pagado',
    badgeClasses: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  },
}

// === USER ACTIVE STATUS ===
export const USER_STATUS_CONFIG = {
  active: {
    label: 'Activo',
    badgeClasses: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  },
  inactive: {
    label: 'Inactivo',
    badgeClasses: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  },
} as const

// === CIERRE DIARIO STATUS ===
// FE-035 (FRONTEND-10): estados específicos de cierre diario.
export type CierreDiarioStatus = 'ABIERTO' | 'EN_PROCESO' | 'CERRADO' | 'BLOQUEADO'

export const CIERRE_DIARIO_STATUS_CONFIG: Record<
  CierreDiarioStatus,
  { label: string; badgeClasses: string }
> = {
  ABIERTO: {
    label: 'Abierto',
    badgeClasses: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  },
  EN_PROCESO: {
    label: 'En proceso',
    badgeClasses: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  },
  CERRADO: {
    label: 'Cerrado',
    badgeClasses: 'bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-200',
  },
  BLOQUEADO: {
    label: 'Bloqueado',
    badgeClasses: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  },
}

export function getCierreDiarioStatusConfig(status: string): {
  label: string
  badgeClasses: string
} {
  return (
    CIERRE_DIARIO_STATUS_CONFIG[status as CierreDiarioStatus] ?? {
      label: status,
      badgeClasses: 'bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-200',
    }
  )
}

// === HELPERS ===

/**
 * Devuelve la configuración de un status de orden de forma segura.
 * Si el status no existe en el mapa, devuelve un fallback genérico.
 */
export function getOrderStatusConfig(status: string): {
  label: string
  badgeClasses: string
  dotColor: string
} {
  return (
    ORDER_STATUS_CONFIG[status as OrderStatus] ?? {
      label: status,
      badgeClasses: 'bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-200',
      dotColor: 'bg-stone-400',
    }
  )
}

/**
 * Devuelve la configuración de un status de mesa de forma segura.
 */
export function getTableStatusConfig(status: string): {
  label: string
  badgeClasses: string
} {
  return (
    TABLE_STATUS_CONFIG[status as TableStatus] ?? {
      label: status,
      badgeClasses: 'bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-200',
    }
  )
}

/**
 * Devuelve la configuración de un status de item de orden de forma segura.
 */
export function getOrderItemStatusConfig(status: string): {
  label: string
  badgeClasses: string
} {
  return (
    ORDER_ITEM_STATUS_CONFIG[status as OrderItemStatus] ?? {
      label: status,
      badgeClasses: 'bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-200',
    }
  )
}

/**
 * Devuelve la configuración de un status de pago de forma segura.
 */
export function getPaymentStatusConfig(status: string): {
  label: string
  badgeClasses: string
} {
  return (
    PAYMENT_STATUS_CONFIG[status as PaymentStatus] ?? {
      label: status,
      badgeClasses: 'bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-200',
    }
  )
}
