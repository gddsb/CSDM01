import type { Request, Response } from 'express'
import { Op } from 'sequelize'
import { success, fail } from '../utils/response.js'
import DicHoliday from '../models/DicHoliday.js'
import DeviceMaintenanceRecord from '../models/DeviceMaintenanceRecord.js'
import { generateRecords } from '../services/MaintenanceGenerator.js'

/**
 * 休息日/节假日管理
 * 前端限制只能设置"本月 + 下月"
 */

export async function list(req: Request, res: Response) {
  const { year, month } = req.query
  const where: any = {}
  if (year && month) {
    const y = Number(year)
    const m = Number(month)
    const first = new Date(y, m - 1, 1)
    const last = new Date(y, m, 0, 23, 59, 59)
    where.holiday_date = { [Op.between]: [first, last] }
  } else {
    // 默认本月+下月
    const now = new Date()
    const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59)
    where.holiday_date = { [Op.between]: [firstThisMonth, lastNextMonth] }
  }
  const list = await DicHoliday.findAll({
    where,
    order: [['holiday_date', 'ASC']],
  })
  return success(res, list)
}

/** 批量保存（先删再写本月+下月的休息数据）
 *  body: { records: [{holiday_date, holiday_name, is_workday}] }
 */
export async function batchSave(req: Request, res: Response) {
  const { records } = req.body as {
    records: Array<{ holiday_date: string; holiday_name?: string; is_workday?: number }>
  }
  if (!Array.isArray(records)) return fail(res, 'records 必须是数组', 400)

  // 校验所有日期都在本月或下月
  const now = new Date()
  const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59)
  for (const r of records) {
    const d = new Date(r.holiday_date)
    if (d < firstThisMonth || d > lastNextMonth) {
      return fail(res, `日期 ${r.holiday_date} 超出允许范围（本月+下月）`, 400)
    }
  }

  // 删掉本月+下月的旧数据（只删这些，不影响历史）
  await DicHoliday.destroy({
    where: {
      holiday_date: { [Op.between]: [firstThisMonth, lastNextMonth] },
    },
  })

  // 批量创建
  const nowTs = new Date()
  const inserts = records.map(r => ({
    holiday_date: new Date(r.holiday_date),
    holiday_name: r.holiday_name || '厂休',
    is_workday: r.is_workday ? 1 : 0,
    created_at: nowTs,
    updated_at: nowTs,
  }))
  if (inserts.length) await DicHoliday.bulkCreate(inserts)

  // 触发重新生成本月+下月的维保计划
  const y1 = now.getFullYear()
  const m1 = now.getMonth() + 1
  const y2 = now.getFullYear()
  const m2 = now.getMonth() + 2
  try {
    await regenerateMonth(y1, m1)
    await regenerateMonth(y2, m2)
  } catch (e) {
    // 不阻塞保存，只 warn
  }

  return success(res, { saved: inserts.length })
}

export async function create(req: Request, res: Response) {
  const { holiday_date, holiday_name, is_workday } = req.body
  if (!holiday_date) return fail(res, '缺少 holiday_date', 400)
  const d = new Date(holiday_date)
  const rec = await DicHoliday.create({
    holiday_date: d,
    holiday_name: holiday_name || '厂休',
    is_workday: is_workday ? 1 : 0,
  })
  await regenerateForDate(d)
  return success(res, rec)
}

export async function remove(req: Request, res: Response) {
  const { date } = req.params
  const d = new Date(String(date))
  await DicHoliday.destroy({ where: { holiday_date: d } })
  await regenerateForDate(d)
  return success(res, null)
}

/** 重新生成某月维保计划：
 *  1. 把该月 dic_holiday 里的日期但 status='待执行' 的旧记录 → 改 status='已跳过'
 *  2. 正常日期如果没有记录 → 补生成 status='待执行'
 */
async function regenerateMonth(year: number, month: number) {
  try {
    await generateRecords({ target_month: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}` })
  } catch (e) {
    // 维保标准未配置等情况允许静默
  }
}

async function regenerateForDate(d: Date) {
  await regenerateMonth(d.getFullYear(), d.getMonth() + 1)
}
