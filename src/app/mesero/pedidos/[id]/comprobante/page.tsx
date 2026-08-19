'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  ArrowLeft, Printer, Utensils, MapPin, Phone, Mail, Clock, Download, Loader2,
} from 'lucide-react'
import {
  STATUS_LABELS, PAYMENT_METHOD_LABELS, formatCurrency,
} from '@/lib/order-utils'

type Config = {
  name?: string | null
  legalName?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  hours?: string | null
  logo?: string | null
  currency?: string | null
  currencySymbol?: string | null
  receiptHeader?: string | null
  receiptFooter?: string | null
  slogan?: string | null
}

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
  area: { id: string; name: string; code: string }
  table: { id: string; name: string; code: string } | null
  user: { id: string; firstName: string | null; lastName: string | null; username: string }
  items: {
    id: string
    quantity: number
    unitPrice: number
    notes: string | null
    product: { id: string; name: string; code: string; price: number; unit: string }
  }[]
  payments: {
    id: string
    method: string
    amount: number
    currency: string
    reference: string | null
    createdAt: string
  }[]
  paidTotal: number
  pendingTotal: number
}

export default function ComprobantePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [orderId, setOrderId] = useState('')
  const [config, setConfig] = useState<Config | null>(null)
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // FE-002: timestamp de emisión se setea en mount (no en render) para evitar
  // hydration mismatch entre server time y client time.
  const [issuedAt, setIssuedAt] = useState<string>('')

  useEffect(() => { params.then((p) => setOrderId(p.id)) }, [params])

  // FE-002: setear issuedAt solo tras mount, una sola vez.
  useEffect(() => {
    setIssuedAt(new Date().toLocaleString('es-CU'))
  }, [])

  const load = useCallback(async () => {
    if (!orderId) return
    setLoading(true)
    setError(null)
    try {
      const [confRes, ordRes] = await Promise.all([
        fetch('/api/public/config').then((r) => r.json()),
        fetch(`/api/mesero/orders/${orderId}`).then((r) => r.json()),
      ])
      if (confRes.ok) setConfig(confRes.config)
      if (ordRes.ok) setOrder(ordRes.item)
      else setError(ordRes.error || 'Error al cargar pedido')
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => { load() }, [load])

  const [downloading, setDownloading] = useState(false)
  const receiptRef = useRef<HTMLDivElement>(null)

  function handlePrint() {
    window.print()
  }

  async function handleDownloadImage() {
    if (!receiptRef.current || !order) return
    setDownloading(true)
    try {
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(receiptRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: 400,
      })
      const link = document.createElement('a')
      link.download = `comprobante-${order.number}.png`
      link.href = dataUrl
      link.click()
      toast.success('Comprobante descargado como imagen')
    } catch (e) {
      toast.error('Error al generar imagen')
      console.error(e)
    } finally {
      setDownloading(false)
    }
  }

  async function handlePrintThermal() {
    if (!order) return
    try {
      const res = await fetch(`/api/mesero/orders/${order.id}/print`, { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        toast.success(data.message || 'Enviado a impresora')
      } else {
        toast.error(data.error || 'Error al imprimir')
      }
    } catch {
      toast.error('Error de conexión')
    }
  }

  const symbol = config?.currencySymbol || '$'
  const restaurantName = config?.name || 'Restaurante'

  if (loading) {
    return (
      <div className="space-y-4 max-w-md mx-auto">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }
  if (error || !order) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error || 'Pedido no encontrado'}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4 max-w-md mx-auto print:max-w-none print:space-y-0">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/mesero/pedidos/${order.id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-semibold flex-1">Comprobante</h1>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={handleDownloadImage} disabled={downloading}>
            {downloading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
            <span className="hidden sm:inline">{downloading ? 'Generando...' : 'Imagen'}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrintThermal}>
            <Printer className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Térmica</span>
          </Button>
          <Button size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" /> Imprimir
          </Button>
        </div>
      </div>

      <div ref={receiptRef}>
      <Card className="print:shadow-none print:border-0">
        <CardContent className="p-6 space-y-4 font-mono text-sm bg-white">
          {/* Header del restaurante */}
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white">
                <Utensils className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-bold">{restaurantName}</h2>
            </div>
            {config?.legalName && config.legalName !== restaurantName && (
              <p className="text-xs text-stone-500">{config.legalName}</p>
            )}
            {config?.address && (
              <p className="text-xs flex items-center justify-center gap-1 text-stone-500">
                <MapPin className="h-3 w-3" /> {config.address}
              </p>
            )}
            {config?.phone && (
              <p className="text-xs flex items-center justify-center gap-1 text-stone-500">
                <Phone className="h-3 w-3" /> {config.phone}
              </p>
            )}
            {config?.email && (
              <p className="text-xs flex items-center justify-center gap-1 text-stone-500">
                <Mail className="h-3 w-3" /> {config.email}
              </p>
            )}
            {config?.hours && (
              <p className="text-xs flex items-center justify-center gap-1 text-stone-500">
                <Clock className="h-3 w-3" /> {config.hours}
              </p>
            )}
            {config?.slogan && (
              <p className="text-xs italic text-stone-500 mt-1">{config.slogan}</p>
            )}
          </div>

          <Separator className="border-dashed" />

          {/* Datos del pedido */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-stone-500">Pedido #</span>
              <span className="font-bold">{order.number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Fecha</span>
              <span>{new Date(order.createdAt).toLocaleString('es-CU')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Mesero</span>
              <span>{order.user.firstName || order.user.username}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Área</span>
              <span>{order.area?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Mesa</span>
              <span>{order.table?.name || 'Para llevar'}</span>
            </div>
            {order.customerName && (
              <div className="flex justify-between">
                <span className="text-stone-500">Cliente</span>
                <span>{order.customerName}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-stone-500">Estado</span>
              <span>{STATUS_LABELS[order.status] || order.status}</span>
            </div>
          </div>

          <Separator className="border-dashed" />

          {/* Items */}
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-1 text-xs font-semibold text-stone-500 pb-1 border-b border-dashed">
              <div className="col-span-2 text-center">Cant.</div>
              <div className="col-span-6">Producto</div>
              <div className="col-span-4 text-right">Importe</div>
            </div>
            {order.items.map((it) => (
              <div key={it.id} className="grid grid-cols-12 gap-1 text-xs">
                <div className="col-span-2 text-center">{it.quantity}</div>
                <div className="col-span-6">
                  <p>{it.product.name}</p>
                  <p className="text-[10px] text-stone-500">{formatCurrency(it.unitPrice, symbol)} c/u</p>
                  {it.notes && <p className="text-[10px] text-amber-700">📝 {it.notes}</p>}
                </div>
                <div className="col-span-4 text-right">
                  {formatCurrency(it.quantity * it.unitPrice, symbol)}
                </div>
              </div>
            ))}
          </div>

          <Separator className="border-dashed" />

          {/* Totales */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-stone-500">Subtotal</span>
              <span>{formatCurrency(order.subtotal, symbol)}</span>
            </div>
            {order.discountAmount > 0 && (
              <div className="flex justify-between text-amber-700">
                <span>Descuento ({order.discountPct}%)</span>
                <span>-{formatCurrency(order.discountAmount, symbol)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-1 border-t border-dashed">
              <span>TOTAL</span>
              <span>{formatCurrency(order.total, symbol)}</span>
            </div>
          </div>

          {/* Pagos */}
          {order.payments.length > 0 && (
            <>
              <Separator className="border-dashed" />
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-stone-500 mb-1">PAGOS</p>
                {order.payments.map((p) => (
                  <div key={p.id} className="flex justify-between">
                    <span>{PAYMENT_METHOD_LABELS[p.method] || p.method}</span>
                    <span>{formatCurrency(p.amount, symbol)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold pt-1 border-t border-dashed">
                  <span>Pagado</span>
                  <span>{formatCurrency(order.paidTotal, symbol)}</span>
                </div>
                {order.pendingTotal > 0 && (
                  <div className="flex justify-between text-red-700">
                    <span>Pendiente</span>
                    <span>{formatCurrency(order.pendingTotal, symbol)}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {order.notes && (
            <>
              <Separator className="border-dashed" />
              <div className="text-xs">
                <p className="font-semibold text-stone-500 mb-1">NOTAS</p>
                <p className="text-stone-700 dark:text-stone-300 whitespace-pre-wrap">{order.notes}</p>
              </div>
            </>
          )}

          <Separator className="border-dashed" />

          {/* Footer */}
          <div className="text-center space-y-1">
            <p className="text-xs font-semibold">
              {config?.receiptFooter || '¡Gracias por su visita!'}
            </p>
            <p className="text-[10px] text-stone-400">
              {/* FE-002: evitar hydration mismatch — `new Date()` en render
                  difiere entre server y cliente. Mostrar ISO date en SSR y
                  format tras mount. */}
              {issuedAt ? `Emitido el ${issuedAt}` : '\u00A0'}
            </p>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
