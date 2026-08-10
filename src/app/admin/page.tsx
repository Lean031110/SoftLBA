'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { LoadingScreen } from '@/components/loading'
import {
  Users, ShoppingCart, Wallet, Package, AlertTriangle,
  Newspaper, TrendingUp, Clock, Activity, DollarSign, RefreshCw, Bell,
} from 'lucide-react'
import { ROLE_LABELS, ROLE_BADGE_COLORS } from '@/lib/permissions'
import { toast } from 'sonner'

type DashboardData = {
  stats: {
    totalUsers: number
    totalProducts: number
    activeProducts: number
    ordersToday: number
    salesToday: number
    pendingOrders: number
    newsCount: number
    customersCount: number
  }
  salesByMethod: { method: string; total: number; count: number }[]
  salesByArea: { area: string; total: number; count: number }[]
  lowStock: {
    id: string
    stock: number
    minStock: number
    product: { name: string; code: string }
    area: { name: string }
  }[]
  recentOrders: {
    id: string
    number: number
    status: string
    total: number
    createdAt: string
    user: string
    area: string
  }[]
}

const METHOD_LABELS: Record<string, string> = {
  EFECTIVO_CUP: 'Efectivo CUP',
  EFECTIVO_USD: 'Efectivo USD',
  TRANSFERENCIA_CUP: 'Transf. CUP',
  TRANSFERENCIA_USD: 'Transf. USD',
  ZELLE: 'Zelle',
  BANCARIA_USD: 'Bancaria USD',
  COMBINADO: 'Combinado',
}

const STATUS_COLORS: Record<string, string> = {
  CREADO: 'bg-stone-100 text-stone-800',
  ENVIADO: 'bg-blue-100 text-blue-800',
  EN_PREPARACION: 'bg-amber-100 text-amber-800',
  LISTO: 'bg-emerald-100 text-emerald-800',
  SERVIDO: 'bg-purple-100 text-purple-800',
  COBRADO: 'bg-green-100 text-green-800',
  ARCHIVADO: 'bg-stone-100 text-stone-600',
  CANCELADO: 'bg-red-100 text-red-800',
}

const STATUS_LABELS: Record<string, string> = {
  CREADO: 'Creado',
  ENVIADO: 'Enviado',
  EN_PREPARACION: 'En preparación',
  LISTO: 'Listo',
  SERVIDO: 'Servido',
  COBRADO: 'Cobrado',
  ARCHIVADO: 'Archivado',
  CANCELADO: 'Cancelado',
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [usdRate, setUsdRate] = useState('320')
  const [rateLoading, setRateLoading] = useState(false)
  const [lastRateUpdate, setLastRateUpdate] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setData(d)
        else setError(d.error || 'Error al cargar')
      })
      .catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false))
    // Cargar tasa de cambio
    fetch('/api/public/config')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.config) {
          setUsdRate(String(d.config.usdToCup || 320))
          setLastRateUpdate(d.config.lastRateUpdate || null)
        }
      })
      .catch(() => {})
  }, [])

  async function updateRate() {
    setRateLoading(true)
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usdToCup: parseFloat(usdRate) }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Tasa de cambio actualizada')
        setLastRateUpdate(new Date().toISOString())
      } else {
        toast.error(data.error || 'Error al actualizar')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setRateLoading(false)
    }
  }

  // Verificar si la tasa no se ha actualizado hoy
  const rateNeedsUpdate = () => {
    if (!lastRateUpdate) return true
    const last = new Date(lastRateUpdate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return last < today
  }

  if (loading) {
    return <LoadingScreen message="Cargando dashboard..." />
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error || 'Error desconocido'}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Panel de Administración</h1>
        <p className="text-sm text-stone-500">Resumen general del día</p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Ventas de hoy"
          value={`$${data.stats.salesToday.toFixed(2)}`}
          icon={<Wallet className="h-5 w-5" />}
          accent="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
        />
        <StatCard
          title="Pedidos hoy"
          value={data.stats.ordersToday.toString()}
          icon={<ShoppingCart className="h-5 w-5" />}
          accent="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
          sub={`${data.stats.pendingOrders} pendientes`}
        />
        <StatCard
          title="Usuarios activos"
          value={data.stats.totalUsers.toString()}
          icon={<Users className="h-5 w-5" />}
          accent="bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
        />
        <StatCard
          title="Productos"
          value={data.stats.activeProducts.toString()}
          icon={<Package className="h-5 w-5" />}
          accent="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
          sub={`${data.stats.totalProducts} totales`}
        />
      </div>

      {/* Widget de tasa de cambio + recordatorio */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className={rateNeedsUpdate() ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20' : ''}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-600" />
              Tasa de cambio USD → CUP
            </CardTitle>
            <CardDescription>
              {lastRateUpdate
                ? `Última actualización: ${new Date(lastRateUpdate).toLocaleString('es-CU')}`
                : 'Nunca actualizada'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-xs">1 USD =</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={usdRate}
                  onChange={(e) => setUsdRate(e.target.value)}
                  className="w-28"
                  min="0"
                  step="1"
                />
                <span className="text-sm text-slate-500">CUP</span>
                <Button size="sm" onClick={updateRate} disabled={rateLoading}>
                  {rateLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  <span className="ml-1">Actualizar</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {rateNeedsUpdate() && (
          <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center shrink-0">
                <Bell className="h-5 w-5 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm text-amber-800 dark:text-amber-200">
                  Recordatorio diario
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  Verifica si ha cambiado el precio del dólar hoy y actualiza la tasa de cambio.
                  Esto asegura que los cobros en USD se calculen correctamente.
                </p>
                <Button size="sm" variant="outline" className="mt-2 text-xs" onClick={updateRate} disabled={rateLoading}>
                  Actualizar ahora
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Ventas por método */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Ventas por método (hoy)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.salesByMethod.length === 0 ? (
              <p className="text-sm text-stone-500 text-center py-4">Aún no hay cobros registrados hoy</p>
            ) : (
              <div className="space-y-2">
                {data.salesByMethod.map((m) => (
                  <div key={m.method} className="flex items-center justify-between text-sm">
                    <span>{METHOD_LABELS[m.method] || m.method}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{m.count}</Badge>
                      <span className="font-semibold">${m.total.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ventas por área */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Ventas por área (hoy)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.salesByArea.length === 0 ? (
              <p className="text-sm text-stone-500 text-center py-4">Aún no hay pedidos hoy</p>
            ) : (
              <div className="space-y-2">
                {data.salesByArea.map((a, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span>{a.area}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{a.count} pedidos</Badge>
                      <span className="font-semibold">${a.total.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Pedidos recientes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Últimos pedidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentOrders.length === 0 ? (
              <p className="text-sm text-stone-500 text-center py-4">No hay pedidos recientes</p>
            ) : (
              <div className="space-y-3">
                {data.recentOrders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-3 text-sm border-b pb-2 last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="font-medium">#{o.number} · {o.user}</p>
                      <p className="text-xs text-stone-500">{o.area} · {new Date(o.createdAt).toLocaleTimeString('es-CU')}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-semibold">${o.total.toFixed(2)}</span>
                      <Badge className={STATUS_COLORS[o.status] || STATUS_COLORS.CREADO} variant="secondary">
                        {STATUS_LABELS[o.status] || o.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stock bajo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Stock bajo
            </CardTitle>
            <CardDescription>Productos con stock mínimo alcanzado</CardDescription>
          </CardHeader>
          <CardContent>
            {data.lowStock.length === 0 ? (
              <p className="text-sm text-emerald-600 text-center py-4">Todo el stock está en niveles saludables</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data.lowStock.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{s.product.name}</p>
                      <p className="text-xs text-stone-500">{s.area.name} · {s.product.code}</p>
                    </div>
                    <Badge variant="destructive" className="shrink-0">
                      {s.stock} {s.product && 'u'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({
  title, value, icon, accent, sub,
}: { title: string; value: string; icon: React.ReactNode; accent: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-stone-500 uppercase tracking-wider">{title}</p>
          <div className={`rounded-lg p-1.5 ${accent}`}>{icon}</div>
        </div>
        <p className="mt-2 text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-stone-500 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}
