'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { getIdempotencyManager, paymentsFingerprint } from '@/lib/idempotency'
import {
  ArrowLeft, Wallet, Printer, XCircle, RefreshCw, Plus, Trash2, Receipt, AlertTriangle, Clock,
} from 'lucide-react'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useRealtime } from '@/hooks/use-realtime'
import {
  STATUS_COLORS, STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_METHODS, formatCurrency, formatTime,
} from '@/lib/order-utils'
import { hasPermission } from '@/lib/permissions'

type OrderDetail = {
  id: string
  number: number
  status: string
  paymentStatus: string
  customerName: string | null
  subtotal: number
  discountPct: number
  discountAmount: number
  total: number
  notes: string | null
  createdAt: string
  closedAt: string | null
  area: { id: string; name: string; code: string }
  table: { id: string; name: string; code: string } | null
  user: { id: string; firstName: string | null; lastName: string | null; username: string }
  items: {
    id: string
    quantity: number
    unitPrice: number
    notes: string | null
    status: string
    product: { id: string; name: string; code: string; price: number; unit: string }
  }[]
  payments: {
    id: string
    method: string
    amount: number
    currency: string
    reference: string | null
    createdAt: string
    user: { id: string; firstName: string | null; lastName: string | null; username: string }
  }[]
  paidTotal: number
  pendingTotal: number
}

type PaymentForm = {
  method: string
  amount: string
  currency: string
  reference: string
}

export default function PedidoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { user } = useCurrentUser()
  const [orderId, setOrderId] = useState('')
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payOpen, setPayOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [payments, setPayments] = useState<PaymentForm[]>([
    { method: 'EFECTIVO_CUP', amount: '', currency: 'CUP', reference: '' },
  ])
  const [submitting, setSubmitting] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    params.then((p) => setOrderId(p.id))
  }, [params])

  const load = useCallback(async () => {
    if (!orderId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/mesero/orders/${orderId}`)
      const data = await res.json()
      if (data.ok) setOrder(data.item)
      else setError(data.error || 'Error al cargar')
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => { load() }, [load])

  useRealtime({
    userId: user?.id,
    role: user?.role,
    onOrderStatus: () => { load() },
    onOrderReady: () => { load() },
  })

  const canCobrar = user ? hasPermission(user.role, 'CAN_COBRAR') : false

  // Verificar si todos los productos están listos (para poder cobrar)
  const allItemsReady = order ? order.items.every((it) => it.status === 'LISTO' || it.status === 'CANCELADO' || it.status === 'SERVIDO') : false
  const pendingItems = order ? order.items.filter((it) => it.status === 'PENDIENTE' || it.status === 'EN_PREPARACION') : []
  const canAddProducts = order ? !['CANCELADO', 'COBRADO', 'ARCHIVADO'].includes(order.status) : false

  // Estado para añadir productos
  const [addProductOpen, setAddProductOpen] = useState(false)
  const [availableProducts, setAvailableProducts] = useState<any[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [addQuantity, setAddQuantity] = useState('1')
  const [addNotes, setAddNotes] = useState('')
  const [adding, setAdding] = useState(false)

  async function loadProducts() {
    try {
      const params = new URLSearchParams()
      if (order?.area?.id) params.set('areaId', order.area.id)
      const res = await fetch(`/api/mesero/products?${params.toString()}`)
      const data = await res.json()
      if (data.ok) setAvailableProducts(data.items || [])
    } catch (e) {
      console.error(e)
    }
  }

  function openAddProductDialog() {
    loadProducts()
    setSelectedProductId('')
    setAddQuantity('1')
    setAddNotes('')
    setAddProductOpen(true)
  }

  async function handleAddProduct() {
    if (!order || !selectedProductId) {
      toast.error('Selecciona un producto')
      return
    }
    const qty = parseFloat(addQuantity)
    if (!qty || qty <= 0) {
      toast.error('Cantidad inválida')
      return
    }
    setAdding(true)
    try {
      const res = await fetch(`/api/mesero/orders/${order.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: selectedProductId, quantity: qty, notes: addNotes || undefined }),
      })
      const data = await res.json()
      if (!data.ok) {
        toast.error(data.error || 'Error al añadir producto')
        return
      }
      toast.success('Producto añadido al pedido')
      setAddProductOpen(false)
      await load()
    } catch (e) {
      toast.error('Error de conexión')
    } finally {
      setAdding(false)
    }
  }

  function addPaymentLine() {
    setPayments((p) => [...p, { method: 'EFECTIVO_CUP', amount: '', currency: 'CUP', reference: '' }])
  }
  function removePaymentLine(idx: number) {
    setPayments((p) => p.filter((_, i) => i !== idx))
  }
  function updatePayment(idx: number, field: keyof PaymentForm, value: string) {
    setPayments((p) => p.map((pay, i) => {
      if (i !== idx) return pay
      const updated = { ...pay, [field]: value }
      // Auto-set currency based on method
      if (field === 'method') {
        if (value.includes('USD') || value === 'ZELLE' || value === 'BANCARIA_USD') {
          updated.currency = 'USD'
        } else {
          updated.currency = 'CUP'
        }
      }
      return updated
    }))
  }

  function openPayDialog() {
    if (!order) return
    // Verificar que todos los productos estén listos
    const pending = order.items.filter((it) => it.status !== 'LISTO' && it.status !== 'CANCELADO' && it.status !== 'SERVIDO')
    if (pending.length > 0) {
      toast.error(`No se puede cobrar: ${pending.length} producto(s) aún no están listos`)
      return
    }
    // Pre-llenar con monto pendiente
    setPayments([{ method: 'EFECTIVO_CUP', amount: order.pendingTotal.toFixed(2), currency: 'CUP', reference: '' }])
    setPayOpen(true)
  }

  async function handlePay() {
    if (!order) return
    const validPayments = payments.filter((p) => p.method && Number(p.amount) > 0)
    if (validPayments.length === 0) {
      toast.error('Agrega al menos un pago válido')
      return
    }
    setSubmitting(true)
    try {
      // FE-003: idempotencia frontend. Generar/reutilizar key por intento lógico.
      // - Si los pagos no cambiaron desde el último intento fallido, reutilizar key.
      // - Si los pagos cambiaron (monto, método, currency), es un intento nuevo.
      // - Tras 200 OK del backend, limpiar la key (operación exitosa).
      const manager = getIdempotencyManager()
      const fp = paymentsFingerprint(validPayments)
      const idempotencyKey = manager.getOrCreate(orderId, fp)

      const res = await fetch(`/api/mesero/orders/${orderId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payments: validPayments.map((p) => ({
            method: p.method,
            amount: Number(p.amount),
            currency: p.currency,
            reference: p.reference || undefined,
          })),
          idempotencyKey,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        // Operación exitosa (primer pago o reintento idempotente): limpiar key.
        manager.clear(orderId)
        if (data.idempotent) {
          toast.info('Pago ya estaba registrado (idempotente)')
        } else {
          toast.success(data.fullyPaid ? 'Pedido cobrado completamente' : 'Pago registrado')
        }
        setPayOpen(false)
        load()
      } else {
        // 4xx/5xx: MANTENER key para reintentar con la misma.
        toast.error(data.error || 'Error al registrar pago')
      }
    } catch {
      // Error de red/timeout: MANTENER key para reintentar con la misma.
      toast.error('Error de conexión. Reintenta con el mismo monto para evitar duplicar el pago.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancel() {
    if (!order) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/mesero/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelado por mesero' }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Pedido cancelado')
        setCancelOpen(false)
        load()
      } else {
        toast.error(data.error || 'Error al cancelar')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (error || !order) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error || 'Pedido no encontrado'}</AlertDescription>
      </Alert>
    )
  }

  const canCancel = ['CREADO', 'ENVIADO'].includes(order.status)
  const canEdit = ['CREADO', 'ENVIADO'].includes(order.status)
  const isFullyPaid = order.paymentStatus === 'PAGADO'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => router.push('/mesero')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">Pedido #{order.number}</h1>
              <Badge className={STATUS_COLORS[order.status] || STATUS_COLORS.CREADO} variant="secondary">
                {STATUS_LABELS[order.status] || order.status}
              </Badge>
              {order.paymentStatus === 'PAGADO' && (
                <Badge variant="outline" className="text-emerald-700 border-emerald-300">Pagado</Badge>
              )}
              {order.paymentStatus === 'PARCIAL' && (
                <Badge variant="outline" className="text-amber-700 border-amber-300">Pago parcial</Badge>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-0.5 flex items-center gap-2">
              <Clock className="h-3 w-3" />
              {new Date(order.createdAt).toLocaleString('es-CU')}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Actualizar
          </Button>
          <Button variant="outline" onClick={() => router.push(`/mesero/pedidos/${order.id}/comprobante`)}>
            <Printer className="h-4 w-4 mr-2" /> Comprobante
          </Button>
          {canAddProducts && (
            <Button variant="outline" onClick={openAddProductDialog}>
              <Plus className="h-4 w-4 mr-2" /> Añadir productos
            </Button>
          )}
          {canCancel && (
            <Button variant="outline" onClick={() => setCancelOpen(true)} className="text-red-600 border-red-300 hover:bg-red-50">
              <XCircle className="h-4 w-4 mr-2" /> Cancelar
            </Button>
          )}
          {canCobrar && !isFullyPaid && order.status !== 'CANCELADO' && (
            <Button onClick={openPayDialog} disabled={!allItemsReady}>
              <Wallet className="h-4 w-4 mr-2" /> Cobrar
            </Button>
          )}
        </div>
        {!allItemsReady && order && order.status !== 'CANCELADO' && order.status !== 'COBRADO' && pendingItems.length > 0 && (
          <Alert className="mt-3 border-amber-200 bg-amber-50 dark:bg-amber-950/30">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              No se puede cobrar hasta que todos los productos estén listos. Pendientes: {pendingItems.length} producto(s) en preparación o pendientes.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalle</CardTitle>
              <CardDescription>Productos del pedido</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {order.items.map((it) => (
                  <div key={it.id} className="p-4 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">
                        {it.product.name}
                        <span className="ml-1 text-xs text-stone-500">({it.product.code})</span>
                      </p>
                      <p className="text-xs text-stone-500">
                        {it.quantity} × {formatCurrency(it.unitPrice)} = {formatCurrency(it.quantity * it.unitPrice)}
                      </p>
                      {it.notes && (
                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">📝 {it.notes}</p>
                      )}
                    </div>
                    <span className="font-semibold">{formatCurrency(it.quantity * it.unitPrice)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pagos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Pagos
              </CardTitle>
              <CardDescription>Historial de pagos del pedido</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {order.payments.length === 0 ? (
                <div className="p-6 text-center text-sm text-stone-500">
                  Aún no hay pagos registrados
                </div>
              ) : (
                <div className="divide-y">
                  {order.payments.map((p) => (
                    <div key={p.id} className="p-4 flex items-center justify-between gap-3 text-sm">
                      <div>
                        <p className="font-medium">
                          {PAYMENT_METHOD_LABELS[p.method] || p.method}
                          <Badge variant="outline" className="ml-2 text-[10px]">{p.currency}</Badge>
                        </p>
                        <p className="text-xs text-stone-500">
                          {new Date(p.createdAt).toLocaleString('es-CU')}
                          {p.user && ` · ${p.user.firstName || p.user.username}`}
                          {p.reference && ` · Ref: ${p.reference}`}
                        </p>
                      </div>
                      <span className="font-semibold">{formatCurrency(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar info */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-stone-500">Área</p>
                  <p className="font-medium">{order.area?.name}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-500">Mesa</p>
                  <p className="font-medium">{order.table?.name || 'Para llevar'}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-500">Mesero</p>
                  <p className="font-medium">{order.user.firstName || order.user.username}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-500">Cliente</p>
                  <p className="font-medium">{order.customerName || '—'}</p>
                </div>
              </div>
              {order.notes && (
                <div>
                  <p className="text-xs text-stone-500">Notas</p>
                  <p className="text-sm bg-stone-50 dark:bg-stone-900 rounded p-2">{order.notes}</p>
                </div>
              )}
              <Separator />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-500">Subtotal</span>
                  <span>{formatCurrency(order.subtotal)}</span>
                </div>
                {order.discountAmount > 0 && (
                  <div className="flex justify-between text-amber-700">
                    <span>Descuento ({order.discountPct}%)</span>
                    <span>-{formatCurrency(order.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold pt-1">
                  <span>Total</span>
                  <span className="text-blue-700 dark:text-blue-300">{formatCurrency(order.total)}</span>
                </div>
              </div>
              <Separator />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-emerald-700">
                  <span>Pagado</span>
                  <span>{formatCurrency(order.paidTotal)}</span>
                </div>
                <div className="flex justify-between font-bold text-red-700">
                  <span>Pendiente</span>
                  <span>{formatCurrency(order.pendingTotal)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de pago */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Cobrar pedido #{order.number}
            </DialogTitle>
            <DialogDescription>
              Total: <strong>{formatCurrency(order.total)}</strong> · Pendiente: <strong>{formatCurrency(order.pendingTotal)}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {payments.map((p, idx) => (
              <div key={idx} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-stone-500">Pago #{idx + 1}</span>
                  {payments.length > 1 && (
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removePaymentLine(idx)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Método de pago</Label>
                    <Select value={p.method} onValueChange={(v) => updatePayment(idx, 'method', v)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Monto</Label>
                    <Input
                      type="number"
                      value={p.amount}
                      onChange={(e) => updatePayment(idx, 'amount', e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{p.currency}</Badge>
                  <Input
                    value={p.reference}
                    onChange={(e) => updatePayment(idx, 'reference', e.target.value)}
                    placeholder="Referencia (opcional)"
                    className="h-7 text-xs flex-1"
                    maxLength={120}
                  />
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addPaymentLine} className="w-full">
              <Plus className="h-4 w-4 mr-2" /> Agregar pago
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancelar</Button>
            <Button onClick={handlePay} disabled={submitting}>
              {submitting ? 'Procesando...' : 'Confirmar pago'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog de cancelación */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar pedido #{order.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El stock de los productos directos será devuelto al inventario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {actionLoading ? 'Cancelando...' : 'Sí, cancelar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Añadir productos */}
      <Dialog open={addProductOpen} onOpenChange={setAddProductOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" /> Añadir producto al pedido #{order?.number}
            </DialogTitle>
            <DialogDescription>Selecciona un producto y la cantidad a añadir</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Producto</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger><SelectValue placeholder="Selecciona un producto..." /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {availableProducts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.code}) · {formatCurrency(p.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Cantidad</Label>
                <Input type="number" value={addQuantity} onChange={(e) => setAddQuantity(e.target.value)} min="1" step="0.5" />
              </div>
              <div className="space-y-2">
                <Label>Notas (opcional)</Label>
                <Input value={addNotes} onChange={(e) => setAddNotes(e.target.value)} placeholder="Ej: sin cebolla" maxLength={300} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddProductOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddProduct} disabled={adding || !selectedProductId}>
              {adding ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              {adding ? 'Añadiendo...' : 'Añadir al pedido'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
