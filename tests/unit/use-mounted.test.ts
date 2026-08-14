// tests/unit/use-mounted.test.ts
// v1.0.20-FRONTEND-01 (FE-002): Tests para src/lib/use-mounted.ts
// @vitest-environment jsdom

import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMounted } from '../../src/lib/use-mounted'

describe('useMounted', () => {
  it('devuelve un boolean', () => {
    const { result } = renderHook(() => useMounted())
    expect(typeof result.current).toBe('boolean')
  })

  it('no lanza error al renderizar', () => {
    expect(() => {
      renderHook(() => useMounted())
    }).not.toThrow()
  })
})
