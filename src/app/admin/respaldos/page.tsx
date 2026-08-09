'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import {
  Database, Plus, RefreshCw, AlertTriangle, Download, RotateCcw, Loader2, HardDrive,
} from 'lucide-react'

type Backup = {
  id: string
  filename: string
  size: number
  type: string
  status: string
  notes?: string | null
  createdAt: string
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export default function RespaldosPage() {
  const [items, setItems] = useState<Backup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/respaldos')
      const data = await res.json()
      if (data.ok) setItems(data.items || [])
      else setError(data.error || 'Error al cargar')
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function create() {
    setCreating(true)
    try {
      const res = await fetch('/api/admin/respaldos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Backup manual' }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Respaldo creado')
        load()
      } else {
        toast.error(data.error || 'Error al crear')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setCreating(false)
    }
  }

  function download(id: string, filename: string) {
    const link = document.createElement('a')
    link.href = `/api/admin/respaldos/${id}/download`
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Descarga iniciada')
  }

  async function restore(id: string) {
    try {
      const res = await fetch('/api/admin/respaldos/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId: id, confirm: true }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Base de datos restaurada. Recarga la página.')
        load()
      } else {
        toast.error(data.error || 'Error al restaurar')
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
            <Database className="h-6 w-6" /> Respaldos
          </h1>
          <p className="text-sm text-stone-500">Copias de seguridad de la base de datos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-2" /> Actualizar</Button>
          <Button onClick={create} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Crear respaldo
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HardDrive className="h-4 w-4" /> Información
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              Cada respaldo copia el archivo de base de datos SQLite completo. Antes de restaurar, se hace automáticamente un backup de seguridad.
              <strong className="block mt-1">¡La restauración reemplaza todos los datos actuales!</strong>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

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
              No hay respaldos. Crea el primero con "Crear respaldo".
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Archivo</TableHead>
                    <TableHead className="text-right">Tamaño</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Notas</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono text-xs">{b.filename}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatSize(b.size)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{b.type}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(b.createdAt).toLocaleString('es-CU')}
                      </TableCell>
                      <TableCell className="text-xs text-stone-500 max-w-xs truncate">
                        {b.notes || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => download(b.id, b.filename)}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost">
                                <RotateCcw className="h-4 w-4 text-amber-600" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Restaurar este respaldo?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Se reemplazarán <strong>todos los datos actuales</strong> con los del respaldo <code>{b.filename}</code>.
                                  Se creará automáticamente un backup de seguridad del estado actual antes de restaurar.
                                  <span className="block mt-2 text-red-600 font-medium">Esta acción es irreversible.</span>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => restore(b.id)}>Restaurar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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
    </div>
  )
}
