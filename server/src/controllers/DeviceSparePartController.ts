import { Op } from 'sequelize'
import sequelize from '../config/database.js'
import { DeviceSparePart, DeviceSparePartLog } from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { logger } from '../utils/logger.js'

const ALLOWED_LOG_TYPES = new Set(['in', 'out', 'adjust'])

// 解析状态参数：兼容数字 / 逗号字符串 / 数组
function parseStatusParam(status: any): number[] | null {
  if (status === undefined || status === '' || status === null) return null
  const arr = Array.isArray(status) ? status : [status]
  const nums: number[] = []
  arr.forEach((s: any) => {
    if (typeof s === 'string' && s.includes(',')) {
      s.split(',').forEach((p: string) => {
        const n = Number(p)
        if (!Number.isNaN(n)) nums.push(n)
      })
    } else {
      const n = Number(s)
      if (!Number.isNaN(n)) nums.push(n)
    }
  })
  return nums.length ? nums : null
}

export default {
  /**
   * 分页查询备件列表
   * 支持按编号/名称搜索、分类、状态筛选，以及低库存预警查询
   */
  async list(req: any, res: any) {
    try {
      const {
        keyword, category, status, low_stock,
        page = 1, pageSize = 20, sortBy, sortOrder,
      } = req.query

      const where: any = {}
      if (keyword) {
        where[Op.or] = [
          { part_code: { [Op.like]: `%${keyword}%` } },
          { part_name: { [Op.like]: `%${keyword}%` } },
          { specification: { [Op.like]: `%${keyword}%` } },
        ]
      }
      if (category) where.category = category
      const statusArr = parseStatusParam(status)
      if (statusArr) where.status = statusArr.length === 1 ? statusArr[0] : { [Op.in]: statusArr }
      // 低库存预警：当前库存 < 安全库存下限
      if (low_stock !== undefined && low_stock !== '' && String(low_stock) !== '0') {
        where.current_stock = { [Op.lt]: sequelize.col('safety_stock_min') }
      }

      const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
      const offset = (Number(page) - 1) * limit

      let order: any[] = [['part_code', 'ASC']]
      if (sortBy) {
        const allowedSortFields = ['part_code', 'part_name', 'specification', 'category', 'current_stock', 'safety_stock_min', 'safety_stock_max', 'status', 'created_at', 'updated_at']
        const fields = String(sortBy).split(',').filter((f: string) => allowedSortFields.includes(f))
        if (fields.length > 0) {
          const orders = String(sortOrder || 'asc').split(',')
          order = fields.map((field: string, idx: number) => [field, orders[idx]?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'])
        }
      }

      const { rows, count } = await DeviceSparePart.findAndCountAll({
        where,
        limit,
        offset,
        order,
      })
      return success(res, rows, '查询成功', count)
    } catch (err: any) {
      logger.error('[DeviceSparePart] list error:', err)
      return fail(res, err.message || '服务器错误', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 备件详情
   */
  async detail(req: any, res: any) {
    try {
      const { id } = req.params
      const part = await DeviceSparePart.findOne({
        where: { part_id: id },
        include: [{ model: DeviceSparePartLog, as: 'logs', required: false, separate: true, order: [['log_id', 'DESC']], limit: 20 }],
      })
      if (!part) return fail(res, '备件不存在', ErrorCode.RECORD_NOT_FOUND)
      return success(res, part, '查询成功')
    } catch (err: any) {
      logger.error('[DeviceSparePart] detail error:', err)
      return fail(res, err.message || '服务器错误', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 创建备件
   */
  async create(req: any, res: any) {
    try {
      const {
        part_code, part_name, specification, unit, applicable_devices, category,
        safety_stock_min, safety_stock_max, current_stock, warehouse, shelf, layer,
        status, remarks,
      } = req.body

      if (!part_name) {
        return fail(res, '备件名称不能为空', ErrorCode.PARAM_INVALID)
      }

      if (part_code) {
        const exists = await DeviceSparePart.findOne({ where: { part_code } })
        if (exists) return fail(res, '备件编号已存在', ErrorCode.RECORD_EXISTS)
      }

      const part = await DeviceSparePart.create({
        part_code, part_name, specification, unit, applicable_devices, category,
        safety_stock_min, safety_stock_max, current_stock, warehouse, shelf, layer,
        status, remarks,
      })
      return success(res, part, '创建成功')
    } catch (err: any) {
      logger.error('[DeviceSparePart] create error:', err)
      return fail(res, err.message || '服务器错误', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 更新备件
   */
  async update(req: any, res: any) {
    try {
      const { id } = req.params
      const part = await DeviceSparePart.findOne({ where: { part_id: id } })
      if (!part) return fail(res, '备件不存在', ErrorCode.RECORD_NOT_FOUND)

      if (req.body.part_code && req.body.part_code !== (part as any).part_code) {
        const exists = await DeviceSparePart.findOne({
          where: { part_code: req.body.part_code, part_id: { [Op.ne]: id } },
        })
        if (exists) return fail(res, '备件编号已存在', ErrorCode.RECORD_EXISTS)
      }

      const {
        part_code, part_name, specification, unit, applicable_devices, category,
        safety_stock_min, safety_stock_max, current_stock, warehouse, shelf, layer,
        status, remarks,
      } = req.body

      await part.update({
        part_code, part_name, specification, unit, applicable_devices, category,
        safety_stock_min, safety_stock_max, current_stock, warehouse, shelf, layer,
        status, remarks,
      })
      return success(res, part, '修改成功')
    } catch (err: any) {
      logger.error('[DeviceSparePart] update error:', err)
      return fail(res, err.message || '服务器错误', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 删除备件
   */
  async delete(req: any, res: any) {
    try {
      const { id } = req.params
      const part = await DeviceSparePart.findOne({ where: { part_id: id } })
      if (!part) return fail(res, '备件不存在', ErrorCode.RECORD_NOT_FOUND)

      const logCount = await DeviceSparePartLog.count({ where: { part_id: id } })
      if (logCount > 0) {
        return fail(res, `该备件存在出入库流水记录（${logCount}条），不允许删除`, ErrorCode.BUSINESS_ERROR)
      }

      await part.destroy()
      logger.info(`备件已删除: part_id=${id}, part_code=${(part as any).part_code}`)
      return success(res, null, '删除成功')
    } catch (err: any) {
      logger.error('[DeviceSparePart] delete error:', err)
      return fail(res, err.message || '服务器错误', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 采购入库（增加库存，记录流水）
   * 事务保护：同时更新库存与记录流水
   */
  async stockIn(req: any, res: any) {
    const t = await DeviceSparePart.sequelize.transaction()
    try {
      const { id } = req.params
      const userInfo: any = (req as any).user || {}
      const {
        quantity, unit_price, supplier, purchase_no, related_order, remarks,
      } = req.body || {}

      const qty = Number(quantity)
      if (!Number.isFinite(qty) || qty <= 0) {
        await t.rollback()
        return fail(res, '入库数量必须为正数', ErrorCode.PARAM_INVALID)
      }

      const part = await DeviceSparePart.findOne({ where: { part_id: id }, transaction: t, lock: t.LOCK && t.LOCK.UPDATE })
      if (!part) {
        await t.rollback()
        return fail(res, '备件不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const price = unit_price !== undefined && unit_price !== null && unit_price !== '' ? Number(unit_price) : null
      const totalPrice = price !== null ? Number((price * qty).toFixed(2)) : null

      const newStock = Number((part as any).current_stock || 0) + qty
      await (part as any).update({ current_stock: newStock }, { transaction: t })

      await DeviceSparePartLog.create({
        part_id: id,
        part_code: (part as any).part_code,
        part_name: (part as any).part_name,
        log_type: 'in',
        quantity: qty,
        unit_price: price,
        total_price: totalPrice,
        supplier,
        purchase_no,
        related_order,
        operator_id: userInfo.userId || null,
        operator_name: userInfo.username || '',
        remarks,
      }, { transaction: t })

      await t.commit()
      return success(res, part, '入库成功')
    } catch (err: any) {
      await t.rollback()
      logger.error('[DeviceSparePart] stockIn error:', err)
      return fail(res, err.message || '服务器错误', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 领用出库（扣减库存，记录流水，关联工单）
   * 事务保护：同时更新库存与记录流水
   */
  async stockOut(req: any, res: any) {
    const t = await DeviceSparePart.sequelize.transaction()
    try {
      const { id } = req.params
      const userInfo: any = (req as any).user || {}
      const {
        quantity, unit_price, related_order, remarks,
      } = req.body || {}

      const qty = Number(quantity)
      if (!Number.isFinite(qty) || qty <= 0) {
        await t.rollback()
        return fail(res, '出库数量必须为正数', ErrorCode.PARAM_INVALID)
      }

      const part = await DeviceSparePart.findOne({ where: { part_id: id }, transaction: t, lock: t.LOCK && t.LOCK.UPDATE })
      if (!part) {
        await t.rollback()
        return fail(res, '备件不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const currentStock = Number((part as any).current_stock || 0)
      if (qty > currentStock) {
        await t.rollback()
        return fail(res, `库存不足，当前库存 ${currentStock}，本次出库 ${qty}`, ErrorCode.BUSINESS_ERROR)
      }

      const newStock = currentStock - qty
      await (part as any).update({ current_stock: newStock }, { transaction: t })

      const price = unit_price !== undefined && unit_price !== null && unit_price !== '' ? Number(unit_price) : null
      const totalPrice = price !== null ? Number((price * qty).toFixed(2)) : null

      await DeviceSparePartLog.create({
        part_id: id,
        part_code: (part as any).part_code,
        part_name: (part as any).part_name,
        log_type: 'out',
        quantity: qty,
        unit_price: price,
        total_price: totalPrice,
        related_order,
        operator_id: userInfo.userId || null,
        operator_name: userInfo.username || '',
        remarks,
      }, { transaction: t })

      await t.commit()
      return success(res, part, '出库成功')
    } catch (err: any) {
      await t.rollback()
      logger.error('[DeviceSparePart] stockOut error:', err)
      return fail(res, err.message || '服务器错误', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 库存盘点调整（直接设置目标库存，记录差额）
   * 事务保护：同时更新库存与记录流水
   */
  async stockAdjust(req: any, res: any) {
    const t = await DeviceSparePart.sequelize.transaction()
    try {
      const { id } = req.params
      const userInfo: any = (req as any).user || {}
      const {
        actual_stock, remarks,
      } = req.body || {}

      const target = Number(actual_stock)
      if (!Number.isFinite(target) || target < 0) {
        await t.rollback()
        return fail(res, '盘点数量必须为非负数', ErrorCode.PARAM_INVALID)
      }

      const part = await DeviceSparePart.findOne({ where: { part_id: id }, transaction: t, lock: t.LOCK && t.LOCK.UPDATE })
      if (!part) {
        await t.rollback()
        return fail(res, '备件不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const currentStock = Number((part as any).current_stock || 0)
      const diff = target - currentStock

      await (part as any).update({ current_stock: target }, { transaction: t })

      // 差额为 0 也记录一条调整流水，便于盘点追溯
      await DeviceSparePartLog.create({
        part_id: id,
        part_code: (part as any).part_code,
        part_name: (part as any).part_name,
        log_type: 'adjust',
        quantity: Math.abs(diff),
        related_order: null,
        operator_id: userInfo.userId || null,
        operator_name: userInfo.username || '',
        remarks: remarks || `盘点调整：${currentStock} → ${target}（${diff >= 0 ? '盘盈' : '盘亏'} ${Math.abs(diff)}）`,
      }, { transaction: t })

      await t.commit()
      return success(res, part, '调整成功')
    } catch (err: any) {
      await t.rollback()
      logger.error('[DeviceSparePart] stockAdjust error:', err)
      return fail(res, err.message || '服务器错误', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 出入库流水查询
   * 支持按备件、类型、时间筛选
   */
  async listLogs(req: any, res: any) {
    try {
      const {
        part_id, part_code, part_name, log_type, start_date, end_date,
        page = 1, pageSize = 20,
      } = req.query

      const where: any = {}
      if (part_id) where.part_id = Number(part_id)
      if (part_code) where.part_code = { [Op.like]: `%${part_code}%` }
      if (part_name) where.part_name = { [Op.like]: `%${part_name}%` }
      if (log_type) {
        const types = String(log_type).split(',').filter((t: string) => ALLOWED_LOG_TYPES.has(t))
        if (types.length === 1) where.log_type = types[0]
        else if (types.length > 1) where.log_type = { [Op.in]: types }
      }
      if (start_date || end_date) {
        where.created_at = {}
        if (start_date) where.created_at[Op.gte] = new Date(String(start_date))
        if (end_date) where.created_at[Op.lte] = new Date(new Date(String(end_date)).getTime() + 86400000)
      }

      const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
      const offset = (Number(page) - 1) * limit

      const { rows, count } = await DeviceSparePartLog.findAndCountAll({
        where,
        limit,
        offset,
        order: [['log_id', 'DESC']],
      })

      return success(res, rows, '查询成功', count)
    } catch (err: any) {
      logger.error('[DeviceSparePartLog] listLogs error:', err)
      return fail(res, err.message || '服务器错误', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 获取低库存预警列表
   * 当前库存 < 安全库存下限
   */
  async getLowStock(req: any, res: any) {
    try {
      const { page = 1, pageSize = 50 } = req.query
      const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
      const offset = (Number(page) - 1) * limit

      const where: any = {
        current_stock: { [Op.lt]: sequelize.col('safety_stock_min') },
        status: 1,
      }

      const { rows, count } = await DeviceSparePart.findAndCountAll({
        where,
        limit,
        offset,
        order: [['current_stock', 'ASC']],
      })

      return success(res, rows, '查询成功', count)
    } catch (err: any) {
      logger.error('[DeviceSparePart] getLowStock error:', err)
      return fail(res, err.message || '服务器错误', ErrorCode.SYSTEM_ERROR)
    }
  },
}
