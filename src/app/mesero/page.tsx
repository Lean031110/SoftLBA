'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import {
  Plus, ShoppingBag, ChefHat, CheckCircle2, Clock, Wallet, AlertTriangle, RefreshCw, Eye,
} from 'lucide-react'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useRealtime } from '@/hooks/use-realtime'
import {
  STATUS_COLORS, STATUS_LABELS, formatCurrency, formatTime,
} from '@/lib/order-utils'

type OrderItem = {
  id: string
  number: number
  status: string
  paymentStatus: string
  customerName?: string | null
  total: number
  createdAt: string
  updatedAt: string
  area: { id: string; name: string; code: string }
  table: { id: string; name: string; code: string } | null
  itemsCount: number
  paidTotal: number
  pendingTotal: number
}

export default function MeseroDashboardPage() {
  const router = useRouter()
  const { user } = useCurrentUser()
  const [items, setItems] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/mesero/orders')
      const data = await res.json()
      if (data.ok) setItems(data.items || [])
      else setError(data.error || 'Error al cargar')
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // WebSocket: refrescar cuando llegue un cambio de estado
  useRealtime({
    userId: user?.id,
    role: user?.role,
    onOrderStatus: () => { load() },
    onOrderReady: (data) => {
      toast.success(`Pedido #${data.orderNumber || ''} listo para servir`)
      load()
    },
  })

  // Estadísticas rápidas
  const stats = {
    activos: items.filter((i) => ['CREADO', 'ENVIADO', 'EN_PREPARACION', 'LISTO', 'SERVIDO'].includes(i.status)).length,
    pendientes: items.filter((i) => i.status === 'ENVIADO').length,
    listos: items.filter((i) => i.status === 'LISTO').length,
    porCobrar: items.filter((i) => i.paymentStatus !== 'PAGADO' && i.status !== 'CANCELADO').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="h-6 w-6" />
            Panel del Mesero
          </h1>
          <p className="text-sm text-stone-500">
            Hola, {user?.firstName || user?.username}. Gestiona tus pedidos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button onClick={() => router.push('/mesero/nuevo-pedido')}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo pedido
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-stone-500 uppercase">Activos</p>
              <ShoppingBag className="h-4 w-4 text-stone-500" />
            </div>
            <p className="text-2xl font-bold mt-1">{stats.activos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-stone-500 uppercase">En cocina</p>
              <ChefHat className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-2xl font-bold mt-1">{stats.pendientes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-stone-500 uppercase">Listos</p>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold mt-1">{stats.listos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-stone-500 uppercase">Por cobrar</p>
              <Wallet className="h-4 w-4 text-purple-600" />
            </div>
            <p className="text-2xl font-bold mt-1">{stats.porCobrar}</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de pedidos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Mis pedidos</span>
            <Badge variant="secondary" className="text-xs">{items.length}</Badge>
          </CardTitle>
          <CardDescription>Pedidos activos de tu sesión</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : error ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center">
              <ShoppingBag className="h-10 w-10 mx-auto text-stone-300 mb-3" />
              <p className="text-sm text-stone-500 mb-3">No tienes pedidos activos</p>
              <Button onClick={() => router.push('/mesero/nuevo-pedido')}>
                <Plus className="h-4 w-4 mr-2" /> Crear primer pedido
              </Button>
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh]">
              <div className="divide-y">
                {items.map((o) => (
                  <div key={o.id} className="p-4 hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">#{o.number}</span>
                          <Badge className={STATUS_COLORS[o.status] || STATUS_COLORS.CREADO} variant="secondary">
                            {STATUS_LABELS[o.status] || o.status}
                          </Badge>
                          {o.paymentStatus === 'PAGADO' && (
                            <Badge variant="outline" className="text-emerald-700 border-emerald-300">Pagado</Badge>
                          )}
                          {o.paymentStatus === 'PARCIAL' && (
                            <Badge variant="outline" className="text-amber-700 border-amber-300">Pago parcial</Badge>
                          )}
                        </div>
                        <p className="text-xs text-stone-500 mt-1">
                          {o.area?.name}
                          {o.table ? ` · ${o.table.name}` : ''}
                          {o.customerName ? ` · ${o.customerName}` : ''}
                        </p>
                        <p className="text-xs text-stone-500 mt-0.5 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(o.createdAt)} · {o.itemsCount} items
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="font-bold text-base">{formatCurrency(o.total)}</span>
                        {o.pendingTotal > 0 && o.status !== 'CANCELADO' && (
                          <span className="text-xs text-amber-600">Pend: {formatCurrency(o.pendingTotal)}</span>
                        )}
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/mesero/pedidos/${o.id}`}>
                            <Eye className="h-3 w-3 mr-1" /> Ver
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
