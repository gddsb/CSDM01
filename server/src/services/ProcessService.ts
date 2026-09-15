/**
 * 工序 Service（ProcessController 下沉）
 *
 * 业务：工序列表（Process）CRUD + 关联数据保护
 *   - 字段白名单 pickProcessFields（防止随意写入非预期字段）
 *   - remove 前检查 LineProcess / ReportProcess / LineDevice 三表引用计数
 */
import { Op } from 'sequelize'
import { Process, LineProcess, ReportProcess, LineDevice } from '../models/index.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import { logger } from '../utils/logger.js'

const PROCESS_WRITABLE_FIELDS = ['process_code', 'process_name', 'sort_order', 'has_material', 'must_report', 'status']

function pickProcessFields(body: any): any {
  const data: any = {}
  for (const field of PROCESS_WRITABLE_FIELDS) {
    if (body[field] !== undefined) data[field] = body[field]
  }
  return data
}

export const ProcessService = {
  async list(query: any) {
    const { keyword, status, dateStart, dateEnd, page = 1, pageSize = 50 } = query
    const where: any = {}
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
    return await Process.findAndCountAll({
      where,
      limit,
      offset,
      order: [['sort_order', 'ASC'], ['process_id', 'DESC']],
    })
  },

  async detail(id: number | string) {
    const process = await Process.findOne({ where: { process_id: Number(id) } })
    if (!process) throw new AppError('工序不存在', 10002, 404)
    return process
  },

  async create(body: any) {
    const { process_code, process_name } = body
    if (!process_code || !process_name) {
      throw new AppError('工序编码和名称不能为空', 10001, 400)
    }
    const exists = await Process.findOne({ where: { process_code } })
    if (exists) throw new AppError('工序编码已存在', 20001, 409)

    const data = pickProcessFields(body)
    return await Process.create(data)
  },

  async update(id: number | string, body: any) {
    const process = await Process.findOne({ where: { process_id: Number(id) } })
    if (!process) throw new AppError('工序不存在', 10002, 404)

    const data = pickProcessFields(body)
    if (data.process_code && data.process_code !== (process as any).process_code) {
      const exists = await Process.findOne({
        where: { process_code: data.process_code, process_id: { [Op.ne]: Number(id) } },
      })
      if (exists) throw new AppError('工序编码已存在', 20001, 409)
    }
    await process.update(data)
    return process
  },

  /** 删除工序 —— 前置检查 3 张关联表的引用计数 */
  async remove(id: number | string) {
    const process = await Process.findOne({ where: { process_id: Number(id) } })
    if (!process) throw new AppError('工序不存在', 10002, 404)

    const [lineProcessCount, reportProcessCount, lineDeviceCount] = await Promise.all([
      LineProcess.count({ where: { process_id: Number(id) } }),
      ReportProcess.count({ where: { process_id: Number(id) } }),
      LineDevice.count({ where: { process_id: Number(id) } }),
    ])
    if (lineProcessCount > 0 || reportProcessCount > 0 || lineDeviceCount > 0) {
      throw new AppError(
        `该工序存在关联数据，不允许删除（产线工序${lineProcessCount}条、报工工序${reportProcessCount}条、设备配置${lineDeviceCount}条）`,
        30001,
        409,
      )
    }

    await process.destroy()
    logger.info(`工序已删除: process_id=${id}, process_code=${(process as any).process_code}`)
    return true
  },
}

export default ProcessService
