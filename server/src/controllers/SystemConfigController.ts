/**
 * SystemConfigController — 已拆分为 3 个 Service
 * • SystemConfigService      → 配置 CRUD + 60s 缓存 + initDefaultConfigs
 * • DatabaseMigrationService → 静态元数据 + 迁移目标 + collectSchema + migrateDatabase
 * • DataDictionaryService   → 字典刷新（异步并发）+ 进度查询 + list
 * 本文件保留所有原始命名导出（routes/system.ts + app.ts + init-db.ts 依赖）
 */
import SystemConfigService, { clearSysConfigCache } from '../services/SystemConfigService.js'
import * as MigrationSvc from '../services/DatabaseMigrationService.js'
import * as DictSvc from '../services/DataDictionaryService.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import type { Request, Response } from 'express'

// 保持 clearSysConfigCache 为命名导出（RoleService 等依赖）
export { clearSysConfigCache }

// ---- 配置 CRUD + initDefaultConfigs ----
export const getConfig = async (req: Request, res: Response) => {
  try { return success(res, await SystemConfigService.getConfig(), '获取成功') }
  catch (err: any) { return fail(res, err?.message || '服务器错误', ErrorCode.SYSTEM_ERROR) }
}

export const saveConfig = async (req: Request, res: Response) => {
  try {
    const username = (req as any).user?.username || 'system'
    await SystemConfigService.saveConfig(req.body, username)
    return success(res, null, '保存成功')
  } catch (err: any) { return fail(res, err?.message || '服务器错误', ErrorCode.SYSTEM_ERROR) }
}

/** app.ts / init-db.ts 直接调用 — 内部无 req/res */
export const initDefaultConfigs = async () => SystemConfigService.initDefaultConfigs()

// ---- 数据库迁移 ----
export const getMigrationTargets = async (req: Request, res: Response) => {
  try {
    const currentDialect = process.env.DB_DIALECT || 'sqlite'
    const targets = [
      { dialect: 'sqlite', name: 'SQLite（开发/单机版）', default_port: '-', default_storage: './data/milk_can_mes.sqlite', description: '嵌入式数据库，无需安装，适合开发演示与单机部署' },
      { dialect: 'mysql', name: 'MySQL 8（生产环境）', default_port: 3306, description: '推荐的生产级数据库，支持高并发与完整事务' },
      { dialect: 'postgres', name: 'PostgreSQL（高级环境）', default_port: 5432, description: '支持更复杂的查询与扩展类型，适合数据分析场景' },
      { dialect: 'mariadb', name: 'MariaDB（开源兼容）', default_port: 3306, description: 'MySQL 的开源分支，兼容 MySQL 协议' },
    ]
    const list = targets.map(t => ({ ...t, is_current: t.dialect === currentDialect }))
    return success(res, { current: currentDialect, targets: list }, '获取成功')
  } catch (err: any) { return fail(res, err?.message || '服务器错误', ErrorCode.SYSTEM_ERROR) }
}

export const migrateDatabase = (req: Request, res: Response) => MigrationSvc.migrateDatabase(req, res)

// ---- 数据字典 ----
/** init-db.ts 直接调用（同步版本，内部执行） */
export const refreshDictionaryData = () => DictSvc.refreshDictionaryData()

/** app.ts 直接调用（仅当字典表为空时刷新） */
export const refreshDictionaryDataIfEmpty = () => DictSvc.refreshDictionaryDataIfEmpty()

export const refreshDataDictionary = (req: Request, res: Response) => DictSvc.refreshDataDictionary(req, res)
export const getRefreshProgress = (req: Request, res: Response) => DictSvc.getRefreshProgress(req, res)
export const listDataDictionary = (req: Request, res: Response) => DictSvc.listDataDictionary(req, res)

export default {
  getConfig, saveConfig, initDefaultConfigs,
  getMigrationTargets, migrateDatabase,
  refreshDictionaryData, refreshDictionaryDataIfEmpty,
  refreshDataDictionary, getRefreshProgress, listDataDictionary,
}
