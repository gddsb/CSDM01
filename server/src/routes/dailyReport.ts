/**
 * GET /api/daily-report?date=&line=&shift=
 * GET /api/daily-report/dates?year=&month=  — 当月有完工报工单的日期列表（用于日历高亮）
 */
import { Router } from 'express'
import { Op } from 'sequelize'
import { asyncHandler } from '../middleware/security.js'
import { authRequired, permissionRequired } from '../middleware/auth.js'
import { getDailyReport } from '../services/DailyReportService.js'
import ReportOrder from '../models/ReportOrder.js'

const router = Router()

router.use(authRequired)

/** 当月有开工报工单的日期 — 用于 DatePicker cellRender 蓝点标记 */
router.get('/dates', permissionRequired('report:daily'), asyncHandler(async (req: any, res: any) => {
  try {
    const year = Number(req.query.year)
    const month = Number(req.query.month)
    if (!year || !month) return res.json({ success: true, data: [] })

    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 0, 23, 59, 59)

    // 按 report_time（开工时间）查当天开工的报工单，不限 status
    const orders: any[] = await ReportOrder.findAll({
      where: { report_time: { [Op.between]: [start, end] } },
      attributes: ['report_time'],
    })

    const dateSet = new Set<string>()
    for (const o of orders) {
      const t = o.report_time ? new Date(o.report_time) : null
      if (t && !isNaN(t.getTime())) {
        dateSet.add(`${year}-${String(month).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`)
      }
    }
    return res.json({ success: true, data: Array.from(dateSet).sort() })
  } catch (err: any) {
    console.error('[DailyReport/dates] ERR', err?.message || err)
    return res.status(500).json({ success: false, message: err?.message || '日期标记加载失败' })
  }
}))

router.get('/', permissionRequired('report:daily'), asyncHandler(async (req: any, res: any) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10)
    const line = req.query.line as string | undefined
    const shift = req.query.shift as string | undefined
    const data = await getDailyReport(date, line, shift)
    return res.json({ success: true, data })
  } catch (err: any) {
    console.error('[DailyReport] ERR', err?.message || err)
    return res.status(500).json({ success: false, message: err?.message || '日报数据加载失败' })
  }
}))

export default router
