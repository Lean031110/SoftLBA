// tests/unit/use-beep.test.ts
// v1.0.20-FRONTEND-02A (fix #5): Tests para cleanup de AudioContext.

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBeep } from '../../src/hooks/use-beep'

// Mock AudioContext: devuelve una nueva instancia en cada llamada.
// El hook guarda la instancia en un ref y la reutiliza.
function makeMockAudioContext() {
  return {
    state: 'suspended',
    currentTime: 0,
    destination: {},
    resume: vi.fn(() => Promise.resolve()),
    createOscillator: vi.fn(() => ({
      connect: vi.fn(),
      type: '',
      frequency: { value: 0 },
      start: vi.fn(),
      stop: vi.fn(),
    })),
    createGain: vi.fn(() => ({
      connect: vi.fn(),
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
    })),
    close: vi.fn(() => Promise.resolve()),
  }
}

describe('useBeep', () => {
  let mockAudioContext: ReturnType<typeof makeMockAudioContext>
  let originalAudioContext: typeof window.AudioContext
  let audioContextCalls: number

  beforeEach(() => {
    mockAudioContext = makeMockAudioContext()
    audioContextCalls = 0
    originalAudioContext = window.AudioContext
    // El constructor devuelve la misma instancia (como un singleton por hook).
    // Usamos `function()` en vez de `vi.fn()` porque el hook la invoca con
    // `new AudioCtx()` — vi.fn no es constructable.
    ;(window as any).AudioContext = function () {
      audioContextCalls++
      return mockAudioContext
    }
    ;(window as any).webkitAudioContext = undefined
  })

  afterEach(() => {
    window.AudioContext = originalAudioContext
    vi.restoreAllMocks()
  })

  it('no crea AudioContext hasta que se llama play()', () => {
    renderHook(() => useBeep())
    // Sin llamada a play(), no se instancia AudioContext.
    expect(audioContextCalls).toBe(0)
  })

  it('crea AudioContext en la primera llamada a play()', () => {
    const { result } = renderHook(() => useBeep())
    result.current.play(880, 200, 0.3)
    expect(audioContextCalls).toBe(1)
  })

  it('reutiliza el mismo AudioContext en llamadas posteriores', () => {
    const { result } = renderHook(() => useBeep())
    result.current.play(880, 200, 0.3)
    result.current.play(440, 100, 0.5)
    result.current.play(660, 150, 0.2)
    // AudioContext solo se crea una vez (audioContextCalls).
    expect(audioContextCalls).toBe(1)
  })

  it('cierra el AudioContext al desmontar (fix #5)', () => {
    const { result, unmount } = renderHook(() => useBeep())
    result.current.play(880, 200, 0.3)
    expect(mockAudioContext.close).not.toHaveBeenCalled()

    // Desmontar debe cerrar el AudioContext para liberar recursos.
    unmount()
    expect(mockAudioContext.close).toHaveBeenCalledTimes(1)
  })

  it('no crashea si el navegador no soporta AudioContext', () => {
    ;(window as any).AudioContext = undefined
    ;(window as any).webkitAudioContext = undefined
    const { result } = renderHook(() => useBeep())
    // No debe lanzar error.
    expect(() => result.current.play(880, 200, 0.3)).not.toThrow()
  })

  it('no lanza si AudioContext.resume() falla', () => {
    mockAudioContext.resume = vi.fn(() => Promise.reject(new Error('blocked')))
    const { result } = renderHook(() => useBeep())
    // No debe propagar el error de resume (silencioso).
    expect(() => result.current.play(880, 200, 0.3)).not.toThrow()
  })
})
