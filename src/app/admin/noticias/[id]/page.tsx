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

type Form = {
  title: string
  content: string
  type: 'INFO' | 'WARNING' | 'PROMO' | 'URGENT'
  isPublic: boolean
  isActive: boolean
  priority: string
  expiresAt: string
}

export default function EditarNoticiaPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Form | null>(null)

  useEffect(() => {
    fetch(`/api/admin/news/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.item) {
          const i = d.item
          let expiresAt = ''
          if (i.expiresAt) {
            const dt = new Date(i.expiresAt)
            const off = dt.getTimezoneOffset()
            const local = new Date(dt.getTime() - off * 60000)
            expiresAt = local.toISOString().slice(0, 16)
          }
          setForm({
            title: i.title,
            content: i.content,
            type: i.type,
            isPublic: i.isPublic,
            isActive: i.isActive,
            priority: String(i.priority ?? 0),
            expiresAt,
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
      const res = await fetch(`/api/admin/news/${id}`, {
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
        router.push('/admin/noticias')
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
          <Link href="/admin/noticias">Volver</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/noticias"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Editar noticia</h1>
          <p className="text-sm text-stone-500 truncate">{form.title}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos de la noticia</CardTitle>
          <CardDescription>Edita la información de la noticia.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input id="title" value={form.title} onChange={(e) => set('title', e.target.value)} required maxLength={200} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Contenido *</Label>
              <Textarea id="content" value={form.content} onChange={(e) => set('content', e.target.value)} required maxLength={5000} rows={6} />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="type">Tipo</Label>
                <Select value={form.type} onValueChange={(v) => set('type', v as Form['type'])}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INFO">Información</SelectItem>
                    <SelectItem value="WARNING">Aviso</SelectItem>
                    <SelectItem value="PROMO">Promoción</SelectItem>
                    <SelectItem value="URGENT">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Prioridad</Label>
                <Input id="priority" type="number" min="0" max="100" value={form.priority} onChange={(e) => set('priority', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiresAt">Expira</Label>
                <Input id="expiresAt" type="datetime-local" value={form.expiresAt} onChange={(e) => set('expiresAt', e.target.value)} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label htmlFor="isPublic" className="font-medium">Pública</Label>
                  <p className="text-xs text-stone-500">Visible en la carta pública</p>
                </div>
                <Switch id="isPublic" checked={form.isPublic} onCheckedChange={(v) => set('isPublic', v)} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label htmlFor="isActive" className="font-medium">Activa</Label>
                  <p className="text-xs text-stone-500">Si no, queda como borrador</p>
                </div>
                <Switch id="isActive" checked={form.isActive} onCheckedChange={(v) => set('isActive', v)} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" asChild>
                <Link href="/admin/noticias">Cancelar</Link>
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
