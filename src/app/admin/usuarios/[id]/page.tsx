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
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Save, AlertTriangle, KeyRound, Copy, Check } from 'lucide-react'
import { ROLE_LABELS, ROLE_BADGE_COLORS, type UserRole } from '@/lib/permissions'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

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
  isActive: boolean
}

export default function EditarUsuarioPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [mustChangePass, setMustChangePass] = useState(false)
  const [form, setForm] = useState<Form | null>(null)
  const [resetDialog, setResetDialog] = useState<{ open: boolean; password?: string; copied: boolean }>({ open: false, copied: false })

  useEffect(() => {
    fetch(`/api/admin/usuarios/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.item) {
          const i = d.item
          setUsername(i.username)
          setMustChangePass(i.mustChangePass)
          setForm({
            firstName: i.firstName || '',
            lastName: i.lastName || '',
            role: i.role,
            email: i.email || '',
            phone: i.phone || '',
            mobile: i.mobile || '',
            address: i.address || '',
            idNumber: i.idNumber || '',
            bio: i.bio || '',
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
      const res = await fetch(`/api/admin/usuarios/${id}`, {
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
        router.push('/admin/usuarios')
        router.refresh()
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    setResetDialog({ open: true, copied: false })
    try {
      const res = await fetch(`/api/admin/usuarios/${id}/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const data = await res.json()
      if (data.ok) {
        setResetDialog({ open: true, password: data.password, copied: false })
        setMustChangePass(true)
        toast.success('Contraseña reseteada')
      } else {
        toast.error(data.error || 'Error al resetear')
        setResetDialog({ open: false, copied: false })
      }
    } catch {
      toast.error('Error de conexión')
      setResetDialog({ open: false, copied: false })
    }
  }

  function copyPassword() {
    if (!resetDialog.password) return
    navigator.clipboard.writeText(resetDialog.password)
    setResetDialog((d) => ({ ...d, copied: true }))
    setTimeout(() => setResetDialog((d) => ({ ...d, copied: false })), 2000)
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
          <Link href="/admin/usuarios">Volver</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/usuarios"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">Editar usuario</h1>
          <p className="text-sm text-stone-500">
            <span className="font-mono">@{username}</span>
            {mustChangePass && <Badge variant="outline" className="ml-2 text-amber-700 border-amber-300">Debe cambiar contraseña</Badge>}
          </p>
        </div>
        <Button variant="outline" onClick={handleReset}>
          <KeyRound className="h-4 w-4 mr-2" /> Resetear contraseña
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos del usuario</CardTitle>
          <CardDescription>Edita la información del usuario. Los cambios se guardan al hacer clic en "Guardar cambios".</CardDescription>
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
                <Label htmlFor="firstName">Nombre *</Label>
                <Input id="firstName" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} required maxLength={80} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Apellidos *</Label>
                <Input id="lastName" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} required maxLength={80} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Rol</Label>
              <div className="flex items-center gap-3">
                <Select value={form.role} onValueChange={(v) => set('role', v as UserRole)}>
                  <SelectTrigger className="w-full sm:w-72"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge className={ROLE_BADGE_COLORS[form.role]} variant="secondary">{ROLE_LABELS[form.role]}</Badge>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} maxLength={120} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input id="phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} maxLength={40} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile">Móvil</Label>
                <Input id="mobile" value={form.mobile} onChange={(e) => set('mobile', e.target.value)} maxLength={40} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="idNumber">Carnet de identidad</Label>
                <Input id="idNumber" value={form.idNumber} onChange={(e) => set('idNumber', e.target.value)} maxLength={40} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Dirección</Label>
              <Input id="address" value={form.address} onChange={(e) => set('address', e.target.value)} maxLength={200} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Notas / Biografía</Label>
              <Textarea id="bio" value={form.bio} onChange={(e) => set('bio', e.target.value)} maxLength={500} rows={3} />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label htmlFor="isActive" className="font-medium">Usuario activo</Label>
                <p className="text-xs text-stone-500">Si está inactivo, no podrá iniciar sesión</p>
              </div>
              <Switch id="isActive" checked={form.isActive} onCheckedChange={(v) => set('isActive', v)} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" asChild>
                <Link href="/admin/usuarios">Cancelar</Link>
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>

      <Dialog open={resetDialog.open} onOpenChange={(open) => !open && setResetDialog({ open: false, copied: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" /> Nueva contraseña
            </DialogTitle>
            <DialogDescription>
              Se generó una nueva contraseña temporal. El usuario deberá cambiarla al iniciar sesión.
            </DialogDescription>
          </DialogHeader>
          {resetDialog.password ? (
            <div className="rounded-lg border bg-stone-50 dark:bg-stone-900 p-4">
              <p className="text-xs text-stone-500 mb-1">Nueva contraseña:</p>
              <div className="flex items-center gap-2">
                <code className="font-mono text-lg font-semibold tracking-wider">{resetDialog.password}</code>
                <Button size="icon" variant="ghost" onClick={copyPassword} aria-label="Copiar">
                  {resetDialog.copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setResetDialog({ open: false, copied: false })}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
