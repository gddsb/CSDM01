/**
 * DeviceMaintenanceStandardService — 保养标准 CRUD
 * 从 origin/main 的 DeviceMaintenanceController.ts 抽取
 */
import { Op } from 'sequelize'
import { DeviceMaintenanceStandard, Device } from '../models/index.js'
import { ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import { logger } from '../utils/logger.js'

async function loadDeviceFields(
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

export async function listStandards(query: any) {
const { device_id, trigger_mode, status, item_name, standard_name, mechanism, keyword } = query
      const where: any = {}
      if (device_id) where.device_id = device_id
      if (trigger_mode) where.trigger_mode = trigger_mode
      if (status !== undefined && status !== '' && status !== null) where.status = Number(status)
      if (item_name) where.maintenance_content = { [Op.like]: `%${item_name}%` }
      else if (standard_name) where.maintenance_content = { [Op.like]: `%${standard_name}%` }
      else if (keyword) {
        where[Op.or] = [
          { maintenance_content: { [Op.like]: `%${keyword}%` } },
          { mechanism: { [Op.like]: `%${keyword}%` } },
          { component: { [Op.like]: `%${keyword}%` } },
        ]
      }
      if (mechanism) where.mechanism = { [Op.like]: `%${mechanism}%` }

      const rows = await DeviceMaintenanceStandard.findAll({
        where,
        include: [{ model: Device, as: 'device', required: false }],
        order: [['device_id', 'ASC'], ['trigger_mode', 'ASC'], ['sort_order', 'ASC'], ['standard_id', 'ASC']],
      })

      return { list: rows, total: rows.length }
}

export async function createStandard(body: any, user?: any) {
const t = await DeviceMaintenanceStandard.sequelize.transaction()
    try {
      const {
        device_id, device_code, device_name,
        mechanism, component, location, maintenance_method, maintenance_content,
        judge_type = '定性', standard_value, unit,
        point_count = 1, time_per_point = 0,
        trigger_mode = 'daily', monthly_plan, runtime_threshold,
        status = 1, remarks, inspection_roles,
      } = body

      if (!device_id) throw new AppError('设备ID不能为空', ErrorCode.PARAM_INVALID)
      if (!maintenance_content) throw new AppError('保养/点检内容不能为空', ErrorCode.PARAM_INVALID)

      // trigger_mode 校验
      if (!['daily', 'weekly', 'monthly', 'runtime'].includes(trigger_mode)) {
        throw new AppError('触发频率无效，可选值：daily / weekly / monthly / runtime', ErrorCode.PARAM_INVALID)
      }
      if (trigger_mode === 'monthly') {
        if (!Array.isArray(monthly_plan) || monthly_plan.length !== 12) {
          throw new AppError('月度计划必须提供 12 位布尔数组，表示1月~12月', ErrorCode.PARAM_INVALID)
        }
      }
      if (trigger_mode === 'runtime' && (!runtime_threshold || Number(runtime_threshold) <= 0)) {
        throw new AppError('运行时长模式必须填写有效的运行时长阈值', ErrorCode.PARAM_INVALID)
      }

      const { finalDeviceCode, finalDeviceName } = await loadDeviceFields(device_id, device_code, device_name, t)

      const record = await DeviceMaintenanceStandard.create({
        device_id,
        device_code: finalDeviceCode,
        device_name: finalDeviceName,
        mechanism: mechanism || null,
        component: component || null,
        location: location || null,
        maintenance_method: maintenance_method || null,
        maintenance_content: maintenance_content || null,
        judge_type,
        standard_value: standard_value || null,
        unit: unit || null,
        point_count: point_count !== undefined ? point_count : 1,
        time_per_point: time_per_point !== undefined ? time_per_point : 0,
        trigger_mode,
        monthly_plan: trigger_mode === 'monthly' ? monthly_plan : null,
        runtime_threshold: trigger_mode === 'runtime' ? runtime_threshold : null,
        last_trigger_value: null,
        sort_order: (body as any).sort_order !== undefined ? (body as any).sort_order : 0,
        status,
        remarks: remarks || null,
        inspection_roles: Array.isArray(inspection_roles) ? inspection_roles : null,
      }, { transaction: t })

      await t.commit()
      return record
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      throw new AppError(err.message || '创建失败', ErrorCode.SYSTEM_ERROR)
    }
}

export async function updateStandard(id: number, body: any) {
const t = await DeviceMaintenanceStandard.sequelize.transaction()
    try {
      const record = await DeviceMaintenanceStandard.findOne({ where: { standard_id: id }, transaction: t })
      if (!record) throw new AppError('保养标准不存在', ErrorCode.RECORD_NOT_FOUND)

      const {
        device_id, device_code, device_name,
        mechanism, component, location, maintenance_method, maintenance_content,
        judge_type, standard_value, unit,
        point_count, time_per_point,
        trigger_mode, monthly_plan, runtime_threshold,
        sort_order, status, remarks, inspection_roles,
      } = body

      if (trigger_mode !== undefined && !['daily', 'weekly', 'monthly', 'runtime'].includes(trigger_mode)) {
        throw new AppError('触发频率无效', ErrorCode.PARAM_INVALID)
      }
      if (trigger_mode === 'monthly' && monthly_plan !== undefined && monthly_plan !== null) {
        if (!Array.isArray(monthly_plan) || monthly_plan.length !== 12) {
          throw new AppError('月度计划必须提供 12 位布尔数组', ErrorCode.PARAM_INVALID)
        }
      }

      // 设备冗余字段自动补全
      const targetDeviceId = device_id !== undefined ? device_id : (record as any).getDataValue('device_id')
      if (device_id !== undefined || (device_code !== undefined && !device_name) || (device_name !== undefined && !device_code)) {
        const { finalDeviceCode, finalDeviceName } = await loadDeviceFields(targetDeviceId, device_code, device_name, t)
        body.device_code = finalDeviceCode
        body.device_name = finalDeviceName
      }

      const updateData: any = {}
      if (device_id !== undefined) updateData.device_id = device_id
      if (device_code !== undefined) updateData.device_code = device_code
      if (device_name !== undefined) updateData.device_name = device_name
      if (mechanism !== undefined) updateData.mechanism = mechanism
      if (component !== undefined) updateData.component = component
      if (location !== undefined) updateData.location = location
      if (maintenance_method !== undefined) updateData.maintenance_method = maintenance_method
      if (maintenance_content !== undefined) updateData.maintenance_content = maintenance_content
      if (judge_type !== undefined) updateData.judge_type = judge_type
      if (standard_value !== undefined) updateData.standard_value = standard_value
      if (unit !== undefined) updateData.unit = unit
      if (point_count !== undefined) updateData.point_count = point_count
      if (time_per_point !== undefined) updateData.time_per_point = time_per_point
      if (trigger_mode !== undefined) updateData.trigger_mode = trigger_mode
      if (monthly_plan !== undefined) updateData.monthly_plan = monthly_plan
      if (runtime_threshold !== undefined) updateData.runtime_threshold = runtime_threshold
      if (sort_order !== undefined) updateData.sort_order = sort_order
      if (status !== undefined) updateData.status = status
      if (remarks !== undefined) updateData.remarks = remarks
      if (inspection_roles !== undefined) updateData.inspection_roles = Array.isArray(inspection_roles) ? inspection_roles : null

      await record.update(updateData, { transaction: t })
      await t.commit()
      return record
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      throw new AppError(err.message || '更新失败', ErrorCode.SYSTEM_ERROR)
    }
}

export async function deleteStandard(id: number) {

      const record = await DeviceMaintenanceStandard.findOne({ where: { standard_id: id } })
      if (!record) throw new AppError('保养标准不存在', ErrorCode.RECORD_NOT_FOUND)
      await record.destroy()
      return { message: '删除成功' }
}

export default { listStandards, createStandard, updateStandard, deleteStandard }
