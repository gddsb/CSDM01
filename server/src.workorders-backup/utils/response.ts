import { Response } from 'express'

// 统一响应格式
export function success(res: Response, data: any = null, message: string = '操作成功', total: number | null = null) {
  const result: any = { success: true, message, data }
  if (total !== null) result.total = total
  return res.json(result)
}

export function fail(res: Response, message: string = '操作失败', code: number = 400) {
  return res.status(code).json({ success: false, message })
}

export function paginate(res: Response, data: any, total: number, pageNum: number, pageSize: number) {
  return res.json({
    success: true,
    data,
    total,
    pageNum: Number(pageNum),
    pageSize: Number(pageSize),
  })
}
