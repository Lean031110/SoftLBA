'use client'
// ============================================================
// Hook useCurrentUser - obtiene y cachea el usuario actual
// ============================================================
//
// FRONTEND-02A (fix #1): usa apiGet para que un 401 redirija automáticamente
// a /login?expired=1 (manejado por apiFetch en src/lib/api.ts).
// Antes: fetch directo + setUser(null) sin redirect = pantalla en blanco.

import { useEffect, useState, useCallback } from 'react'
import { apiGet, ApiError } from '@/lib/api'

export type CurrentUser = {
  id: string
  username: string
  email?: string | null
  role: 'ADMIN' | 'MESERO' | 'MESERO_PRO' | 'COCINA' | 'PIZZERIA' | 'CAJERO'
  firstName?: string | null
  lastName?: string | null
  avatarUrl?: string | null
  mustChangePass: boolean
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      // apiGet lanza ApiError si res.status !== 2xx.
      // En 401, apiFetch redirige a /login?expired=1 antes de lanzar.
      const data = await apiGet<{ ok: boolean; user: CurrentUser | null }>('/api/auth/me')
      if (data.ok && data.user) {
        setUser(data.user)
        setError(null)
      } else {
        // 200 pero sin usuario = sesión no iniciada (página pública).
        setUser(null)
        setError(null)
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        // apiFetch ya redirigió; no romper el estado.
        setUser(null)
        return
      }
      setUser(null)
      setError('Error al cargar usuario')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { user, loading, error, refresh }
}
