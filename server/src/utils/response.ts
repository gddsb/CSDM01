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

function httpStatusToErrorCode(httpStatus: number): number {
  switch (httpStatus) {
    case 400: return ErrorCode.PARAM_INVALID
    case 401: return ErrorCode.UNAUTHORIZED
    case 403: return ErrorCode.PERMISSION_DENIED
    case 404: return ErrorCode.RECORD_NOT_FOUND
    case 409: return ErrorCode.DUPLICATE_REQUEST
    case 500: return ErrorCode.SYSTEM_ERROR
    default: return ErrorCode.BUSINESS_ERROR
  }
}

export function success(res: Response, data: any = null, message: string = '操作成功', total: number | null = null) {
  const result: any = { success: true, code: ErrorCode.SUCCESS, message, data }
  if (total !== null) result.total = total
  return res.json(result)
}

export function fail(res: Response, message: string = '操作失败', httpStatus: number = 400) {
  const code = httpStatusToErrorCode(httpStatus)
  return res.status(httpStatus).json({ success: false, code, message })
}

export function failWithCode(res: Response, message: string, errorCode: number = ErrorCode.BUSINESS_ERROR, httpStatus: number = 400) {
  return res.status(httpStatus).json({ success: false, code: errorCode, message })
}

export function paginate(res: Response, data: any, total: number, pageNum: number, pageSize: number, message: string = '获取成功') {
  return res.json({
    success: true,
    code: ErrorCode.SUCCESS,
    message,
    data,
    total,
    pageNum: Number(pageNum),
    pageSize: Number(pageSize),
  })
}
