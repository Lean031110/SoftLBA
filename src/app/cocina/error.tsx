// src/app/cocina/error.tsx
'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function CocinaError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[cocina/error]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
      <AlertTriangle className="h-12 w-12 text-amber-500" />
      <div>
        <h2 className="text-xl font-semibold">Error en panel de Cocina</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Se perdió la conexión con la cocina. Reintenta o recarga la página.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground mt-2 font-mono">
            ID: {error.digest}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button onClick={reset}>Reintentar</Button>
        <Button onClick={() => window.location.reload()} variant="outline">
          Recargar
        </Button>
      </div>
    </div>
  )
}
