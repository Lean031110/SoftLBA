'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

// ============================================================
// Hook useRealtime — Conexión Socket.IO segura
// ============================================================
// v1.0.19.2 (FASE 22):
//   - NO lee document.cookie (la cookie rc_session es HttpOnly).
//   - Obtiene el token desde /api/auth/socket-token (server-side).
//   - El token se envía en handshake.auth.token.
//   - El frontend SOLO ESCUCHA eventos. NO emite eventos de negocio.
//   - El servidor deriva userId/role/áreas del token, NO del cliente.
// ============================================================

export type NotificationData = {
  type?: string
  title: string
  message: string
  orderId?: string
  status?: string
  amount?: number
  data?: any
}

// Cache en memoria del token de socket
interface CachedToken {
  token: string
  expiresAt: number
}
let tokenCache: CachedToken | null = null

async function fetchSocketToken(): Promise<string | null> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token
  }
  try {
    const res = await fetch('/api/auth/socket-token', { credentials: 'same-origin' })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.ok || !data.token) return null
    tokenCache = { token: data.token, expiresAt: data.expiresAt }
    return data.token as string
  } catch (e) {
    console.error('[realtime] Error fetching socket token:', e)
    return null
  }
}

export function useRealtime(opts: {
  userId?: string
  role?: string
  areaId?: string
  onNotification?: (n: NotificationData) => void
  onOrderNew?: (data: any) => void
  onOrderStatus?: (data: any) => void
  onOrderReady?: (data: any) => void
  onPaymentDone?: (data: any) => void
  onStockLow?: (data: any) => void
  onDailyClose?: (data: any) => void
}) {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const handlersRef = useRef(opts)
  useEffect(() => {
    handlersRef.current = opts
  })

  const connect = useCallback(async () => {
    if (!opts.userId || !opts.role) return
    if (socketRef.current?.connected) return

    // Obtener token desde endpoint server-side (cookie HttpOnly)
    const token = await fetchSocketToken()
    if (!token) {
      console.warn('[realtime] No se pudo obtener token de socket')
      return
    }

    const realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_URL || ''
    const socket = io(realtimeUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      // Token en handshake.auth — el servidor deriva identidad del token
      auth: { token },
    })

    socket.on('connect', () => {
      setConnected(true)
    })

    socket.on('disconnect', () => {
      setConnected(false)
    })

    socket.on('connect_error', (err) => {
      console.error('[realtime] error conexión:', err.message)
      setConnected(false)
    })

    socket.on('auth:fail', (data: any) => {
      console.warn('[realtime] auth fallida:', data?.message)
      setConnected(false)
      tokenCache = null
      socket.disconnect()
    })

    // Eventos de negocio (SOLO ESCUCHA — el servidor emite)
    socket.on('notification', (data: NotificationData) => {
      handlersRef.current.onNotification?.(data)
    })
    socket.on('order:new', (data: any) => {
      handlersRef.current.onOrderNew?.(data)
    })
    socket.on('order:status', (data: any) => {
      handlersRef.current.onOrderStatus?.(data)
    })
    socket.on('order:ready', (data: any) => {
      handlersRef.current.onOrderReady?.(data)
    })
    socket.on('payment:done', (data: any) => {
      handlersRef.current.onPaymentDone?.(data)
    })
    socket.on('stock:low', (data: any) => {
      handlersRef.current.onStockLow?.(data)
    })
    socket.on('daily-close', (data: any) => {
      handlersRef.current.onDailyClose?.(data)
    })

    socketRef.current = socket
  }, [opts.userId, opts.role, opts.areaId])

  useEffect(() => {
    connect()
    return () => {
      socketRef.current?.disconnect()
      socketRef.current = null
    }
  }, [connect])

  // NO se expone emit() — el frontend solo RECIBE
  return {
    connected,
    reconnect: connect,
  }
}
