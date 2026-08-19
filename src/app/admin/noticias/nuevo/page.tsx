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
import { ArrowLeft, Loader2, Save, Newspaper } from 'lucide-react'

type Form = {
  title: string
  content: string
  type: 'INFO' | 'WARNING' | 'PROMO' | 'URGENT'
  isPublic: boolean
  isActive: boolean
  priority: string
  expiresAt: string
}

const INITIAL: Form = {
  title: '',
  content: '',
  type: 'INFO',
  isPublic: true,
  isActive: true,
  priority: '0',
  expiresAt: '',
}

export default function NuevaNoticiaPage() {
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
    if (!form.title.trim() || !form.content.trim()) {
      setError('Título y contenido son obligatorios')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!data.ok) {
        setError(data.error || 'Error al crear noticia')
        setSaving(false)
        return
      }
      toast.success('Noticia creada')
      router.push('/admin/noticias')
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
          <Link href="/admin/noticias"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Newspaper className="h-6 w-6" /> Nueva noticia
          </h1>
          <p className="text-sm text-stone-500">Crea un aviso, promoción o comunicado</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos de la noticia</CardTitle>
          <CardDescription>La prioridad mayor aparece primero. Si activas "pública", será visible en la carta pública.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">Título <span className="text-red-500">*</span></Label>
              <Input id="title" value={form.title} onChange={(e) => set('title', e.target.value)} required maxLength={200} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Contenido <span className="text-red-500">*</span></Label>
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
                <Label htmlFor="expiresAt">Expira (opcional)</Label>
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
                {saving ? 'Guardando...' : 'Crear noticia'}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}
