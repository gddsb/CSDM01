/**
 * 报工单统计持久化钩子
 *
 * 每次子表 CRUD 后调 recalcReportStats(reportOrderId)，
 * 用一次 SQL UPDATE 把 ReportOrder 主表的 7 个统计列重算写回。
 * 失败静默（try/catch），不阻塞 CRUD 主流程。
 *
 * 计算口径与前端 reportStats.ts 完全一致：
 *   total_input_qty       = 首工序投入 SUM − 首工序退回 SUM
 *   total_defect_material = SUM(defect WHERE defect_type='来料不良')
 *   total_defect_process  = SUM(defect WHERE defect_type='制程不良')
 *   total_defect_scrap    = SUM(defect WHERE defect_type='检验报废')
 *   total_exception_hours = SUM(COALESCE(net_duration, duration))
 *   total_manpower_hours  = SUM(COALESCE(net_hours, 0))
 *   expected_output       = input − material − process − scrap
 */
import sequelize from '../config/database.js'
import { logger } from './logger.js'

const RECALC_SQL = `
  UPDATE production_report_order ro
  LEFT JOIN (
    SELECT report_order_id,
           COALESCE(SUM(CASE WHEN material_type='投入' THEN quantity ELSE 0 END),0)
         - COALESCE(SUM(CASE WHEN material_type='退回' THEN quantity ELSE 0 END),0) AS input_qty
    FROM production_process_material GROUP BY report_order_id
  ) pm ON pm.report_order_id = ro.report_order_id
  LEFT JOIN (
    SELECT report_order_id,
           COALESCE(SUM(CASE WHEN pd.defect_type='来料不良' THEN pd.quantity ELSE 0 END),0) AS defect_material,
           COALESCE(SUM(CASE WHEN pd.defect_type='制程不良' THEN pd.quantity ELSE 0 END),0) AS defect_process
    FROM production_process_defect pd GROUP BY report_order_id
  ) d ON d.report_order_id = ro.report_order_id
  LEFT JOIN (
    SELECT report_order_id,
           COALESCE(SUM(quantity),0) AS defect_scrap
    FROM production_process_defect WHERE defect_type='检验报废' GROUP BY report_order_id
  ) sc ON sc.report_order_id = ro.report_order_id
  LEFT JOIN (
    SELECT report_order_id,
           COALESCE(SUM(COALESCE(net_duration, duration)),0) AS exc_hours
    FROM production_process_exception GROUP BY report_order_id
  ) ex ON ex.report_order_id = ro.report_order_id
  LEFT JOIN (
    SELECT report_order_id,
           COALESCE(SUM(COALESCE(net_hours, 0)),0) AS mp_hours
    FROM production_manpower_record GROUP BY report_order_id
  ) mp2 ON mp2.report_order_id = ro.report_order_id
  SET
    ro.total_input_qty = COALESCE(pm.input_qty, 0),
    ro.total_defect_material = COALESCE(d.defect_material, 0),
    ro.total_defect_process = COALESCE(d.defect_process, 0),
    ro.total_defect_scrap = COALESCE(sc.defect_scrap, 0),
    ro.total_exception_hours = ROUND(COALESCE(ex.exc_hours, 0), 2),
    ro.total_manpower_hours = ROUND(COALESCE(mp2.mp_hours, 0), 2),
    ro.expected_output = ROUND(
      COALESCE(pm.input_qty, 0)
      - COALESCE(d.defect_material, 0)
      - COALESCE(d.defect_process, 0)
      - COALESCE(sc.defect_scrap, 0), 2)
  WHERE ro.report_order_id = ?
`

/**
 * 重算单个报工单的 7 个统计列
 * 子表 Service 调用入口。失败静默。
 */
export async function recalcReportStats(reportOrderId: number | string): Promise<void> {
  if (!reportOrderId) return
  if (sequelize.getDialect() !== 'mysql') return
  try {
    await sequelize.query(RECALC_SQL, { replacements: [Number(reportOrderId)], raw: true })
  } catch (err: any) {
    logger.warn('[recalcReportStats] failed', { report_order_id: reportOrderId, err: err?.message })
  }
}

/** 批量重算（用于 backfill 或 bulk 操作后） */
export async function recalcReportStatsBatch(reportOrderIds: Array<number | string>): Promise<void> {
  if (!reportOrderIds || reportOrderIds.length === 0) return
  for (const id of reportOrderIds) {
    await recalcReportStats(id)
  }
}
