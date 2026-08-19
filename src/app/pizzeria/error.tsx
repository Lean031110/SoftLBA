// src/app/pizzeria/error.tsx
// v1.0.20-FRONTEND-03: refactorizado para usar ErrorState (DRY).

'use client'

import { useEffect } from 'react'
import { ErrorState } from '@/components/ui/error-state'
import { Button } from '@/components/ui/button'

export default function PizzeriaError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[pizzeria/error]', error)
  }, [error])

  return (
    <ErrorState
      title="Error en panel de Pizzería"
      description="Se perdió la conexión con la pizzería. Reintenta o recarga la página."
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
