/**
 * 前端轻量 Logger —— 开发环境保留 info/debug，生产仅 warn/error
 *
 * 规范：所有前端错误/告警日志统一用此工具，禁止直接 console.error
 */

const IS_PROD = import.meta.env.PROD

function format(...args: any[]): string[] {
  // 给首参数加时间戳前缀
  const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  const tag = `[${ts}]`
  if (typeof args[0] === 'string') {
    return [tag, args[0], ...args.slice(1)]
  }
  return [tag, ...args]
}

export const logger = {
  /** 调试信息 —— 仅开发环境输出 */
  debug(...args: any[]) {
    if (IS_PROD) return
    // eslint-disable-next-line no-console
    console.debug(...format(...args))
  },

  /** 一般信息 —— 仅开发环境输出 */
  info(...args: any[]) {
    if (IS_PROD) return
    // eslint-disable-next-line no-console
    console.log(...format(...args))
  },

  /** 警告 —— 全环境输出（含生产） */
  warn(...args: any[]) {
    // eslint-disable-next-line no-console
    console.warn(...format(...args))
  },

  /** 错误 —— 全环境输出（含生产） */
  error(...args: any[]) {
    // eslint-disable-next-line no-console
    console.error(...format(...args))
  },
}

export default logger
