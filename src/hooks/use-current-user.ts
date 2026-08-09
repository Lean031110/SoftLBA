'use client'
// ============================================================
// Hook useCurrentUser - obtiene y cachea el usuario actual
// ============================================================

import { useEffect, useState, useCallback } from 'react'

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
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      if (data.ok && data.user) {
        setUser(data.user)
        setError(null)
      } else {
        setUser(null)
      }
    } catch (e) {
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
