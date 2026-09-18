/**
 * 供应商投诉 Controller — CRUD + 状态流转走 Service；generatePdf 保留 HTML 生成 + fs
 */
import path from 'path'
import fs from 'fs'
import SupplierComplaintService from '../services/SupplierComplaintService.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import { logger } from '../utils/logger.js'
import { asyncHandler } from '../middleware/security.js'
import { formatDateTime } from '../utils/date.js'
import type { Request, Response } from 'express'

export default {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { rows, count } = await SupplierComplaintService.list(req.query)
    return success(res, rows, '查询成功', count)
  }),
  detail: asyncHandler(async (req: Request, res: Response) => {
    const record = await SupplierComplaintService.detail(Number(req.params.id))
    return success(res, record, '查询成功')
  }),
  create: asyncHandler(async (req: Request, res: Response) => {
    const record = await SupplierComplaintService.create(req.body, (req as any).user)
    return success(res, record, '创建成功')
  }),
  update: asyncHandler(async (req: Request, res: Response) => {
    const record = await SupplierComplaintService.update(Number(req.params.id), req.body)
    return success(res, record, '修改成功')
  }),
  issue: asyncHandler(async (req: Request, res: Response) => {
    const record = await SupplierComplaintService.issue(Number(req.params.id), req.body, (req as any).user)
    return success(res, record, '下发成功')
  }),
  reply: asyncHandler(async (req: Request, res: Response) => {
    const record = await SupplierComplaintService.reply(Number(req.params.id), req.body, (req as any).user)
    return success(res, record, '回复成功')
  }),
  close: asyncHandler(async (req: Request, res: Response) => {
    const record = await SupplierComplaintService.close(Number(req.params.id), req.body, (req as any).user)
    return success(res, record, '关闭成功')
  }),
  delete: asyncHandler(async (req: Request, res: Response) => {
    await SupplierComplaintService.delete(Number(req.params.id))
    return success(res, null, '删除成功')
  }),

  // ---- fs 边界：generatePdf 保留 HTML 拼装 + fs 写文件；DB 查记录/更新走 Service ----

  async generatePdf(req: any, res: any) {
    try {
      const { id } = req.params
      // DB 查记录（含 Supplier）
      const record: any = await SupplierComplaintService.findForPdf(Number(id))

      const data: any = record.toJSON()
      const supplierInfo = data.supplier || {}

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
      ${data.related_doc_no ? `
      <tr>
        <td class="label">关联单据</td>
        <td class="value" colspan="3">${data.related_doc_type ? '[' + data.related_doc_type + '] ' : ''}${data.related_doc_no}</td>
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

      // 保存HTML文件到uploads目录（fs 边界）
      const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'complaints')
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
      const fileName = `complaint_${data.complaint_no}_${Date.now()}.html`
      const filePath = path.join(uploadDir, fileName)
      fs.writeFileSync(filePath, html, 'utf-8')

      // DB 更新路径（Service）
      const pdfPath = `/uploads/complaints/${fileName}`
      await SupplierComplaintService.updatePdfPath(record, pdfPath)

      return success(res, {
        pdf_path: pdfPath,
        download_url: pdfPath,
        file_name: fileName,
      }, '生成成功')
    } catch (err: any) {
      logger.error('[SupplierComplaint] generatePdf error:', err)
      return fail(res, err.message || '生成失败', ErrorCode.SYSTEM_ERROR)
    }
  },
}
