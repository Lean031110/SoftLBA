'use client'

// ============================================================
// SoftLBA POS — Pantalla de Salón
// ============================================================
// v1.1.0-rc1: Reconstrucción del POS de Salón.
// Esta pantalla reemplaza /mesero y /mesero/nuevo-pedido.
//
// Flujo: MESAS → PRODUCTOS → CARRITO → ENVIAR/COBRAR
//
// Backend reutilizado (NO modificado):
//   - GET /api/mesero/tables — lista de mesas con status
//   - GET /api/mesero/products — productos con stock
//   - GET /api/mesero/areas — áreas disponibles
//   - POST /api/mesero/orders — crear pedido
//   - POST /api/mesero/orders/[id]/pay — cobrar
//   - TableService, InventoryService, ProductAreaResolver
// ============================================================

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from 'sonner'
import { getIdempotencyManager, paymentsFingerprint } from '@/lib/idempotency'
import {
  ShoppingCart, Search, Plus, Minus, Trash2, Send, Wallet,
  Users, ArrowLeft, ChefHat, Package, Coffee, Pizza, Wine,
  Utensils, Cake, Star, X, Check, AlertTriangle, Loader2,
} from 'lucide-react'

// === TYPES ===
type Table = {
  id: string; code: string; name: string; capacity: number;
  status: string; currentOrderId?: string | null
}
type Product = {
  id: string; code: string; name: string; price: number;
  type: 'DIRECTO' | 'FINAL'; category: string; areaStock: number | null
}
type CartItem = {
  product: Product; quantity: number; notes: string
}
type Area = { id: string; code: string; name: string }

// === CATEGORÍA ICONS ===
const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'Bebidas': Wine,
  'Cafetería': Coffee,
  'Ensaladas': Utensils,
  'Hamburguesas': Utensils,
  'Pizzas': Pizza,
  'Platos': Utensils,
  'Sándwich': Utensils,
  'Postres': Cake,
}

export default function SalonPOSPage() {
  const router = useRouter()

  // === STATE ===
  const [tables, setTables] = useState<Table[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Mesa seleccionada
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)

  // Carrito
  const [cart, setCart] = useState<CartItem[]>([])

  // Filtros
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')

  // Submit
  const [submitting, setSubmitting] = useState(false)
  // v1.1.0-rc2: último pedido creado (para ofrecer cobro inmediato).
  const [lastOrderId, setLastOrderId] = useState<string | null>(null)
  const [lastOrderNumber, setLastOrderNumber] = useState<number | null>(null)
  // v1.1.0-rc2: si todos los items del carrito son DIRECTO, el pedido
  // será inmediatamente cobrable (nacen como SERVIDO).
  const allDirecto = useMemo(
    () => cart.length > 0 && cart.every((i) => i.product.type === 'DIRECTO'),
    [cart],
  )
  // Cobro
  const [paying, setPaying] = useState(false)

  // Mobile cart sheet
  const [cartOpen, setCartOpen] = useState(false)

  // === LOAD DATA ===
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [tablesRes, productsRes, areasRes] = await Promise.all([
        fetch('/api/mesero/tables'),
        fetch('/api/mesero/products'),
        fetch('/api/mesero/areas'),
      ])
      const [tablesData, productsData, areasData] = await Promise.all([
        tablesRes.json(), productsRes.json(), areasRes.json(),
      ])

      if (tablesData.ok) setTables(tablesData.items || [])
      if (productsData.ok) setProducts(productsData.items || [])
      if (areasData.ok) setAreas(areasData.items || [])
      setError(null)
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // === CATEGORIES ===
  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category).filter(Boolean))
    return Array.from(cats).sort()
  }, [products])

  // === FILTERED PRODUCTS ===
  const filteredProducts = useMemo(() => {
    let result = products
    if (activeCategory !== 'all') {
      result = result.filter((p) => p.category === activeCategory)
    }
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((p) =>
        p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q),
      )
    }
    return result
  }, [products, activeCategory, search])

  // === CART OPERATIONS ===
  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      // Si el producto ya está sin notas, incrementar cantidad.
      const existing = prev.find(
        (i) => i.product.id === product.id && !i.notes,
      )
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id && !i.notes
            ? { ...i, quantity: i.quantity + 1 }
            : i,
        )
      }
      return [...prev, { product, quantity: 1, notes: '' }]
    })
  }, [])

  const updateQty = useCallback((index: number, delta: number) => {
    setCart((prev) => {
      const next = [...prev]
      const newQty = next[index].quantity + delta
      if (newQty <= 0) {
        next.splice(index, 1)
      } else {
        next[index] = { ...next[index], quantity: newQty }
      }
      return next
    })
  }, [])

  const updateNotes = useCallback((index: number, notes: string) => {
    setCart((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], notes }
      return next
    })
  }, [])

  const removeItem = useCallback((index: number) => {
    setCart((prev) => {
      const next = [...prev]
      next.splice(index, 1)
      return next
    })
  }, [])

  const clearCart = useCallback(() => setCart([]), [])

  // === TOTALS ===
  const subtotal = useMemo(
    () => cart.reduce((s, i) => s + i.product.price * i.quantity, 0),
    [cart],
  )

  // === TABLE STATUS COLORS ===
  const tableColor = (status: string) => {
    switch (status) {
      case 'LIBRE': return 'bg-emerald-500 hover:bg-emerald-600 text-white'
      case 'OCUPADA': return 'bg-red-500 hover:bg-red-600 text-white'
      case 'RESERVADA': return 'bg-amber-500 hover:bg-amber-600 text-white'
      case 'ESPERANDO_CUENTA': return 'bg-blue-500 hover:bg-blue-600 text-white'
      case 'LIMPIEZA': return 'bg-stone-400 hover:bg-stone-500 text-white'
      default: return 'bg-stone-300 hover:bg-stone-400 text-stone-800'
    }
  }

  // === SUBMIT ORDER ===
  const handleSubmit = async (sendToKitchen: boolean) => {
    if (cart.length === 0) {
      toast.error('Agrega al menos un producto')
      return
    }
    if (!selectedTable) {
      toast.error('Selecciona una mesa')
      return
    }
    setSubmitting(true)
    try {
      const salonArea = areas.find((a) => a.code === 'SALON') || areas[0]
      if (!salonArea) {
        toast.error('No hay área de SALON configurada')
        return
      }

      const body: any = {
        areaId: salonArea.id,
        items: cart.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          notes: i.notes || undefined,
        })),
        sendToKitchen,
      }
      if (selectedTable.currentOrderId) {
        body.tableId = selectedTable.id
      } else {
        body.tableId = selectedTable.id
      }

      const res = await fetch('/api/mesero/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (data.ok) {
        const orderNumber = data.item.number
        const orderId = data.item.id
        toast.success(`Pedido #${orderNumber} creado`, {
          description: sendToKitchen ? 'Enviado a cocina' : 'Guardado',
        })
        clearCart()
        setSelectedTable(null)
        // v1.1.0-rc2: si todos eran DIRECTO, el pedido es cobrable ya.
        if (allDirecto) {
          setLastOrderId(orderId)
          setLastOrderNumber(orderNumber)
          toast.info(`Pedido #${orderNumber} listo para cobrar`, {
            description: 'Todos los productos son directo (servidos).',
            duration: 6000,
            action: {
              label: 'Cobrar',
              onClick: () => handlePay(orderId, orderNumber),
            },
          })
        } else {
          // v1.1.0-rc3: pedido mixto — algunos items van a cocina/pizzería.
          const finalCount = cart.filter((i) => i.product.type === 'FINAL').length
          const directoCount = cart.filter((i) => i.product.type === 'DIRECTO').length
          toast.info(`Pedido #${orderNumber} enviado`, {
            description: `${finalCount} producto(s) en preparación, ${directoCount} directo(s) servido(s). Cobrar cuando estén listos.`,
            duration: 8000,
          })
        }
        await loadData()
      } else {
        toast.error(data.error || 'Error al crear pedido')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSubmitting(false)
    }
  }

  // === COBRAR ===
  // v1.1.0-rc2: cobro integrado en el POS.
  // Usa IdempotencyManager para prevenir doble pago.
  const handlePay = async (orderId: string, orderNumber: number) => {
    setPaying(true)
    try {
      // Obtener el total del pedido
      const orderRes = await fetch(`/api/mesero/orders/${orderId}`)
      const orderData = await orderRes.json()
      if (!orderData.ok) {
        toast.error('No se pudo cargar el pedido para cobrar')
        return
      }
      const total = orderData.item.total

      // Generar idempotencyKey
      const manager = getIdempotencyManager()
      const fp = paymentsFingerprint([{ method: 'EFECTIVO_CUP', amount: total }])
      const idempotencyKey = manager.getOrCreate(orderId, fp)

      const payRes = await fetch(`/api/mesero/orders/${orderId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payments: [{ method: 'EFECTIVO_CUP', amount: total }],
          idempotencyKey,
        }),
      })
      const payData = await payRes.json()

      if (payData.ok) {
        manager.clear(orderId)
        if (payData.idempotent) {
          toast.info('Pago ya estaba registrado')
        } else {
          toast.success(`Pedido #${orderNumber} cobrado`, {
            description: payData.fullyPaid ? 'Pagado completamente' : 'Pago parcial',
          })
        }
        setLastOrderId(null)
        setLastOrderNumber(null)
        await loadData()
      } else {
        toast.error(payData.error || 'Error al cobrar')
      }
    } catch {
      toast.error('Error de conexión al cobrar')
    } finally {
      setPaying(false)
    }
  }

  // === RENDER ===
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <EmptyState
          icon={<AlertTriangle className="h-8 w-8" />}
          title={error}
          description="Verifica que el servidor esté corriendo."
          action={<Button onClick={loadData}>Reintentar</Button>}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* === HEADER === */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-background sticky top-0 z-30">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/mesero')}
            aria-label="Volver"
            className="h-10 w-10 md:h-9 md:w-9 shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold truncate">Salón</h1>
          {selectedTable && (
            <Badge variant="secondary" className="shrink-0">
              {selectedTable.name}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* v1.1.0-rc2: botón COBRAR cuando hay un pedido cobrable */}
          {lastOrderId && lastOrderNumber && (
            <Button
              className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => handlePay(lastOrderId, lastOrderNumber)}
              disabled={paying}
            >
              {paying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Wallet className="h-4 w-4 mr-1" />
                  Cobrar #{lastOrderNumber}
                </>
              )}
            </Button>
          )}
          {/* Carrito móvil */}
          {cart.length > 0 && (
            <Sheet open={cartOpen} onOpenChange={setCartOpen}>
              <SheetTrigger asChild>
                <Button className="lg:hidden h-10 px-3" size="sm">
                  <ShoppingCart className="h-4 w-4 mr-1" />
                  {cart.length}
                  <span className="ml-2 font-bold">${subtotal.toFixed(0)}</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[85vh] p-0">
                <CartPanel
                  cart={cart}
                  subtotal={subtotal}
                  submitting={submitting}
                  onAdd={addToCart}
                  onQty={updateQty}
                  onNotes={updateNotes}
                  onRemove={removeItem}
                  onClear={clearCart}
                  onSubmit={handleSubmit}
                  selectedTable={selectedTable?.name || null}
                />
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>

      {/* === CONTENIDO PRINCIPAL === */}
      <div className="flex flex-1 overflow-hidden">
        {/* === SIDEBAR: MESAS === */}
        <div className="hidden md:flex w-48 lg:w-56 flex-col border-r bg-background shrink-0">
          <div className="p-2 border-b">
            <h2 className="text-sm font-semibold px-1">Mesas</h2>
          </div>
          <ScrollArea className="flex-1">
            <div className="grid grid-cols-2 gap-1.5 p-2">
              {tables.length === 0 ? (
                <p className="text-xs text-stone-500 col-span-2 text-center py-4">
                  No hay mesas
                </p>
              ) : (
                tables.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTable(t)}
                    className={`relative rounded-lg p-2 text-center transition-colors min-h-[60px] flex flex-col items-center justify-center ${tableColor(t.status)} ${selectedTable?.id === t.id ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
                    aria-label={`Mesa ${t.name}, ${t.status}`}
                  >
                    <span className="text-sm font-bold">{t.name}</span>
                    <span className="text-[10px] opacity-80">{t.capacity}p</span>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* === CENTRO: CATEGORÍAS + PRODUCTOS === */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Selector de mesa mobile */}
          <div className="md:hidden p-2 border-b">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {tables.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTable(t)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${tableColor(t.status)} ${selectedTable?.id === t.id ? 'ring-2 ring-blue-400' : ''}`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* Búsqueda */}
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar producto..."
                className="pl-9 h-10"
              />
            </div>
          </div>

          {/* Categorías */}
          <div className="flex gap-1.5 p-2 border-b overflow-x-auto">
            <Button
              variant={activeCategory === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveCategory('all')}
              className="h-9 px-3 shrink-0"
            >
              <Star className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Todas</span>
            </Button>
            {categories.map((c) => {
              const Icon = CATEGORY_ICONS[c] || Package
              return (
                <Button
                  key={c}
                  variant={activeCategory === c ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveCategory(c)}
                  className="h-9 px-3 shrink-0"
                >
                  <Icon className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">{c}</span>
                </Button>
              )
            })}
          </div>

          {/* Grid de productos */}
          <ScrollArea className="flex-1">
            <div className="p-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 pb-24 lg:pb-2">
              {filteredProducts.length === 0 ? (
                <div className="col-span-full">
                  <EmptyState
                    title="No se encontraron productos"
                    description="Prueba con otra categoría o búsqueda."
                  />
                </div>
              ) : (
                filteredProducts.map((p) => {
                  const outOfStock = p.areaStock !== null && p.areaStock <= 0
                  const isDirecto = p.type === 'DIRECTO'
                  const inCart = cart.filter((i) => i.product.id === p.id).reduce((s, i) => s + i.quantity, 0)
                  return (
                    <button
                      key={p.id}
                      onClick={() => !outOfStock && addToCart(p)}
                      disabled={outOfStock}
                      aria-label={`${p.name}, ${isDirecto ? 'despacho inmediato' : 'requiere preparación'}, ${outOfStock ? 'sin stock' : `stock ${p.areaStock ?? 'ilimitado'}`}`}
                      className={`relative text-left border rounded-lg p-2.5 transition-all min-h-[100px] flex flex-col justify-between ${
                        inCart > 0
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 ring-1 ring-blue-300'
                          : outOfStock
                            ? 'border-stone-200 opacity-40 cursor-not-allowed'
                            : 'border-stone-200 hover:border-blue-300 hover:shadow-sm active:scale-[0.98]'
                      }`}
                    >
                      {/* Badge de cantidad en carrito */}
                      {inCart > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shadow-md">
                          {inCart}
                        </span>
                      )}
                      <div>
                        <p className="text-sm font-medium line-clamp-2 leading-tight">{p.name}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <span className={`text-[10px] px-1.5 py-0 rounded font-medium ${
                            isDirecto
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200'
                          }`}>
                            {isDirecto ? 'Directo' : 'Prep.'}
                          </span>
                          {outOfStock && (
                            <span className="text-[10px] text-red-600 font-medium">Sin stock</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                          ${p.price.toFixed(0)}
                        </span>
                        {!outOfStock && p.areaStock !== null && (
                          <span className="text-[10px] text-stone-500">
                            {p.areaStock}u
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* === DERECHA: CARRITO (desktop) === */}
        <div className="hidden lg:flex w-80 flex-col border-l bg-background shrink-0">
          <CartPanel
            cart={cart}
            subtotal={subtotal}
            submitting={submitting}
            onAdd={addToCart}
            onQty={updateQty}
            onNotes={updateNotes}
            onRemove={removeItem}
            onClear={clearCart}
            onSubmit={handleSubmit}
            selectedTable={selectedTable?.name || null}
          />
        </div>
      </div>

      {/* === FAB carrito mobile === */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-4 left-4 right-4 z-50">
          <Sheet open={cartOpen} onOpenChange={setCartOpen}>
            <SheetTrigger asChild>
              <Button className="w-full h-14 shadow-lg text-base" size="lg">
                <ShoppingCart className="h-5 w-5 mr-2" />
                {cart.length} items · ${subtotal.toFixed(0)}
              </Button>
            </SheetTrigger>
          </Sheet>
        </div>
      )}
    </div>
  )
}

// ============================================================
// CartPanel — Panel del carrito (reutilizable desktop + mobile)
// ============================================================
function CartPanel({
  cart, subtotal, submitting, onQty, onNotes, onRemove, onClear, onSubmit, selectedTable,
}: {
  cart: CartItem[]
  subtotal: number
  submitting: boolean
  onAdd: (p: Product) => void
  onQty: (index: number, delta: number) => void
  onNotes: (index: number, notes: string) => void
  onRemove: (index: number) => void
  onClear: () => void
  onSubmit: (sendToKitchen: boolean) => void
  selectedTable: string | null
}) {
  return (
    <>
      {/* Header del carrito */}
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          <span className="font-semibold">Pedido</span>
          {cart.length > 0 && (
            <Badge variant="secondary">{cart.length}</Badge>
          )}
        </div>
        {cart.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear} className="h-8 text-xs text-red-600">
            <Trash2 className="h-3 w-3 mr-1" /> Vaciar
          </Button>
        )}
      </div>

      {/* Items del carrito */}
      <ScrollArea className="flex-1">
        {cart.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<ShoppingCart className="h-8 w-8" />}
              title="Carrito vacío"
              description="Toca un producto para agregarlo."
            />
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {cart.map((item, idx) => (
              <div
                key={`${item.product.id}-${idx}`}
                className="border rounded-lg p-2 space-y-1.5 bg-card"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium line-clamp-2">{item.product.name}</p>
                    <p className="text-xs text-stone-500">
                      ${item.product.price.toFixed(0)} c/u
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-red-500"
                    onClick={() => onRemove(idx)}
                    aria-label={`Quitar ${item.product.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Notas */}
                <Input
                  value={item.notes}
                  onChange={(e) => onNotes(idx, e.target.value)}
                  placeholder="Notas (ej: sin cebolla)"
                  className="h-8 text-xs"
                  maxLength={200}
                />

                {/* Cantidad + subtotal */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onQty(idx, -1)}
                      aria-label={`Reducir ${item.product.name}`}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-sm font-bold w-8 text-center">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onQty(idx, 1)}
                      aria-label={`Aumentar ${item.product.name}`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <span className="text-sm font-bold">
                    ${(item.product.price * item.quantity).toFixed(0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer con total + acciones */}
      {cart.length > 0 && (
        <div className="p-3 border-t space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-stone-500">Subtotal</span>
            <span className="text-lg font-bold">${subtotal.toFixed(0)}</span>
          </div>
          {!selectedTable && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Selecciona una mesa
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 h-11"
              onClick={() => onSubmit(false)}
              disabled={submitting || !selectedTable}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <>
                  <Package className="h-4 w-4 mr-1" />
                  Guardar
                </>
              )}
            </Button>
            <Button
              className="flex-1 h-11"
              onClick={() => onSubmit(true)}
              disabled={submitting || !selectedTable}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <>
                  <Send className="h-4 w-4 mr-1" />
                  Enviar
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
