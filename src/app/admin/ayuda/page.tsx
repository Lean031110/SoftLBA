'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
  HelpCircle, Plus, Search, RefreshCw, Pencil, AlertTriangle, Trash2, Eye,
} from 'lucide-react'

type HelpItem = {
  id: string
  module: string
  title: string
  content: string
  order: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function AyudaListPage() {
  const router = useRouter()
  const [items, setItems] = useState<HelpItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [moduleFilter, setModuleFilter] = useState<string>('all')
  const [active, setActive] = useState<string>('all')
  const [deleting, setDeleting] = useState<HelpItem | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (moduleFilter !== 'all') params.set('module', moduleFilter)
      if (active !== 'all') params.set('isActive', active)
      const res = await fetch(`/api/admin/help?${params.toString()}`)
      const data = await res.json()
      if (data.ok) setItems(data.items || [])
      else setError(data.error || 'Error al cargar')
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [q, moduleFilter, active])

  useEffect(() => { load() }, [load])

  async function handleDelete() {
    if (!deleting) return
    try {
      const res = await fetch(`/api/admin/help/${deleting.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.ok) {
        toast.success('Artículo eliminado')
        setDeleting(null)
        load()
      } else {
        toast.error(data.error || 'Error al eliminar')
      }
    } catch {
      toast.error('Error de conexión')
    }
  }

  const modules = Array.from(new Set(items.map((i) => i.module)))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HelpCircle className="h-6 w-6" /> Ayuda
          </h1>
          <p className="text-sm text-stone-500">Artículos de ayuda para usuarios del sistema</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/ayuda" target="_blank"><Eye className="h-4 w-4 mr-2" /> Vista pública</Link>
          </Button>
          <Button onClick={() => router.push('/admin/ayuda/nuevo')}>
            <Plus className="h-4 w-4 mr-2" /> Nuevo artículo
          </Button>
        </div>
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
              <label className="text-xs text-stone-500">Módulo</label>
              <Select value={moduleFilter} onValueChange={setModuleFilter}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {modules.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-stone-500">Estado</label>
              <Select value={active} onValueChange={setActive}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="true">Activos</SelectItem>
                  <SelectItem value="false">Inactivos</SelectItem>
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
              No hay artículos que coincidan con los filtros
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead className="text-center">Orden</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead>Actualizado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell><Badge variant="outline" className="font-mono text-xs">{h.module}</Badge></TableCell>
                    <TableCell>
                      <Link href={`/admin/ayuda/${h.id}`} className="font-medium text-blue-700 hover:underline">
                        {h.title}
                      </Link>
                      <div className="text-xs text-stone-500 truncate max-w-md">{h.content.slice(0, 80)}{h.content.length > 80 && '...'}</div>
                    </TableCell>
                    <TableCell className="text-center font-mono">{h.order}</TableCell>
                    <TableCell className="text-center">
                      {h.isActive ? (
                        <Badge className="bg-emerald-100 text-emerald-800">Activo</Badge>
                      ) : (
                        <Badge variant="secondary">Inactivo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-stone-500">{new Date(h.updatedAt).toLocaleDateString('es-CU')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => router.push(`/admin/ayuda/${h.id}`)} aria-label="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleting(h)} aria-label="Eliminar">
                          <Trash2 className="h-4 w-4 text-blue-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar artículo?</AlertDialogTitle>
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
