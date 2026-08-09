'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { ROLE_HOME } from '@/lib/permissions'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [restaurantName, setRestaurantName] = useState('Cargando...')

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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 dark:from-stone-900 dark:to-stone-800 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-600 text-white text-3xl shadow-lg">
            🍽️
          </div>
          <h1 className="mt-3 text-2xl font-bold text-stone-800 dark:text-stone-100">{restaurantName}</h1>
          <p className="text-sm text-stone-600 dark:text-stone-400">Iniciar sesión</p>
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
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
              <Link href="/" className="text-xs text-stone-500 hover:text-stone-700 dark:hover:text-stone-300">
                ← Volver a la página principal
              </Link>
            </CardFooter>
          </form>
        </Card>

        <div className="mt-6 text-center text-xs text-stone-400 space-y-1">
          <p>Demo: admin / admin123 · mesero / mesero123</p>
          <p>cocina / cocina123 · cajero / cajero123</p>
        </div>
      </div>
    </div>
  )
}
