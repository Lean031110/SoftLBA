import { PrismaClient } from '@prisma/client'
import { getConfig } from '@/lib/config'

// FASE 3 (config centralizada): usar getConfig() en vez de process.env directo.
// - En DEV: solo WARN+ERROR a consola. queries a logs/prisma.log si LOG_LEVEL_FILE=DEBUG.
// - En PROD: solo WARN+ERROR a consola. Sin queries.
// Antes: log: ['query'] siempre → ruido masivo en prod.

const cfg = getConfig()
const enableQueryLog = cfg.isDev && cfg.logging.fileLevel === 'DEBUG'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const baseConfig: ConstructorParameters<typeof PrismaClient>[0] = {
    log: [
      { level: 'warn', emit: 'stdout' },
      { level: 'error', emit: 'stdout' },
    ],
  }

  if (enableQueryLog) {
    baseConfig.log!.push({ level: 'query', emit: 'stdout' })
  }

  return new PrismaClient(baseConfig)
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (cfg.isDev) globalForPrisma.prisma = db
