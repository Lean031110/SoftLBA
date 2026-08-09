'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Save, PackagePlus } from 'lucide-react'

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
}

const INITIAL: Form = {
  code: '',
  name: '',
  description: '',
  type: 'FINAL',
  category: '',
  unit: 'unidad',
  cost: '0',
  price: '0',
  minStock: '0',
  isActive: true,
  isAvailable: true,
  imageUrl: '',
  notes: '',
}

export default function NuevoProductoPage() {
  const router = useRouter()
  const [form, setForm] = useState<Form>(INITIAL)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.code.trim() || !form.name.trim()) {
      setError('Código y nombre son obligatorios')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!data.ok) {
        setError(data.error || 'Error al crear producto')
        setSaving(false)
        return
      }
      toast.success('Producto creado')
      router.push('/admin/productos')
      router.refresh()
    } catch {
      setError('Error de conexión')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/productos"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PackagePlus className="h-6 w-6" /> Nuevo producto
          </h1>
          <p className="text-sm text-stone-500">Agrega un producto al catálogo</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos del producto</CardTitle>
          <CardDescription>El código debe ser único. El costo es informativo, el precio es el que se cobra al cliente.</CardDescription>
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
                <Label htmlFor="code">Código <span className="text-red-500">*</span></Label>
                <Input id="code" value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} required maxLength={50} placeholder="Ej: PIZ-001" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nombre <span className="text-red-500">*</span></Label>
                <Input id="name" value={form.name} onChange={(e) => set('name', e.target.value)} required maxLength={120} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="type">Tipo</Label>
                <Select value={form.type} onValueChange={(v) => set('type', v as Form['type'])}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DIRECTO">Directo (sin recipe)</SelectItem>
                    <SelectItem value="FINAL">Final (se prepara)</SelectItem>
                    <SelectItem value="SUBPRODUCTO">Subproducto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoría</Label>
                <Input id="category" value={form.category} onChange={(e) => set('category', e.target.value)} maxLength={80} placeholder="Ej: Pizzas, Bebidas..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unidad</Label>
                <Select value={form.unit} onValueChange={(v) => set('unit', v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unidad">Unidad</SelectItem>
                    <SelectItem value="kg">Kilogramo (kg)</SelectItem>
                    <SelectItem value="g">Gramo (g)</SelectItem>
                    <SelectItem value="litro">Litro (l)</SelectItem>
                    <SelectItem value="ml">Mililitro (ml)</SelectItem>
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
              <Label htmlFor="description">Descripción (opcional)</Label>
              <Textarea id="description" value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={500} rows={2} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="imageUrl">URL de imagen (opcional)</Label>
              <Input id="imageUrl" value={form.imageUrl} onChange={(e) => set('imageUrl', e.target.value)} maxLength={500} placeholder="/images/pizza.jpg" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas internas (opcional)</Label>
              <Textarea id="notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} maxLength={500} rows={2} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label htmlFor="isActive" className="font-medium">Producto activo</Label>
                  <p className="text-xs text-stone-500">Si está inactivo, no aparece en ningún lado</p>
                </div>
                <Switch id="isActive" checked={form.isActive} onCheckedChange={(v) => set('isActive', v)} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label htmlFor="isAvailable" className="font-medium">Disponible</Label>
                  <p className="text-xs text-stone-500">Si no, aparece agotado temporalmente</p>
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
                {saving ? 'Guardando...' : 'Crear producto'}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}
