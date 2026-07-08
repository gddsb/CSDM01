import { Op } from 'sequelize'
import { ProcessMaterial, WorkOrder, Process } from '../models/index.js'
import { success, fail } from '../utils/response.js'

export const list = async (req, res) => {
  try {
    const { work_order_id, process_id, material_batch, page = 1, pageSize = 20 } = req.query
    const where = {}
    if (work_order_id) where.work_order_id = Number(work_order_id)
    if (process_id) where.process_id = Number(process_id)
    if (material_batch) where.material_batch = { [Op.like]: `%${material_batch}%` }

    const limit = Number(pageSize)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await ProcessMaterial.findAndCountAll({
      where,
      limit,
      offset,
      order: [['record_time', 'DESC']],
    })
    return success(res, rows, '查询成功', count)
  } catch (err) {
    console.error('查询制程物料列表失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export const create = async (req, res) => {
  try {
    const {
      work_order_id,
      process_id,
      material_type,
      material_batch,
      quantity,
      record_user,
      record_user_name,
    } = req.body

    if (!work_order_id) return fail(res, '工单 ID 不能为空')
    if (!process_id) return fail(res, '工序 ID 不能为空')
    if (!material_type) return fail(res, '物料类型不能为空')
    if (!quantity || quantity <= 0) return fail(res, '数量必须大于0')

    const workOrder = await WorkOrder.findOne({ where: { work_order_id } })
    if (!workOrder) return fail(res, '工单不存在', 404)

    const process = await Process.findOne({ where: { process_id } })
    if (!process) return fail(res, '工序不存在', 404)

    const material = await ProcessMaterial.create({
      work_order_id: workOrder.work_order_id,
      work_order_no: workOrder.work_order_no,
      process_id: process.process_id,
      process_code: process.process_code,
      process_name: process.process_name,
      material_type,
      material_batch: material_batch || '',
      quantity: Number(quantity),
      record_user,
      record_user_name,
    })

    return success(res, material, '创建成功')
  } catch (err) {
    console.error('创建制程物料记录失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export const remove = async (req, res) => {
  try {
    const { id } = req.params
    const material = await ProcessMaterial.findOne({ where: { material_id: id } })
    if (!material) return fail(res, '记录不存在', 404)
    await material.destroy()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除制程物料记录失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export default { list, create, remove }