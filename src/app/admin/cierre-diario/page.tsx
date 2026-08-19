'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  Receipt, Plus, AlertTriangle, Loader2, ChevronLeft, ChevronRight, Calendar,
} from 'lucide-react'

type Close = {
  id: string
  date: string
  status: string
  totalSales: number
  totalCash: number
  totalReal: number
  difference: number
  openedAt: string
  closedAt: string | null
  user: { username: string; firstName?: string | null; lastName?: string | null }
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

export default function CierreDiarioPage() {
  const [items, setItems] = useState<Close[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [opening, setOpening] = useState(false)
  const [obs, setObs] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/cierre-diario?page=${page}`)
      const data = await res.json()
      if (data.ok) {
        setItems(data.items || [])
        setTotalPages(data.pagination?.totalPages || 1)
        setTotal(data.pagination?.total || 0)
      } else {
        setError(data.error || 'Error al cargar')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { load() }, [load])

  async function openClose() {
    setOpening(true)
    try {
      const res = await fetch('/api/admin/cierre-diario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observations: obs }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Cierre abierto')
        setObs('')
        setPage(1)
        load()
      } else {
        toast.error(data.error || 'Error al abrir')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setOpening(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6" /> Cierre Diario
          </h1>
          <p className="text-sm text-stone-500">Gestión de cierres de caja por día</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Abrir cierre</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Abrir cierre para hoy</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-stone-500">
                Se calcularán automáticamente las ventas, mermas y descuentos del día actual.
              </p>
              <div className="space-y-1.5">
                <Label>Observaciones iniciales (opcional)</Label>
                <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
              <Button onClick={openClose} disabled={opening}>
                {opening ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Abrir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-2">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : error ? (
            <div className="p-6">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-sm text-stone-500">
              No hay cierres. Abre el primero con "Abrir cierre".
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead className="text-right">Ventas</TableHead>
                    <TableHead className="text-right">Efectivo</TableHead>
                    <TableHead className="text-right">Real</TableHead>
                    <TableHead className="text-right">Diferencia</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-medium text-sm">
                          {new Date(c.date).toLocaleDateString('es-CU')}
                        </div>
                        <div className="text-xs text-stone-500">
                          Abierto: {new Date(c.openedAt).toLocaleTimeString('es-CU', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge kind="cierre-diario" value={c.status} size="sm" />
                      </TableCell>
                      <TableCell className="text-xs">
                        {c.user.firstName} {c.user.lastName}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">${c.totalSales.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">${c.totalCash.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">${c.totalReal.toFixed(2)}</TableCell>
                      <TableCell className={`text-right font-mono text-sm font-semibold ${
                        c.difference === 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {c.difference > 0 ? '+' : ''}${c.difference.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/admin/cierre-diario/${c.id}`}>Ver detalle</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-xs text-stone-500">{total} cierres</p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">Página {page} de {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
