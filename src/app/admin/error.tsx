// src/app/admin/error.tsx
// v1.0.20-rc-final: Error boundary para /admin/*
// Captura errores no controlados y muestra UI de recuperación en vez de
// pantalla en blanco.

'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

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
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
      <AlertTriangle className="h-12 w-12 text-amber-500" />
      <div>
        <h2 className="text-xl font-semibold">Algo salió mal</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Se produjo un error al cargar esta sección. Puedes intentar de nuevo
          o recargar la página completa.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground mt-2 font-mono">
            ID: {error.digest}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button onClick={reset} variant="default">
          Reintentar
        </Button>
        <Button
          onClick={() => window.location.reload()}
          variant="outline"
        >
          Recargar página
        </Button>
      </div>
    </div>
  )
}
