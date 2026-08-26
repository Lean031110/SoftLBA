import { describe, expect, it } from 'vitest'
import { parseRuntimeEnvironment } from '@/lib/environment'
import { getPublicRealtimeConfig } from '@/lib/public-environment'

describe('environment configuration', () => {
  it('accepts explicit internal service URLs and ports', () => {
    const config = parseRuntimeEnvironment({
      SOFTLBA_ENV: 'lan',
      APP_INTERNAL_URL: 'http://softlba.local:3000',
      REALTIME_INTERNAL_URL: 'http://softlba.local:3000/api/internal/emit',
      REALTIME_SERVICE_URL: 'http://realtime.internal:3003/emit',
      PRINT_WORKER_URL: 'http://print.internal:3004',
      WEB_PORT: '3000', REALTIME_PORT: '3003', PRINT_WORKER_PORT: '3004',
      NEXTAUTH_SECRET: '1234567890123456', REALTIME_SECRET: 'abcdefghijklmnop',
    })
    expect(config.REALTIME_SERVICE_URL).toBe('http://realtime.internal:3003/emit')
    expect(config.REALTIME_PORT).toBe(3003)
  })

  it('rejects an invalid service URL and out-of-range port', () => {
    expect(() => parseRuntimeEnvironment({ REALTIME_SERVICE_URL: 'not-a-url' })).toThrow()
    expect(() => parseRuntimeEnvironment({ PRINT_WORKER_PORT: '70000' })).toThrow()
  })

  it('uses a fixed Socket.IO path and no port-selection query parameter', () => {
    const config = getPublicRealtimeConfig()
    expect(config.path).toBe('/socket.io')
    expect(String(config.url)).not.toContain('XTransformPort')
  })
})
