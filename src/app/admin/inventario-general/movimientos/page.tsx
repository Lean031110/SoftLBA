'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { History, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'

type Movement = {
  id: string
  type: string
  quantity: number
  unit: string
  reason?: string | null
  reference?: string | null
  createdAt: string
  product: { code: string; name: string; unit: string }
  area?: { code: string; name: string } | null
  user?: { username: string; firstName?: string | null; lastName?: string | null } | null
}

const TYPE_LABELS: Record<string, string> = {
  ENTRADA: 'Entrada',
  SALIDA: 'Salida',
  TRASLADO: 'Traslado',
  AJUSTE: 'Ajuste',
  MERMA: 'Merma',
  COMPRA: 'Compra',
}
const TYPE_COLORS: Record<string, string> = {
  ENTRADA: 'bg-emerald-100 text-emerald-800',
  SALIDA: 'bg-amber-100 text-amber-800',
  TRASLADO: 'bg-sky-100 text-sky-800',
  AJUSTE: 'bg-stone-100 text-stone-800',
  MERMA: 'bg-red-100 text-red-800',
  COMPRA: 'bg-purple-100 text-purple-800',
}

export default function MovimientosPage() {
  const [items, setItems] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [type, setType] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (type !== 'all') params.set('type', type)
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      params.set('page', String(page))
      const res = await fetch(`/api/admin/inventario-general/movimientos?${params.toString()}`)
      const data = await res.json()
      if (data.ok) {
        setItems(data.items || [])
        setTotalPages(data.pagination?.totalPages || 1)
        setTotal(data.pagination?.total || 0)
      } else {
        setError(data.error || 'Error al cargar')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [type, from, to, page])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <History className="h-6 w-6" /> Movimientos de inventario
        </h1>
        <p className="text-sm text-stone-500">Historial de entradas, salidas, ajustes, mermas y traslados</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-500">Tipo</Label>
              <Select value={type} onValueChange={(v) => { setType(v); setPage(1) }}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ENTRADA">Entrada</SelectItem>
                  <SelectItem value="SALIDA">Salida</SelectItem>
                  <SelectItem value="TRASLADO">Traslado</SelectItem>
                  <SelectItem value="AJUSTE">Ajuste</SelectItem>
                  <SelectItem value="MERMA">Merma</SelectItem>
                  <SelectItem value="COMPRA">Compra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-500">Desde</Label>
              <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-500">Hasta</Label>
              <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} />
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={() => setPage(1)}>Aplicar</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : error ? (
            <div className="p-6">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-sm text-stone-500">No hay movimientos</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead>Área</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Razón</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(m.createdAt).toLocaleString('es-CU')}
                      </TableCell>
                      <TableCell>
                        <Badge className={TYPE_COLORS[m.type] || 'bg-stone-100'} variant="secondary">
                          {TYPE_LABELS[m.type] || m.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{m.product.name}</div>
                        <div className="text-xs text-stone-500 font-mono">{m.product.code}</div>
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm ${
                        ['SALIDA', 'MERMA'].includes(m.type) ? 'text-red-600' :
                        ['ENTRADA', 'COMPRA'].includes(m.type) ? 'text-emerald-600' : ''
                      }`}>
                        {['SALIDA', 'MERMA'].includes(m.type) ? '-' : ['ENTRADA', 'COMPRA'].includes(m.type) ? '+' : ''}
                        {Math.abs(m.quantity)} {m.unit}
                      </TableCell>
                      <TableCell className="text-xs">{m.area ? m.area.name : <span className="text-stone-400">General</span>}</TableCell>
                      <TableCell className="text-xs">
                        {m.user ? `${m.user.firstName || ''} ${m.user.lastName || ''}`.trim() || m.user.username : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-stone-500 max-w-xs truncate">{m.reason || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-xs text-stone-500">{total} movimientos</p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">Página {page} de {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
