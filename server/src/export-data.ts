import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sequelize from './config/database.js'
import {
  User, Role, Permission, OperationLog, Material,
  ProductionLine, Process, Device, DefectType,
  Order, ReportOrder, ReportProcess, ReportImage,
  ManpowerRecord, SystemConfig,
  RolePermission, Sequence, Customer,
  LineProcess, LineDevice, NumberRule, DefectImage,
  DictType, DictData,
} from './models/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const models = [
  { name: 'Role', model: Role },
  { name: 'User', model: User },
  { name: 'Permission', model: Permission },
  { name: 'RolePermission', model: RolePermission },
  { name: 'Process', model: Process },
  { name: 'Customer', model: Customer },
  { name: 'Material', model: Material },
  { name: 'ProductionLine', model: ProductionLine },
  { name: 'Device', model: Device },
  { name: 'LineProcess', model: LineProcess },
  { name: 'LineDevice', model: LineDevice },
  { name: 'DefectType', model: DefectType },
  { name: 'DefectImage', model: DefectImage },
  { name: 'DictType', model: DictType },
  { name: 'DictData', model: DictData },
  { name: 'Order', model: Order },
  { name: 'ReportOrder', model: ReportOrder },
  { name: 'ReportProcess', model: ReportProcess },
  { name: 'ManpowerRecord', model: ManpowerRecord },
  { name: 'ReportImage', model: ReportImage },
  { name: 'SystemConfig', model: SystemConfig },
  { name: 'Sequence', model: Sequence },
  { name: 'NumberRule', model: NumberRule },
  { name: 'OperationLog', model: OperationLog },
]

function cleanData(data) {
  return data.map(item => {
    const cleaned = { ...item }
    delete cleaned.created_at
    delete cleaned.updated_at
    return cleaned
  })
}

async function exportData() {
  console.log('📦 开始导出数据库数据...\n')

  const outputDir = path.join(__dirname, 'seed-data')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const summary = {}

  for (const { name, model } of models) {
    try {
      const records = await model.findAll({ raw: true })
      const cleaned = cleanData(records)
      const filePath = path.join(outputDir, `${name}.json`)
      fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2), 'utf-8')
      console.log(`  ✅ ${name}: ${records.length} 条 → ${name}.json`)
      summary[name] = records.length
    } catch (err) {
      console.log(`  ❌ ${name}: 导出失败 - ${err.message}`)
      summary[name] = 0
    }
  }

  const summaryPath = path.join(outputDir, '_summary.json')
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8')

  console.log('\n🎉 数据导出完成！')
  console.log(`   输出目录: ${outputDir}`)
  console.log(`   数据表总数: ${models.length}`)
  console.log(`   总记录数: ${Object.values(summary).reduce((a, b) => a + b, 0)}`)
}

async function main() {
  try {
    await sequelize.authenticate()
    console.log('✅ 数据库连接成功')
    await exportData()
  } catch (err) {
    console.error('❌ 导出失败:', err.message)
    process.exit(1)
  } finally {
    await sequelize.close()
  }
}

main()
