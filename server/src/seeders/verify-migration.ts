// @ts-nocheck
// 归档脚本（阶段2使用）：阶段5移除旧子表模型后不再参与常规编译，必要时通过 tsx 直接执行
/**
 * 检验数据统一存储改造（阶段2.6）
 * 一致性校验脚本
 *
 * 校验项：
 * 1. 三旧子表 count = 新子表按 source_type count
 * 2. 抽检 10 条数据，字段比对：item_name/standard_value/actual_value/result/sort_order
 * 3. sample_value 行数 = 解析成功的 actual_value 数（提示性）
 *
 * 用法：
 *   cd server && npx tsx src/seeders/verify-migration.ts
 *   退出码：0 全部一致，1 存在差异
 */
import { Op } from 'sequelize'
import sequelize from '../config/database.js'
import IncomingInspectionItem from '../models/IncomingInspectionItem.js'
import ProductInspectionItem from '../models/ProductInspectionItem.js'
import MicrobeInspectionItem from '../models/MicrobeInspectionItem.js'
import QcInspectionItem from '../models/QcInspectionItem.js'
import QcInspectionSampleValue from '../models/QcInspectionSampleValue.js'

const SAMPLE_SIZE = 10

interface CheckRow {
  source: string
  oldModel: any
}

async function main() {
  await sequelize.authenticate()
  let allOk = true

  const checks: CheckRow[] = [
    { source: '来料', oldModel: IncomingInspectionItem },
    { source: '产品', oldModel: ProductInspectionItem },
    { source: '微生物', oldModel: MicrobeInspectionItem },
  ]

  console.log('=== 阶段2 迁移一致性校验 ===\n')

  // 1. count 比对
  for (const { source, oldModel } of checks) {
    const oldCount = await oldModel.count()
    const newCount = await QcInspectionItem.count({ where: { source_type: source } })
    const ok = oldCount === newCount
    if (!ok) allOk = false
    console.log(`[${source}] 旧子表=${oldCount} 新子表=${newCount} ${ok ? '✓一致' : '✗不一致'}`)
  }

  // 2. 抽检 10 条字段比对
  console.log('\n--- 字段抽检 ---')
  for (const { source, oldModel } of checks) {
    const oldCount = await oldModel.count()
    if (oldCount === 0) {
      console.log(`[${source}] 旧子表无数据，跳过抽检`)
      continue
    }
    // 取最近 SAMPLE_SIZE 条
    const oldSamples = await oldModel.findAll({
      raw: true,
      limit: SAMPLE_SIZE,
      order: [['item_id', 'DESC']],
    })
    const oldInsIds = [...new Set(oldSamples.map((r: any) => r.inspection_id))]
    const newSamples = await QcInspectionItem.findAll({
      where: { source_type: source, inspection_id: oldInsIds as number[] },
      raw: true,
    })

    let fieldOk = 0
    let fieldBad = 0
    for (const o of oldSamples) {
      const n = newSamples.find((x: any) =>
        x.inspection_id === o.inspection_id && x.item_name === o.item_name)
      if (!n) { fieldBad++; continue }
      const sameStd = (n.standard_value ?? null) === (o.standard_value ?? null)
      const sameAct = (n.actual_value_text ?? null) === (o.actual_value ?? null)
      const sameRes = Number(n.result) === Number(o.result)
      const sameSort = Number(n.sort_order ?? 0) === Number(o.sort_order ?? 0)
      if (sameStd && sameAct && sameRes && sameSort) {
        fieldOk++
      } else {
        fieldBad++
        console.log(`  ✗ [${source}] inspection_id=${o.inspection_id} item_name="${o.item_name}" 不一致`)
        if (!sameStd) console.log(`     standard_value: 旧="${o.standard_value}" 新="${n.standard_value}"`)
        if (!sameAct) console.log(`     actual_value: 旧="${o.actual_value}" 新="${n.actual_value_text}"`)
        if (!sameRes) console.log(`     result: 旧=${o.result} 新=${n.result}`)
        if (!sameSort) console.log(`     sort_order: 旧=${o.sort_order} 新=${n.sort_order}`)
      }
    }
    console.log(`[${source}] 字段抽检 ${fieldOk}/${oldSamples.length} 一致，${fieldBad} 不一致`)
    if (fieldBad > 0) allOk = false
  }

  // 3. sample_value 总数（提示性）
  console.log('\n--- sample_value 统计 ---')
  const svTotal = await QcInspectionSampleValue.count()
  const svNum = await QcInspectionSampleValue.count({ where: { measure_value_num: { [Op.ne]: null } } })
  const svText = await QcInspectionSampleValue.count({ where: { measure_value_text: { [Op.ne]: null } } })
  console.log(`  总数 = ${svTotal}，数值 ${svNum} / 文本 ${svText}`)
  // 与 item 解析统计对齐：只统计 actual_value_text 非空且有逗号/分号的 item 数
  const items = await QcInspectionItem.findAll({
    raw: true,
    attributes: ['item_id', 'actual_value_text'],
  })
  let expectedSvRows = 0
  let skippedItems = 0
  for (const it of items) {
    const t = (it.actual_value_text || '').trim()
    if (!t) { skippedItems++; continue }
    const parts = t.split(/[,;，；]\s*/).map(p => p.trim()).filter(p => p.length > 0)
    if (parts.length === 0) { skippedItems++; continue }
    expectedSvRows += parts.length
  }
  console.log(`  预期 ${expectedSvRows} 行（来自 ${items.length - skippedItems} 个 item，跳过 ${skippedItems} 个无值 item）`)
  if (svTotal !== expectedSvRows) {
    console.log(`  ✗ sample_value 行数与预期不符`)
    allOk = false
  } else {
    console.log(`  ✓ sample_value 行数与预期一致`)
  }

  console.log(`\n=== 校验结果: ${allOk ? '✓ 全部一致' : '✗ 存在差异'} ===`)
  await sequelize.close()
  process.exit(allOk ? 0 : 1)
}

main().catch(err => {
  console.error('校验失败:', err)
  process.exit(1)
})
