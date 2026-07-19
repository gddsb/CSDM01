import sequelize from './config/database.js'
import {
  ReportImage,
  ProcessMaterial,
  ProcessDefect,
  ProcessException,
  ManpowerRecord,
  ReportProcess,
  ReportOrder,
} from './models/index.js'

// 清除生产业务数据（保留基础数据和订单）
// 按外键依赖顺序清除：先子表后主表
const tables = [
  { name: '报工图片记录 (production_report_image)', model: ReportImage },
  { name: '制程物料记录 (production_process_material)', model: ProcessMaterial },
  { name: '工序不良记录 (production_process_defect)', model: ProcessDefect },
  { name: '异常工时记录 (production_process_exception)', model: ProcessException },
  { name: '人员投入记录 (production_manpower_record)', model: ManpowerRecord },
  { name: '报工工序记录 (production_report_process)', model: ReportProcess },
  { name: '生产报工单 (production_report_order)', model: ReportOrder },
  // 保留生产订单数据，仅清除报工相关数据
  // { name: '生产订单 (production_order)', model: Order },
]

async function clearProductionData() {
  console.log('\n🧹 开始清除生产数据...\n')

  for (const table of tables) {
    try {
      const count = await table.model.count()
      await table.model.destroy({ where: {}, truncate: false })
      console.log(`  ✅ ${table.name}: 已清除 ${count} 条记录`)
    } catch (err) {
      console.log(`  ❌ ${table.name}: 清除失败 - ${err.message}`)
    }
  }

  console.log('\n🎉 生产数据清除完成！\n')
  await sequelize.close()
}

clearProductionData().catch(err => {
  console.error('清除数据出错:', err)
  process.exit(1)
})
