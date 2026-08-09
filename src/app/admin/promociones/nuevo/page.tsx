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
import { ArrowLeft, Loader2, Save, Receipt, Plus } from 'lucide-react'

export default function NuevaPromocionPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('GENERAL')
  const [discountPct, setDiscountPct] = useState('0')
  const [discountAmount, setDiscountAmount] = useState('0')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState('')
  const [isActive, setIsActive] = useState(true)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    if (parseFloat(discountPct) === 0 && parseFloat(discountAmount) === 0) {
      setError('Debe haber al menos un descuento (%)')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/promociones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, description, type,
          discountPct: parseFloat(discountPct),
          discountAmount: parseFloat(discountAmount),
          startDate, endDate,
          isActive,
        }),
      })
      const data = await res.json()
      if (!data.ok) {
        setError(data.error || 'Error al crear')
        setSaving(false)
        return
      }
      toast.success('Promoción creada')
      router.push('/admin/promociones')
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
          <Link href="/admin/promociones"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Plus className="h-6 w-6" /> Nueva promoción
          </h1>
          <p className="text-sm text-stone-500">Crea un descuento u oferta</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos de la promoción</CardTitle>
          <CardDescription>Configura el tipo y el descuento</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} placeholder="Ej: Pizza + Bebida" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea id="description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GENERAL">General</SelectItem>
                    <SelectItem value="CLIENTE">Cliente específico</SelectItem>
                    <SelectItem value="PRODUCTO">Producto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pct">Descuento (%)</Label>
                <Input id="pct" type="number" step="0.01" min="0" max="100" value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amt">Descuento monto fijo</Label>
                <Input id="amt" type="number" step="0.01" min="0" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start">Fecha inicio *</Label>
                <Input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">Fecha fin (vacío = sin límite)</Label>
                <Input id="end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label htmlFor="active" className="font-medium">Promoción activa</Label>
                <p className="text-xs text-stone-500">Si está inactiva, no se aplica</p>
              </div>
              <Switch id="active" checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" asChild>
                <Link href="/admin/promociones">Cancelar</Link>
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {saving ? 'Guardando...' : 'Crear promoción'}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}
