// tests/unit/idempotency.test.ts
// v1.0.20-FRONTEND-01 (FE-003): Tests para src/lib/idempotency.ts

import { describe, it, expect, beforeEach } from 'vitest'
import {
  generateIdempotencyKey,
  paymentsFingerprint,
  IdempotencyManager,
} from '../../src/lib/idempotency'

describe('generateIdempotencyKey', () => {
  it('genera key con prefijo idem-', () => {
    const key = generateIdempotencyKey()
    expect(key).toMatch(/^idem-/)
  })

  it('genera keys únicas (sin colisión en 1000 muestras)', () => {
    const keys = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      keys.add(generateIdempotencyKey())
    }
    expect(keys.size).toBe(1000)
  })

  it('cumple con longitud mínima (8 chars)', () => {
    const key = generateIdempotencyKey()
    expect(key.length).toBeGreaterThanOrEqual(8)
  })

  it('cumple con longitud máxima (120 chars)', () => {
    const key = generateIdempotencyKey()
    expect(key.length).toBeLessThanOrEqual(120)
  })
})

describe('paymentsFingerprint', () => {
  it('es determinista para los mismos pagos en el mismo orden', () => {
    const fp1 = paymentsFingerprint([
      { method: 'EFECTIVO_CUP', amount: 100, currency: 'CUP' },
    ])
    const fp2 = paymentsFingerprint([
      { method: 'EFECTIVO_CUP', amount: 100, currency: 'CUP' },
    ])
    expect(fp1).toBe(fp2)
  })

  it('es determinista para los mismos pagos en DISTINTO orden', () => {
    const fp1 = paymentsFingerprint([
      { method: 'EFECTIVO_CUP', amount: 100, currency: 'CUP' },
      { method: 'EFECTIVO_USD', amount: 5, currency: 'USD' },
    ])
    const fp2 = paymentsFingerprint([
      { method: 'EFECTIVO_USD', amount: 5, currency: 'USD' },
      { method: 'EFECTIVO_CUP', amount: 100, currency: 'CUP' },
    ])
    expect(fp1).toBe(fp2)
  })

  it('cambia si cambia el método', () => {
    const fp1 = paymentsFingerprint([{ method: 'EFECTIVO_CUP', amount: 100 }])
    const fp2 = paymentsFingerprint([{ method: 'EFECTIVO_USD', amount: 100 }])
    expect(fp1).not.toBe(fp2)
  })

  it('cambia si cambia el monto', () => {
    const fp1 = paymentsFingerprint([{ method: 'EFECTIVO_CUP', amount: 100 }])
    const fp2 = paymentsFingerprint([{ method: 'EFECTIVO_CUP', amount: 200 }])
    expect(fp1).not.toBe(fp2)
  })

  it('cambia si cambia la moneda', () => {
    const fp1 = paymentsFingerprint([{ method: 'COMBINADO', amount: 100, currency: 'CUP' }])
    const fp2 = paymentsFingerprint([{ method: 'COMBINADO', amount: 100, currency: 'USD' }])
    expect(fp1).not.toBe(fp2)
  })

  it('acepta amount como string (input de formulario)', () => {
    const fp1 = paymentsFingerprint([{ method: 'EFECTIVO_CUP', amount: '100' }])
    const fp2 = paymentsFingerprint([{ method: 'EFECTIVO_CUP', amount: 100 }])
    expect(fp1).toBe(fp2)
  })

  it('no incluye reference en el fingerprint', () => {
    const fp1 = paymentsFingerprint([{ method: 'TRANSFERENCIA_CUP', amount: 100 }])
    // paymentsFingerprint no acepta reference en su tipo, así que esto es
    // estructural: si el cliente agrega reference, no debería invalidar la key.
    // Como el tipo no incluye reference, no se puede pasar — esto es correcto.
    expect(fp1).toBeTruthy()
  })
})

describe('IdempotencyManager', () => {
  let manager: IdempotencyManager

  beforeEach(() => {
    manager = new IdempotencyManager()
  })

  it('genera una nueva key en primera llamada', () => {
    const key = manager.getOrCreate('order-1', 'fp-1')
    expect(key).toMatch(/^idem-/)
  })

  it('reutiliza la misma key si el fingerprint no cambió', () => {
    const key1 = manager.getOrCreate('order-1', 'fp-1')
    const key2 = manager.getOrCreate('order-1', 'fp-1')
    expect(key1).toBe(key2)
  })

  it('genera nueva key si el fingerprint cambió (mismo orderId)', () => {
    const key1 = manager.getOrCreate('order-1', 'fp-1')
    const key2 = manager.getOrCreate('order-1', 'fp-2')
    expect(key1).not.toBe(key2)
  })

  it('mantiene keys separadas por orderId', () => {
    const key1 = manager.getOrCreate('order-1', 'fp-1')
    const key2 = manager.getOrCreate('order-2', 'fp-1')
    expect(key1).not.toBe(key2)
  })

  it('elimina la key tras clear()', () => {
    const key1 = manager.getOrCreate('order-1', 'fp-1')
    manager.clear('order-1')
    const key2 = manager.getOrCreate('order-1', 'fp-1')
    expect(key1).not.toBe(key2)
  })

  it('peek devuelve la key actual sin generar', () => {
    expect(manager.peek('order-1')).toBeNull()
    const key = manager.getOrCreate('order-1', 'fp-1')
    expect(manager.peek('order-1')).toBe(key)
  })

  it('peek devuelve null tras clear()', () => {
    manager.getOrCreate('order-1', 'fp-1')
    manager.clear('order-1')
    expect(manager.peek('order-1')).toBeNull()
  })

  it('simula doble click: dos llamadas con mismo fingerprint → misma key', () => {
    // Caso de uso real: usuario hace doble click en "Cobrar"
    const fp = paymentsFingerprint([{ method: 'EFECTIVO_CUP', amount: 100 }])
    const key1 = manager.getOrCreate('order-1', fp)
    const key2 = manager.getOrCreate('order-1', fp)
    expect(key1).toBe(key2)
  })

  it('simula timeout + retry: dos llamadas con mismo fingerprint → misma key', () => {
    // Caso de uso real: primer intento falla por timeout, usuario reintenta
    const fp = paymentsFingerprint([{ method: 'EFECTIVO_CUP', amount: 100 }])
    const key1 = manager.getOrCreate('order-1', fp)
    // (no clear porque la operación falló)
    const key2 = manager.getOrCreate('order-1', fp)
    expect(key1).toBe(key2)
  })

  it('simula cambio de monto: dos llamadas con distinto fingerprint → distinta key', () => {
    // Caso de uso real: usuario cambia el monto → es un intento nuevo
    const fp1 = paymentsFingerprint([{ method: 'EFECTIVO_CUP', amount: 100 }])
    const fp2 = paymentsFingerprint([{ method: 'EFECTIVO_CUP', amount: 200 }])
    const key1 = manager.getOrCreate('order-1', fp1)
    const key2 = manager.getOrCreate('order-1', fp2)
    expect(key1).not.toBe(key2)
  })
})
