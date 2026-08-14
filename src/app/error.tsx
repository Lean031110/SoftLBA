// src/app/error.tsx
// v1.0.20-rc-final: Error boundary global — captura errores no controlados
// en cualquier parte de la app que no tenga su propio error.tsx.

'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

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
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-6 text-center">
      <AlertTriangle className="h-12 w-12 text-amber-500" />
      <div>
        <h2 className="text-xl font-semibold">Error inesperado</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Se produjo un error en la aplicación. Puedes reintentar o recargar
          la página completa.
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
          Recargar página
        </Button>
      </div>
    </div>
  )
}
