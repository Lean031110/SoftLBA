'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

// ============================================================
// Hook useRealtime - Maneja conexión Socket.IO
// ============================================================
// Conexión automática cuando hay usuario autenticado
// Reconexión automática en caso de desconexión
// Suscripción a eventos por canal
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
    if (!opts.userId || !opts.role) return
    if (socketRef.current?.connected) return

    const socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    })

    socket.on('connect', () => {
      console.log('[realtime] conectado:', socket.id)
      setConnected(true)
      socket.emit('auth', {
        userId: opts.userId,
        role: opts.role,
        areaId: opts.areaId,
      })
    })

    socket.on('disconnect', () => {
      console.log('[realtime] desconectado')
      setConnected(false)
    })

    socket.on('connect_error', (err) => {
      console.error('[realtime] error conexión:', err.message)
      setConnected(false)
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
