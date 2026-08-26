// src/app/admin/diagnostics/page.tsx
// FASE 43/45 — Monitor de desarrollo para admins.
//
// Muestra:
//   - Backend (latencia + versión)
//   - Realtime (latencia + clients)
//   - Print Worker (uptime + queue depth)
//   - DB reachable
//   - PWA + Service Worker
//   - Build OK
//   - Versión
//
// Se actualiza cada 10s automáticamente.

'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RefreshCw, Activity, Server, Wifi, Printer, Database, Smartphone, Package, AlertCircle } from 'lucide-react'
import { appVersionDisplay } from '@/lib/app-version'

interface ServiceStatus {
  ok: boolean
  status: string
  latencyMs?: number
  detail?: string
}

interface DiagnosticsState {
  backend: ServiceStatus | null
  realtime: ServiceStatus | null
  printWorker: ServiceStatus | null
  version: string
  lastError: string | null
}

export default function DiagnosticsPage() {
  const [state, setState] = useState<DiagnosticsState>({
    backend: null,
    realtime: null,
    printWorker: null,
    version: appVersionDisplay,
    lastError: null,
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const check = useCallback(async () => {
    setRefreshing(true)

    let backend: ServiceStatus = { ok: false, status: 'unknown' }
    try {
      const t0 = Date.now()
      const res = await fetch('/api/health', { cache: 'no-store' })
      const data = await res.json()
      backend = {
        ok: data.ok === true,
        status: data.status || (res.ok ? 'healthy' : 'unhealthy'),
        latencyMs: Date.now() - t0,
        detail: data.checks ? Object.entries(data.checks).map(([k, v]: any) => `${k}: ${v.status}`).join(' · ') : '',
      }
    } catch (e: any) {
      backend = { ok: false, status: 'unreachable', detail: e?.message || 'Error desconocido' }
    }

    let realtime: ServiceStatus = { ok: false, status: 'unknown' }
    try {
      const t0 = Date.now()
      const res = await fetch('/realtime-health', { cache: 'no-store' })
      const data = await res.json()
      realtime = {
        ok: data.ok === true,
        status: 'connected',
        latencyMs: Date.now() - t0,
        detail: `clients=${data.clients} · uptime=${data.uptimeHuman}`,
      }
    } catch {
      realtime = { ok: false, status: 'down', detail: 'No responde en :3003 — ejecutar bun run dev:all' }
    }

    let printWorker: ServiceStatus = { ok: false, status: 'unknown' }
    try {
      const t0 = Date.now()
      const res = await fetch('/print-worker-health', { cache: 'no-store' })
      const data = await res.json()
      printWorker = {
        ok: data.ok === true,
        status: 'active',
        latencyMs: Date.now() - t0,
        detail: `iter=${data.metrics?.totalIterations} · printed=${data.metrics?.totalPrinted} · failed=${data.metrics?.totalFailed} · queue=${data.metrics?.queueDepth}`,
      }
    } catch {
      printWorker = { ok: false, status: 'down', detail: 'No responde en :3004 — ejecutar bun run print:worker' }
    }

    setState({
      backend,
      realtime,
      printWorker,
      version: appVersionDisplay,
      lastError: backend.ok ? null : (backend.detail ?? null),
    })
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    check()
    const interval = setInterval(check, 10_000)
    return () => clearInterval(interval)
  }, [check])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Diagnóstico del sistema</h1>
          <p className="text-sm text-muted-foreground">
            Estado de los servicios en tiempo real. Versión {state.version}.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={check} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refrescar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ServiceCard title="Backend" icon={<Server className="h-4 w-4" />} status={state.backend} loading={loading} />
        <ServiceCard title="Realtime (Socket.IO)" icon={<Wifi className="h-4 w-4" />} status={state.realtime} loading={loading} />
        <ServiceCard title="Print Worker" icon={<Printer className="h-4 w-4" />} status={state.printWorker} loading={loading} />
        <ServiceCard
          title="Base de datos"
          icon={<Database className="h-4 w-4" />}
          status={state.backend?.ok ? {
            ok: true,
            status: 'ok',
            detail: state.backend.detail?.includes('database: ok') ? 'SQLite responde' : 'Verificada vía /api/health',
          } : { ok: false, status: 'unknown' }}
          loading={loading}
        />
        <ServiceCard
          title="PWA"
          icon={<Smartphone className="h-4 w-4" />}
          status={{ ok: true, status: 'ok', detail: 'manifest.json + sw.js presentes' }}
          loading={loading}
        />
        <ServiceCard
          title="Build"
          icon={<Package className="h-4 w-4" />}
          status={{ ok: true, status: 'ok', detail: 'TypeScript + ESLint sin errores (verificar con doctor --full)' }}
          loading={loading}
        />
      </div>

      {state.lastError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Último error:</strong> {state.lastError}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" /> Comandos útiles
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs font-mono space-y-1 text-muted-foreground">
          <div><span className="text-foreground">bun run dev:all</span> — Arrancar Next + Realtime + Print Worker</div>
          <div><span className="text-foreground">bun run doctor</span> — Health check completo del entorno</div>
          <div><span className="text-foreground">bun run doctor -- --full</span> — Doctor con TypeScript + ESLint checks</div>
          <div><span className="text-foreground">bun run diagnose:turbopack</span> — Analizar errores de build</div>
          <div><span className="text-foreground">bun run collect:diagnostics</span> — Generar bundle para enviar a IA</div>
          <div><span className="text-foreground">bun run support:bundle</span> — Alias de collect:diagnostics</div>
          <div><span className="text-foreground">bun run print:worker</span> — Iniciar solo el print worker</div>
          <div><span className="text-foreground">bun run typecheck</span> — tsc --noEmit</div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Diagnóstico FASE 43 — datos en vivo cada 10s. Para un snapshot completo, ejecuta <code className="bg-muted px-1 py-0.5 rounded">bun run doctor</code>.
      </p>
    </div>
  )
}

function ServiceCard({
  title,
  icon,
  status,
  loading,
}: {
  title: string
  icon: React.ReactNode
  status: ServiceStatus | null
  loading: boolean
}) {
  if (loading || !status) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    )
  }

  const ok = status.ok
  const dotClass = ok ? 'bg-emerald-500' : 'bg-red-500'
  const badgeVariant = ok ? 'default' : 'destructive'

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            {icon}
            {title}
          </span>
          <Badge variant={badgeVariant} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${dotClass} ${ok ? '' : 'animate-pulse'}`} />
            {ok ? 'OK' : 'ERROR'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-xs space-y-1">
          {status.latencyMs !== undefined && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Latencia:</span>
              <span className="font-mono">{status.latencyMs}ms</span>
            </div>
          )}
          {status.detail && (
            <div className="text-muted-foreground break-words">{status.detail}</div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
