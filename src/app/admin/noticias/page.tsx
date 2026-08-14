'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import {
  Newspaper, Plus, Search, RefreshCw, Pencil, AlertTriangle, Trash2, Power, Eye, EyeOff,
} from 'lucide-react'

type NewsItem = {
  id: string
  title: string
  content: string
  type: 'INFO' | 'WARNING' | 'PROMO' | 'URGENT'
  isPublic: boolean
  isActive: boolean
  priority: number
  publishedAt: string
  expiresAt?: string | null
}

const TYPE_LABELS: Record<string, string> = {
  INFO: 'Información',
  WARNING: 'Aviso',
  PROMO: 'Promoción',
  URGENT: 'Urgente',
}
const TYPE_COLORS: Record<string, string> = {
  INFO: 'bg-sky-100 text-sky-800',
  WARNING: 'bg-amber-100 text-amber-800',
  PROMO: 'bg-emerald-100 text-emerald-800',
  URGENT: 'bg-red-100 text-red-800',
}

export default function NoticiasListPage() {
  const router = useRouter()
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [type, setType] = useState<string>('all')
  const [active, setActive] = useState<string>('all')
  const [deleting, setDeleting] = useState<NewsItem | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (type !== 'all') params.set('type', type)
      if (active !== 'all') params.set('isActive', active)
      const res = await fetch(`/api/admin/news?${params.toString()}`)
      const data = await res.json()
      if (data.ok) setItems(data.items || [])
      else setError(data.error || 'Error al cargar')
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [q, type, active])

  useEffect(() => { load() }, [load])

  async function toggleActive(n: NewsItem) {
    try {
      const res = await fetch(`/api/admin/news/${n.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !n.isActive }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success(`Noticia ${!n.isActive ? 'activada' : 'desactivada'}`)
        load()
      } else {
        toast.error(data.error || 'Error')
      }
    } catch {
      toast.error('Error de conexión')
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      const res = await fetch(`/api/admin/news/${deleting.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.ok) {
        toast.success('Noticia eliminada')
        setDeleting(null)
        load()
      } else {
        toast.error(data.error || 'Error al eliminar')
      }
    } catch {
      toast.error('Error de conexión')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Newspaper className="h-6 w-6" /> Noticias
          </h1>
          <p className="text-sm text-stone-500">Avisos, promociones y comunicados</p>
        </div>
        <Button onClick={() => router.push('/admin/noticias/nuevo')}>
          <Plus className="h-4 w-4 mr-2" /> Nueva noticia
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs text-stone-500">Buscar</label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Título, contenido..." className="pl-8" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-stone-500">Tipo</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="INFO">Información</SelectItem>
                  <SelectItem value="WARNING">Aviso</SelectItem>
                  <SelectItem value="PROMO">Promoción</SelectItem>
                  <SelectItem value="URGENT">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-stone-500">Estado</label>
              <Select value={active} onValueChange={setActive}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="true">Activas</SelectItem>
                  <SelectItem value="false">Inactivas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button variant="outline" onClick={load} className="mt-3">
            <RefreshCw className="h-4 w-4 mr-2" /> Actualizar
          </Button>
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
              No hay noticias que coincidan con los filtros
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-center">Prioridad</TableHead>
                  <TableHead className="text-center">Pública</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead>Publicada</TableHead>
                  <TableHead>Expira</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell>
                      <Link href={`/admin/noticias/${n.id}`} className="font-medium text-blue-700 hover:underline">
                        {n.title}
                      </Link>
                      <div className="text-xs text-stone-500 truncate max-w-md">{n.content.slice(0, 80)}{n.content.length > 80 && '...'}</div>
                    </TableCell>
                    <TableCell>
                      <Badge className={TYPE_COLORS[n.type]} variant="secondary">{TYPE_LABELS[n.type]}</Badge>
                    </TableCell>
                    <TableCell className="text-center font-mono">{n.priority}</TableCell>
                    <TableCell className="text-center">
                      {n.isPublic ? <Eye className="h-4 w-4 text-emerald-600 inline" /> : <EyeOff className="h-4 w-4 text-stone-400 inline" />}
                    </TableCell>
                    <TableCell className="text-center">
                      {n.isActive ? (
                        <Badge className="bg-emerald-100 text-emerald-800">Activa</Badge>
                      ) : (
                        <Badge variant="secondary">Inactiva</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-stone-500">{new Date(n.publishedAt).toLocaleDateString('es-CU')}</TableCell>
                    <TableCell className="text-xs text-stone-500">
                      {n.expiresAt ? new Date(n.expiresAt).toLocaleDateString('es-CU') : <span className="text-stone-400">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => router.push(`/admin/noticias/${n.id}`)} aria-label="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => toggleActive(n)} aria-label="Activar/Desactivar">
                          <Power className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleting(n)} aria-label="Eliminar">
                          <Trash2 className="h-4 w-4 text-blue-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar noticia?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente: <strong>{deleting?.title}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
