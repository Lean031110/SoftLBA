'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Wifi, WifiOff, RefreshCw, Loader2 } from 'lucide-react'

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  async function checkServer() {
    setChecking(true)
    try {
      const res = await fetch('/api/public/config', { cache: 'no-store' })
      if (res.ok) {
        window.location.href = '/'
      } else {
        setIsOnline(false)
      }
    } catch (e) {
      setIsOnline(false)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="w-full max-w-md text-center">
        {/* Logo */}
        <div className="inline-flex items-center justify-center mb-6">
          <Image
            src="/softlba-logo.svg"
            alt="SoftLBA"
            width={80}
            height={80}
            className="h-20 w-20 rounded-2xl shadow-lg opacity-60"
            priority
          />
        </div>

        <h1 className="text-2xl font-bold text-blue-700 dark:text-blue-300 mb-2">SoftLBA</h1>

        {/* Icono de estado */}
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900 mb-6 mt-4">
          <WifiOff className="h-10 w-10 text-amber-600 dark:text-amber-400" />
        </div>

        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          Sin conexión al servidor
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          Para usar SoftLBA necesitas estar conectado a la red WiFi del restaurante
          (red local). Verifica que estás en la misma red que el servidor.
        </p>

        {/* Instrucciones */}
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 mb-6 text-left">
          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Pasos:</p>
          <ol className="text-sm text-slate-700 dark:text-slate-300 space-y-2">
            <li className="flex gap-2">
              <span className="font-bold text-blue-600">1.</span>
              <span>Conéctate a la red WiFi del restaurante</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-blue-600">2.</span>
              <span>Verifica que el servidor SoftLBA esté encendido</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-blue-600">3.</span>
              <span>Pulsa el botón &quot;Reintentar&quot; para continuar</span>
            </li>
          </ol>
        </div>

        {/* Estado de conexión */}
        <div className="flex items-center justify-center gap-2 mb-4 text-sm">
          {isOnline ? (
            <>
              <Wifi className="h-4 w-4 text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400">Hay conexión a internet</span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-amber-500" />
              <span className="text-amber-600 dark:text-amber-400">Sin conexión a internet</span>
            </>
          )}
        </div>

        {/* Botón reintentar */}
        <Button
          onClick={checkServer}
          disabled={checking}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          size="lg"
        >
          {checking ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Verificando conexión...
            </>
          ) : (
            <>
              <RefreshCw className="h-5 w-5 mr-2" />
              Reintentar conexión
            </>
          )}
        </Button>

        <p className="text-xs text-slate-400 mt-6">
          SoftLBA v0.8.0 · Sistema local · Sin dependencia de Internet
        </p>
      </div>
    </div>
  )
}
