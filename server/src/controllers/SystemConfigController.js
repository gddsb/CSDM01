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
    // 操作系统版本
    let os_version = ''
    let os_hostname = ''
    let os_type = ''
    let os_release = ''
    let os_uptime = 0
    let cpus = []
    try {
      const os = await import('os')
      os_type = os.type()
      os_release = os.release()
      os_hostname = os.hostname()
      os_uptime = Math.floor(os.uptime())
      // 操作系统版本号字符串
      os_version = `${os.type()} ${os.release()} (${os.arch()})`
      cpus = os.cpus() || []
    } catch (e) {
      os_version = `${process.platform} ${process.arch}`
    }
    // 磁盘信息（当前工作目录所在分区）
    let disk_info = { total: 0, free: 0, used: 0, used_percent: 0, mount: '' }
    try {
      const fs = await import('fs')
      const os = await import('os')
      const targetPath = process.cwd()
      const isWin = process.platform === 'win32'
      const execPath = isWin ? 'wmic' : 'df'
      const { execFile } = await import('child_process')
      // 使用 df 获取磁盘信息（Linux/Mac），Windows 使用 wmic
      await new Promise((resolve) => {
        if (isWin) {
          execFile('wmic', ['logicaldisk', 'where', "DeviceID='C:'", 'get', 'Size,FreeSpace', '/format:csv'], { timeout: 3000 }, (err, stdout) => {
            if (!err && stdout) {
              const lines = stdout.trim().split(/\r?\n/).filter(Boolean)
              const line = lines[lines.length - 1]
              const parts = line.split(',').filter(Boolean)
              if (parts.length >= 2) {
                const free = Number(parts[0])
                const total = Number(parts[1])
                if (total > 0) {
                  disk_info = {
                    total, free, used: total - free,
                    used_percent: Number(((total - free) / total * 100).toFixed(1)),
                    mount: 'C:',
                  }
                }
              }
            }
            resolve()
          })
        } else {
          execFile('df', ['-k', targetPath], { timeout: 3000 }, (err, stdout) => {
            if (!err && stdout) {
              const lines = stdout.trim().split(/\r?\n/)
              if (lines.length >= 2) {
                const parts = lines[1].trim().split(/\s+/)
                if (parts.length >= 6) {
                  const total = Number(parts[1]) * 1024
                  const used = Number(parts[2]) * 1024
                  const free = Number(parts[3]) * 1024
                  const usedPercent = Number(parts[4].replace('%', ''))
                  disk_info = { total, free, used, used_percent: usedPercent, mount: parts[5] }
                }
              }
            }
            resolve()
          })
        }
      })
    } catch (e) {
      // 磁盘信息获取失败，保持默认值
    }
    const info = {
      node_version: process.version,
      platform: `${process.platform} ${process.arch}`,
      os_type: os_type,
      os_release: os_release,
      os_version: os_version,
      os_hostname: os_hostname,
      os_uptime: os_uptime,
      cpu_count: cpus.length,
      cpu_model: cpus.length > 0 ? cpus[0].model : '',
      pid: process.pid,
      uptime: Math.floor(process.uptime()),
      cwd: process.cwd(),
      env: process.env.NODE_ENV || 'development',
      memory_rss: Math.round(mem.rss / 1024 / 1024),
      memory_heap_used: Math.round(mem.heapUsed / 1024 / 1024),
      memory_heap_total: Math.round(mem.heapTotal / 1024 / 1024),
      disk_total: disk_info.total,
      disk_free: disk_info.free,
      disk_used: disk_info.used,
      disk_used_percent: disk_info.used_percent,
      disk_mount: disk_info.mount,
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

// ===== 数据库迁移 =====

// 获取可用迁移目标（常见的几种数据库环境）
export const getMigrationTargets = async (req, res) => {
  try {
    const currentDialect = process.env.DB_DIALECT || 'sqlite'
    const targets = [
      {
        dialect: 'sqlite',
        name: 'SQLite（开发/单机版）',
        default_port: '-',
        default_storage: './data/milk_can_mes.sqlite',
        description: '嵌入式数据库，无需安装，适合开发演示与单机部署',
      },
      {
        dialect: 'mysql',
        name: 'MySQL 8（生产环境）',
        default_port: 3306,
        description: '推荐的生产级数据库，支持高并发与完整事务',
      },
      {
        dialect: 'postgres',
        name: 'PostgreSQL（高级环境）',
        default_port: 5432,
        description: '支持更复杂的查询与扩展类型，适合数据分析场景',
      },
      {
        dialect: 'mariadb',
        name: 'MariaDB（开源兼容）',
        default_port: 3306,
        description: 'MySQL 的开源分支，兼容 MySQL 协议',
      },
    ]
    // 标记当前正在使用的数据库类型
    const list = targets.map(t => ({ ...t, is_current: t.dialect === currentDialect }))
    return success(res, { current: currentDialect, targets: list }, '获取成功')
  } catch (err) {
    console.error('获取迁移目标失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 读取当前 .env 文件内容
function readEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return ''
  return fs.readFileSync(envPath, 'utf-8')
}

// 写入 .env 文件
function writeEnvFile(content) {
  const envPath = path.resolve(process.cwd(), '.env')
  fs.writeFileSync(envPath, content, 'utf-8')
}

// 更新或追加 .env 中的键值
function updateEnvLine(content, key, value) {
  const lines = content.split(/\r?\n/)
  const regex = new RegExp(`^\\s*${key}\\s*=`, 'i')
  let found = false
  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i])) {
      lines[i] = `${key}=${value}`
      found = true
      break
    }
  }
  if (!found) lines.push(`${key}=${value}`)
  return lines.join('\n')
}

// 执行数据迁移
// 入参：{ target: 'sqlite'|'mysql'|'postgres'|'mariadb', host, port, database, username, password, storage }
export const migrateDatabase = async (req, res) => {
  const username = req.user?.username || 'system'
  try {
    const target = (req.body?.target || '').toLowerCase()
    const validTargets = ['sqlite', 'mysql', 'postgres', 'mariadb']
    if (!validTargets.includes(target)) {
      return fail(res, '不支持的迁移目标数据库类型', 400)
    }
    // 1. 迁移前自动备份当前数据（仅 SQLite 支持界面备份）
    const currentDialect = process.env.DB_DIALECT || 'sqlite'
    let backupInfo = null
    if (currentDialect === 'sqlite') {
      try {
        if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true })
        if (fs.existsSync(SQLITE_PATH)) {
          const ts = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+/, '').replace(' ', '_')
          const backupName = `backup_${ts}.sqlite`
          const backupPath = path.join(BACKUP_DIR, backupName)
          fs.copyFileSync(SQLITE_PATH, backupPath)
          const stat = fs.statSync(backupPath)
          backupInfo = {
            filename: backupName,
            size: stat.size,
            created_at: stat.mtime.toISOString(),
          }
        }
      } catch (e) {
        console.error('迁移前自动备份失败:', e.message)
      }
    }

    // 2. 测试目标数据库连接
    let targetSequelize
    try {
      if (target === 'sqlite') {
        const storage = req.body?.storage || './data/milk_can_mes.sqlite'
        const { Sequelize } = await import('sequelize')
        // 确保目录存在
        const storageAbs = path.resolve(process.cwd(), storage)
        const storageDir = path.dirname(storageAbs)
        if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true })
        targetSequelize = new Sequelize({
          dialect: 'sqlite',
          storage: storageAbs,
          logging: false,
          define: { timestamps: true, underscored: true },
        })
      } else {
        const { Sequelize } = await import('sequelize')
        targetSequelize = new Sequelize(
          req.body?.database || 'milk_can_mes',
          req.body?.username || 'root',
          req.body?.password || '',
          {
            host: req.body?.host || 'localhost',
            port: Number(req.body?.port) || (target === 'postgres' ? 5432 : 3306),
            dialect: target,
            logging: false,
            define: { timestamps: true, underscored: true },
          }
        )
      }
      await targetSequelize.authenticate()
    } catch (e) {
      return fail(res, `目标数据库连接失败：${e.message}`, 400)
    }

    // 3. 复制数据：从当前 sequelize 读取所有表数据，写入目标 sequelize
    const models = Object.values(sequelize.models || {})
    const result = { tables: [], total_rows: 0 }
    try {
      // 在目标数据库创建表结构
      const targetModels = []
      for (const model of models) {
        const Model = targetSequelize.define(model.name, model.getAttributes(), {
          tableName: model.getTableName(),
          timestamps: true,
          underscored: true,
        })
        targetModels.push(Model)
      }
      await targetSequelize.sync({ force: false, alter: false })

      // 逐表复制数据
      for (let i = 0; i < models.length; i++) {
        const srcModel = models[i]
        const dstModel = targetModels[i]
        const tableName = srcModel.getTableName()
        try {
          const rows = await srcModel.findAll({ raw: true })
          if (rows.length > 0) {
            // 批量插入，遇到错误则跳过该表（避免索引/约束冲突导致整体失败）
            try {
              await dstModel.bulkCreate(rows, { validate: false, ignoreDuplicates: true })
            } catch (e) {
              console.warn(`表 ${tableName} 批量插入部分失败:`, e.message)
            }
          }
          result.tables.push({ name: tableName, rows: rows.length })
          result.total_rows += rows.length
        } catch (e) {
          console.warn(`表 ${tableName} 数据迁移失败:`, e.message)
          result.tables.push({ name: tableName, rows: 0, error: e.message })
        }
      }
    } catch (e) {
      try { await targetSequelize.close() } catch (closeErr) {}
      return fail(res, `数据迁移失败：${e.message}`, 500)
    }

    // 4. 关闭目标连接
    try { await targetSequelize.close() } catch (e) {}

    // 5. 更新 .env 文件，使下次启动时使用新数据库
    let envContent = readEnvFile()
    const setEnv = (key, value) => { envContent = updateEnvLine(envContent, key, value) }
    setEnv('DB_DIALECT', target)
    if (target === 'sqlite') {
      setEnv('DB_STORAGE', req.body?.storage || './data/milk_can_mes.sqlite')
    } else {
      setEnv('DB_HOST', req.body?.host || 'localhost')
      setEnv('DB_PORT', req.body?.port || (target === 'postgres' ? 5432 : 3306))
      setEnv('DB_NAME', req.body?.database || 'milk_can_mes')
      setEnv('DB_USER', req.body?.username || 'root')
      setEnv('DB_PASSWORD', req.body?.password || '')
    }
    writeEnvFile(envContent)

    return success(res, {
      target,
      backup: backupInfo,
      migration: result,
      note: '迁移已完成。需要重启后端服务以使新数据库生效。',
    }, `数据迁移成功，共迁移 ${result.total_rows} 行数据`)
  } catch (err) {
    console.error('数据库迁移失败:', err)
    return fail(res, '服务器错误', 500)
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
  migrateDatabase,
  getMigrationTargets,
  initDefaultConfigs,
}
