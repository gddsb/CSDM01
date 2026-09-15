/**
 * 生产工单业务逻辑（OrderController 下沉）
 *
 * 状态机流转（release/close/finish）委托 OrderWorkflowService，
 * 本 Service 负责 CRUD + 业务校验（数量/日期/关联数据防删）。
 */
import { Op } from 'sequelize'
import { Order, ReportOrder, Material } from '../models/index.js'
import { generateOrderNo } from '../utils/sequence.js'
import { nowBeijingDate, parseDateOnly } from '../utils/date.js'
import { OrderWorkflowService } from './ProductionWorkflowService.js'
import { AppError } from '../utils/error.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'

// 订单状态: 0=开立, 1=下发, 2=开工, 3=完工, 4=关闭
export const ORDER_STATUS_MAP: Record<string, number> = {
  '开立': 0, '下发': 1, '开工': 2, '完工': 3, '关闭': 4,
}

export const ORDER_STATUS_OPEN = 0      // 可修改/删除/下发
export const ORDER_STATUS_RELEASED = 1  // 不可修改/删除
export const ORDER_STATUS_FINISHED = 3
export const ORDER_STATUS_CLOSED = 4

// ---------- 纯函数（可单测） ----------

/** 将状态参数（字符串/数字/数组）转换为整数数组 */
export function parseOrderStatusParam(status: any): number[] | null {
  if (status === undefined || status === '') return null
  const arr = Array.isArray(status) ? status : [status]
  const nums: number[] = []
  for (const s of arr) {
    const parts = typeof s === 'string' && s.includes(',') ? s.split(',') : [s]
    for (const p of parts) {
      const n = ORDER_STATUS_MAP[p as string] !== undefined
        ? ORDER_STATUS_MAP[p as string]
        : Number(p)
      if (!Number.isNaN(n)) nums.push(n)
    }
  }
  return nums.length ? nums : null
}

/** 构建列表查询条件（纯函数） */
export function buildOrderWhere(query: any): any {
  const where: any = {}
  const { keyword, materialCode, materialName, status, planDateStart, planDateEnd } = query

  if (keyword) {
    where[Op.or] = [
      { order_no: { [Op.like]: `%${keyword}%` } },
      { material_name: { [Op.like]: `%${keyword}%` } },
    ]
  }
  if (materialCode) where.material_code = { [Op.like]: `%${materialCode}%` }
  if (materialName) where.material_name = { [Op.like]: `%${materialName}%` }

  const statusNums = parseOrderStatusParam(status)
  if (statusNums) {
    where.status = statusNums.length === 1 ? statusNums[0] : { [Op.in]: statusNums }
  }

  if (planDateStart || planDateEnd) {
    where.plan_start_time = {}
    if (planDateStart) where.plan_start_time[Op.gte] = new Date(planDateStart)
    if (planDateEnd) where.plan_start_time[Op.lte] = new Date(planDateEnd)
  }

  return where
}

/** 校验计划数量（纯函数） */
export function validatePlannedQty(planned_qty: any): void {
  const n = Number(planned_qty)
  if (!Number.isInteger(n) || n <= 0) {
    throw new AppError('计划数量只能为正整数', 10001, 400)
  }
}

/** 校验计划日期（纯函数：开始>=今天，结束>=开始） */
export function validatePlanDates(plan_start_time?: string, plan_end_time?: string): void {
  if (plan_start_time) {
    const start = parseDateOnly(plan_start_time) || new Date(plan_start_time)
    const today = nowBeijingDate()
    today.setHours(0, 0, 0, 0)
    if (start < today) {
      throw new AppError('计划开始日期不得早于今天', 10001, 400)
    }
  }
  if (plan_start_time && plan_end_time) {
    const start = parseDateOnly(plan_start_time) || new Date(plan_start_time)
    const end = parseDateOnly(plan_end_time) || new Date(plan_end_time)
    if (end < start) {
      throw new AppError('计划完成日期不得早于计划开始日期', 10001, 400)
    }
  }
}

// ---------- 业务 Service ----------

export interface OrderCreateInput {
  material_id: number | string
  planned_qty: number | string
  plan_start_time?: string
  plan_end_time?: string
}

export interface OrderUpdateInput extends Partial<OrderCreateInput> {}

export const OrderService = {
  /** 分页查询工单列表 */
  async list(query: any) {
    const where = buildOrderWhere(query)
    const limit = Math.min(Number(query.pageSize) || 20, MAX_PAGE_SIZE)
    const offset = ((Number(query.page) || 1) - 1) * limit

    return await Order.findAndCountAll({
      where,
      limit,
      offset,
      order: [['order_no', 'DESC']],
    })
  },

  /** 工单详情（含关联报工单） */
  async detail(id: number | string) {
    const order = await Order.findOne({
      where: { order_id: Number(id) },
      include: [{ model: ReportOrder, as: 'report_orders', required: false }],
    })
    if (!order) throw new AppError('订单不存在', 10002, 404)
    return order
  },

  /** 创建设备工单（自动生成订单号 + 校验规则 + 冗余料品信息） */
  async create(input: OrderCreateInput, username?: string | null) {
    if (!input.material_id) {
      throw new AppError('料品 ID 不能为空', 10001, 400)
    }
    validatePlannedQty(input.planned_qty)
    validatePlanDates(input.plan_start_time, input.plan_end_time)

    const material = await Material.findOne({ where: { material_id: input.material_id } })
    if (!material) throw new AppError('料品不存在', 10002, 404)

    const order_no = await generateOrderNo()
    return await Order.create({
      order_no,
      material_id: material.material_id,
      material_code: material.material_code,
      material_name: material.material_name,
      specification: material.specification,
      version_no: material.version_no,
      barcode: material.barcode,
      planned_qty: Number(input.planned_qty),
      plan_start_time: input.plan_start_time,
      plan_end_time: input.plan_end_time,
      status: 0,
      created_by: username || null,
    } as any)
  },

  /** 修改工单（仅开立状态可改） */
  async update(id: number | string, input: OrderUpdateInput) {
    const order = await Order.findOne({ where: { order_id: Number(id) } })
    if (!order) throw new AppError('订单不存在', 10002, 404)

    if ((order as any).getDataValue('status') !== ORDER_STATUS_OPEN) {
      throw new AppError('只有开立状态的订单可以修改', 20001, 409)
    }

    // 数量校验
    if (input.planned_qty !== undefined) validatePlannedQty(input.planned_qty)
    // 日期校验（开始>=今天，结束>=开始；结束日期也不能早于订单现有开始日期）
    const effectiveStart = input.plan_start_time || order.plan_start_time
    if (input.plan_start_time) validatePlanDates(input.plan_start_time, undefined)
    if (input.plan_end_time && effectiveStart) validatePlanDates(effectiveStart as string, input.plan_end_time)

    const updateData: any = {}
    if (input.planned_qty !== undefined) updateData.planned_qty = Number(input.planned_qty)
    if (input.plan_start_time !== undefined) updateData.plan_start_time = input.plan_start_time
    if (input.plan_end_time !== undefined) updateData.plan_end_time = input.plan_end_time

    // 更换料品 → 同步冗余字段
    if (input.material_id && input.material_id !== order.material_id) {
      const material = await Material.findOne({ where: { material_id: input.material_id } })
      if (!material) throw new AppError('料品不存在', 10002, 404)
      updateData.material_id = material.material_id
      updateData.material_code = material.material_code
      updateData.material_name = material.material_name
      updateData.specification = material.specification
      updateData.version_no = material.version_no
      updateData.barcode = material.barcode
    }

    await order.update(updateData)
    return order
  },

  /** 删除工单（仅开立状态 + 无关联报工单） */
  async remove(id: number | string) {
    const order = await Order.findOne({ where: { order_id: Number(id) } })
    if (!order) throw new AppError('订单不存在', 10002, 404)

    if ((order as any).getDataValue('status') !== ORDER_STATUS_OPEN) {
      throw new AppError('只有开立状态的订单可以删除', 20001, 409)
    }

    const roCount = await ReportOrder.count({ where: { order_id: Number(id) } })
    if (roCount > 0) {
      throw new AppError(`该订单下存在 ${roCount} 个报工单，无法删除`, 20001, 409)
    }

    await order.destroy()
    return true
  },

  // ---------- 状态流转（委托 WorkflowService，Controller 可直接调用） ----------

  async release(id: number | string, actor?: any) {
    return await OrderWorkflowService.release(id, actor)
  },
  async close(id: number | string, actor?: any) {
    return await OrderWorkflowService.close(id, actor)
  },
  async finish(id: number | string, actor?: any) {
    return await OrderWorkflowService.finish(id, actor)
  },
}

export default OrderService
