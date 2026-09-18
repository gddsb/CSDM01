/**
 * 操作日志 Controller — DB 全走 OperationLogService
 */
import OperationLogService from '../services/OperationLogService.js'
import { success } from '../utils/response.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { rows, count } = await OperationLogService.list(req.query)
  return success(res, rows, '查询成功', count)
})

export default { list }
