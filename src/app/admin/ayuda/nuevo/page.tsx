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
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Save, HelpCircle } from 'lucide-react'

type Form = {
  module: string
  title: string
  content: string
  order: string
  isActive: boolean
}

const INITIAL: Form = {
  module: '',
  title: '',
  content: '',
  order: '0',
  isActive: true,
}

export default function NuevoArticuloPage() {
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
    if (!form.module.trim() || !form.title.trim() || !form.content.trim()) {
      setError('Módulo, título y contenido son obligatorios')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!data.ok) {
        setError(data.error || 'Error al crear artículo')
        setSaving(false)
        return
      }
      toast.success('Artículo creado')
      router.push('/admin/ayuda')
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
          <Link href="/admin/ayuda"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HelpCircle className="h-6 w-6" /> Nuevo artículo de ayuda
          </h1>
          <p className="text-sm text-stone-500">Crea una guía o tutorial para usuarios</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos del artículo</CardTitle>
          <CardDescription>
            El <strong>módulo</strong> agrupa artículos relacionados (ej: "Mesero", "Cocina", "Pedidos"). El contenido admite texto simple con saltos de línea.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="module">Módulo <span className="text-red-500">*</span></Label>
                <Input id="module" value={form.module} onChange={(e) => set('module', e.target.value)} required maxLength={80} placeholder="Ej: Pedidos" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="title">Título <span className="text-red-500">*</span></Label>
                <Input id="title" value={form.title} onChange={(e) => set('title', e.target.value)} required maxLength={200} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Contenido <span className="text-red-500">*</span></Label>
              <Textarea id="content" value={form.content} onChange={(e) => set('content', e.target.value)} required maxLength={20000} rows={12} className="font-mono text-sm" placeholder={'Puedes escribir texto con saltos de línea.\n\nEjemplo:\n1. Paso uno\n2. Paso dos'} />
              <p className="text-xs text-stone-500">Se admite texto simple. Los saltos de línea se respetan en la vista pública.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="order">Orden</Label>
                <Input id="order" type="number" min="0" max="1000" value={form.order} onChange={(e) => set('order', e.target.value)} />
                <p className="text-xs text-stone-500">Los artículos se ordenan por módulo y luego por este número.</p>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label htmlFor="isActive" className="font-medium">Activo</Label>
                  <p className="text-xs text-stone-500">Si está inactivo, no se muestra</p>
                </div>
                <Switch id="isActive" checked={form.isActive} onCheckedChange={(v) => set('isActive', v)} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" asChild>
                <Link href="/admin/ayuda">Cancelar</Link>
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {saving ? 'Guardando...' : 'Crear artículo'}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}
