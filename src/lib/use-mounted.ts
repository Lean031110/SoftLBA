// src/lib/use-mounted.ts
// v1.0.20-FRONTEND-01 (FE-002): Hook "mounted" para hidratación segura.
//
// Problema que resuelve:
// - React 18 hidrata el HTML del servidor y luego re-renderiza en cliente.
// - Si el render del cliente depende de APIs solo-disponibles-en-cliente
//   (next-themes, navigator, WebSocket connected, etc.), el HTML difiere y
//   React lanza "Hydration failed because the server rendered text didn't
//   match the client".
//
// Solución: gate con `mounted` para que el primer render del cliente sea
// idéntico al del server, y solo después del mount mostrar el estado
// dependiente del navegador.
//
// Antes se usaba:
//   const [mounted, setMounted] = useState(false)
//   useEffect(() => setMounted(true), [])
//
// Eso dispara la regla lint `react-hooks/set-state-in-effect` porque
// set-state sincrónico en effect causa cascading renders.
//
// Patrón correcto con useSyncExternalStore (React 18+):
//   import { useMounted } from '@/lib/use-mounted'
//   const mounted = useMounted()
//
// `useSyncExternalStore` es la API idiomática para "leer estado de un sistema
// externo". En SSR devuelve `false` (server snapshot), en cliente devuelve
// `true` tras mount.

import { useSyncExternalStore } from 'react'

// Subscribe function: no nos suscribimos a nada (no hay cambios después del
// mount). React solo la usa para re-validar si el snapshot cambió.
function subscribe(callback: () => void): () => void {
  // No hay nada que escuchar — el snapshot es `true` después del mount.
  return () => {}
}

// Server snapshot: SIEMPRE `false` (no hay cliente en SSR).
function getServerSnapshot(): boolean {
  return false
}

// Client snapshot: SIEMPRE `true` (si esta función se llama, ya montamos).
function getClientSnapshot(): boolean {
  return true
}

/**
 * Hook que devuelve `true` solo después de que el componente monte en cliente.
 *
 * Uso típico:
 * ```tsx
 * const mounted = useMounted()
 * if (!mounted) return <Placeholder />
 * return <RealThingThatDependsOnClient />
 * ```
 *
 * El primer render del cliente devuelve `false` (igual que SSR) → no hay
 * hydration mismatch. Tras el primer commit, React re-renderiza y devuelve
 * `true`.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  )
}
