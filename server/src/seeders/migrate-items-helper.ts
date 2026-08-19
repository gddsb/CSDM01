/**
 * 检验数据统一存储改造（阶段2.2-2.4）
 * 三旧子表 → qc_inspection_item 全量迁移共用 helper
 *
 * - 迁移前自动清空对应 source_type 的旧数据（幂等，可重复执行）
 * - 单事务保证原子性，失败整体回滚
 * - 旧子表 result 字段有 getter/setter 自动转字符串"合格/不合格"，
 *   统一用 raw:true 取原始 TINYINT，避免类型污染
 * - 新子表 item_cfg_id 留空（阶段3前端录入时再补关联配置）
 *
 * 用法：被 migrate-incoming-items.ts / migrate-product-items.ts / migrate-microbe-items.ts 调用
 */
import type { ModelStatic } from 'sequelize'
import sequelize from '../config/database.js'
import QcInspectionItem from '../models/QcInspectionItem.js'

export type SourceType = '来料' | '产品' | '微生物'

interface OldItemRow {
  item_id: number
  inspection_id: number
  item_name: string
  category: string | null
  standard_value: string | null
  actual_value: string | null
  result: number | null
  inspector_id: number | null
  inspector_name: string | null
  inspection_time: Date | null
  sort_order: number | null
  unit: string | null
  remarks: string | null
}

export interface MigrateResult {
  source: SourceType
  oldCount: number
  newCount: number
  durationMs: number
}

export async function migrateItems(
  source: SourceType,
  OldModel: ModelStatic<any>,
  options: { dryRun?: boolean } = {},
): Promise<MigrateResult> {
  const start = Date.now()
  const dryRun = options.dryRun === true
  await sequelize.authenticate()

  // 1. 取旧子表全部数据（raw 避免 result getter 把 0/1 转成"合格/不合格"）
  const oldRows: OldItemRow[] = await OldModel.findAll({ raw: true })
  console.log(`[${source}] 旧子表 ${OldModel.getTableName()} 共 ${oldRows.length} 条`)

  if (dryRun) {
    console.log(`[${source}] dryRun 模式，不写入`)
    return { source, oldCount: oldRows.length, newCount: 0, durationMs: Date.now() - start }
  }

  const t = await sequelize.transaction()
  try {
    // 2. 清空新子表对应 source_type 的旧数据（保证幂等：可重复执行不产生重复）
    const deleted = await QcInspectionItem.destroy({
      where: { source_type: source },
      transaction: t,
    })
    if (deleted > 0) console.log(`[${source}] 清空新子表残留 ${deleted} 条（重新迁移）`)

    // 3. 批量插入，按 500 一批避免单事务过大
    const BATCH = 500
    for (let i = 0; i < oldRows.length; i += BATCH) {
      const slice = oldRows.slice(i, i + BATCH)
      const data = slice.map(r => ({
        source_type: source,
        inspection_id: r.inspection_id,
        item_cfg_id: null,
        item_name: r.item_name,
        category: r.category ?? null,
        standard_value: r.standard_value ?? null,
        actual_value_text: r.actual_value ?? null,
        sample_count: null,
        summary: null,
        result: r.result,
        inspector_id: r.inspector_id ?? null,
        inspector_name: r.inspector_name ?? null,
        inspection_time: r.inspection_time ?? null,
        unit: r.unit ?? null,
        sort_order: r.sort_order ?? 0,
        remarks: r.remarks ?? null,
      }))
      await QcInspectionItem.bulkCreate(data, { transaction: t })
    }

    await t.commit()
    const newCount = await QcInspectionItem.count({ where: { source_type: source } })
    const ok = newCount === oldRows.length
    console.log(`[${source}] 迁移完成，新子表 ${newCount} 条（${ok ? '一致✓' : '不一致✗'}）`)
    return { source, oldCount: oldRows.length, newCount, durationMs: Date.now() - start }
  } catch (err: any) {
    await t.rollback()
    console.error(`[${source}] 迁移失败:`, err.message)
    throw err
  }
}
