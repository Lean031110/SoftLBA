'use client'

import Image from 'next/image'
import { Loader2 } from 'lucide-react'

export function LoadingScreen({ message = 'Cargando...' }: { message?: string }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
      <div className="relative">
        <Image
          src="/softlba-logo.svg"
          alt="SoftLBA"
          width={64}
          height={64}
          className="h-16 w-16 rounded-2xl opacity-40 animate-pulse"
        />
        <Loader2 className="absolute inset-0 m-auto h-8 w-8 text-blue-600 animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{message}</p>
        <p className="text-xs text-slate-400 mt-1">SoftLBA</p>
      </div>
    </div>
  )
}

export function LoadingCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-3/4 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-2 w-1/2 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-8 w-8' : 'h-6 w-6'
  return <Loader2 className={`${sizeClass} animate-spin text-blue-600`} />
}
