/**
 * 设备管理业务逻辑
 *
 * DeviceController 的业务下沉层，只处理领域逻辑：
 * - 输入校验、业务规则（唯一编码、类型白名单、关联数据防删）
 * - 模型查询 + 事务
 * - 抛出 AppError（由全局错误中间件统一转响应）
 *
 * 不依赖 Express（无 req/res），可直接写单元测试。
 */
import { Op } from 'sequelize'
import { Device, LineDevice, ProcessException } from '../models/index.js'
import { AppError } from '../utils/error.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'

const ALLOWED_DEVICE_TYPES = new Set(['生产设备', '检测设备', '辅助设备', '其他设备'])

export interface DeviceListQuery {
  keyword?: string | string[]
  status?: string | string[]
  device_type?: string
  line_id?: string | number
  is_special?: string | number
  dateStart?: string
  dateEnd?: string
  page?: string | number
  pageSize?: string | number
  sortBy?: string
  sortOrder?: string
  entity_type?: string
}

export interface DeviceCreateInput {
  device_code: string
  device_name: string
  device_type?: string
  device_model?: string
  serial_no?: string
  location?: string
  line_id?: number
  responsible_person?: string
  is_special?: boolean
  status?: number | string
  last_inspection_date?: string
  inspection_cycle?: string
  next_inspection_date?: string
  manufacturer?: string
  purchase_date?: string
  warranty_end?: string
}

export interface DeviceUpdateInput extends Partial<DeviceCreateInput> {
  device_code?: string
}

/** 构建列表查询条件（纯函数，可单测） */
export function buildDeviceWhere(query: DeviceListQuery): Record<string, any> {
  const where: any = {}

  // entity_type 默认值
  if (query.entity_type && query.entity_type !== '全部') where.entity_type = query.entity_type
  else if (!query.entity_type) where.entity_type = '设备'

  // keyword 多字段模糊搜
  if (query.keyword) {
    const kw = String(query.keyword).trim()
    if (kw) {
      where[Op.or] = [
        { device_code: { [Op.like]: `%${kw}%` } },
        { device_name: { [Op.like]: `%${kw}%` } },
        { device_model: { [Op.like]: `%${kw}%` } },
        { serial_no: { [Op.like]: `%${kw}%` } },
      ]
    }
  }

  if (query.is_special !== undefined && query.is_special !== '') {
    where.is_special = Number(query.is_special)
  }

  // status 支持单值或逗号分隔多值
  if (query.status !== undefined && query.status !== '') {
    const arr = Array.isArray(query.status) ? query.status : String(query.status).split(',')
    const vals = arr.map(s => Number(s)).filter(s => !isNaN(s))
    if (vals.length === 1) where.status = vals[0]
    else if (vals.length > 1) where.status = { [Op.in]: vals }
  }

  if (query.device_type) where.device_type = query.device_type
  if (query.line_id) where.line_id = Number(query.line_id)

  // 日期范围
  if (query.dateStart || query.dateEnd) {
    where.created_at = {}
    if (query.dateStart) where.created_at[Op.gte] = new Date(query.dateStart as string)
    if (query.dateEnd) where.created_at[Op.lte] = new Date(`${query.dateEnd} 23:59:59`)
  }

  return where
}

/** 构建排序数组（纯函数，白名单保护） */
export function buildDeviceOrder(sortBy?: string, sortOrder?: string): any[] {
  const ALLOWED = ['device_code', 'device_name', 'device_type', 'device_model', 'serial_no', 'location', 'status', 'created_at', 'updated_at']
  let order: any[] = [['device_type', 'ASC'], ['device_code', 'ASC']]

  if (sortBy) {
    const fields = sortBy.split(',').filter(f => ALLOWED.includes(f))
    if (fields.length > 0) {
      const orders = (sortOrder || 'asc').split(',')
      order = fields.map((field, idx) => [field, (orders[idx]?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC')])
    }
  }
  return order
}

/** 校验设备类型合法性（纯函数） */
export function validateDeviceType(device_type?: string): void {
  if (device_type && !ALLOWED_DEVICE_TYPES.has(device_type)) {
    throw new AppError(
      `设备类型不合法，可选值：${[...ALLOWED_DEVICE_TYPES].join('、')}`,
      10001, 400
    )
  }
}

export const DeviceService = {
  /** 分页查询设备列表 */
  async list(query: DeviceListQuery) {
    const where = buildDeviceWhere(query)
    const order = buildDeviceOrder(query.sortBy, query.sortOrder)
    const limit = Math.min(Number(query.pageSize) || 20, MAX_PAGE_SIZE)
    const offset = ((Number(query.page) || 1) - 1) * limit

    const { rows, count } = await Device.findAndCountAll({ where, limit, offset, order })
    return { rows, count }
  },

  /** 查设备详情，不存在抛 RECORD_NOT_FOUND */
  async detail(id: number | string) {
    const device = await Device.findOne({ where: { device_id: Number(id) } })
    if (!device) throw new AppError('设备不存在', 10002, 404)
    return device
  },

  /** 创建设备（含编码唯一校验 + 类型白名单） */
  async create(input: DeviceCreateInput) {
    if (!input.device_code || !input.device_name) {
      throw new AppError('设备编码和名称不能为空', 10001, 400)
    }
    validateDeviceType(input.device_type)

    const exists = await Device.findOne({ where: { device_code: input.device_code } })
    if (exists) throw new AppError('设备编码已存在', 10003, 409)

    return await Device.create({ entity_type: '设备', ...input } as any)
  },

  /** 修改设备（含编码唯一校验 + 类型白名单 + 存在校验） */
  async update(id: number | string, input: DeviceUpdateInput) {
    const device = await Device.findOne({ where: { device_id: Number(id) } })
    if (!device) throw new AppError('设备不存在', 10002, 404)

    // 改编码时校验新编码唯一性
    if (input.device_code && input.device_code !== (device as any).device_code) {
      const exists = await Device.findOne({
        where: { device_code: input.device_code, device_id: { [Op.ne]: Number(id) } },
      })
      if (exists) throw new AppError('设备编码已存在', 10003, 409)
    }

    validateDeviceType(input.device_type)

    await device.update(input as any)
    return device
  },

  /** 删除设备（含关联数据防删校验） */
  async remove(id: number | string) {
    const device = await Device.findOne({ where: { device_id: Number(id) } })
    if (!device) throw new AppError('设备不存在', 10002, 404)

    // 并行查关联数据
    const [lineDeviceCount, exceptionCount] = await Promise.all([
      LineDevice.count({ where: { device_id: Number(id) } }),
      ProcessException.count({ where: { device_id: Number(id) } }),
    ])
    if (lineDeviceCount > 0 || exceptionCount > 0) {
      throw new AppError(
        `该设备存在关联数据，不允许删除（产线配置${lineDeviceCount}条、异常工时${exceptionCount}条）`,
        20001, 409
      )
    }

    await device.destroy()
    return true
  },
}

export default DeviceService
