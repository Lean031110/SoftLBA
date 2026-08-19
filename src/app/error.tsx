// src/app/error.tsx
// v1.0.20-FRONTEND-03: refactorizado para usar ErrorState (DRY).

'use client'

import { useEffect } from 'react'
import { ErrorState } from '@/components/ui/error-state'
import { Button } from '@/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global/error]', error)
  }, [error])

  return (
    <ErrorState
      title="Error inesperado"
      description="Se produjo un error en la aplicación. Puedes reintentar o recargar la página completa."
      error={error}
      onRetry={reset}
      secondaryAction={
        <Button onClick={() => window.location.reload()} variant="outline">
          Recargar página
        </Button>
      }
    />
  )
}
