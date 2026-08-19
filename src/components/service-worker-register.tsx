'use client'

// v1.0.20-rc-final: Escucha el mensaje SW_UPDATED del Service Worker y avisa
// al usuario que hay una nueva versión disponible (en vez de aplicar la
// actualización silenciosamente mid-pedido, lo que podía perder datos).

import { useEffect } from 'react'
import { toast } from 'sonner'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    // 1. Registrar el SW
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[SW] Service Worker registrado:', registration.scope)

        // Escuchar actualizaciones del SW
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Hay una nueva versión descargada, esperando para activarse
              toast.info('Nueva versión disponible', {
                description: 'Click para actualizar y recargar la página',
                duration: 10000,
                action: {
                  label: 'Actualizar',
                  onClick: () => {
                    newWorker.postMessage?.({ type: 'SKIP_WAITING' })
                    navigator.serviceWorker.addEventListener('controllerchange', () => {
                      window.location.reload()
                    })
                  },
                },
              })
            }
          })
        })
      })
      .catch((err) => {
        console.warn('[SW] Error registrando Service Worker:', err)
        // No mostrar toast en fallo — el SW es opt-in, no bloqueante
      })

    // 2. Escuchar mensaje SW_UPDATED enviado por sw.js post-activate
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATED' && event.data?.version) {
        toast.info('Aplicación actualizada', {
          description: `Versión ${event.data.version}. Recarga para aplicar cambios.`,
          duration: 8000,
          action: {
            label: 'Recargar',
            onClick: () => window.location.reload(),
          },
        })
      }
    }
    navigator.serviceWorker.addEventListener('message', handleMessage)

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage)
    }
  }, [])

  return null
}
