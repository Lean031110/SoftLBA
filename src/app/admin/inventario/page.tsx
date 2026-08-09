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
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import {
  Archive, Search, RefreshCw, AlertTriangle, ClipboardCheck, Scale, Loader2, History,
} from 'lucide-react'

type AreaItem = {
  id: string
  stock: number
  reserved: number
  minStock: number
  product: {
    id: string
    code: string
    name: string
    type: string
    category?: string | null
    unit: string
    cost: number
    price: number
    minStock: number
    isActive: boolean
  }
}

type Area = { id: string; code: string; name: string }

export default function InventarioAreasPage() {
  const [areas, setAreas] = useState<Area[]>([])
  const [areaId, setAreaId] = useState('')
  const [items, setItems] = useState<AreaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [lowStock, setLowStock] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (areaId) params.set('areaId', areaId)
      if (q) params.set('q', q)
      if (lowStock) params.set('lowStock', 'true')
      const res = await fetch(`/api/admin/inventario?${params.toString()}`)
      const data = await res.json()
      if (data.ok) {
        setAreas(data.areas || [])
        setItems(data.items || [])
      } else {
        setError(data.error || 'Error al cargar')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [areaId, q, lowStock])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Archive className="h-6 w-6" /> Inventario por Áreas
          </h1>
          <p className="text-sm text-stone-500">Stock de cada área · Conteos físicos y comparaciones</p>
        </div>
        {areaId && (
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/admin/inventario/comparacion?areaId=${areaId}`}>
                <Scale className="h-4 w-4 mr-2" /> Teórico vs Físico
              </Link>
            </Button>
            <PhysicalStockDialog areaId={areaId} items={items} onDone={load} />
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5 min-w-[200px]">
              <Label className="text-xs text-stone-500">Área</Label>
              <Select value={areaId} onValueChange={setAreaId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Selecciona área..." /></SelectTrigger>
                <SelectContent>
                  {areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px] space-y-1.5">
              <Label className="text-xs text-stone-500">Buscar producto</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Código o nombre..." className="pl-8" />
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 border rounded-md">
              <Switch id="low-area" checked={lowStock} onCheckedChange={setLowStock} />
              <Label htmlFor="low-area" className="text-sm cursor-pointer">Solo stock bajo</Label>
            </div>
            <Button variant="outline" onClick={load}>
              <RefreshCw className="h-4 w-4 mr-2" /> Actualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {!areaId ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-stone-500">
            Selecciona un área para ver su inventario
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-2">
                {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
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
                No hay productos en esta área
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-right">Mínimo</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((i) => {
                      const low = i.stock <= (i.minStock || 0)
                      return (
                        <TableRow key={i.id} className={low ? 'bg-red-50 dark:bg-red-950/30' : ''}>
                          <TableCell>
                            <div className="font-medium">{i.product.name}</div>
                            <div className="text-xs text-stone-500 font-mono">{i.product.code}</div>
                          </TableCell>
                          <TableCell className="text-sm">{i.product.category || '—'}</TableCell>
                          <TableCell className="text-right">
                            <span className={`font-mono font-semibold ${low ? 'text-red-600' : ''}`}>
                              {i.stock} {i.product.unit}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-xs text-stone-500">{i.minStock}</TableCell>
                          <TableCell className="text-right font-mono text-xs">${(i.stock * i.product.cost).toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            <AdjustDialog item={i} onDone={load} />
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
      )}
    </div>
  )
}

function AdjustDialog({ item, onDone }: { item: AreaItem; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [stock, setStock] = useState(String(item.stock))
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/inventario/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: parseFloat(stock), reason }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Stock ajustado')
        setOpen(false)
        onDone()
      } else {
        toast.error(data.error || 'Error al ajustar')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost"><Scale className="h-3.5 w-3.5 mr-1" /> Ajustar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar stock</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md bg-stone-100 dark:bg-stone-800 p-3 text-sm">
            <div className="font-medium">{item.product.name}</div>
            <div className="text-xs text-stone-500">Stock actual: {item.stock} {item.product.unit}</div>
          </div>
          <div className="space-y-1.5">
            <Label>Nuevo stock (cantidad final)</Label>
            <Input type="number" step="0.01" value={stock} onChange={(e) => setStock(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Motivo</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Conteo físico, pérdida, etc." />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PhysicalStockDialog({
  areaId, items, onDone,
}: { areaId: string; items: AreaItem[]; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  function openDialog() {
    const initial: Record<string, string> = {}
    for (const it of items) initial[it.product.id] = String(it.stock)
    setCounts(initial)
    setOpen(true)
  }

  async function submit() {
    setSaving(true)
    try {
      const payload = {
        areaId,
        items: items.map((it) => ({
          productId: it.product.id,
          countedQty: parseFloat(counts[it.product.id] || '0'),
        })),
      }
      const res = await fetch('/api/admin/inventario/physical-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Conteo físico registrado')
        setOpen(false)
        onDone()
      } else {
        toast.error(data.error || 'Error al registrar')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button onClick={openDialog}>
          <ClipboardCheck className="h-4 w-4 mr-2" /> Conteo físico
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Conteo físico de inventario</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto -mx-2 px-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Teórico</TableHead>
                <TableHead className="text-right">Contado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>
                    <div className="font-medium text-sm">{it.product.name}</div>
                    <div className="text-xs text-stone-500 font-mono">{it.product.code}</div>
                  </TableCell>
                  <TableCell className="text-right text-xs">{it.stock} {it.product.unit}</TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8 w-24 ml-auto"
                      value={counts[it.product.id] ?? ''}
                      onChange={(e) => setCounts((c) => ({ ...c, [it.product.id]: e.target.value }))}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Registrar conteo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
