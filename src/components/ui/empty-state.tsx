// src/components/ui/empty-state.tsx
// v1.0.20-FRONTEND-03: Empty state reutilizable.
//
// Problema que resuelve:
// - 25+ empty states inline con `p-8 text-center text-sm text-stone-500`.
// - Cada página reimplementaba icono + título + descripción + acción.
// - Inconsistencia: algunas decían "No hay usuarios", otras "No se encontraron
//   resultados", otras "Lista vacía".
//
// Solución:
// - Un componente con props tipadas: icon, title, description, action.
// - Estilo consistente: padding generoso, color muted-foreground, icono opcional.
// - Acción opcional (botón "Crear" o "Reintentar").

import * as React from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Icono lucide a mostrar arriba. */
  icon?: React.ReactNode
  /** Título corto, ej: "No hay usuarios". */
  title: string
  /** Descripción opcional, ej: "Crea el primer usuario con el botón de arriba." */
  description?: string
  /** Acción opcional, ej: botón "Crear" o "Reintentar". */
  action?: React.ReactNode
  /** Compactar padding. Por defecto `p-10`, con `compact` es `p-6`. */
  compact?: boolean
}

/**
 * Empty state consistente para listas vacías o sin resultados.
 *
 * @example
 * <EmptyState
 *   icon={<Users className="h-8 w-8" />}
 *   title="No hay usuarios"
 *   description="Crea el primer usuario con el botón de arriba."
 * />
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'p-6' : 'p-10',
        className,
      )}
      {...props}
    >
      {icon && (
        <div className="mb-3 text-stone-400 dark:text-stone-500" aria-hidden="true">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-stone-600 dark:text-stone-300">{title}</p>
      {description && (
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
