/** MaintenanceRecordCrud —— 保养执行记录 CRUD */
/**
 * DeviceMaintenanceProfileService — 保养档案 + 执行工单 + 矩阵 + 运行时长
 * 从 origin/main 的 DeviceMaintenanceController.ts 抽取
 * uploadImage / processImage 涉及 fs/sharp，保留在 Controller
 */
import { Op, QueryTypes } from 'sequelize'
import sequelize from 'sequelize'
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
        page = 1, page_size = 20,
        record_no, device_id, device_name, device_code,
        trigger_mode, status, period_key,
        start_date, end_date,
        extra,
      } = query

      const where: any = {}
      if (record_no) where.record_no = { [Op.like]: `%${record_no}%` }
      if (device_id) where.device_id = device_id
      if (device_name) where.device_name = { [Op.like]: `%${device_name}%` }
      if (device_code) where.device_code = { [Op.like]: `%${device_code}%` }
      if (trigger_mode) where.trigger_mode = trigger_mode
      if (period_key) where.period_key = period_key

      const statusArr = parseMultiStatus(status, STATUS_REVERSE)
      if (statusArr) where.status = { [Op.in]: statusArr }

      if (start_date || end_date) {
        where.created_at = {}
        if (start_date) where.created_at[Op.gte] = new Date(start_date as string)
        if (end_date) where.created_at[Op.lte] = new Date(`${end_date} 23:59:59`)
      }

      // 历史记录模式：只看本月以外的已完成/跳过记录
      if (extra === 'history') {
        where.status = { [Op.in]: (statusArr && statusArr.length) ? statusArr : [2, 3] }
        if (!start_date && !end_date) {
          const now = new Date()
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
          const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
          where.created_at = {
            [Op.or]: [{ [Op.lt]: monthStart }, { [Op.gt]: monthEnd }],
          }
        }
      }

      const pageNum = Math.max(1, Number(page) || 1)
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(page_size) || 20))

      const { count, rows } = await DeviceMaintenanceRecord.findAndCountAll({
        where,
        order: [['created_at', 'DESC'], ['record_id', 'DESC']],
        limit: pageSize,
        offset: (pageNum - 1) * pageSize,
        include: [{ model: DeviceMaintenanceStandard, as: 'standard', required: false }],
      })

      return { list: rows, total: count, page: pageNum, page_size: pageSize }
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
