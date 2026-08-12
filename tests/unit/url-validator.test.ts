// Tests unitarios para url-validator (FASE 12 — v1.0.13, issue #95)
// ============================================================
import { describe, it, expect } from 'vitest'
import { validateUrl, validateUrls, sanitizeUrl } from '../../src/lib/security/url-validator'

describe('url-validator — validateUrl', () => {
  it('acepta http://', () => {
    expect(validateUrl('http://example.com')).toBeNull()
    expect(validateUrl('http://localhost:3000')).toBeNull()
  })

  it('acepta https://', () => {
    expect(validateUrl('https://example.com')).toBeNull()
    expect(validateUrl('https://softlba.space-z.ai/')).toBeNull()
  })

  it('rechaza javascript:', () => {
    const err = validateUrl('javascript:alert(1)')
    expect(err).toMatch(/Protocolo no permitido/)
  })

  it('rechaza data:', () => {
    const err = validateUrl('data:text/html,<script>alert(1)</script>')
    expect(err).toMatch(/Protocolo no permitido/)
  })

  it('rechaza vbscript:', () => {
    const err = validateUrl('vbscript:msgbox(1)')
    expect(err).toMatch(/Protocolo no permitido/)
  })

  it('rechaza file:', () => {
    const err = validateUrl('file:///etc/passwd')
    expect(err).toMatch(/Protocolo no permitido/)
  })

  it('acepta string vacío (campo opcional)', () => {
    expect(validateUrl('')).toBeNull()
  })

  it('acepta null/undefined (campo no seteado)', () => {
    expect(validateUrl(null)).toBeNull()
    expect(validateUrl(undefined)).toBeNull()
  })

  it('rechaza URLs con espacios', () => {
    const err = validateUrl('https://example.com/hola mundo')
    expect(err).toMatch(/caracteres inválidos/)
  })

  it('rechaza URLs sin protocolo', () => {
    const err = validateUrl('example.com')
    expect(err).toMatch(/URL inválida/)
  })

  it('rechaza URLs sin host', () => {
    const err = validateUrl('https://')
    expect(err).not.toBeNull()  // URL inválida de alguna forma
  })
})

describe('url-validator — validateUrls', () => {
  it('retorna null si todas son válidas', () => {
    const result = validateUrls({
      website: 'https://example.com',
      facebook: 'https://facebook.com/foo',
    })
    expect(result).toBeNull()
  })

  it('retorna el primer error encontrado', () => {
    const result = validateUrls({
      website: 'https://example.com',
      facebook: 'javascript:alert(1)',
    })
    expect(result).not.toBeNull()
    expect(result?.field).toBe('facebook')
    expect(result?.error).toMatch(/Protocolo no permitido/)
  })

  it('acepta campos vacíos', () => {
    const result = validateUrls({
      website: '',
      facebook: null,
      instagram: undefined,
    })
    expect(result).toBeNull()
  })
})

describe('url-validator — sanitizeUrl', () => {
  it('normaliza URL válida', () => {
    expect(sanitizeUrl('https://example.com/path?q=1#hash')).toBe('https://example.com/path?q=1')
  })

  it('elimina credenciales embebidas', () => {
    const result = sanitizeUrl('https://user:pass@example.com/path')
    expect(result).toBe('https://example.com/path')
  })

  it('retorna null para javascript:', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull()
  })

  it('retorna null para string inválido', () => {
    expect(sanitizeUrl('not-a-url')).toBeNull()
  })

  it('retorna null para string vacío', () => {
    expect(sanitizeUrl('')).toBeNull()
    expect(sanitizeUrl(null)).toBeNull()
  })
})
