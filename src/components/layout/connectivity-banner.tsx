// src/components/layout/connectivity-banner.tsx
// v1.0.20-FRONTEND-02A (fix #2): banner visible de conectividad.
//
// Problema que resuelve:
// - FRONTEND-01 cerró la creación de useConnectivity hook pero no lo integró.
// - Sin un banner visible, el usuario no sabe si el servidor local está caído
//   hasta que hace una mutación que falla con 503.
// - El plan exige que "Un fallo de conexión debe mostrar 'Servidor local no
//   disponible'" (sección 4).
//
// Implementación:
// - Componente pasivo que lee useConnectivity() y muestra un banner amarillo
//   cuando el servidor local no responde.
// - En LOCAL_SERVER_AVAILABLE: no renderiza nada (oculto).
// - En LOCAL_SERVER_UNREACHABLE / RECONNECTING: banner amarillo con mensaje.
// - En NO_NETWORK: banner rojo "Sin red".
// - En INITIALIZING: oculto (no molestar al usuario al arrancar).

'use client'

import { useConnectivity } from '@/hooks/use-connectivity'

export function ConnectivityBanner() {
  const { state, message, lastSuccessAt, refresh } = useConnectivity({
    intervalMs: 30_000,
    enabled: true,
  })

  // En INITIALIZING o LOCAL_SERVER_AVAILABLE: no mostrar nada.
  if (state === 'INITIALIZING' || state === 'LOCAL_SERVER_AVAILABLE') {
    return null
  }

  // En NO_NETWORK: banner rojo.
  if (state === 'NO_NETWORK') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="bg-red-600 text-white text-xs sm:text-sm px-4 py-2 text-center"
      >
        <span className="font-semibold">Sin red.</span> {message}
      </div>
    )
  }

  // En LOCAL_SERVER_UNREACHABLE o RECONNECTING: banner amarillo.
  const isReconnecting = state === 'RECONNECTING'
  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-amber-500 text-amber-950 text-xs sm:text-sm px-4 py-2 flex items-center justify-between gap-2"
    >
      <span>
        <span className="font-semibold">
          {isReconnecting ? 'Reintentando…' : 'Servidor local no disponible.'}
        </span>{' '}
        {message}
        {lastSuccessAt > 0 && (
          <span className="opacity-70 ml-2">
            (última conexión: {new Date(lastSuccessAt).toLocaleTimeString('es-CU')})
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={refresh}
        className="shrink-0 underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-950 rounded"
        aria-label="Reintentar conexión ahora"
      >
        Reintentar
      </button>
    </div>
  )
}
