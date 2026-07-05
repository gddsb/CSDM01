import { SystemConfig } from '../models/index.js'
import { success, fail } from '../utils/response.js'
import sequelize from '../config/database.js'
import { Sequelize } from 'sequelize'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// 默认配置（设计文档 §2.2.2 系统配置表）
const defaultConfigs = [
  { config_key: 'system_name', config_value: '长沙大满生产制造系统', config_desc: '系统名称' },
  { config_key: 'system_version', config_value: 'v1.0.0', config_desc: '系统版本（只读）' },
  { config_key: 'company_name', config_value: '东莞市大满包装实业有限公司长沙分公司', config_desc: '公司名称' },
  { config_key: 'contact_phone', config_value: '0731-88888888', config_desc: '联系电话' },
  { config_key: 'default_line', config_value: '', config_desc: '默认产线' },
  { config_key: 'standard_hours', config_value: '8', config_desc: '标准工时' },
  // 班次设定：默认白班
  { config_key: 'shift_setting', config_value: '白班', config_desc: '班次设置（默认白班）' },
  { config_key: 'default_standard', config_value: '', config_desc: '默认检验标准' },
  { config_key: 'defect_warning_threshold', config_value: '3', config_desc: '不良率预警阈值(%)' },
  { config_key: 'microbe_cycle', config_value: '7', config_desc: '微生物检测周期(天)' },
  { config_key: 'device_alarm', config_value: 'true', config_desc: '设备故障报警' },
  { config_key: 'quality_alarm', config_value: 'true', config_desc: '质量异常报警' },
  { config_key: 'stock_warning', config_value: 'true', config_desc: '库存预警' },
]

// 获取系统配置（键值对）
export const getConfig = async (req, res) => {
  try {
    const configs = await SystemConfig.findAll()
    const result = {}
    configs.forEach(c => {
      result[c.config_key] = c.config_value
    })
    for (const def of defaultConfigs) {
      if (result[def.config_key] === undefined) {
        result[def.config_key] = def.config_value
      }
    }
    return success(res, result, '获取成功')
  } catch (err) {
    console.error('获取系统配置失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 保存系统配置（system_version 只读，不允许通过此接口修改）
export const saveConfig = async (req, res) => {
  try {
    const configs = { ...req.body }
    // 系统版本只读，强制忽略前端传入的值
    delete configs.system_version
    const username = req.user?.username || 'system'
    for (const [key, value] of Object.entries(configs)) {
      const val = typeof value === 'object' ? JSON.stringify(value) : String(value)
      const [config, created] = await SystemConfig.findOrCreate({
        where: { config_key: key },
        defaults: { config_value: val, config_desc: key, updated_by: username },
      })
      if (!created) {
        await config.update({ config_value: val, updated_by: username })
      }
    }
    return success(res, null, '保存成功')
  } catch (err) {
    console.error('保存系统配置失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 项目环境信息（只读展示）
export const getEnvironment = async (req, res) => {
  try {
    const mem = process.memoryUsage()
    const info = {
      node_version: process.version,
      platform: `${process.platform} ${process.arch}`,
      pid: process.pid,
      uptime: Math.floor(process.uptime()),
      cwd: process.cwd(),
      env: process.env.NODE_ENV || 'development',
      memory_rss: Math.round(mem.rss / 1024 / 1024),
      memory_heap_used: Math.round(mem.heapUsed / 1024 / 1024),
      memory_heap_total: Math.round(mem.heapTotal / 1024 / 1024),
      sequelize_version: Sequelize.version || 'unknown',
      server_time: new Date().toISOString(),
    }
    return success(res, info, '获取成功')
  } catch (err) {
    console.error('获取项目环境失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 数据库配置信息（密码脱敏）
export const getDatabaseInfo = async (req, res) => {
  try {
    const dialect = process.env.DB_DIALECT || 'sqlite'
    const info = {
      dialect,
      host: process.env.DB_HOST || (dialect === 'sqlite' ? '-' : 'localhost'),
      port: process.env.DB_PORT || (dialect === 'sqlite' ? '-' : 3306),
      database: process.env.DB_NAME || (dialect === 'sqlite' ? 'milk_can_mes.sqlite' : 'milk_can_mes'),
      username: process.env.DB_USER || (dialect === 'sqlite' ? '-' : 'root'),
      password_set: !!(process.env.DB_PASSWORD && process.env.DB_PASSWORD.length > 0),
      storage: dialect === 'sqlite' ? (process.env.DB_STORAGE || './data/milk_can_mes.sqlite') : '-',
    }
    // 测试连接
    try {
      await sequelize.authenticate()
      info.connection_status = 'connected'
    } catch (e) {
      info.connection_status = 'error'
      info.connection_error = e.message
    }
    return success(res, info, '获取成功')
  } catch (err) {
    console.error('获取数据库配置失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 备份目录（仅 SQLite 支持，MySQL 需调用 mysqldump）
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const BACKUP_DIR = path.resolve(__dirname, '../../data/backups')
const SQLITE_PATH = path.resolve(__dirname, '../../data/milk_can_mes.sqlite')

// 列出备份文件
export const listBackups = async (req, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true })
      return success(res, [], '获取成功')
    }
    const files = fs.readdirSync(BACKUP_DIR)
    const backups = files
      .filter(f => f.endsWith('.sqlite') || f.endsWith('.db'))
      .map(f => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f))
        return {
          filename: f,
          size: stat.size,
          created_at: stat.mtime.toISOString(),
        }
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    return success(res, backups, '获取成功')
  } catch (err) {
    console.error('列出备份失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 创建备份
export const createBackup = async (req, res) => {
  try {
    const dialect = process.env.DB_DIALECT || 'sqlite'
    if (dialect !== 'sqlite') {
      return fail(res, '当前数据库类型暂不支持界面备份，请使用数据库管理工具进行备份', 400)
    }
    if (!fs.existsSync(SQLITE_PATH)) {
      return fail(res, '数据库文件不存在', 404)
    }
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true })
    }
    const ts = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+/, '').replace(' ', '_')
    const filename = `backup_${ts}.sqlite`
    const target = path.join(BACKUP_DIR, filename)
    // 使用 copyFileSync 创建备份
    fs.copyFileSync(SQLITE_PATH, target)
    const stat = fs.statSync(target)
    return success(res, { filename, size: stat.size, created_at: stat.mtime.toISOString() }, '备份成功')
  } catch (err) {
    console.error('创建备份失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 还原备份
export const restoreBackup = async (req, res) => {
  try {
    const dialect = process.env.DB_DIALECT || 'sqlite'
    if (dialect !== 'sqlite') {
      return fail(res, '当前数据库类型暂不支持界面还原，请使用数据库管理工具进行还原', 400)
    }
    const { filename } = req.body
    if (!filename) return fail(res, '请选择备份文件', 400)
    // 防止路径穿越
    const safe = path.basename(filename)
    const source = path.join(BACKUP_DIR, safe)
    if (!fs.existsSync(source)) return fail(res, '备份文件不存在', 404)
    // 关闭当前连接后再还原
    fs.copyFileSync(source, SQLITE_PATH)
    return success(res, null, '还原成功，建议重启服务以使连接生效')
  } catch (err) {
    console.error('还原备份失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 删除备份
export const deleteBackup = async (req, res) => {
  try {
    const { filename } = req.params
    const safe = path.basename(filename)
    const target = path.join(BACKUP_DIR, safe)
    if (!fs.existsSync(target)) return fail(res, '备份文件不存在', 404)
    fs.unlinkSync(target)
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除备份失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 需要强制同步默认值的关键配置项
// 这些 key 的值若与历史旧默认值一致，则刷新为新默认值（避免覆盖用户自定义值）
const LEGACY_DEFAULT_VALUES = {
  system_name: ['奶粉罐MES', '奶粉罐生产系统'],
  company_name: ['恒丰包装科技有限公司'],
  shift_setting: ['白班,夜班', '白班,夜班,中班'],
}

export const initDefaultConfigs = async () => {
  for (const def of defaultConfigs) {
    const [record, created] = await SystemConfig.findOrCreate({
      where: { config_key: def.config_key },
      defaults: def,
    })
    if (created) continue
    // 对关键配置项，若当前值是历史旧默认值，则刷新为新默认值
    const legacy = LEGACY_DEFAULT_VALUES[def.config_key]
    if (legacy && legacy.includes(record.config_value)) {
      await record.update({ config_value: def.config_value, config_desc: def.config_desc })
    }
  }
}

export default {
  getConfig,
  saveConfig,
  getEnvironment,
  getDatabaseInfo,
  listBackups,
  createBackup,
  restoreBackup,
  deleteBackup,
  initDefaultConfigs,
}
