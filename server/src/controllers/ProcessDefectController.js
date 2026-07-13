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
    const data = rows.map(r => ({
      ...r.toJSON(),
      defect_images: r.defect_images ? JSON.parse(r.defect_images) : [],
    }))
    return success(res, data, '查询成功', count)
  } catch (err) {
    console.error('查询工序不良列表失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 检验报废列表（过滤 defect_category='检验报废'）
export const scrapList = async (req, res) => {
  try {
    const { work_order_id, page = 1, pageSize = 20 } = req.query
    const where = { defect_category: '检验报废' }
    if (work_order_id) where.work_order_id = Number(work_order_id)

    const limit = Number(pageSize)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await ProcessDefect.findAndCountAll({
      where,
      limit,
      offset,
      order: [['record_time', 'DESC']],
    })
    const data = rows.map(r => ({
      ...r.toJSON(),
      scrap_id: r.defect_id,
      defect_images: r.defect_images ? JSON.parse(r.defect_images) : [],
    }))
    return success(res, data, '查询成功', count)
  } catch (err) {
    console.error('查询检验报废列表失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 创建检验报废记录
export const scrapCreate = async (req, res) => {
  try {
    const { work_order_id, defect_type_id, quantity, unit, defect_images } = req.body

    if (!work_order_id) return fail(res, '工单 ID 不能为空')
    if (!quantity || quantity <= 0) return fail(res, '数量必须大于0')

    const workOrder = await WorkOrder.findOne({ where: { work_order_id } })
    if (!workOrder) return fail(res, '工单不存在', 404)

    let defectType = null
    let defect_code = ''
    let defect_name = ''
    if (defect_type_id) {
      defectType = await DefectType.findOne({ where: { defect_id: defect_type_id } })
      if (defectType) {
        defect_code = defectType.defect_code
        defect_name = defectType.defect_name
      }
    }

    const defect = await ProcessDefect.create({
      work_order_id: workOrder.work_order_id,
      work_order_no: workOrder.work_order_no,
      defect_category: '检验报废',
      defect_name: defect_name || '检验报废',
      defect_type_id: defect_type_id || null,
      quantity: Number(quantity),
      unit: unit || (defectType?.defect_unit || '默认单位'),
      defect_images: defect_images ? JSON.stringify(defect_images) : null,
      record_user: req.user?.username || '',
      record_user_name: req.user?.real_name || '',
    })

    return success(res, { ...defect.toJSON(), scrap_id: defect.defect_id }, '创建成功')
  } catch (err) {
    console.error('创建检验报废记录失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 更新检验报废记录
export const scrapUpdate = async (req, res) => {
  try {
    const { id } = req.params
    const { quantity, unit, defect_images } = req.body

    const defect = await ProcessDefect.findOne({ where: { defect_id: id, defect_category: '检验报废' } })
    if (!defect) return fail(res, '记录不存在', 404)

    const updateData = {}
    if (quantity !== undefined) updateData.quantity = Number(quantity)
    if (unit !== undefined) updateData.unit = unit
    if (defect_images !== undefined) updateData.defect_images = JSON.stringify(defect_images || [])

    await defect.update(updateData)
    return success(res, { ...defect.toJSON(), scrap_id: defect.defect_id }, '更新成功')
  } catch (err) {
    console.error('更新检验报废记录失败:', err)
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

export const batchSave = async (req, res) => {
  try {
    const { work_order_id, process_id, items } = req.body
    if (!work_order_id) return fail(res, '工单 ID 不能为空')
    if (!process_id) return fail(res, '工序 ID 不能为空')
    if (!Array.isArray(items)) return fail(res, '不良项目数据格式错误')

    const workOrder = await WorkOrder.findOne({ where: { work_order_id } })
    if (!workOrder) return fail(res, '工单不存在', 404)

    const process = await Process.findOne({ where: { process_id } })
    if (!process) return fail(res, '工序不存在', 404)

    const validItems = items.filter(item => item.defect_name && Number(item.quantity) > 0)

    await ProcessDefect.destroy({
      where: {
        work_order_id,
        process_id,
      },
    })

    const created = []
    for (const item of validItems) {
      let defectType = null
      if (item.defect_type_id) {
        defectType = await DefectType.findOne({ where: { defect_id: item.defect_type_id } })
      }
      const defect = await ProcessDefect.create({
        work_order_id: workOrder.work_order_id,
        work_order_no: workOrder.work_order_no,
        process_id: process.process_id,
        process_code: process.process_code,
        process_name: process.process_name,
        defect_category: item.defect_category || (defectType?.category_name || ''),
        defect_name: item.defect_name,
        defect_type_id: item.defect_type_id || (defectType?.defect_id || null),
        quantity: Number(item.quantity),
        unit: item.unit || (defectType?.defect_unit || ''),
        defect_images: item.defect_images ? JSON.stringify(item.defect_images) : null,
        record_user: req.user?.username || '',
        record_user_name: req.user?.real_name || '',
      })
      created.push(defect)
    }

    return success(res, { count: created.length, items: created }, '批量保存成功')
  } catch (err) {
    console.error('批量保存工序不良记录失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export const update = async (req, res) => {
  try {
    const { id } = req.params
    const { defect_name, defect_type_id, quantity, unit, defect_images } = req.body

    const defect = await ProcessDefect.findOne({ where: { defect_id: id } })
    if (!defect) return fail(res, '记录不存在', 404)

    const updateData = {}
    if (defect_name !== undefined) updateData.defect_name = defect_name
    if (defect_type_id !== undefined) updateData.defect_type_id = defect_type_id
    if (quantity !== undefined) updateData.quantity = Number(quantity)
    if (unit !== undefined) updateData.unit = unit
    if (defect_images !== undefined) updateData.defect_images = JSON.stringify(defect_images || [])

    await defect.update(updateData)
    return success(res, defect, '更新成功')
  } catch (err) {
    console.error('更新工序不良记录失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export default { list, create, remove, update, batchSave, scrapList, scrapCreate, scrapUpdate }