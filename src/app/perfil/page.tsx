'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Loader2, Save, User, Mail, Phone, MapPin, IdCard, FileText, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { ROLE_LABELS, ROLE_BADGE_COLORS, type UserRole } from '@/lib/permissions'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

type Profile = {
  id: string
  username: string
  email?: string | null
  role: UserRole
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  mobile?: string | null
  address?: string | null
  idNumber?: string | null
  bio?: string | null
  avatarUrl?: string | null
  lastLoginAt?: string | null
  lastLoginIp?: string | null
  createdAt: string
}

function getInitials(p: Profile | null): string {
  if (!p) return '?'
  const f = p.firstName?.[0] || ''
  const l = p.lastName?.[0] || ''
  return (f + l).toUpperCase() || p.username.slice(0, 2).toUpperCase()
}

export default function PerfilPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [mobile, setMobile] = useState('')
  const [address, setAddress] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [bio, setBio] = useState('')

  // Change password modal
  const [showPassModal, setShowPassModal] = useState(false)
  const [currentPass, setCurrentPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [changingPass, setChangingPass] = useState(false)

  useEffect(() => {
    fetch('/api/auth/profile')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setProfile(d.user)
          setFirstName(d.user.firstName || '')
          setLastName(d.user.lastName || '')
          setEmail(d.user.email || '')
          setPhone(d.user.phone || '')
          setMobile(d.user.mobile || '')
          setAddress(d.user.address || '')
          setIdNumber(d.user.idNumber || '')
          setBio(d.user.bio || '')
        } else {
          setError(d.error || 'Error al cargar perfil')
        }
      })
      .catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName, lastName, email, phone, mobile, address, idNumber, bio,
        }),
      })
      const data = await res.json()
      if (!data.ok) {
        toast.error(data.error || 'Error al guardar')
        return
      }
      setProfile(data.user)
      toast.success('Perfil actualizado correctamente')
    } catch (e) {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPass.length < 6) {
      toast.error('La nueva contraseña debe tener al menos 6 caracteres')
      return
    }
    if (newPass !== confirmPass) {
      toast.error('Las contraseñas no coinciden')
      return
    }
    setChangingPass(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: currentPass,
          newPassword: newPass,
        }),
      })
      const data = await res.json()
      if (!data.ok) {
        toast.error(data.error || 'Error al cambiar contraseña')
        return
      }
      toast.success('Contraseña cambiada correctamente')
      setShowPassModal(false)
      setCurrentPass('')
      setNewPass('')
      setConfirmPass('')
    } catch (e) {
      toast.error('Error de conexión')
    } finally {
      setChangingPass(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error || 'No se pudo cargar el perfil'}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <User className="h-6 w-6" />
            Mi Perfil
          </h1>
          <p className="text-sm text-stone-500">Información personal y credenciales</p>
        </div>
        <Button variant="outline" onClick={() => setShowPassModal(true)}>
          <KeyRound className="h-4 w-4 mr-2" />
          Cambiar contraseña
        </Button>
      </div>

      {/* Tarjeta de identificación */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4 flex-wrap">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="bg-gradient-to-br from-orange-500 to-red-600 text-white text-xl font-bold">
                {getInitials(profile)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xl font-bold">
                {profile.firstName} {profile.lastName}
              </p>
              <p className="text-sm text-stone-500">@{profile.username}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={ROLE_BADGE_COLORS[profile.role]}>
                  {ROLE_LABELS[profile.role]}
                </Badge>
                {profile.lastLoginAt && (
                  <span className="text-xs text-stone-500">
                    Último acceso: {new Date(profile.lastLoginAt).toLocaleString('es-CU')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Formulario de edición */}
      <form onSubmit={handleSave}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Información personal
            </CardTitle>
            <CardDescription>
              Mantén tus datos actualizados. El administrador puede ver esta información.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">Nombre *</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Apellidos *</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  disabled={saving}
                />
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Teléfono fijo
                </Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Opcional"
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile" className="flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Móvil
                </Label>
                <Input
                  id="mobile"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="Opcional"
                  disabled={saving}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-1">
                <Mail className="h-3 w-3" /> Correo electrónico
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Opcional"
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Dirección particular
              </Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Calle, número, municipio, provincia"
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="idNumber" className="flex items-center gap-1">
                <IdCard className="h-3 w-3" /> Carnet de identidad
              </Label>
              <Input
                id="idNumber"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                placeholder="Número de identificación"
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Biografía / experiencia laboral</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Cuenta sobre tu experiencia, estudios, etc."
                rows={4}
                disabled={saving}
              />
            </div>
          </CardContent>
          <div className="px-6 pb-6 flex justify-end gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </Card>
      </form>

      {/* Modal de cambio de contraseña */}
      <Dialog open={showPassModal} onOpenChange={setShowPassModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Cambiar contraseña
            </DialogTitle>
            <DialogDescription>
              Introduce tu contraseña actual y la nueva.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="curPass">Contraseña actual</Label>
              <Input
                id="curPass"
                type="password"
                value={currentPass}
                onChange={(e) => setCurrentPass(e.target.value)}
                required
                autoFocus
                disabled={changingPass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPass1">Nueva contraseña</Label>
              <Input
                id="newPass1"
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                required
                disabled={changingPass}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPass2">Confirma nueva contraseña</Label>
              <Input
                id="newPass2"
                type="password"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                required
                disabled={changingPass}
              />
              {confirmPass && newPass === confirmPass && (
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Coinciden
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowPassModal(false)} disabled={changingPass}>
                Cancelar
              </Button>
              <Button type="submit" disabled={changingPass}>
                {changingPass ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {changingPass ? 'Cambiando...' : 'Cambiar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
