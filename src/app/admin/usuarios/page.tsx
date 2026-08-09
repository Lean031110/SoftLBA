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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  Users, Plus, Search, KeyRound, AlertTriangle, Power, Pencil, RefreshCw, Copy, Check,
} from 'lucide-react'
import { ROLE_LABELS, ROLE_BADGE_COLORS, type UserRole } from '@/lib/permissions'

type UserItem = {
  id: string
  username: string
  email?: string | null
  role: UserRole
  isActive: boolean
  mustChangePass: boolean
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  lastLoginAt?: string | null
  createdAt: string
}

export default function UsuariosListPage() {
  const router = useRouter()
  const [items, setItems] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [role, setRole] = useState<string>('all')
  const [active, setActive] = useState<string>('all')
  const [resetDialog, setResetDialog] = useState<{ open: boolean; user: UserItem | null; password?: string; loading?: boolean }>({ open: false, user: null })
  const [copied, setCopied] = useState(false)
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (role !== 'all') params.set('role', role)
      if (active !== 'all') params.set('isActive', active)
      const res = await fetch(`/api/admin/usuarios?${params.toString()}`)
      const data = await res.json()
      if (data.ok) setItems(data.items || [])
      else setError(data.error || 'Error al cargar')
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [q, role, active])

  useEffect(() => { load() }, [load])

  async function handleDeactivate(u: UserItem) {
    setDeactivatingId(u.id)
    try {
      const res = await fetch(`/api/admin/usuarios/${u.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.ok) {
        toast.success(`Usuario ${u.username} desactivado`)
        load()
      } else {
        toast.error(data.error || 'Error al desactivar')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setDeactivatingId(null)
    }
  }

  async function handleResetPassword(u: UserItem) {
    setResetDialog({ open: true, user: u, loading: true })
    try {
      const res = await fetch(`/api/admin/usuarios/${u.id}/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const data = await res.json()
      if (data.ok) {
        setResetDialog({ open: true, user: u, password: data.password })
        toast.success('Contraseña reseteada')
      } else {
        toast.error(data.error || 'Error al resetear')
        setResetDialog({ open: false, user: null })
      }
    } catch {
      toast.error('Error de conexión')
      setResetDialog({ open: false, user: null })
    }
  }

  function copyPassword() {
    if (!resetDialog.password) return
    navigator.clipboard.writeText(resetDialog.password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Usuarios
          </h1>
          <p className="text-sm text-stone-500">Gestiona los usuarios del sistema</p>
        </div>
        <Button onClick={() => router.push('/admin/usuarios/nuevo')}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo usuario
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <label className="text-xs text-stone-500">Buscar</label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Nombre, usuario, email..."
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-stone-500">Rol</label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ADMIN">Administrador</SelectItem>
                  <SelectItem value="MESERO">Mesero</SelectItem>
                  <SelectItem value="COCINA">Cocina</SelectItem>
                  <SelectItem value="PIZZERIA">Pizzería</SelectItem>
                  <SelectItem value="CAJERO">Cajero</SelectItem>
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
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={load} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" /> Actualizar
              </Button>
            </div>
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
              No hay usuarios que coincidan con los filtros
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Último acceso</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <Link href={`/admin/usuarios/${u.id}`} className="font-medium text-blue-700 hover:underline">
                        @{u.username}
                      </Link>
                      {u.mustChangePass && (
                        <Badge variant="outline" className="ml-2 text-amber-700 border-amber-300">Cambiar pass</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : <span className="text-stone-400">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge className={ROLE_BADGE_COLORS[u.role]} variant="secondary">{ROLE_LABELS[u.role]}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-stone-500">
                      {u.email && <div>{u.email}</div>}
                      {u.phone && <div>📱 {u.phone}</div>}
                      {!u.email && !u.phone && <span className="text-stone-400">—</span>}
                    </TableCell>
                    <TableCell>
                      {u.isActive ? (
                        <Badge className="bg-emerald-100 text-emerald-800">Activo</Badge>
                      ) : (
                        <Badge variant="destructive">Inactivo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-stone-500">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('es-CU') : 'Nunca'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => router.push(`/admin/usuarios/${u.id}`)} aria-label="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleResetPassword(u)} aria-label="Resetear contraseña">
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        {u.isActive && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeactivate(u)}
                            disabled={deactivatingId === u.id}
                            aria-label="Desactivar"
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={resetDialog.open} onOpenChange={(open) => !open && setResetDialog({ open: false, user: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Contraseña reseteada
            </DialogTitle>
            <DialogDescription>
              {resetDialog.user ? (
                <>Se generó una nueva contraseña para <strong>@{resetDialog.user.username}</strong>. El usuario deberá cambiarla al iniciar sesión.</>
              ) : 'Generando...'}
            </DialogDescription>
          </DialogHeader>
          {resetDialog.password && (
            <div className="space-y-3">
              <div className="rounded-lg border bg-stone-50 dark:bg-stone-900 p-4">
                <p className="text-xs text-stone-500 mb-1">Nueva contraseña:</p>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-lg font-semibold tracking-wider">{resetDialog.password}</code>
                  <Button size="icon" variant="ghost" onClick={copyPassword} aria-label="Copiar">
                    {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Anota esta contraseña en un lugar seguro. No se volverá a mostrar.
                </AlertDescription>
              </Alert>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setResetDialog({ open: false, user: null })}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
