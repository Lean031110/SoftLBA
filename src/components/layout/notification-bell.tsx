'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Check, X, BellOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useRealtimeContext } from '@/components/realtime/realtime-provider'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type Notification = {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
  data?: string | null
}

const TYPE_COLORS: Record<string, string> = {
  INFO: 'bg-blue-500',
  WARNING: 'bg-amber-500',
  URGENT: 'bg-red-500',
  SUCCESS: 'bg-emerald-500',
  ORDER: 'bg-purple-500',
  STOCK: 'bg-orange-500',
}

const TYPE_LABELS: Record<string, string> = {
  INFO: 'Info',
  WARNING: 'Aviso',
  URGENT: 'Urgente',
  SUCCESS: 'OK',
  ORDER: 'Pedido',
  STOCK: 'Stock',
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'hace un momento'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `hace ${days} d`
}

export function NotificationBell({ userId, role }: { userId?: string; role?: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=30')
      const data = await res.json()
      if (data.ok) {
        setNotifications(data.notifications || [])
        setUnread(data.unreadCount || 0)
      }
    } catch (e) {
      console.error('notification load error', e)
    }
  }, [])

  useEffect(() => {
    if (userId) load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [userId, load])

  // Solicitar permiso de notificaciones nativas del navegador
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      setPushEnabled(true)
    }
  }, [])

  // Función para mostrar notificación nativa (funciona aunque la web no esté en primer plano)
  const showNativeNotification = useCallback((title: string, body: string, data?: any) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, {
          body,
          icon: '/softlba-logo.png',
          badge: '/softlba-favicon.png',
          tag: data?.tag || 'softlba',
          data: data || {},
        } as NotificationOptions)
        notif.onclick = () => {
          window.focus()
          if (data?.url) {
            router.push(data.url)
          }
          notif.close()
        }
        // Auto-cerrar después de 10 segundos
        setTimeout(() => notif.close(), 10000)
      } catch (e) {
        console.error('Native notification error:', e)
      }
    }
  }, [router])

  // Función para reproducir sonido
  const playSound = useCallback((frequency: number, duration: number, repeat: number = 1) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      for (let i = 0; i < repeat; i++) {
        setTimeout(() => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.frequency.value = frequency
          gain.gain.value = 0.3
          osc.start()
          osc.stop(ctx.currentTime + duration)
        }, i * (duration * 1000 + 100))
      }
      if ('vibrate' in navigator) navigator.vibrate(repeat > 1 ? [200, 100, 200, 100, 200] : 200)
    } catch {}
  }, [])

  // Sonido y toast cuando llega una nueva notificación por WebSocket
  // v1.0.20-rc-final: usar el socket singleton del RealtimeProvider
  // en vez de crear uno nuevo por componente.
  const realtimeCtx = useRealtimeContext()
  const connected = realtimeCtx?.connected ?? false

  // Solicitar permiso de notificaciones al cargar si no está concedido
  useEffect(() => {
    if (userId && 'Notification' in window && Notification.permission === 'default') {
      // Auto-solicitar después de 3 segundos
      const timer = setTimeout(() => {
        Notification.requestPermission().then((perm) => {
          if (perm === 'granted') setPushEnabled(true)
        })
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [userId])

  // Solicitar permiso de notificaciones
  async function requestPushPermission() {
    if (!('Notification' in window)) {
      toast.error('Tu navegador no soporta notificaciones')
      return
    }
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      setPushEnabled(true)
      toast.success('Notificaciones activadas. Te avisaremos aunque la web no esté abierta.')
      // Enviar notificación de prueba
      try {
        new Notification('SoftLBA - Notificaciones activadas', {
          body: 'Recibirás alertas de pedidos y estados en tiempo real.',
          icon: '/softlba-logo.png',
          badge: '/softlba-favicon.png',
          tag: 'softlba-welcome',
        })
      } catch {}
    } else {
      toast.error('Permiso de notificaciones denegado')
    }
  }

  async function markAllRead() {
    setLoading(true)
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
      await load()
    } finally {
      setLoading(false)
    }
  }

  async function markOne(id: string) {
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      await load()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {/* FRONTEND-04 (FE-020): h-10 (40px) en mobile, size-9 (36px) en
            desktop. WCAG 2.5.5 recomienda 44px mínimo. */}
        <Button variant="ghost" size="icon" className="relative h-10 w-10 md:h-9 md:w-9" aria-label="Notificaciones">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
          {connected && (
            <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-1 ring-white" title="Conectado" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 sm:w-96 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="font-medium text-sm">Notificaciones</span>
            {unread > 0 && (
              <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                {unread} sin leer
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!pushEnabled && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={requestPushPermission}>
                Activar
              </Button>
            )}
            {unread > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead} disabled={loading}>
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                Leídas
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-stone-500">
              <BellOff className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No tienes notificaciones
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    'p-3 hover:bg-stone-50 dark:hover:bg-stone-800/50 cursor-pointer transition-colors',
                    !n.isRead && 'bg-blue-50/50 dark:bg-blue-950/30'
                  )}
                  onClick={() => {
                    if (!n.isRead) markOne(n.id)
                    // Si tiene orderId, ir al pedido
                    try {
                      const data = n.data ? JSON.parse(n.data) : {}
                      if (data.orderId) {
                        router.push(`/mesero/pedidos/${data.orderId}`)
                      }
                    } catch {}
                    setOpen(false)
                  }}
                >
                  <div className="flex items-start gap-2">
                    <span className={cn('h-2 w-2 rounded-full mt-1.5 shrink-0', TYPE_COLORS[n.type] || 'bg-stone-400')} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-stone-500 uppercase">
                          {TYPE_LABELS[n.type] || n.type}
                        </span>
                        <span className="text-[10px] text-stone-400">
                          {timeAgo(n.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm font-medium truncate">{n.title}</p>
                      <p className="text-xs text-stone-600 dark:text-stone-400 line-clamp-2">{n.message}</p>
                    </div>
                    {!n.isRead && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          markOne(n.id)
                        }}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
