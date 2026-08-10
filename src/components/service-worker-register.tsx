'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('[SW] Service Worker registrado:', registration.scope)
        })
        .catch((err) => {
          console.warn('[SW] Error registrando Service Worker:', err)
        })
    }
  }, [])

  return null
}
