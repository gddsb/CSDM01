const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }
const currentLevel = LOG_LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase() as keyof typeof LOG_LEVELS] ?? LOG_LEVELS.info

function shouldLog(level: number): boolean {
  return level >= currentLevel
}

function format(level: string, args: any[]): string {
  const ts = new Date().toISOString()
  const parts = args.map((a) => {
    if (typeof a === 'object' && a !== null) {
      try { return JSON.stringify(a) } catch { return String(a) }
    }
    return String(a)
  })
  return `[${ts}] [${level.toUpperCase()}] ${parts.join(' ')}`
}

export const logger = {
  debug: (...args: any[]) => {
    if (shouldLog(LOG_LEVELS.debug)) console.debug(format('debug', args))
  },
  info: (...args: any[]) => {
    if (shouldLog(LOG_LEVELS.info)) console.info(format('info', args))
  },
  warn: (...args: any[]) => {
    if (shouldLog(LOG_LEVELS.warn)) console.warn(format('warn', args))
  },
  error: (...args: any[]) => {
    if (shouldLog(LOG_LEVELS.error)) console.error(format('error', args))
  },
}

export default logger
