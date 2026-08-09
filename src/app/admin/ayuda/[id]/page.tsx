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
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Save, AlertTriangle } from 'lucide-react'

type Form = {
  module: string
  title: string
  content: string
  order: string
  isActive: boolean
}

export default function EditarArticuloPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Form | null>(null)

  useEffect(() => {
    fetch(`/api/admin/help/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.item) {
          const i = d.item
          setForm({
            module: i.module,
            title: i.title,
            content: i.content,
            order: String(i.order ?? 0),
            isActive: i.isActive,
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
      const res = await fetch(`/api/admin/help/${id}`, {
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
        router.push('/admin/ayuda')
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
          <Link href="/admin/ayuda">Volver</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/ayuda"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Editar artículo</h1>
          <p className="text-sm text-stone-500 truncate">{form.title}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos del artículo</CardTitle>
          <CardDescription>Edita el contenido de la ayuda.</CardDescription>
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
                <Label htmlFor="module">Módulo *</Label>
                <Input id="module" value={form.module} onChange={(e) => set('module', e.target.value)} required maxLength={80} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="title">Título *</Label>
                <Input id="title" value={form.title} onChange={(e) => set('title', e.target.value)} required maxLength={200} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Contenido *</Label>
              <Textarea id="content" value={form.content} onChange={(e) => set('content', e.target.value)} required maxLength={20000} rows={12} className="font-mono text-sm" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="order">Orden</Label>
                <Input id="order" type="number" min="0" max="1000" value={form.order} onChange={(e) => set('order', e.target.value)} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label htmlFor="isActive" className="font-medium">Activo</Label>
                  <p className="text-xs text-stone-500">Si no, no se muestra</p>
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
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}
