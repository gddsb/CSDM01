/**
 * 检验数据统一存储改造（阶段2.3）
 * 产品检验子表 quality_product_inspection_item → qc_inspection_item (source_type='产品')
 *
 * 用法：
 *   cd server && npx tsx src/seeders/migrate-product-items.ts
 *   加 --dry-run 仅统计不写入
 */
import { migrateItems } from './migrate-items-helper.js'
import ProductInspectionItem from '../models/ProductInspectionItem.js'
import sequelize from '../config/database.js'

migrateItems('产品', ProductInspectionItem as any, {
  dryRun: process.argv.includes('--dry-run'),
})
  .then(r => {
    console.log(`产品子表迁移耗时 ${r.durationMs}ms`)
    return sequelize.close()
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
