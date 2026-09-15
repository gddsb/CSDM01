/**
 * 报工图片 Service（ReportImageController 业务逻辑下沉）
 *
 * fs/crypto（MD5、rename、unlink、existsSync）保留在 Controller
 * Service 只负责 DB 层业务：
 *   - 查询 ReportOrder 存在性
 *   - 查询当前报工单已有图片（用于 MD5 去重 + 流水号）
 *   - 持久化新图片记录 bulkCreate
 *   - 查询/删除图片记录本身
 */
import { ReportOrder, ReportImage } from '../models/index.js'
import { AppError } from '../utils/error.js'

export const ReportImageService = {
  async ensureReportOrder(reportNo: string) {
    const ro = await ReportOrder.findOne({ where: { report_no: reportNo } })
    if (!ro) throw new AppError('报工单不存在', 10002, 404)
    return ro
  },

  /** 查某报工单已有图片（原始 rows，用于 MD5 去重 + 流水号计算） */
  async listByReportOrder(reportOrderId: number) {
    return await ReportImage.findAll({
      where: { report_order_id: reportOrderId },
      raw: true,
      order: [['created_at', 'DESC']],
    })
  },

  /** 批量持久化新图片记录 */
  async bulkCreateRecords(records: Array<{ report_order_id: number; category: string; image_url: string; file_hash: string }>) {
    if (records.length === 0) return []
    return await ReportImage.bulkCreate(records)
  },

  async list(query: { report_order_id?: any; category?: string }) {
    const where: any = {}
    if (query.report_order_id) where.report_order_id = Number(query.report_order_id)
    if (query.category) where.category = query.category
    return await ReportImage.findAll({ where, order: [['image_id', 'ASC']] })
  },

  async remove(id: number | string) {
    const image = await ReportImage.findOne({ where: { image_id: Number(id) } })
    if (!image) throw new AppError('图片记录不存在', 10002, 404)
    const url = (image as any).image_url
    await image.destroy()
    return url // 返回给 Controller 做 fs 物理删除
  },
}

export default ReportImageService
