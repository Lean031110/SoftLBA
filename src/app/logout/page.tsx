'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LogoutPage() {
  const router = useRouter()

  useEffect(() => {
    fetch('/api/auth/logout', { method: 'POST' })
      .then(() => {
        router.push('/login')
        router.refresh()
      })
      .catch(() => {
        router.push('/login')
      })
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-900">
      <div className="text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        </div>
        <p className="mt-4 text-stone-600 dark:text-stone-400">Cerrando sesión...</p>
      </div>
    </div>
  )
}
