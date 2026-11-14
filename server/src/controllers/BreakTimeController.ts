import type { Request, Response } from 'express'
import { randomUUID } from 'crypto'
import { success, fail } from '../utils/response.js'
import ProductionBreakTime from '../models/ProductionBreakTime.js'
import ReportOrder from '../models/ReportOrder.js'
import { Op } from 'sequelize'

/** 列出某个报工单的所有休息记录 */
export async function list(req: Request, res: Response) {
  const { report_order_id } = req.query
  if (!report_order_id) {
    return fail(res, '缺少 report_order_id', 400)
  }
  const roId = Array.isArray(report_order_id) ? report_order_id[0] : report_order_id
  const list = await ProductionBreakTime.findAll({
    where: { report_order_id: String(roId) },
    order: [['start_time', 'ASC']],
  })
  return success(res, list)
}

/** 批量保存休息记录（先删旧的再写新的）
 *  body: { report_order_id, records: [{start_time, end_time, remark}, ...] }
 */
export async function batchSave(req: Request, res: Response) {
  const { report_order_id, records } = req.body as {
    report_order_id: string
    records: Array<{ start_time: string; end_time: string; remark?: string }>
  }
  if (!report_order_id) return fail(res, '缺少 report_order_id', 400)

  // 校验报工单存在
  const order = await ReportOrder.findByPk(report_order_id)
  if (!order) return fail(res, '报工单不存在', 404)

  // ===== 校验所有 records：每段有效 + N² 无重叠 + 无完全重复 =====
  const parsed: Array<{ st: number; et: number; start_time: string; end_time: string; remark?: string }> = []
  for (const r of records || []) {
    if (!r.start_time || !r.end_time) continue
    const st = new Date(r.start_time).getTime()
    const et = new Date(r.end_time).getTime()
    if (isNaN(st) || isNaN(et) || et <= st) continue
    parsed.push({ st, et, start_time: r.start_time, end_time: r.end_time, remark: r.remark })
  }
  // 完全重复 & 重叠校验（N²）
  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      const a = parsed[i], b = parsed[j]
      // 完全相同
      if (a.st === b.st && a.et === b.et) {
        return fail(res, `休息时间段完全重复：${new Date(a.st).toISOString()}`, 400)
      }
      // 有重叠：a.st < b.et 且 b.st < a.et
      if (a.st < b.et && b.st < a.et) {
        return fail(res, `休息时间段有重叠，请调整后再保存`, 400)
      }
    }
  }

  // 先删旧记录
  await ProductionBreakTime.destroy({ where: { report_order_id } })

  // 批量写新记录
  const now = new Date()
  let totalMinutes = 0
  for (const p of parsed) {
    const minutes = Math.round((p.et - p.st) / 60000)
    totalMinutes += minutes
    await ProductionBreakTime.create({
      break_time_id: randomUUID(),
      report_order_id,
      start_time: new Date(p.start_time),
      end_time: new Date(p.end_time),
      remark: p.remark || null,
      created_at: now,
      updated_at: now,
    })
  }

  // 汇总写回 report_order
  await ReportOrder.update(
    { break_minutes: totalMinutes },
    { where: { report_order_id } },
  )

  return success(res, { saved: parsed.length, total_minutes: totalMinutes })
}

/** 新增单条 */
export async function create(req: Request, res: Response) {
  const { report_order_id, start_time, end_time, remark } = req.body
  if (!report_order_id || !start_time || !end_time) {
    return fail(res, '缺少必要字段', 400)
  }
  const st = new Date(start_time)
  const et = new Date(end_time)
  if (et.getTime() <= st.getTime()) {
    return fail(res, '结束时间必须晚于开始时间', 400)
  }
  const rec = await ProductionBreakTime.create({
    break_time_id: randomUUID(),
    report_order_id,
    start_time: st,
    end_time: et,
    remark,
  })
  await refreshBreakMinutes(report_order_id)
  return success(res, rec)
}

/** 删除单条 */
export async function remove(req: Request, res: Response) {
  const { id } = req.params
  const record = await ProductionBreakTime.findByPk(String(id))
  if (!record) return fail(res, '记录不存在', 404)
  await record.destroy()
  await refreshBreakMinutes(record.report_order_id)
  return success(res, null)
}

async function refreshBreakMinutes(report_order_id: string) {
  const list = await ProductionBreakTime.findAll({
    where: { report_order_id },
  })
  const total = list.reduce((acc, r) => {
    const mins = Math.round(
      (new Date(r.end_time as unknown as string).getTime() -
       new Date(r.start_time as unknown as string).getTime()) / 60000,
    )
    return acc + mins
  }, 0)
  await ReportOrder.update({ break_minutes: total }, { where: { report_order_id } })
}
