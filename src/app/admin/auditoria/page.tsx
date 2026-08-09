'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  ScrollText, Search, RefreshCw, AlertTriangle, ChevronLeft, ChevronRight, Eye, Calendar,
} from 'lucide-react'

type AuditItem = {
  id: string
  userId: string | null
  action: string
  entity: string
  entityId: string | null
  before: string | null
  after: string | null
  ipAddress: string | null
  userAgent: string | null
  result: string
  createdAt: string
  user: { id: string; username: string; firstName?: string | null; lastName?: string | null } | null
}

type Pagination = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-emerald-100 text-emerald-800',
  UPDATE: 'bg-sky-100 text-sky-800',
  DELETE: 'bg-red-100 text-red-800',
  DEACTIVATE: 'bg-amber-100 text-amber-800',
  LOGIN: 'bg-purple-100 text-purple-800',
  LOGOUT: 'bg-stone-100 text-stone-800',
  RESET_PASSWORD: 'bg-orange-100 text-orange-800',
}

function tryParse(s: string | null): any {
  if (!s) return null
  try { return JSON.parse(s) } catch { return s }
}

function formatValue(v: any): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'string') return v
  return JSON.stringify(v, null, 2)
}

export default function AuditoriaPage() {
  const [items, setItems] = useState<AuditItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [action, setAction] = useState<string>('all')
  const [entity, setEntity] = useState<string>('')
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<AuditItem | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (action !== 'all') params.set('action', action)
      if (entity) params.set('entity', entity)
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      params.set('page', String(page))
      const res = await fetch(`/api/admin/audit?${params.toString()}`)
      const data = await res.json()
      if (data.ok) {
        setItems(data.items || [])
        setPagination(data.pagination)
      } else {
        setError(data.error || 'Error al cargar')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [q, action, entity, from, to, page])

  useEffect(() => { load() }, [load])

  function applyFilters() {
    setPage(1)
    load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ScrollText className="h-6 w-6" /> Auditoría
        </h1>
        <p className="text-sm text-stone-500">Registro de acciones del sistema</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5 lg:col-span-2">
              <label className="text-xs text-stone-500">Buscar</label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Acción, entidad, IP..." className="pl-8" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-stone-500">Acción</label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="CREATE">CREATE</SelectItem>
                  <SelectItem value="UPDATE">UPDATE</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                  <SelectItem value="DEACTIVATE">DEACTIVATE</SelectItem>
                  <SelectItem value="LOGIN">LOGIN</SelectItem>
                  <SelectItem value="LOGOUT">LOGOUT</SelectItem>
                  <SelectItem value="RESET_PASSWORD">RESET_PASSWORD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-stone-500">Entidad</label>
              <Input value={entity} onChange={(e) => setEntity(e.target.value)} placeholder="user, product..." />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-stone-500">Desde</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-stone-400" />
              <label className="text-xs text-stone-500">Hasta:</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </div>
            <Button variant="outline" onClick={applyFilters}>
              <RefreshCw className="h-4 w-4 mr-2" /> Aplicar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
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
              No hay registros que coincidan con los filtros
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead className="text-right">Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs text-stone-500 whitespace-nowrap">
                      {new Date(a.createdAt).toLocaleString('es-CU')}
                    </TableCell>
                    <TableCell>
                      {a.user ? (
                        <div>
                          <div className="text-sm font-medium">
                            {a.user.firstName || a.user.lastName ? `${a.user.firstName || ''} ${a.user.lastName || ''}`.trim() : a.user.username}
                          </div>
                          <div className="text-xs text-stone-500 font-mono">@{a.user.username}</div>
                        </div>
                      ) : <span className="text-stone-400">Sistema</span>}
                    </TableCell>
                    <TableCell>
                      <Badge className={ACTION_COLORS[a.action] || 'bg-stone-100 text-stone-800'} variant="secondary">
                        {a.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="font-mono">{a.entity}</span>
                      {a.entityId && <div className="text-xs text-stone-400 font-mono truncate max-w-[160px]">{a.entityId}</div>}
                    </TableCell>
                    <TableCell className="text-xs text-stone-500 font-mono">{a.ipAddress || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={a.result === 'SUCCESS' ? 'secondary' : 'destructive'}>{a.result}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => setDetail(a)} aria-label="Ver detalle">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {pagination && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-stone-500">
            Mostrando {items.length} de {pagination.total} registros · Página {pagination.page} de {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle de auditoría</DialogTitle>
            <DialogDescription>
              {detail ? `${detail.action} · ${detail.entity} · ${new Date(detail.createdAt).toLocaleString('es-CU')}` : ''}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-stone-500">Usuario</p>
                  <p className="font-medium">
                    {detail.user ? `${detail.user.firstName || ''} ${detail.user.lastName || ''}`.trim() || detail.user.username : 'Sistema'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-stone-500">IP</p>
                  <p className="font-mono text-xs">{detail.ipAddress || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-500">Entidad</p>
                  <p className="font-mono text-xs">{detail.entity} · {detail.entityId || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-500">Resultado</p>
                  <Badge variant={detail.result === 'SUCCESS' ? 'secondary' : 'destructive'}>{detail.result}</Badge>
                </div>
              </div>
              {detail.userAgent && (
                <div>
                  <p className="text-xs text-stone-500 mb-1">User Agent</p>
                  <p className="text-xs font-mono text-stone-600 break-all">{detail.userAgent}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-stone-500 mb-1">Antes</p>
                <pre className="rounded-lg border bg-stone-50 dark:bg-stone-900 p-3 text-xs overflow-x-auto whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                  {formatValue(tryParse(detail.before))}
                </pre>
              </div>
              <div>
                <p className="text-xs text-stone-500 mb-1">Después</p>
                <pre className="rounded-lg border bg-stone-50 dark:bg-stone-900 p-3 text-xs overflow-x-auto whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                  {formatValue(tryParse(detail.after))}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
