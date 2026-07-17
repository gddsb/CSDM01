import { Op } from 'sequelize'
import { ProcessDefect, DefectType } from '../models/index.js'
import { success, fail } from '../utils/response.js'

// 列表查询（关联不良分类获取详情）
export const list = async (req, res) => {
  try {
    const { report_id, work_order_id, process_id, page = 1, pageSize = 20 } = req.query
    const where = {}
    if (report_id) where.report_id = Number(report_id)
    if (work_order_id) where.work_order_id = Number(work_order_id)
    if (process_id) where.process_id = Number(process_id)

    const limit = Number(pageSize)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await ProcessDefect.findAndCountAll({
      where,
      limit,
      offset,
      order: [['record_time', 'DESC']],
      include: [{
        model: DefectType,
        as: 'defect_type',
        attributes: ['defect_id', 'defect_code', 'defect_name', 'defect_type', 'category_name', 'defect_unit'],
        required: false,
      }],
    })
    const data = rows.map(r => {
      const json = r.toJSON()
      // 从关联的不良分类中获取详情
      const defectType = json.defect_type
      return {
        ...json,
        defect_code: defectType?.defect_code || '',
        defect_name: defectType?.defect_name || '',
        defect_type: defectType?.defect_type || '',
        category_name: defectType?.category_name || '',
        defect_images: json.defect_images ? JSON.parse(json.defect_images) : [],
      }
    })
    return success(res, data, '查询成功', count)
  } catch (err) {
    console.error('查询工序不良列表失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 检验报废列表
export const scrapList = async (req, res) => {
  try {
    const { report_id, work_order_id, page = 1, pageSize = 20 } = req.query
    const where = {}
    if (report_id) where.report_id = Number(report_id)
    if (work_order_id) where.work_order_id = Number(work_order_id)

    const limit = Number(pageSize)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await ProcessDefect.findAndCountAll({
      where,
      limit,
      offset,
      order: [['record_time', 'DESC']],
      include: [{
        model: DefectType,
        as: 'defect_type',
        attributes: ['defect_id', 'defect_code', 'defect_name', 'defect_type', 'category_name', 'defect_unit'],
        required: false,
      }],
    })
    const data = rows.map(r => {
      const json = r.toJSON()
      const defectType = json.defect_type
      return {
        ...json,
        scrap_id: json.defect_id,
        defect_code: defectType?.defect_code || '',
        defect_name: defectType?.defect_name || '',
        defect_type: defectType?.defect_type || '',
        category_name: defectType?.category_name || '',
        defect_images: json.defect_images ? JSON.parse(json.defect_images) : [],
      }
    })
    return success(res, data, '查询成功', count)
  } catch (err) {
    console.error('查询检验报废列表失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 创建检验报废记录
export const scrapCreate = async (req, res) => {
  try {
    const { report_id, work_order_id, defect_type_id, quantity, unit, defect_images } = req.body

    if (!work_order_id) return fail(res, '工单 ID 不能为空')
    if (!quantity || quantity <= 0) return fail(res, '数量必须大于0')

    // 获取不良分类信息以确定单位
    let defectUnit = unit
    if (defect_type_id) {
      const defectType = await DefectType.findOne({ where: { defect_id: defect_type_id } })
      if (defectType && !unit) {
        defectUnit = defectType.defect_unit || '默认单位'
      }
    }

    const defect = await ProcessDefect.create({
      report_id: report_id || null,
      work_order_id,
      process_id: null, // 报废记录可能没有工序
      defect_type_id: defect_type_id || null,
      quantity: Number(quantity),
      unit: defectUnit || '默认单位',
      defect_images: defect_images ? JSON.stringify(defect_images) : null,
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
    const { defect_type_id, quantity, unit, defect_images } = req.body

    const defect = await ProcessDefect.findOne({ where: { defect_id: id } })
    if (!defect) return fail(res, '记录不存在', 404)

    const updateData = {}
    if (defect_type_id !== undefined) updateData.defect_type_id = defect_type_id
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

// 创建不良记录
export const create = async (req, res) => {
  try {
    const {
      report_id,
      work_order_id,
      process_id,
      defect_type_id,
      quantity,
      unit,
      defect_images,
    } = req.body

    if (!work_order_id) return fail(res, '工单 ID 不能为空')
    if (!process_id) return fail(res, '工序 ID 不能为空')
    if (!defect_type_id) return fail(res, '不良类型 ID 不能为空')
    if (!quantity || quantity <= 0) return fail(res, '数量必须大于0')

    // 获取不良分类信息以确定单位
    const defectType = await DefectType.findOne({ where: { defect_id: defect_type_id } })
    if (!defectType) return fail(res, '不良类型不存在', 404)

    const defect = await ProcessDefect.create({
      report_id: report_id || null,
      work_order_id,
      process_id,
      defect_type_id,
      quantity: Number(quantity),
      unit: unit || defectType.defect_unit || '',
      defect_images: defect_images ? JSON.stringify(defect_images) : null,
    })

    return success(res, defect, '创建成功')
  } catch (err) {
    console.error('创建工序不良记录失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 删除不良记录
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

// 批量保存不良记录
export const batchSave = async (req, res) => {
  try {
    const { work_order_id, process_id, items } = req.body
    if (!work_order_id) return fail(res, '工单 ID 不能为空')
    if (!process_id) return fail(res, '工序 ID 不能为空')
    if (!Array.isArray(items)) return fail(res, '不良项目数据格式错误')

    // 过滤有效项目
    const validItems = items.filter(item => item.defect_type_id && Number(item.quantity) > 0)

    // 先删除该工单工序下的原有记录
    await ProcessDefect.destroy({
      where: { work_order_id, process_id },
    })

    // 批量创建
    const created = []
    for (const item of validItems) {
      // 获取不良分类信息以确定单位
      const defectType = await DefectType.findOne({ where: { defect_id: item.defect_type_id } })
      
      const defect = await ProcessDefect.create({
        work_order_id,
        process_id,
        report_id: item.report_id || null,
        defect_type_id: item.defect_type_id,
        quantity: Number(item.quantity),
        unit: item.unit || (defectType?.defect_unit || ''),
        defect_images: item.defect_images ? JSON.stringify(item.defect_images) : null,
      })
      created.push(defect)
    }

    return success(res, { count: created.length, items: created }, '批量保存成功')
  } catch (err) {
    console.error('批量保存工序不良记录失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 更新不良记录
export const update = async (req, res) => {
  try {
    const { id } = req.params
    const { defect_type_id, quantity, unit, defect_images } = req.body

    const defect = await ProcessDefect.findOne({ where: { defect_id: id } })
    if (!defect) return fail(res, '记录不存在', 404)

    const updateData = {}
    if (defect_type_id !== undefined) {
      updateData.defect_type_id = defect_type_id
      // 如果更新了不良类型，也更新单位
      if (defect_type_id) {
        const defectType = await DefectType.findOne({ where: { defect_id: defect_type_id } })
        if (defectType && !unit) {
          updateData.unit = defectType.defect_unit || defect.unit
        }
      }
    }
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