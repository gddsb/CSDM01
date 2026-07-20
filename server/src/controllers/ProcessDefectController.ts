import { Op } from 'sequelize'
import { ProcessDefect, DefectType } from '../models/index.js'
import { success, fail } from '../utils/response.js'

// 列表查询（关联不良分类获取详情）
export const list = async (req, res) => {
  try {
    const { report_order_id, process_id, page = 1, pageSize = 20 } = req.query
    const where: any = {}
    if (report_order_id) where.report_order_id = Number(report_order_id)
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
      const defectType = json.defect_type
      return {
        ...json,
        defect_code: defectType?.defect_code || '',
        defect_name: defectType?.defect_name || '',
        defect_type: defectType?.defect_type || '',
        category_name: defectType?.category_name || '',
        defect_images: json.defect_images ? JSON.parse(json.defect_images) : [],
        defect_qty: json.quantity,
        defect_unit: json.unit || '',
        images: json.defect_images ? JSON.parse(json.defect_images) : [],
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
    const { report_order_id, page = 1, pageSize = 20 } = req.query
    const where: any = {}
    if (report_order_id) where.report_order_id = Number(report_order_id)

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
        where: { defect_type: '检验报废' },
        required: true,
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
        defect_qty: json.quantity,
        defect_unit: json.unit || '',
        images: json.defect_images ? JSON.parse(json.defect_images) : [],
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
    const { report_order_id, defect_type_id, quantity, unit, defect_images, defect_qty, defect_unit } = req.body

    const qty = defect_qty !== undefined ? defect_qty : quantity
    const u = defect_unit !== undefined ? defect_unit : unit

    if (!report_order_id) return fail(res, '报工单 ID 不能为空')
    if (!qty || Number(qty) <= 0) return fail(res, '数量必须大于0')

    let defectUnit = u
    if (defect_type_id) {
      const defectType = await DefectType.findOne({ where: { defect_id: defect_type_id } })
      if (defectType && !u) {
        defectUnit = defectType.defect_unit || '默认单位'
      }
    }

    const defect = await ProcessDefect.create({
      report_order_id,
      process_id: null,
      defect_type_id: defect_type_id || null,
      quantity: Number(qty),
      unit: defectUnit || '默认单位',
      defect_images: defect_images ? JSON.stringify(defect_images) : null,
    })

    return success(res, {
      ...defect.toJSON(),
      scrap_id: defect.defect_id,
      defect_qty: defect.quantity,
      defect_unit: defect.unit,
      images: defect.defect_images ? JSON.parse(defect.defect_images) : [],
    }, '创建成功')
  } catch (err) {
    console.error('创建检验报废记录失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 更新检验报废记录
export const scrapUpdate = async (req, res) => {
  try {
    const { id } = req.params
    const { defect_type_id, quantity, unit, defect_images, defect_qty, defect_unit } = req.body

    const defect = await ProcessDefect.findOne({ where: { defect_id: id } })
    if (!defect) return fail(res, '记录不存在', 404)

    const qty = defect_qty !== undefined ? defect_qty : quantity
    const u = defect_unit !== undefined ? defect_unit : unit

    const updateData: any = {}
    if (defect_type_id !== undefined) updateData.defect_type_id = defect_type_id
    if (qty !== undefined) updateData.quantity = Number(qty)
    if (u !== undefined) updateData.unit = u
    if (defect_images !== undefined) updateData.defect_images = JSON.stringify(defect_images || [])

    await defect.update(updateData)
    return success(res, {
      ...defect.toJSON(),
      scrap_id: defect.defect_id,
      defect_qty: defect.quantity,
      defect_unit: defect.unit,
      images: defect.defect_images ? JSON.parse(defect.defect_images) : [],
    }, '更新成功')
  } catch (err) {
    console.error('更新检验报废记录失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 创建不良记录
export const create = async (req, res) => {
  try {
    const {
      report_order_id,
      process_id,
      defect_type_id,
      quantity,
      unit,
      defect_images,
      defect_qty,
      defect_unit,
    } = req.body

    const qty = defect_qty !== undefined ? defect_qty : quantity
    const u = defect_unit !== undefined ? defect_unit : unit

    if (!report_order_id) return fail(res, '报工单 ID 不能为空')
    if (!process_id) return fail(res, '工序 ID 不能为空')
    if (!defect_type_id) return fail(res, '不良类型 ID 不能为空')
    if (!qty || Number(qty) <= 0) return fail(res, '数量必须大于0')

    const defectType = await DefectType.findOne({ where: { defect_id: defect_type_id } })
    if (!defectType) return fail(res, '不良类型不存在', 404)

    const defect = await ProcessDefect.create({
      report_order_id,
      process_id,
      defect_type_id,
      quantity: Number(qty),
      unit: u || defectType.defect_unit || '',
      defect_images: defect_images ? JSON.stringify(defect_images) : null,
    })

    return success(res, {
      ...defect.toJSON(),
      defect_qty: defect.quantity,
      defect_unit: defect.unit,
      images: defect.defect_images ? JSON.parse(defect.defect_images) : [],
    }, '创建成功')
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
    const { report_order_id, process_id, items } = req.body
    if (!report_order_id) return fail(res, '报工单 ID 不能为空')
    if (!process_id) return fail(res, '工序 ID 不能为空')
    if (!Array.isArray(items)) return fail(res, '不良项目数据格式错误')

    // 过滤有效项目
    const validItems = items.filter(item => item.defect_type_id && Number(item.quantity) > 0)

    // 先删除该报工单工序下的原有记录
    await ProcessDefect.destroy({
      where: { report_order_id, process_id },
    })

    // 批量创建
    const created = []
    for (const item of validItems) {
      // 获取不良分类信息以确定单位
      const defectType = await DefectType.findOne({ where: { defect_id: item.defect_type_id } })

      const defect = await ProcessDefect.create({
        report_order_id,
        process_id,
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
    const { defect_type_id, quantity, unit, defect_images, defect_qty, defect_unit } = req.body

    const defect = await ProcessDefect.findOne({ where: { defect_id: id } })
    if (!defect) return fail(res, '记录不存在', 404)

    const qty = defect_qty !== undefined ? defect_qty : quantity
    const u = defect_unit !== undefined ? defect_unit : unit

    const updateData: any = {}
    if (defect_type_id !== undefined) {
      updateData.defect_type_id = defect_type_id
      if (defect_type_id) {
        const defectType = await DefectType.findOne({ where: { defect_id: defect_type_id } })
        if (defectType && !u) {
          updateData.unit = defectType.defect_unit || defect.unit
        }
      }
    }
    if (qty !== undefined) updateData.quantity = Number(qty)
    if (u !== undefined) updateData.unit = u
    if (defect_images !== undefined) updateData.defect_images = JSON.stringify(defect_images || [])

    await defect.update(updateData)
    return success(res, {
      ...defect.toJSON(),
      defect_qty: defect.quantity,
      defect_unit: defect.unit,
      images: defect.defect_images ? JSON.parse(defect.defect_images) : [],
    }, '更新成功')
  } catch (err) {
    console.error('更新工序不良记录失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export default { list, create, remove, update, batchSave, scrapList, scrapCreate, scrapUpdate }
