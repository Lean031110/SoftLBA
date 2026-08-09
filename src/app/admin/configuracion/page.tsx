'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Save, Settings, Loader2, AlertTriangle, Store, Phone, FileText, Image as ImageIcon } from 'lucide-react'

type Config = {
  name: string
  legalName: string
  logo: string
  address: string
  phone: string
  email: string
  website: string
  facebook: string
  instagram: string
  telegram: string
  whatsapp: string
  hours: string
  slogan: string
  welcomeText: string
  currency: string
  currencySymbol: string
  receiptHeader: string
  receiptFooter: string
  taxRate: string
}

const INITIAL: Config = {
  name: '',
  legalName: '',
  logo: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  facebook: '',
  instagram: '',
  telegram: '',
  whatsapp: '',
  hours: '',
  slogan: '',
  welcomeText: '',
  currency: 'CUP',
  currencySymbol: '$',
  receiptHeader: '',
  receiptFooter: '',
  taxRate: '0',
}

export default function ConfiguracionPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Config>(INITIAL)

  useEffect(() => {
    fetch('/api/admin/config')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.item) {
          const i = d.item
          setForm({
            name: i.name || '',
            legalName: i.legalName || '',
            logo: i.logo || '',
            address: i.address || '',
            phone: i.phone || '',
            email: i.email || '',
            website: i.website || '',
            facebook: i.facebook || '',
            instagram: i.instagram || '',
            telegram: i.telegram || '',
            whatsapp: i.whatsapp || '',
            hours: i.hours || '',
            slogan: i.slogan || '',
            welcomeText: i.welcomeText || '',
            currency: i.currency || 'CUP',
            currencySymbol: i.currencySymbol || '$',
            receiptHeader: i.receiptHeader || '',
            receiptFooter: i.receiptFooter || '',
            taxRate: String(i.taxRate ?? 0),
          })
        } else {
          setError(d.error || 'Error al cargar')
        }
      })
      .catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false))
  }, [])

  function set<K extends keyof Config>(key: K, value: Config[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!data.ok) {
        setError(data.error || 'Error al guardar')
        toast.error(data.error || 'Error al guardar')
      } else {
        toast.success('Configuración guardada')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setSaving(false)
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" /> Configuración
        </h1>
        <p className="text-sm text-stone-500">Datos generales del restaurante, contacto, recibo e impuestos</p>
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="general">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="general"><Store className="h-4 w-4 mr-1" /> General</TabsTrigger>
            <TabsTrigger value="contacto"><Phone className="h-4 w-4 mr-1" /> Contacto</TabsTrigger>
            <TabsTrigger value="redes"><ImageIcon className="h-4 w-4 mr-1" /> Redes</TabsTrigger>
            <TabsTrigger value="recibo"><FileText className="h-4 w-4 mr-1" /> Recibo</TabsTrigger>
          </TabsList>

          {/* GENERAL */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Datos generales</CardTitle>
                <CardDescription>Información principal del restaurante</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre del restaurante *</Label>
                  <Input id="name" value={form.name} onChange={(e) => set('name', e.target.value)} required maxLength={120} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="legalName">Razón social / Nombre legal</Label>
                  <Input id="legalName" value={form.legalName} onChange={(e) => set('legalName', e.target.value)} maxLength={200} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="slogan">Eslogan</Label>
                    <Input id="slogan" value={form.slogan} onChange={(e) => set('slogan', e.target.value)} maxLength={300} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="logo">URL del logo</Label>
                    <Input id="logo" value={form.logo} onChange={(e) => set('logo', e.target.value)} maxLength={500} placeholder="/images/logo.png" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="welcomeText">Texto de bienvenida (carta pública)</Label>
                  <Textarea id="welcomeText" value={form.welcomeText} onChange={(e) => set('welcomeText', e.target.value)} maxLength={1000} rows={3} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hours">Horario</Label>
                  <Input id="hours" value={form.hours} onChange={(e) => set('hours', e.target.value)} maxLength={300} placeholder="Lun-Dom 11:00-23:00" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Dirección</Label>
                  <Textarea id="address" value={form.address} onChange={(e) => set('address', e.target.value)} maxLength={300} rows={2} />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="currency">Moneda</Label>
                    <Input id="currency" value={form.currency} onChange={(e) => set('currency', e.target.value)} maxLength={10} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currencySymbol">Símbolo</Label>
                    <Input id="currencySymbol" value={form.currencySymbol} onChange={(e) => set('currencySymbol', e.target.value)} maxLength={5} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taxRate">Tasa de impuesto (%)</Label>
                    <Input id="taxRate" type="number" step="0.01" min="0" max="100" value={form.taxRate} onChange={(e) => set('taxRate', e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CONTACTO */}
          <TabsContent value="contacto">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contacto</CardTitle>
                <CardDescription>Teléfonos y correos de contacto</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input id="phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} maxLength={60} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp">WhatsApp</Label>
                    <Input id="whatsapp" value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} maxLength={60} placeholder="+5355555555" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} maxLength={120} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Sitio web</Label>
                  <Input id="website" value={form.website} onChange={(e) => set('website', e.target.value)} maxLength={200} placeholder="https://..." />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* REDES */}
          <TabsContent value="redes">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Redes sociales</CardTitle>
                <CardDescription>Perfiles en redes sociales</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="facebook">Facebook</Label>
                  <Input id="facebook" value={form.facebook} onChange={(e) => set('facebook', e.target.value)} maxLength={200} placeholder="https://facebook.com/..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instagram">Instagram</Label>
                  <Input id="instagram" value={form.instagram} onChange={(e) => set('instagram', e.target.value)} maxLength={200} placeholder="https://instagram.com/..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telegram">Telegram</Label>
                  <Input id="telegram" value={form.telegram} onChange={(e) => set('telegram', e.target.value)} maxLength={200} placeholder="https://t.me/..." />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* RECIBO */}
          <TabsContent value="recibo">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recibo</CardTitle>
                <CardDescription>Encabezado y pie del recibo impreso</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="receiptHeader">Encabezado del recibo</Label>
                  <Textarea id="receiptHeader" value={form.receiptHeader} onChange={(e) => set('receiptHeader', e.target.value)} maxLength={500} rows={4} placeholder="Restaurante X&#10;Calle Y #123&#10;Tel: 5555" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="receiptFooter">Pie del recibo</Label>
                  <Textarea id="receiptFooter" value={form.receiptFooter} onChange={(e) => set('receiptFooter', e.target.value)} maxLength={500} rows={4} placeholder="¡Gracias por su visita!" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-6">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {saving ? 'Guardando...' : 'Guardar configuración'}
          </Button>
        </div>
      </form>
    </div>
  )
}
