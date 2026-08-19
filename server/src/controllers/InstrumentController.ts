import { Op } from 'sequelize'
import { Instrument } from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { logger } from '../utils/logger.js'

// 检测仪器列表
export const list = async (req, res) => {
  try {
    const { keyword, status, department, calibration_type, page = 1, pageSize = 50 } = req.query
    const where: any = {}
    if (keyword) {
      where[Op.or] = [
        { instrument_no: { [Op.like]: `%${keyword}%` } },
        { instrument_name: { [Op.like]: `%${keyword}%` } },
        { instrument_model: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (status) where.status = status
    if (department) where.department = department
    if (calibration_type) where.calibration_type = calibration_type

    const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await Instrument.findAndCountAll({
      where,
      limit,
      offset,
      order: [['instrument_no', 'ASC']],
    })
    return success(res, rows, '查询成功', count)
  } catch (err) {
    logger.error('查询检测仪器列表失败: %s', err.message)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 检测仪器详情
export const detail = async (req, res) => {
  try {
    const { id } = req.params
    const instrument = await Instrument.findOne({ where: { instrument_id: id } })
    if (!instrument) return fail(res, '检测仪器不存在', ErrorCode.RECORD_NOT_FOUND)
    return success(res, instrument, '查询成功')
  } catch (err) {
    logger.error('查询检测仪器详情失败: %s', err.message)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 创建检测仪器
export const create = async (req, res) => {
  try {
    const { instrument_no, instrument_name, instrument_model, precision, department, location, status, calibration_type, calibration_cycle, last_calibration_date, next_calibration_date, remarks, supplier } = req.body
    if (!instrument_no || !instrument_name) {
      return fail(res, '仪器编号和名称不能为空', ErrorCode.PARAM_INVALID)
    }
    const exists = await Instrument.findOne({ where: { instrument_no } })
    if (exists) return fail(res, '仪器编号已存在', ErrorCode.RECORD_EXISTS)
    const instrument = await Instrument.create({
      instrument_no, instrument_name, instrument_model, precision, department, location, status, calibration_type, calibration_cycle, last_calibration_date, next_calibration_date, remarks, supplier,
    })
    logger.info('检测仪器已创建: instrument_no=%s', instrument_no)
    return success(res, instrument, '创建成功')
  } catch (err) {
    logger.error('创建检测仪器失败: %s', err.message)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 修改检测仪器（编号不可修改）
export const update = async (req, res) => {
  try {
    const { id } = req.params
    const instrument = await Instrument.findOne({ where: { instrument_id: id } })
    if (!instrument) return fail(res, '检测仪器不存在', ErrorCode.RECORD_NOT_FOUND)
    // 编号一旦生成不允许修改，忽略请求中的 instrument_no
    const { instrument_name, instrument_model, precision, department, location, status, calibration_type, calibration_cycle, last_calibration_date, next_calibration_date, remarks, supplier } = req.body
    await instrument.update({
      instrument_name, instrument_model, precision, department, location, status, calibration_type, calibration_cycle, last_calibration_date, next_calibration_date, remarks, supplier,
    })
    return success(res, instrument, '修改成功')
  } catch (err) {
    logger.error('修改检测仪器失败: %s', err.message)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 删除检测仪器
export const remove = async (req, res) => {
  try {
    const { id } = req.params
    const instrument = await Instrument.findOne({ where: { instrument_id: id } })
    if (!instrument) return fail(res, '检测仪器不存在', ErrorCode.RECORD_NOT_FOUND)
    await instrument.destroy()
    logger.info('检测仪器已删除: instrument_no=%s', instrument.instrument_no)
    return success(res, null, '删除成功')
  } catch (err) {
    logger.error('删除检测仪器失败: %s', err.message)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export default { list, detail, create, update, remove }
