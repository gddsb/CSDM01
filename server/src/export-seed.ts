import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  User, Role, Permission, OperationLog, Material,
  ProductionLine, Process, Device, DefectType,
  Order, WorkOrder, ProcessReport,
  ManpowerRecord, SystemConfig,
  RolePermission, Sequence, Customer,
  LineProcess, LineDevice, NumberRule, DefectImage,
  DictType, DictData, ProcessDefect, ProcessException,
  ProcessMaterial, DataDictionary,
} from './models/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const seedDataDir = path.join(__dirname, 'seed-data')

const exportOrder = [
  { name: 'Role', model: Role, label: '角色' },
  { name: 'Permission', model: Permission, label: '权限' },
  { name: 'RolePermission', model: RolePermission, label: '角色权限' },
  { name: 'User', model: User, label: '用户' },
  { name: 'Process', model: Process, label: '工序' },
  { name: 'Customer', model: Customer, label: '客户档案' },
  { name: 'Material', model: Material, label: '料品档案' },
  { name: 'ProductionLine', model: ProductionLine, label: '产线' },
  { name: 'Device', model: Device, label: '设备' },
  { name: 'LineProcess', model: LineProcess, label: '产线工序' },
  { name: 'LineDevice', model: LineDevice, label: '产线设备' },
  { name: 'DefectType', model: DefectType, label: '不良分类' },
  { name: 'DefectImage', model: DefectImage, label: '不良图片' },
  { name: 'DictType', model: DictType, label: '字典类型' },
  { name: 'DictData', model: DictData, label: '字典数据' },
  { name: 'Order', model: Order, label: '生产订单' },
  { name: 'WorkOrder', model: WorkOrder, label: '生产工单' },
  { name: 'ProcessReport', model: ProcessReport, label: '工序报工' },
  { name: 'ProcessDefect', model: ProcessDefect, label: '工序不良' },
  { name: 'ProcessMaterial', model: ProcessMaterial, label: '工序物料' },
  { name: 'ProcessException', model: ProcessException, label: '工序异常工时' },
  { name: 'ManpowerRecord', model: ManpowerRecord, label: '人员投入' },
  { name: 'SystemConfig', model: SystemConfig, label: '系统配置' },
  { name: 'Sequence', model: Sequence, label: '序列号' },
  { name: 'NumberRule', model: NumberRule, label: '编码规则' },
  { name: 'DataDictionary', model: DataDictionary, label: '数据字典' },
  { name: 'OperationLog', model: OperationLog, label: '操作日志' },
]

async function exportAll() {
  try {
    console.log('📦 开始导出种子数据...\n')
    const summary = {}
    let total = 0

    for (const { name, model, label } of exportOrder) {
      try {
        const pk = model.primaryKeyAttribute
        const rows = await model.findAll({ raw: true, order: [[pk, 'ASC']] })
        const count = rows.length
        summary[label] = count
        total += count

        const filePath = path.join(seedDataDir, `${name}.json`)
        fs.writeFileSync(filePath, JSON.stringify(rows, null, 2))
        console.log(`✅ ${label}（${count} 条）→ ${name}.json`)
      } catch (err) {
        console.log(`❌ ${label} 导出失败: ${err.message}`)
      }
    }

    const summaryPath = path.join(seedDataDir, '_summary.json')
    fs.writeFileSync(summaryPath, JSON.stringify({
      export_time: new Date().toISOString(),
      total_records: total,
      tables: summary,
    }, null, 2))

    console.log(`\n🎉 导出完成！共 ${exportOrder.length} 张表，${total} 条记录`)
    console.log(`   输出目录：${seedDataDir}`)
    process.exit(0)
  } catch (err) {
    console.error('❌ 导出失败:', err)
    process.exit(1)
  }
}

exportAll()
