import { Op, fn, col, where as seqWhere } from 'sequelize'
import {
  TaskSetting, SyncTask, ScheduledTask, U9Item, U9Customer, U9ProductionOrder, U9PurchaseReceipt,
  EnvMonitor, EnvAlarm, WeatherInfo, EnergyMeterData,
  Order, ReportOrder, ReportProcess, ProcessDefect,
  ProductionLine, Device, Material, Process, Customer,
  ProductInspection, IncomingInspection, MicrobeInspection,
  InspectionStandard,
} from '../../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../../utils/response.js'
import { encryptParamsObj, decryptParamsObj } from '../../utils/crypto.js'
import { fetchU9Orgs, DEFAULT_U9_CONFIG } from '../../services/u9Service.js'
import { calcNextRunAt } from '../../services/taskScheduler.js'
import { executeRealTask } from '../../services/taskExecutor.js'
import { syncItemsToBasMaterial, syncProductionOrdersToOrder } from '../../services/u9Exporter.js'
import { formatDateTime, formatDate, nowBeijingStr, nowBeijingDateStr, nowBeijingDate } from '../../utils/date.js'

import { generateTaskBizId } from '../../controllers/AutoTaskController.js'
// 露点温度计算（考虑大气压的增强版 Magnus 公式）
// T:摄氏温度, RH:相对湿度%, P:大气压(hPa，默认1013.25)
function calcDewPoint(T: number, RH: number, P: number = 1013.25): number | null {
  if (T == null || RH == null || Number.isNaN(T) || Number.isNaN(RH)) return null
  // 饱和水汽压（Magnus公式）
  const es = 6.112 * Math.exp((17.67 * T) / (T + 243.5))
  // 增强因子（考虑大气压对饱和水汽压的修正）
  const fw = 1.0016 + 3.15e-6 * P - 0.074 / P
  // 修正后的饱和水汽压
  const ew = fw * es
  // 实际水汽压
  const e = ew * RH / 100
  if (e <= 0 || e >= ew) {
    // RH异常时退化为标准Magnus
    const es2 = 6.112 * Math.exp((17.67 * T) / (T + 243.5))
    const e2 = es2 * Math.min(100, Math.max(0, RH)) / 100
    if (e2 <= 0) return null
    const lnE2 = Math.log(e2 / 6.112)
    const Td2 = (243.5 * lnE2) / (17.67 - lnE2)
    if (Number.isNaN(Td2) || !isFinite(Td2)) return null
    return Math.round(Td2 * 10) / 10
  }
  const lnE = Math.log(e / 6.112)
  const Td = (243.5 * lnE) / (17.67 - lnE)
  if (Number.isNaN(Td) || !isFinite(Td)) return null
  return Math.round(Td * 10) / 10
}

// ============ 任务设置 ============
// ============ 采集数据 → 业务主数据迁移 ============
// 将 task_item 同步到 bas_material、task_production_order 同步到 production_order
export const syncToMasterData = async (req, res) => {
  try {
    const { type } = req.query // type: items | production_orders | all（默认 all）
    const syncType = type || 'all'
    const result: any = {}

    if (syncType === 'items' || syncType === 'all') {
      result.items = await syncItemsToBasMaterial()
    }
    if (syncType === 'production_orders' || syncType === 'all') {
      result.production_orders = await syncProductionOrdersToOrder()
    }

    return success(res, result, '同步完成')
  } catch (err) {
    console.error('同步采集数据到主数据失败:', err)
    return fail(res, err.message || '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// ============ 生产订单一键同步（采集 + 迁移） ============
// 触发 task_生产订单同步 任务，采集完成后自动将 task_production_order 按关联关系迁移到 production_order 业务表
export const syncProductionOrdersFull = async (req, res) => {
  try {
    const taskType = 'production_orders'
    const setting = await TaskSetting.findOne({ where: { task_type: taskType } })
    if (!setting) return fail(res, '任务设置不存在（task_生产订单同步），请先在自动任务中配置', ErrorCode.RECORD_NOT_FOUND)

    // 检查是否有进行中的同类任务
    const activeSame = await SyncTask.findOne({
      where: {
        task_type: taskType,
        status: { [Op.in]: ['pending', 'running'] },
      },
      order: [['task_id', 'DESC']],
    })
    if (activeSame) {
      return fail(res, `存在进行中的生产订单同步任务（${(activeSame as any).task_biz_id}），请稍后再试`, ErrorCode.BUSINESS_ERROR)
    }

    const taskBizId = generateTaskBizId(taskType)
    const syncTask = await SyncTask.create({
      task_biz_id: taskBizId,
      task_type: taskType,
      status: 'running',
      progress: 5,
      current_step: '订单同步已启动，正在采集U9生产订单...',
      steps: [{ time: nowBeijingStr(), message: '订单同步已启动，正在采集U9生产订单...', percent: 5 }],
      started_at: nowBeijingDate(),
    })

    const taskId = (syncTask as any).task_id
    const settingParams = (setting as any).params || {}
    const sourceUrl = (setting as any).source_url || undefined

    // 同步执行：U9 采集
    const collectResult = await executeRealTask(taskType, taskBizId, taskId, settingParams, sourceUrl)
    if (!collectResult.success) {
      return fail(res, `U9生产订单采集失败：${collectResult.error || '未知错误'}`, ErrorCode.BUSINESS_ERROR)
    }

    // 采集成功，更新进度并执行迁移到业务表
    try {
      const task = await SyncTask.findByPk(taskId) as any
      if (task) {
        const steps = Array.isArray(task.steps) ? [...task.steps] : []
        steps.push({ time: nowBeijingStr(), message: '采集完成，正在按关联关系同步到生产订单业务表...', percent: 95 })
        task.progress = 95
        task.current_step = '采集完成，正在同步到生产订单业务表...'
        task.steps = steps
        await task.save()
      }
    } catch (e) { /* ignore */ }

    const migrated = await syncProductionOrdersToOrder()

    // 完成进度
    try {
      const task = await SyncTask.findByPk(taskId) as any
      if (task) {
        const steps = Array.isArray(task.steps) ? [...task.steps] : []
        steps.push({ time: nowBeijingStr(), message: `订单同步完成：采集 ${collectResult.totalRecords || 0} 条，业务表新增 ${migrated.inserted}、更新 ${migrated.updated}`, percent: 100 })
        task.progress = 100
        task.current_step = '订单同步完成'
        task.status = 'completed'
        task.total_records = collectResult.totalRecords || 0
        task.ended_at = new Date()
        task.steps = steps
        await task.save()
      }
    } catch (e) { /* ignore */ }

    return success(res, {
      task_biz_id: taskBizId,
      collected: collectResult.totalRecords || 0,
      migrated,
    }, `订单同步完成：采集 ${collectResult.totalRecords || 0} 条，业务表新增 ${migrated.inserted} 条、更新 ${migrated.updated} 条`)
  } catch (err: any) {
    console.error('生产订单一键同步失败:', err)
    return fail(res, err.message || '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

