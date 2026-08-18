// tests/unit/logger.test.ts
// FASE 3: Tests reales del logger estructurado.
// Reemplaza al dummy tests/unit/logger-checksum.test.ts que solo probaba crypto.createHash.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let tmpDir: string
let logsDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'softlba-logger-'))
  // El logger escribe a `${LOG_DIR}/logs/<module>.log`.
  // Seteamos LOG_DIR = tmpDir y esperamos archivos en tmpDir/logs/.
  process.env.LOG_DIR = tmpDir
  logsDir = join(tmpDir, 'logs')
  process.env.LOG_LEVEL_CONSOLE = 'DEBUG'
  process.env.LOG_LEVEL_FILE = 'DEBUG'
  vi.spyOn(console, 'debug').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  rmSync(tmpDir, { recursive: true, force: true })
  delete process.env.LOG_DIR
  delete process.env.LOG_LEVEL_CONSOLE
  delete process.env.LOG_LEVEL_FILE
})

async function importLogger() {
  // El logger lee LOG_DIR en cada llamada (getLogDir), no hace falta resetModules.
  // Pero lo reseteamos para garantizar estado limpio entre tests.
  vi.resetModules()
  return (await import('@/lib/logger')).logger
}

function readLog(module: string): any {
  const path = join(logsDir, `${module}.log`)
  if (!existsSync(path)) throw new Error(`Log file not found: ${path}`)
  const content = readFileSync(path, 'utf8')
  return JSON.parse(content.trim())
}

function readLogRaw(module: string): string {
  const path = join(logsDir, `${module}.log`)
  if (!existsSync(path)) throw new Error(`Log file not found: ${path}`)
  return readFileSync(path, 'utf8')
}

describe('FASE 3 — Logger estructurado', () => {
  it('tiene 5 niveles: DEBUG, INFO, WARN, ERROR, FATAL', async () => {
    const mod = await import('@/lib/logger')
    const levels = Object.keys(mod.__test__.LEVEL_PRIORITY)
    expect(levels).toEqual(['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'])
  })

  it('escribe INFO a archivo con todos los campos', async () => {
    const logger = await importLogger()
    logger.info('Mensaje de prueba', { foo: 'bar' }, 'test-module')
    const entry = readLog('test-module')
    expect(entry.level).toBe('INFO')
    expect(entry.message).toBe('Mensaje de prueba')
    expect(entry.data.foo).toBe('bar')
    expect(entry.module).toBe('test-module')
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  it('escribe FATAL a archivo', async () => {
    const logger = await importLogger()
    logger.fatal('Error catastrófico', null, 'test-fatal')
    const entry = readLog('test-fatal')
    expect(entry.level).toBe('FATAL')
    expect(entry.message).toBe('Error catastrófico')
  })

  it('withContext merguea contexto en cada log', async () => {
    const logger = await importLogger()
    const ctx = logger.withContext({ requestId: 'req-abc' })
    ctx.info('Operación X', { operation: 'test' }, 'ctx-module')
    const entry = readLog('ctx-module')
    expect(entry.data.requestId).toBe('req-abc')
    expect(entry.data.operation).toBe('test')
  })

  it('withContext es componible', async () => {
    const logger = await importLogger()
    const c1 = logger.withContext({ a: 1 })
    const c2 = c1.withContext({ b: 2 })
    c2.info('test', null, 'composed')
    const entry = readLog('composed')
    expect(entry.data.a).toBe(1)
    expect(entry.data.b).toBe(2)
  })

  it('default module es "backend"', async () => {
    const logger = await importLogger()
    logger.info('Sin módulo')
    const entry = readLog('backend')
    expect(entry.module).toBe('backend')
  })

  it('parseMinLevel respeta LOG_LEVEL env', async () => {
    const mod = await import('@/lib/logger')
    expect(mod.__test__.parseMinLevel('warn')).toBe('WARN')
    expect(mod.__test__.parseMinLevel('DEBUG')).toBe('DEBUG')
    expect(mod.__test__.parseMinLevel('invalido')).toBe('INFO')
    expect(mod.__test__.parseMinLevel(undefined)).toBe(
      process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG',
    )
  })

  it('formatConsole tiene formato legible esperado', async () => {
    const mod = await import('@/lib/logger')
    const line = mod.__test__.formatConsole({
      timestamp: '2026-08-19T14:21:03Z',
      level: 'WARN',
      module: 'printer',
      message: 'Cocina-01 timeout 5000ms',
    })
    expect(line).toBe('2026-08-19T14:21:03Z [WARN] [printer] Cocina-01 timeout 5000ms')
  })

  it('escribe a archivo distinto por módulo', async () => {
    const logger = await importLogger()
    logger.info('A', null, 'backend')
    logger.info('B', null, 'realtime')
    logger.info('C', null, 'printer')
    expect(existsSync(join(logsDir, 'backend.log'))).toBe(true)
    expect(existsSync(join(logsDir, 'realtime.log'))).toBe(true)
    expect(existsSync(join(logsDir, 'printer.log'))).toBe(true)
  })
})

describe('FASE 3 — Logger: redacción de secretos', () => {
  it('redacta claves sensibles en data', async () => {
    const logger = await importLogger()
    logger.info('Login intent', {
      username: 'admin',
      password: 'supersecreto123',
      token: 'abc.def.ghi',
      cookie: 'rc_session=xyz',
      NEXTAUTH_SECRET: 'camba-esto',
    }, 'redact-test')
    const entry = readLog('redact-test')
    expect(entry.data.password).toBe('[REDACTED]')
    expect(entry.data.token).toBe('[REDACTED]')
    expect(entry.data.cookie).toBe('[REDACTED]')
    expect(entry.data.NEXTAUTH_SECRET).toBe('[REDACTED]')
    expect(entry.data.username).toBe('admin')
    const content = readLogRaw('redact-test')
    expect(content).not.toContain('supersecreto123')
  })

  it('redacta valores sensibles embebidos en strings (Bearer, JWT)', async () => {
    const logger = await importLogger()
    const bearer = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123'
    logger.info('Request auth', { authorization: bearer }, 'bearer-test')
    const content = readLogRaw('bearer-test')
    expect(content).not.toContain('eyJhbGciOi')
    expect(content).toContain('[REDACTED]')
  })

  it('redacta recursivamente en objetos anidados', async () => {
    const logger = await importLogger()
    logger.info('Nested', {
      outer: {
        password: 'nested-secret',
        inner: {
          token: 'deep-token',
          safe: 'visible',
        },
      },
    }, 'nested-test')
    const entry = readLog('nested-test')
    expect(entry.data.outer.password).toBe('[REDACTED]')
    expect(entry.data.outer.inner.token).toBe('[REDACTED]')
    expect(entry.data.outer.inner.safe).toBe('visible')
    const content = readLogRaw('nested-test')
    expect(content).not.toContain('nested-secret')
    expect(content).not.toContain('deep-token')
  })

  it('redacta campos en arrays', async () => {
    const logger = await importLogger()
    logger.info('Array', {
      users: [
        { id: 1, password: 'p1' },
        { id: 2, password: 'p2' },
      ],
    }, 'array-test')
    const entry = readLog('array-test')
    expect(entry.data.users[0].password).toBe('[REDACTED]')
    expect(entry.data.users[1].password).toBe('[REDACTED]')
    expect(entry.data.users[0].id).toBe(1)
  })

  it('redacta credenciales en URLs de conexión', async () => {
    const logger = await importLogger()
    logger.info('DB', { url: 'postgres://user:secretpass@host:5432/db' }, 'url-test')
    const content = readLogRaw('url-test')
    expect(content).not.toContain('secretpass')
  })

  it('redacta Error objects con propiedades sensibles', async () => {
    const logger = await importLogger()
    const err = new Error('Auth failed')
    ;(err as any).password = 'leaked-in-error'
    ;(err as any).token = 'leaked-jwt'
    logger.error('Captured', err, 'err-test')
    const content = readLogRaw('err-test')
    expect(content).not.toContain('leaked-in-error')
    expect(content).not.toContain('leaked-jwt')
    // La redacción aparece en el output.
    expect(content).toContain('[REDACTED]')
  })
})
