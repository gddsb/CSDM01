/** MaintenanceProfileCrud —— 保养档案 CRUD + 常量 */
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

export const UNFINISHED_STATUS = [0, 1, 3]
export const rawStatus = (record: any): number => record.getDataValue('status')

export async function loadDeviceFields(
  deviceId: number | undefined | null,
  deviceCode?: string, deviceName?: string, t?: any,
): Promise<{ finalDeviceCode: string | null; finalDeviceName: string | null }> {
  let finalDeviceCode = deviceCode
  let finalDeviceName = deviceName
  if ((!finalDeviceCode || !finalDeviceName) && deviceId) {
    const device = await Device.findOne({ where: { device_id: deviceId }, transaction: t })
    if (device) {
      finalDeviceCode = finalDeviceCode || (device as any).device_code
      finalDeviceName = finalDeviceName || (device as any).device_name
    }
  }
  return { finalDeviceCode: finalDeviceCode || null, finalDeviceName: finalDeviceName || null }
}

export async function getLatestRuntime(deviceId: number, t?: any): Promise<number> {
  const log = await DeviceRuntimeLog.findOne({
    where: { device_id: deviceId },
    order: [['created_at', 'DESC'], ['log_id', 'DESC']], transaction: t,
  })
  return log ? Number((log as any).getDataValue('runtime_hours')) : 0
}

export async function getRecordDetail(id: number) {
  const record = await DeviceMaintenanceRecord.findOne({
    where: { record_id: id },
    include: [
      { model: DeviceMaintenanceStandard, as: 'standard', required: false },
      { model: DeviceImage, as: 'maintenance_images', required: false, separate: true,
        order: [['sort_order', 'ASC'], ['image_id', 'ASC']] },
    ],
  })
  return record ? (record as any).toJSON() : null
}

export { buildPeriodKey } from '../utils/maintenanceMatrix.js'

export async function listProfiles(query: any) {
const { keyword, status, page = 1, pageSize = 50 } = query
      const where: any = {}
      if (status) where.status = status
      if (keyword) {
        const devices = await Device.findAll({
          where: {
            [Op.or]: [
              { device_code: { [Op.like]: `%${keyword}%` } },
              { device_name: { [Op.like]: `%${keyword}%` } },
            ],
          },
          attributes: ['device_id'],
          raw: true,
        })
        const deviceIds: number[] = devices.map(d => d.device_id)
        if (deviceIds.length === 0) return { list: [], total: 0 }
        where.device_id = { [Op.in]: deviceIds }
      }
      const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
      const offset = (Number(page) - 1) * limit
      const { rows, count } = await DeviceMaintenanceProfile.findAndCountAll({
        where,
        include: [
          { model: Device, as: 'device', required: false, attributes: ['device_id', 'device_code', 'device_name'] },
          {
            model: DeviceMaintenanceStandard, as: 'standards', required: false, separate: true,
            attributes: ['standard_id', 'trigger_mode', 'status'],
          },
        ],
        limit, offset,
        order: [['updated_at', 'DESC'], ['profile_id', 'DESC']],
        distinct: true,
      })
      const list = rows.map((p: any) => {
        const stds = p.getDataValue('standards') || []
        const byMode: Record<string, number> = { daily: 0, weekly: 0, monthly: 0, runtime: 0 }
        stds.forEach((s: any) => { const m = s.getDataValue('trigger_mode'); if (byMode[m] !== undefined) byMode[m] += 1 })
        return {
          profile_id: p.getDataValue('profile_id'),
          device_id: p.getDataValue('device_id'),
          device_code: p.getDataValue('device_code') || p.getDataValue('device')?.device_code,
          device_name: p.getDataValue('device_name') || p.getDataValue('device')?.device_name,
          status: p.getDataValue('status'),
          version: p.getDataValue('version'),
          effective_date: p.getDataValue('effective_date'),
          remarks: p.getDataValue('remarks'),
          updated_at: p.getDataValue('updated_at'),
          created_at: p.getDataValue('created_at'),
          std_count: stds.length,
          std_by_mode: byMode,
        }
      })
      return { list, total: count }
}

export async function listAvailableDevices(query: any) {
const { keyword } = query
      const devWhere: any = {}
      if (keyword) {
        devWhere[Op.or] = [
          { device_code: { [Op.like]: `%${keyword}%` } },
          { device_name: { [Op.like]: `%${keyword}%` } },
        ]
      }
      const existed = await DeviceMaintenanceProfile.findAll({ attributes: ['device_id'], raw: true })
      const existedSet = new Set(existed.map(p => p.device_id))
      const devices = await Device.findAll({
        where: { ...devWhere, device_id: { [Op.notIn]: Array.from(existedSet) || [0] } },
        attributes: ['device_id', 'device_code', 'device_name'],
        order: [['device_code', 'ASC']],
      })
      return devices
}

export async function createProfile(body: any, user?: any) {
const t = await DeviceMaintenanceProfile.sequelize.transaction()
    try {
      const { device_id, remarks } = body || {}
      if (!device_id) throw new AppError('设备ID不能为空', ErrorCode.PARAM_INVALID)
      const exists = await DeviceMaintenanceProfile.findOne({ where: { device_id }, transaction: t })
      if (exists) throw new AppError('该设备已存在维护标准档案', ErrorCode.RECORD_EXISTS)
      const device = await Device.findOne({ where: { device_id }, transaction: t })
      if (!device) throw new AppError('设备不存在', ErrorCode.RECORD_NOT_FOUND)
      const profile = await DeviceMaintenanceProfile.create({
        device_id,
        device_code: (device as any).device_code,
        device_name: (device as any).device_name,
        status: '编制',
        version: 1,
        remarks,
      }, { transaction: t })
      await t.commit()
      return profile
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      throw new AppError(err.message || '创建失败', ErrorCode.SYSTEM_ERROR)
    }
}

export async function detailProfile(deviceId: number) {

      const profile = await DeviceMaintenanceProfile.findOne({
        where: { device_id: deviceId },
        include: [
          { model: Device, as: 'device', required: false, attributes: ['device_id', 'device_code', 'device_name', 'device_model', 'serial_no', 'location'] },
          {
            model: DeviceMaintenanceStandard, as: 'standards', required: false, separate: false,
            order: [['sort_order', 'ASC'], ['standard_id', 'ASC']],
          },
        ],
      })
      if (!profile) throw new AppError('档案不存在', ErrorCode.RECORD_NOT_FOUND)
      return profile
}

export async function updateProfileStatus(deviceId: number, body: any) {
const t = await DeviceMaintenanceProfile.sequelize.transaction()
    try {
      const { status } = body || {}
      if (!['编制', '生效', '停用'].includes(status)) {
        throw new AppError('状态无效，可选值：编制 / 生效 / 停用', ErrorCode.PARAM_INVALID)
      }
      const profile = await DeviceMaintenanceProfile.findOne({ where: { device_id: deviceId }, transaction: t })
      if (!profile) throw new AppError('档案不存在', ErrorCode.RECORD_NOT_FOUND)
      const patch: any = { status }
      if (status === '生效') {
        patch.effective_date = new Date().toISOString().slice(0, 10)
        patch.version = (profile.getDataValue('version') || 1) + 1
      }
      await profile.update(patch, { transaction: t })
      await t.commit()
      return profile
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      throw new AppError(err.message || '更新失败', ErrorCode.SYSTEM_ERROR)
    }
}

export async function deleteProfile(deviceId: number) {
const t = await DeviceMaintenanceProfile.sequelize.transaction()
    try {
      const profile = await DeviceMaintenanceProfile.findOne({ where: { device_id: deviceId }, transaction: t })
      if (!profile) throw new AppError('档案不存在', ErrorCode.RECORD_NOT_FOUND)
      await DeviceMaintenanceStandard.destroy({ where: { device_id: deviceId }, transaction: t })
      await profile.destroy({ transaction: t })
      await t.commit()
      return null
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      throw new AppError(err.message || '删除失败', ErrorCode.SYSTEM_ERROR)
    }
}

