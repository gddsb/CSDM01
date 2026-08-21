import path from 'path'
import fs from 'fs'
import { Op } from 'sequelize'
import {
  DeviceMaintenanceStandard,
  DeviceMaintenanceRecord,
  DeviceRuntimeLog,
  Device,
  DeviceImage,
} from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { generateDeviceMaintenanceNo } from '../utils/sequence.js'
import { logger } from '../utils/logger.js'
import { STATUS_REVERSE } from '../models/DeviceMaintenanceRecord.js'

// 触发方式
const TRIGGER_CYCLE = '周期'
const TRIGGER_RUNTIME = '运行时长'

// 未完成工单状态集合：0=待执行, 1=执行中, 3=已挂起（不含 2=已完成）
const UNFINISHED_STATUS = [0, 1, 3]

// 状态数值反向映射：字符串状态名 → 数值（model 的 status getter 会把 0/1/2/3 转成中文，
// 列表查询场景下需要把中文/数字混用的查询参数统一为数值集合）
const parseMultiStatus = (status: any): number[] | null => {
  if (status === undefined || status === '' || status === null) return null
  const arr = Array.isArray(status) ? status : [status]
  const nums: number[] = []
  arr.forEach((s: any) => {
    if (typeof s === 'string' && s.includes(',')) {
      s.split(',').forEach((p: string) => {
        const n = STATUS_REVERSE[p] !== undefined ? STATUS_REVERSE[p] : Number(p)
        if (!Number.isNaN(n)) nums.push(n)
      })
    } else {
      const n = STATUS_REVERSE[s] !== undefined ? STATUS_REVERSE[s] : Number(s)
      if (!Number.isNaN(n)) nums.push(n)
    }
  })
  return nums.length ? nums : null
}

// 取数值化的状态值（绕过 model 的 getter），便于状态流转判断
const rawStatus = (record: any): number => {
  return record.getDataValue('status')
}

// 当天日期（YYYY-MM-DD）
function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

// 格式化 Date → YYYY-MM-DD
function dateOnlyStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

// 根据周期值/单位计算下次维护日期
// baseDate 为空时以今天为基准（首次维护场景）
function computeNextDate(baseDate: string | null, cycleValue: number, cycleUnit: string): string {
  const base = baseDate ? new Date(baseDate) : new Date()
  const d = new Date(base)
  const cv = Number(cycleValue) || 0
  switch (cycleUnit) {
    case '天':
      d.setDate(d.getDate() + cv)
      break
    case '周':
      d.setDate(d.getDate() + cv * 7)
      break
    case '月':
      d.setMonth(d.getMonth() + cv)
      break
    case '季':
      d.setMonth(d.getMonth() + cv * 3)
      break
    default:
      d.setDate(d.getDate() + cv)
  }
  return dateOnlyStr(d)
}

// 获取设备最新累计运行时长（小时）
async function getLatestRuntime(deviceId: number, t?: any): Promise<number> {
  const log = await DeviceRuntimeLog.findOne({
    where: { device_id: deviceId },
    order: [['created_at', 'DESC'], ['log_id', 'DESC']],
    transaction: t,
  })
  return log ? Number((log as any).getDataValue('runtime_hours')) : 0
}

// 获取维护工单详情（含维护标准与维护图片）
async function getDetail(id: number) {
  const record = await DeviceMaintenanceRecord.findOne({
    where: { record_id: id },
    include: [
      {
        model: DeviceMaintenanceStandard,
        as: 'standard',
        required: false,
      },
      {
        model: DeviceImage,
        as: 'maintenance_images',
        required: false,
        separate: true,
        order: [['sort_order', 'ASC'], ['image_id', 'ASC']],
      },
    ],
  })
  return record ? record.toJSON() : null
}

// 自动补全设备冗余字段，返回 { device_code, device_name }
async function loadDeviceFields(deviceId: number | undefined | null, deviceCode?: string, deviceName?: string, t?: any) {
  let finalDeviceCode = deviceCode
  let finalDeviceName = deviceName
  if ((!finalDeviceCode || !finalDeviceName) && deviceId) {
    const device = await Device.findOne({ where: { device_id: deviceId }, transaction: t })
    if (device) {
      finalDeviceCode = finalDeviceCode || (device as any).device_code
      finalDeviceName = finalDeviceName || (device as any).device_name
    }
  }
  return { finalDeviceCode, finalDeviceName }
}

export default {
  // ===================== 维护标准 =====================

  /**
   * 查询维护标准列表
   * 支持按设备、设备类型、触发方式、状态、项目名称筛选
   */
  async listStandards(req: any, res: any) {
    try {
      const {
        device_id,
        device_type,
        trigger_type,
        status,
        item_name,
        standard_name,
        keyword,
      } = req.query

      const where: any = {}
      if (device_id) where.device_id = device_id
      if (device_type) where.device_type = device_type
      if (trigger_type) where.trigger_type = trigger_type
      if (status !== undefined && status !== '' && status !== null) {
        where.status = Number(status)
      }
      if (item_name) {
        where.item_name = { [Op.like]: `%${item_name}%` }
      } else if (keyword) {
        where.item_name = { [Op.like]: `%${keyword}%` }
      }
      if (standard_name) {
        where.standard_name = { [Op.like]: `%${standard_name}%` }
      }

      const rows = await DeviceMaintenanceStandard.findAll({
        where,
        include: [{ model: Device, as: 'device', required: false }],
        order: [['device_id', 'ASC'], ['standard_id', 'ASC']],
      })

      success(res, { list: rows, total: rows.length })
    } catch (err: any) {
      logger.error('[DeviceMaintenance] listStandards error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 创建维护标准
   * - 周期型：自动计算 next_maintenance_date = last_maintenance_date(或今天) + cycle
   * - 运行时长型：next_maintenance_date 留空
   */
  async createStandard(req: any, res: any) {
    const t = await DeviceMaintenanceStandard.sequelize.transaction()
    try {
      const {
        standard_name,
        device_type,
        device_id,
        device_code,
        device_name,
        item_name,
        trigger_type = TRIGGER_CYCLE,
        cycle_value,
        cycle_unit = '天',
        runtime_threshold,
        standard_requirement,
        last_maintenance_date,
        last_maintenance_runtime,
        status,
        remarks,
      } = req.body

      if (!standard_name) {
        return fail(res, '维护标准名称不能为空', ErrorCode.PARAM_INVALID)
      }
      if (!item_name) {
        return fail(res, '维护项目名称不能为空', ErrorCode.PARAM_INVALID)
      }
      if (trigger_type !== TRIGGER_CYCLE && trigger_type !== TRIGGER_RUNTIME) {
        return fail(res, '触发方式无效，可选值：周期 / 运行时长', ErrorCode.PARAM_INVALID)
      }
      if (trigger_type === TRIGGER_CYCLE && (!cycle_value || Number(cycle_value) <= 0)) {
        return fail(res, '周期型标准必须填写有效的周期值', ErrorCode.PARAM_INVALID)
      }
      if (trigger_type === TRIGGER_RUNTIME && (!runtime_threshold || Number(runtime_threshold) <= 0)) {
        return fail(res, '运行时长型标准必须填写有效的运行时长阈值', ErrorCode.PARAM_INVALID)
      }

      const { finalDeviceCode, finalDeviceName } = await loadDeviceFields(device_id, device_code, device_name, t)

      // 周期型自动计算下次维护日期
      let nextMaintenanceDate: string | null = null
      if (trigger_type === TRIGGER_CYCLE) {
        nextMaintenanceDate = computeNextDate(last_maintenance_date || null, Number(cycle_value), cycle_unit || '天')
      }

      const record = await DeviceMaintenanceStandard.create({
        standard_name,
        device_type: device_type || null,
        device_id: device_id || null,
        device_code: finalDeviceCode || null,
        device_name: finalDeviceName || null,
        item_name,
        trigger_type,
        cycle_value: cycle_value !== undefined ? cycle_value : null,
        cycle_unit: cycle_unit || '天',
        runtime_threshold: runtime_threshold !== undefined ? runtime_threshold : null,
        standard_requirement: standard_requirement || '',
        last_maintenance_date: last_maintenance_date || null,
        last_maintenance_runtime: last_maintenance_runtime !== undefined ? last_maintenance_runtime : null,
        next_maintenance_date: nextMaintenanceDate,
        status: status !== undefined ? status : 1,
        remarks: remarks || '',
      }, { transaction: t })

      await t.commit()
      success(res, record, '创建成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[DeviceMaintenance] createStandard error:', err)
      fail(res, err.message || '创建失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 更新维护标准
   * - 周期型：周期值/单位/上次维护日期变更时重算 next_maintenance_date
   */
  async updateStandard(req: any, res: any) {
    const t = await DeviceMaintenanceStandard.sequelize.transaction()
    try {
      const { id } = req.params
      const record = await DeviceMaintenanceStandard.findOne({ where: { standard_id: id }, transaction: t })
      if (!record) {
        return fail(res, '维护标准不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const {
        standard_name,
        device_type,
        device_id,
        device_code,
        device_name,
        item_name,
        trigger_type,
        cycle_value,
        cycle_unit,
        runtime_threshold,
        standard_requirement,
        last_maintenance_date,
        last_maintenance_runtime,
        status,
        remarks,
      } = req.body

      if (trigger_type !== undefined && trigger_type !== TRIGGER_CYCLE && trigger_type !== TRIGGER_RUNTIME) {
        return fail(res, '触发方式无效，可选值：周期 / 运行时长', ErrorCode.PARAM_INVALID)
      }

      // 设备冗余字段自动补全
      const targetDeviceId = device_id !== undefined ? device_id : (record as any).getDataValue('device_id')
      const existingCode = (record as any).getDataValue('device_code')
      const existingName = (record as any).getDataValue('device_name')
      const needDeviceLookup = (device_id !== undefined) || (device_code !== undefined && !device_name) || (device_name !== undefined && !device_code)
      let finalDeviceCode = device_code !== undefined ? device_code : existingCode
      let finalDeviceName = device_name !== undefined ? device_name : existingName
      if (needDeviceLookup && (!finalDeviceCode || !finalDeviceName) && targetDeviceId) {
        const device = await Device.findOne({ where: { device_id: targetDeviceId }, transaction: t })
        if (device) {
          finalDeviceCode = finalDeviceCode || (device as any).device_code
          finalDeviceName = finalDeviceName || (device as any).device_name
        }
      }

      const updateData: any = {
        standard_name: standard_name !== undefined ? standard_name : undefined,
        device_type: device_type !== undefined ? device_type : undefined,
        device_id: device_id !== undefined ? device_id : undefined,
        device_code: finalDeviceCode || undefined,
        device_name: finalDeviceName || undefined,
        item_name: item_name !== undefined ? item_name : undefined,
        trigger_type: trigger_type !== undefined ? trigger_type : undefined,
        cycle_value: cycle_value !== undefined ? cycle_value : undefined,
        cycle_unit: cycle_unit !== undefined ? cycle_unit : undefined,
        runtime_threshold: runtime_threshold !== undefined ? runtime_threshold : undefined,
        standard_requirement: standard_requirement !== undefined ? standard_requirement : undefined,
        last_maintenance_date: last_maintenance_date !== undefined ? (last_maintenance_date || null) : undefined,
        last_maintenance_runtime: last_maintenance_runtime !== undefined ? (last_maintenance_runtime !== null && last_maintenance_runtime !== '' ? last_maintenance_runtime : null) : undefined,
        status: status !== undefined ? status : undefined,
        remarks: remarks !== undefined ? remarks : undefined,
      }

      // 周期型自动重算下次维护日期
      const finalTriggerType = trigger_type !== undefined ? trigger_type : (record as any).getDataValue('trigger_type')
      if (finalTriggerType === TRIGGER_CYCLE) {
        const finalCycleValue = cycle_value !== undefined ? Number(cycle_value) : Number((record as any).getDataValue('cycle_value'))
        const finalCycleUnit = cycle_unit !== undefined ? cycle_unit : ((record as any).getDataValue('cycle_unit') || '天')
        const finalLastDate = last_maintenance_date !== undefined
          ? (last_maintenance_date || null)
          : (record as any).getDataValue('last_maintenance_date')
        updateData.next_maintenance_date = computeNextDate(finalLastDate, finalCycleValue, finalCycleUnit)
      } else if (finalTriggerType === TRIGGER_RUNTIME) {
        // 运行时长型不依赖日期，清空 next_maintenance_date
        updateData.next_maintenance_date = null
      }

      await record.update(updateData, { transaction: t })
      await t.commit()
      success(res, record, '更新成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[DeviceMaintenance] updateStandard error:', err)
      fail(res, err.message || '更新失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 删除维护标准
   */
  async deleteStandard(req: any, res: any) {
    try {
      const { id } = req.params
      const record = await DeviceMaintenanceStandard.findOne({ where: { standard_id: id } })
      if (!record) {
        return fail(res, '维护标准不存在', ErrorCode.RECORD_NOT_FOUND)
      }
      await record.destroy()
      success(res, { message: '删除成功' }, '删除成功')
    } catch (err: any) {
      logger.error('[DeviceMaintenance] deleteStandard error:', err)
      fail(res, err.message || '删除失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  // ===================== 维护工单 =====================

  /**
   * 分页查询维护工单（按编号、设备、状态、日期筛选）
   */
  async listRecords(req: any, res: any) {
    try {
      const {
        page = 1,
        page_size = 20,
        record_no,
        device_id,
        device_name,
        device_code,
        trigger_type,
        maintenance_type,
        status,
        start_date,
        end_date,
      } = req.query

      const where: any = {}
      if (record_no) where.record_no = { [Op.like]: `%${record_no}%` }
      if (device_id) where.device_id = device_id
      if (device_name) where.device_name = { [Op.like]: `%${device_name}%` }
      if (device_code) where.device_code = { [Op.like]: `%${device_code}%` }
      if (trigger_type) where.trigger_type = trigger_type
      if (maintenance_type) where.maintenance_type = { [Op.like]: `%${maintenance_type}%` }

      const statusArr = parseMultiStatus(status)
      if (statusArr) where.status = { [Op.in]: statusArr }

      if (start_date || end_date) {
        where.plan_date = {}
        if (start_date) where.plan_date[Op.gte] = String(start_date)
        if (end_date) where.plan_date[Op.lte] = String(end_date)
      }

      const pageNum = Math.max(1, Number(page) || 1)
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(page_size) || 20))

      const { count, rows } = await DeviceMaintenanceRecord.findAndCountAll({
        where,
        order: [['plan_date', 'DESC'], ['record_id', 'DESC']],
        limit: pageSize,
        offset: (pageNum - 1) * pageSize,
      })

      success(res, { list: rows, total: count, page: pageNum, page_size: pageSize })
    } catch (err: any) {
      logger.error('[DeviceMaintenance] listRecords error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 获取维护工单详情（含维护标准与维护图片）
   */
  async detailRecord(req: any, res: any) {
    try {
      const { id } = req.params
      const record = await getDetail(Number(id))
      if (!record) {
        return fail(res, '维护工单不存在', ErrorCode.RECORD_NOT_FOUND)
      }
      success(res, record)
    } catch (err: any) {
      logger.error('[DeviceMaintenance] detailRecord error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 生成维护工单
   * 1. 周期型：next_maintenance_date <= 今天 → 生成工单
   * 2. 运行时长型：当前运行时长 - last_maintenance_runtime >= runtime_threshold → 生成工单
   * 3. 避免重复：同一标准已有未完成工单（状态 0/1/3）则跳过
   * 请求体可选 { device_id } 限定单台设备，否则处理全部启用标准
   */
  async generateRecords(req: any, res: any) {
    const t = await DeviceMaintenanceRecord.sequelize.transaction()
    try {
      const { device_id } = req.body || {}
      const today = todayStr()

      const stdWhere: any = { status: 1 }
      if (device_id) stdWhere.device_id = device_id
      const standards = await DeviceMaintenanceStandard.findAll({ where: stdWhere, transaction: t })

      if (standards.length === 0) {
        await t.commit()
        return success(res, { created: 0, total: 0, message: '没有启用状态的维护标准' }, '生成完成')
      }

      // 查询这些标准已有未完成的工单，避免重复生成
      const standardIds = standards.map((s: any) => s.getDataValue('standard_id'))
      const unfinished = await DeviceMaintenanceRecord.findAll({
        where: {
          standard_id: { [Op.in]: standardIds.filter(Boolean) },
          status: { [Op.in]: UNFINISHED_STATUS },
        },
        attributes: ['standard_id'],
        transaction: t,
      })
      const unfinishedStdIds = new Set(unfinished.map((r: any) => r.getDataValue('standard_id')))

      const toCreate: any[] = []
      for (const s of standards) {
        const sid = s.getDataValue('standard_id')
        if (!sid) continue
        if (unfinishedStdIds.has(sid)) continue

        const triggerType = s.getDataValue('trigger_type')
        const deviceId = s.getDataValue('device_id')

        if (triggerType === TRIGGER_CYCLE) {
          // 周期型：下次维护日期到期
          const nextDate = s.getDataValue('next_maintenance_date')
          if (!nextDate) continue
          if (nextDate > today) continue
          if (!deviceId) continue

          const { finalDeviceCode, finalDeviceName } = await loadDeviceFields(
            deviceId, s.getDataValue('device_code'), s.getDataValue('device_name'), t,
          )
          toCreate.push({
            standard_id: sid,
            device_id: deviceId,
            device_code: finalDeviceCode,
            device_name: finalDeviceName,
            maintenance_type: s.getDataValue('item_name'),
            trigger_type: triggerType,
            plan_date: nextDate,
            status: 0,
            remarks: `由维护标准#${sid}到期自动生成`,
          })
        } else if (triggerType === TRIGGER_RUNTIME) {
          // 运行时长型：当前累计运行时长 - 上次维护时长 >= 阈值
          if (!deviceId) continue
          const threshold = Number(s.getDataValue('runtime_threshold'))
          if (!threshold || threshold <= 0) continue

          const currentRuntime = await getLatestRuntime(deviceId, t)
          const lastRuntime = Number(s.getDataValue('last_maintenance_runtime')) || 0
          if (currentRuntime - lastRuntime < threshold) continue

          const { finalDeviceCode, finalDeviceName } = await loadDeviceFields(
            deviceId, s.getDataValue('device_code'), s.getDataValue('device_name'), t,
          )
          toCreate.push({
            standard_id: sid,
            device_id: deviceId,
            device_code: finalDeviceCode,
            device_name: finalDeviceName,
            maintenance_type: s.getDataValue('item_name'),
            trigger_type: triggerType,
            plan_date: today,
            status: 0,
            remarks: `运行时长${currentRuntime}h已达阈值${threshold}h，自动生成`,
          })
        }
      }

      if (toCreate.length === 0) {
        await t.commit()
        return success(res, { created: 0, total: 0, message: '当前没有到期的维护任务' }, '生成完成')
      }

      // 生成工单编号（WH + YYYYMMDD + 3位序号）
      for (const item of toCreate) {
        item.record_no = await generateDeviceMaintenanceNo()
      }

      const created = await DeviceMaintenanceRecord.bulkCreate(toCreate, { transaction: t })
      await t.commit()

      success(res, { created: created.length, total: created.length, records: created }, `成功生成${created.length}条维护工单`)
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[DeviceMaintenance] generateRecords error:', err)
      fail(res, err.message || '生成失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 开始维护（状态 0=待执行 → 1=执行中，记录开始时间）
   */
  async startRecord(req: any, res: any) {
    const t = await DeviceMaintenanceRecord.sequelize.transaction()
    try {
      const { id } = req.params
      const userInfo: any = (req as any).user || {}
      const { start_time, maintainer_id, maintainer_name } = req.body || {}

      const record = await DeviceMaintenanceRecord.findOne({ where: { record_id: id }, transaction: t })
      if (!record) {
        return fail(res, '维护工单不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const s = rawStatus(record)
      if (s !== 0) {
        return fail(res, '当前状态不允许开始维护，仅待执行的工单可开始', ErrorCode.BUSINESS_ERROR)
      }

      await record.update({
        status: 1,
        start_time: start_time ? new Date(start_time) : new Date(),
        maintainer_id: maintainer_id || userInfo.userId || null,
        maintainer_name: maintainer_name || userInfo.username || '',
      }, { transaction: t })

      await t.commit()
      const detail = await getDetail(Number(id))
      success(res, detail, '开始维护成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[DeviceMaintenance] startRecord error:', err)
      fail(res, err.message || '开始维护失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 提交维护结果（状态 1=执行中 → 2=已完成）
   * - 记录维护内容、备件使用、耗时、维护结果、异常描述
   * - 支持附带上传照片
   * - 更新维护标准：last_maintenance_date / last_maintenance_runtime / next_maintenance_date
   */
  async submitRecord(req: any, res: any) {
    const t = await DeviceMaintenanceRecord.sequelize.transaction()
    try {
      const { id } = req.params
      const userInfo: any = (req as any).user || {}
      const {
        maintenance_content,
        spare_parts_used = [],
        maintenance_hours,
        maintenance_result,
        abnormal_desc,
        end_time,
        current_runtime,
        maintainer_id,
        maintainer_name,
        remarks,
      } = req.body || {}

      const record = await DeviceMaintenanceRecord.findOne({ where: { record_id: id }, transaction: t })
      if (!record) {
        // 清理可能上传的临时文件
        const files = (req as any).files || ((req as any).file ? [(req as any).file] : [])
        files.forEach((f: any) => { try { fs.unlinkSync(f.path) } catch { /* ignore */ } })
        return fail(res, '维护工单不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const s = rawStatus(record)
      if (s === 2) {
        return fail(res, '该维护工单已完成', ErrorCode.BUSINESS_ERROR)
      }
      // 允许待执行直接提交（补录场景），但执行中提交为常规流程

      if (!maintenance_result) {
        return fail(res, '维护结果不能为空（正常/异常）', ErrorCode.PARAM_INVALID)
      }

      const now = end_time ? new Date(end_time) : new Date()
      const deviceId = record.getDataValue('device_id')
      const standardId = record.getDataValue('standard_id')

      const recordUpdate: any = {
        status: 2,
        maintenance_content: maintenance_content || '',
        spare_parts_used: Array.isArray(spare_parts_used) ? spare_parts_used : [],
        maintenance_hours: maintenance_hours !== undefined ? maintenance_hours : null,
        maintenance_result,
        abnormal_desc: maintenance_result === '异常' ? (abnormal_desc || '') : '',
        end_time: now,
        remarks: remarks !== undefined ? remarks : (record as any).remarks,
      }
      // 维护人兜底：未指定则用当前登录用户
      if (!record.getDataValue('maintainer_id') && !record.getDataValue('maintainer_name')) {
        recordUpdate.maintainer_id = maintainer_id || userInfo.userId || null
        recordUpdate.maintainer_name = maintainer_name || userInfo.username || ''
      } else {
        if (maintainer_id !== undefined) recordUpdate.maintainer_id = maintainer_id
        if (maintainer_name !== undefined) recordUpdate.maintainer_name = maintainer_name
      }
      await record.update(recordUpdate, { transaction: t })

      // 回写维护标准：更新上次维护日期/时长 与 下次维护日期
      if (standardId) {
        const standard = await DeviceMaintenanceStandard.findOne({ where: { standard_id: standardId }, transaction: t })
        if (standard) {
          const triggerType = standard.getDataValue('trigger_type')
          const stdUpdate: any = { last_maintenance_date: dateOnlyStr(now) }

          if (triggerType === TRIGGER_CYCLE) {
            const cycleValue = Number(standard.getDataValue('cycle_value'))
            const cycleUnit = standard.getDataValue('cycle_unit') || '天'
            stdUpdate.next_maintenance_date = computeNextDate(dateOnlyStr(now), cycleValue, cycleUnit)
          } else if (triggerType === TRIGGER_RUNTIME) {
            // 取维护时的运行时长：优先用请求传入，否则取设备最新累计运行时长
            let runtimeAtMaintenance: number | null = null
            if (current_runtime !== undefined && current_runtime !== null && current_runtime !== '') {
              runtimeAtMaintenance = Number(current_runtime)
            } else {
              runtimeAtMaintenance = await getLatestRuntime(deviceId, t)
            }
            stdUpdate.last_maintenance_runtime = runtimeAtMaintenance
            stdUpdate.next_maintenance_date = null
          }

          await standard.update(stdUpdate, { transaction: t })
        }
      }

      // 处理可能附带上传的照片（若路由层挂载了 multer）
      const files: any[] = (req as any).files || ((req as any).file ? [(req as any).file] : [])
      if (files.length > 0) {
        const uploadsDir = path.resolve(process.cwd(), 'uploads', 'device', 'maintenance')
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
        const existingCount = await DeviceImage.count({
          where: { doc_type: 'maintenance', doc_id: Number(id) },
          transaction: t,
        })
        const ts = Date.now()
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          const seqNum = existingCount + i + 1
          const ext = path.extname(file.originalname) || '.jpg'
          const newName = `maintenance_${id}_${seqNum}_${ts}${ext}`
          const destPath = path.join(uploadsDir, newName)
          fs.renameSync(file.path, destPath)
          await DeviceImage.create({
            doc_type: 'maintenance',
            doc_id: Number(id),
            file_path: `/uploads/device/maintenance/${newName}`,
            file_name: file.originalname || newName,
            file_size: file.size || null,
            sort_order: seqNum,
            uploaded_by: userInfo.userId || null,
            uploaded_by_name: userInfo.username || '',
          }, { transaction: t })
        }
      }

      await t.commit()
      const detail = await getDetail(Number(id))
      success(res, detail, '提交维护成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      // 清理已落地的临时文件
      const files = (req as any).files || ((req as any).file ? [(req as any).file] : [])
      files.forEach((f: any) => { try { fs.unlinkSync(f.path) } catch { /* ignore */ } })
      logger.error('[DeviceMaintenance] submitRecord error:', err)
      fail(res, err.message || '提交维护失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 删除维护工单（级联删除维护图片）
   */
  async deleteRecord(req: any, res: any) {
    const t = await DeviceMaintenanceRecord.sequelize.transaction()
    try {
      const { id } = req.params
      const record = await DeviceMaintenanceRecord.findOne({ where: { record_id: id }, transaction: t })
      if (!record) {
        return fail(res, '维护工单不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      // 收集需要清理的物理文件
      const images = await DeviceImage.findAll({
        where: { doc_type: 'maintenance', doc_id: record.record_id },
        transaction: t,
      })

      await DeviceImage.destroy({ where: { doc_type: 'maintenance', doc_id: record.record_id }, transaction: t })
      await record.destroy({ transaction: t })

      await t.commit()

      // 清理物理文件（事务提交后再删除，避免回滚时文件已丢失）
      images.forEach((img: any) => {
        const rel = String(img.file_path || '').replace(/^\//, '')
        if (!rel) return
        try { fs.unlinkSync(path.resolve(process.cwd(), rel)) } catch { /* ignore */ }
      })

      success(res, { message: '删除成功' }, '删除成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[DeviceMaintenance] deleteRecord error:', err)
      fail(res, err.message || '删除失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  // ===================== 维护图片 =====================

  /**
   * 获取维护工单图片（doc_type=maintenance）
   */
  async getImages(req: any, res: any) {
    try {
      const { id } = req.params
      const exists = await DeviceMaintenanceRecord.findOne({ where: { record_id: id }, attributes: ['record_id'] })
      if (!exists) {
        return fail(res, '维护工单不存在', ErrorCode.RECORD_NOT_FOUND)
      }
      const images = await DeviceImage.findAll({
        where: { doc_type: 'maintenance', doc_id: id },
        order: [['sort_order', 'ASC'], ['image_id', 'ASC']],
      })
      success(res, images, '查询成功')
    } catch (err: any) {
      logger.error('[DeviceMaintenance] getImages error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 上传维护工单图片
   * - 单文件或多文件上传，按 doc_type=maintenance 入库
   * - 命名规范：maintenance_{record_id}_{序号}_{时间戳}.ext
   * - 路由层已挂载 multer，文件位于 req.files / req.file
   */
  async uploadImage(req: any, res: any) {
    const t = await DeviceImage.sequelize.transaction()
    try {
      const { id } = req.params
      const userInfo: any = (req as any).user || {}

      const record = await DeviceMaintenanceRecord.findOne({ where: { record_id: id }, transaction: t })
      if (!record) {
        // 清理临时文件
        const files = (req as any).files || ((req as any).file ? [(req as any).file] : [])
        files.forEach((f: any) => { try { fs.unlinkSync(f.path) } catch { /* ignore */ } })
        return fail(res, '维护工单不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const files: any[] = (req as any).files || ((req as any).file ? [(req as any).file] : [])
      if (files.length === 0) {
        return fail(res, '请选择要上传的图片', ErrorCode.PARAM_INVALID)
      }

      const uploadsDir = path.resolve(process.cwd(), 'uploads', 'device', 'maintenance')
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

      const existingCount = await DeviceImage.count({
        where: { doc_type: 'maintenance', doc_id: Number(id) },
        transaction: t,
      })

      const created: any[] = []
      const ts = Date.now()
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const seqNum = existingCount + i + 1
        const ext = path.extname(file.originalname) || '.jpg'
        const newName = `maintenance_${id}_${seqNum}_${ts}${ext}`
        const destPath = path.join(uploadsDir, newName)
        fs.renameSync(file.path, destPath)

        const rel = await DeviceImage.create({
          doc_type: 'maintenance',
          doc_id: Number(id),
          file_path: `/uploads/device/maintenance/${newName}`,
          file_name: file.originalname || newName,
          file_size: file.size || null,
          sort_order: seqNum,
          uploaded_by: userInfo.userId || null,
          uploaded_by_name: userInfo.username || '',
        }, { transaction: t })
        created.push(rel)
      }

      await t.commit()
      success(res, created, `成功上传${created.length}张图片`)
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[DeviceMaintenance] uploadImage error:', err)
      fail(res, err.message || '上传失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  // ===================== 运行时长 =====================

  /**
   * 录入设备运行时长
   * - 记录增量（current - previous）与累计值
   * - 检查是否触发运行时长型维护工单生成
   */
  async logRuntime(req: any, res: any) {
    const t = await DeviceRuntimeLog.sequelize.transaction()
    try {
      const userInfo: any = (req as any).user || {}
      const { device_id, runtime_hours, device_code, device_name, remarks } = req.body || {}

      if (!device_id) {
        return fail(res, '设备ID不能为空', ErrorCode.PARAM_INVALID)
      }
      if (runtime_hours === undefined || runtime_hours === null || runtime_hours === '') {
        return fail(res, '运行时长不能为空', ErrorCode.PARAM_INVALID)
      }
      const currentHours = Number(runtime_hours)
      if (Number.isNaN(currentHours) || currentHours < 0) {
        return fail(res, '运行时长必须为非负数字', ErrorCode.PARAM_INVALID)
      }

      const { finalDeviceCode, finalDeviceName } = await loadDeviceFields(device_id, device_code, device_name, t)

      // 取上次记录的运行时长，计算增量
      const previousHours = await getLatestRuntime(device_id, t)
      const deltaHours = currentHours > previousHours ? Number((currentHours - previousHours).toFixed(2)) : 0

      const log = await DeviceRuntimeLog.create({
        device_id,
        device_code: finalDeviceCode || null,
        device_name: finalDeviceName || null,
        runtime_hours: currentHours,
        previous_hours: previousHours,
        delta_hours: deltaHours,
        logged_by: userInfo.userId || null,
        logged_by_name: userInfo.username || '',
        remarks: remarks || '',
      }, { transaction: t })

      // 检查运行时长型标准是否触发维护工单生成
      const triggered: any[] = []
      const runtimeStandards = await DeviceMaintenanceStandard.findAll({
        where: { device_id, status: 1, trigger_type: TRIGGER_RUNTIME },
        transaction: t,
      })

      if (runtimeStandards.length > 0) {
        const triggeredStdIds: number[] = []
        for (const s of runtimeStandards) {
          const threshold = Number(s.getDataValue('runtime_threshold'))
          if (!threshold || threshold <= 0) continue
          const lastRuntime = Number(s.getDataValue('last_maintenance_runtime')) || 0
          if (currentHours - lastRuntime < threshold) continue
          triggeredStdIds.push(s.getDataValue('standard_id'))
        }

        if (triggeredStdIds.length > 0) {
          // 查询这些标准已有未完成的工单，避免重复生成
          const unfinished = await DeviceMaintenanceRecord.findAll({
            where: {
              standard_id: { [Op.in]: triggeredStdIds },
              status: { [Op.in]: UNFINISHED_STATUS },
            },
            attributes: ['standard_id'],
            transaction: t,
          })
          const unfinishedStdIds = new Set(unfinished.map((r: any) => r.getDataValue('standard_id')))

          const today = todayStr()
          for (const s of runtimeStandards) {
            const sid = s.getDataValue('standard_id')
            if (!triggeredStdIds.includes(sid)) continue
            if (unfinishedStdIds.has(sid)) continue

            const recordNo = await generateDeviceMaintenanceNo()
            const created = await DeviceMaintenanceRecord.create({
              record_no: recordNo,
              standard_id: sid,
              device_id,
              device_code: finalDeviceCode || null,
              device_name: finalDeviceName || null,
              maintenance_type: s.getDataValue('item_name'),
              trigger_type: TRIGGER_RUNTIME,
              plan_date: today,
              status: 0,
              remarks: `运行时长${currentHours}h达到阈值${s.getDataValue('runtime_threshold')}h，自动生成`,
            }, { transaction: t })
            triggered.push(created)
          }
        }
      }

      await t.commit()
      success(res, { log, triggered_records: triggered }, triggered.length > 0 ? `录入成功，触发${triggered.length}条维护工单` : '录入成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[DeviceMaintenance] logRuntime error:', err)
      fail(res, err.message || '录入失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 查询运行时长记录（按设备、日期筛选）
   */
  async getRuntimeLog(req: any, res: any) {
    try {
      const {
        page = 1,
        page_size = 20,
        device_id,
        device_code,
        device_name,
        start_date,
        end_date,
      } = req.query

      const where: any = {}
      if (device_id) where.device_id = device_id
      if (device_code) where.device_code = { [Op.like]: `%${device_code}%` }
      if (device_name) where.device_name = { [Op.like]: `%${device_name}%` }

      if (start_date || end_date) {
        where.created_at = {}
        if (start_date) where.created_at[Op.gte] = new Date(String(start_date))
        if (end_date) where.created_at[Op.lte] = new Date(new Date(String(end_date)).getTime() + 86400000)
      }

      const pageNum = Math.max(1, Number(page) || 1)
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(page_size) || 20))

      const { count, rows } = await DeviceRuntimeLog.findAndCountAll({
        where,
        order: [['created_at', 'DESC'], ['log_id', 'DESC']],
        limit: pageSize,
        offset: (pageNum - 1) * pageSize,
      })

      success(res, { list: rows, total: count, page: pageNum, page_size: pageSize })
    } catch (err: any) {
      logger.error('[DeviceMaintenance] getRuntimeLog error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },
}
