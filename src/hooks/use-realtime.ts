'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

// ============================================================
// Hook useRealtime - Maneja conexión Socket.IO (segura)
// ============================================================
// - En lugar de enviar userId/role (que el cliente podría falsificar),
//   envía el token de sesión (cookie rc_session) firmado por HMAC.
// - El mini-servicio realtime verifica el token con la misma función
//   que el middleware de Next.js y extrae userId/role del token.
// - No confiamos en datos de identidad enviados por el cliente.
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

const SESSION_COOKIE = 'rc_session'

/**
 * Lee el valor de una cookie por su nombre en el navegador.
 */
function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
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

  const connect = useCallback(() => {
    // Seguimos requiriendo userId/role para saber cuándo intentar conectar,
    // pero NO se envían al servidor para autenticación; el servidor extrae
    // esos datos del token firmado.
    if (!opts.userId || !opts.role) return
    if (socketRef.current?.connected) return

    const token = readCookie(SESSION_COOKIE)
    if (!token) {
      console.warn('[realtime] No se encontró cookie rc_session; no se conecta')
      return
    }

    const socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    })

    socket.on('connect', () => {
      console.log('[realtime] conectado:', socket.id)
      setConnected(true)
      // Enviar el token firmado en lugar de userId/role.
      // El servidor valida el token y extrae identidad del mismo.
      socket.emit('auth', { token, areaId: opts.areaId })
    })

    socket.on('disconnect', () => {
      console.log('[realtime] desconectado')
      setConnected(false)
    })

    socket.on('connect_error', (err) => {
      console.error('[realtime] error conexión:', err.message)
      setConnected(false)
    })

    socket.on('auth:fail', (data: any) => {
      console.warn('[realtime] auth fallida:', data?.message || 'token inválido')
      setConnected(false)
      // Desconectar si el token fue rechazado para no reintentar con token caducado
      socket.disconnect()
    })

    // Eventos de negocio
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

  // Funciones para emitir eventos
  const emit = useCallback((event: string, data: any) => {
    socketRef.current?.emit(event, data)
  }, [])

  return {
    connected,
    emit,
    reconnect: connect,
  }
}
