/** MaintenanceRecordCrud —— 保养执行记录 CRUD */
/**
 * DeviceMaintenanceProfileService — 保养档案 + 执行工单 + 矩阵 + 运行时长
 * 从 origin/main 的 DeviceMaintenanceController.ts 抽取
 * uploadImage / processImage 涉及 fs/sharp，保留在 Controller
 */
import { Op, QueryTypes } from 'sequelize'
import sequelize from 'sequelize'
import { WILDCARD_PERM } from '../middleware/auth.js'
import {
  DeviceMaintenanceProfile, DeviceMaintenanceRecord, DeviceMaintenanceStandard,
  DeviceRuntimeLog, Device, DeviceFault, DeviceImage,
} from '../models/index.js'
import { generateDeviceFaultNo, generateDeviceRecordNo } from '../utils/sequence.js'
import { ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import { logger } from '../utils/logger.js'
import { STATUS_REVERSE } from '../models/DeviceMaintenanceRecord.js'
import {
  todayStr, dateOnlyStr, getISOWeek, buildPeriodKey, parseMultiStatus,
  dailyPeriodKeys, weeklyPeriodKeys, parseMonthlyPlan, monthlyStandardActive,
} from '../utils/maintenanceMatrix.js'
import { rawStatus, getRecordDetail } from './MaintenanceProfileCrud.js'

export async function listRecords(query: any) {
const {
        page = 1, pageSize = 20,
        record_no, device_id, device_name, device_code,
        trigger_mode, status, period_key,
        start_date, end_date,
        keyword, month,
        extra, mine, currentUser,
      } = query

      const where: any = {}
      if (record_no) where.record_no = { [Op.like]: `%${record_no}%` }
      if (device_id) where.device_id = device_id
      if (device_name) where.device_name = { [Op.like]: `%${device_name}%` }
      if (device_code) where.device_code = { [Op.like]: `%${device_code}%` }
      if (trigger_mode) where.trigger_mode = trigger_mode.includes(',')
        ? { [Op.in]: trigger_mode.split(',').map((s: string) => s.trim()).filter(Boolean) }
        : trigger_mode
      if (period_key) where.period_key = period_key.includes(',')
        ? { [Op.in]: period_key.split(',').map((s: string) => s.trim()).filter(Boolean) }
        : period_key

      // keyword: 同时搜 device_code / device_name / record_no
      if (keyword) {
        where[Op.and] = where[Op.and] || []
        where[Op.and].push({
          [Op.or]: [
            { device_code: { [Op.like]: `%${keyword}%` } },
            { device_name: { [Op.like]: `%${keyword}%` } },
            { record_no: { [Op.like]: `%${keyword}%` } },
          ],
        })
      }

      // month: YYYY-MM，按 period_key 过滤：
      //   daily   = YYYY-MM-DD → LIKE prefix
      //   monthly = YYYY-MM   → exact
      //   weekly  = YYYY-Www  → IN(当月所有 ISO 周)
      if (month && /^\d{4}-\d{2}$/.test(String(month))) {
        const [yr, mo] = String(month).split('-').map(Number)
        where[Op.and] = where[Op.and] || []
        where[Op.and].push({
          [Op.or]: [
            { period_key: { [Op.like]: `${month}%` } },
            { period_key: month },
            { period_key: { [Op.in]: weeklyPeriodKeys(yr, mo) } },
          ],
        })
      }

      const statusArr = parseMultiStatus(status, STATUS_REVERSE)
      if (statusArr) where.status = { [Op.in]: statusArr }

      if (start_date || end_date) {
        where.created_at = {}
        if (start_date) where.created_at[Op.gte] = new Date(start_date as string)
        if (end_date) where.created_at[Op.lte] = new Date(`${end_date} 23:59:59`)
      }

      // 历史记录模式：不再强制过滤状态和日期范围
      // 用户选什么范围/状态就查什么范围/状态；不选就全部返回
      if (extra === 'history') {
        // 已到期/未到期/已完成/未完成 全部包含
        // 让前端 filters.status 自己决定；statusArr 没传就是全部
        if (statusArr && statusArr.length) {
          where.status = { [Op.in]: statusArr }
        }
      }

      // mine=true → 只看当前登录人负责/检查的设备（有 device:maintenance:view_all 权限的角色看全部）
      const mineUid = Number((currentUser as any)?.userId ?? (currentUser as any)?.user_id ?? 0)
      const permCodes: Set<string> = (currentUser as any)?.permCodes ?? new Set()
      const hasViewAll = permCodes.has(WILDCARD_PERM) || permCodes.has('device:maintenance:view_all')
      if (mine === 'true' && mineUid > 0 && !hasViewAll) {
        where[Op.or] = [
          { responsible_user_id: mineUid },
          { inspector_user_id: mineUid },
        ]
      }

      const pageNum = Math.max(1, Number(page) || 1)
      // 保养计划列表需要全量返回（前端按设备分组 + 完成度统计）
      // 去掉 MAX_PAGE_SIZE clamp —— DB 全量才 5k 条，MySQL 毫秒级响应
      const finalPageSize = Math.max(1, Number(pageSize) || 5000)

      const { count, rows } = await DeviceMaintenanceRecord.findAndCountAll({
        where,
        order: [['device_id', 'ASC'], ['trigger_mode', 'ASC'], ['period_key', 'ASC'], ['record_id', 'ASC']],
        limit: finalPageSize,
        offset: (pageNum - 1) * finalPageSize,
        include: [
          {
            model: DeviceMaintenanceStandard,
            as: 'standard',
            attributes: ['standard_id', 'maintenance_content', 'mechanism', 'component', 'location'],
            required: false,
          },
        ],
      })

      return { list: rows, total: count, page: pageNum, pageSize: finalPageSize }
}

/** 设备当日维保汇总：每个设备今日生成的 {total, done}
 *  用于移动端设备列表卡片展示 "当日已完成/总数"
 *  统计口径：period_key ∈ {今天日点检, 本周周保养, 本月月保养}
 */
export async function dailySummary(dateStr?: string): Promise<Record<number, { total: number; done: number }>> {
  const d = dateStr ? new Date(dateStr) : new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const dateOnly = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  // ISO 周号
  const tmp = new Date(d)
  tmp.setDate(tmp.getDate() + 4 - (tmp.getDay() || 7))
  const yearStart = new Date(tmp.getFullYear(), 0, 1)
  const weekNum = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  const weekKey = `${tmp.getFullYear()}-W${pad(weekNum)}`
  const monthKey = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
  const keys = [dateOnly, weekKey, monthKey]

  const rows: any[] = await DeviceMaintenanceRecord.sequelize.query(
    `SELECT device_id, COUNT(*) AS total, SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) AS done
     FROM device_record
     WHERE period_key IN (:keys)
     GROUP BY device_id`,
    { replacements: { keys }, type: QueryTypes.SELECT },
  )
  const map: Record<number, { total: number; done: number }> = {}
  for (const r of rows) {
    map[Number(r.device_id)] = { total: Number(r.total) || 0, done: Number(r.done) || 0 }
  }
  return map
}

export async function detailRecord(id: number) {

      const detail = await getRecordDetail(Number(id))
      if (!detail) throw new AppError('执行记录不存在', ErrorCode.RECORD_NOT_FOUND)
      return detail
}

export async function startRecord(id: number, body: any, user?: any) {
const t = await DeviceMaintenanceRecord.sequelize.transaction()
    try {
      const userInfo: any = user || {}
      const { start_time, executor_id, executor_name } = body || {}

      const record = await DeviceMaintenanceRecord.findOne({ where: { record_id: id }, transaction: t })
      if (!record) throw new AppError('执行记录不存在', ErrorCode.RECORD_NOT_FOUND)

      const s = rawStatus(record)
      if (s !== 0 && s !== 3) {
        throw new AppError('当前状态不允许开始执行', ErrorCode.BUSINESS_ERROR)
      }

      await record.update({
        status: 1,
        start_time: start_time ? new Date(start_time) : new Date(),
        executor_id: executor_id || userInfo.userId || null,
        executor_name: executor_name || userInfo.username || '',
      }, { transaction: t })

      await t.commit()
      const detail = await getRecordDetail(Number(id))
      return detail
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      throw new AppError(err.message || '操作失败', ErrorCode.SYSTEM_ERROR)
    }
}

export async function submitRecord(id: number, body: any, user?: any) {
const t = await DeviceMaintenanceRecord.sequelize.transaction()
    try {
      const userInfo: any = user || {}
      const {
        result, actual_value, abnormal_desc, executor_id, executor_name,
        maintenance_content, spare_parts_used, duration_min, end_time, remarks,
      } = body || {}

      const record = await DeviceMaintenanceRecord.findOne({ where: { record_id: id }, transaction: t })
      if (!record) {
        throw new AppError('执行记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      if (!result) throw new AppError('执行结果不能为空（正常/异常）', ErrorCode.PARAM_INVALID)

      const now = end_time ? new Date(end_time) : new Date()
      const nowStr = now.toLocaleString('zh-CN', { hour12: false })
      const deviceId = record.getDataValue('device_id')
      const deviceCode = record.getDataValue('device_code')
      const deviceName = record.getDataValue('device_name')

      // 计算耗时
      let finalDuration = duration_min !== undefined ? duration_min : null
      if (finalDuration === null) {
        const st = record.getDataValue('start_time')
        if (st) finalDuration = Math.max(1, Math.round((now.getTime() - new Date(st).getTime()) / 60000))
      }

      const recordUpdate: any = {
        status: 2,
        result,
        actual_value: actual_value || null,
        abnormal_desc: result === '异常' ? (abnormal_desc || '') : '',
        maintenance_content: maintenance_content || null,
        spare_parts_used: Array.isArray(spare_parts_used) ? spare_parts_used : null,
        end_time: now,
        duration_min: finalDuration,
        remarks: remarks !== undefined ? remarks : (record as any).remarks,
      }
      if (!record.getDataValue('executor_id') && !record.getDataValue('executor_name')) {
        recordUpdate.executor_id = executor_id || userInfo.userId || null
        recordUpdate.executor_name = executor_name || userInfo.username || ''
      } else {
        if (executor_id !== undefined) recordUpdate.executor_id = executor_id
        if (executor_name !== undefined) recordUpdate.executor_name = executor_name
      }

      await record.update(recordUpdate, { transaction: t })

      // 自检查：执行人提交 = status=2 时，若 executor_id === inspector_user_id（或 inspector_user_id 为空兜底），
      // 自动写入 inspector_executor_id / _name / inspected_at
      // 严格幂等：inspector_executor_id 已有值就不覆盖（后面检查人不能抢首个记录）
      const currInspectorExecutor = record.getDataValue('inspector_executor_id')
      if (!currInspectorExecutor) {
        const execId = recordUpdate.executor_id ?? record.getDataValue('executor_id')
        const execName = recordUpdate.executor_name ?? record.getDataValue('executor_name')
        const inspId = record.getDataValue('inspector_user_id')
        // 自检查触发条件：执行人 = 计划检查人 或 计划检查人为空（无人指定就默认为执行人自检查）
        const isSelfInspect = inspId === null || inspId === undefined || execId === inspId
        if (isSelfInspect && execId) {
          await record.update({
            inspector_executor_id: execId,
            inspector_executor_name: execName || null,
            inspected_at: now,
          }, { transaction: t })
        }
      }

      // 异常自动创建故障工单
      let faultId: number | null = null
      if (result === '异常') {
        const standard = record.getDataValue('standard_id')
          ? await DeviceMaintenanceStandard.findOne({ where: { standard_id: record.getDataValue('standard_id') }, transaction: t })
          : null
        const itemName = standard?.getDataValue('maintenance_content') || '未知保养项'
        const faultNo = await generateDeviceFaultNo()
        const fault = await DeviceFault.create({
          fault_no: faultNo,
          device_id: deviceId,
          device_code: deviceCode,
          device_name: deviceName,
          fault_level: 1,
          fault_desc: `保养异常：${itemName}`,
          fault_time: now,
          impact_desc: abnormal_desc || '',
          status: 0,
          reporter_id: recordUpdate.executor_id || null,
          reporter_name: recordUpdate.executor_name || '',
          source: '保养异常',
          related_inspection_id: Number(id),
          remarks: `由保养执行记录#${id}自动生成`,
        }, { transaction: t })
        faultId = (fault as any).fault_id
      }


      await t.commit()
      const detail = await getRecordDetail(Number(id))
      return detail
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      throw new AppError(err.message || '提交失败', ErrorCode.SYSTEM_ERROR)
    }
}

export async function batchSubmit(body: any, user?: any) {
const t = await DeviceMaintenanceRecord.sequelize.transaction()
    try {
      const userInfo: any = user || {}
      const items = Array.isArray(body?.records) ? body.records : []
      if (items.length === 0) throw new AppError('提交项不能为空', ErrorCode.PARAM_INVALID)

      const updated: any[] = []
      const abnormalFaults: any[] = []

      for (const payload of items) {
        const record = await DeviceMaintenanceRecord.findOne({ where: { record_id: payload.record_id }, transaction: t })
        if (!record) continue
        const newStatus = payload.status || 2
        const now = new Date()

        const updateData: any = {
          status: newStatus,
        }
        if (payload.result !== undefined) updateData.result = payload.result
        if (payload.actual_value !== undefined) updateData.actual_value = payload.actual_value || null
        if (payload.abnormal_desc !== undefined && payload.result === '异常') {
          updateData.abnormal_desc = payload.abnormal_desc
        }
        if (newStatus === 2) {
          updateData.end_time = now
          if (!record.getDataValue('executor_id') && (payload.executor_id || userInfo.userId)) {
            updateData.executor_id = payload.executor_id || userInfo.userId
            updateData.executor_name = payload.executor_name || userInfo.username || ''
          }
        }

        await record.update(updateData, { transaction: t })
        updated.push({ record_id: payload.record_id, status: newStatus })

        // 异常自动转故障
        if (payload.result === '异常') {
          const standard = record.getDataValue('standard_id')
            ? await DeviceMaintenanceStandard.findOne({ where: { standard_id: record.getDataValue('standard_id') }, transaction: t })
            : null
          const itemName = standard?.getDataValue('maintenance_content') || '未知保养项'
          const faultNo = await generateDeviceFaultNo()
          const fault = await DeviceFault.create({
            fault_no: faultNo,
            device_id: record.getDataValue('device_id'),
            device_code: record.getDataValue('device_code'),
            device_name: record.getDataValue('device_name'),
            fault_level: 1,
            fault_desc: `保养异常：${itemName}`,
            fault_time: now,
            impact_desc: payload.abnormal_desc || '',
            status: 0,
            reporter_id: updateData.executor_id || null,
            reporter_name: updateData.executor_name || '',
            source: '保养异常',
            related_inspection_id: record.getDataValue('record_id'),
            remarks: `由保养执行记录#${payload.record_id}自动生成（批量提交）`,
          }, { transaction: t })
          abnormalFaults.push({ fault_id: fault.fault_id, fault_no: fault.fault_no })
        }
      }

      await t.commit()
      return {
        updated: updated.length,
        abnormal_count: abnormalFaults.length,
        abnormal_faults: abnormalFaults,
      }
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      throw new AppError(err.message || '批量提交失败', ErrorCode.SYSTEM_ERROR)
    }
}

/** confirmInspect — 检查人首次打开已完成记录 = 自动标记检查
 *  严格幂等：inspector_executor_id 已有值 → 不覆盖（后面的人不能抢首个记录）
 */
export async function confirmInspect(id: number, user?: any) {
  const userInfo: any = user || {}
  const uid = Number(userInfo.userId ?? userInfo.user_id ?? 0)
  const username = userInfo.username || userInfo.real_name || ''
  const permCodes: Set<string> = userInfo.permCodes ?? new Set()
  const hasViewAll = permCodes.has('*') || permCodes.has('device:maintenance:view_all')

  const record = await DeviceMaintenanceRecord.findOne({ where: { record_id: id } })
  if (!record) throw new AppError('执行记录不存在', ErrorCode.RECORD_NOT_FOUND)

  // 权限：有 view_all 或 inspector_user_id 包含当前用户
  const inspId = Number(record.getDataValue('inspector_user_id'))
  const assigned = record.getDataValue('responsible_user_ids')  // JSON array
  const isInspector = inspId === uid || (Array.isArray(assigned) && assigned.includes(uid))
  if (!hasViewAll && !isInspector) {
    throw new AppError('权限不足：仅计划检查人或设备管理员可标记检查', ErrorCode.PERMISSION_DENIED)
  }

  // 必须已完成
  if (Number(record.getDataValue('status')) !== 2) {
    throw new AppError('只有已完成(status=2)的记录才允许标记检查', ErrorCode.PARAM_INVALID)
  }

  const existingExecutor = record.getDataValue('inspector_executor_id')
  if (existingExecutor) {
    // 严格幂等：已存在就返回，不覆盖
    return { already: true, record_id: id, inspector_executor_id: existingExecutor }
  }

  // 检查人可以是执行人本人（自检查兜底）或计划检查人
  const executorId = Number(record.getDataValue('executor_id'))
  const finalExecutorId = uid > 0 ? uid : (executorId || null)
  const finalExecutorName = uid > 0 ? username : (record.getDataValue('executor_name') || null)

  await record.update({
    inspector_executor_id: finalExecutorId,
    inspector_executor_name: finalExecutorName,
    inspected_at: new Date(),
  })

  return {
    already: false,
    record_id: id,
    inspector_executor_id: finalExecutorId,
    inspector_executor_name: finalExecutorName,
    inspected_at: record.getDataValue('inspected_at'),
  }
}

export async function skipRecord(id: number, body: any, user?: any) {

      const record = await DeviceMaintenanceRecord.findOne({ where: { record_id: id } })
      if (!record) throw new AppError('执行记录不存在', ErrorCode.RECORD_NOT_FOUND)
      const s = rawStatus(record)
      if (s === 1) throw new AppError('执行中的记录不允许跳过，请到完成保养后提交结果', ErrorCode.BUSINESS_ERROR)
      if (s === 2) throw new AppError('已完成的记录不能跳过', ErrorCode.BUSINESS_ERROR)
      await record.update({ status: 3 })
      return null
}

export async function deleteRecord(id: number) {
const t = await DeviceMaintenanceRecord.sequelize.transaction()
    try {
      const record = await DeviceMaintenanceRecord.findOne({ where: { record_id: id }, transaction: t })
      if (!record) throw new AppError('执行记录不存在', ErrorCode.RECORD_NOT_FOUND)

      const s = rawStatus(record)
      if (s === 1) throw new AppError('执行中的保养记录不允许删除，请先完成或跳过', ErrorCode.BUSINESS_ERROR)
      if (s === 2) throw new AppError('已完成的保养记录不允许删除', ErrorCode.BUSINESS_ERROR)

      // 级联删图片
      await DeviceImage.destroy({ where: { doc_type: 'maintenance', doc_id: id }, transaction: t })
      await record.destroy({ transaction: t })

      await t.commit()
      return { message: '删除成功' }
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      throw new AppError(err.message || '删除失败', ErrorCode.SYSTEM_ERROR)
    }
}
