// src/app/admin/error.tsx
// v1.0.20-FRONTEND-03: refactorizado para usar ErrorState (DRY).
// v1.0.20-rc-final: Error boundary para /admin/*

'use client'

import { useEffect } from 'react'
import { ErrorState } from '@/components/ui/error-state'
import { Button } from '@/components/ui/button'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[admin/error]', error)
  }, [error])

  return (
    <ErrorState
      title="Error en sección Admin"
      description="No se pudo cargar esta sección. Reintenta o recarga la página completa."
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
