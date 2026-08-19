// Constantes compartidas para estados de pedido y pagos

export const STATUS_COLORS: Record<string, string> = {
  CREADO: 'bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-200',
  ENVIADO: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  EN_PREPARACION: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  LISTO: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  SERVIDO: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200',
  COBRADO: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
  ARCHIVADO: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400',
  CANCELADO: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
}

export const STATUS_LABELS: Record<string, string> = {
  CREADO: 'Creado',
  ENVIADO: 'Enviado',
  EN_PREPARACION: 'En preparación',
  LISTO: 'Listo',
  SERVIDO: 'Servido',
  COBRADO: 'Cobrado',
  ARCHIVADO: 'Archivado',
  CANCELADO: 'Cancelado',
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  EFECTIVO_CUP: 'Efectivo CUP',
  EFECTIVO_USD: 'Efectivo USD',
  TRANSFERENCIA_CUP: 'Transferencia CUP',
  TRANSFERENCIA_USD: 'Transferencia USD',
  ZELLE: 'Zelle',
  BANCARIA_USD: 'Bancaria USD',
  COMBINADO: 'Combinado',
}

export const PAYMENT_METHODS = [
  'EFECTIVO_CUP',
  'EFECTIVO_USD',
  'TRANSFERENCIA_CUP',
  'TRANSFERENCIA_USD',
  'ZELLE',
  'BANCARIA_USD',
] as const

export function formatCurrency(value: number, currency = '$') {
  return `${currency}${value.toFixed(2)}`
}

export function elapsedMinutes(from: Date | string): number {
  const d = typeof from === 'string' ? new Date(from) : from
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000))
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('es-CU', { hour: '2-digit', minute: '2-digit' })
}
