// src/components/pos/table-selector.tsx
// Fase 3 — Selector de mesa.
//
// Variantes:
// - Grid compacto (mobile/tablet): botones cuadrados.
// - Lista (desktop sidebar): lista vertical.
//
// Estados visuales (plan Fase 16 del anterior):
// - LIBRE (verde)
// - OCUPADA (rojo)
// - RESERVADA (amber)
// - ESPERANDO_CUENTA (azul)
// - LIMPIEZA (stone)
// - SELECCIONADA (borde azul grueso, distinto del resto)
//
// La selección NUNCA debe confundirse con ocupada.

'use client'

import { cn } from '@/lib/utils'

export interface TableItem {
  id: string
  code: string
  name: string
  status: string // LIBRE | OCUPADA | RESERVADA | ESPERANDO_CUENTA | LIMPIEZA
  capacity: number
  currentOrderId?: string | null
}

interface TableSelectorProps {
  tables: TableItem[]
  selectedTableId: string | null
  onSelect: (table: TableItem) => void
  variant?: 'grid' | 'list'
  className?: string
}

function statusClasses(status: string): string {
  switch (status) {
    case 'LIBRE':
      return 'bg-emerald-500 hover:bg-emerald-600 text-white'
    case 'OCUPADA':
      return 'bg-red-500 hover:bg-red-600 text-white'
    case 'RESERVADA':
      return 'bg-amber-500 hover:bg-amber-600 text-white'
    case 'ESPERANDO_CUENTA':
      return 'bg-blue-500 hover:bg-blue-600 text-white'
    case 'LIMPIEZA':
      return 'bg-stone-400 hover:bg-stone-500 text-white'
    default:
      return 'bg-stone-300 hover:bg-stone-400 text-stone-900'
  }
}

export function TableSelector({
  tables,
  selectedTableId,
  onSelect,
  variant = 'grid',
  className,
}: TableSelectorProps) {
  if (variant === 'list') {
    return (
      <div className={cn('space-y-1.5', className)} role="listbox" aria-label="Selector de mesas">
        {tables.map((table) => {
          const isSelected = table.id === selectedTableId
          const isOccupied = table.status === 'OCUPADA' || table.status === 'ESPERANDO_CUENTA'
          return (
            <button
              key={table.id}
              type="button"
              onClick={() => onSelect(table)}
              aria-pressed={isSelected}
              aria-label={`Mesa ${table.name}, ${table.status}, capacidad ${table.capacity}`}
              className={cn(
                'w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                isSelected
                  ? 'bg-blue-100 dark:bg-blue-950 ring-2 ring-blue-500 font-semibold'
                  : isOccupied
                    ? 'bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40'
                    : 'hover:bg-muted',
              )}
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn('inline-block w-2 h-2 rounded-full', statusClasses(table.status).split(' ')[0])}
                  aria-hidden
                />
                <span>{table.name}</span>
              </span>
              <span className="text-xs text-muted-foreground">{table.capacity}p</span>
            </button>
          )
        })}
      </div>
    )
  }

  // variant: grid
  return (
    <div
      className={cn('grid grid-cols-3 sm:grid-cols-4 gap-2', className)}
      role="listbox"
      aria-label="Selector de mesas"
    >
      {tables.map((table) => {
        const isSelected = table.id === selectedTableId
        return (
          <button
            key={table.id}
            type="button"
            onClick={() => onSelect(table)}
            aria-pressed={isSelected}
            aria-label={`Mesa ${table.name}, ${table.status}, capacidad ${table.capacity}`}
            className={cn(
              'relative rounded-lg p-2 text-center transition-colors min-h-[60px] flex flex-col items-center justify-center',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              statusClasses(table.status),
              isSelected && 'ring-4 ring-blue-300 ring-offset-2 ring-offset-background',
            )}
          >
            <span className="font-semibold text-sm leading-tight">{table.name}</span>
            <span className="text-[10px] opacity-90 mt-0.5">{table.capacity}p</span>
          </button>
        )
      })}
    </div>
  )
}
