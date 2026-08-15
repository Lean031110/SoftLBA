// tests/unit/use-connectivity.test.ts
// v1.0.20-FRONTEND-02A (fix #2): Tests para src/hooks/use-connectivity.ts

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useConnectivity } from '../../src/hooks/use-connectivity'

// Helpers para mockear fetch
function mockFetchOk() {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ ok: true }), { status: 200 }),
  )
}

function mockFetchFail() {
  return vi.fn().mockRejectedValue(new Error('NetworkError'))
}

function mockFetch500() {
  return vi.fn().mockResolvedValue(new Response('Server error', { status: 500 }))
}

describe('useConnectivity', () => {
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
    // navigator.onLine true por defecto
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('devuelve estado INITIALIZING en el primer render', () => {
    global.fetch = mockFetchOk()
    const { result } = renderHook(() => useConnectivity({ enabled: false }))
    expect(result.current.state).toBe('INITIALIZING')
    expect(result.current.serverReachable).toBe(false)
  })

  it('transiciona a LOCAL_SERVER_AVAILABLE cuando /api/health responde 200 ok=true', async () => {
    global.fetch = mockFetchOk()
    const { result } = renderHook(() => useConnectivity({ intervalMs: 1000 }))

    await waitFor(() => {
      expect(result.current.state).toBe('LOCAL_SERVER_AVAILABLE')
    })
    expect(result.current.serverReachable).toBe(true)
    expect(result.current.browserOnline).toBe(true)
    expect(result.current.lastSuccessAt).toBeGreaterThan(0)
  })

  it('transiciona a LOCAL_SERVER_UNREACHABLE cuando /api/health falla', async () => {
    global.fetch = mockFetchFail()
    const { result } = renderHook(() => useConnectivity({ intervalMs: 1000 }))

    await waitFor(() => {
      expect(['LOCAL_SERVER_UNREACHABLE', 'RECONNECTING']).toContain(result.current.state)
    })
    expect(result.current.serverReachable).toBe(false)
    expect(result.current.lastFailureAt).toBeGreaterThan(0)
  })

  it('transiciona a LOCAL_SERVER_UNREACHABLE cuando /api/health responde 500', async () => {
    global.fetch = mockFetch500()
    const { result } = renderHook(() => useConnectivity({ intervalMs: 1000 }))

    await waitFor(() => {
      expect(['LOCAL_SERVER_UNREACHABLE', 'RECONNECTING']).toContain(result.current.state)
    })
    expect(result.current.serverReachable).toBe(false)
  })

  it('transiciona a NO_NETWORK cuando navigator.onLine === false', async () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      writable: true,
      configurable: true,
    })
    global.fetch = mockFetchOk()
    const { result } = renderHook(() => useConnectivity({ intervalMs: 1000 }))

    await waitFor(() => {
      expect(result.current.state).toBe('NO_NETWORK')
    })
    expect(result.current.browserOnline).toBe(false)
  })

  it('expone función refresh() para reintentar manualmente', () => {
    global.fetch = mockFetchOk()
    const { result } = renderHook(() => useConnectivity({ enabled: false }))
    expect(typeof result.current.refresh).toBe('function')
  })

  it('devuelve mensaje legible según el estado', async () => {
    global.fetch = mockFetchOk()
    const { result } = renderHook(() => useConnectivity({ intervalMs: 1000 }))

    // En INITIALIZING
    expect(result.current.message).toContain('Conectando')

    await waitFor(() => {
      expect(result.current.state).toBe('LOCAL_SERVER_AVAILABLE')
    })
    expect(result.current.message).toContain('Servidor local disponible')
  })

  it('no hace fetch cuando enabled=false', () => {
    const mockFetch = mockFetchOk()
    global.fetch = mockFetch
    renderHook(() => useConnectivity({ enabled: false, intervalMs: 1000 }))
    // Esperar a ver si hay llamadas (debería no haber ninguna)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
