// src/lib/idempotency.ts
// v1.0.20-FRONTEND-01 (FE-003): Generación y reutilización de idempotencyKey.
//
// Problema que resuelve:
// - El frontend no enviaba `idempotencyKey` en POST /api/mesero/orders/[id]/pay.
// - Doble click en "Cobrar" → 2 Payment rows distintos → duplicación contable.
// - Reintento por timeout → 2 Payment rows distintos → duplicación contable.
// - El backend ya soporta idempotencia, pero el frontend no la aprovechaba.
//
// Reglas (definidas en docs/FRONTEND_MASTER_PLAN.md sección 6):
// - Doble click "Cobrar" → debe producir 1 sola operación lógica.
// - Reintento por timeout → debe REUTILIZAR la misma clave (no generar nueva).
// - Si el usuario CAMBIA los pagos (monto, método, agrega/quita) → es un
//   intento nuevo → nueva clave.
//
// Implementación:
// - `generateIdempotencyKey()` — UUID v4 + sufijo corto legible.
// - `IdempotencyManager` — clase que guarda la key por `orderId` y la invalida
//   cuando cambia el "fingerprint" de los pagos.
// - En `handlePay()`:
//   1. Obtener o generar key para este orderId.
//   2. Si los pagos cambiaron desde el último intento, generar nueva key.
//   3. Enviar key al backend.
//   4. Si el backend responde 200 idempotente, eliminar key (operación exitosa).
//   5. Si el backend responde 200 con pago nuevo, eliminar key.
//   6. Si el backend responde 4xx/5xx, MANTENER key para reintentar con misma.

/**
 * Genera un idempotencyKey único.
 * Formato: `idem-<timestamp>-<random8>` (24-32 chars).
 * Cumple con el contrato del backend: min 8, max 120 chars.
 */
export function generateIdempotencyKey(): string {
  const ts = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 10)
  return `idem-${ts}-${random}`
}

/**
 * Fingerprint de un arreglo de pagos. Si cambia, es un intento lógico nuevo.
 * No incluye `reference` ni `notes` (campos opcionales que no afectan el monto).
 */
export function paymentsFingerprint(
  payments: Array<{ method: string; amount: number | string; currency?: string }>,
): string {
  // Ordenar por método+monto para que el orden de los items no cambie el fingerprint.
  const sorted = [...payments].map((p) => ({
    method: p.method,
    amount: typeof p.amount === 'string' ? Number(p.amount) : p.amount,
    currency: p.currency || '',
  })).sort((a, b) => `${a.method}${a.amount}${a.currency}`.localeCompare(`${b.method}${b.amount}${b.currency}`))
  return JSON.stringify(sorted)
}

/**
 * Manager de idempotencyKey por orderId.
 *
 * Mantiene una sola key activa por orderId mientras el fingerprint no cambie.
 * Si el usuario cambia los pagos (monto, método), la key se invalida y se
 * genera una nueva en la próxima llamada a `getOrCreate(orderId, fingerprint)`.
 *
 * Si la operación tiene éxito (200 OK del backend), llamar a `clear(orderId)`.
 * Si la operación falla, NO limpiar — la próxima llamada devolverá la misma
 * key para reutilizar en el reintento.
 */
export class IdempotencyManager {
  private keys: Map<string, { key: string; fingerprint: string }> = new Map()

  /**
   * Devuelve la key existente para `orderId` si el fingerprint coincide.
   * Si no existe o el fingerprint cambió, genera una nueva key.
   */
  getOrCreate(orderId: string, fingerprint: string): string {
    const existing = this.keys.get(orderId)
    if (existing && existing.fingerprint === fingerprint) {
      return existing.key
    }
    const newKey = generateIdempotencyKey()
    this.keys.set(orderId, { key: newKey, fingerprint })
    return newKey
  }

  /**
   * Elimina la key para `orderId`. Llamar tras 200 OK del backend.
   */
  clear(orderId: string): void {
    this.keys.delete(orderId)
  }

  /**
   * Devuelve la key actual para `orderId` sin generar una nueva.
   * Útil para tests y logs. Devuelve `null` si no hay key.
   */
  peek(orderId: string): string | null {
    return this.keys.get(orderId)?.key ?? null
  }
}

// Singleton por proceso (cada tab del navegador tiene su propio JS context).
let _instance: IdempotencyManager | null = null

export function getIdempotencyManager(): IdempotencyManager {
  if (!_instance) _instance = new IdempotencyManager()
  return _instance
}
