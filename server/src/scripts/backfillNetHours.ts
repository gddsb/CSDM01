/**
 * 一次性存量补算脚本：重算所有已生成报工单的 net_hours / net_duration
 * 运行方式: cd server && pnpm tsx src/scripts/backfillNetHours.ts
 */
import '../config/database.js'
import { ReportOrder } from '../models/index.js'
import { recalcNetForReport } from '../utils/breakTime.js'

async function main() {
  console.log('=== 存量补算 net_hours / net_duration 开始 ===')

  const all = await ReportOrder.findAll({
    attributes: ['report_order_id', 'report_no', 'status'],
  })
  console.log(`共 ${all.length} 条报工单待处理`)

  let ok = 0, skip = 0, fail = 0
  for (const ro of all as any[]) {
    const id = ro.getDataValue('report_order_id')
    const no = ro.getDataValue('report_no')
    try {
      await recalcNetForReport(id)
      ok++
      if (ok % 50 === 0) console.log(`  已处理 ${ok}/${all.length} ...`)
    } catch (e: any) {
      fail++
      console.error(`  ✗ ${no} (${id}) 失败: ${e.message}`)
    }
  }

  console.log(`\n=== 补算完成：成功 ${ok} / 跳过 ${skip} / 失败 ${fail} ===`)
  process.exit(0)
}

main().catch(e => {
  console.error('致命错误:', e)
  process.exit(1)
})
