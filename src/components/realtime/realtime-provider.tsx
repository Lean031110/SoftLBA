// src/components/realtime/realtime-provider.tsx
// v1.0.20-rc-final: Proveedor singleton para la conexión Socket.IO.
//
// Problema que resuelve:
// - Antes, useRealtime() era llamado desde 5 componentes (KitchenDashboard,
//   NotificationBell, AdminDashboard, MeseroDashboard, PedidoDetalle).
// - Cada página montaba 2+ sockets (NotificationBell siempre en PanelLayout
//   + el componente de la página).
// - Cada socket hacía su propio /api/auth/socket-token + handshake.
//
// Solución:
// - Un solo socket a nivel de app, gestionado por este provider.
// - Los componentes consumen el socket vía useRealtimeContext().
// - Si el token expira, un solo reconnect en vez de 5.

'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useRealtime, NotificationData } from '@/hooks/use-realtime'

type RealtimeAPI = ReturnType<typeof useRealtime>

const RealtimeContext = createContext<RealtimeAPI | null>(null)

export function RealtimeProvider({
  children,
  userId,
  role,
  areaId,
}: {
  children: ReactNode
  userId?: string
  role?: string
  areaId?: string
}) {
  const api = useRealtime({ userId, role, areaId })
  return (
    <RealtimeContext.Provider value={api}>
      {children}
    </RealtimeContext.Provider>
  )
}

export function useRealtimeContext(): RealtimeAPI | null {
  return useContext(RealtimeContext)
}

export type { NotificationData }
