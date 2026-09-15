/**
 * 产线 Service（ProductionLineController 下沉）
 *
 * 业务：ProductionLine CRUD + 三表关联删除保护 + list 带 process_names/device_names 拼接
 * status 解析支持 5 种别名：'运行中'/1, '运行'/1, '维护中'/2, '维修'/2, '停用'/0
 */
import { Op } from 'sequelize'
import { ProductionLine, LineProcess, LineDevice, Process, Device, ReportOrder } from '../models/index.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import { logger } from '../utils/logger.js'

const PRODUCTION_LINE_WRITABLE_FIELDS = ['line_code', 'line_name', 'workshop', 'line_leader', 'sort_order', 'status']

function pickProductionLineFields(body: any): any {
  const data: any = {}
  for (const field of PRODUCTION_LINE_WRITABLE_FIELDS) {
    if (body[field] !== undefined) data[field] = body[field]
  }
  return data
}

export const ProductionLineService = {
  async list(query: any) {
    const { keyword, status, workshop, dateStart, dateEnd, page = 1, pageSize = 20 } = query
    const where: any = {}
    if (keyword) {
      where[Op.or] = [
        { line_code: { [Op.like]: `%${keyword}%` } },
        { line_name: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (status !== undefined && status !== '') {
      const statusArr = Array.isArray(status) ? status : String(status).split(',')
      const statusMap: Record<string, number> = { '运行中': 1, '维护中': 2, '停用': 0, '运行': 1, '维修': 2 }
      const statusValues = statusArr.map(s => {
        const trimmed = String(s).trim()
        return statusMap[trimmed] !== undefined ? statusMap[trimmed] : Number(trimmed)
      }).filter((s: number) => !isNaN(s))
      if (statusValues.length === 1) where.status = statusValues[0]
      else if (statusValues.length > 1) where.status = { [Op.in]: statusValues }
    }
    if (workshop) where.workshop = workshop
    if (dateStart || dateEnd) {
      where.created_at = {}
      if (dateStart) where.created_at[Op.gte] = new Date(dateStart)
      if (dateEnd) where.created_at[Op.lte] = new Date(dateEnd + ' 23:59:59')
    }

    const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await ProductionLine.findAndCountAll({
      where, limit, offset,
      order: [['sort_order', 'ASC'], ['line_id', 'DESC']],
    })

    // N+1 拼接工序/设备名称（数量级小，可控）
    const result = await Promise.all(rows.map(async (row: any) => {
      const data = row.toJSON()
      const processes = await LineProcess.findAll({
        where: { line_id: row.line_id },
        include: [{ model: Process, as: 'Process', attributes: ['process_name'] }],
        order: [['sort_order', 'ASC']],
      })
      const devices = await LineDevice.findAll({
        where: { line_id: row.line_id },
        include: [{ model: Device, as: 'Device', attributes: ['device_name'] }],
        order: [['sort_order', 'ASC']],
      })
      data.process_names = processes.map(p => p.Process?.process_name).filter(Boolean).join('、')
      data.device_names = devices.map(d => d.Device?.device_name).filter(Boolean).join('、')
      return data
    }))

    return { rows: result, count }
  },

  async detail(id: number | string) {
    const line = await ProductionLine.findOne({ where: { line_id: Number(id) } })
    if (!line) throw new AppError('产线不存在', 10002, 404)
    return line
  },

  async create(body: any) {
    const { line_code, line_name } = body
    if (!line_code || !line_name) throw new AppError('产线编码和名称不能为空', 10001, 400)
    const exists = await ProductionLine.findOne({ where: { line_code } })
    if (exists) throw new AppError('产线编码已存在', 20001, 409)
    return await ProductionLine.create(pickProductionLineFields(body))
  },

  async update(id: number | string, body: any) {
    const line = await ProductionLine.findOne({ where: { line_id: Number(id) } })
    if (!line) throw new AppError('产线不存在', 10002, 404)
    const data = pickProductionLineFields(body)
    if (data.line_code && data.line_code !== (line as any).line_code) {
      const exists = await ProductionLine.findOne({
        where: { line_code: data.line_code, line_id: { [Op.ne]: Number(id) } },
      })
      if (exists) throw new AppError('产线编码已存在', 20001, 409)
    }
    await line.update(data)
    return line
  },

  async remove(id: number | string) {
    const line = await ProductionLine.findOne({ where: { line_id: Number(id) } })
    if (!line) throw new AppError('产线不存在', 10002, 404)
    const [reportOrderCount, lineProcessCount, lineDeviceCount] = await Promise.all([
      ReportOrder.count({ where: { line_id: Number(id) } }),
      LineProcess.count({ where: { line_id: Number(id) } }),
      LineDevice.count({ where: { line_id: Number(id) } }),
    ])
    if (reportOrderCount > 0 || lineProcessCount > 0 || lineDeviceCount > 0) {
      throw new AppError(
        `该产线存在关联数据，不允许删除（报工单${reportOrderCount}条、工序${lineProcessCount}条、设备${lineDeviceCount}台）`,
        30001, 409,
      )
    }
    await line.destroy()
    logger.info(`产线已删除: line_id=${id}, line_code=${(line as any).line_code}`)
    return true
  },
}

export default ProductionLineService
