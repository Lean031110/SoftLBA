import { z } from 'zod'

/**
 * Runtime configuration for server-side processes.  Do not expose this module
 * to client components: it may contain internal service URLs and secrets.
 */
const environmentSchema = z.object({
  SOFTLBA_ENV: z.enum(['development', 'testing', 'lan', 'production']).optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).optional(),
  APP_INTERNAL_URL: z.string().url().optional(),
  REALTIME_INTERNAL_URL: z.string().url().optional(),
  REALTIME_SERVICE_URL: z.string().url().optional(),
  PRINT_WORKER_URL: z.string().url().optional(),
  WEB_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  REALTIME_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  PRINT_WORKER_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  TRUSTED_PROXY_ORIGINS: z.string().optional(),
  NEXTAUTH_SECRET: z.string().min(16).optional(),
  REALTIME_SECRET: z.string().min(16).optional(),
})

export type RuntimeEnvironment = z.infer<typeof environmentSchema>

export function parseRuntimeEnvironment(input: Record<string, string | undefined> = process.env): RuntimeEnvironment {
  return environmentSchema.parse(input)
}

export function getRuntimeEnvironment(): RuntimeEnvironment {
  return parseRuntimeEnvironment()
}

export function requireRuntimeSecret(name: 'NEXTAUTH_SECRET' | 'REALTIME_SECRET'): string {
  const value = getRuntimeEnvironment()[name]
  if (!value) throw new Error(`${name} debe estar configurado (mínimo 16 caracteres).`)
  return value
}

export function requireRuntimeUrl(name: 'APP_INTERNAL_URL' | 'REALTIME_INTERNAL_URL' | 'REALTIME_SERVICE_URL' | 'PRINT_WORKER_URL'): string {
  const value = getRuntimeEnvironment()[name]
  if (!value) throw new Error(`${name} debe estar configurado como URL absoluta.`)
  return value
}

export function configuredOrigins(): string[] {
  const value = getRuntimeEnvironment().ALLOWED_ORIGINS
  return value ? value.split(',').map((origin) => origin.trim()).filter(Boolean) : []
}
