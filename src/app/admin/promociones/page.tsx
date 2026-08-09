'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import {
  Receipt, Plus, RefreshCw, AlertTriangle, Pencil, Trash2, ToggleLeft, ToggleRight,
} from 'lucide-react'

type Promotion = {
  id: string
  name: string
  description?: string | null
  type: string
  discountPct: number
  discountAmount: number
  startDate: string
  endDate?: string | null
  isActive: boolean
  customerId?: string | null
}

const TYPE_LABELS: Record<string, string> = {
  GENERAL: 'General',
  CLIENTE: 'Cliente',
  PRODUCTO: 'Producto',
}
const TYPE_COLORS: Record<string, string> = {
  GENERAL: 'bg-emerald-100 text-emerald-800',
  CLIENTE: 'bg-sky-100 text-sky-800',
  PRODUCTO: 'bg-amber-100 text-amber-800',
}

export default function PromocionesPage() {
  const router = useRouter()
  const [items, setItems] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState('all')
  const [type, setType] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (active !== 'all') params.set('active', active)
      if (type !== 'all') params.set('type', type)
      const res = await fetch(`/api/admin/promociones?${params.toString()}`)
      const data = await res.json()
      if (data.ok) setItems(data.items || [])
      else setError(data.error || 'Error al cargar')
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [active, type])

  useEffect(() => { load() }, [load])

  async function toggleActive(p: Promotion) {
    try {
      const res = await fetch(`/api/admin/promociones/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !p.isActive }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success(`Promoción ${!p.isActive ? 'activada' : 'desactivada'}`)
        load()
      } else {
        toast.error(data.error || 'Error al actualizar')
      }
    } catch {
      toast.error('Error de conexión')
    }
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar esta promoción?')) return
    try {
      const res = await fetch(`/api/admin/promociones/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.ok) {
        toast.success('Promoción eliminada')
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
            <Receipt className="h-6 w-6" /> Promociones
          </h1>
          <p className="text-sm text-stone-500">Descuentos y ofertas especiales</p>
        </div>
        <Button onClick={() => router.push('/admin/promociones/nuevo')}>
          <Plus className="h-4 w-4 mr-2" /> Nueva promoción
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5 min-w-[140px]">
              <label className="text-xs text-stone-500">Tipo</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="GENERAL">General</SelectItem>
                  <SelectItem value="CLIENTE">Cliente</SelectItem>
                  <SelectItem value="PRODUCTO">Producto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 min-w-[140px]">
              <label className="text-xs text-stone-500">Estado</label>
              <Select value={active} onValueChange={setActive}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="true">Activas</SelectItem>
                  <SelectItem value="false">Inactivas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-2" /> Actualizar</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-2">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : error ? (
            <div className="p-6">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-sm text-stone-500">No hay promociones</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Descuento</TableHead>
                    <TableHead>Vigencia</TableHead>
                    <TableHead className="text-center">Activa</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((p) => {
                    const today = new Date()
                    const start = new Date(p.startDate)
                    const end = p.endDate ? new Date(p.endDate) : null
                    const isExpired = end ? end < today : false
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <Link href={`/admin/promociones/${p.id}`} className="font-medium hover:underline">
                            {p.name}
                          </Link>
                          {p.description && <div className="text-xs text-stone-500 truncate max-w-xs">{p.description}</div>}
                        </TableCell>
                        <TableCell>
                          <Badge className={TYPE_COLORS[p.type]} variant="secondary">{TYPE_LABELS[p.type]}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {p.discountPct > 0 && <span className="font-semibold">{p.discountPct}%</span>}
                          {p.discountPct > 0 && p.discountAmount > 0 && <span> + </span>}
                          {p.discountAmount > 0 && <span className="font-semibold">${p.discountAmount}</span>}
                          {p.discountPct === 0 && p.discountAmount === 0 && <span className="text-stone-400">—</span>}
                        </TableCell>
                        <TableCell className="text-xs">
                          {start.toLocaleDateString('es-CU')}
                          {end ? ` - ${end.toLocaleDateString('es-CU')}` : ' - ∞'}
                          {isExpired && <Badge variant="destructive" className="ml-2 text-xs">Expirada</Badge>}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button size="icon" variant="ghost" onClick={() => toggleActive(p)} aria-label="Toggle activa">
                            {p.isActive ? <ToggleRight className="h-5 w-5 text-emerald-600" /> : <ToggleLeft className="h-5 w-5 text-stone-400" />}
                          </Button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => router.push(`/admin/promociones/${p.id}`)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => remove(p.id)}>
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
