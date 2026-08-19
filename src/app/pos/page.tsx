'use client'

// ============================================================
// SoftLBA POS v2 — Pantalla de Salón (Fase 3)
// ============================================================
// Reconstrucción minimalista según plan de reestructuración.
//
// Layout:
//   - Teléfono: barra superior + selector mesa + productos + carrito fijo abajo.
//   - Tablet/desktop: mesas izquierda + productos centro + carrito derecha.
//
// Flujo:
//   Mesero → Selecciona mesa → Añade productos → Carrito → ENVIAR
//
// Reutiliza:
//   - usePOS hook (carrito + idempotencia + timeout + localStorage).
//   - CartPanel (una sola representación del carrito).
//   - ProductCard minimalista.
//   - TableSelector con estados visuales claros.
//   - API: /api/mesero/{areas,tables,products,orders} (NO se modifica backend).
// ============================================================

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import {
  ShoppingCart,
  Search,
  ArrowLeft,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import { useCurrentUser } from '@/hooks/use-current-user'
import { usePOS, type POSProduct, type POSArea, type POSTable } from '@/components/pos/use-pos'
import { CartPanel } from '@/components/pos/cart-panel'
import { ProductCard } from '@/components/pos/product-card'
import { TableSelector, type TableItem } from '@/components/pos/table-selector'

// Categorías con iconos (sin emojis para mantenerse minimalista).
const CATEGORY_ICONS: Record<string, string> = {
  BEBIDAS: 'Bebidas',
  CAFETERÍA: 'Cafetería',
  ENSALADAS: 'Ensaladas',
  HAMBURGUESAS: 'Hamburguesas',
  PIZZAS: 'Pizzas',
  PLATOS: 'Platos',
  SÁNDWICH: 'Sándwich',
}

export default function POSPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useCurrentUser()

  // === Estado de datos ===
  const [areas, setAreas] = useState<POSArea[]>([])
  const [tables, setTables] = useState<POSTable[]>([])
  const [products, setProducts] = useState<POSProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // === Filtros ===
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('Todas')

  // === Hook del POS ===
  const salonArea = useMemo(() => areas.find((a) => a.code === 'SALON') || areas[0], [areas])

  const pos = usePOS({
    areaId: salonArea?.id ?? null,
    canDiscount: user?.role === 'ADMIN',
    onAfterSend: (orderId, orderNumber, allDirecto) => {
      if (allDirecto) {
        toast.info(`Pedido #${orderNumber} listo para cobrar`, {
          description: 'Todos los productos son directo (servidos).',
          duration: 6000,
          action: {
            label: 'Cobrar',
            onClick: () => router.push(`/pos/orders/${orderId}`),
          },
        })
      } else {
        toast.info(`Pedido #${orderNumber} enviado`, {
          description: 'Cocina y/o pizzería recibieron los items. Cobra cuando estén listos.',
          duration: 8000,
        })
      }
    },
  })

  // === Cargar datos ===
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [areasRes, tablesRes, productsRes] = await Promise.all([
        fetch('/api/mesero/areas'),
        fetch('/api/mesero/tables'),
        fetch('/api/mesero/products'),
      ])
      if (!areasRes.ok || !tablesRes.ok || !productsRes.ok) {
        throw new Error('Error al cargar datos del POS')
      }
      const [areasData, tablesData, productsData] = await Promise.all([
        areasRes.json(),
        tablesRes.json(),
        productsRes.json(),
      ])
      setAreas(areasData.items || areasData)
      setTables(tablesData.items || tablesData)
      // FASE 3: la API no devuelve isAvailable (lo filtra en el WHERE).
      // Lo añadimos explícitamente para que ProductCard no lo marque como disabled.
      const products = (productsData.items || productsData).map((p: any) => ({
        ...p,
        isAvailable: p.isAvailable !== undefined ? p.isAvailable : true,
      }))
      setProducts(products)
    } catch (e: any) {
      setError(e?.message || 'Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user && ['MESERO', 'MESERO_PRO', 'ADMIN'].includes(user.role)) {
      loadData()
    }
  }, [user, loadData])

  // === Filtrado de productos ===
  const categories = useMemo(() => {
    const cats = new Set<string>()
    products.forEach((p) => {
      if (p.category) cats.add(p.category)
    })
    return ['Todas', ...Array.from(cats).sort()]
  }, [products])

  const filteredProducts = useMemo(() => {
    let list = products
    if (activeCategory !== 'Todas') {
      list = list.filter((p) => p.category === activeCategory)
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q),
      )
    }
    return list
  }, [products, activeCategory, search])

  // === Cantidades en carrito (para badges en ProductCard) ===
  const cartQuantities = useMemo(() => {
    const map = new Map<string, number>()
    pos.cart.lines.forEach((l) => {
      map.set(l.product.id, (map.get(l.product.id) || 0) + l.quantity)
    })
    return map
  }, [pos.cart.lines])

  // === Render ===

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Cargando POS…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-3">
        <AlertTriangle className="h-8 w-8 text-red-500" />
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <Button variant="outline" onClick={loadData}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Reintentar
        </Button>
      </div>
    )
  }

  if (!user || !['MESERO', 'MESERO_PRO', 'ADMIN'].includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-3">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <p className="text-amber-700 dark:text-amber-300">
          No tienes permiso para acceder al POS.
        </p>
      </div>
    )
  }

  const tableItems: TableItem[] = tables.map((t) => ({
    id: t.id,
    code: t.code,
    name: t.name,
    status: t.status,
    capacity: t.capacity,
    currentOrderId: t.currentOrderId,
  }))

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)]">
      {/* === IZQUIERDA: Mesas (desktop sidebar) === */}
      <aside className="hidden lg:flex w-64 flex-col border-r bg-background shrink-0">
        <div className="p-3 border-b">
          <h2 className="font-semibold text-sm">Mesas</h2>
          <p className="text-xs text-muted-foreground">
            {tables.length} mesas · {tables.filter((t) => t.status === 'LIBRE').length} libres
          </p>
        </div>
        <ScrollArea className="flex-1 p-2">
          <TableSelector
            tables={tableItems}
            selectedTableId={pos.selectedTable?.id ?? null}
            onSelect={(t) => pos.setSelectedTable(t)}
            variant="list"
          />
        </ScrollArea>
      </aside>

      {/* === CENTRO: Productos === */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Barra superior: búsqueda + categorías */}
        <div className="p-3 border-b space-y-2 bg-background sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar producto por nombre o código…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-10"
              />
            </div>
            {pos.selectedTable && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-950/30 rounded-md text-sm">
                <span className="font-medium">{pos.selectedTable.name}</span>
                <button
                  type="button"
                  onClick={() => pos.setSelectedTable(null)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Quitar mesa seleccionada"
                >
                  ×
                </button>
              </div>
            )}
          </div>

          {/* Categorías scrollable */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                }`}
              >
                {CATEGORY_ICONS[cat] || cat}
              </button>
            ))}
          </div>
        </div>

        {/* Selector de mesa en mobile (cuando no hay mesa seleccionada) */}
        {!pos.selectedTable && (
          <div className="lg:hidden p-3 border-b bg-muted/30">
            <h3 className="font-medium text-sm mb-2">Selecciona una mesa</h3>
            <TableSelector
              tables={tableItems}
              selectedTableId={null}
              onSelect={(t) => pos.setSelectedTable(t)}
              variant="grid"
            />
          </div>
        )}

        {/* Grid de productos */}
        <ScrollArea className="flex-1">
          {filteredProducts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p className="font-medium">No se encontraron productos</p>
              <p className="text-sm mt-1">Prueba con otra búsqueda o categoría.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2 p-3">
              {filteredProducts.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  inCart={cartQuantities.get(p.id) || 0}
                  onAdd={() => pos.addToCart(p)}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Carrito fijo en mobile (sticky footer) */}
        {pos.cart.lines.length > 0 && (
          <div className="lg:hidden sticky bottom-0 left-0 right-0 bg-background border-t p-2 shadow-lg">
            <Sheet>
              <SheetTrigger asChild>
                <Button className="w-full h-12 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    <span>{pos.totalUnits} {pos.totalUnits === 1 ? 'artículo' : 'artículos'}</span>
                  </span>
                  <span className="font-mono font-bold">${pos.total.toFixed(0)}</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[85vh] p-0">
                <CartPanel pos={pos} canDiscount={user?.role === 'ADMIN'} />
              </SheetContent>
            </Sheet>
          </div>
        )}
      </main>

      {/* === DERECHA: Carrito persistente (desktop) === */}
      <aside className="hidden lg:flex w-80 flex-col border-l bg-background shrink-0">
        <CartPanel pos={pos} canDiscount={user?.role === 'ADMIN'} />
      </aside>
    </div>
  )
}
