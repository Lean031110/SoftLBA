// src/hooks/use-connectivity.ts
// v1.0.20-FRONTEND-01 (FE-004): Hook de conectividad LAN vs Internet.
//
// Problema que resuelve:
// - SoftLBA trabaja dentro de una LAN. El usuario puede estar sin Internet
//   pero con el servidor local Perfectamente disponible.
// - Antes se usaba `navigator.onLine` (que solo detecta Internet) y por ende
//   mostraba "Estás offline" cuando en realidad SoftLBA seguía funcionando.
// - El plan exige distinguir 5 estados (sección 7):
//   ONLINE — Internet disponible (no es lo que determina si SoftLBA funciona)
//   LOCAL_SERVER_UNREACHABLE — No se puede alcanzar /api/health
//   RECONNECTING — Reintentando conexión al servidor local
//   LOCAL_SERVER_AVAILABLE — /api/health responde 200 ok=true
//   REALTIME_DISCONNECTED — Socket.IO desconectado (separado del LAN)
//
// Solución:
// - Pollear /api/health cada 30s (configurable).
// - Combinar con `navigator.onLine` para distinguir "no hay red" de "red pero
//   servidor caído".
// - Exponer un estado consolidado y legible para el frontend.
// - No depender solo de `navigator.onLine` para decidir si SoftLBA funciona.

'use client'

import { useEffect, useRef, useState } from 'react'

export type ConnectivityState =
  | 'INITIALIZING'         // Primer render, sin datos todavía
  | 'LOCAL_SERVER_AVAILABLE' // /api/health responde 200 ok=true
  | 'LOCAL_SERVER_UNREACHABLE' // /api/health no responde o responde error
  | 'RECONNECTING'          // Estuvo UNREACHABLE y estamos reintentando
  | 'NO_NETWORK'            // navigator.onLine === false (sin red)

export interface ConnectivityInfo {
  state: ConnectivityState
  /** true si /api/health respondió 200 ok=true en el último check. */
  serverReachable: boolean
  /** true si el navegador cree que hay Internet (navigator.onLine). */
  browserOnline: boolean
  /** Latencia del último check exitoso en ms. null si nunca. */
  latencyMs: number | null
  /** Timestamp del último check exitoso. 0 si nunca. */
  lastSuccessAt: number
  /** Timestamp del último check fallido. 0 si nunca. */
  lastFailureAt: number
  /** Mensaje legible para mostrar al usuario. */
  message: string
  /** Re-lanzar el check manualmente (botón "Reintentar"). */
  refresh: () => void
}

const DEFAULT_INTERVAL_MS = 30_000 // 30s
const RECONNECT_INTERVAL_MS = 5_000 // 5s cuando cae el servidor
const HEALTH_PATH = '/api/health'

function describe(state: ConnectivityState): string {
  switch (state) {
    case 'INITIALIZING':
      return 'Conectando con servidor local…'
    case 'LOCAL_SERVER_AVAILABLE':
      return 'Servidor local disponible'
    case 'LOCAL_SERVER_UNREACHABLE':
      return 'No se puede alcanzar el servidor local'
    case 'RECONNECTING':
      return 'Reintentando conexión con el servidor local…'
    case 'NO_NETWORK':
      return 'Sin red. Verifica tu conexión WiFi.'
  }
}

export function useConnectivity(opts: { intervalMs?: number; enabled?: boolean } = {}): ConnectivityInfo {
  const intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS
  const enabled = opts.enabled ?? true

  const [state, setState] = useState<ConnectivityState>('INITIALIZING')
  const [browserOnline, setBrowserOnline] = useState(true)
  const [latencyMs, setLatencyMs] = useState<number | null>(null)
  const [lastSuccessAt, setLastSuccessAt] = useState(0)
  const [lastFailureAt, setLastFailureAt] = useState(0)
  const [refreshTick, setRefreshTick] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const wasReachableRef = useRef(false)

  // Listener de navigator.onLine
  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return
    const updateOnline = () => setBrowserOnline(navigator.onLine)
    updateOnline()
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    return () => {
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
    }
  }, [])

  // Polling de /api/health
  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    async function check() {
      // Si no hay red (según navegador), no intentamos fetch.
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (!cancelled) {
          setState('NO_NETWORK')
          wasReachableRef.current = false
        }
        scheduleNext(intervalMs)
        return
      }

      // Abortar check anterior si existe
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const t0 = Date.now()
        const res = await fetch(HEALTH_PATH, {
          method: 'GET',
          signal: controller.signal,
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        })
        if (cancelled) return

        if (res.status === 200) {
          const data = await res.json().catch(() => null)
          if (data?.ok === true) {
            const latency = Date.now() - t0
            setLatencyMs(latency)
            setLastSuccessAt(Date.now())
            wasReachableRef.current = true
            setState('LOCAL_SERVER_AVAILABLE')
            scheduleNext(intervalMs)
            return
          }
        }
        // Respuesta no-200 o body inválido → servidor caído
        throw new Error(`health respondió ${res.status}`)
      } catch (err: unknown) {
        if (cancelled) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setLatencyMs(null)
        setLastFailureAt(Date.now())
        const wasReachable = wasReachableRef.current
        wasReachableRef.current = false
        setState(wasReachable ? 'RECONNECTING' : 'LOCAL_SERVER_UNREACHABLE')
        // Reintentar más rápido cuando el servidor está caído.
        scheduleNext(RECONNECT_INTERVAL_MS)
        return
      }
    }

    function scheduleNext(ms: number) {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        check()
      }, ms)
    }

    check()

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
      if (abortRef.current) abortRef.current.abort()
    }
  }, [enabled, intervalMs, refreshTick])

  const refresh = () => setRefreshTick((t) => t + 1)

  return {
    state,
    serverReachable: state === 'LOCAL_SERVER_AVAILABLE',
    browserOnline,
    latencyMs,
    lastSuccessAt,
    lastFailureAt,
    message: describe(state),
    refresh,
  }
}
