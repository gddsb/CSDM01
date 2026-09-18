/** MaintenanceRuntime —— 运行时长 + 图片辅助 + 档案初始化 */
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
import { loadDeviceFields, getLatestRuntime } from './MaintenanceProfileCrud.js'

export async function getImages(query: any) {
  const { record_id } = query
  if (!record_id) throw new AppError('record_id 不能为空', ErrorCode.PARAM_INVALID)
  const exists = await DeviceMaintenanceRecord.findOne({ where: { record_id: Number(record_id) }, attributes: ['record_id'] })
  if (!exists) throw new AppError('执行记录不存在', ErrorCode.RECORD_NOT_FOUND)
  const images = await DeviceImage.findAll({
    where: { doc_type: 'maintenance', doc_id: Number(record_id) },
    order: [['sort_order', 'ASC'], ['image_id', 'ASC']],
  })
  return images
}

export async function logRuntime(body: any, user?: any) {
const t = await DeviceRuntimeLog.sequelize.transaction()
    try {
      const userInfo: any = user || {}
      const { device_id, runtime_hours, remarks } = body || {}
      if (!device_id) throw new AppError('设备ID不能为空', ErrorCode.PARAM_INVALID)
      if (!runtime_hours || Number(runtime_hours) <= 0) {
        throw new AppError('运行时长必须为有效正数（小时）', ErrorCode.PARAM_INVALID)
      }

      const { finalDeviceCode, finalDeviceName } = await loadDeviceFields(device_id, undefined, undefined, t)
      const currentHours = Number(runtime_hours)
      const previousHours = await getLatestRuntime(device_id, t)
      const delta = currentHours > previousHours ? Number((currentHours - previousHours).toFixed(2)) : 0

      const log = await DeviceRuntimeLog.create({
        device_id,
        device_code: finalDeviceCode,
        device_name: finalDeviceName,
        runtime_hours: currentHours,
        previous_hours: previousHours,
        delta_hours: delta,
        logged_by: userInfo.userId || null,
        logged_by_name: userInfo.username || '',
        remarks: remarks || '',
      }, { transaction: t })

      await t.commit()
      return log
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      throw new AppError(err.message || '录入失败', ErrorCode.SYSTEM_ERROR)
    }
}

export async function getRuntimeLog(deviceId: number) {

}

export async function initProfiles() {
const stdRows = await DeviceMaintenanceStandard.findAll({
      attributes: ['device_id'],
      group: ['device_id'],
      raw: true,
    }) as any[]
    const stdDeviceIds: number[] = stdRows.map(r => r.device_id).filter(Boolean)
    if (stdDeviceIds.length === 0) return
    const existed = await DeviceMaintenanceProfile.findAll({
      attributes: ['device_id'],
      where: { device_id: { [Op.in]: stdDeviceIds } },
      raw: true,
    }) as any[]
    const existedSet = new Set(existed.map(p => p.device_id))
    const toCreate = stdDeviceIds.filter(id => !existedSet.has(id))
    if (toCreate.length === 0) return
    const devices = await Device.findAll({
      where: { device_id: { [Op.in]: toCreate } },
      attributes: ['device_id', 'device_code', 'device_name'],
      raw: true,
    }) as any[]
    const deviceMap = new Map(devices.map(d => [d.device_id, d]))
    const today = new Date().toISOString().slice(0, 10)
    const rows = toCreate.map(id => {
      const d = deviceMap.get(id)
      return {
        device_id: id,
        device_code: d?.device_code || null,
        device_name: d?.device_name || null,
        status: '生效',
        version: 1,
        effective_date: today,
      }
    })
    await DeviceMaintenanceProfile.bulkCreate(rows)
    logger.info(`✅ 维护标准档案 backfill: ${rows.length} 台设备`)
}

export async function uploadImageRecord(body: any) {
  // DB-only persistence; actual fs/sharp done in Controller
  const { record_id, image_path, original_name, watermark_text, sort_order = 0, remark } = body
  if (!record_id || !image_path) throw new AppError('record_id / image_path 必填', ErrorCode.PARAM_INVALID)
  // DeviceImage 模型字段：doc_type / doc_id / file_path / file_name / sort_order
  return await DeviceImage.create({
    doc_type: 'maintenance', doc_id: Number(record_id),
    file_path: image_path, file_name: original_name, sort_order: Number(sort_order),
    // watermark_text / remark 不属于 DeviceImage 模型 → 忽略
  })
}

// ---------- uploadImage DB 辅助 ----------

/** 校验保养执行记录存在（事务内） */
export async function assertRecordExists(recordId: number, transaction?: any) {
  const record = await DeviceMaintenanceRecord.findOne({ where: { record_id: recordId }, transaction })
  if (!record) throw new AppError('执行记录不存在', ErrorCode.RECORD_NOT_FOUND)
  return record
}

/** 统计执行记录已上传图片数 */
export async function countImagesByRecord(recordId: number, transaction?: any) {
  return await DeviceImage.count({ where: { doc_type: 'maintenance', doc_id: recordId }, transaction })
}

/** 查执行记录已有图片（用于 hash 去重） */
export async function findExistingImagesByRecord(recordId: number, transaction?: any) {
  return await DeviceImage.findAll({
    where: { doc_type: 'maintenance', doc_id: recordId },
    attributes: ['file_path'],
    transaction,
  })
}

/** 创建保养图片记录 */
export async function createMaintenanceImage(data: any, transaction?: any) {
  return await DeviceImage.create(data, { transaction })
}

