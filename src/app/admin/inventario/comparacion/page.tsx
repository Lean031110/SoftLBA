'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Scale, AlertTriangle } from 'lucide-react'

type Area = { id: string; code: string; name: string }

type Row = {
  id: string
  product: { id: string; code: string; name: string; unit: string; cost: number; category?: string | null }
  unit: string
  theoretical: number
  counted: number | null
  observed: number | null
  diff: number | null
  diffValue: number | null
  lastCountAt: string | null
  minStock: number
}

function ComparacionContent() {
  const sp = useSearchParams()
  const initialArea = sp.get('areaId') || ''
  const [areas, setAreas] = useState<Area[]>([])
  const [areaId, setAreaId] = useState(initialArea)
  const [items, setItems] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cargar áreas
  useEffect(() => {
    fetch('/api/admin/inventario')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setAreas(d.areas || [])
          if (!areaId && d.areas.length > 0) setAreaId(d.areas[0].id)
        }
      })
      .catch(() => {})
  }, [areaId])

  // Cargar comparación
  useEffect(() => {
    if (!areaId) return
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      try {
        const r = await fetch(`/api/admin/inventario/compare?areaId=${areaId}`)
        const d = await r.json()
        if (cancelled) return
        if (d.ok) setItems(d.items || [])
        else setError(d.error || 'Error al cargar')
      } catch {
        if (!cancelled) setError('Error de conexión')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [areaId])

  const totalDiffValue = items.reduce((s, i) => s + (i.diffValue || 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Scale className="h-6 w-6" /> Teórico vs Físico
        </h1>
        <p className="text-sm text-stone-500">Comparación del stock del sistema con el último conteo físico</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Selecciona área</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={areaId} onValueChange={setAreaId}>
            <SelectTrigger className="w-full sm:w-72"><SelectValue placeholder="Área..." /></SelectTrigger>
            <SelectContent>
              {areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {areaId && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-stone-500 uppercase tracking-wider">Items</p>
                <p className="mt-1 text-2xl font-bold">{items.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-stone-500 uppercase tracking-wider">Diferencia total</p>
                <p className={`mt-1 text-2xl font-bold ${totalDiffValue < 0 ? 'text-red-600' : totalDiffValue > 0 ? 'text-emerald-600' : ''}`}>
                  ${totalDiffValue.toFixed(2)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-stone-500 uppercase tracking-wider">Con conteo reciente</p>
                <p className="mt-1 text-2xl font-bold">
                  {items.filter((i) => i.counted !== null).length}/{items.length}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalle por producto</CardTitle>
              <CardDescription>Comparación entre stock del sistema y último conteo físico</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-2">
                  {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : error ? (
                <div className="p-6">
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                </div>
              ) : items.length === 0 ? (
                <div className="p-10 text-center text-sm text-stone-500">No hay items en esta área</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Teórico</TableHead>
                        <TableHead className="text-right">Físico</TableHead>
                        <TableHead className="text-right">Diferencia</TableHead>
                        <TableHead className="text-right">Valor diff</TableHead>
                        <TableHead>Último conteo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <div className="font-medium text-sm">{r.product.name}</div>
                            <div className="text-xs text-stone-500 font-mono">{r.product.code}</div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">{r.theoretical} {r.unit}</TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {r.counted !== null ? `${r.counted} ${r.unit}` : <span className="text-stone-400">—</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.diff === null ? (
                              <span className="text-stone-400">—</span>
                            ) : (
                              <Badge
                                className={
                                  r.diff === 0 ? 'bg-emerald-100 text-emerald-800' :
                                  r.diff < 0 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                                }
                                variant="secondary"
                              >
                                {r.diff > 0 ? '+' : ''}{r.diff} {r.unit}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className={`text-right font-mono text-sm ${
                            r.diffValue === null ? '' :
                            r.diffValue === 0 ? 'text-emerald-600' :
                            r.diffValue < 0 ? 'text-red-600' : 'text-amber-600'
                          }`}>
                            {r.diffValue !== null ? `$${r.diffValue.toFixed(2)}` : '—'}
                          </TableCell>
                          <TableCell className="text-xs text-stone-500">
                            {r.lastCountAt ? new Date(r.lastCountAt).toLocaleDateString('es-CU') : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

export default function ComparacionPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <ComparacionContent />
    </Suspense>
  )
}
