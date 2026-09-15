/**
 * 设备保养标准 Service（DeviceMaintenanceController 标准子模块下沉）
 *
 * 业务：保养标准 CRUD（trigger_mode: daily/weekly/monthly/runtime）
 * 内部 helper：loadDeviceFields（补设备冗余字段）+ getLatestRuntime（查运行小时）
 * getRecordDetail（记录详情含图片）
 */
import { Op } from 'sequelize'
import {
  DeviceMaintenanceStandard,
  DeviceMaintenanceRecord,
  DeviceRuntimeLog,
  Device,
  DeviceFault,
  DeviceImage,
} from '../models/index.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import { logger } from '../utils/logger.js'

// 未完成执行记录状态（不含已完成2）
export const UNFINISHED_STATUS = [0, 1, 3]

const rawStatus = (record: any): number => record.getDataValue('status')

// ============================================================
// 内部 DB helper（原 Controller 私有函数，下沉为 Service 私有函数）
// ============================================================

/** 自动补全设备冗余字段（device_code / device_name） */
export async function loadDeviceFields(
  deviceId: number,
  fallbackCode?: string | null,
  fallbackName?: string | null,
  t?: any,
): Promise<{ finalDeviceCode: string; finalDeviceName: string }> {
  if (fallbackCode && fallbackName) {
    return { finalDeviceCode: fallbackCode, finalDeviceName: fallbackName }
  }
  const device = await Device.findOne({
    where: { device_id: deviceId },
    attributes: ['device_code', 'device_name'],
    transaction: t,
  })
  if (!device) {
    return { finalDeviceCode: fallbackCode || '', finalDeviceName: fallbackName || '' }
  }
  return {
    finalDeviceCode: fallbackCode || (device as any).getDataValue('device_code') || '',
    finalDeviceName: fallbackName || (device as any).getDataValue('device_name') || '',
  }
}

/** 查设备最新运行小时（runtime 触发用） */
export async function getLatestRuntime(deviceId: number, t?: any): Promise<number> {
  const log = await DeviceRuntimeLog.findOne({
    where: { device_id: deviceId },
    order: [['created_at', 'DESC'], ['log_id', 'DESC']],
    transaction: t,
  })
  return log ? Number((log as any).getDataValue('runtime_hours')) : 0
}

/** 保养记录详情（含关联图片 + 关联故障） */
export async function getRecordDetail(id: number) {
  const record = await DeviceMaintenanceRecord.findOne({
    where: { record_id: id },
    include: [
      {
        model: DeviceImage,
        as: 'record_images',
        required: false,
        separate: true,
        order: [['sort_order', 'ASC'], ['image_id', 'ASC']],
      },
      {
        model: DeviceImage,
        as: 'abnormal_images',
        required: false,
        separate: true,
        order: [['sort_order', 'ASC'], ['image_id', 'ASC']],
      },
      {
        model: DeviceFault,
        as: 'device_fault',
        required: false,
      },
      {
        model: Device,
        as: 'device',
        required: false,
        attributes: ['device_id', 'device_code', 'device_name'],
      },
      {
        model: DeviceMaintenanceStandard,
        as: 'standard',
        required: false,
        attributes: ['standard_id', 'standard_name', 'trigger_mode', 'runtime_threshold', 'sort_order'],
      },
    ],
  })
  return record
}

// ============================================================
// 保养标准 CRUD
// ============================================================

export const DeviceMaintenanceStandardService = {
  /** 保养标准列表（按设备/触发模式/状态筛选） */
  async listStandards(query: any) {
    const { device_id, trigger_mode, status, keyword, page = 1, pageSize = 50 } = query
    const where: any = {}
    if (device_id) where.device_id = device_id
    if (trigger_mode) where.trigger_mode = trigger_mode
    if (status !== undefined && status !== '') where.status = Number(status)
    if (keyword) {
      where[Op.or] = [
        { standard_name: { [Op.like]: `%${keyword}%` } },
        { item_name: { [Op.like]: `%${keyword}%` } },
      ]
    }
    const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
    const offset = (Number(page) - 1) * limit

    return await DeviceMaintenanceStandard.findAndCountAll({
      where,
      include: [{ model: Device, as: 'device', required: false, attributes: ['device_id', 'device_code', 'device_name'] }],
      limit, offset,
      order: [['device_id', 'ASC'], ['trigger_mode', 'ASC'], ['sort_order', 'ASC']],
      distinct: true,
    })
  },

  /** 创建保养标准（自动补设备信息 + 去重校验） */
  async createStandard(body: any, actor?: any) {
    const { device_id, trigger_mode, item_name, standard_name } = body
    if (!device_id) throw new AppError('设备不能为空', 10001, 400)
    if (!trigger_mode) throw new AppError('触发模式不能为空', 10001, 400)
    if (!item_name) throw new AppError('保养项目不能为空', 10001, 400)
    if (!['daily', 'weekly', 'monthly', 'runtime'].includes(trigger_mode)) {
      throw new AppError('触发模式只能是 daily/weekly/monthly/runtime', 10001, 400)
    }
    if (trigger_mode === 'runtime' && !body.runtime_threshold) {
      throw new AppError('runtime 模式必须填写运行小时阈值', 10001, 400)
    }

    const device = await Device.findOne({ where: { device_id } })
    if (!device) throw new AppError('设备不存在', 10002, 404)

    // 同设备 + 同触发模式 + 同项目名 去重
    const exists = await DeviceMaintenanceStandard.findOne({
      where: { device_id, trigger_mode, item_name },
    })
    if (exists) throw new AppError('同设备已存在相同触发模式和保养项目的标准', 20001, 409)

    return await DeviceMaintenanceStandard.create({
      device_id,
      device_code: (device as any).getDataValue('device_code'),
      device_name: (device as any).getDataValue('device_name'),
      trigger_mode,
      standard_name: standard_name || `${trigger_mode}-${item_name}`,
      item_name,
      item_content: body.item_content || '',
      standard_value: body.standard_value || null,
      actual_value: body.actual_value || null,
      runtime_threshold: body.runtime_threshold || null,
      sort_order: body.sort_order || 0,
      monthly_plan: body.monthly_plan || null,
      status: body.status !== undefined ? body.status : 1,
      created_by: actor?.userId || null,
      remarks: body.remarks || '',
    } as any)
  },

  /** 修改保养标准 */
  async updateStandard(id: number | string, body: any) {
    const record = await DeviceMaintenanceStandard.findOne({ where: { standard_id: Number(id) } })
    if (!record) throw new AppError('保养标准不存在', 10002, 404)

    if (body.trigger_mode && !['daily', 'weekly', 'monthly', 'runtime'].includes(body.trigger_mode)) {
      throw new AppError('触发模式只能是 daily/weekly/monthly/runtime', 10001, 400)
    }
    if (body.trigger_mode === 'runtime' && !body.runtime_threshold) {
      throw new AppError('runtime 模式必须填写运行小时阈值', 10001, 400)
    }

    const updateData: any = {}
    const fields = [
      'trigger_mode', 'standard_name', 'item_name', 'item_content',
      'standard_value', 'actual_value', 'runtime_threshold', 'sort_order',
      'monthly_plan', 'status', 'remarks',
    ]
    for (const f of fields) {
      if (body[f] !== undefined) updateData[f] = body[f]
    }

    await record.update(updateData)
    return record
  },

  /** 删除保养标准（只有 status=1 生效 可以删？原始逻辑没校验，保留原样） */
  async deleteStandard(id: number | string) {
    const record = await DeviceMaintenanceStandard.findOne({ where: { standard_id: Number(id) } })
    if (!record) throw new AppError('保养标准不存在', 10002, 404)

    // 删除关联的执行记录（非已完成的也要删）
    await DeviceMaintenanceRecord.destroy({ where: { standard_id: Number(id) } })
    await record.destroy()
    return true
  },
}

export default DeviceMaintenanceStandardService
