'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Save, AlertTriangle } from 'lucide-react'
import { SubproductManager } from '@/components/admin/subproduct-manager'

type Form = {
  code: string
  name: string
  description: string
  type: 'DIRECTO' | 'FINAL' | 'SUBPRODUCTO'
  category: string
  unit: string
  cost: string
  price: string
  minStock: string
  isActive: boolean
  isAvailable: boolean
  imageUrl: string
  notes: string
  areaId: string
}

export default function EditarProductoPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [areas, setAreas] = useState<{ id: string; name: string; code: string }[]>([])

  useEffect(() => {
    fetch('/api/admin/areas')
      .then((r) => r.json())
      .then((d) => { if (d.ok) setAreas(d.items || d.areas || []) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch(`/api/admin/productos/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.item) {
          const i = d.item
          setForm({
            code: i.code,
            name: i.name,
            description: i.description || '',
            type: i.type,
            category: i.category || '',
            unit: i.unit || 'unidad',
            cost: String(i.cost ?? 0),
            price: String(i.price ?? 0),
            minStock: String(i.minStock ?? 0),
            isActive: i.isActive,
            isAvailable: i.isAvailable,
            imageUrl: i.imageUrl || '',
            notes: i.notes || '',
            areaId: i.areaId || '',
          })
        } else {
          setError(d.error || 'No encontrado')
        }
      })
      .catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false))
  }, [id])

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    setError(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/productos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!data.ok) {
        setError(data.error || 'Error al guardar')
        toast.error(data.error || 'Error al guardar')
      } else {
        toast.success('Cambios guardados')
        router.push('/admin/productos')
        router.refresh()
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (error || !form) {
    return (
      <div className="max-w-3xl mx-auto">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error || 'No encontrado'}</AlertDescription>
        </Alert>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/admin/productos">Volver</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/productos"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">Editar producto</h1>
          <p className="text-sm text-stone-500 font-mono">{form.code}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos del producto</CardTitle>
          <CardDescription>Edita la información del producto. Los cambios se guardan al hacer clic en "Guardar cambios".</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="code">Código *</Label>
                <Input id="code" value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} required maxLength={50} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input id="name" value={form.name} onChange={(e) => set('name', e.target.value)} required maxLength={120} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="type">Tipo</Label>
                <Select value={form.type} onValueChange={(v) => set('type', v as Form['type'])}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DIRECTO">Directo</SelectItem>
                    <SelectItem value="FINAL">Final</SelectItem>
                    <SelectItem value="SUBPRODUCTO">Subproducto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoría</Label>
                <Input id="category" value={form.category} onChange={(e) => set('category', e.target.value)} maxLength={80} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unidad</Label>
                <Select value={form.unit} onValueChange={(v) => set('unit', v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unidad">Unidad</SelectItem>
                    <SelectItem value="kg">Kilogramo</SelectItem>
                    <SelectItem value="g">Gramo</SelectItem>
                    <SelectItem value="litro">Litro</SelectItem>
                    <SelectItem value="ml">Mililitro</SelectItem>
                    <SelectItem value="porción">Porción</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="cost">Costo</Label>
                <Input id="cost" type="number" step="0.01" min="0" value={form.cost} onChange={(e) => set('cost', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Precio de venta</Label>
                <Input id="price" type="number" step="0.01" min="0" value={form.price} onChange={(e) => set('price', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minStock">Stock mínimo</Label>
                <Input id="minStock" type="number" step="0.01" min="0" value={form.minStock} onChange={(e) => set('minStock', e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea id="description" value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={500} rows={2} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="imageUrl">URL de imagen</Label>
              <Input id="imageUrl" value={form.imageUrl} onChange={(e) => set('imageUrl', e.target.value)} maxLength={500} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="areaId">Área asignada</Label>
              <Select value={form.areaId} onValueChange={(v) => set('areaId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin área específica (visible en todas)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin área específica (visible en todas)</SelectItem>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Si asignas un área, el producto solo aparecerá en el menú del mesero cuando seleccione esa área.
                Si lo dejas sin área, aparecerá en todas las áreas.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas internas</Label>
              <Textarea id="notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} maxLength={500} rows={2} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label htmlFor="isActive" className="font-medium">Producto activo</Label>
                  <p className="text-xs text-stone-500">Si está inactivo, no aparece</p>
                </div>
                <Switch id="isActive" checked={form.isActive} onCheckedChange={(v) => set('isActive', v)} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label htmlFor="isAvailable" className="font-medium">Disponible</Label>
                  <p className="text-xs text-stone-500">Marcar como agotado</p>
                </div>
                <Switch id="isAvailable" checked={form.isAvailable} onCheckedChange={(v) => set('isAvailable', v)} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" asChild>
                <Link href="/admin/productos">Cancelar</Link>
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>

      {/* Gestión de subproductos (solo para productos finales) */}
      {form.type === 'FINAL' && (
        <SubproductManager productId={id} />
      )}
    </div>
  )
}
