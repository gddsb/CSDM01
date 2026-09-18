/**
 * MigrationWorker —— 表结构采集 + .env 读写 + 数据库迁移执行
 */
import sequelize from '../config/database.js'
import { Sequelize, Op, QueryTypes } from 'sequelize'
import { DataDictionary } from '../models/index.js'
import { ErrorCode, success, fail } from '../utils/response.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import http from 'http'
import net from 'net'
import { exec } from 'child_process'
import { runConcurrently } from './DataDictionaryService.js'
import { logger } from '../utils/logger.js'
import { formatDateTime, nowBeijingStr } from '../utils/date.js'
import { tableCategoryMap, columnCommentMap, CollectSchemaOptions } from './MigrationMeta.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BACKUP_DIR = process.env.BACKUP_DIR || path.resolve(__dirname, '..', '..', 'backups')
const SQLITE_PATH = process.env.DB_STORAGE || path.resolve(__dirname, '..', '..', 'data/milk_can_mes.sqlite')

export async function collectDatabaseSchema(options: CollectSchemaOptions = {}) {
  const { concurrency = 8, mysqlApproxThreshold = 100_000, onProgress } = options
  const queryInterface = sequelize.getQueryInterface()
  const allTables = await queryInterface.showAllTables()
  const tables: any[] = []
  const columnsMap: Record<string, any[]> = {}
  const total = allTables.length
  let processed = 0

  const updateProgress = (currentTable?: string) => {
    processed++
    onProgress?.(processed, total, currentTable)
  }

  // ====== 1) 批量获取行数：策略按 DB 类型区分 ======
  const recordCountMap: Record<string, number> = {}
  const dialect = sequelize.getDialect()

  if (dialect === 'mysql') {
    // MySQL: 先从 information_schema 拿近似行数（毫秒级，TABLE_ROWS 是 InnoDB 估算值）
    const dbName = (sequelize.config?.database || process.env.DB_NAME) as string
    let approxRows: any[] = []
    try {
      approxRows = (await sequelize.query(
        `SELECT TABLE_NAME as tbl, TABLE_ROWS as cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = :dbName`,
        { type: QueryTypes.SELECT, replacements: { dbName } },
      )) as any[]
    } catch (e) {
      logger.warn('[collectDatabaseSchema] information_schema 查询失败，退化为逐表 COUNT:', e?.message)
      approxRows = []
    }
    const approxMap: Record<string, number> = {}
    for (const r of approxRows) approxMap[r.tbl] = Number(r.cnt) || 0

    // 大表（超过阈值）直接用近似值；小表用精确 COUNT(*)；未知表也用精确 COUNT
    const tablesNeedExactCount = allTables.filter((t: string) => {
      const approx = approxMap[t] ?? -1
      return approx < 0 || approx <= mysqlApproxThreshold
    })

    // 并发精确 COUNT
    if (tablesNeedExactCount.length > 0) {
      const exactResults = await runConcurrently(
        tablesNeedExactCount,
        async (t: string) => {
          try {
            const r = await sequelize.query(`SELECT COUNT(*) as count FROM \`${t}\``, { type: QueryTypes.SELECT })
            return { table: t, count: Number((r[0] as any)?.count ?? 0) }
          } catch {
            return { table: t, count: approxMap[t] || 0 }
          }
        },
        concurrency,
      )
      for (const r of exactResults) {
        recordCountMap[r.table] = r.count
      }
    }
    // 大表用近似值填充
    for (const t of allTables) {
      if (recordCountMap[t] === undefined) recordCountMap[t] = approxMap[t] || 0
    }
  } else {
    // SQLite: 逐表并发 COUNT (*)
    const countResults = await runConcurrently(
      allTables,
      async (t: string) => {
        try {
          const r = await sequelize.query(`SELECT COUNT(*) as count FROM "${t}"`, { type: QueryTypes.SELECT })
          return { table: t, count: Number((r[0] as any)?.count ?? 0) }
        } catch {
          return { table: t, count: 0 }
        }
      },
      concurrency,
    )
    for (const r of countResults) recordCountMap[r.table] = r.count
  }

  // ====== 2) 并发获取所有表结构 describeTable ======
  const describeResults = await runConcurrently(
    allTables,
    async (t: string) => {
      try {
        const cols = await queryInterface.describeTable(t)
        const colComments = columnCommentMap[t] || {}
        const colList = Object.entries(cols).map(([name, col]: [string, any]) => ({
          name,
          type: col.type,
          nullable: col.allowNull,
          primaryKey: col.primaryKey,
          defaultValue:
            col.defaultValue !== undefined && col.defaultValue !== null
              ? String(col.defaultValue).replace(/'/g, '')
              : null,
          comment: col.comment || colComments[name] || '',
        }))
        return { table: t, cols: colList, ok: true }
      } catch (e) {
        return { table: t, cols: [], ok: false }
      } finally {
        updateProgress(t)
      }
    },
    concurrency,
  )

  for (const r of describeResults) {
    columnsMap[r.table] = r.cols
    const meta = tableCategoryMap[r.table] || { category: '其他', purpose: '' }
    tables.push({
      table_name: r.table,
      category: meta.category,
      purpose: meta.purpose,
      field_count: r.cols.length,
      record_count: recordCountMap[r.table] || 0,
      last_update: nowBeijingStr(),
    })
  }

  tables.sort((a, b) => {
    const catOrder: Record<string, number> = { '系统表': 0, '基础数据表': 1, '业务表': 2, '其他': 3 }
    const businessOrder = [
      'production_order',
      'production_report_order',
      'production_report_process',
      'production_manpower_record',
      'production_process_exception',
      'production_process_defect',
      'production_process_material',
      'production_report_image',
      'quality_product_inspection',
      'quality_product_inspection_item',
    ]
    if (a.category === b.category && a.category === '业务表') {
      const ai = businessOrder.indexOf(a.table_name)
      const bi = businessOrder.indexOf(b.table_name)
      if (ai >= 0 && bi >= 0) return ai - bi
      if (ai >= 0) return -1
      if (bi >= 0) return 1
    }
    return (catOrder[a.category] ?? 3) - (catOrder[b.category] ?? 3) || a.table_name.localeCompare(b.table_name)
  })

  return { tables, columnsMap }
}

// 数据库配置信息（密码脱敏）+ 数据表清单






// ---- 迁移目标枚举 ----
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
    logger.error('获取迁移目标失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 读取当前 .env 文件内容

// ---- .env 文件读写 ----
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

// ---- 执行数据库迁移 ----
export const migrateDatabase = async (req, res) => {
  const username = req.user?.username || 'system'
  try {
    const target = (req.body?.target || '').toLowerCase()
    const validTargets = ['sqlite', 'mysql', 'postgres', 'mariadb']
    if (!validTargets.includes(target)) {
      return fail(res, '不支持的迁移目标数据库类型', ErrorCode.PARAM_INVALID)
    }
    // 1. 迁移前自动备份当前数据
    const currentDialect = process.env.DB_DIALECT || 'mysql'
    let backupInfo = null
    try {
      if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true })
      const ts = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+/, '').replace(' ', '_')

      if (currentDialect === 'sqlite' && fs.existsSync(SQLITE_PATH)) {
        const backupName = `backup_${ts}.sqlite`
        const backupPath = path.join(BACKUP_DIR, backupName)
        fs.copyFileSync(SQLITE_PATH, backupPath)
        const stat = fs.statSync(backupPath)
        backupInfo = {
          filename: backupName,
          size: stat.size,
          created_at: formatDateTime(stat.mtime),
        }
      } else if (currentDialect === 'mysql') {
        const backupName = `backup_${ts}.sql`
        const backupPath = path.join(BACKUP_DIR, backupName)
        const dbHost = process.env.DB_HOST || 'localhost'
        const dbPort = process.env.DB_PORT || '3306'
        const dbUser = process.env.DB_USER || 'root'
        const dbPassword = process.env.DB_PASSWORD || ''
        const dbName = process.env.DB_NAME || 'milk_can_mes'
        const passwordArg = dbPassword ? `-p${dbPassword}` : ''
        const cmd = `mysqldump -h ${dbHost} -P ${dbPort} -u ${dbUser} ${passwordArg} --default-character-set=utf8mb4 --single-transaction --routines --triggers ${dbName} > "${backupPath}"`

        await new Promise<void>((resolve, reject) => {
          exec(cmd, { timeout: 300000 }, (err) => {
            if (err) reject(err)
            else resolve()
          })
        })

        if (fs.existsSync(backupPath) && fs.statSync(backupPath).size > 0) {
          const stat = fs.statSync(backupPath)
          backupInfo = {
            filename: backupName,
            size: stat.size,
            created_at: formatDateTime(stat.mtime),
          }
        }
      }
    } catch (e) {
      logger.error('迁移前自动备份失败:', e.message)
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
      return fail(res, `目标数据库连接失败：${e.message}`, ErrorCode.PARAM_INVALID)
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
              logger.warn(`表 ${tableName} 批量插入部分失败:`, e.message)
            }
          }
          result.tables.push({ name: tableName, rows: rows.length })
          result.total_rows += rows.length
        } catch (e) {
          logger.warn(`表 ${tableName} 数据迁移失败:`, e.message)
          result.tables.push({ name: tableName, rows: 0, error: e.message })
        }
      }
    } catch (e) {
      try { await targetSequelize.close() } catch (err) {
        logger.warn('[SilentCatch] 静默异常被捕获', err?.message)
    }
      return fail(res, `数据迁移失败：${e.message}`, ErrorCode.SYSTEM_ERROR)
    }

    // 4. 关闭目标连接
    try { await targetSequelize.close() } catch (err) {
        logger.warn('[SilentCatch] 静默异常被捕获', err?.message)
    }

    // 5. 更新 .env 文件，使下次启动时使用新数据库（密码不回写，需手动配置）
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
    }
    writeEnvFile(envContent)

    return success(res, {
      target,
      backup: backupInfo,
      migration: result,
      note: '迁移已完成。需要重启后端服务以使新数据库生效。',
    }, `数据迁移成功，共迁移 ${result.total_rows} 行数据`)
  } catch (err) {
    logger.error('数据库迁移失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 刷新数据字典核心逻辑（扫描数据库表结构并持久化到 sys_data_dictionary）
