import fs from 'fs'
import path from 'path'
import type { Request, Response } from 'express'
import { QueryTypes } from 'sequelize'
import sequelize from '../../config/database.js'
import { success, fail, ErrorCode } from '../../utils/response.js'
import { logger } from '../../utils/logger.js'
import { parsePagination } from '../../utils/controller.js'

function getBackupDir(): string {
  const configured = process.env.BACKUP_DIR
  if (configured) return configured
  const __dirname = path.dirname(new URL(import.meta.url).pathname)
  return path.resolve(__dirname, '../../../backups')
}

function ensureBackupDir(): string {
  const dir = getBackupDir()
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

export const listBackups = async (_req: Request, res: Response) => {
  try {
    const dir = ensureBackupDir()
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).map(name => {
      const full = path.join(dir, name)
      const stat = fs.statSync(full)
      return {
        filename: name,
        size: stat.size,
        mtime: stat.mtime,
        created_at: stat.birthtime || stat.mtime,
      }
    }).sort((a, b) => Number(b.mtime) - Number(a.mtime))
    return success(res, files)
  } catch (err: any) {
    logger.error('列出备份失败', err)
    return fail(res, '列出备份失败', ErrorCode.SYSTEM_ERROR)
  }
}

export const createBackup = async (req: Request, res: Response) => {
  try {
    const dir = ensureBackupDir()
    const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
    const file = path.join(dir, `milk_can_mes_${stamp}.sql`)
    const dialect = process.env.DB_DIALECT || 'sqlite'

    if (dialect === 'mysql') {
      const dbName = process.env.DB_NAME || 'milk_can_mes'
      const dbUser = process.env.DB_USER || 'root'
      const dbPass = process.env.DB_PASSWORD || ''
      const dbHost = process.env.DB_HOST || '127.0.0.1'
      const dbPort = process.env.DB_PORT || '3306'
      const cmd = `mysqldump -h${dbHost} -P${dbPort} -u${dbUser} -p${dbPass} --single-transaction --routines --triggers ${dbName} > "${file}"`
      await new Promise<void>((resolve, reject) => {
        import('child_process').then(({ exec }) => {
          exec(cmd, (err) => err ? reject(err) : resolve())
        })
      })
    } else {
      // SQLite: 直接复制数据库文件
      const storage = process.env.DB_STORAGE || './data/milk_can_mes.sqlite'
      const src = path.resolve(process.cwd(), storage)
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, file)
      } else {
        return fail(res, 'SQLite 数据库文件不存在，无法备份', ErrorCode.RECORD_NOT_FOUND)
      }
    }

    const stat = fs.statSync(file)
    return success(res, {
      filename: path.basename(file),
      size: stat.size,
      mtime: stat.mtime,
    }, '备份创建成功')
  } catch (err: any) {
    logger.error('创建备份失败', err)
    return fail(res, `创建备份失败: ${err.message}`, ErrorCode.SYSTEM_ERROR)
  }
}

export const restoreBackup = async (req: Request, res: Response) => {
  try {
    // 兼容 filename 和 file 两种参数名
    const { filename, file } = req.body as { filename?: string; file?: string }
    const targetName = filename || file
    if (!targetName || /[\\/]/.test(targetName)) return fail(res, '非法文件名', ErrorCode.PARAM_INVALID)
    const full = path.join(ensureBackupDir(), targetName)
    if (!fs.existsSync(full)) return fail(res, '备份文件不存在', ErrorCode.RECORD_NOT_FOUND)

    const dialect = process.env.DB_DIALECT || 'sqlite'
    if (dialect === 'mysql') {
      const dbName = process.env.DB_NAME || 'milk_can_mes'
      const dbUser = process.env.DB_USER || 'root'
      const dbPass = process.env.DB_PASSWORD || ''
      const dbHost = process.env.DB_HOST || '127.0.0.1'
      const dbPort = process.env.DB_PORT || '3306'
      const cmd = `mysql -h${dbHost} -P${dbPort} -u${dbUser} -p${dbPass} ${dbName} < "${full}"`
      await new Promise<void>((resolve, reject) => {
        import('child_process').then(({ exec }) => {
          exec(cmd, (err) => err ? reject(err) : resolve())
        })
      })
    } else {
      // SQLite: 覆盖数据库文件
      const storage = process.env.DB_STORAGE || './data/milk_can_mes.sqlite'
      const dest = path.resolve(process.cwd(), storage)
      const destDir = path.dirname(dest)
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
      fs.copyFileSync(full, dest)
    }

    return success(res, { restored: targetName }, '还原成功，建议重启服务以确保连接刷新')
  } catch (err: any) {
    logger.error('恢复备份失败', err)
    return fail(res, `恢复备份失败: ${err.message}`, ErrorCode.SYSTEM_ERROR)
  }
}

export const deleteBackup = async (req: Request, res: Response) => {
  try {
    const { filename, file } = req.params as { filename?: string; file?: string }
    const targetName = filename || file
    if (!targetName || /[\\/]/.test(targetName)) return fail(res, '非法文件名', ErrorCode.PARAM_INVALID)
    const full = path.join(ensureBackupDir(), targetName)
    if (fs.existsSync(full)) fs.unlinkSync(full)
    return success(res, { deleted: targetName }, '删除成功')
  } catch (err: any) {
    logger.error('删除备份失败', err)
    return fail(res, '删除备份失败', ErrorCode.SYSTEM_ERROR)
  }
}

export const getDatabaseInfo = async (_req: Request, res: Response) => {
  try {
    const dialect = process.env.DB_DIALECT || 'sqlite'
    const dbHost = process.env.DB_HOST || '127.0.0.1'
    const dbPort = Number(process.env.DB_PORT) || 3306
    const dbName = process.env.DB_NAME || 'milk_can_mes'
    const dbUser = process.env.DB_USER || 'root'
    const dbPass = Boolean(process.env.DB_PASSWORD)
    const storage = process.env.DB_STORAGE || './data/milk_can_mes.sqlite'

    let version = ''
    let tableCount = 0
    let sizeBytes = 0
    let charset = ''

    try {
      if (dialect === 'mysql') {
        // MySQL: 查询版本、表数、大小、字符集
        const versionRows = await sequelize.query<{ version: string }>(`SELECT VERSION() AS version`, { type: QueryTypes.SELECT })
        version = versionRows[0]?.version || ''

        const tables = await sequelize.query<{ TABLE_NAME: string; TABLE_ROWS: number; DATA_LENGTH: number; INDEX_LENGTH: number }>(
          `SELECT TABLE_NAME, TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH FROM information_schema.TABLES WHERE TABLE_SCHEMA = :db ORDER BY TABLE_NAME`,
          { replacements: { db: dbName }, type: QueryTypes.SELECT }
        )
        tableCount = tables.length
        sizeBytes = tables.reduce((sum, t) => sum + Number(t.DATA_LENGTH || 0) + Number(t.INDEX_LENGTH || 0), 0)

        const charsetRows = await sequelize.query<{ charset: string }>(
          `SELECT DEFAULT_CHARACTER_SET_NAME AS charset FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = :db`,
          { replacements: { db: dbName }, type: QueryTypes.SELECT }
        )
        charset = charsetRows[0]?.charset || ''
      } else {
        // SQLite
        version = 'SQLite'
        try {
          const vRows = await sequelize.query<{ sqlite_version: string }>(`SELECT sqlite_version() AS sqlite_version`, { type: QueryTypes.SELECT })
          version = `SQLite ${vRows[0]?.sqlite_version || ''}`
        } catch { /* ignore */ }

        const tableRows = await sequelize.query<{ name: string }>(
          `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`,
          { type: QueryTypes.SELECT }
        )
        tableCount = tableRows.length

        const storagePath = path.resolve(process.cwd(), storage)
        if (fs.existsSync(storagePath)) {
          sizeBytes = fs.statSync(storagePath).size
        }
        charset = 'UTF-8'
      }
    } catch (err: any) {
      logger.warn('读取数据库详情失败（部分信息可能缺失）:', err?.message)
    }

    return success(res, {
      dialect,
      connection_status: 'connected',
      host: dbHost,
      port: dbPort,
      database: dbName,
      username: dbUser,
      password_set: dbPass,
      storage: storage,
      version,
      size: sizeBytes,
      table_count: tableCount,
      charset,
    }, '获取数据库信息成功')
  } catch (err: any) {
    logger.error('获取数据库信息失败', err)
    return fail(res, '获取数据库信息失败', ErrorCode.SYSTEM_ERROR)
  }
}

export const listTableRecords = async (req: Request, res: Response) => {
  try {
    const { table_name } = req.params as { table_name?: string }
    const table = String(table_name || '').trim()
    if (!/^[a-zA-Z0-9_]+$/.test(table)) return fail(res, '非法表名', ErrorCode.PARAM_INVALID)
    const { page, pageSize, offset, limit } = parsePagination(req.query as Record<string, any>)
    // 安全白名单：二次校验表名确实存在于 information_schema（防止 SQL 注入拼接反引号等绕过）
    const dialect = process.env.DB_DIALECT || 'sqlite'
    const dbName = process.env.DB_NAME || 'milk_can_mes'
    let exists = false
    if (dialect === 'mysql') {
      const chk = await sequelize.query<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = :db AND TABLE_NAME = :t`,
        { replacements: { db: dbName, t: table }, type: QueryTypes.SELECT }
      )
      exists = Number(chk?.[0]?.cnt || 0) > 0
    } else {
      const chk = await sequelize.query<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name = :t`,
        { replacements: { t: table }, type: QueryTypes.SELECT }
      )
      exists = Array.isArray(chk) && chk.length > 0
    }
    if (!exists) return fail(res, '表不存在', ErrorCode.RECORD_NOT_FOUND)

    const [{ count }] = await sequelize.query<{ count: number }>(`SELECT COUNT(*) AS count FROM \`${table}\``, { type: QueryTypes.SELECT })
    const rows = await sequelize.query(`SELECT * FROM \`${table}\` LIMIT :limit OFFSET :offset`, { replacements: { limit, offset }, type: QueryTypes.SELECT })

    // 同时返回 fields：列的元信息（字段名列表供前端动态渲染列）
    let fields: Array<{ field: string; data_type?: string; comment?: string; nullable?: string }> = []
    if (dialect === 'mysql') {
      fields = (await sequelize.query<any>(
        `SELECT COLUMN_NAME AS field, DATA_TYPE AS data_type, IS_NULLABLE AS nullable, COLUMN_COMMENT AS comment ` +
        `FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = :db AND TABLE_NAME = :t ORDER BY ORDINAL_POSITION`,
        { replacements: { db: dbName, t: table }, type: QueryTypes.SELECT }
      )) as any[]
    } else {
      const pragma = await sequelize.query<any>(`PRAGMA table_info(\`${table}\`)`, { type: QueryTypes.SELECT }) as any[]
      fields = pragma.map(col => ({
        field: col.name, data_type: col.type, nullable: col.notnull ? 'NO' : 'YES', comment: ''
      }))
    }

    return success(res, { list: rows, total: Number(count), fields }, '获取成功')
  } catch (err: any) {
    logger.error(`获取表数据失败: ${req.params?.table_name || req.params?.table}`, err)
    return fail(res, `获取表数据失败: ${err.message || '未知错误'}`, ErrorCode.SYSTEM_ERROR)
  }
}
