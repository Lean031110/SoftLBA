// src/app/mesero/error.tsx
// v1.0.20-FRONTEND-03: refactorizado para usar ErrorState (DRY).

'use client'

import { useEffect } from 'react'
import { ErrorState } from '@/components/ui/error-state'
import { Button } from '@/components/ui/button'

export default function MeseroError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[mesero/error]', error)
  }, [error])

  return (
    <ErrorState
      title="Error en sección Mesero"
      description="No se pudo cargar esta página. Reintenta o recarga la página completa."
      error={error}
      onRetry={reset}
      secondaryAction={
        <Button onClick={() => window.location.reload()} variant="outline">
          Recargar
        </Button>
      }
    />
  )
}
