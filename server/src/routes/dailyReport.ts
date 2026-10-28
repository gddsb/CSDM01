/**
 * GET /api/daily-report?date=&line=&shift=
 * 返回制罐车间生产日报完整数据
 */
import { Router } from 'express'
import { getDailyReport } from '../services/DailyReportService.js'

const router = Router()

router.get('/', async (req: any, res: any) => {
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
})

export default router
