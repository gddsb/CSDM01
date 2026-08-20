import { Op } from 'sequelize'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  QualitySupplierComplaint,
  Supplier,
  IncomingInspection,
} from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { generateSupplierComplaintNo } from '../utils/sequence.js'
import { nowBeijingDate, formatDateTime } from '../utils/date.js'
import { logger } from '../utils/logger.js'
import { STATUS_REVERSE } from '../models/QualitySupplierComplaint.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

export default {
  /**
   * 分页查询供应商投诉列表
   * 支持按编号、供应商、状态、日期范围过滤
   */
  async list(req: any, res: any) {
    try {
      const {
        page = 1,
        pageSize = 20,
        complaint_no,
        supplier_name,
        supplier_id,
        status,
        start_date,
        end_date,
      } = req.query

      const where: any = {}
      if (complaint_no) where.complaint_no = { [Op.like]: `%${complaint_no}%` }
      if (supplier_name) where.supplier_name = { [Op.like]: `%${supplier_name}%` }
      if (supplier_id) where.supplier_id = supplier_id

      const statusArr = parseStatusParam(status)
      if (statusArr) where.status = { [Op.in]: statusArr }

      if (start_date || end_date) {
        where.created_at = {}
        if (start_date) where.created_at[Op.gte] = new Date(String(start_date))
        if (end_date) where.created_at[Op.lte] = new Date(new Date(String(end_date)).getTime() + 86400000)
      }

      const pageNum = Math.max(1, Number(page) || 1)
      const pageSizeNum = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(pageSize) || 20))

      const { count, rows } = await QualitySupplierComplaint.findAndCountAll({
        where,
        order: [['complaint_date', 'DESC'], ['complaint_id', 'DESC']],
        limit: pageSizeNum,
        offset: (pageNum - 1) * pageSizeNum,
      })

      success(res, { list: rows, total: count, page: pageNum, page_size: pageSizeNum })
    } catch (err: any) {
      logger.error('[SupplierComplaint] list error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 获取供应商投诉详情
   */
  async detail(req: any, res: any) {
    try {
      const { id } = req.params
      const record = await QualitySupplierComplaint.findOne({
        where: { complaint_id: id },
        include: [
          {
            model: Supplier,
            as: 'supplier',
            attributes: ['supplier_id', 'supplier_name', 'short_name', 'supplier_code', 'contact_person', 'phone'],
            required: false,
          },
          {
            model: IncomingInspection,
            as: 'incoming_inspection',
            attributes: ['inspection_id', 'inspection_no', 'supplier_name', 'result', 'status'],
            required: false,
          },
        ],
      })
      if (!record) {
        return fail(res, '投诉记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }
      success(res, record)
    } catch (err: any) {
      logger.error('[SupplierComplaint] detail error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 创建供应商投诉
   * 自动生成编号 GY+年份+4位序号，可关联来料检验记录
   */
  async create(req: any, res: any) {
    const t = await QualitySupplierComplaint.sequelize.transaction()
    try {
      const user: any = req.user || {}
      const {
        supplier_id,
        supplier_name,
        complaint_type,
        complaint_reason,
        related_inspection_id,
        complaint_date,
        remarks,
      } = req.body

      if (!supplier_id) {
        return fail(res, '供应商不能为空', ErrorCode.PARAM_INVALID)
      }
      if (!complaint_type) {
        return fail(res, '投诉类型不能为空', ErrorCode.PARAM_INVALID)
      }
      if (!complaint_reason) {
        return fail(res, '投诉原因不能为空', ErrorCode.PARAM_INVALID)
      }

      // 查询供应商信息
      const supplier = await Supplier.findOne({ where: { supplier_id } })
      if (!supplier) {
        return fail(res, '供应商不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      // 自动生成投诉编号
      const complaint_no = await generateSupplierComplaintNo()

      // 如果关联来料检验，自动填充供应商和检验信息
      let related_inspection_no = ''
      let supplierName = supplier_name || supplier.supplier_name || ''
      if (related_inspection_id) {
        const inspection = await IncomingInspection.findOne({
          where: { inspection_id: related_inspection_id },
          transaction: t,
        })
        if (inspection) {
          related_inspection_no = inspection.inspection_no || ''
          if (!supplier_name) {
            supplierName = inspection.supplier_name || supplierName
          }
        }
      }

      const record = await QualitySupplierComplaint.create({
        complaint_no,
        supplier_id,
        supplier_name: supplierName,
        complaint_type,
        complaint_reason,
        related_inspection_id: related_inspection_id || null,
        related_inspection_no,
        complaint_date: complaint_date ? new Date(complaint_date) : nowBeijingDate(),
        status: 0,
        created_by: user.userId || null,
        created_by_name: user.realName || user.username || '',
        remarks: remarks || '',
      }, { transaction: t })

      await t.commit()
      success(res, record, '创建成功')
    } catch (err: any) {
      if (t && !(t as any).finished) {
        try { await t.rollback() } catch (_) { /* ignore */ }
      }
      logger.error('[SupplierComplaint] create error:', err)
      fail(res, err.message || '创建失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 更新投诉信息
   * 仅允许在"已创建"状态下修改
   */
  async update(req: any, res: any) {
    const t = await QualitySupplierComplaint.sequelize.transaction()
    try {
      const { id } = req.params
      const record = await QualitySupplierComplaint.findOne({ where: { complaint_id: id } })
      if (!record) {
        return fail(res, '投诉记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const statusVal = typeof record.status === 'string' ? STATUS_REVERSE[record.status] : record.status
      if (statusVal !== 0) {
        return fail(res, '已发出及以后的状态不可修改', ErrorCode.PARAM_INVALID)
      }

      const updateData: any = {}
      const {
        supplier_id,
        supplier_name,
        complaint_type,
        complaint_reason,
        related_inspection_id,
        complaint_date,
        remarks,
      } = req.body

      if (supplier_id !== undefined) {
        const supplier = await Supplier.findOne({ where: { supplier_id } })
        if (!supplier) return fail(res, '供应商不存在', ErrorCode.RECORD_NOT_FOUND)
        updateData.supplier_id = supplier_id
        updateData.supplier_name = supplier_name || supplier.supplier_name || ''
      }
      if (complaint_type !== undefined) updateData.complaint_type = complaint_type
      if (complaint_reason !== undefined) updateData.complaint_reason = complaint_reason
      if (related_inspection_id !== undefined) {
        if (related_inspection_id) {
          const inspection = await IncomingInspection.findOne({ where: { inspection_id: related_inspection_id } })
          if (!inspection) return fail(res, '关联的来料检验记录不存在', ErrorCode.RECORD_NOT_FOUND)
          updateData.related_inspection_id = related_inspection_id
          updateData.related_inspection_no = inspection.inspection_no || ''
        } else {
          updateData.related_inspection_id = null
          updateData.related_inspection_no = ''
        }
      }
      if (complaint_date !== undefined) updateData.complaint_date = complaint_date ? new Date(complaint_date) : null
      if (remarks !== undefined) updateData.remarks = remarks

      if (Object.keys(updateData).length > 0) {
        await record.update(updateData, { transaction: t })
      }

      await t.commit()

      // 返回更新后的记录
      const updatedRecord = await QualitySupplierComplaint.findOne({ where: { complaint_id: id } })
      success(res, updatedRecord, '更新成功')
    } catch (err: any) {
      if (t && !(t as any).finished) {
        try { await t.rollback() } catch (_) { /* ignore */ }
      }
      logger.error('[SupplierComplaint] update error:', err)
      fail(res, err.message || '更新失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 发出投诉（状态：已创建 → 已发出）
   */
  async issue(req: any, res: any) {
    try {
      const { id } = req.params
      const record = await QualitySupplierComplaint.findOne({ where: { complaint_id: id } })
      if (!record) {
        return fail(res, '投诉记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const statusVal = typeof record.status === 'string' ? STATUS_REVERSE[record.status] : record.status
      if (statusVal !== 0) {
        return fail(res, '只有已创建状态可以发出', ErrorCode.PARAM_INVALID)
      }

      await record.update({ status: 1 })
      success(res, record, '发出成功')
    } catch (err: any) {
      logger.error('[SupplierComplaint] issue error:', err)
      fail(res, err.message || '发出失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 供应商回复（状态：已发出 → 已回复）
   */
  async reply(req: any, res: any) {
    const t = await QualitySupplierComplaint.sequelize.transaction()
    try {
      const { id } = req.params
      const user: any = req.user || {}
      const { reply_content } = req.body

      if (!reply_content) {
        return fail(res, '回复内容不能为空', ErrorCode.PARAM_INVALID)
      }

      const record = await QualitySupplierComplaint.findOne({ where: { complaint_id: id } })
      if (!record) {
        return fail(res, '投诉记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const statusVal = typeof record.status === 'string' ? STATUS_REVERSE[record.status] : record.status
      if (statusVal !== 1) {
        return fail(res, '只有已发出状态可以回复', ErrorCode.PARAM_INVALID)
      }

      const replyDate = nowBeijingDate()
      await record.update({
        status: 2,
        reply_content,
        reply_date: replyDate,
        reply_by: user.realName || user.username || '',
      }, { transaction: t })

      await t.commit()

      const updatedRecord = await QualitySupplierComplaint.findOne({ where: { complaint_id: id } })
      success(res, updatedRecord, '回复成功')
    } catch (err: any) {
      if (t && !(t as any).finished) {
        try { await t.rollback() } catch (_) { /* ignore */ }
      }
      logger.error('[SupplierComplaint] reply error:', err)
      fail(res, err.message || '回复失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 关闭投诉（状态：已回复 → 已关闭）
   */
  async close(req: any, res: any) {
    const t = await QualitySupplierComplaint.sequelize.transaction()
    try {
      const { id } = req.params
      const user: any = req.user || {}
      const { remarks } = req.body

      const record = await QualitySupplierComplaint.findOne({ where: { complaint_id: id } })
      if (!record) {
        return fail(res, '投诉记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const statusVal = typeof record.status === 'string' ? STATUS_REVERSE[record.status] : record.status
      if (statusVal !== 2) {
        return fail(res, '只有已回复状态可以关闭', ErrorCode.PARAM_INVALID)
      }

      const closedTime = nowBeijingDate()
      const updateData: any = {
        status: 3,
        closed_by: user.userId || null,
        closed_by_name: user.realName || user.username || '',
        closed_time: closedTime,
      }
      if (remarks !== undefined) {
        updateData.remarks = remarks
      }

      await record.update(updateData, { transaction: t })
      await t.commit()

      const updatedRecord = await QualitySupplierComplaint.findOne({ where: { complaint_id: id } })
      success(res, updatedRecord, '关闭成功')
    } catch (err: any) {
      if (t && !(t as any).finished) {
        try { await t.rollback() } catch (_) { /* ignore */ }
      }
      logger.error('[SupplierComplaint] close error:', err)
      fail(res, err.message || '关闭失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 生成PDF投诉单
   * 生成HTML文件并保存到uploads目录，返回下载链接
   */
  async generatePdf(req: any, res: any) {
    try {
      const { id } = req.params
      const record = await QualitySupplierComplaint.findOne({
        where: { complaint_id: id },
        include: [
          {
            model: Supplier,
            as: 'supplier',
            attributes: ['supplier_id', 'supplier_name', 'short_name', 'supplier_code', 'contact_person', 'phone'],
            required: false,
          },
          {
            model: IncomingInspection,
            as: 'incoming_inspection',
            attributes: ['inspection_id', 'inspection_no', 'supplier_name', 'result', 'status'],
            required: false,
          },
        ],
      })
      if (!record) {
        return fail(res, '投诉记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const data: any = record.toJSON()
      const supplierInfo = data.supplier || {}
      const inspectionInfo = data.incoming_inspection || {}

      // 构建HTML内容
      const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>供应商投诉单 - ${data.complaint_no}</title>
  <style>
    body { font-family: "Microsoft YaHei", Arial, sans-serif; margin: 40px; color: #333; }
    .header { text-align: center; border-bottom: 2px solid #1890ff; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { margin: 0; color: #1890ff; font-size: 24px; }
    .header .no { color: #666; font-size: 14px; margin-top: 8px; }
    .section { margin-bottom: 20px; }
    .section h2 { font-size: 16px; color: #1890ff; border-left: 4px solid #1890ff; padding-left: 10px; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    table td { border: 1px solid #ddd; padding: 8px 12px; font-size: 14px; }
    table td.label { background-color: #f5f5f5; width: 120px; color: #666; font-weight: 500; }
    table td.value { width: auto; }
    .status-tag { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 12px; }
    .status-0 { background: #e6f7ff; color: #1890ff; }
    .status-1 { background: #fff7e6; color: #fa8c16; }
    .status-2 { background: #f6ffed; color: #52c41a; }
    .status-3 { background: #f5f5f5; color: #8c8c8c; }
    .remark { background: #fafafa; padding: 12px; border-radius: 4px; font-size: 14px; line-height: 1.6; min-height: 60px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999; text-align: center; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>供应商投诉单</h1>
    <div class="no">投诉编号：${data.complaint_no || ''}</div>
  </div>

  <div class="section">
    <h2>基本信息</h2>
    <table>
      <tr>
        <td class="label">供应商</td>
        <td class="value">${data.supplier_name || supplierInfo.supplier_name || ''}</td>
        <td class="label">投诉日期</td>
        <td class="value">${data.complaint_date ? formatDateTime(data.complaint_date) : ''}</td>
      </tr>
      <tr>
        <td class="label">投诉类型</td>
        <td class="value">${data.complaint_type || ''}</td>
        <td class="label">状态</td>
        <td class="value"><span class="status-tag status-${data.status === '已创建' ? 0 : data.status === '已发出' ? 1 : data.status === '已回复' ? 2 : 3}">${data.status || ''}</span></td>
      </tr>
      ${data.related_inspection_id ? `
      <tr>
        <td class="label">关联来料检验</td>
        <td class="value">${data.related_inspection_no || inspectionInfo.inspection_no || ''}</td>
        <td class="label">检验结果</td>
        <td class="value">${inspectionInfo.result || ''}</td>
      </tr>` : ''}
      <tr>
        <td class="label">创建人</td>
        <td class="value">${data.created_by_name || ''}</td>
        <td class="label">创建时间</td>
        <td class="value">${data.created_at ? formatDateTime(data.created_at) : ''}</td>
      </tr>
    </table>
  </div>

  <div class="section">
    <h2>投诉原因</h2>
    <div class="remark">${data.complaint_reason || ''}</div>
  </div>

  ${data.status === '已回复' || data.status === '已关闭' ? `
  <div class="section">
    <h2>供应商回复</h2>
    <table>
      <tr>
        <td class="label">回复人</td>
        <td class="value">${data.reply_by || ''}</td>
        <td class="label">回复日期</td>
        <td class="value">${data.reply_date ? formatDateTime(data.reply_date) : ''}</td>
      </tr>
    </table>
    <div class="remark">${data.reply_content || ''}</div>
  </div>` : ''}

  ${data.status === '已关闭' ? `
  <div class="section">
    <h2>关闭信息</h2>
    <table>
      <tr>
        <td class="label">关闭人</td>
        <td class="value">${data.closed_by_name || ''}</td>
        <td class="label">关闭时间</td>
        <td class="value">${data.closed_time ? formatDateTime(data.closed_time) : ''}</td>
      </tr>
    </table>
  </div>` : ''}

  ${data.remarks ? `
  <div class="section">
    <h2>备注</h2>
    <div class="remark">${data.remarks}</div>
  </div>` : ''}

  <div class="footer">
    <p>本投诉单由系统自动生成 · 打印时间：${formatDateTime(new Date())}</p>
  </div>
</body>
</html>`

      // 保存HTML文件到uploads目录
      const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'complaints')
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true })
      }
      const fileName = `complaint_${data.complaint_no}_${Date.now()}.html`
      const filePath = path.join(uploadDir, fileName)
      fs.writeFileSync(filePath, html, 'utf-8')

      // 更新记录的pdf_path
      await record.update({ pdf_path: `/uploads/complaints/${fileName}` })

      success(res, {
        pdf_path: `/uploads/complaints/${fileName}`,
        download_url: `/uploads/complaints/${fileName}`,
        file_name: fileName,
      }, '生成成功')
    } catch (err: any) {
      logger.error('[SupplierComplaint] generatePdf error:', err)
      fail(res, err.message || '生成失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 删除投诉
   * 仅允许在"已创建"状态下删除
   */
  async delete(req: any, res: any) {
    const t = await QualitySupplierComplaint.sequelize.transaction()
    try {
      const { id } = req.params
      const record = await QualitySupplierComplaint.findOne({ where: { complaint_id: id } })
      if (!record) {
        return fail(res, '投诉记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const statusVal = typeof record.status === 'string' ? STATUS_REVERSE[record.status] : record.status
      if (statusVal !== 0) {
        return fail(res, '只有已创建状态可以删除', ErrorCode.PARAM_INVALID)
      }

      await record.destroy({ transaction: t })
      await t.commit()

      success(res, null, '删除成功')
    } catch (err: any) {
      if (t && !(t as any).finished) {
        try { await t.rollback() } catch (_) { /* ignore */ }
      }
      logger.error('[SupplierComplaint] delete error:', err)
      fail(res, err.message || '删除失败', ErrorCode.SYSTEM_ERROR)
    }
  },
}