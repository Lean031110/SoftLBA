'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Save, UserPlus } from 'lucide-react'

type Form = {
  name: string
  phone: string
  email: string
  address: string
  notes: string
  preferences: string
}

const INITIAL: Form = {
  name: '', phone: '', email: '', address: '', notes: '', preferences: '',
}

export default function NuevoClientePage() {
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
    if (!form.name.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Email inválido')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!data.ok) {
        setError(data.error || 'Error al crear')
        setSaving(false)
        return
      }
      toast.success('Cliente creado')
      router.push('/admin/clientes')
      router.refresh()
    } catch {
      setError('Error de conexión')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/clientes"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserPlus className="h-6 w-6" /> Nuevo cliente
          </h1>
          <p className="text-sm text-stone-500">Agrega un cliente a la base de datos</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos del cliente</CardTitle>
          <CardDescription>El nombre es obligatorio. Los demás campos son opcionales.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input id="name" value={form.name} onChange={(e) => set('name', e.target.value)} required maxLength={120} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input id="phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} maxLength={40} placeholder="+53 5 123 4567" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} maxLength={120} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Dirección</Label>
              <Input id="address" value={form.address} onChange={(e) => set('address', e.target.value)} maxLength={300} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferences">Preferencias</Label>
              <Input id="preferences" value={form.preferences} onChange={(e) => set('preferences', e.target.value)} maxLength={500} placeholder="Alérgico a nueces, prefiere mesa exterior..." />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas internas</Label>
              <Textarea id="notes" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} maxLength={500} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" asChild>
                <Link href="/admin/clientes">Cancelar</Link>
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {saving ? 'Guardando...' : 'Crear cliente'}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}
