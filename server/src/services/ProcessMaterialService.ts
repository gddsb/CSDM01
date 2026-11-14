/**
 * ProcessMaterialService — 制程物料记录 CRUD
 * 从 controllers/ProcessMaterialController.ts 抽取
 * 纯 Sequelize，零 fs 依赖
 *
 * 净投入校验：投入总额 - 退回总额 ≥ 0（按 report_order_id + process_id + bas_material_id 分组）
 *   每条记录 create/update 前后必须保证净投入不为负，防止"退回数量超过投入"。
 */
import { Op } from 'sequelize'
import { ProcessMaterial, Material } from '../models/index.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import { recalcReportStats } from '../utils/reportOrderStats.js'

/** 按 (report_order_id, process_id, bas_material_id) 算投入/退回合计，排除 excludeId */
async function calcMaterialTotals(
  reportOrderId: number,
  processId: number,
  basMaterialId: string,
  excludeId?: number,
): Promise<{ investSum: number; returnSum: number }> {
  const rows: any[] = await ProcessMaterial.findAll({
    where: {
      report_order_id: reportOrderId,
      process_id: processId,
      bas_material_id: basMaterialId,
      ...(excludeId ? { material_id: { [Op.ne]: excludeId } } : {}),
    },
    attributes: ['material_type', 'quantity'],
    raw: true,
  })
  let investSum = 0
  let returnSum = 0
  for (const r of rows) {
    const qty = Number(r.quantity) || 0
    if (r.material_type === '投入') investSum += qty
    else if (r.material_type === '退回') returnSum += qty
  }
  return { investSum, returnSum }
}

/** 新值覆盖旧值后净投入是否 ≥ 0（不通过抛 AppError） */
function assertNetInput(net: number, materialType: string, netBefore: number) {
  if (net < 0) {
    const suffix = netBefore > 0 ? `（该料品当前净投入 ${netBefore}）` : ''
    throw new AppError(
      `净投入不能为负：${materialType === '投入' ? '投入' : '退回'}后净投入 = ${net}${suffix}`,
      20001,
      409,
    )
  }
}

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
  if (!bas_material_id) throw new AppError('料品 ID 不能为空', 10001, 400)
  if (!quantity || Number(quantity) <= 0) throw new AppError('数量必须大于0', 10001, 400)

  // 净投入校验（按 report_order_id + process_id + bas_material_id 分组）
  const qty = Number(quantity)
  const { investSum, returnSum } = await calcMaterialTotals(
    Number(report_order_id), Number(process_id), String(bas_material_id),
  )
  const netBefore = investSum - returnSum
  const netAfter = investSum + (material_type === '投入' ? qty : 0) - returnSum - (material_type === '退回' ? qty : 0)
  assertNetInput(netAfter, material_type, netBefore)

  const material = await ProcessMaterial.create({
    report_order_id, process_id, material_type,
    bas_material_id: bas_material_id || null,
    material_batch: material_batch || '', package_no: package_no || '',
    quantity: qty,
    label_images: imgData ? JSON.stringify(imgData) : null,
  })
  const json = (material as any).toJSON()
  await recalcReportStats(report_order_id)
  return { ...json, images: json.label_images ? JSON.parse(json.label_images) : [] }
}

export async function update(id: number | string, body: any) {
  const material = await ProcessMaterial.findOne({ where: { material_id: id } })
  if (!material) throw new AppError('记录不存在', 10002, 404)

  // 先保存旧值用于净投入计算
  const oldType = String((material as any).material_type || '')
  const oldQty = Number((material as any).quantity || 0)
  const oldBasId = String((material as any).bas_material_id || '')
  const oldReportId = Number((material as any).report_order_id || 0)
  const oldProcessId = Number((material as any).process_id || 0)

  // 先应用更新字段（但 quantity <= 0 不更新）
  const imgData = body.images !== undefined ? body.images : body.label_images
  if (body.material_type !== undefined) material.material_type = body.material_type
  if (body.bas_material_id !== undefined) material.bas_material_id = body.bas_material_id
  if (body.material_batch !== undefined) material.material_batch = body.material_batch
  if (body.package_no !== undefined) material.package_no = body.package_no
  if (body.quantity !== undefined && Number(body.quantity) > 0) material.quantity = Number(body.quantity)
  if (imgData !== undefined) material.label_images = imgData ? JSON.stringify(imgData) : null

  // 确定更新后的新值
  const newType = String((material as any).material_type || oldType)
  const newQty = Number((material as any).quantity || oldQty)
  const newBasId = String((material as any).bas_material_id || oldBasId)

  // 净投入校验：改 bas_material_id 后，对"新料品"算净投入
  // 旧料品因为少了一条自己，净投入只会变大（安全），不用校验
  if (newBasId) {
    const materialId = Number((material as any).material_id)
    const { investSum, returnSum } = await calcMaterialTotals(
      oldReportId, oldProcessId, newBasId, materialId, // exclude self
    )
    // netBefore（新料品改之前，包括旧记录的贡献）：把 self 加回去
    const netBefore = investSum + (oldType === '投入' ? oldQty : 0) - returnSum - (oldType === '退回' ? oldQty : 0)
    // netAfter（新值）：exclude self 基础上 + 新贡献
    const netAfter = investSum + (newType === '投入' ? newQty : 0) - returnSum - (newType === '退回' ? newQty : 0)
    assertNetInput(netAfter, newType, netBefore)
  }

  await material.save()
  const json = (material as any).toJSON()
  await recalcReportStats(oldReportId)
  return { ...json, images: json.label_images ? JSON.parse(json.label_images) : [] }
}

export async function remove(id: number | string) {
  const material = await ProcessMaterial.findOne({ where: { material_id: id } })
  if (!material) throw new AppError('记录不存在', 10002, 404)
  const oldReportId = Number((material as any).report_order_id || 0)
  await material.destroy()
  await recalcReportStats(oldReportId)
}

export default { list, create, update, remove }
