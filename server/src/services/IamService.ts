/**
 * IAM Service — 权限引擎 V2 核心业务层
 * 所有 CRUD 下沉到此，Controller 保持薄
 */
import { BusinessObject, DataDimension, DataScope, BizStatusRule } from '../models/index.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import { Sequelize, Op } from 'sequelize'
import {
  onBusinessObjectChange,
  onDataDimensionChange,
  onDataScopeChange,
  onBizStatusRuleChange,
  cacheStats as cacheStatsFn,
} from '../framework/permission/cache/permissionCache.js'
import logger from '../utils/logger.js'
import type { Request, Response } from 'express'

// ============================================================================
// 通用分页参数解析
// ============================================================================
function parsePagination(query: any) {
  const page = Math.max(1, Number(query.page ?? 1))
  const pageSize = Math.min(200, Number(query.pageSize ?? 20))
  return { page, pageSize, offset: (page - 1) * pageSize, limit: pageSize }
}

// ============================================================================
// 业务对象字典
// ============================================================================

export async function listBusinessObjects(req: Request, res: Response) {
  const { page, offset, limit } = parsePagination(req.query)
  const where: any = {}
  if (req.query.module) where.module = req.query.module
  if (req.query.status !== undefined && req.query.status !== '') where.status = req.query.status

  const { rows, count } = await BusinessObject.findAndCountAll({
    where,
    order: [['sort_order', 'ASC'], ['obj_id', 'ASC']],
    offset, limit,
  })
  return success(res, { rows, page, pageSize: limit }, '查询成功', count)
}

export async function createBusinessObject(req: Request, res: Response) {
  const rec = await BusinessObject.create(req.body)
  onBusinessObjectChange()
  return success(res, rec, '创建成功')
}

export async function updateBusinessObject(req: Request, res: Response) {
  const id = Number(req.params.id)
  const [rows] = await BusinessObject.update(req.body, { where: { obj_id: id } })
  if (!rows) return fail(res, '记录不存在', ErrorCode.RECORD_NOT_FOUND)
  onBusinessObjectChange()
  return success(res, null, '修改成功')
}

export async function deleteBusinessObject(req: Request, res: Response) {
  const id = Number(req.params.id)
  await BusinessObject.destroy({ where: { obj_id: id } })
  onBusinessObjectChange()
  return success(res, null, '删除成功')
}

// ============================================================================
// 数据维度字典
// ============================================================================

export async function listDataDimensions(req: Request, res: Response) {
  const { page, offset, limit } = parsePagination(req.query)
  const { rows, count } = await DataDimension.findAndCountAll({
    order: [['sort_order', 'ASC'], ['dim_id', 'ASC']],
    offset, limit,
  })
  return success(res, { rows, page, pageSize: limit }, '查询成功', count)
}

export async function createDataDimension(req: Request, res: Response) {
  const rec = await DataDimension.create(req.body)
  onDataDimensionChange()
  return success(res, rec, '创建成功')
}

export async function updateDataDimension(req: Request, res: Response) {
  const id = Number(req.params.id)
  const [rows] = await DataDimension.update(req.body, { where: { dim_id: id } })
  if (!rows) return fail(res, '记录不存在', ErrorCode.RECORD_NOT_FOUND)
  onDataDimensionChange()
  return success(res, null, '修改成功')
}

export async function deleteDataDimension(req: Request, res: Response) {
  const id = Number(req.params.id)
  await DataDimension.destroy({ where: { dim_id: id } })
  onDataDimensionChange()
  return success(res, null, '删除成功')
}

// ============================================================================
// 数据权限规则
// ============================================================================

export async function listDataScopes(req: Request, res: Response) {
  const { page, offset, limit } = parsePagination(req.query)
  const where: any = {}
  if (req.query.obj_code) where.obj_code = req.query.obj_code
  if (req.query.role_id) where.role_id = req.query.role_id
  if (req.query.user_id) where.user_id = req.query.user_id

  const { rows, count } = await DataScope.findAndCountAll({
    where,
    order: [['scope_id', 'ASC']],
    offset, limit,
  })
  return success(res, { rows, page, pageSize: limit }, '查询成功', count)
}

export async function createDataScope(req: Request, res: Response) {
  const rec = await DataScope.create(req.body)
  onDataScopeChange(undefined, req.body.role_id)
  return success(res, rec, '创建成功')
}

export async function updateDataScope(req: Request, res: Response) {
  const id = Number(req.params.id)
  const [rows] = await DataScope.update(req.body, { where: { scope_id: id } })
  if (!rows) return fail(res, '记录不存在', ErrorCode.RECORD_NOT_FOUND)
  onDataScopeChange()
  return success(res, null, '修改成功')
}

export async function deleteDataScope(req: Request, res: Response) {
  const id = Number(req.params.id)
  await DataScope.destroy({ where: { scope_id: id } })
  onDataScopeChange()
  return success(res, null, '删除成功')
}

// ============================================================================
// 业务状态规则
// ============================================================================

export async function listBizStatusRules(req: Request, res: Response) {
  const { page, offset, limit } = parsePagination(req.query)
  const where: any = {}
  if (req.query.obj_code) where.obj_code = req.query.obj_code

  const { rows, count } = await BizStatusRule.findAndCountAll({
    where,
    order: [['sort_order', 'ASC'], ['rule_id', 'ASC']],
    offset, limit,
  })
  return success(res, { rows, page, pageSize: limit }, '查询成功', count)
}

export async function createBizStatusRule(req: Request, res: Response) {
  const rec = await BizStatusRule.create(req.body)
  onBizStatusRuleChange(req.body.obj_code, req.body.operate_key)
  return success(res, rec, '创建成功')
}

export async function updateBizStatusRule(req: Request, res: Response) {
  const id = Number(req.params.id)
  const [rows] = await BizStatusRule.update(req.body, { where: { rule_id: id } })
  if (!rows) return fail(res, '记录不存在', ErrorCode.RECORD_NOT_FOUND)
  onBizStatusRuleChange()
  return success(res, null, '修改成功')
}

export async function deleteBizStatusRule(req: Request, res: Response) {
  const id = Number(req.params.id)
  const rule = await BizStatusRule.findByPk(id)
  await BizStatusRule.destroy({ where: { rule_id: id } })
  if (rule) onBizStatusRuleChange((rule as any).obj_code, (rule as any).operate_key)
  return success(res, null, '删除成功')
}

// ============================================================================
// 缓存管理
// ============================================================================
import { clearAllCache } from '../framework/permission/cache/permissionCache.js'

export async function clearPermCache(req: Request, res: Response) {
  clearAllCache()
  return success(res, null, '权限引擎缓存已全部清除')
}

export async function getCacheStats(req: Request, res: Response) {
  return success(res, cacheStatsFn(), '缓存状态')
}
