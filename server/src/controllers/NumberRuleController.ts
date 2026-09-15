/**
 * 编号规则 Controller — 全部逻辑下沉 NumberRuleService
 * 保留 named export 兼容 routes/basic.ts + app.ts/init-db.ts 的直接引用
 */
import NumberRuleService from '../services/NumberRuleService.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import { asyncHandler } from '../middleware/security.js'
import type { Request, Response } from 'express'

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { rows, count } = await NumberRuleService.list(req.query)
  return success(res, rows, '查询成功', count)
})

export const detail = asyncHandler(async (req: Request, res: Response) => {
  const rule = await NumberRuleService.detail(Number(req.params.id))
  return success(res, rule, '查询成功')
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const rule = await NumberRuleService.create(req.body, (req as any).user)
  return success(res, rule, '创建成功')
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { rule, message } = await NumberRuleService.update(Number(req.params.id), req.body)
  return success(res, rule, message)
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await NumberRuleService.remove(Number(req.params.id))
  return success(res, null, '删除成功')
})

export const toggle = asyncHandler(async (req: Request, res: Response) => {
  const { rule, message } = await NumberRuleService.toggle(Number(req.params.id))
  return success(res, rule, message)
})

export const audit = asyncHandler(async (req: Request, res: Response) => {
  const rule = await NumberRuleService.audit(Number(req.params.id))
  return success(res, rule, '审核成功，规则已锁定使用')
})

export const preview = asyncHandler(async (req: Request, res: Response) => {
  const data = await NumberRuleService.preview(Number(req.params.id))
  return success(res, data, '预览成功')
})

/** 启动时 backfill 系统内置规则（app.ts / init-db.ts 直接调用） */
export async function initDefaultRules() {
  await NumberRuleService.initDefaultRules()
}

export default {
  list,
  detail,
  create,
  update,
  remove,
  toggle,
  audit,
  preview,
  initDefaultRules,
}
