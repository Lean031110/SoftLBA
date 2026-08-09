'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import {
  BookOpen, Plus, AlertTriangle, ChevronLeft, ChevronRight, Trash2, RefreshCw,
} from 'lucide-react'

type Entry = {
  id: string
  type: string
  category: string
  description: string
  amount: number
  currency: string
  reference?: string | null
  createdAt: string
  user?: { username: string; firstName?: string | null; lastName?: string | null } | null
}

const TYPE_COLORS: Record<string, string> = {
  INGRESO: 'bg-emerald-100 text-emerald-800',
  EGRESO: 'bg-red-100 text-red-800',
  VENTA: 'bg-emerald-100 text-emerald-800',
  COMPRA: 'bg-amber-100 text-amber-800',
  SALARIO: 'bg-purple-100 text-purple-800',
  GASTO: 'bg-stone-100 text-stone-800',
  MERMA: 'bg-red-100 text-red-800',
  AJUSTE: 'bg-sky-100 text-sky-800',
}

export default function FinanzasEntriesPage() {
  const [items, setItems] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [type, setType] = useState('all')
  const [category, setCategory] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (type !== 'all') params.set('type', type)
      if (category) params.set('category', category)
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (q) params.set('q', q)
      params.set('page', String(page))
      const res = await fetch(`/api/admin/finanzas/entries?${params.toString()}`)
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
  }, [type, category, from, to, q, page])

  useEffect(() => { load() }, [load])

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/admin/finanzas/entries/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.ok) {
        toast.success('Movimiento eliminado')
        load()
      } else {
        toast.error(data.error || 'Error al eliminar')
      }
    } catch {
      toast.error('Error de conexión')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" /> Movimientos financieros
          </h1>
          <p className="text-sm text-stone-500">Lista de ingresos, egresos, ventas y gastos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-2" /> Actualizar</Button>
          <Button asChild><Link href="/admin/finanzas/entries/nuevo"><Plus className="h-4 w-4 mr-2" /> Nuevo movimiento</Link></Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-500">Tipo</Label>
              <Select value={type} onValueChange={(v) => { setType(v); setPage(1) }}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="INGRESO">Ingreso</SelectItem>
                  <SelectItem value="EGRESO">Egreso</SelectItem>
                  <SelectItem value="VENTA">Venta</SelectItem>
                  <SelectItem value="COMPRA">Compra</SelectItem>
                  <SelectItem value="SALARIO">Salario</SelectItem>
                  <SelectItem value="GASTO">Gasto</SelectItem>
                  <SelectItem value="MERMA">Merma</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-500">Categoría</Label>
              <Input value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-500">Desde</Label>
              <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-500">Hasta</Label>
              <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-500">Buscar</Label>
              <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} placeholder="Descripción..." />
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
                    <TableHead>Descripción</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(e.createdAt).toLocaleString('es-CU')}
                      </TableCell>
                      <TableCell>
                        <Badge className={TYPE_COLORS[e.type] || 'bg-stone-100'} variant="secondary">{e.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{e.description}</div>
                        {e.reference && <div className="text-xs text-stone-500">Ref: {e.reference}</div>}
                      </TableCell>
                      <TableCell className="text-xs">{e.category}</TableCell>
                      <TableCell className="text-xs">
                        {e.user ? `${e.user.firstName || ''} ${e.user.lastName || ''}`.trim() || e.user.username : '—'}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-semibold ${['INGRESO', 'VENTA'].includes(e.type) ? 'text-emerald-600' : 'text-red-600'}`}>
                        {['INGRESO', 'VENTA'].includes(e.type) ? '+' : '-'}${e.amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-red-600" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Se eliminará el movimiento <strong>{e.description}</strong> de ${e.amount.toFixed(2)}.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove(e.id)}>Eliminar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
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
