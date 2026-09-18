/**
 * DataDictionaryService — 数据字典刷新（异步任务 + 并发）+ 查询
 */
import sequelize from '../config/database.js'
import { Sequelize, Op, QueryTypes } from 'sequelize'
import { DataDictionary } from '../models/index.js'
import { MAX_PAGE_SIZE, success, fail, ErrorCode } from '../utils/response.js'
import { logger } from '../utils/logger.js'
import { formatDateTime, nowBeijingStr } from '../utils/date.js'
import { tableCategoryMap, collectDatabaseSchema } from './DatabaseMigrationService.js'
type DictRefreshStatus = 'pending' | 'running' | 'success' | 'failed'
interface DictRefreshTask {
  taskId: string
  status: DictRefreshStatus
  totalTables: number
  processedTables: number
  currentTable: string
  message: string
  startedAt: number
  finishedAt?: number
  error?: string
  result?: { total: number; refreshed_at: string }
}
const dictRefreshTaskStore = new Map<string, DictRefreshTask>()
// 频率限制：上次刷新完成或开始的时间戳（至少 60s 才允许再次刷新）
let dictRefreshLastAt = 0
const DICT_REFRESH_MIN_INTERVAL_MS = 60 * 1000
// 允许同时只有一个刷新任务
let dictRefreshRunning = false

function generateTaskId(): string {
  return `dict_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// 并发控制工具：将 items 切分为多批次并发执行，每批 concurrency 个
export async function runConcurrently<T, R>(
  items: T[],
  worker: (item: T, idx: number) => Promise<R>,
  concurrency: number = 8,
  onProgress?: (done: number, total: number, currentItem?: T) => void,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let idx = 0
  let done = 0
  const next = async (workerIdx: number) => {
    while (idx < items.length) {
      const currentIdx = idx++
      const item = items[currentIdx]
      try {
        results[currentIdx] = await worker(item, currentIdx)
      } catch (e) {
        results[currentIdx] = e as R
      }
      done++
      if (onProgress) onProgress(done, items.length, item)
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    (_, i) => next(i),
  )
  await Promise.all(workers)
  return results
}


// 默认配置（设计文档 §2.2.2 系统配置表）

// ---- 字典刷新核心 ----
async function refreshDictionaryDataInternal(options?: {
  concurrency?: number
  onProgress?: (done: number, total: number, currentTable?: string) => void
  onPersistProgress?: (done: number, total: number, currentTable?: string) => void
}) {
  const { concurrency, onProgress, onPersistProgress } = options || {}
  const { tables, columnsMap } = await collectDatabaseSchema({
    concurrency,
    onProgress,
  })
  const now = new Date()
  // 并发执行 upsert（分批）
  const total = tables.length
  const BATCH = 16
  let upsertCount = 0
  for (let i = 0; i < tables.length; i += BATCH) {
    const batch = tables.slice(i, i + BATCH)
    await Promise.all(
      batch.map(async (t) => {
        const fields = columnsMap[t.table_name] || []
        try {
          await DataDictionary.upsert({
            table_name: t.table_name,
            category: t.category,
            purpose: t.purpose,
            field_count: t.field_count,
            record_count: t.record_count,
            fields,
            last_update: now,
          })
        } finally {
          upsertCount++
          onPersistProgress?.(upsertCount, total, t.table_name)
        }
      }),
    )
  }
  // 删除字典表中已不存在的表（数据库中已删除的表）
  const allTableNames = tables.map((t) => t.table_name)
  if (allTableNames.length > 0) {
    await DataDictionary.destroy({ where: { table_name: { [Op.notIn]: allTableNames } } })
  }
  return { total: upsertCount, refreshed_at: formatDateTime(now) }
}

// 旧导出（同步执行，用于 init-db 等内部场景）—— 保持向后兼容

// ---- 对外导出 ----
export const refreshDictionaryData = async () => refreshDictionaryDataInternal()

// 新导出：仅当字典表为空时才刷新（用于服务启动初始化，避免每次重启全表扫描）
export const refreshDictionaryDataIfEmpty = async () => {
  try {
    const n = await DataDictionary.count()
    if (n > 0) {
      logger.info(`[DataDictionary] 字典表已有 ${n} 条记录，跳过初始化扫描`)
      return { skipped: true, existing: n }
    }
  } catch (e) {
    logger.warn('[DataDictionary] 检查字典表数据失败，将执行刷新:', e?.message)
  }
  const r = await refreshDictionaryDataInternal()
  return { skipped: false, ...r }
}

// ============= 异步刷新任务：提交 + 进度查询 =============

// 执行异步刷新后台任务（不阻塞）
async function runDictRefreshAsync(task: DictRefreshTask) {
  dictRefreshRunning = true
  try {
    task.status = 'running'
    task.message = '开始扫描数据库表结构'
    const result = await refreshDictionaryDataInternal({
      concurrency: 8,
      onProgress: (done, total, cur) => {
        task.processedTables = done
        task.totalTables = total
        task.currentTable = cur || ''
        task.message = `扫描表结构 ${done}/${total}${cur ? `（当前: ${cur}）` : ''}`
      },
      onPersistProgress: (done, total, cur) => {
        task.processedTables = done
        task.totalTables = total
        task.currentTable = cur || ''
        task.message = `写入字典表 ${done}/${total}${cur ? `（当前: ${cur}）` : ''}`
      },
    })
    task.status = 'success'
    task.message = `刷新完成，共 ${result.total} 张表`
    task.result = result
    task.finishedAt = Date.now()
  } catch (e: any) {
    task.status = 'failed'
    task.error = e?.message || String(e)
    task.message = `刷新失败：${task.error}`
    task.finishedAt = Date.now()
    logger.error('[DataDictionary] 异步刷新失败:', e)
  } finally {
    dictRefreshRunning = false
    dictRefreshLastAt = Date.now()
  }
}

// POST /refresh —— 立即返回任务 ID，后台异步刷新
export const refreshDataDictionary = async (req, res) => {
  // 1) 频率限制
  const nowTs = Date.now()
  if (dictRefreshRunning) {
    // 已有任务在跑，返回当前运行中的任务
    const running = Array.from(dictRefreshTaskStore.values()).find((t) => t.status === 'running')
    if (running) {
      return success(
        res,
        { taskId: running.taskId, status: running.status, message: '已有刷新任务运行中，请稍后查询进度' },
        '已有刷新任务运行中',
      )
    }
  }
  const elapsed = nowTs - dictRefreshLastAt
  if (dictRefreshLastAt > 0 && elapsed < DICT_REFRESH_MIN_INTERVAL_MS) {
    const remain = Math.ceil((DICT_REFRESH_MIN_INTERVAL_MS - elapsed) / 1000)
    return fail(
      res,
      `刷新操作过于频繁，请在 ${remain} 秒后重试（已限制为每 60 秒最多一次）`,
      ErrorCode.RATE_LIMITED,
    )
  }
  // 2) 创建任务并立即返回
  const taskId = generateTaskId()
  const task: DictRefreshTask = {
    taskId,
    status: 'pending',
    totalTables: 0,
    processedTables: 0,
    currentTable: '',
    message: '任务已排队，即将开始执行',
    startedAt: nowTs,
  }
  dictRefreshTaskStore.set(taskId, task)
  // 最多保留最近 20 个任务记录
  if (dictRefreshTaskStore.size > 20) {
    const oldestFirst = Array.from(dictRefreshTaskStore.keys()).slice(0, dictRefreshTaskStore.size - 20)
    oldestFirst.forEach((k) => dictRefreshTaskStore.delete(k))
  }
  // 异步启动（不 await）
  setImmediate(() => runDictRefreshAsync(task))
  return success(res, { taskId, status: task.status, message: task.message }, '刷新任务已提交，可通过 taskId 查询进度')
}

// GET /refresh/:taskId —— 查询刷新任务进度
export const getRefreshProgress = async (req, res) => {
  const { taskId } = req.params
  if (!taskId) return fail(res, 'taskId 不能为空', ErrorCode.PARAM_INVALID)
  const task = dictRefreshTaskStore.get(taskId)
  if (!task) return fail(res, '任务不存在或已过期', ErrorCode.RECORD_NOT_FOUND)
  const payload = {
    taskId: task.taskId,
    status: task.status,
    totalTables: task.totalTables,
    processedTables: task.processedTables,
    currentTable: task.currentTable,
    message: task.message,
    progressPercent:
      task.totalTables > 0 ? Math.min(100, Math.round((task.processedTables / task.totalTables) * 100)) : 0,
    startedAt: task.startedAt ? formatDateTime(task.startedAt) : null,
    finishedAt: task.finishedAt ? formatDateTime(task.finishedAt) : null,
    error: task.error || null,
    result: task.result || null,
  }
  return success(res, payload, '查询成功')
}

// 查询数据字典列表（服务端筛选+分页）
export const listDataDictionary = async (req, res) => {
  try {
    const { keyword, category, page = 1, pageSize = 30 } = req.query
    const where: any = {}
    if (keyword) {
      where[Op.or] = [
        { table_name: { [Op.like]: `%${keyword}%` } },
        { purpose: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (category) {
      where.category = category
    }
    const limit = Math.min(parseInt(pageSize, 10) || 30, 200)
    const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit
    const { rows, count } = await DataDictionary.findAndCountAll({
      where,
      order: [
        // 按分类排序：系统表/基础数据表/业务表/其他
        sequelize.literal(`CASE category WHEN '系统表' THEN 0 WHEN '基础数据表' THEN 1 WHEN '业务表' THEN 2 ELSE 3 END`),
        // 业务表按自定义顺序排序
        sequelize.literal(`CASE table_name 
          WHEN 'production_order' THEN 0
          WHEN 'production_work_order' THEN 1
          WHEN 'production_process_report' THEN 2
          WHEN 'production_manpower_record' THEN 3
          WHEN 'production_process_exception' THEN 4
          WHEN 'production_process_defect' THEN 5
          WHEN 'production_process_material' THEN 6
          ELSE 999
        END`),
        ['table_name', 'ASC'],
      ],
      limit,
      offset,
    })
    return success(res, { list: rows, total: count }, '获取成功')
  } catch (err) {
    logger.error('查询数据字典失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

