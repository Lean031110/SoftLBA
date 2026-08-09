'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { toast } from 'sonner'
import {
  ChefHat, Clock, ChevronDown, ChevronUp, Play, CheckCircle2, Utensils, AlertTriangle, Volume2, VolumeX,
} from 'lucide-react'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useRealtime } from '@/hooks/use-realtime'
import { useBeep } from '@/hooks/use-beep'
import {
  STATUS_COLORS, STATUS_LABELS, formatTime, formatCurrency,
} from '@/lib/order-utils'

type KitchenItem = {
  id: string
  number: number
  status: string
  customerName: string | null
  notes: string | null
  total: number
  createdAt: string
  updatedAt: string
  area: { id: string; name: string; code: string }
  table: { id: string; name: string; code: string } | null
  user: { id: string; firstName: string | null; lastName: string | null; username: string }
  items: {
    id: string
    quantity: number
    unitPrice: number
    notes: string | null
    status: string
    product: { id: string; name: string; code: string; unit: string; notes: string | null }
  }[]
}

type TabKey = 'pending' | 'preparing' | 'ready'

const TAB_LABELS: Record<TabKey, string> = {
  pending: 'Pendientes',
  preparing: 'En preparación',
  ready: 'Listos',
}

function elapsedMin(dateStr: string) {
  const d = new Date(dateStr)
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000))
}

export function KitchenDashboard({ apiBase, areaName }: { apiBase: string; areaName: string }) {
  const { user } = useCurrentUser()
  const [items, setItems] = useState<KitchenItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabKey>('pending')
  const [openId, setOpenId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [soundOn, setSoundOn] = useState(true)
  const lastIdsRef = useRef<string>('')

  const { play } = useBeep()

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/orders?served=true`)
      const data = await res.json()
      if (data.ok) {
        const newItems: KitchenItem[] = data.items || []
        // Detectar pedidos nuevos y reproducir sonido
        if (soundOn && lastIdsRef.current !== '') {
          const prev = new Set(lastIdsRef.current.split(','))
          const newOnes = newItems.filter(
            (i) => !prev.has(i.id) && (i.status === 'ENVIADO' || i.status === 'CREADO'),
          )
          if (newOnes.length > 0) {
            play(880, 200, 0.3)
            toast.success(`${newOnes.length} nuevo(s) pedido(s)`, {
              description: newOnes.map((n) => `#${n.number}`).join(', '),
            })
          }
        }
        lastIdsRef.current = newItems.map((i) => i.id).join(',')
        setItems(newItems)
        setError(null)
      } else {
        setError(data.error || 'Error al cargar')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [apiBase, soundOn, play])

  useEffect(() => {
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [load])

  // WebSocket: recargar al recibir notificación
  useRealtime({
    userId: user?.id,
    role: user?.role,
    onOrderNew: () => { load() },
    onOrderStatus: () => { load() },
  })

  async function handleStatusChange(orderId: string, newStatus: string) {
    setActionLoading(`${orderId}-${newStatus}`)
    try {
      const res = await fetch(`${apiBase}/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (data.ok) {
        // Emitir evento WebSocket para notificar al mesero
        if (data.wsPayload) {
          try {
            const { io } = await import('socket.io-client')
            const socket = io('/?XTransformPort=3003', { transports: ['websocket'] })
            socket.emit(data.wsEvent || 'order:status', data.wsPayload)
            setTimeout(() => socket.disconnect(), 1000)
          } catch {
            // Silencioso
          }
        }
        const labels: Record<string, string> = {
          EN_PREPARACION: 'Pedido en preparación',
          LISTO: 'Pedido listo',
          SERVIDO: 'Pedido servido',
        }
        toast.success(labels[newStatus] || 'Estado actualizado')
        load()
      } else {
        toast.error(data.error || 'Error al cambiar estado')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setActionLoading(null)
    }
  }

  const filtered = items.filter((i) => {
    if (tab === 'pending') return i.status === 'ENVIADO' || i.status === 'CREADO'
    if (tab === 'preparing') return i.status === 'EN_PREPARACION'
    if (tab === 'ready') return i.status === 'LISTO' || i.status === 'SERVIDO'
    return false
  })

  const counts = {
    pending: items.filter((i) => i.status === 'ENVIADO' || i.status === 'CREADO').length,
    preparing: items.filter((i) => i.status === 'EN_PREPARACION').length,
    ready: items.filter((i) => i.status === 'LISTO' || i.status === 'SERVIDO').length,
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ChefHat className="h-6 w-6" />
            {areaName}
          </h1>
          <p className="text-sm text-stone-500">
            Pedidos en cola · Actualización automática cada 5s
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const v = !soundOn
            setSoundOn(v)
            toast.info(v ? 'Sonido activado' : 'Sonido desactivado')
          }}
          aria-label="Toggle sonido"
        >
          {soundOn ? <Volume2 className="h-4 w-4 mr-2" /> : <VolumeX className="h-4 w-4 mr-2" />}
          {soundOn ? 'Sonido on' : 'Sonido off'}
        </Button>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-2">
        {(['pending', 'preparing', 'ready'] as TabKey[]).map((t) => (
          <Button
            key={t}
            variant={tab === t ? 'default' : 'outline'}
            onClick={() => setTab(t)}
            className="relative h-auto py-2 flex flex-col items-center gap-0.5"
          >
            <span className="text-xs">{TAB_LABELS[t]}</span>
            <span className="text-base font-bold">{counts[t]}</span>
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <ChefHat className="h-10 w-10 mx-auto text-stone-300 mb-3" />
            <p className="text-sm text-stone-500">No hay pedidos en esta categoría</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((o) => {
            const mins = elapsedMin(o.createdAt)
            const isLate = mins >= 15
            const expanded = openId === o.id
            return (
              <Card
                key={o.id}
                className={`border-l-4 ${
                  o.status === 'ENVIADO' || o.status === 'CREADO'
                    ? 'border-l-amber-400'
                    : o.status === 'EN_PREPARACION'
                    ? 'border-l-blue-400'
                    : o.status === 'LISTO'
                    ? 'border-l-emerald-400'
                    : 'border-l-stone-300'
                }`}
              >
                <Collapsible open={expanded} onOpenChange={(v) => setOpenId(v ? o.id : null)}>
                  <CollapsibleTrigger asChild>
                    <div className="cursor-pointer p-4 pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold">#{o.number}</span>
                            <Badge className={STATUS_COLORS[o.status] || STATUS_COLORS.CREADO} variant="secondary">
                              {STATUS_LABELS[o.status] || o.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-stone-500 mt-1">
                            {o.table ? o.table.name : 'Para llevar'}
                            {o.customerName ? ` · ${o.customerName}` : ''}
                          </p>
                          <p className="text-xs text-stone-500">
                            {o.user.firstName || o.user.username}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant={isLate ? 'destructive' : 'secondary'} className="text-[10px]">
                            <Clock className="h-3 w-3 mr-1" />
                            {mins} min
                          </Badge>
                          {expanded ? <ChevronUp className="h-3 w-3 text-stone-400" /> : <ChevronDown className="h-3 w-3 text-stone-400" />}
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CardContent className="pt-0 pb-3 space-y-2">
                    <div className="space-y-1">
                      {o.items.slice(0, expanded ? undefined : 3).map((it) => (
                        <div key={it.id} className="flex items-start justify-between gap-2 text-sm">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">
                              <span className="text-orange-700 dark:text-orange-300 mr-1">{it.quantity}×</span>
                              {it.product.name}
                            </p>
                            {it.notes && (
                              <p className="text-xs text-amber-700 dark:text-amber-400 ml-1">📝 {it.notes}</p>
                            )}
                          </div>
                        </div>
                      ))}
                      {!expanded && o.items.length > 3 && (
                        <p className="text-xs text-stone-400">+ {o.items.length - 3} más...</p>
                      )}
                    </div>

                    {expanded && o.notes && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-xs text-stone-500 mb-1">Notas del pedido</p>
                          <p className="text-sm bg-stone-50 dark:bg-stone-900 rounded p-2">{o.notes}</p>
                        </div>
                      </>
                    )}

                    {expanded && (
                      <p className="text-xs text-stone-400">
                        Total: {formatCurrency(o.total)} · {formatTime(o.createdAt)}
                      </p>
                    )}

                    <Separator />
                    <div className="grid grid-cols-1 gap-1.5">
                      {(o.status === 'ENVIADO' || o.status === 'CREADO') && (
                        <Button
                          size="sm"
                          onClick={() => handleStatusChange(o.id, 'EN_PREPARACION')}
                          disabled={actionLoading === `${o.id}-EN_PREPARACION`}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Play className="h-3 w-3 mr-1" /> Empezar a preparar
                        </Button>
                      )}
                      {o.status === 'EN_PREPARACION' && (
                        <Button
                          size="sm"
                          onClick={() => handleStatusChange(o.id, 'LISTO')}
                          disabled={actionLoading === `${o.id}-LISTO`}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Marcar como listo
                        </Button>
                      )}
                      {o.status === 'LISTO' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleStatusChange(o.id, 'SERVIDO')}
                          disabled={actionLoading === `${o.id}-SERVIDO`}
                        >
                          <Utensils className="h-3 w-3 mr-1" /> Marcar como servido
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Collapsible>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
