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
import { authRequired, logOperation } from '../middleware/auth.js'
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
router.get('/users', logOperation('用户管理'), asyncHandler(list))
router.get('/users/:id', logOperation('用户管理'), asyncHandler(detail))
router.post('/users', logOperation('用户管理'), asyncHandler(create))
router.put('/users/:id', logOperation('用户管理'), asyncHandler(update))
router.delete('/users/:id', logOperation('用户管理'), asyncHandler(remove))
router.post('/users/:id/toggle', logOperation('用户管理'), asyncHandler(toggle))

// 角色管理
router.get('/roles', logOperation('角色管理'), asyncHandler(roleList))
router.post('/roles', logOperation('角色管理'), asyncHandler(roleCreate))
router.put('/roles/:id', logOperation('角色管理'), asyncHandler(roleUpdate))
router.delete('/roles/:id', logOperation('角色管理'), asyncHandler(roleRemove))

// 权限/菜单管理
router.get('/permissions', asyncHandler(permList))
router.get('/permissions/tree', asyncHandler(permList))
router.get('/permissions/menu', asyncHandler(userMenu))
router.get('/permissions/:id', asyncHandler(permDetail))
router.post('/permissions', logOperation('菜单管理'), asyncHandler(permCreate))
router.put('/permissions/:id', logOperation('菜单管理'), asyncHandler(permUpdate))
router.delete('/permissions/:id', logOperation('菜单管理'), asyncHandler(permRemove))
router.get('/roles/:id/permissions', asyncHandler(getRolePermissions))
router.put('/roles/:id/permissions', logOperation('角色权限分配'), asyncHandler(assignPermissions))

// 操作日志
router.get('/logs', asyncHandler(logList))

// 系统日志（结构化日志）
router.get('/system-logs', asyncHandler(systemLogList))

// 数据字典 - 字典类型
router.get('/dict/types', asyncHandler(dictTypeList))
router.get('/dict/types/:id', asyncHandler(dictTypeGet))
router.post('/dict/types', logOperation('数据字典'), asyncHandler(dictTypeCreate))
router.put('/dict/types/:id', logOperation('数据字典'), asyncHandler(dictTypeUpdate))
router.delete('/dict/types/:id', logOperation('数据字典'), asyncHandler(dictTypeRemove))

// 数据字典 - 字典数据
router.get('/dict/datas', asyncHandler(dictDataList))
router.get('/dict/datas/type/:type', asyncHandler(listDataByType))
router.get('/dict/datas/:code', asyncHandler(dictDataGet))
router.post('/dict/datas', logOperation('数据字典'), asyncHandler(dictDataCreate))
router.put('/dict/datas/:code', logOperation('数据字典'), asyncHandler(dictDataUpdate))
router.delete('/dict/datas/:code', logOperation('数据字典'), asyncHandler(dictDataRemove))

// 系统配置
router.get('/config', asyncHandler(getConfig))
router.put('/config', logOperation('系统配置'), asyncHandler(saveConfig))
// 项目环境
router.get('/config/environment', asyncHandler(getEnvironment))
router.post('/config/restart', logOperation('系统配置'), asyncHandler(restartServer))
// 数据库配置
router.get('/config/database', asyncHandler(getDatabaseInfo))
router.get('/config/database/migration-targets', asyncHandler(getMigrationTargets))
router.post('/config/database/migrate', logOperation('系统配置'), asyncHandler(migrateDatabase))
// 数据字典
router.get('/config/data-dictionary', asyncHandler(listDataDictionary))
router.post('/config/data-dictionary/refresh', logOperation('系统配置'), asyncHandler(refreshDataDictionary))
router.get('/config/data-dictionary/refresh/:taskId', asyncHandler(getRefreshProgress))
router.get('/config/data-dictionary/:table_name/records', asyncHandler(listTableRecords))
// 备份还原
router.get('/config/backups', asyncHandler(listBackups))
router.post('/config/backups', logOperation('系统配置'), asyncHandler(createBackup))
router.post('/config/backups/restore', logOperation('系统配置'), asyncHandler(restoreBackup))
router.delete('/config/backups/:filename', logOperation('系统配置'), asyncHandler(deleteBackup))

// 文件管理
router.get('/files', asyncHandler(listDirectory))
router.delete('/files/:path', logOperation('文件管理'), asyncHandler(removeItem))

// 用户个性化设置
router.get('/user-settings', asyncHandler(getUserSettings))
router.put('/user-setting', logOperation('用户设置'), asyncHandler(saveUserSetting))
router.put('/user-settings/batch', logOperation('用户设置'), asyncHandler(batchSaveUserSettings))

export default router
