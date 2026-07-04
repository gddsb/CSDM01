import { Op } from 'sequelize'
import { ManpowerRecord, WorkOrder } from '../models/index.js'
import { success, fail } from '../utils/response.js'

// 人员投入列表（支持 work_order_id 筛选）
export const list = async (req, res) => {
  try {
    const { work_order_id, record_user, page = 1, pageSize = 20 } = req.query
    const where = {}
    if (work_order_id) where.work_order_id = Number(work_order_id)
    if (record_user) where.record_user = { [Op.like]: `%${record_user}%` }

    const limit = Number(pageSize)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await ManpowerRecord.findAndCountAll({
      where,
      limit,
      offset,
      order: [['record_id', 'DESC']],
    })
    return success(res, rows, '查询成功', count)
  } catch (err) {
    console.error('查询人员投入列表失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 创建人员投入记录
export const create = async (req, res) => {
  try {
    const {
      work_order_id,
      skilled_workers,
      general_workers,
      contract_workers,
      auxiliary_workers,
      remarks,
      record_user,
      record_user_name,
    } = req.body

    if (!work_order_id) return fail(res, '工单 ID 不能为空')

    const workOrder = await WorkOrder.findOne({ where: { work_order_id } })
    if (!workOrder) return fail(res, '工单不存在', 404)

    const record = await ManpowerRecord.create({
      work_order_id: workOrder.work_order_id,
      work_order_no: workOrder.work_order_no,
      skilled_workers: skilled_workers || 0,
      general_workers: general_workers || 0,
      contract_workers: contract_workers || 0,
      auxiliary_workers: auxiliary_workers || 0,
      remarks,
      record_user,
      record_user_name,
    })

    return success(res, record, '创建成功')
  } catch (err) {
    console.error('创建人员投入记录失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export default { list, create }
