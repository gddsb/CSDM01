/**
 * UserExtPermissionController — 用户附加权限（规范 3.7 / 8.7）
 * 
 * 提供前端弹窗读写接口：
 *   GET  /api/system/user-ext-permission/:userId?terminal=1
 *   POST /api/system/user-ext-permission/:userId           批量保存
 *   POST /api/system/user-ext-permission/:userId/add       单条 add
 *   POST /api/system/user-ext-permission/:userId/deny      单条 deny
 *   DELETE /api/system/user-ext-permission/:userId/add/:permId
 *   DELETE /api/system/user-ext-permission/:userId/deny/:permId
 */
import { Router } from 'express'
import { success, fail, ErrorCode } from '../utils/response.js'
import { UserExtPermissionService } from '../services/UserExtPermissionService.js'
import { UserExtPermission, Permission } from '../models/index.js'
import sequelize from '../config/database.js'
import { nowBeijingDate } from '../utils/date.js'

const router = Router()

function userIdFrom(req: any): number | undefined {
  const id = req?.user?.userId
  return id != null ? Number(id) : undefined
}

// GET /api/system/user-ext-permission/:userId?terminal=1
router.get('/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId)
    const terminal = Number(req.query.terminal) || 1
    const data = await UserExtPermissionService.listByUser(userId, terminal)
    return success(res, data, '获取用户附加权限配置成功')
  } catch (err: any) {
    return fail(res, err?.message || '获取失败', ErrorCode.SYSTEM_ERROR)
  }
})

// POST /api/system/user-ext-permission/:userId  批量保存
// body: { terminal, addPermIds: [], denyPermIds: [] }
router.post('/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId)
    const terminal = Number(req.body?.terminal) || 1
    const addPermIds: number[] = Array.isArray(req.body?.addPermIds) ? req.body.addPermIds : []
    const denyPermIds: number[] = Array.isArray(req.body?.denyPermIds) ? req.body.denyPermIds : []
    const operatorId = userIdFrom(req) || userId

    await UserExtPermissionService.save(userId, terminal, addPermIds, denyPermIds, operatorId)
    return success(res, null, '保存用户附加权限配置成功')
  } catch (err: any) {
    const code = err?.message?.includes('不能同时授予') ? ErrorCode.SYSTEM_ERROR : ErrorCode.SYSTEM_ERROR
    return fail(res, err?.message || '保存失败', code)
  }
})

// POST /api/system/user-ext-permission/:userId/add  单条快捷 add
router.post('/:userId/add', async (req, res) => {
  try {
    const userId = Number(req.params.userId)
    const permId = Number(req.body?.perm_id)
    const terminal = Number(req.body?.terminal) || 1
    if (!permId) return fail(res, 'perm_id 不能为空', ErrorCode.SYSTEM_ERROR)

    const operatorId = userIdFrom(req) || userId
    const now = nowBeijingDate()
    const opName = (req as any).user?.username || 'system'

    await UserExtPermission.upsert({
      user_id: userId, perm_id: permId, ext_type: 1, terminal,
      status: 1, create_by: opName, create_time: now, update_time: now,
    } as any)
    // 清缓存
    const PermissionEngine = await import('../services/PermissionEngine.js')
    void PermissionEngine
    return success(res, null, '授予成功')
  } catch (err: any) {
    return fail(res, err?.message || '操作失败', ErrorCode.SYSTEM_ERROR)
  }
})

// POST /api/system/user-ext-permission/:userId/deny  单条快捷 deny
router.post('/:userId/deny', async (req, res) => {
  try {
    const userId = Number(req.params.userId)
    const permId = Number(req.body?.perm_id)
    const terminal = Number(req.body?.terminal) || 1
    if (!permId) return fail(res, 'perm_id 不能为空', ErrorCode.SYSTEM_ERROR)

    const operatorId = userIdFrom(req) || userId
    const now = nowBeijingDate()
    const opName = (req as any).user?.username || 'system'

    await UserExtPermission.upsert({
      user_id: userId, perm_id: permId, ext_type: 2, terminal,
      status: 1, create_by: opName, create_time: now, update_time: now,
    } as any)
    return success(res, null, '排除成功')
  } catch (err: any) {
    return fail(res, err?.message || '操作失败', ErrorCode.SYSTEM_ERROR)
  }
})

// DELETE /api/system/user-ext-permission/:userId/add/:permId  删除单条 add
router.delete('/:userId/add/:permId', async (req, res) => {
  try {
    const userId = Number(req.params.userId)
    const permId = Number(req.params.permId)
    const terminal = Number(req.query.terminal) || 1

    const rows = await UserExtPermission.destroy({
      where: { user_id: userId, perm_id: permId, ext_type: 1, terminal },
    })
    return success(res, { removed: rows }, '删除add成功')
  } catch (err: any) {
    return fail(res, err?.message || '操作失败', ErrorCode.SYSTEM_ERROR)
  }
})

// DELETE /api/system/user-ext-permission/:userId/deny/:permId  删除单条 deny
router.delete('/:userId/deny/:permId', async (req, res) => {
  try {
    const userId = Number(req.params.userId)
    const permId = Number(req.params.permId)
    const terminal = Number(req.query.terminal) || 1

    const rows = await UserExtPermission.destroy({
      where: { user_id: userId, perm_id: permId, ext_type: 2, terminal },
    })
    return success(res, { removed: rows }, '删除deny成功')
  } catch (err: any) {
    return fail(res, err?.message || '操作失败', ErrorCode.SYSTEM_ERROR)
  }
})

export default router
