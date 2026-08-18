import { PrismaClient } from '@prisma/client'

// FASE 3: Ruido de Prisma reducido.
// - En DEV: solo WARN+ERROR a consola. queries a logs/prisma.log si LOG_LEVEL=DEBUG.
// - En PROD: solo WARN+ERROR a consola. Sin queries.
// Antes: log: ['query'] siempre → ruido masivo en prod.

const isDev = process.env.NODE_ENV !== 'production'
const enableQueryLog = isDev && process.env.LOG_LEVEL_FILE === 'DEBUG'

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

if (isDev) globalForPrisma.prisma = db
