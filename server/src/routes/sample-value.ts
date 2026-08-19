/**
 * 检验数据统一存储改造（阶段3.1）
 * 样品测量值 SampleValueController + 路由
 *
 * 接口设计：
 * - GET    /api/quality/inspection-items/:item_id/sample-values            列出某检验项的所有样品值
 * - POST   /api/quality/inspection-items/:item_id/sample-values            批量创建/替换某检验项的样品值（前端整体提交）
 * - DELETE /api/quality/inspection-items/:item_id/sample-values/:value_id 删除单条样品值
 *
 * 创建/更新/删除后会触发 SampleJudgeService 自动判定 + 汇总 item.result
 *
 * 前端录入流程：
 * 1. 选择某 item 后，前端组件根据 item_cfg 的 need_sample_count 渲染 N 个输入框
 * 2. 用户填写完毕整体提交到 POST /sample-values
 * 3. 后端先 delete 旧值再 bulkCreate 新值（替换式），然后调用 recalcItemAndSamples 重算
 */
import { Router } from 'express'
import QcInspectionItem from '../models/QcInspectionItem.js'
import QcInspectionSampleValue from '../models/QcInspectionSampleValue.js'
import IncomingInspection from '../models/IncomingInspection.js'
import ProductInspection from '../models/ProductInspection.js'
import MicrobeInspection from '../models/MicrobeInspection.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import { logger } from '../utils/logger.js'
import { recalcItemAndSamples, recalcInspection } from '../services/SampleJudgeService.js'

const router = Router()

// 根据 qc_item.source_type 取对应主表模型
function getMainModel(sourceType: string): any {
  switch (sourceType) {
    case '来料': return IncomingInspection
    case '产品': return ProductInspection
    case '微生物': return MicrobeInspection
    default: return null
  }
}

// GET /api/quality/inspection-items/:item_id/sample-values
router.get('/:item_id/sample-values', async (req, res) => {
  try {
    const itemId = Number(req.params.item_id)
    const item = await QcInspectionItem.findByPk(itemId, { raw: true })
    if (!item) return fail(res, '检验项不存在', ErrorCode.RECORD_NOT_FOUND)

    const values = await QcInspectionSampleValue.findAll({
      where: { item_id: itemId },
      order: [['sample_no', 'ASC'], ['dimension_code', 'ASC']],
      raw: true,
    })
    success(res, { item, sample_values: values })
  } catch (err: any) {
    logger.error('[SampleValue] list error:', err)
    fail(res, err.message, ErrorCode.SYSTEM_ERROR)
  }
})

// POST /api/quality/inspection-items/:item_id/sample-values
// body: { sample_values: [{ sample_no, dimension_code, dimension_name, measure_value_num, measure_value_text, defect_desc, measured_at }] }
// 替换式：先删旧值再创建新值，整体在同一事务
router.post('/:item_id/sample-values', async (req, res) => {
  const t = await QcInspectionSampleValue.sequelize.transaction()
  try {
    const itemId = Number(req.params.item_id)
    const item = await QcInspectionItem.findByPk(itemId, { transaction: t })
    if (!item) {
      await t.rollback()
      return fail(res, '检验项不存在', ErrorCode.RECORD_NOT_FOUND)
    }

    const { sample_values = [] } = req.body
    if (!Array.isArray(sample_values)) {
      await t.rollback()
      return fail(res, 'sample_values 必须为数组', ErrorCode.PARAM_INVALID)
    }

    // 替换式：先删旧值
    await QcInspectionSampleValue.destroy({
      where: { item_id: itemId },
      transaction: t,
    })

    // 写入新值
    if (sample_values.length > 0) {
      const user: any = (req as any).user || {}
      const rows = sample_values.map((sv: any) => ({
        item_id: itemId,
        sample_no: Number(sv.sample_no) || 1,
        dimension_code: sv.dimension_code || 'VALUE',
        dimension_name: sv.dimension_name || null,
        measure_value_num: sv.measure_value_num !== undefined && sv.measure_value_num !== null && sv.measure_value_num !== ''
          ? Number(sv.measure_value_num) : null,
        measure_value_text: sv.measure_value_text || null,
        is_qualified: sv.is_qualified ?? null, // 由 recalcItemAndSamples 重算
        defect_desc: sv.defect_desc || null,
        measured_at: sv.measured_at ? new Date(sv.measured_at) : new Date(),
        inspector_id: user.userId || null,
      }))
      await QcInspectionSampleValue.bulkCreate(rows, { transaction: t, ignoreDuplicates: true })
    }

    await t.commit()

    // 事务外重算判定（不阻塞响应太多，失败仅日志）
    try {
      await recalcItemAndSamples(itemId)
      const sourceType = item.get('source_type') as string
      const inspectionId = item.get('inspection_id') as number
      const mainModel = getMainModel(sourceType)
      if (mainModel) await recalcInspection(sourceType as any, inspectionId, mainModel)
    } catch (e: any) {
      logger.warn(`[SampleValue] recalc item_id=${itemId} 失败:`, e.message)
    }

    const values = await QcInspectionSampleValue.findAll({
      where: { item_id: itemId },
      order: [['sample_no', 'ASC'], ['dimension_code', 'ASC']],
      raw: true,
    })
    success(res, { sample_values: values }, '保存成功')
  } catch (err: any) {
    try { await t.rollback() } catch (_) { /* ignore */ }
    logger.error('[SampleValue] save error:', err)
    fail(res, err.message, ErrorCode.SYSTEM_ERROR)
  }
})

// DELETE /api/quality/inspection-items/:item_id/sample-values/:value_id
router.delete('/:item_id/sample-values/:value_id', async (req, res) => {
  const t = await QcInspectionSampleValue.sequelize.transaction()
  try {
    const itemId = Number(req.params.item_id)
    const valueId = Number(req.params.value_id)
    const item = await QcInspectionItem.findByPk(itemId, { transaction: t })
    if (!item) {
      await t.rollback()
      return fail(res, '检验项不存在', ErrorCode.RECORD_NOT_FOUND)
    }

    await QcInspectionSampleValue.destroy({
      where: { value_id: valueId, item_id: itemId },
      transaction: t,
    })
    await t.commit()

    try {
      await recalcItemAndSamples(itemId)
      const sourceType = item.get('source_type') as string
      const inspectionId = item.get('inspection_id') as number
      const mainModel = getMainModel(sourceType)
      if (mainModel) await recalcInspection(sourceType as any, inspectionId, mainModel)
    } catch (e: any) {
      logger.warn(`[SampleValue] recalc item_id=${itemId} 失败:`, e.message)
    }

    success(res, null, '删除成功')
  } catch (err: any) {
    try { await t.rollback() } catch (_) { /* ignore */ }
    logger.error('[SampleValue] delete error:', err)
    fail(res, err.message, ErrorCode.SYSTEM_ERROR)
  }
})

export default router
