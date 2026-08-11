// ============================================================
// Logger estructurado - SoftLBA
// ============================================================
// Sistema de logging con niveles: DEBUG, INFO, WARN, ERROR
// Formato JSON para fácil parsing
// ============================================================

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
}

const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG')

function formatLog(level: LogLevel, message: string, data?: any): string {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(data ? { data } : {}),
  }
  return JSON.stringify(entry)
}

export const logger = {
  debug(message: string, data?: any) {
    if (LEVEL_PRIORITY[MIN_LEVEL] <= LEVEL_PRIORITY.DEBUG) {
      console.debug(formatLog('DEBUG', message, data))
    }
  },

  info(message: string, data?: any) {
    if (LEVEL_PRIORITY[MIN_LEVEL] <= LEVEL_PRIORITY.INFO) {
      console.info(formatLog('INFO', message, data))
    }
  },

  warn(message: string, data?: any) {
    if (LEVEL_PRIORITY[MIN_LEVEL] <= LEVEL_PRIORITY.WARN) {
      console.warn(formatLog('WARN', message, data))
    }
  },

  error(message: string, data?: any) {
    if (LEVEL_PRIORITY[MIN_LEVEL] <= LEVEL_PRIORITY.ERROR) {
      console.error(formatLog('ERROR', message, data))
    }
  },

  // Logger con contexto (para requests)
  withContext(context: Record<string, any>) {
    return {
      debug: (msg: string, data?: any) => logger.debug(msg, { ...context, ...data }),
      info: (msg: string, data?: any) => logger.info(msg, { ...context, ...data }),
      warn: (msg: string, data?: any) => logger.warn(msg, { ...context, ...data }),
      error: (msg: string, data?: any) => logger.error(msg, { ...context, ...data }),
    }
  },
}
