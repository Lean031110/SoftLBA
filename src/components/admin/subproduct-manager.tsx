'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2, Plus, Trash2, AlertCircle, Link2, Package } from 'lucide-react'
import { toast } from 'sonner'

type Subproduct = {
  id: string
  quantity: number
  subproductId: string
  subproduct: {
    id: string
    code: string
    name: string
    unit: string
    cost: number
    type: string
  }
}

type AvailableProduct = {
  id: string
  code: string
  name: string
  unit: string
  cost: number
}

export function SubproductManager({ productId }: { productId: string }) {
  const [loading, setLoading] = useState(true)
  const [subproducts, setSubproducts] = useState<Subproduct[]>([])
  const [available, setAvailable] = useState<AvailableProduct[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [subsRes, prodsRes] = await Promise.all([
        fetch(`/api/admin/productos/${productId}/subproducts`).then((r) => r.json()),
        fetch('/api/admin/productos?isActive=true&pageSize=200').then((r) => r.json()),
      ])
      if (subsRes.ok) setSubproducts(subsRes.items || [])
      if (prodsRes.ok) {
        const usedIds = new Set((subsRes.items || []).map((s: Subproduct) => s.subproductId))
        const availableSubs = (prodsRes.items || []).filter((p: AvailableProduct) =>
          p.id !== productId && !usedIds.has(p.id)
        )
        setAvailable(availableSubs)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    load()
  }, [load])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId) {
      toast.error('Selecciona un producto')
      return
    }
    const qty = parseFloat(quantity)
    if (!qty || qty <= 0) {
      toast.error('Cantidad inválida')
      return
    }
    setAdding(true)
    try {
      const res = await fetch(`/api/admin/productos/${productId}/subproducts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subproductId: selectedId, quantity: qty }),
      })
      const data = await res.json()
      if (!data.ok) {
        toast.error(data.error || 'Error al añadir')
        return
      }
      toast.success('Subproducto añadido')
      setSelectedId('')
      setQuantity('1')
      await load()
    } catch (e) {
      toast.error('Error de conexión')
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(subId: string, name: string) {
    if (!confirm(`¿Quitar "${name}" de los subproductos?`)) return
    try {
      const res = await fetch(`/api/admin/productos/${productId}/subproducts?subId=${subId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!data.ok) {
        toast.error(data.error || 'Error al quitar')
        return
      }
      toast.success('Subproducto quitado')
      await load()
    } catch (e) {
      toast.error('Error de conexión')
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4" />
            Subproductos asociados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    )
  }

  const totalCost = subproducts.reduce((sum, s) => sum + s.subproduct.cost * s.quantity, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4" />
          Subproductos asociados
        </CardTitle>
        <CardDescription>
          Productos preelaborados necesarios para fabricar este producto final.
          Costo total estimado: <strong>${totalCost.toFixed(2)}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {subproducts.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Este producto final no tiene subproductos asociados todavía.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-2">
            {subproducts.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Package className="h-5 w-5 text-slate-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{s.subproduct.name}</p>
                    <p className="text-xs text-slate-500">
                      {s.subproduct.code} · {s.quantity} {s.subproduct.unit} · ${s.subproduct.cost.toFixed(2)}/{s.subproduct.unit}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className="text-xs">
                    ${(s.subproduct.cost * s.quantity).toFixed(2)}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleRemove(s.id, s.subproduct.name)}
                    aria-label="Quitar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {available.length > 0 && (
          <form onSubmit={handleAdd} className="rounded-lg border p-3 space-y-3 bg-slate-50 dark:bg-slate-900">
            <p className="text-sm font-medium flex items-center gap-1">
              <Plus className="h-4 w-4" /> Añadir subproducto
            </p>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              <div className="space-y-1">
                <Label htmlFor="subproduct" className="text-xs">Producto</Label>
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger id="subproduct">
                    <SelectValue placeholder="Selecciona un producto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.code}) · ${p.cost.toFixed(2)}/{p.unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="qty" className="text-xs">Cantidad</Label>
                <Input
                  id="qty"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-24"
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={adding || !selectedId}>
                  {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
