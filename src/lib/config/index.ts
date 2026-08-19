// src/lib/config/index.ts
// ============================================================
// Módulo central de configuración — SoftLBA
// ============================================================
// Una sola fuente de verdad para TODA la configuración del sistema.
// Reglas:
//   1. NUNCA hardcodear IPs, puertos, URLs, dominios, CORS, proxies.
//   2. TODO viene de variables de entorno (.env) o de config.json
//      (no sensible, versionable).
//   3. Los secretos (NEXTAUTH_SECRET, REALTIME_SECRET) SOLO de env vars.
//   4. Este módulo valida tipos y valores al cargar.
//   5. Cualquier otra parte del código NO debe leer process.env directamente.
//   6. Cliente y servidor usan el mismo módulo (los campos públicos via
//      NEXT_PUBLIC_* llegan al browser).
//
// Configuración por entorno:
//   - DESARROLLO: copiar .env.example → .env, ajustar IPs/URLs locales.
//   - PRUEBAS: mismo .env con valores de test.
//   - PRODUCCIÓN: .env con IPs reales del servidor.
//
// No tocar código fuente para cambiar entre entornos.
// ============================================================

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

// ============================================================
// Tipos
// ============================================================

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'
export type NodeEnv = 'development' | 'test' | 'production'

export interface AppConfig {
  // === Entorno ===
  nodeEnv: NodeEnv
  isDev: boolean
  isProd: boolean
  isTest: boolean

  // === App ===
  appName: string
  appVersion: string

  // === Servicios (URLs internas para comunicación server→server) ===
  services: {
    /** URL base del backend Next.js (ej: http://localhost:3000). Server-only. */
    backendUrl: string
    /** Puerto del backend. */
    backendPort: number
    /** URL interna del servicio Realtime (ej: http://localhost:3003). */
    realtimeInternalUrl: string
    /** URL pública del servicio Realtime (ej: ws://10.0.0.5:3003 o via gateway /?XTransformPort=3003). */
    realtimePublicUrl: string
    /** Puerto del servicio Realtime. */
    realtimePort: number
    /** URL interna del Print Worker (ej: http://localhost:3004). */
    printWorkerUrl: string
    /** Puerto del Print Worker. */
    printWorkerPort: number
    /** URL del endpoint interno /emit del realtime. */
    realtimeEmitUrl: string
  }

  // === Cliente (expuesto al browser via NEXT_PUBLIC_*) ===
  client: {
    /** URL pública del backend que el browser usa. Default: '' (mismo origen). */
    publicBackendUrl: string
    /** URL pública del realtime que el browser usa para Socket.IO. */
    publicRealtimeUrl: string
    /** URL pública del print worker para /health desde el browser. */
    publicPrintWorkerUrl: string
  }

  // === CORS ===
  cors: {
    /** Orígenes permitidos para Socket.IO y API (CSV). */
    allowedOrigins: string[]
  }

  // === Logging ===
  logging: {
    consoleLevel: LogLevel
    fileLevel: LogLevel
    logDir: string
  }

  // === Auth ===
  auth: {
    cookieSecure: boolean
    /** Duración de sesión en segundos (default: 12h). */
    sessionTtlSeconds: number
  }

  // === DB ===
  databaseUrl: string

  // === Print Worker ===
  printWorker: {
    intervalMs: number
  }

  // === Demo / flags ===
  demoUsers: boolean
}

// ============================================================
// Helpers de parsing
// ============================================================

function str(name: string, fallback = ''): string {
  const v = process.env[name]
  return v !== undefined && v !== '' ? v : fallback
}

function num(name: string, fallback: number): number {
  const v = process.env[name]
  if (v === undefined || v === '') return fallback
  const n = parseInt(v, 10)
  return Number.isNaN(n) ? fallback : n
}

function bool(name: string, fallback: boolean): boolean {
  const v = process.env[name]
  if (v === undefined || v === '') return fallback
  return v === 'true' || v === '1' || v === 'yes'
}

function csv(name: string, fallback: string[] = []): string[] {
  const v = process.env[name]
  if (!v) return fallback
  return v.split(',').map((s) => s.trim()).filter(Boolean)
}

function parseLogLevel(v: string | undefined, fallback: LogLevel): LogLevel {
  if (!v) return fallback
  const upper = v.toUpperCase() as LogLevel
  if (['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'].includes(upper)) return upper
  return fallback
}

function parseNodeEnv(v: string | undefined): NodeEnv {
  if (v === 'production') return 'production'
  if (v === 'test') return 'test'
  return 'development'
}

// ============================================================
// Cargar config.json (no sensible, versionable)
// ============================================================

interface ConfigFile {
  services?: {
    backendUrl?: string
    backendPort?: number
    realtimeInternalUrl?: string
    realtimePublicUrl?: string
    realtimePort?: number
    printWorkerUrl?: string
    printWorkerPort?: number
  }
  client?: {
    publicBackendUrl?: string
    publicRealtimeUrl?: string
    publicPrintWorkerUrl?: string
  }
  cors?: {
    allowedOrigins?: string[]
  }
  logging?: {
    consoleLevel?: LogLevel
    fileLevel?: LogLevel
    logDir?: string
  }
  auth?: {
    sessionTtlSeconds?: number
  }
  printWorker?: {
    intervalMs?: number
  }
}

function loadConfigJson(): ConfigFile {
  // Buscar config.json en la raíz del proyecto (NO se commitea si tiene secretos,
  // pero config.example.json SÍ se commitea y el usuario lo copia a config.json).
  const configPath = process.env.CONFIG_PATH || join(process.cwd(), 'config.json')
  if (!existsSync(configPath)) return {}
  try {
    const raw = readFileSync(configPath, 'utf8')
    return JSON.parse(raw) as ConfigFile
  } catch {
    return {}
  }
}

// ============================================================
// Singleton de configuración
// ============================================================

let cachedConfig: AppConfig | null = null

function buildConfig(): AppConfig {
  const nodeEnv = parseNodeEnv(process.env.NODE_ENV)
  const isDev = nodeEnv === 'development'
  const isProd = nodeEnv === 'production'
  const isTest = nodeEnv === 'test'

  const cfg = loadConfigJson()

  // === Puertos y URLs ===
  const backendPort = num('PORT', cfg.services?.backendPort ?? 3000)
  const realtimePort = num('REALTIME_PORT', cfg.services?.realtimePort ?? 3003)
  const printWorkerPort = num('PRINT_WORKER_PORT', cfg.services?.printWorkerPort ?? 3004)

  const backendUrl =
    str('BACKEND_URL', cfg.services?.backendUrl || `http://localhost:${backendPort}`)
  const realtimeInternalUrl =
    str('REALTIME_INTERNAL_URL', cfg.services?.realtimeInternalUrl || `http://localhost:${realtimePort}`)
  const realtimePublicUrl =
    str('NEXT_PUBLIC_REALTIME_URL', cfg.client?.publicRealtimeUrl || cfg.services?.realtimePublicUrl || '')
  const printWorkerUrl =
    str('PRINT_WORKER_URL', cfg.services?.printWorkerUrl || `http://localhost:${printWorkerPort}`)
  const realtimeEmitUrl =
    str('REALTIME_EMIT_URL', `${realtimeInternalUrl}/emit`)

  // === Cliente (NEXT_PUBLIC_*) ===
  const publicBackendUrl =
    str('NEXT_PUBLIC_BACKEND_URL', cfg.client?.publicBackendUrl || '')
  const publicPrintWorkerUrl =
    str('NEXT_PUBLIC_PRINT_WORKER_URL', cfg.client?.publicPrintWorkerUrl || '')

  // === CORS ===
  const allowedOrigins = csv(
    'ALLOWED_ORIGINS',
    cfg.cors?.allowedOrigins ?? (isDev ? ['http://localhost:3000'] : []),
  )

  // === Logging ===
  const consoleLevel = parseLogLevel(
    process.env.LOG_LEVEL_CONSOLE || process.env.LOG_LEVEL,
    cfg.logging?.consoleLevel ?? (isProd ? 'INFO' : 'DEBUG'),
  )
  const fileLevel = parseLogLevel(
    process.env.LOG_LEVEL_FILE,
    cfg.logging?.fileLevel ?? 'DEBUG',
  )
  // logDir: directorio BASE de logs. El logger añade '/logs' si no está incluido.
  // (compatibilidad con tests que setean LOG_DIR=tmpDir y esperan tmpDir/logs/).
  const logDirRaw = str('LOG_DIR', cfg.logging?.logDir ?? process.cwd())
  const logDir = logDirRaw.endsWith('/logs') || logDirRaw.endsWith('\\logs') || logDirRaw.endsWith('/logs/')
    ? logDirRaw
    : join(logDirRaw, 'logs')

  // === Auth ===
  const sessionTtlSeconds = num('SESSION_TTL_SECONDS', cfg.auth?.sessionTtlSeconds ?? 12 * 60 * 60)
  // COOKIE_SECURE: en prod default true, en dev default false.
  const cookieSecureDefault = isProd
  const cookieSecure = process.env.COOKIE_SECURE !== undefined
    ? bool('COOKIE_SECURE', cookieSecureDefault)
    : cookieSecureDefault

  // === DB ===
  const databaseUrl = str('DATABASE_URL', '')

  // === Print Worker ===
  const printWorkerIntervalMs = num(
    'PRINT_WORKER_INTERVAL_MS',
    cfg.printWorker?.intervalMs ?? 5000,
  )

  // === Demo ===
  const demoUsers = process.env.DEMO_USERS !== undefined
    ? bool('DEMO_USERS', !isProd)
    : !isProd

  return {
    nodeEnv,
    isDev,
    isProd,
    isTest,
    appName: str('NEXT_PUBLIC_APP_NAME', 'softlba'),
    appVersion: str('NEXT_PUBLIC_APP_VERSION', 'dev'),
    services: {
      backendUrl,
      backendPort,
      realtimeInternalUrl,
      realtimePublicUrl,
      realtimePort,
      printWorkerUrl,
      printWorkerPort,
      realtimeEmitUrl,
    },
    client: {
      publicBackendUrl,
      publicRealtimeUrl: realtimePublicUrl,
      publicPrintWorkerUrl,
    },
    cors: {
      allowedOrigins,
    },
    logging: {
      consoleLevel,
      fileLevel,
      logDir,
    },
    auth: {
      cookieSecure,
      sessionTtlSeconds,
    },
    databaseUrl,
    printWorker: {
      intervalMs: printWorkerIntervalMs,
    },
    demoUsers,
  }
}

export function getConfig(): AppConfig {
  if (!cachedConfig) {
    cachedConfig = buildConfig()
  }
  return cachedConfig
}

/** Reset cache (para tests). */
export function __resetConfig(): void {
  cachedConfig = null
}

// ============================================================
// Secretos (SOLO de env vars, NUNCA de config.json)
// ============================================================

export function getSecrets(): {
  nextauthSecret: string
  realtimeSecret: string
} {
  const nextauthSecret = process.env.NEXTAUTH_SECRET
  const realtimeSecret = process.env.REALTIME_SECRET

  if (!nextauthSecret && process.env.NODE_ENV === 'production') {
    throw new Error(
      'NEXTAUTH_SECRET no configurado. En producción es obligatorio (>= 16 chars).',
    )
  }
  if (!realtimeSecret && process.env.NODE_ENV === 'production') {
    throw new Error(
      'REALTIME_SECRET no configurado. En producción es obligatorio (>= 16 chars).',
    )
  }

  return {
    nextauthSecret: nextauthSecret || 'cuba-restaurante-secret-key-change-in-prod',
    realtimeSecret: realtimeSecret || 'dev-internal-secret-change-in-prod',
  }
}

// ============================================================
// Validación al cargar (modo dev)
// ============================================================

export function validateConfig(): { ok: boolean; warnings: string[]; errors: string[] } {
  const cfg = getConfig()
  const warnings: string[] = []
  const errors: string[] = []

  if (!cfg.databaseUrl) {
    errors.push('DATABASE_URL no configurado')
  }

  if (cfg.isProd) {
    if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET.length < 16) {
      errors.push('NEXTAUTH_SECRET debe tener >= 16 chars en producción')
    }
    if (!process.env.REALTIME_SECRET || process.env.REALTIME_SECRET.length < 16) {
      errors.push('REALTIME_SECRET debe tener >= 16 chars en producción')
    }
    if (cfg.cors.allowedOrigins.length === 0) {
      warnings.push('ALLOWED_ORIGINS vacío en producción — el realtime rechazará conexiones')
    }
    if (!cfg.client.publicRealtimeUrl) {
      warnings.push('NEXT_PUBLIC_REALTIME_URL vacío en producción — el browser no sabrá cómo conectar')
    }
  }

  if (cfg.services.backendPort === cfg.services.realtimePort) {
    errors.push(`Backend y Realtime no pueden usar el mismo puerto (${cfg.services.backendPort})`)
  }
  if (cfg.services.backendPort === cfg.services.printWorkerPort) {
    errors.push(`Backend y Print Worker no pueden usar el mismo puerto (${cfg.services.backendPort})`)
  }

  return { ok: errors.length === 0, warnings, errors }
}
