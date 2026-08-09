'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import {
  ArrowLeft, Loader2, Save, Plus, Trash2, AlertTriangle, BookOpen,
} from 'lucide-react'

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

export default function EditarRecetaPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [products, setProducts] = useState<Product[]>([])
  const [product, setProduct] = useState<Product | null>(null)
  const [yieldV, setYieldV] = useState('1')
  const [preparationTime, setPreparationTime] = useState('0')
  const [instructions, setInstructions] = useState('')
  const [notes, setNotes] = useState('')
  const [ingredients, setIngredients] = useState<Ingredient[]>([])

  const [selProduct, setSelProduct] = useState('')
  const [selQty, setSelQty] = useState('1')

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/productos').then((r) => r.json()),
      fetch(`/api/admin/recipes/${id}`).then((r) => r.json()),
    ]).then(([prodData, recData]) => {
      if (prodData.ok) setProducts(prodData.items || [])
      if (recData.ok && recData.item) {
        const r = recData.item
        setProduct(r.product)
        setYieldV(String(r.yield))
        setPreparationTime(String(r.preparationTime || 0))
        setInstructions(r.instructions || '')
        setNotes(r.notes || '')
        setIngredients((r.ingredients || []).map((i: any) => ({
          productId: i.productId,
          quantity: String(i.quantity),
          unit: i.unit,
          notes: i.notes || '',
        })))
      } else {
        setError(recData.error || 'No encontrada')
      }
    }).catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false))
  }, [id])

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
    if (ingredients.length === 0) {
      setError('Agrega al menos un ingrediente')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/recipes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        setError(data.error || 'Error al guardar')
        toast.error(data.error || 'Error al guardar')
      } else {
        toast.success('Receta actualizada')
        router.push('/admin/recetas')
        router.refresh()
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    try {
      const res = await fetch(`/api/admin/recipes/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.ok) {
        toast.success('Receta eliminada')
        router.push('/admin/recetas')
        router.refresh()
      } else {
        toast.error(data.error || 'Error al eliminar')
      }
    } catch {
      toast.error('Error de conexión')
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

  if (error || !product) {
    return (
      <div className="max-w-3xl mx-auto">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error || 'No encontrada'}</AlertDescription>
        </Alert>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/admin/recetas">Volver</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/recetas"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">Receta de {product.name}</h1>
          <p className="text-sm text-stone-500 font-mono">{product.code}</p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline"><Trash2 className="h-4 w-4 mr-2" /> Eliminar</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar receta?</AlertDialogTitle>
              <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" /> Detalles</CardTitle>
            <CardDescription>Producto: {product.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Rendimiento (porciones)</Label>
                <Input type="number" step="0.01" min="0" value={yieldV} onChange={(e) => setYieldV(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tiempo de preparación (min)</Label>
                <Input type="number" min="0" value={preparationTime} onChange={(e) => setPreparationTime(e.target.value)} />
              </div>
              <div className="flex items-end gap-2">
                <Badge variant="secondary">Precio: ${product.price.toFixed(2)}</Badge>
                <Badge variant="outline">Margen: ${(product.price - totalCost).toFixed(2)}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Ingredientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3 items-end">
              <div className="space-y-2 sm:col-span-2">
                <Label>Agregar ingrediente</Label>
                <Select value={selProduct} onValueChange={setSelProduct}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Buscar producto..." /></SelectTrigger>
                  <SelectContent>
                    {products.filter((p) => p.isActive && p.id !== product.id && !ingredients.some((i) => i.productId === p.id)).map((p) => (
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
                  <Input type="number" step="0.01" min="0" value={selQty} onChange={(e) => setSelQty(e.target.value)} />
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
                    const p = products.find((x) => x.id === ing.productId)
                    if (!p) return null
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
              <p className="text-sm text-stone-500 text-center py-4">No hay ingredientes</p>
            )}

            <div className="flex justify-between items-center border-t pt-3">
              <span className="text-sm font-medium">Costo total:</span>
              <span className="text-xl font-bold">${totalCost.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader><CardTitle>Preparación y notas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Instrucciones</Label>
              <Textarea rows={4} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Notas internas</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/recetas">Cancelar</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </form>
    </div>
  )
}
