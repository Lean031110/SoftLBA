'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LoadingScreen } from '@/components/loading'
import {
  Plus, Clock, Wallet, RefreshCw, Eye, ChefHat,
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
  area?: { name: string }
  table?: { name: string } | null
  items?: { product: { name: string }; quantity: number; status: string }[]
}

const ACTIVE_STATUSES = ['CREADO', 'ENVIADO', 'EN_PREPARACION', 'LISTO', 'SERVIDO']
const INACTIVE_STATUSES = ['COBRADO', 'CANCELADO', 'ARCHIVADO']

export default function MeseroDashboardPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useCurrentUser()
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'active' | 'inactive'>('active')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/mesero/orders?pageSize=100')
      const data = await res.json()
      if (data.ok) {
        setOrders(data.items || [])
        setError(null)
      } else {
        setError(data.error || 'Error al cargar')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) load()
  }, [user, load])

  useRealtime({
    userId: user?.id,
    role: user?.role,
    onOrderStatus: () => { load() },
    onOrderReady: () => { load() },
  })

  if (userLoading || loading) {
    return <LoadingScreen message="Cargando pedidos..." />
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  // Filtrar por pestaña
  const filtered = orders.filter((o) =>
    tab === 'active' ? ACTIVE_STATUSES.includes(o.status) : INACTIVE_STATUSES.includes(o.status)
  )

  // Ordenar: en elaboración primero (anclados), luego los más nuevos
  const sorted = [...filtered].sort((a, b) => {
    const aInPrep = a.status === 'EN_PREPARACION' ? 0 : 1
    const bInPrep = b.status === 'EN_PREPARACION' ? 0 : 1
    if (aInPrep !== bInPrep) return aInPrep - bInPrep
    // Más nuevos primero
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const activeCount = orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length
  const inactiveCount = orders.filter((o) => INACTIVE_STATUSES.includes(o.status)).length
  const pendingPayment = orders.filter((o) => ACTIVE_STATUSES.includes(o.status) && o.paymentStatus !== 'PAGADO').length
  const totalToday = orders
    .filter((o) => o.status === 'COBRADO')
    .reduce((s, o) => s + o.total, 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Hola, {user?.firstName || user?.username}</h1>
          <p className="text-xs text-slate-500">Gestiona tus pedidos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-3 w-3 mr-1" /> Actualizar
          </Button>
          <Button size="sm" onClick={() => router.push('/mesero/nuevo-pedido')}>
            <Plus className="h-3 w-3 mr-1" /> Nuevo pedido
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-slate-500 uppercase">Activos</p>
            <p className="text-xl font-bold text-blue-600">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-slate-500 uppercase">Por cobrar</p>
            <p className="text-xl font-bold text-amber-600">{pendingPayment}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-slate-500 uppercase">Cobrado hoy</p>
            <p className="text-xl font-bold text-emerald-600">${totalToday.toFixed(0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Activos / Inactivos */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'active' | 'inactive')}>
        <TabsList className="w-full">
          <TabsTrigger value="active" className="flex-1">
            Activos ({activeCount})
          </TabsTrigger>
          <TabsTrigger value="inactive" className="flex-1">
            Completados ({inactiveCount})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Lista de pedidos */}
      {sorted.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-slate-500">
            <ChefHat className="h-10 w-10 mx-auto mb-3 text-slate-300" />
            <p className="font-medium">
              {tab === 'active' ? 'No tienes pedidos activos' : 'No tienes pedidos completados'}
            </p>
            {tab === 'active' && (
              <Button size="sm" className="mt-3" onClick={() => router.push('/mesero/nuevo-pedido')}>
                <Plus className="h-4 w-4 mr-1" /> Crear pedido
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sorted.map((order) => {
            const mins = Math.max(0, Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000))
            const isAnclada = order.status === 'EN_PREPARACION'
            return (
              <Card
                key={order.id}
                className={isAnclada ? 'border-blue-300 bg-blue-50/30 dark:bg-blue-950/20' : ''}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold">#{order.number}</span>
                        <Badge className={STATUS_COLORS[order.status] || ''} variant="secondary">
                          {STATUS_LABELS[order.status] || order.status}
                        </Badge>
                        {isAnclada && (
                          <Badge variant="default" className="text-[10px] bg-blue-600">
                            🔔 En elaboración
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {order.table ? order.table.name : 'Para llevar'}
                        {order.area ? ` · ${order.area.name}` : ''}
                        {order.customerName ? ` · ${order.customerName}` : ''}
                      </p>
                      {order.items && order.items.length > 0 && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {order.items.length} producto(s)
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant={mins >= 15 ? 'destructive' : 'secondary'} className="text-[10px]">
                        <Clock className="h-3 w-3 mr-1" />
                        {mins} min
                      </Badge>
                      <p className="font-bold text-sm">{formatCurrency(order.total)}</p>
                    </div>
                  </div>
                  <div className="flex justify-end mt-2">
                    <Button size="sm" variant="outline" onClick={() => router.push(`/mesero/pedidos/${order.id}`)}>
                      <Eye className="h-3 w-3 mr-1" /> Ver
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
