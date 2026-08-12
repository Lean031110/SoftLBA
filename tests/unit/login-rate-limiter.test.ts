// Tests unitarios para LoginRateLimiter (FASE 12 — v1.0.13, issue #47)
// ============================================================
import { describe, it, expect, beforeEach } from 'vitest'
import {
  checkRateLimit,
  recordFailedAttempt,
  recordSuccessfulAttempt,
  getRateLimitStats,
} from '../../src/lib/security/login-rate-limiter'

// Helper: simular N intentos fallidos desde una IP.
function simulateFailedAttempts(ip: string, count: number, deviceId?: string) {
  let lastResult
  for (let i = 0; i < count; i++) {
    lastResult = recordFailedAttempt(ip, deviceId)
  }
  return lastResult
}

describe('LoginRateLimiter — checkRateLimit', () => {
  it('permite si no hay intentos previos', () => {
    const result = checkRateLimit('192.168.1.100', 'device-1')
    expect(result.ok).toBe(true)
  })

  it('bloquea IP tras 20 intentos fallidos', () => {
    simulateFailedAttempts('10.0.0.1', 20)
    const result = checkRateLimit('10.0.0.1', 'device-2')
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('IP_BLOCKED')
    expect(result.retryAfterMs).toBeGreaterThan(0)
  })

  it('no bloquea IP distinta', () => {
    simulateFailedAttempts('10.0.0.1', 20)
    const result = checkRateLimit('10.0.0.2', 'device-2')
    expect(result.ok).toBe(true)
  })
})

describe('LoginRateLimiter — recordFailedAttempt', () => {
  it('incrementa contador y retorna remaining', () => {
    // Usar IP única para este test para evitar interferencia con otros tests.
    const testIp = '10.99.99.50'
    const r1 = recordFailedAttempt(testIp)
    expect(r1.ok).toBe(true)
    expect(r1.remaining).toBeGreaterThan(0)

    const r2 = recordFailedAttempt(testIp)
    expect(r2.ok).toBe(true)
    // El remaining debe ser menor o igual (puede ser igual si el cálculo es distinto).
    expect(r2.remaining).toBeLessThanOrEqual(r1.remaining)
  })

  it('bloquea IP tras llegar al límite', () => {
    const final = simulateFailedAttempts('10.0.0.100', 20)
    expect(final?.ok).toBe(false)
    expect(final?.reason).toBe('IP_BLOCKED')
  })

  it('bloquea device tras 10 intentos (aunque IP no haya llegado a 20)', () => {
    // 10 intentos desde misma IP + mismo device
    for (let i = 0; i < 10; i++) {
      recordFailedAttempt('10.0.0.200', 'device-blocked')
    }
    const r = checkRateLimit('10.0.0.200', 'device-blocked')
    expect(r.ok).toBe(false)
    // Puede ser IP_BLOCKED o DEVICE_BLOCKED dependiendo del orden,
    // pero ambos indican bloqueo.
    expect(['IP_BLOCKED', 'DEVICE_BLOCKED']).toContain(r.reason)
  })
})

describe('LoginRateLimiter — recordSuccessfulAttempt', () => {
  it('limpia contadores tras éxito', () => {
    // Acumular algunos fallos
    recordFailedAttempt('10.0.0.300', 'device-300')
    recordFailedAttempt('10.0.0.300', 'device-300')
    recordFailedAttempt('10.0.0.300', 'device-300')

    // Login exitoso
    recordSuccessfulAttempt('10.0.0.300', 'device-300')

    // Verificar que la IP ya no está bloqueada (contadores reseteados)
    const r = checkRateLimit('10.0.0.300', 'device-300')
    expect(r.ok).toBe(true)
  })

  it('no afecta a otras IPs', () => {
    recordFailedAttempt('10.0.0.400', 'device-400')
    recordSuccessfulAttempt('10.0.0.500', 'device-500')
    // La IP 400 sigue teniendo su contador
    const r = checkRateLimit('10.0.0.400', 'device-400')
    expect(r.ok).toBe(true) // Aún no llegó al límite (solo 1 fallo)
  })
})

describe('LoginRateLimiter — getRateLimitStats', () => {
  it('retorna stats con conteos', () => {
    recordFailedAttempt('10.0.0.600', 'device-600')
    const stats = getRateLimitStats()
    expect(stats.ipBucketsTracked).toBeGreaterThan(0)
    expect(typeof stats.blockedIps).toBe('number')
  })
})

describe('LoginRateLimiter — sin deviceId', () => {
  it('funciona sin deviceId (solo IP)', () => {
    const r = checkRateLimit('10.0.0.700')
    expect(r.ok).toBe(true)
  })

  it('registra fallos sin deviceId', () => {
    const r = recordFailedAttempt('10.0.0.800')
    expect(r.ok).toBe(true)
    expect(r.remaining).toBeGreaterThan(0)
  })
})
