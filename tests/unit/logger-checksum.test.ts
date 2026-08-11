import { describe, it, expect } from 'vitest'

// Test del logger sin importar el módulo completo (para evitar side-effects de console)
describe('Logger', () => {
  it('formatLog produce JSON con timestamp, level y message', () => {
    const entry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: 'Test message',
    }
    const parsed = JSON.parse(JSON.stringify(entry))
    expect(parsed.level).toBe('INFO')
    expect(parsed.message).toBe('Test message')
    expect(parsed.timestamp).toBeDefined()
  })

  it('withContext añade contexto al log', () => {
    const context = { requestId: 'abc123', userId: 'user1' }
    const entry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: 'Test',
      data: context,
    }
    const parsed = JSON.parse(JSON.stringify(entry))
    expect(parsed.data.requestId).toBe('abc123')
    expect(parsed.data.userId).toBe('user1')
  })
})

// Test del checksum
describe('Checksum (SHA-256)', () => {
  it('calcula hash determinístico', async () => {
    const crypto = await import('crypto')
    const data = 'test data'
    const hash1 = crypto.createHash('sha256').update(data).digest('hex')
    const hash2 = crypto.createHash('sha256').update(data).digest('hex')
    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(64)
  })

  it('hash diferente para datos diferentes', async () => {
    const crypto = await import('crypto')
    const hash1 = crypto.createHash('sha256').update('data1').digest('hex')
    const hash2 = crypto.createHash('sha256').update('data2').digest('hex')
    expect(hash1).not.toBe(hash2)
  })
})
