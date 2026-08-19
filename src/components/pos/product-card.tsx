// src/components/pos/product-card.tsx  — V5 div-based
'use client'
import { Money } from '@/components/shared/money'
import { ProductTypeBadge } from '@/components/shared/product-type-badge'
import { Plus, PackageX } from 'lucide-react'
import { cn } from '@/lib/utils'
export interface ProductCardProduct {
  id: string; code: string; name: string; price: number
  type: 'DIRECTO' | 'FINAL' | 'SUBPRODUCTO'; unit: string
  areaStock?: number | null; isAvailable?: boolean; imageUrl?: string | null
}
interface ProductCardProps { product: ProductCardProduct; inCart?: number; onAdd: () => void }
export function ProductCard({ product, inCart = 0, onAdd }: ProductCardProps) {
  const outOfStock = product.areaStock !== null && product.areaStock !== undefined && product.areaStock <= 0
  const disabled = outOfStock
  return (
    <div role="button" tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onAdd()}
      onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onAdd() } }}
      aria-label={`${product.name}, ${outOfStock ? 'sin stock' : 'disponible'}`}
      className={cn('relative flex flex-col text-left rounded-lg border p-3 transition-colors cursor-pointer',
        'min-h-[110px] w-full', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        disabled ? 'bg-muted/30 border-muted cursor-not-allowed opacity-70'
          : 'bg-card border-border hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 active:scale-[0.98]')}>
      {inCart > 0 && <span className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-full min-w-5 h-5 flex items-center justify-center px-1.5">{inCart}</span>}
      <div className="mb-1"><ProductTypeBadge type={product.type} /></div>
      <p className="font-medium text-sm line-clamp-2 leading-tight mb-1 flex-1">{product.name}</p>
      <div className="flex items-center justify-between mt-auto">
        <Money amount={product.price} size="md" className="font-semibold" />
        {outOfStock ? <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1"><PackageX className="h-3 w-3" />Sin stock</span>
          : product.areaStock !== null && product.areaStock !== undefined ? <span className="text-xs text-muted-foreground">{product.areaStock}u</span> : null}
      </div>
      {!disabled && <div className="absolute bottom-2 right-2 pointer-events-none"><span className="bg-blue-600 text-white rounded-full h-9 w-9 flex items-center justify-center shadow-sm"><Plus className="h-4 w-4" /></span></div>}
    </div>
  )
}
