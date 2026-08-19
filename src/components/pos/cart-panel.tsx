// src/components/pos/cart-panel.tsx
// Fase 3 — Carrito del POS (una sola representación, reutilizable).
//
// Características:
// - Muestra cantidad total de unidades (badge).
// - Total siempre visible.
// - Líneas independientes si cambian notas/modificadores.
// - Cantidades +/−.
// - Eliminar línea.
// - Notas por línea.
// - Cliente opcional.
// - Comentario general.
// - Descuento si el permiso lo permite.
// - Botón ENVIAR persistente con timeout + reintentar + cancelar.
//
// No usa Sheet/Dialog — el layout (sticky footer mobile, panel lateral desktop)
// lo decide el parent. Este componente es solo el contenido.

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Send,
  X,
  Loader2,
  AlertTriangle,
  Package,
  User,
  MessageSquare,
  Percent,
} from 'lucide-react'
import { Money } from '@/components/shared/money'
import type { usePOS } from '@/components/pos/use-pos'

interface CartPanelProps {
  pos: ReturnType<typeof usePOS>
  canDiscount: boolean
}

export function CartPanel({ pos, canDiscount }: CartPanelProps) {
  const {
    cart,
    totalUnits,
    subtotal,
    discountAmount,
    total,
    sendState,
    selectedTable,
    updateQuantity,
    setLineNotes,
    removeLine,
    setCustomerName,
    setGeneralComment,
    setDiscountPct,
    sendOrder,
    cancelSend,
  } = pos

  const [showExtras, setShowExtras] = useState(false)

  const isSending = sendState === 'sending'
  const isTimeout = sendState === 'timeout'

  if (cart.lines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center text-muted-foreground">
        <ShoppingCart className="h-12 w-12 mb-3 opacity-30" aria-hidden />
        <p className="font-medium">Carrito vacío</p>
        <p className="text-sm mt-1">Toca un producto para agregarlo.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header: badge unidades + total */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4" aria-hidden />
          <span className="font-semibold">Pedido</span>
          <Badge variant="secondary" className="font-mono">
            {totalUnits} {totalUnits === 1 ? 'artículo' : 'artículos'}
          </Badge>
        </div>
        <Money amount={total} size="lg" variant="success" />
      </div>

      {/* Mesa seleccionada */}
      {selectedTable && (
        <div className="px-3 py-2 bg-blue-50 dark:bg-blue-950/30 border-b text-sm flex items-center justify-between">
          <span className="font-medium">
            {selectedTable.name}
            {cart.customerName && (
              <span className="text-muted-foreground ml-2">· {cart.customerName}</span>
            )}
          </span>
          <button
            type="button"
            onClick={() => setShowExtras((v) => !v)}
            className="text-xs text-blue-700 dark:text-blue-300 underline"
          >
            {showExtras ? 'Ocultar extras' : 'Cliente/Descuento'}
          </button>
        </div>
      )}

      {/* Extras: cliente, comentario, descuento */}
      {showExtras && selectedTable && (
        <div className="p-3 border-b space-y-2 bg-muted/20">
          <div className="flex items-center gap-2">
            <User className="h-3 w-3 text-muted-foreground shrink-0" aria-hidden />
            <Input
              type="text"
              placeholder="Cliente (opcional)"
              value={cart.customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="h-8 text-sm"
              maxLength={120}
            />
          </div>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0" aria-hidden />
            <Input
              type="text"
              placeholder="Comentario general (opcional)"
              value={cart.generalComment}
              onChange={(e) => setGeneralComment(e.target.value)}
              className="h-8 text-sm"
              maxLength={500}
            />
          </div>
          {canDiscount && (
            <div className="flex items-center gap-2">
              <Percent className="h-3 w-3 text-muted-foreground shrink-0" aria-hidden />
              <Input
                type="number"
                min={0}
                max={100}
                step={5}
                placeholder="Descuento %"
                value={cart.discountPct || ''}
                onChange={(e) => setDiscountPct(parseFloat(e.target.value) || 0)}
                className="h-8 text-sm w-32"
              />
              {cart.discountPct > 0 && (
                <span className="text-xs text-muted-foreground">
                  −{discountAmount.toFixed(0)}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Líneas del carrito */}
      <ScrollArea className="flex-1">
        <div className="divide-y">
          {cart.lines.map((line) => (
            <div key={line.lineId} className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{line.product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    <Money amount={line.product.price} size="sm" /> c/u ·{' '}
                    <Money
                      amount={line.product.price * line.quantity}
                      size="sm"
                      variant="success"
                    />
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(line.lineId)}
                  className="text-red-600 hover:text-red-700 p-1"
                  aria-label={`Eliminar ${line.product.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => updateQuantity(line.lineId, -1)}
                    disabled={line.quantity <= 1}
                    aria-label={`Restar ${line.product.name}`}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center font-mono text-sm font-medium">
                    {line.quantity}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => updateQuantity(line.lineId, 1)}
                    aria-label={`Sumar ${line.product.name}`}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <Input
                  type="text"
                  placeholder="Notas (ej: sin cebolla)"
                  value={line.notes}
                  onChange={(e) => setLineNotes(line.lineId, e.target.value)}
                  className="h-7 text-xs flex-1"
                  maxLength={300}
                />
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Footer: subtotal + total + ENVIAR */}
      <div className="border-t p-3 space-y-2 bg-background">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Subtotal</span>
          <Money amount={subtotal} size="sm" />
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-sm text-red-600 dark:text-red-400">
            <span>Descuento ({cart.discountPct}%)</span>
            <Money amount={-discountAmount} size="sm" variant="danger" />
          </div>
        )}
        <Separator />
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <Money amount={total} size="lg" />
        </div>

        {/* Botón ENVIAR persistente */}
        <div className="flex gap-2">
          <Button
            className="flex-1 h-12 text-base"
            onClick={() => sendOrder(true)}
            disabled={isSending || !selectedTable}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar
              </>
            )}
          </Button>
          {isSending && (
            <Button
              variant="destructive"
              className="h-12 px-3"
              onClick={cancelSend}
              title="Cancelar envío (no se duplicará el pedido)"
              aria-label="Cancelar envío"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Aviso timeout */}
        {isTimeout && (
          <div
            role="alert"
            className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1"
          >
            <AlertTriangle className="h-3 w-3" />
            El servidor tardó demasiado. Reintenta o cancela.
          </div>
        )}
      </div>
    </div>
  )
}
