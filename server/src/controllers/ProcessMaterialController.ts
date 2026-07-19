import { Op } from 'sequelize'
import { ProcessMaterial, Material } from '../models/index.js'
import { success, fail } from '../utils/response.js'

export const list = async (req, res) => {
  try {
    const { report_order_id, process_id, material_batch, page = 1, pageSize = 20 } = req.query
    const where: any = {}
    if (report_order_id) where.report_order_id = Number(report_order_id)
    if (process_id) where.process_id = Number(process_id)
    if (material_batch) where.material_batch = { [Op.like]: `%${material_batch}%` }

    const limit = Number(pageSize)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await ProcessMaterial.findAndCountAll({
      where,
      limit,
      offset,
      order: [['record_time', 'DESC']],
      include: [{
        model: Material,
        as: 'bas_material',
        attributes: ['material_id', 'material_code', 'material_name', 'specification', 'unit_name'],
        required: false,
      }],
    })
    const data = rows.map(r => {
      const json = r.toJSON()
      return {
        ...json,
        material_code: json.bas_material?.material_code || '',
        material_name: json.bas_material?.material_name || '',
        specification: json.bas_material?.specification || '',
        label_images: json.label_images ? JSON.parse(json.label_images) : [],
      }
    })
    return success(res, data, '查询成功', count)
  } catch (err) {
    console.error('查询制程物料列表失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export const create = async (req, res) => {
  try {
    const {
      report_order_id,
      process_id,
      material_type,
      bas_material_id,
      material_batch,
      package_no,
      quantity,
      label_images,
    } = req.body

    if (!report_order_id) return fail(res, '报工单 ID 不能为空')
    if (!process_id) return fail(res, '工序 ID 不能为空')
    if (!material_type) return fail(res, '物料类型不能为空')
    if (!quantity || quantity <= 0) return fail(res, '数量必须大于0')

    const material = await ProcessMaterial.create({
      report_order_id,
      process_id,
      material_type,
      bas_material_id: bas_material_id || null,
      material_batch: material_batch || '',
      package_no: package_no || '',
      quantity: Number(quantity),
      label_images: label_images ? JSON.stringify(label_images) : null,
    })

    return success(res, material, '创建成功')
  } catch (err) {
    console.error('创建制程物料记录失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export const update = async (req, res) => {
  try {
    const { id } = req.params
    const {
      material_type,
      bas_material_id,
      material_batch,
      package_no,
      quantity,
      label_images,
    } = req.body

    const material = await ProcessMaterial.findOne({ where: { material_id: id } })
    if (!material) return fail(res, '记录不存在', 404)

    if (material_type !== undefined) material.material_type = material_type
    if (bas_material_id !== undefined) material.bas_material_id = bas_material_id
    if (material_batch !== undefined) material.material_batch = material_batch
    if (package_no !== undefined) material.package_no = package_no
    if (quantity !== undefined && Number(quantity) > 0) material.quantity = Number(quantity)
    if (label_images !== undefined) material.label_images = label_images ? JSON.stringify(label_images) : null

    await material.save()

    return success(res, material, '更新成功')
  } catch (err) {
    console.error('更新制程物料记录失败:', err)
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

export default { list, create, update, remove }
