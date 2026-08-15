/**
 * 业务异常类。
 *
 * 用于在控制器/服务中抛出可预期的业务错误，
 * 由全局错误处理中间件统一转成标准响应格式。
 */
export class AppError extends Error {
  code: number
  statusCode: number

  constructor(message: string, code = 10000, statusCode = 400) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
    Object.setPrototypeOf(this, AppError.prototype)
  }
}
