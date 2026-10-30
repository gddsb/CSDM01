import { Router } from 'express'
import { asyncHandler } from '../middleware/security.js'
import multer from 'multer'
import { list, detail, create, update, remove, toggle, uploadMyAvatar, setMyAvatar, updateMyProfile } from '../controllers/UserController.js'
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
import { list as systemLogList } from '../controllers/SystemLogController.js'
import { getConfig, saveConfig, migrateDatabase, getMigrationTargets, listDataDictionary, refreshDataDictionary, getRefreshProgress } from '../controllers/SystemConfigController.js'
import { getEnvironment, restartServer } from '../modules/system-config/EnvironmentController.js'
import { getDatabaseInfo, listBackups, createBackup, restoreBackup, deleteBackup, listTableRecords } from '../modules/system-config/DatabaseController.js'
import { authRequired, logOperation, permissionRequired } from '../middleware/auth.js'
import {
  listType as dictTypeList,
  getType as dictTypeGet,
  createType as dictTypeCreate,
  updateType as dictTypeUpdate,
  removeType as dictTypeRemove,
  listData as dictDataList,
  listDataByType,
  getData as dictDataGet,
  createData as dictDataCreate,
  updateData as dictDataUpdate,
  removeData as dictDataRemove,
} from '../controllers/DictController.js'
import { listDirectory, removeItem } from '../controllers/FileManagerController.js'
import { getUserSettings, saveUserSetting, batchSaveUserSettings } from '../controllers/UserSettingController.js'

const router = Router()

// 头像上传 multer 配置（内存存储到 tmp，控制器再持久化）
const avatarUpload = multer({
  dest: 'uploads/tmp/',
  limits: { fileSize: 2 * 1024 * 1024 },  // 2MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('请上传图片格式的文件'))
    }
    cb(null, true)
  },
})

// 所有系统管理路由都需要登录
router.use(authRequired)

// 当前用户头像与个人信息（放在 /users/:id 之前避免被匹配）
router.post('/users/me/avatar', avatarUpload.single('avatar'), asyncHandler(uploadMyAvatar))
router.put('/users/me/avatar', asyncHandler(setMyAvatar))
router.put('/users/me/profile', asyncHandler(updateMyProfile))

// 用户管理
router.get('/users', permissionRequired('system:user'), logOperation('用户管理'), asyncHandler(list))
router.get('/users/:id', permissionRequired('system:user'), logOperation('用户管理'), asyncHandler(detail))
router.post('/users', permissionRequired('system:user:create'), logOperation('用户管理'), asyncHandler(create))
router.put('/users/:id', permissionRequired('system:user:update'), logOperation('用户管理'), asyncHandler(update))
router.delete('/users/:id', permissionRequired('system:user:delete'), logOperation('用户管理'), asyncHandler(remove))
router.post('/users/:id/toggle', permissionRequired('system:user:toggle'), logOperation('用户管理'), asyncHandler(toggle))

// 角色管理
router.get('/roles', permissionRequired('system:role'), logOperation('角色管理'), asyncHandler(roleList))
router.post('/roles', permissionRequired('system:role:create'), logOperation('角色管理'), asyncHandler(roleCreate))
router.put('/roles/:id', permissionRequired('system:role:update'), logOperation('角色管理'), asyncHandler(roleUpdate))
router.delete('/roles/:id', permissionRequired('system:role:delete'), logOperation('角色管理'), asyncHandler(roleRemove))

// 权限/菜单管理
router.get('/permissions', permissionRequired('system:menu'), asyncHandler(permList))
router.get('/permissions/tree', permissionRequired('system:menu'), asyncHandler(permList))
router.get('/permissions/menu', asyncHandler(userMenu))  // 菜单按角色过滤返回，用 authRequired 即可
router.get('/permissions/:id', permissionRequired('system:menu'), asyncHandler(permDetail))
router.post('/permissions', permissionRequired('system:menu:create'), logOperation('菜单管理'), asyncHandler(permCreate))
router.put('/permissions/:id', permissionRequired('system:menu:update'), logOperation('菜单管理'), asyncHandler(permUpdate))
router.delete('/permissions/:id', permissionRequired('system:menu:delete'), logOperation('菜单管理'), asyncHandler(permRemove))
router.get('/roles/:id/permissions', permissionRequired('system:role'), asyncHandler(getRolePermissions))
router.put('/roles/:id/permissions', permissionRequired('system:role:assign'), logOperation('角色权限分配'), asyncHandler(assignPermissions))

// 操作日志
router.get('/logs', permissionRequired('system:log'), asyncHandler(logList))

// 系统日志（结构化日志）
router.get('/system-logs', permissionRequired('system:system-log'), asyncHandler(systemLogList))

// 数据字典 - 字典类型
router.get('/dict/types', permissionRequired('system:dict'), asyncHandler(dictTypeList))
router.get('/dict/types/:id', permissionRequired('system:dict'), asyncHandler(dictTypeGet))
router.post('/dict/types', permissionRequired('system:dict:create'), logOperation('数据字典'), asyncHandler(dictTypeCreate))
router.put('/dict/types/:id', permissionRequired('system:dict:update'), logOperation('数据字典'), asyncHandler(dictTypeUpdate))
router.delete('/dict/types/:id', permissionRequired('system:dict:delete'), logOperation('数据字典'), asyncHandler(dictTypeRemove))

// 数据字典 - 字典数据
router.get('/dict/datas', permissionRequired('system:dict'), asyncHandler(dictDataList))
router.get('/dict/datas/type/:type', permissionRequired('system:dict'), asyncHandler(listDataByType))
router.get('/dict/datas/:code', permissionRequired('system:dict'), asyncHandler(dictDataGet))
router.post('/dict/datas', permissionRequired('system:dict:create'), logOperation('数据字典'), asyncHandler(dictDataCreate))
router.put('/dict/datas/:code', permissionRequired('system:dict:update'), logOperation('数据字典'), asyncHandler(dictDataUpdate))
router.delete('/dict/datas/:code', permissionRequired('system:dict:delete'), logOperation('数据字典'), asyncHandler(dictDataRemove))

// 系统配置
router.get('/config', permissionRequired('system:config'), asyncHandler(getConfig))
router.put('/config', permissionRequired('system:config:update'), logOperation('系统配置'), asyncHandler(saveConfig))
// 项目环境
router.get('/config/environment', permissionRequired('system:config'), asyncHandler(getEnvironment))
router.post('/config/restart', permissionRequired('system:config:update'), logOperation('系统配置'), asyncHandler(restartServer))
// 数据库配置
router.get('/config/database', permissionRequired('system:config'), asyncHandler(getDatabaseInfo))
router.get('/config/database/migration-targets', permissionRequired('system:config'), asyncHandler(getMigrationTargets))
router.post('/config/database/migrate', permissionRequired('system:config:update'), logOperation('系统配置'), asyncHandler(migrateDatabase))
// 数据字典
router.get('/config/data-dictionary', permissionRequired('system:config'), asyncHandler(listDataDictionary))
router.post('/config/data-dictionary/refresh', permissionRequired('system:config:update'), logOperation('系统配置'), asyncHandler(refreshDataDictionary))
router.get('/config/data-dictionary/refresh/:taskId', permissionRequired('system:config'), asyncHandler(getRefreshProgress))
router.get('/config/data-dictionary/:table_name/records', permissionRequired('system:config'), asyncHandler(listTableRecords))
// 备份还原
router.get('/config/backups', permissionRequired('system:config'), asyncHandler(listBackups))
router.post('/config/backups', permissionRequired('system:config:update'), logOperation('系统配置'), asyncHandler(createBackup))
router.post('/config/backups/restore', permissionRequired('system:config:update'), logOperation('系统配置'), asyncHandler(restoreBackup))
router.delete('/config/backups/:filename', permissionRequired('system:config:update'), logOperation('系统配置'), asyncHandler(deleteBackup))

// 文件管理
router.get('/files', permissionRequired('system:config'), asyncHandler(listDirectory))
router.delete('/files/:path', permissionRequired('system:config:update'), logOperation('文件管理'), asyncHandler(removeItem))

// 用户个性化设置
router.get('/user-settings', asyncHandler(getUserSettings))
router.put('/user-setting', logOperation('用户设置'), asyncHandler(saveUserSetting))
router.put('/user-settings/batch', logOperation('用户设置'), asyncHandler(batchSaveUserSettings))

export default router
