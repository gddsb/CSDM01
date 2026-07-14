import sequelize from './config/database.js'
import {
  ProcessException,
  ManpowerRecord,
  ProcessReport,
  WorkOrder,
  Order,
} from './models/index.js'

const tables = [
  { name: '异常工时记录 (production_process_exception)', model: ProcessException },
  { name: '人员投入记录 (production_manpower_record)', model: ManpowerRecord },
  { name: '工序报工记录 (production_process_report)', model: ProcessReport },
  { name: '生产工单 (production_work_order)', model: WorkOrder },
  { name: '生产订单 (production_order)', model: Order },
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
