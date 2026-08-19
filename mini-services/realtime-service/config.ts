// mini-services/realtime-service/config.ts
// ============================================================
// Configuración centralizada del mini-servicio Realtime.
// ============================================================
// Este mini-servicio corre como proceso Bun independiente y NO puede
// importar de src/lib/config (está fuera de su tree de módulos).
// Por eso tiene su propio módulo de config que lee las mismas env vars.
//
// Reglas (igual que src/lib/config/index.ts):
//   1. NUNCA hardcodear IPs, puertos, URLs, dominios, CORS, proxies.
//   2. TODO viene de variables de entorno (.env) o de config.json.
//   3. Los secretos (NEXTAUTH_SECRET, REALTIME_SECRET) SOLO de env vars.
//   4. Validación al cargar.
// ============================================================

import { readFileSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(__dirname, '..', '..') // raíz del proyecto SoftLBA

interface ConfigFile {
  services?: {
    realtimePort?: number
    realtimeInternalUrl?: string
  }
  cors?: {
    allowedOrigins?: string[]
  }
}

function loadConfigJson(): ConfigFile {
  const configPath = process.env.CONFIG_PATH || join(ROOT, 'config.json')
  if (!existsSync(configPath)) return {}
  try {
    return JSON.parse(readFileSync(configPath, 'utf8')) as ConfigFile
  } catch {
    return {}
  }
}

function parseNodeEnv(): 'development' | 'test' | 'production' {
  if (process.env.NODE_ENV === 'production') return 'production'
  if (process.env.NODE_ENV === 'test') return 'test'
  return 'development'
}

const nodeEnv = parseNodeEnv()
const isDev = nodeEnv === 'development'
const isProd = nodeEnv === 'production'

const cfg = loadConfigJson()

function csv(name: string, fallback: string[] = []): string[] {
  const v = process.env[name]
  if (!v) return fallback
  return v.split(',').map((s) => s.trim()).filter(Boolean)
}

function num(name: string, fallback: number): number {
  const v = process.env[name]
  if (!v) return fallback
  const n = parseInt(v, 10)
  return Number.isNaN(n) ? fallback : n
}

export const config = {
  nodeEnv,
  isDev,
  isProd,

  services: {
    realtimePort: num('REALTIME_PORT', cfg.services?.realtimePort ?? 3003),
  },

  cors: {
    allowedOrigins: csv(
      'ALLOWED_ORIGINS',
      cfg.cors?.allowedOrigins ?? (isDev ? ['http://localhost:3000'] : []),
    ),
  },
}

export function getSecrets(): {
  nextauthSecret: string
  realtimeSecret: string
} {
  const nextauthSecret = process.env.NEXTAUTH_SECRET
  const realtimeSecret = process.env.REALTIME_SECRET

  if (!nextauthSecret && isProd) {
    throw new Error(
      'NEXTAUTH_SECRET no configurado. En producción es obligatorio (>= 16 chars).',
    )
  }
  if (!realtimeSecret && isProd) {
    throw new Error(
      'REALTIME_SECRET no configurado. En producción es obligatorio (>= 16 chars).',
    )
  }

  return {
    nextauthSecret: nextauthSecret || 'cuba-restaurante-secret-key-change-in-prod',
    realtimeSecret: realtimeSecret || 'dev-internal-secret-change-in-prod',
  }
}

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true // Same-origin o curl (sin Origin header).
  if (config.cors.allowedOrigins.includes(origin)) return true
  // En dev, permitir cualquier subdominio de space-z.ai y chatglm.cn
  // (preview sandbox).
  if (isDev) {
    if (origin.endsWith('.space-z.ai') || origin.endsWith('.chatglm.cn')) {
      return true
    }
    if (origin.startsWith('https://') && origin.includes('localhost')) {
      return true
    }
  }
  return false
}
