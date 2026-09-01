import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import helmet from 'helmet'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import httpProxy from 'http-proxy'
import routes from './routes/index.js'
import sequelize from './config/database.js'
import { initDefaultConfigs, refreshDictionaryDataIfEmpty } from './controllers/SystemConfigController.js'
import { initDefaultPermissions } from './controllers/RoleController.js'
import { initDefaultRules } from './controllers/NumberRuleController.js'
import { initProfiles } from './controllers/DeviceMaintenanceController.js'
import { runMigrations } from './migrate.js'
import { startTaskScheduler } from './services/taskScheduler.js'
import { TaskSetting } from './models/index.js'
import { corsOptions, apiRateLimiter, AppError } from './middleware/security.js'
import { performanceMonitor } from './middleware/performance.js'
import logger from './utils/logger.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001
const isProd = process.env.NODE_ENV === 'production'

// 启动时校验 JWT 密钥安全性（生产环境禁止使用默认弱密钥）
if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'default-secret')) {
  logger.warn('[Security] 生产环境未设置强随机 JWT_SECRET，请在 .env 中配置 JWT_SECRET')
}

const proxy = httpProxy.createProxyServer({
  target: 'http://localhost:5173',
  changeOrigin: true,
})

// 确保数据目录存在（SQLite 数据库文件和备份目录）
const dataDir = path.resolve(process.cwd(), 'data')
const backupsDir = path.resolve(dataDir, 'backups')
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true })

// 确保上传目录存在
const uploadsDir = path.resolve(process.cwd(), 'uploads', 'avatars')
const tmpDir = path.resolve(process.cwd(), 'uploads', 'tmp')
const defectsDir = path.resolve(process.cwd(), 'uploads', 'defects')
const appsDir = path.resolve(process.cwd(), 'uploads', 'apps')
const reportsDir = path.resolve(process.cwd(), 'uploads', 'reports')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
if (!fs.existsSync(defectsDir)) fs.mkdirSync(defectsDir, { recursive: true })
if (!fs.existsSync(appsDir)) fs.mkdirSync(appsDir, { recursive: true })
if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true })

// 初始化默认任务设置
async function initTaskSettings() {
  const defaultTasks = [
    { task_type: 'items', name: 'task_料品数据同步', description: '从U9 ERP系统同步料品基础档案数据', source_url: '', field_count: 24, is_active: 1 },
    { task_type: 'customers', name: 'task_客户数据同步', description: '从U9 ERP系统同步客户基础档案数据', source_url: '', field_count: 11, is_active: 1 },
    { task_type: 'production_orders', name: 'task_生产订单同步', description: '从U9 ERP系统同步生产订单数据（制造订单MO）', source_url: '', field_count: 16, is_active: 1 },
    { task_type: 'purchase_receipts', name: 'task_采购收货同步', description: '从U9 ERP系统同步采购收货数据（标准收货列表）', source_url: '', field_count: 15, is_active: 1 },
    { task_type: 'env_monitor', name: 'task_环境监测采集', description: '从0531yun物联网平台采集车间环境监测数据', source_url: '', field_count: 15, is_active: 1 },
    { task_type: 'weather', name: 'task_气象信息抓取', description: '从中国天气网抓取城市/区域实时气象数据', source_url: '', field_count: 8, is_active: 1 },
    { task_type: 'energy_meter', name: 'task_能源采集', description: '从云集云能源平台采集总表有功/无功总电能历史记录', source_url: '', field_count: 11, is_active: 1 },
  ]
  for (const t of defaultTasks) {
    const [rec, created] = await TaskSetting.findOrCreate({ where: { task_type: t.task_type }, defaults: t })
    if (!created) {
      await rec.update({ name: t.name, description: t.description, field_count: t.field_count })
    }
  }
}

// 同步数据库表
async function initDatabase() {
  try {
    // 只创建不存在的表，不修改已有表结构
    await sequelize.sync()
    console.log('✅ 数据库表同步完成')
    // 补齐已有表缺失的列（ALTER TABLE ADD COLUMN）
    await runMigrations()
    console.log('✅ 数据库列迁移完成')
    // 初始化默认系统配置
    await initDefaultConfigs()
    console.log('✅ 系统配置初始化完成')
    // 初始化默认权限数据
    await initDefaultPermissions()
    console.log('✅ 默认权限初始化完成')
    // 初始化默认编号规则
    await initDefaultRules()
    console.log('✅ 默认编号规则初始化完成')
    // 初始化默认任务设置
    await initTaskSettings()
    console.log('✅ 默认任务设置初始化完成')
    // backfill：为已有标准的设备创建生效档案
    await initProfiles()
    console.log('✅ 维护标准档案初始化完成')
    // 初始化数据字典（仅当字典表为空时才扫描数据库，避免每次重启全表扫描）
    await refreshDictionaryDataIfEmpty()
    console.log('✅ 数据字典初始化完成（仅空表时刷新）')
  } catch (err) {
    console.error('❌ 数据库初始化失败:', err.message)
    if (err.errors) {
      err.errors.forEach(e => console.error('  -', e.message, e.path, e.value))
    }
  }
}

// 安全中间件：helmet 设置安全响应头（CORS 需先于 CSP 放行跨域）
app.use(
  helmet({
    // 前端为独立 SPA / 由 Vite 或后端反代提供，禁用 HSTS 由反向代理统一控制更稳妥
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
)

// 中间件
app.use(cors(corsOptions()))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb', parameterLimit: 100000 }))
app.use(performanceMonitor)

// 全局限流（登录接口在 auth 路由内单独配置更严格的限流）
app.use('/api', apiRateLimiter)
const SENSITIVE_KEYS = ['password', 'token', 'secret', 'authorization', 'pwd', 'access_token', 'refresh_token']

function maskSensitive(obj: any, depth: number = 0): any {
  if (depth > 5 || obj == null) return obj
  if (typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map((item) => maskSensitive(item, depth + 1))
  const result: any = {}
  for (const key of Object.keys(obj)) {
    if (SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k))) {
      result[key] = '***'
    } else {
      result[key] = maskSensitive(obj[key], depth + 1)
    }
  }
  return result
}

function getSafeReqInfo(req: any): any {
  const info: any = {
    method: req.method,
    url: req.originalUrl || req.url,
    ip: (req.headers['x-forwarded-for'] || req.ip || (req.socket as any)?.remoteAddress || '').toString().split(',')[0].trim(),
  }
  if (req.user) info.user = { userId: req.user.userId, username: req.user.username }
  if (Object.keys(req.body || {}).length > 0) info.body = maskSensitive(req.body)
  if (Object.keys(req.query || {}).length > 0) info.query = maskSensitive(req.query)
  return info
}

const isProdLogger = process.env.NODE_ENV === 'production'

app.use(morgan(isProdLogger ? 'combined' : 'dev'))

// 禁止浏览器缓存 API 响应（防止菜单排序等数据修改后刷新仍返回旧缓存）
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.set('Pragma', 'no-cache')
  res.set('Expires', '0')
  next()
})

// 静态文件服务（用户上传的头像等）
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads'), {
  maxAge: '7d',
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=604800')
  },
}))

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Milk Can MES API Server is running' })
})

// API 路由
app.use('/api', routes)

// 非 API 请求：生产模式由后端直接提供 dist 静态文件 + SPA fallback；
// 开发模式代理到 Vite 开发服务器 (localhost:5173)
const DIST_DIR = path.resolve(process.cwd(), '..', 'dist')
const DIST_INDEX = path.resolve(DIST_DIR, 'index.html')
const distExists = () => {
  try { return fs.existsSync(DIST_INDEX) } catch { return false }
}
if (isProd && distExists()) {
  // 生产：先 serve 静态文件
  app.use('/', express.static(DIST_DIR, {
    index: false, // 不自动 index.html，SPA fallback 统一走 sendFile
    maxAge: '7d',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache')
    },
  }))
  // SPA fallback：所有非文件请求返回 index.html
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next()
    res.sendFile(DIST_INDEX, (err) => {
      if (err) next(err)
    })
  })
} else {
  // 开发 / dist 不存在时，代理到 Vite 开发服务器
  app.use('/', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next()
    proxy.web(req, res, {}, (err) => {
      console.error('代理错误:', err)
      res.status(503).json({ success: false, message: '前端服务暂不可用' })
    })
  })
}

// 404 处理（仅针对未匹配的 API 请求）
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: `接口不存在: ${req.method} ${req.path}` })
})

// 全局错误处理
app.use((err: any, req: any, res: any, next: any) => {
  const reqInfo = getSafeReqInfo(req)

  // CORS 拒绝：返回 403，不记录堆栈
  if (err && err.message && err.message.startsWith('CORS 策略禁止')) {
    logger.warn('[Security] CORS 拒绝:', reqInfo.ip, req.headers.origin)
    if (!res.headersSent) {
      return res.status(403).json({ success: false, code: 40300, message: '该来源不被允许访问' })
    }
    return
  }

  // 业务异常：使用其自带的状态码与错误码
  if (err instanceof AppError) {
    logger.warn('[AppError]', JSON.stringify({ ...reqInfo, code: err.code, message: err.message }))
    if (!res.headersSent) {
      return res.status(err.statusCode).json({ success: false, code: err.code, message: err.message })
    }
    return
  }

  // 未知异常：记录完整堆栈（生产隐藏堆栈），返回通用提示
  logger.error('[GlobalError] 未处理异常:', JSON.stringify({
    ...reqInfo,
    error: {
      message: err?.message || String(err),
      name: err?.name,
      stack: isProdLogger ? undefined : err?.stack,
    },
  }))
  if (!res.headersSent) {
    res.status(500).json({ success: false, code: 50000, message: '服务器内部错误' })
  }
})

async function start() {
  await initDatabase()
  await startTaskScheduler()
  app.listen(PORT, () => {
    console.log(`\n🚀 Milk Can MES API Server`)
    console.log(`   运行地址: http://localhost:${PORT}`)
    console.log(`   API基础路径: http://localhost:${PORT}/api`)
    console.log(`   健康检查: http://localhost:${PORT}/api/health\n`)
  })
}
start()
