import { Response } from 'express'

export enum ErrorCode {
  SUCCESS = 0,
  PARAM_INVALID = 10001,
  RECORD_NOT_FOUND = 10002,
  DUPLICATE_REQUEST = 10003,
  PERMISSION_DENIED = 10004,
  UNAUTHORIZED = 10005,
  BUSINESS_ERROR = 20001,
  SYSTEM_ERROR = 50000,
}

function errorCodeToHttpStatus(errorCode: number): number {
  switch (errorCode) {
    case ErrorCode.PARAM_INVALID: return 400
    case ErrorCode.UNAUTHORIZED: return 401
    case ErrorCode.PERMISSION_DENIED: return 403
    case ErrorCode.RECORD_NOT_FOUND: return 404
    case ErrorCode.DUPLICATE_REQUEST: return 409
    case ErrorCode.SYSTEM_ERROR: return 500
    default: return 400
  }
}

export function success(res: Response, data: any = null, message: string = '操作成功', total: number | null = null) {
  const result: any = { success: true, code: ErrorCode.SUCCESS, message, data }
  if (total !== null) result.total = total
  return res.json(result)
}

export function fail(res: Response, message: string = '操作失败', errorCode: number = ErrorCode.PARAM_INVALID, httpStatus?: number) {
  const status = httpStatus ?? errorCodeToHttpStatus(errorCode)
  return res.status(status).json({ success: false, code: errorCode, message })
}

export const MAX_PAGE_SIZE = 200

export function paginate(res: Response, data: any, total: number, pageNum: number, pageSize: number, message: string = '获取成功') {
  const safePageSize = Math.min(Number(pageSize), MAX_PAGE_SIZE)
  return res.json({
    success: true,
    code: ErrorCode.SUCCESS,
    message,
    data,
    total,
    pageNum: Number(pageNum),
    pageSize: safePageSize,
  })
}
