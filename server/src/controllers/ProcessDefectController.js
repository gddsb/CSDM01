import { Op } from 'sequelize'
import { ProcessDefect, WorkOrder, Process, DefectType } from '../models/index.js'
import { success, fail } from '../utils/response.js'

export const list = async (req, res) => {
  try {
    const { work_order_id, process_id, defect_category, defect_name, page = 1, pageSize = 20 } = req.query
    const where = {}
    if (work_order_id) where.work_order_id = Number(work_order_id)
    if (process_id) where.process_id = Number(process_id)
    if (defect_category) where.defect_category = defect_category
    if (defect_name) where.defect_name = { [Op.like]: `%${defect_name}%` }

    const limit = Number(pageSize)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await ProcessDefect.findAndCountAll({
      where,
      limit,
      offset,
      order: [['record_time', 'DESC']],
    })
    return success(res, rows, '查询成功', count)
  } catch (err) {
    console.error('查询工序不良列表失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export const create = async (req, res) => {
  try {
    const {
      work_order_id,
      process_id,
      defect_category,
      defect_name,
      defect_type_id,
      quantity,
      unit,
      record_user,
      record_user_name,
    } = req.body

    if (!work_order_id) return fail(res, '工单 ID 不能为空')
    if (!process_id) return fail(res, '工序 ID 不能为空')
    if (!defect_name) return fail(res, '不良名称不能为空')
    if (!quantity || quantity <= 0) return fail(res, '数量必须大于0')

    const workOrder = await WorkOrder.findOne({ where: { work_order_id } })
    if (!workOrder) return fail(res, '工单不存在', 404)

    const process = await Process.findOne({ where: { process_id } })
    if (!process) return fail(res, '工序不存在', 404)

    let defectType = null
    if (defect_type_id) {
      defectType = await DefectType.findOne({ where: { defect_id: defect_type_id } })
    }

    const defect = await ProcessDefect.create({
      work_order_id: workOrder.work_order_id,
      work_order_no: workOrder.work_order_no,
      process_id: process.process_id,
      process_code: process.process_code,
      process_name: process.process_name,
      defect_category: defect_category || (defectType?.category_name || ''),
      defect_name,
      defect_type_id: defect_type_id || null,
      quantity: Number(quantity),
      unit: unit || (defectType?.defect_unit || ''),
      record_user,
      record_user_name,
    })

    return success(res, defect, '创建成功')
  } catch (err) {
    console.error('创建工序不良记录失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export const remove = async (req, res) => {
  try {
    const { id } = req.params
    const defect = await ProcessDefect.findOne({ where: { defect_id: id } })
    if (!defect) return fail(res, '记录不存在', 404)
    await defect.destroy()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除工序不良记录失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export default { list, create, remove }