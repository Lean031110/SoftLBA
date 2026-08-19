'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="text-center">
        <Image
          src="/softlba-logo.svg"
          alt="SoftLBA"
          width={56}
          height={56}
          className="h-14 w-14 rounded-xl mx-auto mb-3 shadow-md"
        />
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
        <p className="mt-4 text-slate-600 dark:text-slate-400">Cerrando sesión...</p>
      </div>
    </div>
  )
}
