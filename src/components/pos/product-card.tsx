// src/components/pos/product-card.tsx
// Fase 3 — Tarjeta de producto minimalista para el POS.
//
// Reglas (plan Fase 3):
// - Minimalista: solo nombre, precio, badge tipo, botón +.
// - Alto contraste.
// - Botón táctil grande (mín. 44px touch target en mobile).
// - Sin información innecesaria.
// - Estado "Sin stock" visible si aplica.

'use client'

import { Button } from '@/components/ui/button'
import { Money } from '@/components/shared/money'
import { ProductTypeBadge } from '@/components/shared/product-type-badge'
import { Plus, PackageX } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ProductCardProduct {
  id: string
  code: string
  name: string
  price: number
  type: 'DIRECTO' | 'FINAL' | 'SUBPRODUCTO'
  unit: string
  areaStock?: number | null
  isAvailable: boolean
  imageUrl?: string | null
}

interface ProductCardProps {
  product: ProductCardProduct
  inCart?: number // cuántos hay en el carrito (badge opcional)
  onAdd: () => void
}

export function ProductCard({ product, inCart = 0, onAdd }: ProductCardProps) {
  const outOfStock = product.areaStock !== null && product.areaStock !== undefined && product.areaStock <= 0
  const disabled = !product.isAvailable || outOfStock

  return (
    <button
      type="button"
      onClick={() => !disabled && onAdd()}
      disabled={disabled}
      aria-label={`${product.name}, ${outOfStock ? 'sin stock' : 'disponible'}`}
      className={cn(
        'relative flex flex-col text-left rounded-lg border p-3 transition-colors',
        'min-h-[110px] w-full',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        disabled
          ? 'bg-muted/30 border-muted cursor-not-allowed opacity-70'
          : 'bg-card border-border hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 active:scale-[0.98]',
      )}
    >
      {/* Badge en esquina: cantidad en carrito */}
      {inCart > 0 && (
        <span
          className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-full min-w-5 h-5 flex items-center justify-center px-1.5"
          aria-label={`${inCart} en carrito`}
        >
          {inCart}
        </span>
      )}

      {/* Tipo de producto */}
      <div className="mb-1">
        <ProductTypeBadge type={product.type} />
      </div>

      {/* Nombre */}
      <p className="font-medium text-sm line-clamp-2 leading-tight mb-1 flex-1">
        {product.name}
      </p>

      {/* Precio */}
      <div className="flex items-center justify-between mt-auto">
        <Money amount={product.price} size="md" className="font-semibold" />
        {outOfStock ? (
          <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
            <PackageX className="h-3 w-3" />
            Sin stock
          </span>
        ) : product.areaStock !== null && product.areaStock !== undefined ? (
          <span className="text-xs text-muted-foreground">{product.areaStock}u</span>
        ) : null}
      </div>

      {/* Botón + grande, tap-friendly */}
      {!disabled && (
        <div className="absolute bottom-2 right-2 pointer-events-none">
          <span className="bg-blue-600 text-white rounded-full h-9 w-9 flex items-center justify-center shadow-sm pointer-events-none">
            <Plus className="h-4 w-4" />
          </span>
        </div>
      )}
    </button>
  )
}
