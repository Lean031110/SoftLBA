'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Save, Plus, Trash2, BookOpen } from 'lucide-react'

type Product = {
  id: string
  code: string
  name: string
  unit: string
  cost: number
  type: string
  category?: string | null
}

type Ingredient = {
  productId: string
  quantity: string
  unit: string
  notes: string
}

export default function NuevaRecetaPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [finalProducts, setFinalProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [productId, setProductId] = useState('')
  const [yieldV, setYieldV] = useState('1')
  const [preparationTime, setPreparationTime] = useState('0')
  const [instructions, setInstructions] = useState('')
  const [notes, setNotes] = useState('')
  const [ingredients, setIngredients] = useState<Ingredient[]>([])

  // Para agregar ingrediente
  const [selProduct, setSelProduct] = useState('')
  const [selQty, setSelQty] = useState('1')

  useEffect(() => {
    fetch('/api/admin/productos')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setProducts(d.items || [])
          setFinalProducts((d.items || []).filter((p: Product) => p.type === 'FINAL' && p.isActive))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const product = products.find((p) => p.id === productId)
  const selectedIng = products.find((p) => p.id === selProduct)

  const totalCost = ingredients.reduce((s, i) => {
    const p = products.find((x) => x.id === i.productId)
    return s + (p ? parseFloat(i.quantity || '0') * p.cost : 0)
  }, 0)

  function addIngredient() {
    if (!selProduct) {
      toast.error('Selecciona un ingrediente')
      return
    }
    if (parseFloat(selQty) <= 0) {
      toast.error('Cantidad inválida')
      return
    }
    if (ingredients.some((i) => i.productId === selProduct)) {
      toast.error('Ya agregaste este ingrediente')
      return
    }
    const p = products.find((x) => x.id === selProduct)!
    setIngredients([...ingredients, {
      productId: selProduct,
      quantity: selQty,
      unit: p.unit,
      notes: '',
    }])
    setSelProduct('')
    setSelQty('1')
  }

  function removeIngredient(idx: number) {
    setIngredients(ingredients.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!productId) {
      setError('Selecciona un producto final')
      return
    }
    if (ingredients.length === 0) {
      setError('Agrega al menos un ingrediente')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          yield: parseFloat(yieldV) || 1,
          preparationTime: parseInt(preparationTime) || 0,
          instructions,
          notes,
          ingredients: ingredients.map((i) => ({
            productId: i.productId,
            quantity: parseFloat(i.quantity),
            unit: i.unit,
            notes: i.notes,
          })),
        }),
      })
      const data = await res.json()
      if (!data.ok) {
        setError(data.error || 'Error al crear receta')
        setSaving(false)
        return
      }
      toast.success('Receta creada')
      router.push('/admin/recetas')
      router.refresh()
    } catch {
      setError('Error de conexión')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/recetas"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" /> Nueva receta
          </h1>
          <p className="text-sm text-stone-500">Define los ingredientes y cantidades de un producto final</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Producto y rendimiento</CardTitle>
            <CardDescription>Elige el producto final al que se asociará la receta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-2">
                <Label>Producto final *</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                  <SelectContent>
                    {finalProducts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Rendimiento (porciones)</Label>
                <Input type="number" step="0.01" min="0" value={yieldV} onChange={(e) => setYieldV(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tiempo de preparación (min)</Label>
                <Input type="number" min="0" value={preparationTime} onChange={(e) => setPreparationTime(e.target.value)} />
              </div>
              {product && (
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary">Precio venta: ${product.price.toFixed(2)}</Badge>
                  <Badge variant="outline">Margen: ${(product.price - totalCost).toFixed(2)}</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Ingredientes</CardTitle>
            <CardDescription>Agrega los productos que componen la receta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3 items-end">
              <div className="space-y-2 sm:col-span-2">
                <Label>Ingrediente</Label>
                <Select value={selProduct} onValueChange={setSelProduct}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Buscar producto..." /></SelectTrigger>
                  <SelectContent>
                    {products.filter((p) => p.isActive && p.id !== productId).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.code}) · ${p.cost.toFixed(2)}/{p.unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cantidad</Label>
                <div className="flex gap-2">
                  <Input
                    type="number" step="0.01" min="0"
                    value={selQty}
                    onChange={(e) => setSelQty(e.target.value)}
                  />
                  <Button type="button" onClick={addIngredient}><Plus className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>

            {selectedIng && (
              <p className="text-xs text-stone-500">
                Unidad: {selectedIng.unit} · Costo: ${selectedIng.cost.toFixed(2)}/{selectedIng.unit}
              </p>
            )}

            {ingredients.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Costo unit.</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ingredients.map((ing, idx) => {
                    const p = products.find((x) => x.id === ing.productId)!
                    const sub = parseFloat(ing.quantity) * p.cost
                    return (
                      <TableRow key={ing.productId}>
                        <TableCell>
                          <div className="font-medium text-sm">{p.name}</div>
                          <div className="text-xs text-stone-500 font-mono">{p.code}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number" step="0.01" className="h-8 w-24 ml-auto"
                            value={ing.quantity}
                            onChange={(e) => setIngredients(ingredients.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))}
                          />
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">${p.cost.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">${sub.toFixed(2)}</TableCell>
                        <TableCell>
                          <Button type="button" size="icon" variant="ghost" onClick={() => removeIngredient(idx)}>
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-stone-500 text-center py-4">No hay ingredientes agregados</p>
            )}

            <div className="flex justify-between items-center border-t pt-3">
              <span className="text-sm font-medium">Costo total:</span>
              <span className="text-xl font-bold">${totalCost.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Preparación y notas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Instrucciones de preparación</Label>
              <Textarea
                rows={4}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Pasos para preparar la receta..."
              />
            </div>
            <div className="space-y-2">
              <Label>Notas internas</Label>
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/recetas">Cancelar</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {saving ? 'Guardando...' : 'Crear receta'}
          </Button>
        </div>
      </form>
    </div>
  )
}
