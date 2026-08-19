/**
 * 检验数据统一存储改造（阶段2.5）
 * 从 qc_inspection_item.actual_value_text 解析生成 sample_value 行
 *
 * 数据解析规则（计划文档 §三·2.5）：
 * 1. actual_value 含逗号(,/，)或分号(;/；) → 拆分为多行
 *    sample_no 从 1 递增，dimension_code 统一 'VALUE'
 *    measure_value_num 尝试 CAST 为数值：成功存 num，失败存 text
 * 2. actual_value 为单个值 → 不拆分，sample_no=1，dimension_code='VALUE'
 * 3. actual_value 为空或纯文本描述 → 不创建 sample_value 行，仅保留 actual_value_text
 *
 * 设计要点：
 * - 幂等：执行前清空所有 sample_value（阶段1未生成任何业务 sample_value）
 * - 沿用 item.result 作为各 sample 的 is_qualified（旧数据无法精细判定单值合格性）
 * - 单事务批量插入，按 item_id 分批避免内存压力
 *
 * 用法：
 *   cd server && npx tsx src/seeders/migrate-sample-values.ts
 *   加 --dry-run 仅统计不写入
 */
import sequelize from '../config/database.js'
import QcInspectionItem from '../models/QcInspectionItem.js'
import QcInspectionSampleValue from '../models/QcInspectionSampleValue.js'

const SPLIT_RE = /[,;，；]\s*/
const NUM_RE = /^-?\d+(?:\.\d+)?$/

interface ParsedSample {
  sample_no: number
  value_num: number | null
  value_text: string | null
}

/**
 * 解析 actual_value 文本为样品值数组
 * - 返回空数组表示跳过（空值或纯描述无法拆分）
 */
function parseActualValue(raw: string | null | undefined): ParsedSample[] {
  if (!raw) return []
  const text = String(raw).trim()
  if (!text) return []

  // 按逗号/分号拆分（中英文都支持）
  const parts = text.split(SPLIT_RE).map(p => p.trim()).filter(p => p.length > 0)
  if (parts.length === 0) return []

  return parts.map((p, i) => {
    const num = NUM_RE.test(p) ? parseFloat(p) : null
    return {
      sample_no: i + 1,
      value_num: num,
      value_text: num === null ? p : null,
    }
  })
}

async function main() {
  await sequelize.authenticate()
  const dryRun = process.argv.includes('--dry-run')
  console.log(`=== sample_value 迁移开始 (dryRun=${dryRun}) ===`)

  // 1. 清空旧数据（幂等）
  if (!dryRun) {
    const cleared = await QcInspectionSampleValue.destroy({ where: {} })
    console.log(`清空 qc_inspection_sample_value ${cleared} 条（含旧测试数据）`)
  }

  // 2. 遍历所有新子表 items，解析 actual_value_text
  const items = await QcInspectionItem.findAll({
    raw: true,
    attributes: ['item_id', 'actual_value_text', 'result', 'inspector_id', 'inspection_time'],
  })
  console.log(`待解析 items ${items.length} 条`)

  let totalRows = 0
  let skipped = 0
  let numCount = 0   // 解析为数值的成功数
  let textCount = 0  // 解析为文本的数

  const BATCH = 500
  const batch: any[] = []

  const flush = async () => {
    if (batch.length === 0) return
    if (!dryRun) {
      // ignoreDuplicates: 同 (item_id, sample_no, dimension_code) 已存在则跳过
      await QcInspectionSampleValue.bulkCreate(batch, { ignoreDuplicates: true })
    }
    totalRows += batch.length
    batch.length = 0
  }

  for (const item of items) {
    const parsed = parseActualValue(item.actual_value_text)
    if (parsed.length === 0) {
      skipped++
      continue
    }
    for (const r of parsed) {
      if (r.value_num !== null) numCount++
      else textCount++
      batch.push({
        item_id: item.item_id,
        sample_no: r.sample_no,
        dimension_code: 'VALUE',
        dimension_name: null,
        measure_value_num: r.value_num,
        measure_value_text: r.value_text,
        is_qualified: item.result,  // 沿用 item 综合判定（旧数据无法逐值判定）
        defect_desc: null,
        measured_at: item.inspection_time,
        inspector_id: item.inspector_id,
      })
      if (batch.length >= BATCH) await flush()
    }
  }
  await flush()

  console.log(`\n=== sample_value 迁移完成 ===`)
  console.log(`  生成 ${totalRows} 行（数值 ${numCount} / 文本 ${textCount}）`)
  console.log(`  跳过 ${skipped} 条（无 actual_value 或纯描述无法拆分）`)
  await sequelize.close()
}

main().catch(err => {
  console.error('sample_value 迁移失败:', err)
  process.exit(1)
})
