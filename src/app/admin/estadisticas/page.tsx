'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from 'recharts'
import {
  BarChart3, TrendingUp, ShoppingBag, DollarSign, Award, Package, AlertTriangle, Calendar,
} from 'lucide-react'

type Stats = {
  period: string
  date: string
  range: { start: string; end: string }
  summary: {
    totalSales: number
    totalOrders: number
    totalCash: number
    totalTransfer: number
    totalDiscount: number
    totalWaste: number
    totalDiscrepancy: number
    averageTicket: number
  }
  topProducts: { name: string; code: string; category: string; quantity: number; revenue: number }[]
  topWaiters: { name: string; username: string; orders: number; sales: number }[]
  methods: { method: string; count: number; total: number }[]
  areas: { name: string; orders: number; sales: number }[]
  mermas: { amount: number; category: string; description: string; createdAt: string }[]
  dailyCloses: { date: string; difference: number; status: string }[]
  chartData: { day: string; sales: number; orders: number }[]
}

const COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe', '#1e40af', '#1e3a8a']
const METHOD_LABELS: Record<string, string> = {
  EFECTIVO_CUP: 'Efectivo CUP',
  EFECTIVO_USD: 'Efectivo USD',
  TRANSFERENCIA_CUP: 'Transf. CUP',
  TRANSFERENCIA_USD: 'Transf. USD',
  ZELLE: 'Zelle',
  BANCARIA_USD: 'Bancaria USD',
  COMBINADO: 'Combinado',
}

export default function EstadisticasPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [period, setPeriod] = useState('daily')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('period', period)
      params.set('date', date)
      const res = await fetch(`/api/admin/estadisticas?${params.toString()}`)
      const data = await res.json()
      if (data.ok) {
        setStats(data)
      } else {
        setError(data.error || 'Error al cargar')
      }
    } catch (e) {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [period, date])

  useEffect(() => { load() }, [load])

  const periodLabels: Record<string, string> = {
    daily: 'Día',
    weekly: 'Semana',
    monthly: 'Mes',
    yearly: 'Año',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Estadísticas
          </h1>
          <p className="text-sm text-slate-500">Análisis de ventas, productos y desempeño</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Diario</SelectItem>
              <SelectItem value="weekly">Semanal</SelectItem>
              <SelectItem value="monthly">Mensual</SelectItem>
              <SelectItem value="yearly">Anual</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : error || !stats ? (
        <Alert variant="destructive"><AlertDescription>{error || 'No hay datos'}</AlertDescription></Alert>
      ) : (
        <>
          {/* Resumen */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title={`Ventas del ${periodLabels[period].toLowerCase()}`}
              value={`$${stats.summary.totalSales.toFixed(2)}`}
              icon={<DollarSign className="h-5 w-5" />}
              accent="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
            />
            <StatCard
              title="Pedidos"
              value={String(stats.summary.totalOrders)}
              icon={<ShoppingBag className="h-5 w-5" />}
              accent="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
              sub={`Ticket prom: $${stats.summary.averageTicket.toFixed(2)}`}
            />
            <StatCard
              title="Efectivo"
              value={`$${stats.summary.totalCash.toFixed(2)}`}
              icon={<DollarSign className="h-5 w-5" />}
              accent="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
              sub={`Transf: $${stats.summary.totalTransfer.toFixed(2)}`}
            />
            <StatCard
              title="Descuadres"
              value={`$${stats.summary.totalDiscrepancy.toFixed(2)}`}
              icon={<AlertTriangle className="h-5 w-5" />}
              accent="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
              sub={`Mermas: $${stats.summary.totalWaste.toFixed(2)}`}
            />
          </div>

          {/* Gráfico de ventas por día */}
          {stats.chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Ventas por día
                </CardTitle>
                <CardDescription>Evolución de ventas en el período seleccionado</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={stats.chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: number, name: string) =>
                        name === 'sales' ? [`$${value.toFixed(2)}`, 'Ventas'] : [value, 'Pedidos']
                      }
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Line type="monotone" dataKey="sales" stroke="#2563eb" strokeWidth={2} name="Ventas" />
                    <Line type="monotone" dataKey="orders" stroke="#10b981" strokeWidth={2} name="Pedidos" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Top productos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" /> Productos más vendidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.topProducts.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">No hay datos</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.topProducts.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                      <Tooltip formatter={(v: number) => [`${v} u`, 'Cantidad']} contentStyle={{ fontSize: 12 }} />
                      <Bar dataKey="quantity" fill="#2563eb" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Top dependientes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="h-4 w-4" /> Dependientes destacados
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.topWaiters.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">No hay datos</p>
                ) : (
                  <div className="space-y-2">
                    {stats.topWaiters.map((w, i) => (
                      <div key={w.username} className="flex items-center justify-between gap-2 rounded-lg border p-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                            i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-200 text-slate-700' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'
                          }`}>{i + 1}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{w.name}</p>
                            <p className="text-xs text-slate-500">@{w.username} · {w.orders} pedidos</p>
                          </div>
                        </div>
                        <p className="font-bold text-blue-600 shrink-0">${w.sales.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Métodos de pago */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Métodos de pago
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.methods.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">No hay datos</p>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={stats.methods.map((m) => ({ name: METHOD_LABELS[m.method] || m.method, value: m.total }))}
                        dataKey="value"
                        nameKey="name"
                        cx="50%" cy="50%" outerRadius={80}
                        label={(entry) => `${entry.name}: $${entry.value.toFixed(0)}`}
                        labelLine={false}
                      >
                        {stats.methods.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} contentStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Ventas por área */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> Ventas por área
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.areas.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">No hay datos</p>
                ) : (
                  <div className="space-y-3">
                    {stats.areas.map((a, i) => {
                      const maxSales = Math.max(...stats.areas.map((x) => x.sales))
                      const pct = maxSales > 0 ? (a.sales / maxSales) * 100 : 0
                      return (
                        <div key={i}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">{a.name}</span>
                            <span className="text-slate-500">${a.sales.toFixed(2)} ({a.orders} pedidos)</span>
                          </div>
                          <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Mermas */}
          {stats.mermas.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> Mermas del período
                </CardTitle>
                <CardDescription>Total: ${stats.summary.totalWaste.toFixed(2)}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {stats.mermas.map((m, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-sm border-b pb-1 last:border-0">
                      <div className="min-w-0 flex-1">
                        <span className="font-medium">{m.description || m.category}</span>
                        <span className="text-xs text-slate-500 ml-2">{new Date(m.createdAt).toLocaleString('es-CU')}</span>
                      </div>
                      <Badge variant="destructive" className="text-xs">${m.amount.toFixed(2)}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function StatCard({ title, value, icon, accent, sub }: { title: string; value: string; icon: React.ReactNode; accent: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-slate-500 uppercase">{title}</p>
          <div className={`rounded-lg p-1.5 ${accent}`}>{icon}</div>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  )
}
