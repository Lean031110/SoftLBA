// src/components/production/kds-dashboard.tsx
// FASE 6 — KDS de producción reutilizable (cocina y pizzería).

'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import {
  Clock, Play, CheckCircle2, Volume2, VolumeX, AlertTriangle,
  ChefHat, RefreshCw,
} from 'lucide-react'
import { useRealtime } from '@/hooks/use-realtime'
import { useBeep } from '@/hooks/use-beep'
import { cn } from '@/lib/utils'
import { useCurrentUser } from '@/hooks/use-current-user'

interface KDSItem {
  id: string; quantity: number; notes: string | null; status: string
  product: { id: string; name: string; unit: string }
}
interface KDSOrder {
  id: string; number: number; status: string; customerName: string | null
  table: { name: string } | null; createdAt: string; items: KDSItem[]
}
interface KDSDashboardProps {
  apiBase: string; areaName: string; accentColor?: 'blue' | 'orange'
}

function elapsedMinutes(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 60000)
}
function isLate(isoDate: string, target = 15): boolean {
  return elapsedMinutes(isoDate) >= target
}
function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString('es-CU', { hour: '2-digit', minute: '2-digit' })
}

export function KDSDashboard({ apiBase, areaName, accentColor = 'blue' }: KDSDashboardProps) {
  const { user, loading: userLoading } = useCurrentUser()
  const [orders, setOrders] = useState<KDSOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const lastOrderCountRef = useRef(0)
  const { play: playBeep } = useBeep()

  const loadOrders = useCallback(async () => {
    try {
      setRefreshing(true)
      const res = await fetch(`${apiBase}/orders`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.ok) {
        const newOrders = data.items || []
        if (newOrders.length > lastOrderCountRef.current && !muted && lastOrderCountRef.current > 0) {
          playBeep()
          toast.info(`Nuevo pedido en ${areaName}`, { duration: 3000 })
        }
        lastOrderCountRef.current = newOrders.length
        setOrders(newOrders)
        setError(null)
      } else { setError(data.error || 'Error al cargar') }
    } catch (e: any) { setError(e?.message || 'Error de conexión') }
    finally { setLoading(false); setRefreshing(false) }
  }, [apiBase, areaName, muted, playBeep])

  useRealtime({
    userId: user?.id, role: user?.role,
    onOrderNew: () => loadOrders(), onOrderStatus: () => loadOrders(), onOrderReady: () => loadOrders(),
  })

  useEffect(() => {
    if (user) loadOrders()
    const interval = setInterval(loadOrders, 5000)
    return () => clearInterval(interval)
  }, [user, loadOrders])

  const pending = orders.filter((o) => ['CREADO', 'ENVIADO'].includes(o.status))
  const preparing = orders.filter((o) => o.status === 'EN_PREPARACION')
  const ready = orders.filter((o) => ['LISTO', 'SERVIDO'].includes(o.status))
  const sortByTime = (a: KDSOrder, b: KDSOrder) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  pending.sort(sortByTime); preparing.sort(sortByTime); ready.sort(sortByTime)

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const res = await fetch(`${apiBase}/orders/${orderId}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      const data = await res.json()
      if (!data.ok) { toast.error(data.error || 'Error'); return }
      loadOrders()
    } catch { toast.error('Error de conexión') }
  }
  const updateItemStatus = async (orderId: string, itemId: string, status: string) => {
    try {
      const res = await fetch(`${apiBase}/orders/${orderId}/items/${itemId}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      const data = await res.json()
      if (!data.ok) { toast.error(data.error || 'Error'); return }
      loadOrders()
    } catch { toast.error('Error de conexión') }
  }

  if (userLoading || loading) return <div className="flex items-center justify-center h-[calc(100vh-4rem)]"><Skeleton className="h-8 w-48" /></div>
  if (error) return (
    <div className="p-4">
      <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>
      <Button variant="outline" className="mt-2" onClick={loadOrders}><RefreshCw className="h-4 w-4 mr-2" /> Reintentar</Button>
    </div>
  )

  const accentClass = accentColor === 'orange' ? 'text-orange-600 dark:text-orange-400' : 'text-blue-600 dark:text-blue-400'
  const accentBg = accentColor === 'orange' ? 'bg-orange-500' : 'bg-blue-500'

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between p-3 border-b bg-background">
        <div className="flex items-center gap-3">
          <ChefHat className={cn('h-6 w-6', accentClass)} />
          <h1 className="text-xl font-bold">{areaName}</h1>
          <div className="flex gap-2">
            {pending.length > 0 && <Badge variant="secondary">{pending.length} pend.</Badge>}
            {preparing.length > 0 && <Badge className={accentBg}>{preparing.length} prep.</Badge>}
            {ready.length > 0 && <Badge variant="outline" className="text-emerald-600 border-emerald-500">{ready.length} listos</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Activar sonido' : 'Silenciar'}>
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={loadOrders} disabled={refreshing} aria-label="Refrescar">
            <RefreshCw className={cn('h-5 w-5', refreshing && 'animate-spin')} />
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {[...pending, ...preparing].length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-2 uppercase">En cola</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {[...pending, ...preparing].map((order) => (
                  <Ticket key={order.id} order={order} isPreparing={order.status === 'EN_PREPARACION'}
                    onStartPrep={() => updateOrderStatus(order.id, 'EN_PREPARACION')}
                    onReady={() => updateOrderStatus(order.id, 'LISTO')}
                    onItemStatus={(itemId, status) => updateItemStatus(order.id, itemId, status)}
                    accentBg={accentBg} />
                ))}
              </div>
            </div>
          )}
          {ready.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-2 uppercase">Listos</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {ready.map((order) => (
                  <Ticket key={order.id} order={order} isReady onStartPrep={() => {}} onReady={() => {}} onItemStatus={() => {}} accentBg={accentBg} />
                ))}
              </div>
            </div>
          )}
          {orders.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <ChefHat className="h-12 w-12 mb-3 opacity-30" />
              <p className="font-medium">No hay pedidos activos</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function Ticket({ order, isPreparing, isReady, onStartPrep, onReady, onItemStatus, accentBg }: {
  order: KDSOrder; isPreparing?: boolean; isReady?: boolean
  onStartPrep: () => void; onReady: () => void
  onItemStatus: (itemId: string, status: string) => void; accentBg: string
}) {
  const mins = elapsedMinutes(order.createdAt)
  const late = isLate(order.createdAt)
  return (
    <div className={cn(
      'rounded-lg border-2 p-3',
      isReady ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
      : late ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
      : isPreparing ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
      : 'border-stone-300 dark:border-stone-700 bg-card',
    )}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-2xl font-bold">#{order.number}</span>
          {order.table && <span className="text-sm text-muted-foreground ml-2">{order.table.name}</span>}
        </div>
        <div className={cn('flex items-center gap-1 text-sm font-mono', late ? 'text-red-600 font-bold' : 'text-muted-foreground')}>
          <Clock className="h-3 w-3" />{mins}m
        </div>
      </div>
      {order.customerName && <p className="text-xs text-muted-foreground mb-1">👤 {order.customerName}</p>}
      <p className="text-xs text-muted-foreground mb-2">{formatTime(order.createdAt)}</p>
      <div className="space-y-1 mb-3">
        {order.items.map((item) => (
          <div key={item.id} className={cn('flex items-start gap-2 text-sm', (item.status === 'LISTO' || item.status === 'SERVIDO') && 'line-through opacity-60')}>
            <span className="font-bold min-w-6">{item.quantity}×</span>
            <div className="flex-1">
              <span>{item.product.name}</span>
              {item.notes && <p className="text-xs text-amber-600 dark:text-amber-400 ml-6">⚠ {item.notes}</p>}
            </div>
            {!isReady && item.status === 'PENDIENTE' && (
              <button type="button" onClick={() => onItemStatus(item.id, 'EN_PREPARACION')} className="text-blue-600 hover:text-blue-700" aria-label={`Empezar ${item.product.name}`}>
                <Play className="h-3 w-3" />
              </button>
            )}
            {!isReady && item.status === 'EN_PREPARACION' && (
              <button type="button" onClick={() => onItemStatus(item.id, 'LISTO')} className="text-emerald-600 hover:text-emerald-700" aria-label={`Listo ${item.product.name}`}>
                <CheckCircle2 className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>
      {!isReady && (
        <div className="flex gap-2 pt-2 border-t">
          {(order.status === 'CREADO' || order.status === 'ENVIADO') ? (
            <Button size="sm" className={cn('flex-1 h-10 text-white', accentBg)} onClick={onStartPrep}>
              <Play className="h-4 w-4 mr-1" /> Empezar
            </Button>
          ) : order.status === 'EN_PREPARACION' ? (
            <Button size="sm" className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onReady}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Listo
            </Button>
          ) : null}
        </div>
      )}
      {isReady && (
        <div className="flex items-center justify-center pt-2 border-t">
          <Badge variant="outline" className="text-emerald-600 border-emerald-500">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Listo para servir
          </Badge>
        </div>
      )}
    </div>
  )
}
