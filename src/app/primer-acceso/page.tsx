'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, KeyRound, AlertCircle, Check, Eye, EyeOff } from 'lucide-react'
import { ROLE_HOME, type UserRole } from '@/lib/permissions'

export default function PrimerAccesoPage() {
  const router = useRouter()
  const [currentPass, setCurrentPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<UserRole | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.user) setUserRole(d.user.role)
      })
  }, [])

  const passStrong = newPass.length >= 6
  const passesMatch = newPass !== '' && newPass === confirmPass
  const canSubmit = currentPass !== '' && passStrong && passesMatch && !loading

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!passStrong) {
      setError('La nueva contraseña debe tener al menos 6 caracteres')
      return
    }
    if (!passesMatch) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (currentPass === newPass) {
      setError('La nueva contraseña no puede ser igual a la actual')
      return
    }

    setLoading(true)
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
        setError(data.error || 'Error al cambiar contraseña')
        setLoading(false)
        return
      }
      // Redirigir al home según rol
      const home = userRole ? ROLE_HOME[userRole] || '/' : '/'
      router.push(home)
      router.refresh()
    } catch (e) {
      setError('Error de conexión')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 dark:from-stone-900 dark:to-stone-800 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-300 shadow-md">
            <KeyRound className="h-7 w-7" />
          </div>
          <h1 className="mt-3 text-2xl font-bold text-stone-800 dark:text-stone-100">Primer acceso</h1>
          <p className="text-sm text-stone-600 dark:text-stone-400">Cambia tu contraseña para continuar</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4" />
              Cambio obligatorio de contraseña
            </CardTitle>
            <CardDescription>
              Por seguridad, debes cambiar tu contraseña temporal antes de acceder al sistema.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="currentPass">Contraseña actual</Label>
                <div className="relative">
                  <Input
                    id="currentPass"
                    type={showPass ? 'text' : 'password'}
                    value={currentPass}
                    onChange={(e) => setCurrentPass(e.target.value)}
                    placeholder="Tu contraseña actual"
                    autoComplete="current-password"
                    disabled={loading}
                    autoFocus
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    aria-label={showPass ? 'Ocultar' : 'Mostrar'}
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPass">Nueva contraseña</Label>
                <Input
                  id="newPass"
                  type={showPass ? 'text' : 'password'}
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                  disabled={loading}
                />
                {newPass && (
                  <p className={`text-xs flex items-center gap-1 ${passStrong ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {passStrong ? <><Check className="h-3 w-3" /> Contraseña válida</> : 'Mínimo 6 caracteres'}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPass">Confirmar nueva contraseña</Label>
                <Input
                  id="confirmPass"
                  type={showPass ? 'text' : 'password'}
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  placeholder="Repite la nueva contraseña"
                  autoComplete="new-password"
                  disabled={loading}
                />
                {confirmPass && (
                  <p className={`text-xs flex items-center gap-1 ${passesMatch ? 'text-emerald-600' : 'text-red-600'}`}>
                    {passesMatch ? <><Check className="h-3 w-3" /> Las contraseñas coinciden</> : 'No coinciden'}
                  </p>
                )}
              </div>
            </CardContent>
            <div className="px-6 pb-6 mt-2">
              <Button type="submit" className="w-full" disabled={!canSubmit}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
                {loading ? 'Cambiando...' : 'Cambiar contraseña y continuar'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
