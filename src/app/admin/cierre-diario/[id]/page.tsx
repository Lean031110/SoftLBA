'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import {
  ArrowLeft, Loader2, AlertTriangle, Plus, Trash2, Lock, CheckCircle2, Calculator,
} from 'lucide-react'

type Denomination = {
  id: string
  currency: string
  denomination: number
  count: number
  total: number
}

type Close = {
  id: string
  date: string
  status: string
  totalSales: number
  totalCash: number
  totalTransfer: number
  totalOther: number
  totalDiscount: number
  totalWaste: number
  totalExpected: number
  totalReal: number
  difference: number
  observations?: string | null
  openedAt: string
  closedAt: string | null
  user: { username: string; firstName?: string | null; lastName?: string | null }
  areas: {
    id: string
    total: number
    ordersCount: number
    area: { id: string; code: string; name: string }
  }[]
  denominations: Denomination[]
}

const STATUS_LABELS: Record<string, string> = {
  ABIERTO: 'Abierto',
  EN_PROCESO: 'En proceso',
  CERRADO: 'Cerrado',
  BLOQUEADO: 'Bloqueado',
}
const STATUS_COLORS: Record<string, string> = {
  ABIERTO: 'bg-emerald-100 text-emerald-800',
  EN_PROCESO: 'bg-amber-100 text-amber-800',
  CERRADO: 'bg-stone-100 text-stone-800',
  BLOQUEADO: 'bg-red-100 text-red-800',
}

const CUP_DENOMS = [1, 5, 10, 20, 50, 100, 200, 500, 1000, 2000]
const USD_DENOMS = [1, 5, 10, 20, 50, 100]

export default function CierreDetallePage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [close, setClose] = useState<Close | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [obs, setObs] = useState('')
  const [saving, setSaving] = useState(false)

  // Form denominación
  const [currency, setCurrency] = useState('CUP')
  const [denomination, setDenomination] = useState('1')
  const [count, setCount] = useState('0')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/cierre-diario/${id}`)
      const data = await res.json()
      if (data.ok && data.item) {
        setClose(data.item)
        setObs(data.item.observations || '')
      } else {
        setError(data.error || 'No encontrado')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  async function addDenom() {
    const denom = parseFloat(denomination)
    const cnt = parseInt(count)
    if (cnt <= 0) {
      toast.error('Cantidad debe ser mayor que 0')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/cierre-diario/${id}/denominations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currency,
          denomination: denom,
          count: cnt,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Denominación agregada')
        setCount('0')
        load()
      } else {
        toast.error(data.error || 'Error al agregar')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  async function saveObs() {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/cierre-diario/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observations: obs }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Observaciones guardadas')
        load()
      } else {
        toast.error(data.error || 'Error al guardar')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  async function doClose() {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/cierre-diario/${id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close', observations: obs }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Cierre cerrado')
        load()
      } else {
        toast.error(data.error || 'Error al cerrar')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  async function doLock() {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/cierre-diario/${id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lock' }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Cierre bloqueado')
        load()
      } else {
        toast.error(data.error || 'Error al bloquear')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (error || !close) {
    return (
      <div className="max-w-3xl mx-auto">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error || 'No encontrado'}</AlertDescription>
        </Alert>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/admin/cierre-diario">Volver</Link>
        </Button>
      </div>
    )
  }

  const isOpen = close.status === 'ABIERTO' || close.status === 'EN_PROCESO'
  const isClosed = close.status === 'CERRADO'
  const diffZero = close.difference === 0
  const denomTotal = close.denominations.reduce((s, d) => s + d.total, 0)

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/cierre-diario"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">
            Cierre del {new Date(close.date).toLocaleDateString('es-CU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </h1>
          <p className="text-sm text-stone-500">
            Abierto por {close.user.firstName} {close.user.lastName} · {new Date(close.openedAt).toLocaleTimeString('es-CU')}
          </p>
        </div>
        <Badge className={STATUS_COLORS[close.status]} variant="secondary">
          {STATUS_LABELS[close.status]}
        </Badge>
      </div>

      {/* Resumen del día */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-stone-500 uppercase tracking-wider">Ventas totales</p>
            <p className="mt-1 text-2xl font-bold">${close.totalSales.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-stone-500 uppercase tracking-wider">Efectivo</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">${close.totalCash.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-stone-500 uppercase tracking-wider">Transferencias</p>
            <p className="mt-1 text-2xl font-bold">${close.totalTransfer.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-stone-500 uppercase tracking-wider">Otros métodos</p>
            <p className="mt-1 text-2xl font-bold">${close.totalOther.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-stone-500 uppercase tracking-wider">Descuentos</p>
            <p className="mt-1 text-xl font-bold text-amber-600">${close.totalDiscount.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-stone-500 uppercase tracking-wider">Mermas</p>
            <p className="mt-1 text-xl font-bold text-red-600">${close.totalWaste.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-stone-500 uppercase tracking-wider">Esperado en caja</p>
            <p className="mt-1 text-xl font-bold">${close.totalExpected.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Ventas por área */}
      {close.areas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventas por área</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Área</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {close.areas.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.area.name}</TableCell>
                    <TableCell className="text-right">{a.ordersCount}</TableCell>
                    <TableCell className="text-right font-mono">${a.total.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Denominaciones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" /> Conteo de denominaciones
          </CardTitle>
          <CardDescription>
            Cuenta el efectivo por denominación para verificar contra el total teórico
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isOpen && (
            <div className="grid gap-3 sm:grid-cols-4 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs text-stone-500">Moneda</Label>
                <Select value={currency} onValueChange={(v) => {
                  setCurrency(v)
                  setDenomination(v === 'CUP' ? '1' : '1')
                }}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CUP">CUP</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-stone-500">Denominación</Label>
                <Select value={denomination} onValueChange={setDenomination}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(currency === 'CUP' ? CUP_DENOMS : USD_DENOMS).map((d) => (
                      <SelectItem key={d} value={String(d)}>{d} {currency}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-stone-500">Cantidad</Label>
                <Input
                  type="number" min="0" value={count}
                  onChange={(e) => setCount(e.target.value)}
                />
              </div>
              <Button onClick={addDenom} disabled={saving}>
                <Plus className="h-4 w-4 mr-2" /> Agregar
              </Button>
            </div>
          )}

          {close.denominations.length === 0 ? (
            <p className="text-sm text-stone-500 text-center py-4">No hay denominaciones registradas</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Moneda</TableHead>
                  <TableHead className="text-right">Denominación</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {close.denominations.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell><Badge variant="outline">{d.currency}</Badge></TableCell>
                    <TableCell className="text-right font-mono">{d.denomination}</TableCell>
                    <TableCell className="text-right font-mono">{d.count}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">${d.total.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="grid gap-3 sm:grid-cols-3 border-t pt-3">
            <div>
              <p className="text-xs text-stone-500">Total contado</p>
              <p className="text-xl font-bold">${denomTotal.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Esperado</p>
              <p className="text-xl font-bold">${close.totalExpected.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Diferencia</p>
              <p className={`text-xl font-bold ${
                diffZero ? 'text-emerald-600' : 'text-red-600'
              }`}>
                {close.difference > 0 ? '+' : ''}${close.difference.toFixed(2)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Observaciones */}
      <Card>
        <CardHeader><CardTitle className="text-base">Observaciones</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={3}
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Notas sobre el cierre, diferencias, incidentes..."
            disabled={!isOpen}
          />
          {isOpen && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={saveObs} disabled={saving}>
                <Loader2 className={cnSaving(saving)} /> Guardar observaciones
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Acciones */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 justify-end">
          {isOpen && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="default" disabled={saving}>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Cerrar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Cerrar este cierre diario?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Una vez cerrado, no se podrán agregar denominaciones.
                    {close.difference !== 0 && (
                      <span className="block mt-2 text-red-600">
                        Hay una diferencia de {close.difference > 0 ? '+' : ''}${close.difference.toFixed(2)}.
                      </span>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={doClose}>Sí, cerrar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {isClosed && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={saving}>
                  <Lock className="h-4 w-4 mr-2" /> Bloquear
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Bloquear este cierre?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Una vez bloqueado, no se podrá modificar de ninguna forma. Esta acción es permanente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={doLock}>Bloquear</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function cnSaving(saving: boolean) {
  return saving ? 'h-4 w-4 mr-2 animate-spin' : 'hidden'
}
