import { Op } from 'sequelize'
import { Order, ReportOrder, Material } from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { generateOrderNo } from '../utils/sequence.js'
import { logger } from '../utils/logger.js'

// 订单状态: 0=开立, 1=下发, 2=开工, 3=完工, 4=关闭
const statusMap = { '开立': 0, '下发': 1, '开工': 2, '完工': 3, '关闭': 4 }

// 将状态参数（字符串/数字/数组）转换为整数数组
const parseStatusParam = (status) => {
  if (status === undefined || status === '') return null
  const arr = Array.isArray(status) ? status : [status]
  const nums: number[] = []
  arr.forEach(s => {
    if (typeof s === 'string' && s.includes(',')) {
      s.split(',').forEach(p => {
        const n = statusMap[p] !== undefined ? statusMap[p] : Number(p)
        if (!Number.isNaN(n)) nums.push(n)
      })
    } else {
      const n = statusMap[s] !== undefined ? statusMap[s] : Number(s)
      if (!Number.isNaN(n)) nums.push(n)
    }
  })
  return nums.length ? nums : null
}

// 订单列表（支持 keyword/materialCode/materialName/status/planDateStart/planDateEnd 筛选）
export const list = async (req, res) => {
  try {
    const {
      keyword,
      materialCode,
      materialName,
      status,
      planDateStart,
      planDateEnd,
      page = 1,
      pageSize = 20,
    } = req.query
    const where: any = {}
    if (keyword) {
      where[Op.or] = [
        { order_no: { [Op.like]: `%${keyword}%` } },
        { material_name: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (materialCode) {
      where.material_code = { [Op.like]: `%${materialCode}%` }
    }
    if (materialName) {
      where.material_name = { [Op.like]: `%${materialName}%` }
    }
    const statusNums = parseStatusParam(status)
    if (statusNums) {
      where.status = statusNums.length === 1 ? statusNums[0] : { [Op.in]: statusNums }
    }
    if (planDateStart || planDateEnd) {
      where.plan_start_time = {}
      if (planDateStart) where.plan_start_time[Op.gte] = new Date(planDateStart)
      if (planDateEnd) where.plan_start_time[Op.lte] = new Date(planDateEnd)
    }

    const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await Order.findAndCountAll({
      where,
      limit,
      offset,
      order: [['order_no', 'DESC']],
    })
    return success(res, rows, '查询成功', count)
  } catch (err) {
    console.error('查询订单列表失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 订单详情（含关联生产报工单）
export const detail = async (req, res) => {
  try {
    const { id } = req.params
    const order = await Order.findOne({
      where: { order_id: id },
      include: [
        {
          model: ReportOrder,
          as: 'report_orders',
          required: false,
        },
      ],
    })
    if (!order) return fail(res, '订单不存在', ErrorCode.RECORD_NOT_FOUND)
    return success(res, order, '查询成功')
  } catch (err) {
    console.error('查询订单详情失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 创建订单（自动生成订单号 MO-16+YYMMDD+3位序号）
// 业务规则：料品下拉仅显示 C 开头且状态为生效的料品
export const create = async (req, res) => {
  try {
    const { material_id, planned_qty, plan_start_time, plan_end_time } = req.body
    if (!material_id) {
      return fail(res, '料品 ID 不能为空')
    }
    // 计划数量只能为正整数
    if (planned_qty === undefined || !Number.isInteger(Number(planned_qty)) || Number(planned_qty) <= 0) {
      return fail(res, '计划数量只能为正整数')
    }
    // 计划开始日期不得早于今天
    if (plan_start_time) {
      const startDate = new Date(plan_start_time)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (startDate < today) {
        return fail(res, '计划开始日期不得早于今天')
      }
    }
    // 计划完成日期不得早于计划开始日期
    if (plan_start_time && plan_end_time) {
      if (new Date(plan_end_time) < new Date(plan_start_time)) {
        return fail(res, '计划完成日期不得早于计划开始日期')
      }
    }

    // 关联料品档案，冗余料品信息
    const material = await Material.findOne({ where: { material_id } })
    if (!material) return fail(res, '料品不存在', ErrorCode.RECORD_NOT_FOUND)

    const order_no = await generateOrderNo()
    const order = await Order.create({
      order_no,
      material_id: material.material_id,
      material_code: material.material_code,
      material_name: material.material_name,
      specification: material.specification,
      film_version: material.film_no,
      version_no: material.version_no,
      planned_qty: Number(planned_qty),
      plan_start_time,
      plan_end_time,
      status: 0,
      created_by: req.user?.username || null,
    })
    return success(res, order, '创建成功')
  } catch (err) {
    console.error('创建订单失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 修改订单（仅"开立"状态可修改数量、计划开始日期、计划完成日期）
export const update = async (req, res) => {
  try {
    const { id } = req.params
    const order = await Order.findOne({ where: { order_id: id } })
    if (!order) return fail(res, '订单不存在', ErrorCode.RECORD_NOT_FOUND)
    if (order.getDataValue('status') !== 0) {
      return fail(res, '只有开立状态的订单可以修改')
    }
    const { material_id, planned_qty, plan_start_time, plan_end_time } = req.body

    // 计划数量只能为正整数
    if (planned_qty !== undefined && (!Number.isInteger(Number(planned_qty)) || Number(planned_qty) <= 0)) {
      return fail(res, '计划数量只能为正整数')
    }
    // 计划开始日期不得早于今天
    if (plan_start_time) {
      const startDate = new Date(plan_start_time)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (startDate < today) {
        return fail(res, '计划开始日期不得早于今天')
      }
    }
    // 计划完成日期不得早于计划开始日期
    const startForCheck = plan_start_time || order.plan_start_time
    if (startForCheck && plan_end_time && new Date(plan_end_time) < new Date(startForCheck)) {
      return fail(res, '计划完成日期不得早于计划开始日期')
    }

    const updateData: any = {}
    if (planned_qty !== undefined) updateData.planned_qty = Number(planned_qty)
    if (plan_start_time !== undefined) updateData.plan_start_time = plan_start_time
    if (plan_end_time !== undefined) updateData.plan_end_time = plan_end_time
    // 若更换料品，同步冗余字段
    if (material_id && material_id !== order.material_id) {
      const material = await Material.findOne({ where: { material_id } })
      if (!material) return fail(res, '料品不存在', ErrorCode.RECORD_NOT_FOUND)
      updateData.material_id = material.material_id
      updateData.material_code = material.material_code
      updateData.material_name = material.material_name
      updateData.specification = material.specification
      updateData.film_version = material.film_no
      updateData.version_no = material.version_no
    }
    await order.update(updateData)
    return success(res, order, '修改成功')
  } catch (err) {
    console.error('修改订单失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 删除订单（仅"开立"状态可删除）
export const remove = async (req, res) => {
  try {
    const { id } = req.params
    const order = await Order.findOne({ where: { order_id: id } })
    if (!order) return fail(res, '订单不存在', ErrorCode.RECORD_NOT_FOUND)
    if (order.getDataValue('status') !== 0) {
      return fail(res, '只有开立状态的订单可以删除')
    }
    // 检查是否有关联报工单
    const roCount = await ReportOrder.count({ where: { order_id: id } })
    if (roCount > 0) return fail(res, `该订单下存在 ${roCount} 个报工单，无法删除`)
    await order.destroy()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除订单失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 下发订单（开立 → 下发）
export const release = async (req, res) => {
  try {
    const { id } = req.params
    const order = await Order.findOne({ where: { order_id: id } })
    if (!order) return fail(res, '订单不存在', ErrorCode.RECORD_NOT_FOUND)

    const statusVal = order.getDataValue('status')
    const releaseTime = order.getDataValue('release_time')

    if (statusVal >= 1 && releaseTime) {
      logger.warn('[Order.release] 幂等命中：订单已下发', { order_id: id, order_no: order.getDataValue('order_no') })
      return success(res, order, '订单已下发')
    }

    if (statusVal !== 0) return fail(res, '只有开立状态的订单可以下发', ErrorCode.BUSINESS_ERROR)
    await order.update({ status: 1, release_time: new Date() })
    logger.info('[Order.release] 订单下发成功', { order_id: id, order_no: order.getDataValue('order_no'), user: (req as any).user?.username })
    return success(res, order, '订单已下发')
  } catch (err) {
    console.error('下发订单失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 关闭订单（强制归档，不可逆；"下发""完工"状态可关闭）
// 业务规则：订单"开工""完工"由报工单自动联动，"关闭"为最终归档状态
export const close = async (req, res) => {
  try {
    const { id } = req.params
    const order = await Order.findOne({ where: { order_id: id } })
    if (!order) return fail(res, '订单不存在', ErrorCode.RECORD_NOT_FOUND)
    const statusVal = order.getDataValue('status')
    if (statusVal === 0) return fail(res, '开立状态的订单请直接下发或删除，不能关闭')
    if (statusVal === 2) return fail(res, '开工状态的订单不能关闭，请先完工')
    if (statusVal === 4) return fail(res, '订单已关闭')
    await order.update({ status: 4, close_time: new Date() })
    logger.info('[Order.close] 订单关闭成功', { order_id: id, order_no: order.getDataValue('order_no'), user: (req as any).user?.username })
    return success(res, order, '订单已关闭')
  } catch (err) {
    console.error('关闭订单失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 完工订单（开工 → 完工）
export const finish = async (req, res) => {
  try {
    const { id } = req.params
    const order = await Order.findOne({ where: { order_id: id } })
    if (!order) return fail(res, '订单不存在', ErrorCode.RECORD_NOT_FOUND)
    const statusVal = order.getDataValue('status')
    if (statusVal === 3) return success(res, order, '订单已完工')
    if (statusVal !== 2) return fail(res, '只有开工状态的订单可以完工', ErrorCode.BUSINESS_ERROR)
    await order.update({ status: 3, close_time: new Date() })
    logger.info('[Order.finish] 订单完工成功', { order_id: id, order_no: order.getDataValue('order_no'), user: (req as any).user?.username })
    return success(res, order, '订单已完工')
  } catch (err) {
    console.error('完工订单失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export default { list, detail, create, update, remove, release, close, finish }
