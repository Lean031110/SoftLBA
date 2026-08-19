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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { BookOpen, Plus, RefreshCw, AlertTriangle, Pencil, Trash2 } from 'lucide-react'

type Recipe = {
  id: string
  yield: number
  preparationTime: number
  product: { id: string; code: string; name: string; category?: string | null; price: number }
  ingredients: {
    id: string
    quantity: number
    unit: string
    product: { id: string; code: string; name: string; cost: number; unit: string }
  }[]
  totalCost: number
}

export default function RecetasPage() {
  const [items, setItems] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/recipes')
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

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/admin/recipes/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.ok) {
        toast.success('Receta eliminada')
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
            <BookOpen className="h-6 w-6" /> Recetas
          </h1>
          <p className="text-sm text-stone-500">Fórmulas de productos finales con sus ingredientes y costo</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-2" /> Actualizar</Button>
          <Button asChild><Link href="/admin/recetas/nuevo"><Plus className="h-4 w-4 mr-2" /> Nueva receta</Link></Button>
        </div>
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
              No hay recetas creadas. Crea la primera con "Nueva receta".
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-center">Ingredientes</TableHead>
                    <TableHead className="text-right">Rendimiento</TableHead>
                    <TableHead className="text-right">Costo total</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-right">Margen</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((r) => {
                    const margin = r.product.price - r.totalCost
                    const marginPct = r.product.price > 0 ? (margin / r.product.price) * 100 : 0
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Link href={`/admin/recetas/${r.id}`} className="font-medium hover:underline">
                            {r.product.name}
                          </Link>
                          <div className="text-xs text-stone-500 font-mono">{r.product.code}</div>
                        </TableCell>
                        <TableCell className="text-center text-sm">{r.ingredients.length}</TableCell>
                        <TableCell className="text-right text-sm">{r.yield}</TableCell>
                        <TableCell className="text-right font-mono text-sm">${r.totalCost.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">${r.product.price.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <Badge
                            className={margin >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}
                            variant="secondary"
                          >
                            ${margin.toFixed(2)} ({marginPct.toFixed(0)}%)
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" asChild>
                              <Link href={`/admin/recetas/${r.id}`}><Pencil className="h-4 w-4" /></Link>
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-red-600" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar receta?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Se eliminará la receta de <strong>{r.product.name}</strong>. Esta acción no se puede deshacer.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => remove(r.id)}>Eliminar</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
