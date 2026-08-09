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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Save, Copy, Check, UserPlus } from 'lucide-react'
import { ROLE_LABELS, type UserRole } from '@/lib/permissions'

type Form = {
  firstName: string
  lastName: string
  role: UserRole
  email: string
  phone: string
  mobile: string
  address: string
  idNumber: string
  bio: string
}

const INITIAL: Form = {
  firstName: '',
  lastName: '',
  role: 'MESERO',
  email: '',
  phone: '',
  mobile: '',
  address: '',
  idNumber: '',
  bio: '',
}

export default function NuevoUsuarioPage() {
  const router = useRouter()
  const [form, setForm] = useState<Form>(INITIAL)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultDialog, setResultDialog] = useState<{ open: boolean; username?: string; password?: string; copied: boolean }>({ open: false, copied: false })

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('Nombre y apellido son obligatorios')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!data.ok) {
        setError(data.error || 'Error al crear usuario')
        setSaving(false)
        return
      }
      setResultDialog({ open: true, username: data.item.username, password: data.password, copied: false })
      toast.success('Usuario creado correctamente')
    } catch {
      setError('Error de conexión')
      setSaving(false)
    }
  }

  function copyPassword() {
    if (!resultDialog.password) return
    navigator.clipboard.writeText(resultDialog.password)
    setResultDialog((d) => ({ ...d, copied: true }))
    setTimeout(() => setResultDialog((d) => ({ ...d, copied: false })), 2000)
  }

  function closeDialog() {
    setResultDialog({ open: false, copied: false })
    router.push('/admin/usuarios')
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/usuarios"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserPlus className="h-6 w-6" /> Nuevo usuario
          </h1>
          <p className="text-sm text-stone-500">Crea un nuevo usuario en el sistema</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos del usuario</CardTitle>
          <CardDescription>
            Se generará automáticamente un <strong>username</strong> (a partir de nombre y apellido) y una <strong>contraseña aleatoria</strong> si no se especifican. El usuario deberá cambiarla al iniciar sesión.
          </CardDescription>
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
                <Label htmlFor="firstName">Nombre <span className="text-red-500">*</span></Label>
                <Input id="firstName" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} required maxLength={80} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Apellidos <span className="text-red-500">*</span></Label>
                <Input id="lastName" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} required maxLength={80} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Rol <span className="text-red-500">*</span></Label>
              <Select value={form.role} onValueChange={(v) => set('role', v as UserRole)}>
                <SelectTrigger className="w-full sm:w-72"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email (opcional)</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} maxLength={120} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono (opcional)</Label>
                <Input id="phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} maxLength={40} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile">Móvil (opcional)</Label>
                <Input id="mobile" value={form.mobile} onChange={(e) => set('mobile', e.target.value)} maxLength={40} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="idNumber">Carnet de identidad (opcional)</Label>
                <Input id="idNumber" value={form.idNumber} onChange={(e) => set('idNumber', e.target.value)} maxLength={40} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Dirección (opcional)</Label>
              <Input id="address" value={form.address} onChange={(e) => set('address', e.target.value)} maxLength={200} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Notas / Biografía (opcional)</Label>
              <Textarea id="bio" value={form.bio} onChange={(e) => set('bio', e.target.value)} maxLength={500} rows={3} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" asChild>
                <Link href="/admin/usuarios">Cancelar</Link>
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {saving ? 'Guardando...' : 'Crear usuario'}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>

      <Dialog open={resultDialog.open} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usuario creado correctamente</DialogTitle>
            <DialogDescription>
              Anota las credenciales del nuevo usuario. La contraseña no se volverá a mostrar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border bg-stone-50 dark:bg-stone-900 p-4 space-y-2">
              <div>
                <p className="text-xs text-stone-500 mb-1">Usuario:</p>
                <code className="font-mono text-base font-semibold">@{resultDialog.username}</code>
              </div>
              <div>
                <p className="text-xs text-stone-500 mb-1">Contraseña temporal:</p>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-base font-semibold tracking-wider">{resultDialog.password}</code>
                  <Button size="icon" variant="ghost" onClick={copyPassword} aria-label="Copiar contraseña">
                    {resultDialog.copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
            <Alert>
              <AlertDescription>
                El usuario deberá cambiar la contraseña al iniciar sesión por primera vez.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button onClick={closeDialog}>Volver a la lista</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
