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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Save, Settings, Loader2, AlertTriangle, Store, Phone, FileText, Image as ImageIcon, Eye, Printer, WifiOff } from 'lucide-react'
import { Switch } from '@/components/ui/switch'

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
  showDemoUsers: boolean
  printerEnabled: boolean
  printerName: string
  printerIp: string
  printerPort: string
  printerWidth: string
  printerAutoPrint: boolean
  offlineTitle: string
  offlineMessage: string
  offlineWifiName: string
  offlineInstructions: string
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
  showDemoUsers: true,
  printerEnabled: false,
  printerName: '',
  printerIp: '',
  printerPort: '9100',
  printerWidth: '80',
  printerAutoPrint: false,
  offlineTitle: 'Sin conexión al servidor',
  offlineMessage: 'Para usar SoftLBA necesitas estar conectado a la red WiFi del restaurante (red local). Verifica que estás en la misma red que el servidor.',
  offlineWifiName: '',
  offlineInstructions: '',
}

export default function ConfiguracionPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Config>(INITIAL)
  const [printerTesting, setPrinterTesting] = useState(false)

  async function testPrinter() {
    setPrinterTesting(true)
    try {
      const res = await fetch('/api/admin/printer/test', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        toast.success(data.message || 'Conexión exitosa')
      } else {
        toast.error(data.error || 'Error de conexión')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setPrinterTesting(false)
    }
  }

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
            showDemoUsers: i.showDemoUsers !== false ? true : false,
            printerEnabled: i.printerEnabled || false,
            printerName: i.printerName || '',
            printerIp: i.printerIp || '',
            printerPort: String(i.printerPort || 9100),
            printerWidth: String(i.printerWidth || 80),
            printerAutoPrint: i.printerAutoPrint || false,
            offlineTitle: i.offlineTitle || '',
            offlineMessage: i.offlineMessage || '',
            offlineWifiName: i.offlineWifiName || '',
            offlineInstructions: i.offlineInstructions || '',
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
            <TabsTrigger value="impresora"><Printer className="h-4 w-4 mr-1" /> Impresora</TabsTrigger>
            <TabsTrigger value="offline"><WifiOff className="h-4 w-4 mr-1" /> Offline</TabsTrigger>
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

                <div className="flex items-center justify-between rounded-lg border p-4 bg-slate-50 dark:bg-slate-900/50">
                  <div className="flex items-start gap-3">
                    <Eye className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                    <div>
                      <Label htmlFor="showDemoUsers" className="font-medium cursor-pointer">Mostrar usuarios demo en el login</Label>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Si está activo, la página de login mostrará un botón para ver las credenciales demo
                        (admin, mesero, cocina, cajero). Desactívalo en producción para mayor seguridad.
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="showDemoUsers"
                    checked={form.showDemoUsers}
                    onCheckedChange={(v) => set('showDemoUsers', v)}
                  />
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

          {/* IMPRESORA */}
          <TabsContent value="impresora">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Printer className="h-4 w-4" />
                  Impresora térmica
                </CardTitle>
                <CardDescription>
                  Configura una impresora térmica para imprimir comprobantes automáticamente al cobrar.
                  Si no hay impresora configurada, los comprobantes se guardan como imagen en el servidor.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Activar impresora */}
                <div className="flex items-center justify-between rounded-lg border p-4 bg-slate-50 dark:bg-slate-900/50">
                  <div className="flex items-start gap-3">
                    <Printer className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                    <div>
                      <Label htmlFor="printerEnabled" className="font-medium cursor-pointer">Activar impresora térmica</Label>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Si está activa, los comprobantes se enviarán a la impresora configurada.
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="printerEnabled"
                    checked={form.printerEnabled}
                    onCheckedChange={(v) => set('printerEnabled', v)}
                  />
                </div>

                {form.printerEnabled && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="printerName">Nombre de la impresora</Label>
                        <Input
                          id="printerName"
                          value={form.printerName}
                          onChange={(e) => set('printerName', e.target.value)}
                          placeholder="Ej: EPSON TM-T20"
                          maxLength={200}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="printerIp">IP de la impresora</Label>
                        <Input
                          id="printerIp"
                          value={form.printerIp}
                          onChange={(e) => set('printerIp', e.target.value)}
                          placeholder="Ej: 192.168.1.100"
                          maxLength={100}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="printerPort">Puerto</Label>
                        <Input
                          id="printerPort"
                          type="number"
                          value={form.printerPort}
                          onChange={(e) => set('printerPort', e.target.value)}
                          placeholder="9100"
                          min={1}
                          max={65535}
                        />
                        <p className="text-xs text-slate-500">Puerto por defecto: 9100 (ESC/POS)</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="printerWidth">Ancho del papel</Label>
                        <Select value={form.printerWidth} onValueChange={(v) => set('printerWidth', v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Ancho del papel" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="80">80mm (estándar)</SelectItem>
                            <SelectItem value="58">58mm (mini)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Auto-imprimir */}
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <Label htmlFor="printerAutoPrint" className="font-medium">Auto-imprimir al cobrar</Label>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Si está activo, el comprobante se imprime automáticamente cuando se cobra un pedido.
                        </p>
                      </div>
                      <Switch
                        id="printerAutoPrint"
                        checked={form.printerAutoPrint}
                        onCheckedChange={(v) => set('printerAutoPrint', v)}
                      />
                    </div>

                    {/* Probar conexión */}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={testPrinter}
                      disabled={printerTesting || !form.printerEnabled}
                      className="w-full"
                    >
                      {printerTesting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
                      {printerTesting ? 'Probando...' : 'Probar conexión con impresora'}
                    </Button>
                  </>
                )}

                {!form.printerEnabled && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 p-4 text-sm text-blue-800 dark:text-blue-200">
                    <p className="font-medium">💡 Sin impresora configurada</p>
                    <p className="mt-1 text-xs">
                      Los comprobantes se guardarán automáticamente como imagen en el servidor
                      (en <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">/download/comprobantes/</code>)
                      al cobrar cada pedido. El mesero podrá descargarlos si lo desea.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* OFFLINE */}
          <TabsContent value="offline">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <WifiOff className="h-4 w-4" />
                  Página offline personalizable
                </CardTitle>
                <CardDescription>
                  Personaliza la página que ven los usuarios cuando no hay conexión al servidor.
                  Esta página se muestra si el dispositivo no está en la misma red WiFi del restaurante.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="offlineTitle">Título de la página</Label>
                  <Input
                    id="offlineTitle"
                    value={form.offlineTitle}
                    onChange={(e) => set('offlineTitle', e.target.value)}
                    maxLength={200}
                    placeholder="Sin conexión al servidor"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="offlineMessage">Mensaje principal</Label>
                  <Textarea
                    id="offlineMessage"
                    value={form.offlineMessage}
                    onChange={(e) => set('offlineMessage', e.target.value)}
                    maxLength={1000}
                    rows={3}
                    placeholder="Para usar SoftLBA necesitas estar conectado a la red WiFi del restaurante..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="offlineWifiName">Nombre de la red WiFi (opcional)</Label>
                  <Input
                    id="offlineWifiName"
                    value={form.offlineWifiName}
                    onChange={(e) => set('offlineWifiName', e.target.value)}
                    maxLength={200}
                    placeholder="Ej: Restaurante_WiFi"
                  />
                  <p className="text-xs text-slate-500">Si lo indicas, se mostrará en las instrucciones de conexión</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="offlineInstructions">Instrucciones adicionales (opcional)</Label>
                  <Textarea
                    id="offlineInstructions"
                    value={form.offlineInstructions}
                    onChange={(e) => set('offlineInstructions', e.target.value)}
                    maxLength={2000}
                    rows={4}
                    placeholder="Ej: Preguntar al administrador por la contraseña del WiFi. El servidor debe estar encendido en el PC principal..."
                  />
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 p-4 text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium">💡 Vista previa</p>
                  <p className="mt-1 text-xs">Los cambios se reflejarán en la página /offline que ven los dispositivos cuando pierden conexión con el servidor.</p>
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
