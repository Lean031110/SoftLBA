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
  Archive, Plus, Search, RefreshCw, AlertTriangle, ArrowRightLeft, History, Loader2,
} from 'lucide-react'

type InventoryItem = {
  id: string
  stock: number
  reserved: number
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

const MOVEMENT_TYPES = [
  { value: 'ENTRADA', label: 'Entrada' },
  { value: 'SALIDA', label: 'Salida' },
  { value: 'AJUSTE', label: 'Ajuste (cantidad final)' },
  { value: 'MERMA', label: 'Merma / Pérdida' },
  { value: 'COMPRA', label: 'Compra (con costo)' },
]

export default function InventarioGeneralPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [lowStock, setLowStock] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (lowStock) params.set('lowStock', 'true')
      const res = await fetch(`/api/admin/inventario-general?${params.toString()}`)
      const data = await res.json()
      if (data.ok) setItems(data.items || [])
      else setError(data.error || 'Error al cargar')
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [q, lowStock])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/mesero/areas')
      .then((r) => r.json())
      .then((d) => d.ok && setAreas(d.items || []))
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Archive className="h-6 w-6" /> Inventario General
          </h1>
          <p className="text-sm text-stone-500">Almacén central · Gestión de stock, entradas, salidas y traslados</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/inventario-general/movimientos">
            <History className="h-4 w-4 mr-2" /> Ver movimientos
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px] space-y-1.5">
              <label className="text-xs text-stone-500">Buscar producto</label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Código o nombre..." className="pl-8" />
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 border rounded-md">
              <Switch id="low" checked={lowStock} onCheckedChange={setLowStock} />
              <Label htmlFor="low" className="text-sm cursor-pointer">Solo stock bajo</Label>
            </div>
            <Button variant="outline" onClick={load}>
              <RefreshCw className="h-4 w-4 mr-2" /> Actualizar
            </Button>
          </div>
        </CardContent>
      </Card>

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
              No hay productos en inventario general
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
                    <TableHead className="text-right">Costo</TableHead>
                    <TableHead className="text-right">Valor total</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((i) => {
                    const low = i.stock <= (i.product.minStock || 0)
                    return (
                      <TableRow key={i.id} className={low ? 'bg-red-50 dark:bg-red-950/30' : ''}>
                        <TableCell>
                          <div className="font-medium">{i.product.name}</div>
                          <div className="text-xs text-stone-500 font-mono">{i.product.code}</div>
                        </TableCell>
                        <TableCell className="text-sm">{i.product.category || <span className="text-stone-400">—</span>}</TableCell>
                        <TableCell className="text-right">
                          <span className={`font-mono font-semibold ${low ? 'text-red-600' : ''}`}>
                            {i.stock} {i.product.unit}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-xs text-stone-500">{i.product.minStock}</TableCell>
                        <TableCell className="text-right font-mono text-xs">${i.product.cost.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">${(i.stock * i.product.cost).toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <MoveDialog item={i} onDone={load} />
                            <TrasladoDialog item={i} areas={areas} onDone={load} />
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

function MoveDialog({ item, onDone }: { item: InventoryItem; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState('ENTRADA')
  const [qty, setQty] = useState('0')
  const [reason, setReason] = useState('')
  const [unitCost, setUnitCost] = useState(String(item.product.cost))
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    try {
      const payload: any = {
        productId: item.product.id,
        type,
        quantity: parseFloat(qty),
        reason,
        reference,
      }
      if (type === 'COMPRA') payload.unitCost = parseFloat(unitCost)
      const res = await fetch('/api/admin/inventario-general', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Movimiento registrado')
        setOpen(false)
        setQty('0')
        setReason('')
        setReference('')
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
        <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1" /> Movimiento</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Movimiento de inventario</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md bg-stone-100 dark:bg-stone-800 p-3 text-sm">
            <div className="font-medium">{item.product.name}</div>
            <div className="text-xs text-stone-500">Stock actual: {item.stock} {item.product.unit}</div>
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de movimiento</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MOVEMENT_TYPES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{type === 'AJUSTE' ? 'Cantidad final' : 'Cantidad'}</Label>
              <Input type="number" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            {type === 'COMPRA' && (
              <div className="space-y-1.5">
                <Label>Costo unitario</Label>
                <Input type="number" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Referencia (opcional)</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Factura, proveedor..." />
          </div>
          <div className="space-y-1.5">
            <Label>Motivo / Nota</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
          <Button onClick={submit} disabled={saving || parseFloat(qty) === 0}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TrasladoDialog({ item, areas, onDone }: { item: InventoryItem; areas: Area[]; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [areaId, setAreaId] = useState('')
  const [qty, setQty] = useState('0')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!areaId) {
      toast.error('Selecciona un área')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/inventario-general/traslado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: item.product.id,
          areaId,
          quantity: parseFloat(qty),
          reason,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Traslado realizado')
        setOpen(false)
        setQty('0')
        setReason('')
        setAreaId('')
        onDone()
      } else {
        toast.error(data.error || 'Error al trasladar')
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
        <Button size="sm" variant="ghost"><ArrowRightLeft className="h-3.5 w-3.5 mr-1" /> Traslado</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Traslado a área</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md bg-stone-100 dark:bg-stone-800 p-3 text-sm">
            <div className="font-medium">{item.product.name}</div>
            <div className="text-xs text-stone-500">Stock disponible: {item.stock} {item.product.unit}</div>
          </div>
          <div className="space-y-1.5">
            <Label>Área destino</Label>
            <Select value={areaId} onValueChange={setAreaId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Selecciona..." /></SelectTrigger>
              <SelectContent>
                {areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Cantidad a trasladar</Label>
            <Input type="number" step="0.01" min="0" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Motivo (opcional)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
          <Button onClick={submit} disabled={saving || parseFloat(qty) <= 0}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Trasladar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
