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
//
// v1.0.20-FRONTEND-12 (FE-039/040/041):
//   - connectionState con 5 estados: connecting/connected/disconnected/
//     reconnecting/auth_failed (plan sección 20).
//   - auth:fail ahora limpia tokenCache + reintenta connect() después de 2s.
//   - reconnectionAttempts: Infinity (antes 10) — el usuario nunca pierde
//     el intento de reconectar automáticamente.
//   - reconnectionDelayMax: 10s (antes ilimitado) para no saturar el server.
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

// FE-039: 5 estados de conexión visibles para el usuario.
export type ConnectionState =
  | 'connecting'    // Conectando por primera vez
  | 'connected'     // Conexión activa
  | 'disconnected'  // Sin conexión (timeout o error de red)
  | 'reconnecting'  // Reintentando tras caída
  | 'auth_failed'   // Token inválido o expirado

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
  // FE-039: estado de conexión con 5 valores legibles.
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting')
  const handlersRef = useRef(opts)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Ref para auto-referencia en auth:fail handler (evita lint error).
  const connectRef = useRef<() => Promise<void>>(async () => {})
  useEffect(() => {
    handlersRef.current = opts
  })

  const connect = useCallback(async () => {
    if (!opts.userId || !opts.role) return
    if (socketRef.current?.connected) return

    // FE-039: no llamar setConnectionState sincrónicamente en el effect
    // (lint react-hooks/set-state-in-effect). El estado se actualiza
    // en los callbacks del socket (connect, disconnect, etc.).

    // Obtener token desde endpoint server-side (cookie HttpOnly)
    const token = await fetchSocketToken()
    if (!token) {
      console.warn('[realtime] No se pudo obtener token de socket')
      setConnectionState('auth_failed')
      return
    }

    const realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_URL || ''
    const socket = io(realtimeUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      // FE-041: Infinity en vez de 10 — el socket SIEMPRE reintenta.
      // Si el servidor cae y vuelve, la reconexión es automática.
      reconnectionAttempts: Infinity,
      // Token en handshake.auth — el servidor deriva identidad del token
      auth: { token },
    })

    socket.on('connect', () => {
      setConnected(true)
      setConnectionState('connected')
    })

    socket.on('disconnect', (reason) => {
      setConnected(false)
      // Si el servidor cerró la conexión (io server disconnect),
      // Socket.IO NO reintenta automáticamente. Hay que forzar reconnect.
      if (reason === 'io server disconnect') {
        setConnectionState('reconnecting')
        socket.connect()
      } else {
        setConnectionState('reconnecting')
      }
    })

    socket.on('connect_error', (err) => {
      console.error('[realtime] error conexión:', err.message)
      setConnected(false)
      setConnectionState('reconnecting')
    })

    socket.io.on('reconnect_attempt', (attempt) => {
      setConnectionState('reconnecting')
    })

    socket.io.on('reconnect_failed', () => {
      // Con Infinity attempts esto no debería pasar, pero por seguridad:
      setConnectionState('disconnected')
    })

    socket.on('auth:fail', (data: any) => {
      console.warn('[realtime] auth fallida:', data?.message)
      setConnected(false)
      setConnectionState('auth_failed')
      // Limpiar token cacheado — el próximo intento obtendrá uno nuevo.
      tokenCache = null
      socket.disconnect()

      // FE-040: reintentar automáticamente después de 2s.
      // Antes: desconexión permanente hasta refresh de página.
      // Ahora: el usuario recupera conexión sin acción manual.
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = setTimeout(() => {
        console.log('[realtime] Reintentando conexión tras auth:fail...')
        connectRef.current()
      }, 2000)
    })

    // FASE 8: auth:kick — el servidor nos desconecta por cambio de
    // contraseña/rol/permisos. Limpiar token cacheado y reconectar
    // con un token nuevo (que tendrá el authVersion actualizado).
    socket.on('auth:kick', (data: any) => {
      console.warn('[realtime] auth:kick recibido:', data?.reason)
      tokenCache = null
      setConnected(false)
      setConnectionState('auth_failed')
      // Reintentar tras 3s para obtener un token nuevo con authVersion correcto.
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = setTimeout(() => {
        console.log('[realtime] Reintentando conexión tras auth:kick...')
        connectRef.current()
      }, 3000)
    })

    // FASE 8: auth:expired — token expirado por tiempo. Reconectar.
    socket.on('auth:expired', (data: any) => {
      console.warn('[realtime] auth:expired:', data?.reason)
      tokenCache = null
      socket.disconnect()
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = setTimeout(() => {
        connectRef.current()
      }, 1500)
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

  // FE-040: mantener connectRef actualizado para auto-referencia en auth:fail.
  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  useEffect(() => {
    // Llamar connect() en microtask para evitar lint set-state-in-effect.
    // connect() hace setConnectionState() que dispara la regla.
    Promise.resolve().then(() => connect())
    return () => {
      socketRef.current?.disconnect()
      socketRef.current = null
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
    }
  }, [connect])

  // NO se expone emit() — el frontend solo RECIBE
  return {
    connected,
    connectionState,
    reconnect: connect,
  }
}
