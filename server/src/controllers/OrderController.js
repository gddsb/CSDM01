import { Op } from 'sequelize'
import { Order, WorkOrder, ManpowerRecord, ExceptionRecord, Material } from '../models/index.js'
import { success, fail } from '../utils/response.js'
import { statusToNumber, statusToString, convertStatusInList, convertStatusInItem } from '../utils/statusMap.js'
import { generateOrderNo } from '../utils/sequence.js'

// 订单列表（支持 keyword/materialCode/status/planDateStart/planDateEnd 筛选）
export const list = async (req, res) => {
  try {
    const { keyword, materialCode, status, planDateStart, planDateEnd, page = 1, pageSize = 20 } = req.query
    const where = {}
    if (keyword) {
      where[Op.or] = [
        { order_no: { [Op.like]: `%${keyword}%` } },
        { material_name: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (materialCode) {
      where.material_code = { [Op.like]: `%${materialCode}%` }
    }
    if (status !== undefined && status !== '') {
      const statusMap = { '开立': 0, '下发': 1, '完工': 2 }
      where.status = statusMap[status] !== undefined ? statusMap[status] : Number(status)
    }
    if (planDateStart || planDateEnd) {
      where.plan_start_time = {}
      if (planDateStart) where.plan_start_time[Op.gte] = new Date(planDateStart)
      if (planDateEnd) where.plan_start_time[Op.lte] = new Date(planDateEnd)
    }

    const limit = Number(pageSize)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await Order.findAndCountAll({
      where,
      limit,
      offset,
      order: [['order_no', 'DESC']],
    })
    const list = convertStatusInList(rows.map(r => r.toJSON()), 'order')
    return success(res, list, '查询成功', count)
  } catch (err) {
    console.error('查询订单列表失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 订单详情（含关联工单、人员、异常记录）
export const detail = async (req, res) => {
  try {
    const { id } = req.params
    const order = await Order.findOne({
      where: { order_id: id },
      include: [
        {
          model: WorkOrder,
          as: 'work_orders',
          include: [
            { model: ManpowerRecord, as: 'manpower_records' },
            { model: ExceptionRecord, as: 'exception_records' },
          ],
        },
        { model: ExceptionRecord, as: 'exception_records' },
      ],
    })
    if (!order) return fail(res, '订单不存在', 404)
    return success(res, order, '查询成功')
  } catch (err) {
    console.error('查询订单详情失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 创建订单（自动生成订单号 MO-16+YYMMDD+3位序号）
export const create = async (req, res) => {
  try {
    const { material_id, planned_qty, plan_start_time, plan_end_time } = req.body
    if (!material_id) {
      return fail(res, '料品 ID 不能为空')
    }
    // 关联料品档案，冗余料品信息
    const material = await Material.findOne({ where: { material_id } })
    if (!material) return fail(res, '料品不存在', 404)

    const order_no = await generateOrderNo()
    const order = await Order.create({
      order_no,
      material_id: material.material_id,
      material_code: material.material_code,
      material_name: material.material_name,
      specification: material.specification,
      film_version: material.film_no,
      version_no: material.version_no,
      planned_qty: planned_qty || 0,
      plan_start_time,
      plan_end_time,
      status: 0,
      created_by: req.user?.username || null,
    })
    return success(res, order, '创建成功')
  } catch (err) {
    console.error('创建订单失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 修改订单
export const update = async (req, res) => {
  try {
    const { id } = req.params
    const order = await Order.findOne({ where: { order_id: id } })
    if (!order) return fail(res, '订单不存在', 404)
    // 已下发或已关闭的订单不允许修改关键字段
    if (order.status !== '开立') {
      return fail(res, '当前订单状态不允许修改')
    }
    const { material_id, planned_qty, plan_start_time, plan_end_time, status } = req.body
    const updateData = { planned_qty, plan_start_time, plan_end_time, status }
    // 若更换料品，同步冗余字段
    if (material_id && material_id !== order.material_id) {
      const material = await Material.findOne({ where: { material_id } })
      if (!material) return fail(res, '料品不存在', 404)
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
    return fail(res, '服务器错误', 500)
  }
}

// 删除订单
export const remove = async (req, res) => {
  try {
    const { id } = req.params
    const order = await Order.findOne({ where: { order_id: id } })
    if (!order) return fail(res, '订单不存在', 404)
    if (order.status !== '开立') {
      return fail(res, '当前订单状态不允许删除')
    }
    // 检查是否有关联工单
    const woCount = await WorkOrder.count({ where: { order_id: id } })
    if (woCount > 0) return fail(res, `该订单下存在 ${woCount} 个工单，无法删除`)
    await order.destroy()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除订单失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 下发订单
export const release = async (req, res) => {
  try {
    const { id } = req.params
    const order = await Order.findOne({ where: { order_id: id } })
    if (!order) return fail(res, '订单不存在', 404)
    if (order.status !== '开立') return fail(res, '当前订单状态不允许下发')
    await order.update({ status: 1, release_time: new Date() })
    return success(res, order, '订单已下发')
  } catch (err) {
    console.error('下发订单失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 完工订单
export const close = async (req, res) => {
  try {
    const { id } = req.params
    const order = await Order.findOne({ where: { order_id: id } })
    if (!order) return fail(res, '订单不存在', 404)
    if (order.status !== '下发') return fail(res, '当前订单状态不允许完工')
    await order.update({ status: 2, close_time: new Date() })
    return success(res, order, '订单已完工')
  } catch (err) {
    console.error('完工订单失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export default { list, detail, create, update, remove, release, close }
