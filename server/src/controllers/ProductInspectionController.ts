import { Op } from 'sequelize'
import {
  ProductInspection,
  ProductInspectionItem,
  ReportOrder,
} from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { generateProductInspectionNo } from '../utils/sequence.js'
import { logger } from '../utils/logger.js'

const STATUS_REVERSE = { '待检': 0, '检验中': 1, '审核中': 2, '已完成': 3, '已关闭': 4 }

const parseStatusParam = (status) => {
  if (status === undefined || status === '' || status === null) return null
  const arr = Array.isArray(status) ? status : [status]
  const nums: number[] = []
  arr.forEach(s => {
    if (typeof s === 'string' && s.includes(',')) {
      s.split(',').forEach(p => {
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
  return ProductInspection.findOne({
    where: { inspection_id: id },
    include: [
      {
        model: ProductInspectionItem,
        as: 'items',
        order: [['sort_order', 'ASC'], ['item_id', 'ASC']],
      },
    ],
  })
}

export default {
  async list(req: any, res: any) {
    try {
      const {
        page = 1,
        page_size = 20,
        inspection_no,
        inspection_type,
        report_order_id,
        result,
        status,
        trigger_type,
        start_date,
        end_date,
      } = req.query

      const where: any = {}
      if (inspection_no) where.inspection_no = { [Op.like]: `%${inspection_no}%` }
      if (inspection_type) where.inspection_type = inspection_type
      if (report_order_id) where.report_order_id = report_order_id
      if (result) where.result = result
      if (trigger_type) where.trigger_type = trigger_type

      const statusArr = parseStatusParam(status)
      if (statusArr) where.status = statusArr

      if (start_date || end_date) {
        where.created_at = {}
        if (start_date) where.created_at[Op.gte] = new Date(start_date)
        if (end_date) where.created_at[Op.lte] = new Date(new Date(end_date).getTime() + 86400000)
      }

      const pageNum = Math.max(1, Number(page) || 1)
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(page_size) || 20))

      const { count, rows } = await ProductInspection.findAndCountAll({
        where,
        order: [['created_at', 'DESC']],
        limit: pageSize,
        offset: (pageNum - 1) * pageSize,
      })

      res.json(success({
        list: rows,
        total: count,
        page: pageNum,
        page_size: pageSize,
      }))
    } catch (err: any) {
      logger.error('[ProductInspection] list error:', err)
      res.json(fail(ErrorCode.SERVER_ERROR, err.message))
    }
  },

  async detail(req: any, res: any) {
    try {
      const { id } = req.params
      const record = await getDetail(Number(id))
      if (!record) {
        return res.json(fail(ErrorCode.NOT_FOUND, '记录不存在'))
      }
      res.json(success(record))
    } catch (err: any) {
      logger.error('[ProductInspection] detail error:', err)
      res.json(fail(ErrorCode.SERVER_ERROR, err.message))
    }
  },

  async create(req: any, res: any) {
    const t = await ProductInspection.sequelize.transaction()
    try {
      const {
        inspection_type,
        report_order_id,
        standard_id,
        standard_name,
        trigger_type,
        remarks,
        items = [],
      } = req.body

      if (!inspection_type) return res.json(fail(ErrorCode.PARAM_ERROR, '检验类型不能为空'))
      if (!report_order_id) return res.json(fail(ErrorCode.PARAM_ERROR, '关联报工单不能为空'))

      const reportOrder = await ReportOrder.findOne({ where: { report_order_id: report_order_id } })
      if (!reportOrder) return res.json(fail(ErrorCode.PARAM_ERROR, '报工单不存在'))

      const inspection_no = await generateProductInspectionNo(inspection_type)

      const record = await ProductInspection.create({
        inspection_no,
        inspection_type,
        report_order_id,
        report_order_no: reportOrder.report_no,
        material_id: reportOrder.material_id,
        material_code: reportOrder.material_code,
        material_name: reportOrder.material_name,
        specification: reportOrder.specification,
        standard_id: standard_id || null,
        standard_name: standard_name || '',
        trigger_type: trigger_type || '手工',
        status: 0,
        remarks,
      }, { transaction: t })

      if (items && items.length > 0) {
        const itemData = items.map((item: any, idx: number) => ({
          inspection_id: record.inspection_id,
          item_name: item.item_name,
          standard_value: item.standard_value || '',
          actual_value: item.actual_value || '',
          result: item.result !== undefined && item.result !== null
            ? (typeof item.result === 'string' ? (item.result === '合格' ? 1 : 0) : item.result)
            : null,
          inspector_id: item.inspector_id || null,
          inspector_name: item.inspector_name || '',
          inspection_time: item.inspection_time ? new Date(item.inspection_time) : null,
          sort_order: item.sort_order !== undefined ? item.sort_order : idx,
          remarks: item.remarks || '',
        }))
        await ProductInspectionItem.bulkCreate(itemData, { transaction: t })
      }

      await t.commit()

      const detail = await getDetail(record.inspection_id)
      res.json(success(detail))
    } catch (err: any) {
      await t.rollback()
      logger.error('[ProductInspection] create error:', err)
      res.json(fail(ErrorCode.SERVER_ERROR, err.message))
    }
  },

  async update(req: any, res: any) {
    const t = await ProductInspection.sequelize.transaction()
    try {
      const { id } = req.params
      const {
        standard_id,
        standard_name,
        trigger_type,
        remarks,
        result,
        items,
      } = req.body

      const record = await ProductInspection.findOne({ where: { inspection_id: id } })
      if (!record) {
        return res.json(fail(ErrorCode.NOT_FOUND, '记录不存在'))
      }

      const statusVal = typeof record.status === 'string' ? STATUS_REVERSE[record.status] : record.status
      if (statusVal >= 2) {
        return res.json(fail(ErrorCode.PARAM_ERROR, '审核中及以后的状态不可修改'))
      }

      const updateData: any = {}
      if (standard_id !== undefined) updateData.standard_id = standard_id
      if (standard_name !== undefined) updateData.standard_name = standard_name
      if (trigger_type !== undefined) updateData.trigger_type = trigger_type
      if (remarks !== undefined) updateData.remarks = remarks
      if (result !== undefined) updateData.result = result

      await record.update(updateData, { transaction: t })

      if (items !== undefined) {
        await ProductInspectionItem.destroy({ where: { inspection_id: id }, transaction: t })
        if (items.length > 0) {
          const itemData = items.map((item: any, idx: number) => ({
            inspection_id: id,
            item_name: item.item_name,
            standard_value: item.standard_value || '',
            actual_value: item.actual_value || '',
            result: item.result !== undefined && item.result !== null
              ? (typeof item.result === 'string' ? (item.result === '合格' ? 1 : 0) : item.result)
              : null,
            inspector_id: item.inspector_id || null,
            inspector_name: item.inspector_name || '',
            inspection_time: item.inspection_time ? new Date(item.inspection_time) : null,
            sort_order: item.sort_order !== undefined ? item.sort_order : idx,
            remarks: item.remarks || '',
          }))
          await ProductInspectionItem.bulkCreate(itemData, { transaction: t })
        }
      }

      await t.commit()

      const detail = await getDetail(Number(id))
      res.json(success(detail))
    } catch (err: any) {
      await t.rollback()
      logger.error('[ProductInspection] update error:', err)
      res.json(fail(ErrorCode.SERVER_ERROR, err.message))
    }
  },

  async submit(req: any, res: any) {
    try {
      const { id } = req.params
      const record = await ProductInspection.findOne({ where: { inspection_id: id } })
      if (!record) {
        return res.json(fail(ErrorCode.NOT_FOUND, '记录不存在'))
      }

      const statusVal = typeof record.status === 'string' ? STATUS_REVERSE[record.status] : record.status
      if (statusVal >= 2) {
        return res.json(fail(ErrorCode.PARAM_ERROR, '已报审或已完成，不可重复报审'))
      }

      await record.update({ status: 2 })
      res.json(success({ message: '报审成功' }))
    } catch (err: any) {
      logger.error('[ProductInspection] submit error:', err)
      res.json(fail(ErrorCode.SERVER_ERROR, err.message))
    }
  },

  async delete(req: any, res: any) {
    const t = await ProductInspection.sequelize.transaction()
    try {
      const { id } = req.params
      const record = await ProductInspection.findOne({ where: { inspection_id: id } })
      if (!record) {
        return res.json(fail(ErrorCode.NOT_FOUND, '记录不存在'))
      }

      const statusVal = typeof record.status === 'string' ? STATUS_REVERSE[record.status] : record.status
      if (statusVal >= 2) {
        return res.json(fail(ErrorCode.PARAM_ERROR, '审核中及以后的状态不可删除'))
      }

      await ProductInspectionItem.destroy({ where: { inspection_id: id }, transaction: t })
      await record.destroy({ transaction: t })
      await t.commit()

      res.json(success({ message: '删除成功' }))
    } catch (err: any) {
      await t.rollback()
      logger.error('[ProductInspection] delete error:', err)
      res.json(fail(ErrorCode.SERVER_ERROR, err.message))
    }
  },
}
