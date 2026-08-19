// ============================================================
// Logger estructurado — SoftLBA
// ============================================================
// FASE 3: Logger profesional con:
//   - 5 niveles: DEBUG, INFO, WARN, ERROR, FATAL.
//   - Redacción automática de secretos (password, token, cookie,
//     NEXTAUTH_SECRET, REALTIME_SECRET, authorization, passwordHash).
//   - Transport dual:
//       * Console (INFO+WARN+ERROR+FATAL solamente, con prefijo).
//       * File append (todos los niveles, un archivo por módulo).
//   - API: logger.{debug,info,warn,error,fatal}(msg, data?, module?).
//   - withContext(ctx) para sub-logger con contexto mergueado.
//
// Reglas de la consigna:
//   - NUNCA registrar contraseñas, cookies, tokens, NEXTAUTH_SECRET,
//     REALTIME_SECRET, hashes sensibles ni datos privados innecesarios.
//   - Terminal de desarrollo NO debe mostrar ruido de Prisma/Next.
//   - Archivos guardan TODOS los niveles.
//
// Uso:
//   import { logger } from '@/lib/logger'
//   logger.info('Pedido creado', { orderId: '123' }, 'orders')
//   logger.error('DB falló', { err: e.message }, 'api')
//   const log = logger.withContext({ requestId: 'abc' })
//   log.warn('Stock bajo', { productId: 'p-9' })
// ============================================================

import { appendFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { getConfig } from '@/lib/config'

// FASE 3 (config centralizada): leer niveles y logDir de getConfig().
const _cfg = getConfig()
const CONSOLE_MIN_LEVEL = _cfg.logging.consoleLevel
const FILE_MIN_LEVEL = _cfg.logging.fileLevel

// ============================================================
// Niveles
// ============================================================

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
  FATAL: 50,
}

const ALL_LEVELS: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']

function parseMinLevel(env?: string): LogLevel {
  if (!env) return process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG'
  const upper = env.toUpperCase() as LogLevel
  if (ALL_LEVELS.includes(upper)) return upper
  return 'INFO'
}

// (CONSOLE_MIN_LEVEL y FILE_MIN_LEVEL se definen arriba desde getConfig().)

// ============================================================
// Redacción de secretos
// ============================================================

const SENSITIVE_KEY_PATTERNS = [
  /^password$/i,
  /^passwordHash$/i,
  /^newPassword$/i,
  /^oldPassword$/i,
  /^currentPassword$/i,
  /^secret$/i,
  /^token$/i,
  /^accessToken$/i,
  /^refreshToken$/i,
  /^authToken$/i,
  /^sessionToken$/i,
  /^socketToken$/i,
  /^cookie$/i,
  /^cookies$/i,
  /^authorization$/i,
  /^nextauth_secret$/i,
  /^realtime_secret$/i,
  /^apiKey$/i,
  /^apiSecret$/i,
  /^privateKey$/i,
  /^credential$/i,
  /^credentials$/i,
]

const SENSITIVE_VALUE_PATTERNS = [
  // Bearer tokens
  /Bearer\s+[A-Za-z0-9\-._~+\/]+=*/g,
  // JWT (3 partes separadas por .)
  /eyJ[A-Za-z0-9_\-]+\.eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/g,
  // Headers Authorization completos
  /authorization:\s*[^\s,]+/gi,
  // Contraseñas en URLs (postgres://user:pass@host)
  /:\/\/[^:\/]+:[^@]+@/g,
]

const REDACTED = '[REDACTED]'

function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 10) return REDACTED // prevención de ciclos
  if (value === null || value === undefined) return value
  if (typeof value === 'string') {
    let redacted = value
    for (const pattern of SENSITIVE_VALUE_PATTERNS) {
      redacted = redacted.replace(pattern, REDACTED)
    }
    return redacted
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return value
  }
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Error) {
    // Incluir propiedades extra adjuntas al Error (p. ej. err.token = ...),
    // además de name/message/stack. Redacta recursivamente.
    const out: Record<string, unknown> = {
      name: value.name,
      message: redactValue(value.message, depth + 1),
    }
    if (value.stack) {
      out.stack = redactValue(value.stack, depth + 1)
    }
    // Propiedades no estándar (adjuntas dinámicamente).
    for (const [k, v] of Object.entries(value as any)) {
      if (['name', 'message', 'stack'].includes(k)) continue
      if (SENSITIVE_KEY_PATTERNS.some((p) => p.test(k))) {
        out[k] = REDACTED
      } else {
        out[k] = redactValue(v, depth + 1)
      }
    }
    return out
  }
  if (Array.isArray(value)) {
    return value.map((v) => redactValue(v, depth + 1))
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERNS.some((p) => p.test(k))) {
        out[k] = REDACTED
      } else {
        out[k] = redactValue(v, depth + 1)
      }
    }
    return out
  }
  return value
}

// ============================================================
// Archivos por módulo
// ============================================================

function getLogDir(): string {
  // FASE 3 (config centralizada): LOG_DIR de getConfig(), pero permitir
  // override via process.env.LOG_DIR en runtime (para tests).
  // getConfig() ya resuelve el path final (con /logs añadido si no lo tenía).
  if (process.env.LOG_DIR) {
    // Compatibilidad tests: si LOG_DIR no termina en /logs, añadirlo.
    const d = process.env.LOG_DIR
    return d.endsWith('/logs') || d.endsWith('\\logs') || d.endsWith('/logs/') ? d : join(d, 'logs')
  }
  return getConfig().logging.logDir
}

function ensureLogDir(logDir: string) {
  if (!existsSync(logDir)) {
    try {
      mkdirSync(logDir, { recursive: true })
    } catch {
      // No podemos hacer nada si no se puede crear (p. ej. read-only fs).
    }
  }
}

function fileForModule(module: string | undefined, logDir: string): string {
  const safe = (module || 'backend').toLowerCase().replace(/[^a-z0-9_-]/g, '')
  return join(logDir, `${safe || 'backend'}.log`)
}

function appendLog(filePath: string, line: string, logDir: string) {
  try {
    ensureLogDir(logDir)
    appendFileSync(filePath, line + '\n')
  } catch {
    // Silenciar: si no podemos escribir log, no debemos romper la app.
  }
}

// ============================================================
// Formato
// ============================================================

interface LogEntry {
  timestamp: string
  level: LogLevel
  module: string
  message: string
  data?: unknown
}

function formatJson(entry: LogEntry): string {
  return JSON.stringify(entry)
}

function formatConsole(entry: LogEntry): string {
  const { timestamp, level, module: mod, message } = entry
  // Formato: 2026-08-18T14:21:03Z [WARN] [printer] Cocina-01 timeout 5000ms
  const dataStr = entry.data !== undefined ? ' ' + JSON.stringify(entry.data) : ''
  return `${timestamp} [${level}] [${mod}] ${message}${dataStr}`
}

// ============================================================
// Logger principal
// ============================================================

function log(
  level: LogLevel,
  message: string,
  data?: unknown,
  module?: string,
  context?: Record<string, unknown>,
) {
  // Si ambos niveles filtran, no hacer nada.
  const priority = LEVEL_PRIORITY[level]
  const toConsole = priority >= LEVEL_PRIORITY[CONSOLE_MIN_LEVEL]
  const toFile = priority >= LEVEL_PRIORITY[FILE_MIN_LEVEL]
  if (!toConsole && !toFile) return

  const mod = module || 'backend'
  const redactedData = data !== undefined ? redactValue(data) : undefined
  const merged = context ? { ...context, ...(redactedData as object) } : redactedData

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    module: mod,
    message,
    ...(merged !== undefined ? { data: merged } : {}),
  }

  // Archivo (todos los niveles, JSON)
  if (toFile) {
    const logDir = getLogDir()
    appendLog(fileForModule(mod, logDir), formatJson(entry), logDir)
  }

  // Consola (filtrada, formato legible)
  if (toConsole) {
    const line = formatConsole(entry)
    switch (level) {
      case 'DEBUG':
        console.debug(line)
        break
      case 'INFO':
        console.info(line)
        break
      case 'WARN':
        console.warn(line)
        break
      case 'ERROR':
      case 'FATAL':
        console.error(line)
        break
    }
  }
}

export interface Logger {
  debug(message: string, data?: unknown, module?: string): void
  info(message: string, data?: unknown, module?: string): void
  warn(message: string, data?: unknown, module?: string): void
  error(message: string, data?: unknown, module?: string): void
  fatal(message: string, data?: unknown, module?: string): void
  withContext(context: Record<string, unknown>): Logger
}

function createLogger(context?: Record<string, unknown>): Logger {
  return {
    debug: (msg, data, mod) => log('DEBUG', msg, data, mod, context),
    info: (msg, data, mod) => log('INFO', msg, data, mod, context),
    warn: (msg, data, mod) => log('WARN', msg, data, mod, context),
    error: (msg, data, mod) => log('ERROR', msg, data, mod, context),
    fatal: (msg, data, mod) => log('FATAL', msg, data, mod, context),
    withContext: (ctx) => createLogger({ ...(context || {}), ...ctx }),
  }
}

export const logger: Logger = createLogger()

// ============================================================
// API auxiliar para tests
// ============================================================

export const __test__ = {
  redactValue,
  LEVEL_PRIORITY,
  CONSOLE_MIN_LEVEL,
  FILE_MIN_LEVEL,
  formatJson,
  formatConsole,
  parseMinLevel,
  SENSITIVE_KEY_PATTERNS,
}
