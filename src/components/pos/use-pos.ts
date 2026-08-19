// src/components/pos/use-pos.ts
// Hook central del POS de Salón (Fase 3).
//
// Mantiene:
// - Mesa seleccionada.
// - Carrito (líneas independientes por notas/modificadores distintos).
// - Cliente opcional.
// - Comentario opcional.
// - Descuento opcional (controlado por permiso).
// - Estado de envío (loading, error, success, timeout).
// - idempotencyKey persistida por intento (reutilizada en reintentos).
//
// Reglas:
// - Una sola fuente de verdad para el carrito (no duplicar).
// - El carrito se persiste en localStorage con TTL 1h (FASE 13 plan anterior).
// - El idempotencyKey se reutiliza en reintentos hasta éxito.
// - El botón ENVIAR usa AbortController con timeout 30s.

'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

// === Tipos ===

export interface POSProduct {
  id: string
  code: string
  name: string
  price: number
  type: 'DIRECTO' | 'FINAL' | 'SUBPRODUCTO'
  unit: string
  areaStock?: number | null
  isAvailable: boolean
  category?: string | null
  imageUrl?: string | null
}

export interface POSArea {
  id: string
  code: string
  name: string
}

export interface POSTable {
  id: string
  code: string
  name: string
  status: string // LIBRE | OCUPADA | RESERVADA | ESPERANDO_CUENTA | LIMPIEZA
  capacity: number
  currentOrderId?: string | null
}

export interface POSCartLine {
  /** ID único de la línea (no del producto — permite múltiples líneas del mismo producto con notas distintas). */
  lineId: string
  product: POSProduct
  quantity: number
  notes: string
}

export interface POSCart {
  lines: POSCartLine[]
  customerName: string
  generalComment: string
  discountPct: number
}

export type SendState = 'idle' | 'sending' | 'success' | 'error' | 'timeout'

// === Constantes ===

const SEND_TIMEOUT_MS = 30_000
const CART_STORAGE_KEY = 'softlba:pos-cart'
const CART_TTL_MS = 60 * 60 * 1000 // 1 hora

// === Helper fuera del hook (no depende de estado React) ===

function loadCartFromStorage(): POSCart {
  if (typeof window === 'undefined') {
    return { lines: [], customerName: '', generalComment: '', discountPct: 0 }
  }
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY)
    if (!raw) return { lines: [], customerName: '', generalComment: '', discountPct: 0 }
    const parsed = JSON.parse(raw)
    if (parsed?.savedAt && Date.now() - parsed.savedAt > CART_TTL_MS) {
      localStorage.removeItem(CART_STORAGE_KEY)
      return { lines: [], customerName: '', generalComment: '', discountPct: 0 }
    }
    return parsed?.cart || { lines: [], customerName: '', generalComment: '', discountPct: 0 }
  } catch {
    return { lines: [], customerName: '', generalComment: '', discountPct: 0 }
  }
}

// === Hook ===

export function usePOS(opts: {
  areaId: string | null
  canDiscount: boolean
  onAfterSend?: (orderId: string, orderNumber: number, allDirecto: boolean) => void
} = { areaId: null, canDiscount: false }) {
  const router = useRouter()
  const [areaId] = useState(opts.areaId)
  const [selectedTable, setSelectedTable] = useState<POSTable | null>(null)
  const [cart, setCart] = useState<POSCart>(() => loadCartFromStorage())
  const [sendState, setSendState] = useState<SendState>('idle')
  const [lastOrderId, setLastOrderId] = useState<string | null>(null)
  const [lastOrderNumber, setLastOrderNumber] = useState<number | null>(null)

  const pendingIdempotencyKeyRef = useRef<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Persistir carrito en localStorage (con TTL).
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const payload = {
        cart,
        selectedTableId: selectedTable?.id || null,
        savedAt: Date.now(),
      }
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // localStorage puede fallar en navegadores privados — no romper.
    }
  }, [cart, selectedTable])

  // Limpiar carrito del storage si es muy viejo.
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed?.savedAt && Date.now() - parsed.savedAt > CART_TTL_MS) {
        localStorage.removeItem(CART_STORAGE_KEY)
        // No llamamos setCart aquí para evitar set-state-in-effect.
        // El carrito caducado se limpiará en el próximo loadCartFromStorage
        // (que ya verifica TTL al cargar).
      }
    } catch {
      /* ignore */
    }
  }, [])

  // === Acciones del carrito ===

  const addToCart = useCallback((product: POSProduct, notes = '') => {
    setCart((prev) => {
      // Si ya existe una línea del mismo producto CON LAS MISMAS NOTAS, sumar cantidad.
      // Si las notas son distintas, crear línea nueva (líneas independientes).
      const existingIdx = prev.lines.findIndex(
        (l) => l.product.id === product.id && (l.notes || '') === (notes || ''),
      )
      if (existingIdx >= 0) {
        const newLines = [...prev.lines]
        newLines[existingIdx] = {
          ...newLines[existingIdx],
          quantity: newLines[existingIdx].quantity + 1,
        }
        return { ...prev, lines: newLines }
      }
      const newLine: POSCartLine = {
        lineId: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        product,
        quantity: 1,
        notes,
      }
      return { ...prev, lines: [...prev.lines, newLine] }
    })
  }, [])

  const updateQuantity = useCallback((lineId: string, delta: number) => {
    setCart((prev) => {
      const newLines = prev.lines
        .map((l) =>
          l.lineId === lineId ? { ...l, quantity: Math.max(0, l.quantity + delta) } : l,
        )
        .filter((l) => l.quantity > 0)
      return { ...prev, lines: newLines }
    })
  }, [])

  const setLineNotes = useCallback((lineId: string, notes: string) => {
    setCart((prev) => ({
      ...prev,
      lines: prev.lines.map((l) => (l.lineId === lineId ? { ...l, notes } : l)),
    }))
  }, [])

  const removeLine = useCallback((lineId: string) => {
    setCart((prev) => ({
      ...prev,
      lines: prev.lines.filter((l) => l.lineId !== lineId),
    }))
  }, [])

  const clearCart = useCallback(() => {
    setCart({ lines: [], customerName: '', generalComment: '', discountPct: 0 })
    pendingIdempotencyKeyRef.current = null
  }, [])

  const setCustomerName = useCallback((name: string) => {
    setCart((prev) => ({ ...prev, customerName: name }))
  }, [])

  const setGeneralComment = useCallback((comment: string) => {
    setCart((prev) => ({ ...prev, generalComment: comment }))
  }, [])

  const setDiscountPct = useCallback(
    (pct: number) => {
      if (!opts.canDiscount && pct > 0) {
        toast.error('No tienes permiso para aplicar descuentos')
        return
      }
      setCart((prev) => ({ ...prev, discountPct: Math.max(0, Math.min(100, pct)) }))
    },
    [opts.canDiscount],
  )

  // === Envío del pedido ===

  // Ref para romper la recursión en toast onClick (eslint react-hooks v5).
  const sendOrderRef = useRef<(sendToKitchen: boolean) => Promise<void>>(async () => {})

  const totalUnits = useMemo(() => cart.lines.reduce((s, l) => s + l.quantity, 0), [cart.lines])
  const subtotal = useMemo(
    () => cart.lines.reduce((s, l) => s + l.product.price * l.quantity, 0),
    [cart.lines],
  )
  const discountAmount = useMemo(() => +(subtotal * (cart.discountPct / 100)).toFixed(2), [subtotal, cart.discountPct])
  const total = useMemo(() => +(subtotal - discountAmount).toFixed(2), [subtotal, discountAmount])
  const allDirecto = useMemo(
    () => cart.lines.length > 0 && cart.lines.every((l) => l.product.type === 'DIRECTO'),
    [cart.lines],
  )

  const sendOrder = useCallback(
    async (sendToKitchen: boolean) => {
      if (cart.lines.length === 0) {
        toast.error('Agrega al menos un producto')
        return
      }
      if (!selectedTable) {
        toast.error('Selecciona una mesa')
        return
      }
      if (!areaId) {
        toast.error('No hay área de SALON configurada')
        return
      }

      setSendState('sending')

      // Generar idempotencyKey (reutilizar si hay intento pendiente).
      if (!pendingIdempotencyKeyRef.current) {
        pendingIdempotencyKeyRef.current =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `key-${Date.now()}-${Math.random().toString(36).slice(2)}`
      }
      const idempotencyKey = pendingIdempotencyKeyRef.current

      const body = {
        areaId,
        tableId: selectedTable.id,
        items: cart.lines.map((l) => ({
          productId: l.product.id,
          quantity: l.quantity,
          notes: l.notes || undefined,
        })),
        customerName: cart.customerName || undefined,
        notes: cart.generalComment || undefined,
        discountPct: cart.discountPct,
        sendToKitchen,
        idempotencyKey,
      }

      // AbortController con timeout 30s.
      if (abortControllerRef.current) abortControllerRef.current.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller
      const timeoutId = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS)

      try {
        const res = await fetch('/api/mesero/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        const data = await res.json()

        if (data.ok) {
          const orderId = data.item.id
          const orderNumber = data.item.number
          const idempotent = data.idempotent === true

          // Limpiar idempotencyKey solo tras éxito.
          pendingIdempotencyKeyRef.current = null
          setLastOrderId(orderId)
          setLastOrderNumber(orderNumber)
          setSendState('success')

          toast.success(`Pedido #${orderNumber} creado${idempotent ? ' (recuperado)' : ''}`, {
            description: sendToKitchen ? 'Enviado a cocina' : 'Guardado',
          })

          // Limpiar carrito.
          setCart({ lines: [], customerName: '', generalComment: '', discountPct: 0 })

          // Callback para que la UI decida qué hacer (cobrar si allDirecto, etc.).
          opts.onAfterSend?.(orderId, orderNumber, allDirecto)
        } else {
          setSendState('error')
          toast.error(data.error || 'Error al crear pedido')
        }
      } catch (err: any) {
        clearTimeout(timeoutId)
        if (err?.name === 'AbortError') {
          setSendState('timeout')
          toast.error('El servidor no respondió en 30s', {
            description: 'Reintenta (no se duplicará el pedido) o cancela.',
            duration: 12000,
            action: {
              label: 'Reintentar',
              onClick: () => sendOrderRef.current(sendToKitchen),
            },
          })
        } else {
          setSendState('error')
          toast.error('Error de conexión', {
            description: 'Reintenta. No se duplicará el pedido.',
            action: {
              label: 'Reintentar',
              onClick: () => sendOrderRef.current(sendToKitchen),
            },
          })
        }
      }
    },
    [cart, selectedTable, areaId, allDirecto, opts],
  )

  // Mantener el ref actualizado para que los toast onClick puedan llamarlo.
  useEffect(() => {
    sendOrderRef.current = sendOrder
  }, [sendOrder])

  const cancelSend = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    pendingIdempotencyKeyRef.current = null
    setSendState('idle')
    toast.info('Envío cancelado. El carrito se mantuvo.')
  }, [])

  return {
    // estado
    selectedTable,
    cart,
    sendState,
    lastOrderId,
    lastOrderNumber,
    // métricas
    totalUnits,
    subtotal,
    discountAmount,
    total,
    allDirecto,
    // acciones
    setSelectedTable,
    addToCart,
    updateQuantity,
    setLineNotes,
    removeLine,
    clearCart,
    setCustomerName,
    setGeneralComment,
    setDiscountPct,
    sendOrder,
    cancelSend,
  }
}
