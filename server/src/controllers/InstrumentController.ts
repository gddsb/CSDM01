/**
 * InstrumentController — 检验仪器档案
 * 底层已合并到 master_device 表（entity_type='仪器'）
 * 对外 API /basic/instruments 保持不变，内部统一走 Device model
 */
import { Op } from 'sequelize'
import { Device } from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { logger } from '../utils/logger.js'

export const list = async (req: any, res: any) => {
  try {
    const { keyword, status, department, calibration_type, page = 1, pageSize = 50 } = req.query as any
    const where: any = { entity_type: '仪器' }
    if (keyword) {
      where[Op.and] = [where[Op.and] || {}, { [Op.or]: [
        { device_code: { [Op.like]: `%${keyword}%` } },
        { device_name: { [Op.like]: `%${keyword}%` } },
        { device_model: { [Op.like]: `%${keyword}%` } },
      ] }]
    }
    if (status) {
      const map: Record<string, number> = { '在用': 1, '停用': 0, '运行': 1 }
      where.status = typeof status === 'string' && map[status] !== undefined ? map[status] : Number(status)
    }
    if (department) where.department = department
    if (calibration_type) where.calibration_type = calibration_type

    const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await Device.findAndCountAll({
      where, limit, offset, order: [['device_code', 'ASC']],
    })
    const out = rows.map((r: any) => ({
      instrument_id: r.device_id,
      instrument_no: r.device_code,
      instrument_name: r.device_name,
      instrument_model: r.device_model,
      precision: r.precision,
      department: r.department,
      location: r.location,
      status: (() => { const s = r.status; return s === '运行' ? '在用' : s })(),
      calibration_type: r.calibration_type,
      calibration_cycle: r.calibration_cycle,
      last_calibration_date: r.last_calibration_date,
      next_calibration_date: r.next_calibration_date,
      remarks: r.remarks,
      supplier: r.supplier,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }))
    return success(res, out, '查询成功', count)
  } catch (err: any) {
    logger.error('查询检测仪器列表失败: %s', err.message)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const detail = async (req: any, res: any) => {
  try {
    const { id } = req.params
    const d: any = await Device.findOne({ where: { device_id: id, entity_type: '仪器' } })
    if (!d) return fail(res, '检测仪器不存在', ErrorCode.RECORD_NOT_FOUND)
    return success(res, {
      instrument_id: d.device_id,
      instrument_no: d.device_code,
      instrument_name: d.device_name,
      instrument_model: d.device_model,
      precision: d.precision,
      department: d.department,
      location: d.location,
      status: (() => { const s = d.status; return s === '运行' ? '在用' : s })(),
      calibration_type: d.calibration_type,
      calibration_cycle: d.calibration_cycle,
      last_calibration_date: d.last_calibration_date,
      next_calibration_date: d.next_calibration_date,
      remarks: d.remarks,
      supplier: d.supplier,
      created_at: d.created_at,
      updated_at: d.updated_at,
    })
  } catch (err: any) {
    logger.error('查询检测仪器详情失败: %s', err.message)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const create = async (req: any, res: any) => {
  try {
    const { instrument_no, instrument_name, instrument_model, precision, department, location,
      status, calibration_type, calibration_cycle, last_calibration_date, next_calibration_date,
      remarks, supplier } = req.body
    if (!instrument_no || !instrument_name) return fail(res, '仪器编号和名称不能为空', ErrorCode.PARAM_INVALID)
    const exists = await Device.findOne({ where: { device_code: instrument_no } })
    if (exists) return fail(res, '仪器编号已存在', ErrorCode.RECORD_EXISTS)
    const device: any = await Device.create({
      entity_type: '仪器',
      device_code: instrument_no, device_name: instrument_name, device_model: instrument_model,
      device_type: '检验仪器', location,
      precision, department, supplier, remarks,
      calibration_type, calibration_cycle, last_calibration_date, next_calibration_date,
      status: status || '在用',
    })
    logger.info('检测仪器已创建: instrument_no=%s', instrument_no)
    return success(res, { instrument_id: device.device_id, instrument_no: device.device_code }, '创建成功')
  } catch (err: any) {
    logger.error('创建检测仪器失败: %s', err.message)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const update = async (req: any, res: any) => {
  try {
    const { id } = req.params
    const device: any = await Device.findOne({ where: { device_id: id, entity_type: '仪器' } })
    if (!device) return fail(res, '检测仪器不存在', ErrorCode.RECORD_NOT_FOUND)
    const { instrument_name, instrument_model, precision, department, location,
      status, calibration_type, calibration_cycle, last_calibration_date, next_calibration_date,
      remarks, supplier } = req.body
    await device.update({
      device_name: instrument_name, device_model: instrument_model,
      precision, department, location, supplier, remarks,
      calibration_type, calibration_cycle, last_calibration_date, next_calibration_date,
      status,
    })
    return success(res, device, '修改成功')
  } catch (err: any) {
    logger.error('修改检测仪器失败: %s', err.message)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const remove = async (req: any, res: any) => {
  try {
    const { id } = req.params
    const device: any = await Device.findOne({ where: { device_id: id, entity_type: '仪器' } })
    if (!device) return fail(res, '检测仪器不存在', ErrorCode.RECORD_NOT_FOUND)
    await device.destroy()
    logger.info('检测仪器已删除: device_code=%s', device.device_code)
    return success(res, null, '删除成功')
  } catch (err: any) {
    logger.error('删除检测仪器失败: %s', err.message)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export default { list, detail, create, update, remove }
