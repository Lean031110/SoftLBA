'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  ArrowLeft, Search, Plus, Minus, Trash2, Send, ShoppingCart, Check, X,
} from 'lucide-react'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCurrency } from '@/lib/order-utils'

type Area = { id: string; code: string; name: string }
type Table = { id: string; code: string; name: string; areaId: string | null; capacity: number }
type Product = {
  id: string
  code: string
  name: string
  description?: string | null
  type: string
  category?: string | null
  unit: string
  price: number
  areaStock: number | null
}

type CartItem = {
  product: Product
  quantity: number
  notes: string
}

export default function NuevoPedidoPage() {
  const router = useRouter()
  const { user } = useCurrentUser()
  const [areas, setAreas] = useState<Area[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [areaId, setAreaId] = useState('')
  const [tableId, setTableId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [notes, setNotes] = useState('')
  const [discountPct, setDiscountPct] = useState(0)
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [submitting, setSubmitting] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)

  // Cargar áreas
  useEffect(() => {
    fetch('/api/mesero/areas')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setAreas(d.items || [])
          const salon = (d.items || []).find((a: Area) => a.code === 'SALON')
          if (salon) setAreaId(salon.id)
        }
      })
      .catch(() => {})
  }, [])

  // Cargar mesas
  useEffect(() => {
    if (!areaId) { setTables([]); return }
    fetch(`/api/mesero/tables?areaId=${areaId}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setTables(d.items || []) })
      .catch(() => {})
    setTableId('')
  }, [areaId])

  // Cargar productos con stock del área
  const loadProducts = useCallback(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (areaId) params.set('areaId', areaId)
    fetch(`/api/mesero/products?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setProducts(d.items || [])
        else setError(d.error || 'Error al cargar productos')
      })
      .catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false))
  }, [areaId])

  useEffect(() => { loadProducts() }, [loadProducts])

  // Filtrar productos por búsqueda y categoría
  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[],
    [products],
  )

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (category !== 'all' && p.category !== category) return false
      if (search) {
        const q = search.toLowerCase()
        return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
      }
      return true
    })
  }, [products, search, category])

  // Cálculos de carrito
  const subtotal = useMemo(
    () => cart.reduce((s, i) => s + i.product.price * i.quantity, 0),
    [cart],
  )
  const discountAmount = useMemo(() => +(subtotal * (discountPct / 100)).toFixed(2), [subtotal, discountPct])
  const total = useMemo(() => +(subtotal - discountAmount).toFixed(2), [subtotal, discountAmount])

  function addToCart(p: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === p.id)
      if (existing) {
        return prev.map((i) =>
          i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i,
        )
      }
      return [...prev, { product: p, quantity: 1, notes: '' }]
    })
  }

  function updateQuantity(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) =>
          i.product.id === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i,
        )
        .filter((i) => i.quantity > 0),
    )
  }

  function setQuantity(productId: string, value: number) {
    if (value <= 0) {
      setCart((prev) => prev.filter((i) => i.product.id !== productId))
      return
    }
    setCart((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, quantity: value } : i)),
    )
  }

  function removeItem(productId: string) {
    setCart((prev) => prev.filter((i) => i.product.id !== productId))
  }

  function updateItemNotes(productId: string, itemNotes: string) {
    setCart((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, notes: itemNotes } : i)),
    )
  }

  const { emit } = useRealtime({
    userId: user?.id,
    role: user?.role,
  })

  async function handleSubmit(sendToKitchen: boolean) {
    if (!areaId) { toast.error('Selecciona un área'); return }
    if (cart.length === 0) { toast.error('Agrega al menos un producto'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/mesero/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          areaId,
          tableId: tableId || undefined,
          customerName: customerName || undefined,
          notes: notes || undefined,
          discountPct,
          sendToKitchen,
          items: cart.map((i) => ({
            productId: i.product.id,
            quantity: i.quantity,
            notes: i.notes || undefined,
          })),
        }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success(sendToKitchen ? 'Pedido enviado a cocina' : 'Pedido creado')
        if (sendToKitchen && data.wsPayload) {
          emit('order:new', data.wsPayload)
        }
        router.push(`/mesero/pedidos/${data.item.id}`)
      } else {
        toast.error(data.error || 'Error al crear pedido')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => router.push('/mesero')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">Nuevo pedido</h1>
            <p className="text-xs text-stone-500">Selecciona productos y envía a cocina</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Productos */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filtros */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Área</Label>
                  <Select value={areaId} onValueChange={setAreaId}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Selecciona área" /></SelectTrigger>
                    <SelectContent>
                      {areas.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Mesa (opcional)</Label>
                  <Select value={tableId} onValueChange={setTableId}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Sin mesa (para llevar)" /></SelectTrigger>
                    <SelectContent>
                      {tables.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name} · {t.capacity} pers.</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar producto por nombre o código..."
                  className="pl-8"
                />
              </div>
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <Button
                    variant={category === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCategory('all')}
                    className="h-7"
                  >
                    Todas
                  </Button>
                  {categories.map((c) => (
                    <Button
                      key={c}
                      variant={category === c ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCategory(c)}
                      className="h-7"
                    >
                      {c}
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Grid de productos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Productos disponibles</span>
                <Badge variant="secondary" className="text-xs">{filteredProducts.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-24" />)}
                </div>
              ) : error ? (
                <div className="p-4">
                  <Alert variant="destructive">
                    <X className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="p-8 text-center text-sm text-stone-500">
                  No se encontraron productos
                </div>
              ) : (
                <ScrollArea className="max-h-[60vh]">
                  <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {filteredProducts.map((p) => {
                      const inCart = cart.find((i) => i.product.id === p.id)
                      const outOfStock = p.areaStock !== null && p.areaStock <= 0
                      return (
                        <button
                          key={p.id}
                          onClick={() => addToCart(p)}
                          disabled={outOfStock}
                          className={`text-left border rounded-lg p-3 transition-colors ${
                            inCart
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                              : 'border-stone-200 dark:border-stone-800 hover:border-blue-300'
                          } ${outOfStock ? 'opacity-50 cursor-not-allowed' : 'hover:bg-stone-50 dark:hover:bg-stone-900'}`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <p className="text-sm font-medium line-clamp-2">{p.name}</p>
                            {inCart && (
                              <Badge variant="default" className="shrink-0 text-[10px] h-5 px-1.5">
                                {inCart.quantity}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-stone-500 mt-1">{p.code} · {p.type}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                              {formatCurrency(p.price)}
                            </span>
                            {p.areaStock !== null && (
                              <span className={`text-[10px] ${outOfStock ? 'text-blue-600' : 'text-stone-500'}`}>
                                Stock: {p.areaStock}
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Carrito - Desktop sticky */}
        <div className="hidden lg:block space-y-4">
          <CartContent
            cart={cart}
            customerName={customerName}
            setCustomerName={setCustomerName}
            notes={notes}
            setNotes={setNotes}
            discountPct={discountPct}
            setDiscountPct={setDiscountPct}
            subtotal={subtotal}
            discountAmount={discountAmount}
            total={total}
            submitting={submitting}
            onRemove={removeItem}
            onUpdateQty={updateQuantity}
            onSetQty={setQuantity}
            onUpdateNotes={updateItemNotes}
            onSubmit={handleSubmit}
            formatCurrency={formatCurrency}
          />
        </div>
      </div>

      {/* Botón flotante del carrito - solo móvil */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-4 left-4 right-4 z-50">
          <Sheet open={cartOpen} onOpenChange={setCartOpen}>
            <SheetTrigger asChild>
              <Button className="w-full h-14 shadow-lg text-base" size="lg">
                <ShoppingCart className="h-5 w-5 mr-2" />
                Ver pedido ({cart.length}) · {formatCurrency(total)}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[85vh] p-0 overflow-y-auto">
              <CartContent
                cart={cart}
                customerName={customerName}
                setCustomerName={setCustomerName}
                notes={notes}
                setNotes={setNotes}
                discountPct={discountPct}
                setDiscountPct={setDiscountPct}
                subtotal={subtotal}
                discountAmount={discountAmount}
                total={total}
                submitting={submitting}
                onRemove={removeItem}
                onUpdateQty={updateQuantity}
                onSetQty={setQuantity}
                onUpdateNotes={updateItemNotes}
                onSubmit={(send) => { handleSubmit(send); setCartOpen(false) }}
                formatCurrency={formatCurrency}
              />
            </SheetContent>
          </Sheet>
        </div>
      )}
    </div>
  )
}

// Componente separado para el contenido del carrito (reutilizable)
function CartContent({
  cart, customerName, setCustomerName, notes, setNotes, discountPct, setDiscountPct,
  subtotal, discountAmount, total, submitting, onRemove, onUpdateQty, onSetQty, onUpdateNotes, onSubmit, formatCurrency,
}: any) {
  return (
    <Card className="lg:sticky lg:top-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShoppingCart className="h-4 w-4" />
          Pedido
          {cart.length > 0 && <Badge variant="secondary" className="text-xs">{cart.length}</Badge>}
        </CardTitle>
      </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="customer" className="text-xs">Cliente (opcional)</Label>
                <Input
                  id="customer"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nombre del cliente"
                  maxLength={120}
                />
              </div>

              {cart.length === 0 ? (
                <div className="py-8 text-center text-sm text-stone-500">
                  <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-stone-300" />
                  Agrega productos al pedido
                </div>
              ) : (
                <ScrollArea className="max-h-[60vh]">
                  <div className="space-y-3 pr-2">
                    {cart.map((it) => (
                      <div key={it.product.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-slate-900 space-y-2 shadow-sm">
                        {/* Header: nombre + botón quitar */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{it.product.name}</p>
                            <p className="text-[10px] text-slate-500">
                              {it.product.code} · {formatCurrency(it.product.price)} c/u
                            </p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => removeItem(it.product.id)}
                            aria-label="Quitar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {/* Cantidad + subtotal */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(it.product.id, -1)}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              value={it.quantity}
                              onChange={(e) => setQuantity(it.product.id, Number(e.target.value))}
                              className="h-7 w-14 text-center px-1 font-medium"
                              min={0}
                              step={it.product.unit === 'ml' || it.product.unit === 'kg' ? 0.5 : 1}
                            />
                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(it.product.id, 1)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-slate-500">Subtotal</p>
                            <p className="text-sm font-bold text-blue-700 dark:text-blue-300">
                              {formatCurrency(it.product.price * it.quantity)}
                            </p>
                          </div>
                        </div>
                        {/* Notas del item */}
                        <Input
                          value={it.notes}
                          onChange={(e) => updateItemNotes(it.product.id, e.target.value)}
                          placeholder="Notas (ej: sin cebolla)"
                          className="h-8 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                          maxLength={300}
                        />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {cart.length > 0 && (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="notes" className="text-xs">Notas generales</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Notas del pedido..."
                      maxLength={500}
                      className="text-sm"
                      rows={2}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="discount" className="text-xs">Descuento (%)</Label>
                    <Input
                      id="discount"
                      type="number"
                      value={discountPct}
                      onChange={(e) => setDiscountPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                      min={0}
                      max={100}
                    />
                  </div>
                </>
              )}

              <Separator />

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-500">Subtotal</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-amber-700">
                    <span>Descuento ({discountPct}%)</span>
                    <span>-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold pt-1">
                  <span>Total</span>
                  <span className="text-blue-700 dark:text-blue-300">{formatCurrency(total)}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 pt-2">
                <Button
                  onClick={() => handleSubmit(true)}
                  disabled={submitting || cart.length === 0}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {submitting ? 'Enviando...' : 'Enviar a cocina'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleSubmit(false)}
                  disabled={submitting || cart.length === 0}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Guardar (sin enviar)
                </Button>
              </div>
            </CardContent>
    </Card>
  )
}
