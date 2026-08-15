import { Op } from 'sequelize'
import {
  IncomingInspection,
  IncomingInspectionItem,
  Material,
  InspectionStandardItem,
  U9PurchaseReceipt,
  Supplier,
} from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { generateIncomingNo } from '../utils/sequence.js'
import { logger } from '../utils/logger.js'
import { nowBeijingDate, parseDateOnly, parseDateTime } from '../utils/date.js'
import { exportPurchaseReceipts } from '../services/u9Exporter.js'

const STATUS_REVERSE: Record<string, number> = { '待检': 0, '检验中': 1, '审核中': 2, '已完成': 3, '已关闭': 4 }

const parseStatusParam = (status: any): number[] | null => {
  if (status === undefined || status === '' || status === null) return null
  const arr = Array.isArray(status) ? status : [status]
  const nums: number[] = []
  arr.forEach((s: any) => {
    if (typeof s === 'string' && s.includes(',')) {
      s.split(',').forEach((p: string) => {
        const n = STATUS_REVERSE[p] !== undefined ? STATUS_REVERSE[p] : Number(p)
        if (!Number.isNaN(n)) nums.push(n)
      })
    } else {
      const n = STATUS_REVERSE[s] !== undefined ? STATUS_REVERSE[s] : Number(s)
      if (!Number.isNaN(n)) nums.push(n)
    }
  })
  return nums.length ? nums : null
}

async function getDetail(id: number) {
  return IncomingInspection.findOne({
    where: { inspection_id: id },
    include: [
      {
        model: IncomingInspectionItem,
        as: 'items',
        order: [['sort_order', 'ASC'], ['item_id', 'ASC']],
      },
    ],
  })
}

const convertItemResult = (v: any) => {
  if (v === undefined || v === null) return null
  if (typeof v === 'string') return v === '合格' ? 1 : 0
  return v
}

export default {
  async list(req: any, res: any) {
    try {
      const {
        page = 1,
        page_size = 20,
        inspection_no,
        supplier_name,
        material_code,
        material_name,
        result,
        status,
        start_date,
        end_date,
      } = req.query

      const where: any = {}
      if (inspection_no) where.inspection_no = { [Op.like]: `%${inspection_no}%` }
      if (supplier_name) where.supplier_name = { [Op.like]: `%${supplier_name}%` }
      if (material_code) where.material_code = { [Op.like]: `%${material_code}%` }
      if (material_name) where.material_name = { [Op.like]: `%${material_name}%` }
      if (result) where.result = result

      const statusArr = parseStatusParam(status)
      if (statusArr) where.status = { [Op.in]: statusArr }

      if (start_date || end_date) {
        where.created_at = {}
        if (start_date) where.created_at[Op.gte] = new Date(String(start_date))
        if (end_date) where.created_at[Op.lte] = new Date(new Date(String(end_date)).getTime() + 86400000)
      }

      const pageNum = Math.max(1, Number(page) || 1)
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(page_size) || 20))

      const { count, rows } = await IncomingInspection.findAndCountAll({
        where,
        // 按到货日期倒序（NULL 排在最后），同日期按 ID 倒序保证分页稳定
        order: [['arrival_date', 'DESC'], ['inspection_id', 'DESC']],
        limit: pageSize,
        offset: (pageNum - 1) * pageSize,
      })

      const supplierIds = rows.map((r: any) => r.supplier_id).filter((id: any) => id != null)
      const supplierMap: Record<number, string> = {}
      if (supplierIds.length > 0) {
        const suppliers = await Supplier.findAll({ where: { supplier_id: supplierIds }, attributes: ['supplier_id', 'short_name'], raw: true })
        suppliers.forEach((s: any) => { if (s.short_name) supplierMap[s.supplier_id] = s.short_name })
      }
      const list = rows.map((r: any) => {
        const obj = r.toJSON ? r.toJSON() : r
        if (supplierMap[obj.supplier_id]) obj.supplier_short_name = supplierMap[obj.supplier_id]
        return obj
      })

      const allRows = await IncomingInspection.findAll({ where, attributes: ['result', 'status'], raw: true })
      const stats = {
        total: count,
        pending: allRows.filter(r => { const s = typeof r.status === 'string' ? STATUS_REVERSE[r.status] : r.status; return s === 0 }).length,
        inspecting: allRows.filter(r => { const s = typeof r.status === 'string' ? STATUS_REVERSE[r.status] : r.status; return s === 1 }).length,
        reviewing: allRows.filter(r => { const s = typeof r.status === 'string' ? STATUS_REVERSE[r.status] : r.status; return s === 2 }).length,
        pass: allRows.filter(r => r.result === '合格').length,
        fail: allRows.filter(r => r.result === '不合格').length,
      }

      success(res, { list, total: count, page: pageNum, page_size: pageSize, stats })
    } catch (err: any) {
      logger.error('[IncomingInspection] list error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async detail(req: any, res: any) {
    try {
      const { id } = req.params
      const record = await getDetail(Number(id))
      if (!record) {
        return fail(res, '记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }
      const result: any = record.toJSON ? record.toJSON() : record
      if ((!result.items || result.items.length === 0) && result.standard_id) {
        const standardItems = await InspectionStandardItem.findAll({
          where: { standard_id: result.standard_id },
          order: [['sort_order', 'ASC'], ['item_id', 'ASC']],
        })
        result.items = standardItems.map((si: any, idx: number) => ({
          item_id: null,
          inspection_id: result.inspection_id,
          item_name: si.item_name,
          standard_value: si.standard_value || '',
          actual_value: '',
          result: null,
          inspector_id: null,
          inspector_name: '',
          inspection_time: null,
          sort_order: si.sort_order !== undefined ? si.sort_order : idx,
          remarks: '',
          category: si.category,
          unit: si.unit,
        }))
      }
      success(res, result)
    } catch (err: any) {
      logger.error('[IncomingInspection] detail error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async create(req: any, res: any) {
    const t = await IncomingInspection.sequelize.transaction()
    try {
      const {
        supplier_id,
        supplier_name,
        supplier_code,
        material_id,
        supplier_batch_no,
        internal_batch_no,
        quantity,
        arrival_date,
        standard_id,
        standard_name,
        handle_type,
        handle_reason,
        trigger_type,
        remarks,
        items = [],
      } = req.body

      if (!supplier_id) return fail(res, '供应商不能为空', ErrorCode.PARAM_INVALID)
      if (!material_id) return fail(res, '料品不能为空', ErrorCode.PARAM_INVALID)

      const material = await Material.findOne({ where: { material_id: material_id } })
      if (!material) return fail(res, '料品不存在', ErrorCode.PARAM_INVALID)

      const inspection_no = await generateIncomingNo()

      const record = await IncomingInspection.create({
        inspection_no,
        supplier_id,
        supplier_name: supplier_name || '',
        supplier_code: supplier_code || '',
        material_id,
        material_code: material.material_code || '',
        material_name: material.material_name || '',
        specification: material.specification || '',
        supplier_batch_no: supplier_batch_no || '',
        internal_batch_no: internal_batch_no || '',
        quantity: quantity || 0,
        arrival_date: arrival_date ? new Date(arrival_date) : null,
        standard_id: standard_id || null,
        standard_name: standard_name || '',
        handle_type: handle_type || '',
        handle_reason: handle_reason || '',
        trigger_type: trigger_type || '手工',
        status: 0,
        remarks,
      }, { transaction: t })

      if (items && items.length > 0) {
        const itemData = items.map((item: any, idx: number) => ({
          inspection_id: record.inspection_id,
          item_name: item.item_name,
          category: item.category || '',
          standard_value: item.standard_value || '',
          actual_value: item.actual_value || '',
          result: convertItemResult(item.result),
          inspector_id: item.inspector_id || null,
          inspector_name: item.inspector_name || '',
          inspection_time: item.inspection_time ? new Date(item.inspection_time) : null,
          sort_order: item.sort_order !== undefined ? item.sort_order : idx,
          unit: item.unit || '',
          remarks: item.remarks || '',
        }))
        await IncomingInspectionItem.bulkCreate(itemData, { transaction: t })
      }

      await t.commit()

      const detail = await getDetail(record.inspection_id)
      success(res, detail, '创建成功')
    } catch (err: any) {
      if (t && !(t as any).finished) {
        try { await t.rollback() } catch (_) { /* ignore */ }
      }
      logger.error('[IncomingInspection] create error:', err)
      fail(res, err.message || '创建失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async update(req: any, res: any) {
    const t = await IncomingInspection.sequelize.transaction()
    try {
      const { id } = req.params
      const {
        supplier_id,
        supplier_name,
        supplier_code,
        material_id,
        supplier_batch_no,
        internal_batch_no,
        quantity,
        arrival_date,
        standard_id,
        standard_name,
        handle_type,
        handle_reason,
        trigger_type,
        remarks,
        result,
        items,
      } = req.body

      const record = await IncomingInspection.findOne({ where: { inspection_id: id } })
      if (!record) {
        return fail(res, '记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const statusVal = typeof record.status === 'string' ? STATUS_REVERSE[record.status] : record.status
      if (statusVal >= 2) {
        return fail(res, '审核中及以后的状态不可修改', ErrorCode.PARAM_INVALID)
      }

      const updateData: any = {}
      if (supplier_id !== undefined) updateData.supplier_id = supplier_id
      if (supplier_name !== undefined) updateData.supplier_name = supplier_name
      if (supplier_code !== undefined) updateData.supplier_code = supplier_code
      if (material_id !== undefined) {
        const material = await Material.findOne({ where: { material_id: material_id } })
        if (!material) return fail(res, '料品不存在', ErrorCode.PARAM_INVALID)
        updateData.material_id = material_id
        updateData.material_code = material.material_code || ''
        updateData.material_name = material.material_name || ''
        updateData.specification = material.specification || ''
      }
      if (supplier_batch_no !== undefined) updateData.supplier_batch_no = supplier_batch_no
      if (internal_batch_no !== undefined) updateData.internal_batch_no = internal_batch_no
      if (quantity !== undefined) updateData.quantity = quantity
      if (arrival_date !== undefined) updateData.arrival_date = arrival_date ? new Date(arrival_date) : null
      if (standard_id !== undefined) updateData.standard_id = standard_id
      if (standard_name !== undefined) updateData.standard_name = standard_name
      if (handle_type !== undefined) updateData.handle_type = handle_type
      if (handle_reason !== undefined) updateData.handle_reason = handle_reason
      if (trigger_type !== undefined) updateData.trigger_type = trigger_type
      if (remarks !== undefined) updateData.remarks = remarks
      if (result !== undefined) updateData.result = result

      if (Object.keys(updateData).length > 0) {
        await record.update(updateData, { transaction: t })
      }

      if (items !== undefined) {
        await IncomingInspectionItem.destroy({ where: { inspection_id: id }, transaction: t })
        if (items.length > 0) {
          const user: any = req.user || {}
          const now = nowBeijingDate()
          const itemData = items.map((item: any, idx: number) => ({
            inspection_id: Number(id),
            item_name: item.item_name,
            category: item.category || '',
            standard_value: item.standard_value || '',
            actual_value: item.actual_value || '',
            result: convertItemResult(item.result),
            inspector_id: user.userId || null,
            inspector_name: user.realName || user.username || '',
            inspection_time: now,
            sort_order: item.sort_order !== undefined ? item.sort_order : idx,
            unit: item.unit || '',
            remarks: item.remarks || '',
          }))
          await IncomingInspectionItem.bulkCreate(itemData, { transaction: t })
        }
      }

      await t.commit()

      const detail = await getDetail(Number(id))
      success(res, detail, '更新成功')
    } catch (err: any) {
      if (t && !(t as any).finished) {
        try { await t.rollback() } catch (_) { /* ignore */ }
      }
      logger.error('[IncomingInspection] update error:', err)
      fail(res, err.message || '更新失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async start(req: any, res: any) {
    try {
      const { id } = req.params
      const user: any = req.user || {}
      const record = await IncomingInspection.findOne({ where: { inspection_id: id } })
      if (!record) {
        return fail(res, '记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const statusVal = typeof record.status === 'string' ? STATUS_REVERSE[record.status] : record.status
      if (statusVal !== 0) {
        return fail(res, '只有待检状态可以开检', ErrorCode.PARAM_INVALID)
      }

      const now = nowBeijingDate()
      await record.update({
        status: 1,
        inspector_id: user.userId || null,
        inspector_name: user.realName || user.username || '',
        inspection_time: now,
      })
      const detail = await getDetail(Number(id))
      success(res, detail, '开检成功')
    } catch (err: any) {
      logger.error('[IncomingInspection] start error:', err)
      fail(res, err.message || '开检失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async submit(req: any, res: any) {
    try {
      const { id } = req.params
      const record = await IncomingInspection.findOne({ where: { inspection_id: id } })
      if (!record) {
        return fail(res, '记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const statusVal = typeof record.status === 'string' ? STATUS_REVERSE[record.status] : record.status
      if (statusVal !== 1) {
        return fail(res, '只有检验中状态可以报审', ErrorCode.PARAM_INVALID)
      }

      await record.update({ status: 2 })
      success(res, { message: '报审成功' }, '报审成功')
    } catch (err: any) {
      logger.error('[IncomingInspection] submit error:', err)
      fail(res, err.message || '报审失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async review(req: any, res: any) {
    try {
      const { id } = req.params
      const { result, remarks } = req.body
      const user: any = req.user || {}

      if (result !== '合格' && result !== '不合格') {
        return fail(res, '审核结果必须为合格或不合格', ErrorCode.PARAM_INVALID)
      }

      const record = await IncomingInspection.findOne({ where: { inspection_id: id } })
      if (!record) {
        return fail(res, '记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const statusVal = typeof record.status === 'string' ? STATUS_REVERSE[record.status] : record.status
      if (statusVal !== 2) {
        return fail(res, '只有审核中状态可以审核', ErrorCode.PARAM_INVALID)
      }

      const now = nowBeijingDate()
      const targetStatus = result === '合格' ? 3 : 1
      await record.update({
        status: targetStatus,
        result,
        reviewer_id: user.userId || null,
        reviewer_name: user.realName || user.username || '',
        review_time: now,
        remarks: remarks !== undefined ? remarks : record.remarks,
      })

      const detail = await getDetail(Number(id))
      success(res, detail, '审核成功')
    } catch (err: any) {
      logger.error('[IncomingInspection] review error:', err)
      fail(res, err.message || '审核失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async delete(req: any, res: any) {
    const t = await IncomingInspection.sequelize.transaction()
    try {
      const { id } = req.params
      const record = await IncomingInspection.findOne({ where: { inspection_id: id } })
      if (!record) {
        return fail(res, '记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const statusVal = typeof record.status === 'string' ? STATUS_REVERSE[record.status] : record.status
      if (statusVal !== 0) {
        return fail(res, '只有待检状态可以删除', ErrorCode.PARAM_INVALID)
      }

      if (record.trigger_type !== '手工') {
        return fail(res, '只有手工触发的记录可以删除', ErrorCode.PARAM_INVALID)
      }

      await IncomingInspectionItem.destroy({ where: { inspection_id: id }, transaction: t })
      await record.destroy({ transaction: t })
      await t.commit()

      success(res, { message: '删除成功' }, '删除成功')
    } catch (err: any) {
      if (t && !(t as any).finished) {
        try { await t.rollback() } catch (_) { /* ignore */ }
      }
      logger.error('[IncomingInspection] delete error:', err)
      fail(res, err.message || '删除失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 采购入库同步：触发U9采购收货同步任务，完成后按 receipt_no+line_no 去重 upsert 来料检验主表
   */
  async syncFromPurchaseReceipts(req: any, res: any) {
    try {
      // 第一步：触发U9采购收货同步
      logger.info('[IncomingInspection] 开始采购入库同步...')
      const syncResult = await exportPurchaseReceipts('incoming-sync', async (msg, pct) => {
        logger.info(`[IncomingInspection] 同步进度: ${msg} (${pct}%)`)
      })
      logger.info(`[IncomingInspection] U9采购收货同步完成，共 ${syncResult.totalRecords} 条`)

      // 第二步：读取所有采购收货记录
      const receipts = await U9PurchaseReceipt.findAll({ raw: true }) as any[]

      // 第三步：查询已存在的来料检验记录（按 receipt_no + line_no 匹配）
      const existingMap = new Map<string, any>()
      const existing = await IncomingInspection.findAll({
        where: {
          receipt_no: { [Op.ne]: null },
          [Op.and]: [
            { receipt_no: { [Op.ne]: '' } },
          ],
        },
        raw: true,
      }) as any[]
      existing.forEach((r: any) => {
        const key = `${r.receipt_no}|${r.line_no || ''}`
        existingMap.set(key, r)
      })

      // 第四步：upsert
      let created = 0
      let updated = 0
      const t = await IncomingInspection.sequelize.transaction()
      try {
        for (const rc of receipts) {
          const key = `${rc.receipt_no}|${rc.line_no || ''}`
          const existingRecord = existingMap.get(key)

          // 字段映射（按用户提供的对应表）
          const mappedData: any = {
            supplier_name: rc.supplier_name || '',
            supplier_code: rc.supplier_code || '',
            material_code: rc.material_code || '',
            material_name: rc.material_name || '',
            specification: rc.specification || '',
            supplier_batch_no: rc.supplier_lot_no || '',
            internal_batch_no: rc.receive_lot_no || '',
            quantity: rc.received_qty ? Number(rc.received_qty) : 0,
            // 到货日期：U9 采购收货业务日期 receipt_date → 来料检验 arrival_date
            arrival_date: rc.receipt_date ? parseDateTime(rc.receipt_date) : null,
            receipt_no: rc.receipt_no || '',
            line_no: rc.line_no || '',
            receipt_status: rc.status || '',
          }

          if (existingRecord) {
            // 更新已有记录（仅更新映射字段，不改变状态/检验人等）
            await IncomingInspection.update(mappedData, {
              where: { inspection_id: existingRecord.inspection_id },
              transaction: t,
            })
            updated++
          } else {
            // 新建记录
            const inspection_no = await generateIncomingNo()
            await IncomingInspection.create({
              inspection_no,
              ...mappedData,
              trigger_type: '自动',
              status: 0,
            }, { transaction: t })
            created++
          }
        }
        await t.commit()
      } catch (err: any) {
        if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
        throw err
      }

      logger.info(`[IncomingInspection] 采购入库同步完成：同步 ${receipts.length} 条收货记录，新建 ${created} 条，更新 ${updated} 条`)

      success(res, {
        totalReceipts: receipts.length,
        created,
        updated,
      }, `采购入库同步完成：共 ${receipts.length} 条收货记录，新建 ${created} 条，更新 ${updated} 条`)
    } catch (err: any) {
      logger.error('[IncomingInspection] syncFromPurchaseReceipts error:', err)
      fail(res, err.message || '采购入库同步失败', ErrorCode.SYSTEM_ERROR)
    }
  },
}
