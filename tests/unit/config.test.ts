// tests/unit/config.test.ts
// FASE 3 — Tests del módulo central de configuración.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'softlba-config-'))
  vi.resetModules()
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
  // Limpiar env vars que pudimos setear.
  delete process.env.NODE_ENV
  delete process.env.PORT
  delete process.env.REALTIME_PORT
  delete process.env.PRINT_WORKER_PORT
  delete process.env.BACKEND_URL
  delete process.env.REALTIME_INTERNAL_URL
  delete process.env.NEXT_PUBLIC_REALTIME_URL
  delete process.env.PRINT_WORKER_URL
  delete process.env.ALLOWED_ORIGINS
  delete process.env.LOG_LEVEL_CONSOLE
  delete process.env.LOG_LEVEL_FILE
  delete process.env.LOG_DIR
  delete process.env.COOKIE_SECURE
  delete process.env.SESSION_TTL_SECONDS
  delete process.env.DATABASE_URL
  delete process.env.PRINT_WORKER_INTERVAL_MS
  delete process.env.DEMO_USERS
  delete process.env.NEXTAUTH_SECRET
  delete process.env.REALTIME_SECRET
  delete process.env.CONFIG_PATH
  vi.restoreAllMocks()
})

async function importConfig() {
  const mod = await import('@/lib/config')
  mod.__resetConfig()
  return mod
}

describe('FASE 3 — Módulo central de configuración', () => {
  it('getConfig retorna objeto tipado con todas las secciones', async () => {
    process.env.DATABASE_URL = 'file:./test.db'
    const { getConfig } = await importConfig()
    const cfg = getConfig()
    expect(cfg).toHaveProperty('nodeEnv')
    expect(cfg).toHaveProperty('isDev')
    expect(cfg).toHaveProperty('isProd')
    expect(cfg).toHaveProperty('appName')
    expect(cfg).toHaveProperty('appVersion')
    expect(cfg).toHaveProperty('services')
    expect(cfg).toHaveProperty('client')
    expect(cfg).toHaveProperty('cors')
    expect(cfg).toHaveProperty('logging')
    expect(cfg).toHaveProperty('auth')
    expect(cfg).toHaveProperty('databaseUrl')
    expect(cfg).toHaveProperty('printWorker')
    expect(cfg).toHaveProperty('demoUsers')
  })

  it('cachea config entre llamadas (singleton)', async () => {
    process.env.DATABASE_URL = 'file:./test.db'
    const { getConfig } = await importConfig()
    const cfg1 = getConfig()
    const cfg2 = getConfig()
    expect(cfg1).toBe(cfg2) // misma referencia
  })

  it('__resetConfig permite re-leer tras cambios de env', async () => {
    process.env.DATABASE_URL = 'file:./test1.db'
    const { getConfig, __resetConfig } = await importConfig()
    const cfg1 = getConfig()
    expect(cfg1.databaseUrl).toBe('file:./test1.db')

    process.env.DATABASE_URL = 'file:./test2.db'
    __resetConfig()
    const cfg2 = getConfig()
    expect(cfg2.databaseUrl).toBe('file:./test2.db')
  })

  it('puertos default: 3000, 3003, 3004', async () => {
    process.env.DATABASE_URL = 'file:./test.db'
    const { getConfig } = await importConfig()
    const cfg = getConfig()
    expect(cfg.services.backendPort).toBe(3000)
    expect(cfg.services.realtimePort).toBe(3003)
    expect(cfg.services.printWorkerPort).toBe(3004)
  })

  it('puertos se sobrescriben con env vars', async () => {
    process.env.DATABASE_URL = 'file:./test.db'
    process.env.PORT = '4000'
    process.env.REALTIME_PORT = '4003'
    process.env.PRINT_WORKER_PORT = '4004'
    const { getConfig } = await importConfig()
    const cfg = getConfig()
    expect(cfg.services.backendPort).toBe(4000)
    expect(cfg.services.realtimePort).toBe(4003)
    expect(cfg.services.printWorkerPort).toBe(4004)
  })

  it('URLs internas derivan de puertos por defecto', async () => {
    process.env.DATABASE_URL = 'file:./test.db'
    const { getConfig } = await importConfig()
    const cfg = getConfig()
    expect(cfg.services.backendUrl).toBe('http://localhost:3000')
    expect(cfg.services.realtimeInternalUrl).toBe('http://localhost:3003')
    expect(cfg.services.printWorkerUrl).toBe('http://localhost:3004')
    expect(cfg.services.realtimeEmitUrl).toBe('http://localhost:3003/emit')
  })

  it('URLs internas se sobrescriben con env vars', async () => {
    process.env.DATABASE_URL = 'file:./test.db'
    process.env.BACKEND_URL = 'https://pos.midominio.com'
    process.env.REALTIME_INTERNAL_URL = 'https://realtime.midominio.com'
    const { getConfig } = await importConfig()
    const cfg = getConfig()
    expect(cfg.services.backendUrl).toBe('https://pos.midominio.com')
    expect(cfg.services.realtimeInternalUrl).toBe('https://realtime.midominio.com')
    expect(cfg.services.realtimeEmitUrl).toBe('https://realtime.midominio.com/emit')
  })

  it('ALLOWED_ORIGINS se parsea como CSV', async () => {
    process.env.DATABASE_URL = 'file:./test.db'
    process.env.ALLOWED_ORIGINS = 'http://a.com,http://b.com,http://c.com'
    const { getConfig } = await importConfig()
    const cfg = getConfig()
    expect(cfg.cors.allowedOrigins).toEqual(['http://a.com', 'http://b.com', 'http://c.com'])
  })

  it('LOG_LEVEL_CONSOLE respeta valor', async () => {
    process.env.DATABASE_URL = 'file:./test.db'
    process.env.LOG_LEVEL_CONSOLE = 'WARN'
    const { getConfig } = await importConfig()
    const cfg = getConfig()
    expect(cfg.logging.consoleLevel).toBe('WARN')
  })

  it('LOG_LEVEL_CONSOLE con valor inválido cae a default (dev=DEBUG)', async () => {
    process.env.DATABASE_URL = 'file:./test.db'
    process.env.NODE_ENV = 'development'
    process.env.LOG_LEVEL_CONSOLE = 'INVALID_LEVEL'
    const { getConfig, __resetConfig } = await importConfig()
    __resetConfig()
    const cfg = getConfig()
    // En dev, fallback es DEBUG (ver parseLogLevel + config.ts).
    expect(cfg.logging.consoleLevel).toBe('DEBUG')
  })

  it('COOKIE_SECURE default false en dev, true en prod', async () => {
    process.env.NODE_ENV = 'development'
    process.env.DATABASE_URL = 'file:./test.db'
    const { getConfig, __resetConfig } = await importConfig()
    __resetConfig()
    expect(getConfig().auth.cookieSecure).toBe(false)

    process.env.NODE_ENV = 'production'
    __resetConfig()
    expect(getConfig().auth.cookieSecure).toBe(true)
  })

  it('COOKIE_SECURE explícito sobrescribe default', async () => {
    process.env.NODE_ENV = 'production'
    process.env.COOKIE_SECURE = 'false'
    process.env.DATABASE_URL = 'file:./test.db'
    const { getConfig, __resetConfig } = await importConfig()
    __resetConfig()
    expect(getConfig().auth.cookieSecure).toBe(false)
  })

  it('SESSION_TTL_SECONDS default 43200 (12h)', async () => {
    process.env.DATABASE_URL = 'file:./test.db'
    const { getConfig } = await importConfig()
    const cfg = getConfig()
    expect(cfg.auth.sessionTtlSeconds).toBe(43200)
  })

  it('PRINT_WORKER_INTERVAL_MS default 5000', async () => {
    process.env.DATABASE_URL = 'file:./test.db'
    const { getConfig } = await importConfig()
    const cfg = getConfig()
    expect(cfg.printWorker.intervalMs).toBe(5000)
  })

  it('DEMO_USERS default true en dev, false en prod', async () => {
    process.env.NODE_ENV = 'development'
    process.env.DATABASE_URL = 'file:./test.db'
    const { getConfig, __resetConfig } = await importConfig()
    __resetConfig()
    expect(getConfig().demoUsers).toBe(true)

    process.env.NODE_ENV = 'production'
    __resetConfig()
    expect(getConfig().demoUsers).toBe(false)
  })

  it('detecta conflicto de puertos backend == realtime', async () => {
    process.env.DATABASE_URL = 'file:./test.db'
    process.env.PORT = '3003'
    process.env.REALTIME_PORT = '3003'
    const { validateConfig } = await importConfig()
    const result = validateConfig()
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('mismo puerto'))).toBe(true)
  })
})

describe('FASE 3 — config.json (no sensible, versionable)', () => {
  it('lee config.json y aplica valores no sensibles', async () => {
    const configJson = {
      services: {
        backendPort: 5000,
        realtimePort: 5003,
        printWorkerPort: 5004,
      },
      cors: {
        allowedOrigins: ['http://test.lan:5000'],
      },
      logging: {
        consoleLevel: 'ERROR',
      },
    }
    const configPath = join(tmpDir, 'config.json')
    writeFileSync(configPath, JSON.stringify(configJson))
    process.env.CONFIG_PATH = configPath
    process.env.DATABASE_URL = 'file:./test.db'

    const { getConfig } = await importConfig()
    const cfg = getConfig()
    expect(cfg.services.backendPort).toBe(5000)
    expect(cfg.services.realtimePort).toBe(5003)
    expect(cfg.services.printWorkerPort).toBe(5004)
    expect(cfg.cors.allowedOrigins).toEqual(['http://test.lan:5000'])
    expect(cfg.logging.consoleLevel).toBe('ERROR')
  })

  it('env vars tienen prioridad sobre config.json', async () => {
    const configJson = {
      services: {
        backendPort: 5000,
      },
    }
    const configPath = join(tmpDir, 'config.json')
    writeFileSync(configPath, JSON.stringify(configJson))
    process.env.CONFIG_PATH = configPath
    process.env.DATABASE_URL = 'file:./test.db'
    process.env.PORT = '6000' // env var debería ganar

    const { getConfig } = await importConfig()
    const cfg = getConfig()
    expect(cfg.services.backendPort).toBe(6000)
  })

  it('config.json inexistente cae a defaults', async () => {
    process.env.CONFIG_PATH = join(tmpDir, 'no-existe.json')
    process.env.DATABASE_URL = 'file:./test.db'
    const { getConfig } = await importConfig()
    const cfg = getConfig()
    expect(cfg.services.backendPort).toBe(3000) // default
  })

  it('config.json inválido (JSON roto) cae a defaults sin crashear', async () => {
    const configPath = join(tmpDir, 'config.json')
    writeFileSync(configPath, '{ invalid json }')
    process.env.CONFIG_PATH = configPath
    process.env.DATABASE_URL = 'file:./test.db'
    const { getConfig } = await importConfig()
    const cfg = getConfig()
    expect(cfg.services.backendPort).toBe(3000) // default
  })
})

describe('FASE 3 — Secretos (getSecrets)', () => {
  it('getSecrets retorna secretos de env vars', async () => {
    process.env.NEXTAUTH_SECRET = 'test-secret-16-chars-min'
    process.env.REALTIME_SECRET = 'test-realtime-secret-16-chars'
    const { getSecrets } = await importConfig()
    const secrets = getSecrets()
    expect(secrets.nextauthSecret).toBe('test-secret-16-chars-min')
    expect(secrets.realtimeSecret).toBe('test-realtime-secret-16-chars')
  })

  it('getSecrets en dev sin secretos usa defaults', async () => {
    process.env.NODE_ENV = 'development'
    delete process.env.NEXTAUTH_SECRET
    delete process.env.REALTIME_SECRET
    const { getSecrets } = await importConfig()
    const secrets = getSecrets()
    expect(secrets.nextauthSecret).toBe('cuba-restaurante-secret-key-change-in-prod')
    expect(secrets.realtimeSecret).toBe('dev-internal-secret-change-in-prod')
  })
})

describe('FASE 3 — validateConfig', () => {
  it('validateConfig reporta DATABASE_URL faltante', async () => {
    delete process.env.DATABASE_URL
    const { validateConfig } = await importConfig()
    const result = validateConfig()
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('DATABASE_URL'))).toBe(true)
  })

  it('validateConfig en prod sin NEXTAUTH_SECRET da error', async () => {
    process.env.NODE_ENV = 'production'
    process.env.DATABASE_URL = 'file:./test.db'
    delete process.env.NEXTAUTH_SECRET
    const { validateConfig, __resetConfig } = await importConfig()
    __resetConfig()
    const result = validateConfig()
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('NEXTAUTH_SECRET'))).toBe(true)
  })

  it('validateConfig en dev con DATABASE_URL set da ok', async () => {
    process.env.NODE_ENV = 'development'
    process.env.DATABASE_URL = 'file:./test.db'
    const { validateConfig } = await importConfig()
    const result = validateConfig()
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })
})
