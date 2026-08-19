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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Save, Plus } from 'lucide-react'

const TYPES = [
  { value: 'INGRESO', label: 'Ingreso', sign: '+' },
  { value: 'EGRESO', label: 'Egreso', sign: '-' },
  { value: 'GASTO', label: 'Gasto', sign: '-' },
  { value: 'SALARIO', label: 'Salario', sign: '-' },
]

const COMMON_CATEGORIES = [
  'Efectivo', 'Banco', 'Servicios', 'Inventario', 'Merma',
  'Salario', 'Mantenimiento', 'Marketing', 'Otros',
]

export default function NuevaEntradaPage() {
  const router = useRouter()
  const [type, setType] = useState('EGRESO')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('0')
  const [currency, setCurrency] = useState('CUP')
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!category.trim() || !description.trim()) {
      setError('Categoría y descripción son obligatorios')
      return
    }
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) {
      setError('Monto debe ser mayor que 0')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/finanzas/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type, category: category.trim(), description: description.trim(),
          amount: amt, currency, reference,
        }),
      })
      const data = await res.json()
      if (!data.ok) {
        setError(data.error || 'Error al crear')
        setSaving(false)
        return
      }
      toast.success('Movimiento creado')
      router.push('/admin/finanzas/entries')
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
          <Link href="/admin/finanzas/entries"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Plus className="h-6 w-6" /> Nuevo movimiento
          </h1>
          <p className="text-sm text-stone-500">Registra un ingreso o egreso manual</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos del movimiento</CardTitle>
          <CardDescription>Las ventas y compras se registran automáticamente desde sus módulos</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label} ({t.sign})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Moneda</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CUP">CUP</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="MLC">MLC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Categoría *</Label>
                <Input value={category} onChange={(e) => setCategory(e.target.value)} list="cats" placeholder="Ej: Servicios" />
                <datalist id="cats">
                  {COMMON_CATEGORIES.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label>Monto *</Label>
                <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descripción *</Label>
              <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder="Detalle del movimiento..." />
            </div>

            <div className="space-y-2">
              <Label>Referencia (opcional)</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={200} placeholder="Factura, recibo..." />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" asChild>
                <Link href="/admin/finanzas/entries">Cancelar</Link>
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {saving ? 'Guardando...' : 'Crear movimiento'}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}
