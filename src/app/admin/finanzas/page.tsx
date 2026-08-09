'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import {
  Wallet, TrendingUp, TrendingDown, Scale, Plus, AlertTriangle, BookOpen,
} from 'lucide-react'

type Summary = {
  period: string
  range: { from: string; to: string }
  totals: {
    ingresos: number
    egresos: number
    balance: number
    ventas: number
    compras: number
    salarios: number
    mermas: number
    count: number
  }
  chartData: { day: string; ingresos: number; egresos: number }[]
}

const PERIODS = [
  { value: 'today', label: 'Hoy' },
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mes' },
  { value: 'range', label: 'Rango personalizado' },
]

export default function FinanzasDashboardPage() {
  const [period, setPeriod] = useState('today')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [data, setData] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recent, setRecent] = useState<any[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('period', period)
      if (period === 'range') {
        if (from) params.set('from', from)
        if (to) params.set('to', to)
      }
      const [sRes, rRes] = await Promise.all([
        fetch(`/api/admin/finanzas/summary?${params.toString()}`),
        fetch(`/api/admin/finanzas/entries?pageSize=10`),
      ])
      const s = await sRes.json()
      const r = await rRes.json()
      if (s.ok) setData(s)
      else setError(s.error || 'Error al cargar')
      if (r.ok) setRecent(r.items || [])
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [period, from, to])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6" /> Finanzas
          </h1>
          <p className="text-sm text-stone-500">Resumen general de ingresos y egresos</p>
        </div>
        <Button asChild>
          <Link href="/admin/finanzas/entries">
            <BookOpen className="h-4 w-4 mr-2" /> Ver movimientos
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5 min-w-[200px]">
              <Label className="text-xs text-stone-500">Período</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {period === 'range' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs text-stone-500">Desde</Label>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-stone-500">Hasta</Label>
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              title="Ingresos"
              value={data.totals.ingresos}
              icon={<TrendingUp className="h-5 w-5" />}
              accent="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
            />
            <StatCard
              title="Egresos"
              value={data.totals.egresos}
              icon={<TrendingDown className="h-5 w-5" />}
              accent="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
            />
            <StatCard
              title="Balance"
              value={data.totals.balance}
              icon={<Scale className="h-5 w-5" />}
              accent="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MiniCard title="Ventas" value={data.totals.ventas} />
            <MiniCard title="Compras" value={data.totals.compras} />
            <MiniCard title="Salarios" value={data.totals.salarios} />
            <MiniCard title="Mermas" value={data.totals.mermas} />
          </div>

          {data.chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Ingresos vs Egresos por día</CardTitle>
                <CardDescription>{data.totals.count} movimientos en el período</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(v: number) => `$${v.toFixed(2)}`}
                      labelFormatter={(l) => `Día: ${l}`}
                    />
                    <Legend />
                    <Bar dataKey="ingresos" name="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="egresos" name="Egresos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Últimos movimientos</CardTitle>
            </CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <p className="text-sm text-stone-500 text-center py-4">No hay movimientos</p>
              ) : (
                <div className="space-y-2">
                  {recent.map((e: any) => (
                    <div key={e.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{e.description}</p>
                        <p className="text-xs text-stone-500">
                          {new Date(e.createdAt).toLocaleString('es-CU')} · {e.category}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="secondary">{e.type}</Badge>
                        <span className={`font-semibold ${['INGRESO', 'VENTA'].includes(e.type) ? 'text-emerald-600' : 'text-blue-600'}`}>
                          {['INGRESO', 'VENTA'].includes(e.type) ? '+' : '-'}${e.amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}

function StatCard({
  title, value, icon, accent,
}: { title: string; value: number; icon: React.ReactNode; accent: string }) {
  const isNeg = value < 0
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-stone-500 uppercase tracking-wider">{title}</p>
          <div className={`rounded-lg p-1.5 ${accent}`}>{icon}</div>
        </div>
        <p className={`mt-2 text-2xl font-bold ${isNeg ? 'text-blue-600' : ''}`}>
          ${Math.abs(value).toFixed(2)}
          {isNeg && <span className="text-sm ml-1">(-)</span>}
        </p>
      </CardContent>
    </Card>
  )
}

function MiniCard({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-stone-500">{title}</p>
        <p className="text-lg font-bold mt-1">${value.toFixed(2)}</p>
      </CardContent>
    </Card>
  )
}
