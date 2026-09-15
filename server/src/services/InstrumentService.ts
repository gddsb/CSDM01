/**
 * InstrumentService — 检验仪器档案 CRUD
 * 底层合并到 master_device 表（entity_type='仪器'）
 * 从 controllers/InstrumentController.ts 抽取
 */
import { Op } from 'sequelize'
import { Device } from '../models/index.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'
import { logger } from '../utils/logger.js'
import { AppError } from '../utils/error.js'

const ENTITY_TYPE = '仪器'

function mapStatus(s: any) { return s === '运行' ? '在用' : s }

function toInstrument(r: any) {
  return {
    instrument_id: r.device_id, instrument_no: r.device_code, instrument_name: r.device_name,
    instrument_model: r.device_model, precision: r.precision, department: r.department,
    location: r.location, status: mapStatus(r.status),
    calibration_type: r.calibration_type, calibration_cycle: r.calibration_cycle,
    last_calibration_date: r.last_calibration_date, next_calibration_date: r.next_calibration_date,
    remarks: r.remarks, supplier: r.supplier, created_at: r.created_at, updated_at: r.updated_at,
  }
}

export async function list(query: any) {
  const { keyword, status, department, calibration_type, page = 1, pageSize = 50 } = query
  const where: any = { entity_type: ENTITY_TYPE }
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
  return { rows: rows.map(toInstrument), count }
}

export async function detail(id: number | string) {
  const d: any = await Device.findOne({ where: { device_id: id, entity_type: ENTITY_TYPE } })
  if (!d) throw new AppError('检测仪器不存在', 10002, 404)
  return toInstrument(d)
}

export async function create(body: any) {
  const { instrument_no, instrument_name, instrument_model, precision, department, location,
    status, calibration_type, calibration_cycle, last_calibration_date, next_calibration_date,
    remarks, supplier } = body
  if (!instrument_no || !instrument_name) throw new AppError('仪器编号和名称不能为空', 10001, 400)
  const exists = await Device.findOne({ where: { device_code: instrument_no } })
  if (exists) throw new AppError('仪器编号已存在', 10003, 409)
  const device: any = await Device.create({
    entity_type: ENTITY_TYPE,
    device_code: instrument_no, device_name: instrument_name, device_model: instrument_model,
    device_type: '检验仪器', location, precision, department, supplier, remarks,
    calibration_type, calibration_cycle, last_calibration_date, next_calibration_date,
    status: status || '在用',
  })
  logger.info('检测仪器已创建: instrument_no=%s', instrument_no)
  return { instrument_id: device.device_id, instrument_no: device.device_code }
}

export async function update(id: number | string, body: any) {
  const device: any = await Device.findOne({ where: { device_id: id, entity_type: ENTITY_TYPE } })
  if (!device) throw new AppError('检测仪器不存在', 10002, 404)
  const { instrument_name, instrument_model, precision, department, location,
    status, calibration_type, calibration_cycle, last_calibration_date, next_calibration_date,
    remarks, supplier } = body
  await device.update({
    device_name: instrument_name, device_model: instrument_model,
    precision, department, location, supplier, remarks,
    calibration_type, calibration_cycle, last_calibration_date, next_calibration_date,
    status,
  })
  return device
}

export async function remove(id: number | string) {
  const device: any = await Device.findOne({ where: { device_id: id, entity_type: ENTITY_TYPE } })
  if (!device) throw new AppError('检测仪器不存在', 10002, 404)
  await device.destroy()
  logger.info('检测仪器已删除: device_code=%s', device.device_code)
}

export default { list, detail, create, update, remove }
