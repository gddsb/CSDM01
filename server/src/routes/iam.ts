/**
 * IAM 权限引擎 V2 控制器 — 统一入口
 *
 * 覆盖 4 张新表 CRUD + 扫描器运行 + 缓存清除
 * 所有路由挂 /api/iam/*
 */
import { Router } from 'express'
import { asyncHandler } from '../middleware/security.js'
import { authRequired } from '../middleware/auth.js'
import { requirePerm } from '../framework/permission/func/permissionMiddleware.js'
import * as iam from '../services/IamService.js'

const router = Router()

// ========== 业务对象字典 ==========
router.get('/business-objects', authRequired, requirePerm({ permCode: 'iam:business-object:view' }), asyncHandler(iam.listBusinessObjects))
router.post('/business-objects', authRequired, requirePerm({ permCode: 'iam:business-object:create' }), asyncHandler(iam.createBusinessObject))
router.put('/business-objects/:id', authRequired, requirePerm({ permCode: 'iam:business-object:update' }), asyncHandler(iam.updateBusinessObject))
router.delete('/business-objects/:id', authRequired, requirePerm({ permCode: 'iam:business-object:delete' }), asyncHandler(iam.deleteBusinessObject))

// ========== 数据维度字典 ==========
router.get('/data-dimensions', authRequired, requirePerm({ permCode: 'iam:data-dimension:view' }), asyncHandler(iam.listDataDimensions))
router.post('/data-dimensions', authRequired, requirePerm({ permCode: 'iam:data-dimension:create' }), asyncHandler(iam.createDataDimension))
router.put('/data-dimensions/:id', authRequired, requirePerm({ permCode: 'iam:data-dimension:update' }), asyncHandler(iam.updateDataDimension))
router.delete('/data-dimensions/:id', authRequired, requirePerm({ permCode: 'iam:data-dimension:delete' }), asyncHandler(iam.deleteDataDimension))

// ========== 数据权限规则 ==========
router.get('/data-scopes', authRequired, requirePerm({ permCode: 'iam:data-scope:view' }), asyncHandler(iam.listDataScopes))
router.post('/data-scopes', authRequired, requirePerm({ permCode: 'iam:data-scope:create' }), asyncHandler(iam.createDataScope))
router.put('/data-scopes/:id', authRequired, requirePerm({ permCode: 'iam:data-scope:update' }), asyncHandler(iam.updateDataScope))
router.delete('/data-scopes/:id', authRequired, requirePerm({ permCode: 'iam:data-scope:delete' }), asyncHandler(iam.deleteDataScope))

// ========== 业务状态规则 ==========
router.get('/biz-status-rules', authRequired, requirePerm({ permCode: 'iam:biz-status:view' }), asyncHandler(iam.listBizStatusRules))
router.post('/biz-status-rules', authRequired, requirePerm({ permCode: 'iam:biz-status:create' }), asyncHandler(iam.createBizStatusRule))
router.put('/biz-status-rules/:id', authRequired, requirePerm({ permCode: 'iam:biz-status:update' }), asyncHandler(iam.updateBizStatusRule))
router.delete('/biz-status-rules/:id', authRequired, requirePerm({ permCode: 'iam:biz-status:delete' }), asyncHandler(iam.deleteBizStatusRule))

// ========== 缓存管理 ==========
router.post('/cache/clear', authRequired, requirePerm({ permCode: 'iam:permission:update' }), asyncHandler(iam.clearPermCache))
router.get('/cache/stats', authRequired, asyncHandler(iam.getCacheStats))

export default router
