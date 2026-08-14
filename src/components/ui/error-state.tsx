// src/components/ui/error-state.tsx
// v1.0.20-FRONTEND-03: Error state reutilizable.
//
// Problema que resuelve:
// - Los `error.tsx` creados en FRONTEND-02A tenían HTML inline duplicado.
// - Las páginas mostraban errores con estilos inconsistentes.
//
// Solución:
// - Un componente con props tipadas: title, description, error, retryAction.
// - Estilo consistente: icono AlertTriangle, color amber, botones de acción.

import * as React from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Título corto, ej: "Algo salió mal". */
  title?: string
  /** Descripción del error, ej: "No se pudo cargar la lista de usuarios." */
  description?: string
  /** Error original para mostrar el mensaje (si está en dev mode). */
  error?: Error & { digest?: string }
  /** Callback al hacer click en "Reintentar". Si no se pasa, no se muestra el botón. */
  onRetry?: () => void
  /** Texto del botón de retry. Default: "Reintentar". */
  retryLabel?: string
  /** Acción secundaria opcional, ej: "Recargar página". */
  secondaryAction?: React.ReactNode
  /** Compactar padding. */
  compact?: boolean
}

/**
 * Error state consistente para fallos de carga o errores inesperados.
 *
 * @example
 * <ErrorState
 *   title="No se pudo cargar el pedido"
 *   description="Verifica tu conexión e inténtalo de nuevo."
 *   error={error}
 *   onRetry={() => load()}
 * />
 */
export function ErrorState({
  title = 'Algo salió mal',
  description = 'Se produjo un error. Puedes reintentar o recargar la página.',
  error,
  onRetry,
  retryLabel = 'Reintentar',
  secondaryAction,
  compact = false,
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center gap-4',
        compact ? 'p-4' : 'p-6',
        className,
      )}
      role="alert"
      {...props}
    >
      <AlertTriangle className="h-10 w-10 text-amber-500" aria-hidden="true" />
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">{description}</p>
        {error?.digest && (
          <p className="text-xs text-muted-foreground mt-2 font-mono">
            ID: {error.digest}
          </p>
        )}
        {error?.message && process.env.NODE_ENV !== 'production' && (
          <p className="text-xs text-red-600 mt-2 font-mono break-all">
            {error.message}
          </p>
        )}
      </div>
      {(onRetry || secondaryAction) && (
        <div className="flex gap-2 flex-wrap justify-center">
          {onRetry && (
            <Button onClick={onRetry} variant="default">
              {retryLabel}
            </Button>
          )}
          {secondaryAction}
        </div>
      )}
    </div>
  )
}
