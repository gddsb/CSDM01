/**
 * ProcessMaterialService — 制程物料记录 CRUD
 * 从 controllers/ProcessMaterialController.ts 抽取
 * 纯 Sequelize，零 fs 依赖
 */
import { Op } from 'sequelize'
import { ProcessMaterial, Material } from '../models/index.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'
import { AppError } from '../utils/error.js'

export async function list(query: any) {
  const { report_order_id, process_id, material_batch, page = 1, pageSize = 20 } = query
  const where: any = {}
  if (report_order_id) where.report_order_id = Number(report_order_id)
  if (process_id) where.process_id = Number(process_id)
  if (material_batch) where.material_batch = { [Op.like]: `%${material_batch}%` }

  const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
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
    const json = (r as any).toJSON()
    return {
      ...json,
      material_code: json.bas_material?.material_code || '',
      material_name: json.bas_material?.material_name || '',
      specification: json.bas_material?.specification || '',
      label_images: json.label_images ? JSON.parse(json.label_images) : [],
      images: json.label_images ? JSON.parse(json.label_images) : [],
    }
  })
  return { rows: data, count }
}

export async function create(body: any) {
  const {
    report_order_id, process_id, material_type, bas_material_id,
    material_batch, package_no, quantity, label_images, images,
  } = body
  const imgData = images !== undefined ? images : label_images

  if (!report_order_id) throw new AppError('报工单 ID 不能为空', 10001, 400)
  if (!process_id) throw new AppError('工序 ID 不能为空', 10001, 400)
  if (!material_type) throw new AppError('物料类型不能为空', 10001, 400)
  if (!quantity || Number(quantity) <= 0) throw new AppError('数量必须大于0', 10001, 400)

  const material = await ProcessMaterial.create({
    report_order_id, process_id, material_type,
    bas_material_id: bas_material_id || null,
    material_batch: material_batch || '', package_no: package_no || '',
    quantity: Number(quantity),
    label_images: imgData ? JSON.stringify(imgData) : null,
  })
  const json = (material as any).toJSON()
  return { ...json, images: json.label_images ? JSON.parse(json.label_images) : [] }
}

export async function update(id: number | string, body: any) {
  const material = await ProcessMaterial.findOne({ where: { material_id: id } })
  if (!material) throw new AppError('记录不存在', 10002, 404)
  const imgData = body.images !== undefined ? body.images : body.label_images
  if (body.material_type !== undefined) material.material_type = body.material_type
  if (body.bas_material_id !== undefined) material.bas_material_id = body.bas_material_id
  if (body.material_batch !== undefined) material.material_batch = body.material_batch
  if (body.package_no !== undefined) material.package_no = body.package_no
  if (body.quantity !== undefined && Number(body.quantity) > 0) material.quantity = Number(body.quantity)
  if (imgData !== undefined) material.label_images = imgData ? JSON.stringify(imgData) : null
  await material.save()
  const json = (material as any).toJSON()
  return { ...json, images: json.label_images ? JSON.parse(json.label_images) : [] }
}

export async function remove(id: number | string) {
  const material = await ProcessMaterial.findOne({ where: { material_id: id } })
  if (!material) throw new AppError('记录不存在', 10002, 404)
  await material.destroy()
}

export default { list, create, update, remove }
