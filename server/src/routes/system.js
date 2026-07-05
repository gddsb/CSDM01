import { Router } from 'express'
import { list, detail, create, update, remove, toggle } from '../controllers/UserController.js'
import { list as roleList, create as roleCreate, update as roleUpdate, remove as roleRemove, getRolePermissions, assignPermissions } from '../controllers/RoleController.js'
import {
  list as permList,
  detail as permDetail,
  create as permCreate,
  update as permUpdate,
  remove as permRemove,
  userMenu,
} from '../controllers/PermissionController.js'
import { list as logList } from '../controllers/OperationLogController.js'
import { getConfig, saveConfig } from '../controllers/SystemConfigController.js'
import { authRequired, logOperation } from '../middleware/auth.js'

const router = Router()

// 所有系统管理路由都需要登录
router.use(authRequired)

// 用户管理
router.get('/users', logOperation('用户管理'), list)
router.get('/users/:id', logOperation('用户管理'), detail)
router.post('/users', logOperation('用户管理'), create)
router.put('/users/:id', logOperation('用户管理'), update)
router.delete('/users/:id', logOperation('用户管理'), remove)
router.post('/users/:id/toggle', logOperation('用户管理'), toggle)

// 角色管理
router.get('/roles', logOperation('角色管理'), roleList)
router.post('/roles', logOperation('角色管理'), roleCreate)
router.put('/roles/:id', logOperation('角色管理'), roleUpdate)
router.delete('/roles/:id', logOperation('角色管理'), roleRemove)

// 权限/菜单管理
router.get('/permissions', permList)
router.get('/permissions/tree', permList)
router.get('/permissions/menu', userMenu)
router.get('/permissions/:id', permDetail)
router.post('/permissions', logOperation('菜单管理'), permCreate)
router.put('/permissions/:id', logOperation('菜单管理'), permUpdate)
router.delete('/permissions/:id', logOperation('菜单管理'), permRemove)
router.get('/roles/:id/permissions', getRolePermissions)
router.put('/roles/:id/permissions', logOperation('角色权限分配'), assignPermissions)

// 操作日志
router.get('/logs', logList)

// 系统配置
router.get('/config', getConfig)
router.put('/config', logOperation('系统配置'), saveConfig)

export default router
