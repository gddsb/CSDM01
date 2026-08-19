// @ts-nocheck
// 归档脚本（阶段2使用）：阶段5移除旧子表模型后不再参与常规编译，必要时通过 tsx 直接执行
/**
 * 检验数据统一存储改造（阶段2.4）
 * 微生物检验子表 quality_microbe_inspection_item → qc_inspection_item (source_type='微生物')
 *
 * 用法：
 *   cd server && npx tsx src/seeders/migrate-microbe-items.ts
 *   加 --dry-run 仅统计不写入
 */
import { migrateItems } from './migrate-items-helper.js'
import MicrobeInspectionItem from '../models/MicrobeInspectionItem.js'
import sequelize from '../config/database.js'

migrateItems('微生物', MicrobeInspectionItem as any, {
  dryRun: process.argv.includes('--dry-run'),
})
  .then(r => {
    console.log(`微生物子表迁移耗时 ${r.durationMs}ms`)
    return sequelize.close()
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
