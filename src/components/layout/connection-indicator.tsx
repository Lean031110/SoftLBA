// src/components/layout/connection-indicator.tsx
// FASE 7: Indicador de conexión HTTP + Realtime en la barra del POS.
//
// Muestra:
//   Servidor:  🟢 24ms    (latencia HTTP a /api/health)
//   Realtime:  🟢 conectado   (estado del socket Socket.IO)
//
// Estados:
//   🟢 <100ms     → excelente
//   🟢 <300ms     → bueno
//   🟡 300-1000ms → lento
//   🔴 >1000ms    → muy lento
//   🔴 Sin conexión / No responde
//
// Separado del Realtime indicator (que usa useRealtimeContext).

'use client'

import { useConnectivity } from '@/hooks/use-connectivity'
import { useRealtimeContext } from '@/components/realtime/realtime-provider'

function latencyColor(ms: number | null, reachable: boolean): string {
  if (!reachable || ms === null) return 'bg-red-500'
  if (ms < 100) return 'bg-emerald-500'
  if (ms < 300) return 'bg-emerald-500'
  if (ms < 1000) return 'bg-amber-500'
  return 'bg-red-500'
}

function latencyLabel(ms: number | null, reachable: boolean): string {
  if (!reachable || ms === null) return 'Sin conexión'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function realtimeColor(state: string | undefined): string {
  if (state === 'connected') return 'bg-emerald-500'
  if (state === 'reconnecting' || state === 'connecting') return 'bg-amber-500 animate-pulse'
  return 'bg-red-500'
}

function realtimeLabel(state: string | undefined): string {
  if (state === 'connected') return 'conectado'
  if (state === 'reconnecting') return 'reconectando…'
  if (state === 'connecting') return 'conectando…'
  if (state === 'auth_failed') return 'auth fallida'
  if (state === 'disconnected') return 'desconectado'
  return 'desconectado'
}

export function ConnectionIndicator() {
  const { state, latencyMs, serverReachable } = useConnectivity({ intervalMs: 30_000, enabled: true })
  const realtime = useRealtimeContext()
  const rtState = realtime?.connectionState

  // Indicador HTTP
  const httpColor = latencyColor(latencyMs, serverReachable)
  const httpLabel = latencyLabel(latencyMs, serverReachable)

  // Indicador Realtime
  const rtColor = realtimeColor(rtState)
  const rtLabel = realtimeLabel(rtState)

  return (
    <div
      className="flex items-center gap-3 text-xs"
      role="status"
      aria-live="polite"
      aria-label={`Servidor: ${httpLabel}, Realtime: ${rtLabel}`}
    >
      <div className="flex items-center gap-1.5" title={`Servidor: ${httpLabel}`}>
        <span className={`inline-block w-2 h-2 rounded-full ${httpColor}`} aria-hidden />
        <span className="text-muted-foreground hidden sm:inline">Servidor:</span>
        <span className="font-mono font-medium tabular-nums">{httpLabel}</span>
      </div>
      <div className="w-px h-3 bg-border" aria-hidden />
      <div className="flex items-center gap-1.5" title={`Realtime: ${rtLabel}`}>
        <span className={`inline-block w-2 h-2 rounded-full ${rtColor}`} aria-hidden />
        <span className="text-muted-foreground hidden sm:inline">Realtime:</span>
        <span className="font-medium">{rtLabel}</span>
      </div>
    </div>
  )
}
