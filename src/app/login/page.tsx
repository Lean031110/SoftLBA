'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { ROLE_HOME } from '@/lib/permissions'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [restaurantName, setRestaurantName] = useState('Cargando...')
  const [showDemo, setShowDemo] = useState(false)

  const redirect = searchParams.get('redirect')

  useEffect(() => {
    fetch('/api/public/config')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.config?.name) setRestaurantName(d.config.name)
        else setRestaurantName('Restaurante')
      })
      .catch(() => setRestaurantName('Restaurante'))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!username || !password) {
      setError('Introduce usuario y contraseña')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!data.ok) {
        setError(data.error || 'Error al iniciar sesión')
        setLoading(false)
        return
      }
      // Si debe cambiar contraseña, ir a primer-acceso
      if (data.user.mustChangePass) {
        router.push('/primer-acceso')
        router.refresh()
        return
      }
      // Redirigir según rol o al destino
      if (redirect) {
        router.push(redirect)
      } else {
        const home = ROLE_HOME[data.user.role as keyof typeof ROLE_HOME] || '/'
        router.push(home)
      }
      router.refresh()
    } catch (e) {
      setError('Error de conexión')
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center mb-3">
          <Image
            src="/softlba-logo.svg"
            alt="SoftLBA"
            width={80}
            height={80}
            className="h-20 w-20 rounded-2xl shadow-lg"
            priority
          />
        </div>
        <h1 className="text-2xl font-bold text-blue-700 dark:text-blue-300">SoftLBA</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">{restaurantName} · Iniciar sesión</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogIn className="h-5 w-5" />
            Acceso al sistema
          </CardTitle>
          <CardDescription>Introduce tus credenciales para continuar</CardDescription>
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
              <Label htmlFor="username">Usuario</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="tu.usuario"
                autoComplete="username"
                disabled={loading}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={loading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPass ? 'Ocultar' : 'Mostrar'}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 mt-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogIn className="h-4 w-4 mr-2" />}
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
            <Link href="/" className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
              ← Volver a la página principal
            </Link>
          </CardFooter>
        </form>
      </Card>

      {/* Usuarios demo - colapsable */}
      <DemoUsersSection show={showDemo} onToggle={() => setShowDemo(!showDemo)} />
    </div>
  )
}

function DemoUsersSection({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/public/config')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setEnabled(d.config?.showDemoUsers !== false ? true : false)
        } else {
          setEnabled(false)
        }
      })
      .catch(() => setEnabled(false))
  }, [])

  if (enabled === null) return null
  if (!enabled) return null

  return (
    <div className="mt-6 text-center">
      <button
        type="button"
        onClick={onToggle}
        className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline"
      >
        {show ? 'Ocultar usuarios demo' : 'Ver usuarios demo'}
      </button>
      {show && (
        <div className="mt-2 text-xs text-slate-400 space-y-1 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-200 dark:border-slate-800">
          <p><strong>admin</strong> / admin123 · acceso total</p>
          <p><strong>mesero</strong> / mesero123 · pedidos</p>
          <p><strong>cocina</strong> / cocina123 · cocina</p>
          <p><strong>cajero</strong> / cajero123 · finanzas</p>
        </div>
      )}
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <Suspense fallback={
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  )
}
