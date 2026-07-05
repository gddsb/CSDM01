import { Router } from 'express'
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
import { getConfig, saveConfig, getEnvironment, getDatabaseInfo, listBackups, createBackup, restoreBackup, deleteBackup, migrateDatabase, getMigrationTargets, restartServer } from '../controllers/SystemConfigController.js'
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
router.post('/users/me/avatar', avatarUpload.single('avatar'), uploadMyAvatar)
router.put('/users/me/avatar', setMyAvatar)
router.put('/users/me/profile', updateMyProfile)

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

// 数据字典 - 字典类型
router.get('/dict/types', dictTypeList)
router.get('/dict/types/:id', dictTypeGet)
router.post('/dict/types', logOperation('数据字典'), dictTypeCreate)
router.put('/dict/types/:id', logOperation('数据字典'), dictTypeUpdate)
router.delete('/dict/types/:id', logOperation('数据字典'), dictTypeRemove)

// 数据字典 - 字典数据
router.get('/dict/datas', dictDataList)
router.get('/dict/datas/type/:type', listDataByType)
router.get('/dict/datas/:code', dictDataGet)
router.post('/dict/datas', logOperation('数据字典'), dictDataCreate)
router.put('/dict/datas/:code', logOperation('数据字典'), dictDataUpdate)
router.delete('/dict/datas/:code', logOperation('数据字典'), dictDataRemove)

// 系统配置
router.get('/config', getConfig)
router.put('/config', logOperation('系统配置'), saveConfig)
// 项目环境
router.get('/config/environment', getEnvironment)
router.post('/config/restart', logOperation('系统配置'), restartServer)
// 数据库配置
router.get('/config/database', getDatabaseInfo)
router.get('/config/database/migration-targets', getMigrationTargets)
router.post('/config/database/migrate', logOperation('系统配置'), migrateDatabase)
// 备份还原
router.get('/config/backups', listBackups)
router.post('/config/backups', logOperation('系统配置'), createBackup)
router.post('/config/backups/restore', logOperation('系统配置'), restoreBackup)
router.delete('/config/backups/:filename', logOperation('系统配置'), deleteBackup)

export default router
