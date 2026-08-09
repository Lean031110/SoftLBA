'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
  Package, Plus, Search, RefreshCw, Power, Pencil, AlertTriangle, ToggleLeft, ToggleRight,
} from 'lucide-react'

type ProductItem = {
  id: string
  code: string
  name: string
  description?: string | null
  type: 'DIRECTO' | 'FINAL' | 'SUBPRODUCTO'
  category?: string | null
  unit: string
  cost: number
  price: number
  minStock: number
  isActive: boolean
  isAvailable: boolean
  imageUrl?: string | null
  createdAt: string
}

const TYPE_LABELS: Record<string, string> = {
  DIRECTO: 'Directo',
  FINAL: 'Final',
  SUBPRODUCTO: 'Subproducto',
}
const TYPE_COLORS: Record<string, string> = {
  DIRECTO: 'bg-sky-100 text-sky-800',
  FINAL: 'bg-emerald-100 text-emerald-800',
  SUBPRODUCTO: 'bg-amber-100 text-amber-800',
}

export default function ProductosListPage() {
  const router = useRouter()
  const [items, setItems] = useState<ProductItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [type, setType] = useState<string>('all')
  const [category, setCategory] = useState<string>('')
  const [active, setActive] = useState<string>('all')
  const [available, setAvailable] = useState<string>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (type !== 'all') params.set('type', type)
      if (category) params.set('category', category)
      if (active !== 'all') params.set('isActive', active)
      if (available !== 'all') params.set('isAvailable', available)
      const res = await fetch(`/api/admin/productos?${params.toString()}`)
      const data = await res.json()
      if (data.ok) setItems(data.items || [])
      else setError(data.error || 'Error al cargar')
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [q, type, category, active, available])

  useEffect(() => { load() }, [load])

  async function toggleField(p: ProductItem, field: 'isActive' | 'isAvailable') {
    const newValue = !p[field]
    try {
      const res = await fetch(`/api/admin/productos/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: newValue }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success(`${field === 'isActive' ? 'Producto' : 'Disponibilidad'} ${newValue ? 'activad' : 'desactivad'}o`)
        load()
      } else {
        toast.error(data.error || 'Error al actualizar')
      }
    } catch {
      toast.error('Error de conexión')
    }
  }

  const categories = Array.from(new Set(items.map((i) => i.category).filter(Boolean))) as string[]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6" /> Productos
          </h1>
          <p className="text-sm text-stone-500">Catálogo de productos y subproductos</p>
        </div>
        <Button onClick={() => router.push('/admin/productos/nuevo')}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo producto
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5 lg:col-span-2">
              <label className="text-xs text-stone-500">Buscar</label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Código, nombre..." className="pl-8" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-stone-500">Tipo</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="DIRECTO">Directo</SelectItem>
                  <SelectItem value="FINAL">Final</SelectItem>
                  <SelectItem value="SUBPRODUCTO">Subproducto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-stone-500">Categoría</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-stone-500">Estado</label>
              <Select value={active} onValueChange={setActive}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="true">Activos</SelectItem>
                  <SelectItem value="false">Inactivos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <Button variant="outline" onClick={load}>
              <RefreshCw className="h-4 w-4 mr-2" /> Actualizar
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-stone-500">Disponibilidad:</span>
              <Select value={available} onValueChange={setAvailable}>
                <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="true">Disponibles</SelectItem>
                  <SelectItem value="false">No disponibles</SelectItem>
                </SelectContent>
              </Select>
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
            <div className="p-10 text-center text-sm text-stone-500">
              No hay productos que coincidan con los filtros
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-center">Activo</TableHead>
                  <TableHead className="text-center">Disponible</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/admin/productos/${p.id}`} className="font-mono text-xs text-blue-700 hover:underline">
                        {p.code}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      {p.description && <div className="text-xs text-stone-500 truncate max-w-xs">{p.description}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge className={TYPE_COLORS[p.type]} variant="secondary">{TYPE_LABELS[p.type]}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{p.category || <span className="text-stone-400">—</span>}</TableCell>
                    <TableCell className="text-right font-mono text-xs">${p.cost.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">${p.price.toFixed(2)}</TableCell>
                    <TableCell className="text-center">
                      <Button size="icon" variant="ghost" onClick={() => toggleField(p, 'isActive')} aria-label="Toggle activo">
                        {p.isActive ? <ToggleRight className="h-5 w-5 text-emerald-600" /> : <ToggleLeft className="h-5 w-5 text-stone-400" />}
                      </Button>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button size="icon" variant="ghost" onClick={() => toggleField(p, 'isAvailable')} aria-label="Toggle disponible">
                        {p.isAvailable ? <ToggleRight className="h-5 w-5 text-emerald-600" /> : <ToggleLeft className="h-5 w-5 text-stone-400" />}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => router.push(`/admin/productos/${p.id}`)} aria-label="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {p.isActive && (
                          <Button size="icon" variant="ghost" onClick={() => toggleField(p, 'isActive')} aria-label="Desactivar">
                            <Power className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
