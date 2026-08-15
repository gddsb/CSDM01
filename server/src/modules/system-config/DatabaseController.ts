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
      return { name, size: stat.size, created_at: stat.birthtime || stat.mtime }
    }).sort((a, b) => Number(b.created_at) - Number(a.created_at))
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
    const dbName = process.env.DB_NAME || 'milk_can_mes'
    const dbUser = process.env.DB_USER || 'root'
    const dbPass = process.env.DB_PASSWORD || ''
    const cmd = `mysqldump -u${dbUser} -p${dbPass} --single-transaction --routines --triggers ${dbName} > "${file}"`
    await new Promise<void>((resolve, reject) => {
      import('child_process').then(({ exec }) => {
        exec(cmd, (err) => err ? reject(err) : resolve())
      })
    })
    return success(res, { file: path.basename(file), size: fs.statSync(file).size })
  } catch (err: any) {
    logger.error('创建备份失败', err)
    return fail(res, `创建备份失败: ${err.message}`, ErrorCode.SYSTEM_ERROR)
  }
}

export const restoreBackup = async (req: Request, res: Response) => {
  try {
    const { file } = req.body as { file?: string }
    if (!file || /[\\/]/.test(file)) return fail(res, '非法文件名', ErrorCode.PARAM_INVALID)
    const full = path.join(ensureBackupDir(), file)
    if (!fs.existsSync(full)) return fail(res, '备份文件不存在', ErrorCode.RECORD_NOT_FOUND)
    const dbName = process.env.DB_NAME || 'milk_can_mes'
    const dbUser = process.env.DB_USER || 'root'
    const dbPass = process.env.DB_PASSWORD || ''
    const cmd = `mysql -u${dbUser} -p${dbPass} ${dbName} < "${full}"`
    await new Promise<void>((resolve, reject) => {
      import('child_process').then(({ exec }) => {
        exec(cmd, (err) => err ? reject(err) : resolve())
      })
    })
    return success(res, { restored: file })
  } catch (err: any) {
    logger.error('恢复备份失败', err)
    return fail(res, `恢复备份失败: ${err.message}`, ErrorCode.SYSTEM_ERROR)
  }
}

export const deleteBackup = async (req: Request, res: Response) => {
  try {
    const { file } = req.params as { file: string }
    if (!file || /[\\/]/.test(file)) return fail(res, '非法文件名', ErrorCode.PARAM_INVALID)
    const full = path.join(ensureBackupDir(), file)
    if (fs.existsSync(full)) fs.unlinkSync(full)
    return success(res, { deleted: file })
  } catch (err: any) {
    logger.error('删除备份失败', err)
    return fail(res, '删除备份失败', ErrorCode.SYSTEM_ERROR)
  }
}

export const getDatabaseInfo = async (_req: Request, res: Response) => {
  try {
    const dbName = process.env.DB_NAME || 'milk_can_mes'
    const tables = await sequelize.query<{ TABLE_NAME: string; TABLE_ROWS: number; DATA_LENGTH: number }>(
      `SELECT TABLE_NAME, TABLE_ROWS, DATA_LENGTH FROM information_schema.TABLES WHERE TABLE_SCHEMA = :db ORDER BY TABLE_NAME`,
      { replacements: { db: dbName }, type: QueryTypes.SELECT }
    )
    const sizeMB = tables.reduce((sum, t) => sum + Number(t.DATA_LENGTH || 0), 0) / 1024 / 1024
    return success(res, { tableCount: tables.length, sizeMB: Number(sizeMB.toFixed(2)), tables })
  } catch (err: any) {
    logger.error('获取数据库信息失败', err)
    return fail(res, '获取数据库信息失败', ErrorCode.SYSTEM_ERROR)
  }
}

export const listTableRecords = async (req: Request, res: Response) => {
  try {
    const { table } = req.params as { table: string }
    if (!/^[a-zA-Z0-9_]+$/.test(table)) return fail(res, '非法表名', ErrorCode.PARAM_INVALID)
    const { page, pageSize, offset, limit } = parsePagination(req.query as Record<string, any>)
    const [{ count }] = await sequelize.query<{ count: number }>(`SELECT COUNT(*) AS count FROM \`${table}\``, { type: QueryTypes.SELECT })
    const rows = await sequelize.query(`SELECT * FROM \`${table}\` LIMIT :limit OFFSET :offset`, { replacements: { limit, offset }, type: QueryTypes.SELECT })
    return success(res, rows, '获取成功', Number(count))
  } catch (err: any) {
    logger.error(`获取表数据失败: ${req.params.table}`, err)
    return fail(res, '获取表数据失败', ErrorCode.SYSTEM_ERROR)
  }
}
