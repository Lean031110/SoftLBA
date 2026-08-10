'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  History, Calendar, TrendingUp, ShoppingBag, DollarSign, ChevronDown, ChevronUp, Search,
} from 'lucide-react'

type HistoryGroup = {
  period: string
  orders: any[]
  totalSales: number
  totalOrders: number
  totalDiscount: number
  items: { productId: string; productName: string; productCode: string; quantity: number; revenue: number }[]
}

type Summary = {
  totalOrders: number
  totalSales: number
  methodSummary: Record<string, number>
}

export default function HistoricosPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [groups, setGroups] = useState<HistoryGroup[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 })
  const [type, setType] = useState('daily')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('type', type)
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      params.set('page', String(pagination.page))
      params.set('pageSize', String(pagination.pageSize))
      const res = await fetch(`/api/admin/historicos?${params.toString()}`)
      const data = await res.json()
      if (data.ok) {
        setGroups(data.items || [])
        setSummary(data.summary || null)
        setPagination(data.pagination || pagination)
      } else {
        setError(data.error || 'Error al cargar')
      }
    } catch (e) {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [type, from, to, pagination.page, pagination.pageSize])

  useEffect(() => { load() }, [load])

  function handleSearch() {
    setPagination({ ...pagination, page: 1 })
    load()
  }

  const filteredGroups = groups.map((g) => ({
    ...g,
    orders: g.orders.filter((o: any) => {
      if (!search) return true
      const s = search.toLowerCase()
      return (
        String(o.number).includes(s) ||
        (o.user?.firstName || '').toLowerCase().includes(s) ||
        (o.user?.lastName || '').toLowerCase().includes(s) ||
        (o.area?.name || '').toLowerCase().includes(s)
      )
    }),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <History className="h-6 w-6" />
          Históricos
        </h1>
        <p className="text-sm text-slate-500">Consulta el historial de pedidos, cierres y movimientos por período</p>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={type} onValueChange={(v) => { setType(v); setPagination({ ...pagination, page: 1 }) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diario</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensual</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pedido, mesero, área..."
                  className="pl-8"
                />
              </div>
            </div>
            <div className="flex items-end">
              <Button onClick={handleSearch} className="w-full">
                <Calendar className="h-4 w-4 mr-1" /> Filtrar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase">Total pedidos</p>
                <p className="text-2xl font-bold">{summary.totalOrders}</p>
              </div>
              <ShoppingBag className="h-8 w-8 text-blue-500 opacity-50" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase">Total ventas</p>
                <p className="text-2xl font-bold text-blue-600">${summary.totalSales.toFixed(2)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-500 opacity-50" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 uppercase mb-2">Por método</p>
              <div className="space-y-1">
                {Object.entries(summary.methodSummary || {}).map(([method, amount]) => (
                  <div key={method} className="flex justify-between text-sm">
                    <span className="text-slate-600">{method.replace(/_/g, ' ')}</span>
                    <span className="font-medium">${amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Grupos */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : error ? (
        <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
      ) : filteredGroups.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-slate-500">
            <History className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p className="font-medium">No hay datos para el período seleccionado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group) => (
            <Card key={group.period}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setExpandedPeriod(expandedPeriod === group.period ? null : group.period)}
                    >
                      {expandedPeriod === group.period ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-blue-500" />
                        {group.period}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {group.totalOrders} pedido(s) · ${group.totalSales.toFixed(2)} en ventas
                        {group.totalDiscount > 0 && ` · $${group.totalDiscount.toFixed(2)} en descuentos`}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {group.items.length} productos
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              {expandedPeriod === group.period && (
                <CardContent className="pt-0">
                  {/* Top productos del período */}
                  {group.items.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Productos más vendidos</p>
                      <div className="space-y-1">
                        {group.items.slice(0, 10).map((item, idx) => (
                          <div key={item.productId} className="flex items-center justify-between gap-2 text-sm border-b pb-1 last:border-0">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="text-xs font-bold text-slate-400 w-5">#{idx + 1}</span>
                              <span className="font-medium truncate">{item.productName}</span>
                              <Badge variant="outline" className="text-[10px] shrink-0">{item.productCode}</Badge>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs text-slate-500">{item.quantity} u</span>
                              <span className="font-medium text-blue-600">${item.revenue.toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Lista de pedidos */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Pedidos</p>
                    <ScrollArea className="max-h-60">
                      <div className="space-y-1">
                        {group.orders.map((order: any) => (
                          <div key={order.id} className="flex items-center justify-between gap-2 text-xs border-b pb-1 last:border-0">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="font-medium">#{order.number}</span>
                              <span className="text-slate-500 truncate">
                                {order.user?.firstName || ''} {order.user?.lastName || ''}
                              </span>
                              <span className="text-slate-400">·</span>
                              <span className="text-slate-500">{order.area?.name || ''}</span>
                              <span className="text-slate-400">·</span>
                              <span className="text-slate-500">{order.itemsCount} items</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant="secondary" className="text-[10px]">{order.status}</Badge>
                              <span className="font-medium">${order.total.toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}

          {/* Paginación */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Página {pagination.page} de {pagination.totalPages} · {pagination.total} registros
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
