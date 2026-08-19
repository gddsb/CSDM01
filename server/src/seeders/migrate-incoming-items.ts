/**
 * 检验数据统一存储改造（阶段2.2）
 * 来料检验子表 quality_incoming_inspection_item → qc_inspection_item (source_type='来料')
 *
 * 用法：
 *   cd server && npx tsx src/seeders/migrate-incoming-items.ts
 *   加 --dry-run 仅统计不写入
 */
import { migrateItems } from './migrate-items-helper.js'
import IncomingInspectionItem from '../models/IncomingInspectionItem.js'
import sequelize from '../config/database.js'

migrateItems('来料', IncomingInspectionItem as any, {
  dryRun: process.argv.includes('--dry-run'),
})
  .then(r => {
    console.log(`来料子表迁移耗时 ${r.durationMs}ms`)
    return sequelize.close()
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
