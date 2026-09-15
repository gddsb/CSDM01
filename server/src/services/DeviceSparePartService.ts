/**
 * 设备备件库存 Service（DeviceSparePartController 下沉）
 * 含库存管理 + 出入库 + 库存调整（带日志事务）
 */
import { Op } from 'sequelize'
import sequelize from '../config/database.js'
import { DeviceSparePart, DeviceSparePartLog } from '../models/index.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'
import { AppError } from '../utils/error.js'

const ALLOWED_LOG_TYPES = new Set(['in', 'out', 'adjust'])

// ---------- 纯函数 ----------

export function parseSpareStatusParam(status: any): number[] | null {
  if (status === undefined || status === '' || status === null) return null
  const arr = Array.isArray(status) ? status : [status]
  const nums: number[] = []
  for (const s of arr) {
    const parts = typeof s === 'string' && s.includes(',') ? s.split(',') : [s]
    for (const p of parts) {
      const n = Number(p)
      if (!Number.isNaN(n)) nums.push(n)
    }
  }
  return nums.length ? nums : null
}

/** 构建列表 where（含低库存预警：current_stock < safety_stock_min） */
export function buildSpareWhere(query: any): any {
  const where: any = {}
  const { keyword, category, status, low_stock } = query

  if (keyword) {
    where[Op.or] = [
      { part_code: { [Op.like]: `%${keyword}%` } },
      { part_name: { [Op.like]: `%${keyword}%` } },
      { specification: { [Op.like]: `%${keyword}%` } },
    ]
  }
  if (category) where.category = category
  const statusArr = parseSpareStatusParam(status)
  if (statusArr) where.status = statusArr.length === 1 ? statusArr[0] : { [Op.in]: statusArr }
  if (low_stock !== undefined && low_stock !== '' && String(low_stock) !== '0') {
    where.current_stock = { [Op.lt]: sequelize.col('safety_stock_min') }
  }
  return where
}

/** 构建排序数组（白名单保护） */
const ALLOWED_SORT = ['part_code', 'part_name', 'specification', 'category', 'current_stock', 'safety_stock_min', 'safety_stock_max', 'status', 'created_at', 'updated_at']
export function buildSpareOrder(sortBy?: string, sortOrder?: string): any[] {
  let order: any[] = [['part_code', 'ASC']]
  if (sortBy) {
    const fields = String(sortBy).split(',').filter((f: string) => ALLOWED_SORT.includes(f))
    if (fields.length > 0) {
      const orders = String(sortOrder || 'asc').split(',')
      order = fields.map((field: string, idx: number) => [field, orders[idx]?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'])
    }
  }
  return order
}

// ---------- Service ----------

export const DeviceSparePartService = {
  /** 备件列表 */
  async list(query: any) {
    const where = buildSpareWhere(query)
    const limit = Math.min(Number(query.pageSize) || 20, MAX_PAGE_SIZE)
    const offset = ((Number(query.page) || 1) - 1) * limit
    const order = buildSpareOrder(query.sortBy, query.sortOrder)

    return await DeviceSparePart.findAndCountAll({ where, limit, offset, order })
  },

  /** 备件详情（含最近 20 条日志） */
  async detail(id: number | string) {
    const part = await DeviceSparePart.findOne({
      where: { part_id: Number(id) },
      include: [{ model: DeviceSparePartLog, as: 'logs', required: false, separate: true, order: [['log_id', 'DESC']], limit: 20 }],
    })
    if (!part) throw new AppError('备件不存在', 10002, 404)
    return part
  },

  /** 创建备件 */
  async create(body: any) {
    if (!body.part_name) throw new AppError('备件名称不能为空', 10001, 400)
    if (body.part_code) {
      const exists = await DeviceSparePart.findOne({ where: { part_code: body.part_code } })
      if (exists) throw new AppError('备件编号已存在', 10003, 409)
    }
    return await DeviceSparePart.create(body as any)
  },

  /** 修改备件 */
  async update(id: number | string, body: any) {
    const part = await DeviceSparePart.findOne({ where: { part_id: Number(id) } })
    if (!part) throw new AppError('备件不存在', 10002, 404)

    if (body.part_code && body.part_code !== (part as any).part_code) {
      const exists = await DeviceSparePart.findOne({
        where: { part_code: body.part_code, part_id: { [Op.ne]: Number(id) } },
      })
      if (exists) throw new AppError('备件编号已存在', 10003, 409)
    }

    await part.update(body as any)
    return part
  },

  /** 删除备件（检查是否有关联出入库日志） */
  async delete(id: number | string) {
    const part = await DeviceSparePart.findOne({ where: { part_id: Number(id) } })
    if (!part) throw new AppError('备件不存在', 10002, 404)

    const logCount = await DeviceSparePartLog.count({ where: { part_id: Number(id) } })
    if (logCount > 0) throw new AppError(`该备件存在 ${logCount} 条出入库记录，不允许删除`, 20001, 409)

    await part.destroy()
    return true
  },

  /** 入库（事务：更新库存 + 写日志） */
  async stockIn(id: number | string, body: any, actor?: any) {
    const part = await DeviceSparePart.findOne({ where: { part_id: Number(id) } })
    if (!part) throw new AppError('备件不存在', 10002, 404)

    const qty = Number(body.quantity)
    if (!Number.isInteger(qty) || qty <= 0) throw new AppError('入库数量必须为正整数', 10001, 400)

    const t = await sequelize.transaction()
    try {
      const newStock = Number((part as any).current_stock || 0) + qty
      await part.update({ current_stock: newStock } as any, { transaction: t })
      await DeviceSparePartLog.create({
        part_id: Number(id),
        log_type: 'in',
        quantity: qty,
        before_stock: Number((part as any).current_stock || 0),
        after_stock: newStock,
        reason: body.reason || '',
        operator: actor?.username || null,
        remark: body.remark || '',
      } as any, { transaction: t })
      await t.commit()
      return part
    } catch (err) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      throw err
    }
  },

  /** 出库（事务 + 库存不足校验） */
  async stockOut(id: number | string, body: any, actor?: any) {
    const part = await DeviceSparePart.findOne({ where: { part_id: Number(id) } })
    if (!part) throw new AppError('备件不存在', 10002, 404)

    const qty = Number(body.quantity)
    if (!Number.isInteger(qty) || qty <= 0) throw new AppError('出库数量必须为正整数', 10001, 400)

    const current = Number((part as any).current_stock || 0)
    if (qty > current) throw new AppError(`库存不足，当前库存 ${current}`, 20001, 409)

    const t = await sequelize.transaction()
    try {
      const newStock = current - qty
      await part.update({ current_stock: newStock } as any, { transaction: t })
      await DeviceSparePartLog.create({
        part_id: Number(id),
        log_type: 'out',
        quantity: qty,
        before_stock: current,
        after_stock: newStock,
        reason: body.reason || '',
        operator: actor?.username || null,
        remark: body.remark || '',
      } as any, { transaction: t })
      await t.commit()
      return part
    } catch (err) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      throw err
    }
  },

  /** 库存调整（事务） */
  async stockAdjust(id: number | string, body: any, actor?: any) {
    const part = await DeviceSparePart.findOne({ where: { part_id: Number(id) } })
    if (!part) throw new AppError('备件不存在', 10002, 404)

    const qty = Number(body.quantity)
    if (!Number.isInteger(qty)) throw new AppError('调整数量必须为整数', 10001, 400)

    const t = await sequelize.transaction()
    try {
      const current = Number((part as any).current_stock || 0)
      const newStock = current + qty
      if (newStock < 0) throw new AppError(`调整后库存不能为负，当前 ${current}，调整 ${qty}`, 20001, 409)

      await part.update({ current_stock: newStock } as any, { transaction: t })
      await DeviceSparePartLog.create({
        part_id: Number(id),
        log_type: 'adjust',
        quantity: qty,
        before_stock: current,
        after_stock: newStock,
        reason: body.reason || '',
        operator: actor?.username || null,
        remark: body.remark || '',
      } as any, { transaction: t })
      await t.commit()
      return part
    } catch (err) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      throw err
    }
  },

  /** 查询某备件的日志 */
  async listLogs(id: number | string) {
    return await DeviceSparePartLog.findAll({
      where: { part_id: Number(id) },
      order: [['log_id', 'DESC']],
      limit: 100,
    })
  },

  /** 低库存预警列表 */
  async getLowStock() {
    return await DeviceSparePart.findAll({
      where: { current_stock: { [Op.lt]: sequelize.col('safety_stock_min') } },
      order: [['part_code', 'ASC']],
    })
  },
}

export default DeviceSparePartService
