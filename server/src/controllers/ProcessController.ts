import { Op } from 'sequelize'
import { Process, LineProcess, ReportProcess, LineDevice } from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { logger } from '../utils/logger.js'

// 工序列表
export const list = async (req, res) => {
  try {
    const { keyword, status, dateStart, dateEnd, page = 1, pageSize = 50 } = req.query
    const where = {}
    if (keyword) {
      where[Op.or] = [
        { process_code: { [Op.like]: `%${keyword}%` } },
        { process_name: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (status !== undefined && status !== '') where.status = Number(status)
    if (dateStart || dateEnd) {
      where.created_at = {}
      if (dateStart) where.created_at[Op.gte] = new Date(dateStart)
      if (dateEnd) where.created_at[Op.lte] = new Date(dateEnd + ' 23:59:59')
    }

    const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await Process.findAndCountAll({
      where,
      limit,
      offset,
      order: [['sort_order', 'ASC'], ['process_id', 'DESC']],
    })
    return success(res, rows, '查询成功', count)
  } catch (err) {
    console.error('查询工序列表失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 工序详情
export const detail = async (req, res) => {
  try {
    const { id } = req.params
    const process = await Process.findOne({ where: { process_id: id } })
    if (!process) return fail(res, '工序不存在', ErrorCode.RECORD_NOT_FOUND)
    return success(res, process, '查询成功')
  } catch (err) {
    console.error('查询工序详情失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

const PROCESS_WRITABLE_FIELDS = ['process_code', 'process_name', 'sort_order', 'has_material', 'must_report', 'status']

function pickProcessFields(body) {
  const data = {}
  for (const field of PROCESS_WRITABLE_FIELDS) {
    if (body[field] !== undefined) data[field] = body[field]
  }
  return data
}

// 创建工序
export const create = async (req, res) => {
  try {
    const { process_code, process_name } = req.body
    if (!process_code || !process_name) {
      return fail(res, '工序编码和名称不能为空', ErrorCode.PARAM_INVALID)
    }
    const exists = await Process.findOne({ where: { process_code } })
    if (exists) return fail(res, '工序编码已存在', ErrorCode.RECORD_EXISTS)
    const data = pickProcessFields(req.body)
    const process = await Process.create(data)
    return success(res, process, '创建成功')
  } catch (err) {
    console.error('创建工序失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 修改工序
export const update = async (req, res) => {
  try {
    const { id } = req.params
    const process = await Process.findOne({ where: { process_id: id } })
    if (!process) return fail(res, '工序不存在', ErrorCode.RECORD_NOT_FOUND)
    const data = pickProcessFields(req.body)
    if (data.process_code && data.process_code !== process.process_code) {
      const exists = await Process.findOne({
        where: { process_code: data.process_code, process_id: { [Op.ne]: id } },
      })
      if (exists) return fail(res, '工序编码已存在', ErrorCode.RECORD_EXISTS)
    }
    await process.update(data)
    return success(res, process, '修改成功')
  } catch (err) {
    console.error('修改工序失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 删除工序
export const remove = async (req, res) => {
  try {
    const { id } = req.params
    const process = await Process.findOne({ where: { process_id: id } })
    if (!process) return fail(res, '工序不存在', ErrorCode.RECORD_NOT_FOUND)

    const [lineProcessCount, reportProcessCount, lineDeviceCount] = await Promise.all([
      LineProcess.count({ where: { process_id: id } }),
      ReportProcess.count({ where: { process_id: id } }),
      LineDevice.count({ where: { process_id: id } }),
    ])
    if (lineProcessCount > 0 || reportProcessCount > 0 || lineDeviceCount > 0) {
      return fail(res, `该工序存在关联数据，不允许删除（产线工序${lineProcessCount}条、报工工序${reportProcessCount}条、设备配置${lineDeviceCount}条）`, ErrorCode.BUSINESS_ERROR)
    }

    await process.destroy()
    logger.info(`工序已删除: process_id=${id}, process_code=${process.process_code}`)
    return success(res, null, '删除成功')
  } catch (err) {
    logger.error('删除工序失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export default { list, detail, create, update, remove }
