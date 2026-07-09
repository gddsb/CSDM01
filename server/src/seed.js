import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  User, Role, Permission, OperationLog, Material,
  ProductionLine, Process, Device, DefectType,
  Order, WorkOrder, ProcessReport,
  ManpowerRecord, ExceptionRecord, SystemConfig,
  RolePermission, Sequence, Customer,
  LineProcess, LineDevice, NumberRule, DefectImage,
  DictType, DictData, ProcessDefect, ProcessException,
  ProcessMaterial, AppVersion, DataDictionary,
} from './models/index.js'
import sequelize from './config/database.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const seedDataDir = path.join(__dirname, 'seed-data')

const seedOrder = [
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
  { name: 'ExceptionRecord', model: ExceptionRecord, label: '工时记录' },
  { name: 'SystemConfig', model: SystemConfig, label: '系统配置' },
  { name: 'Sequence', model: Sequence, label: '序列号' },
  { name: 'NumberRule', model: NumberRule, label: '编码规则' },
  { name: 'AppVersion', model: AppVersion, label: '应用版本' },
  { name: 'DataDictionary', model: DataDictionary, label: '数据字典' },
  { name: 'OperationLog', model: OperationLog, label: '操作日志' },
]

function loadSeedData(name) {
  const filePath = path.join(seedDataDir, `${name}.json`)
  if (!fs.existsSync(filePath)) {
    return []
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(content)
  } catch (err) {
    console.log(`    ⚠️  读取 ${name}.json 失败: ${err.message}`)
    return []
  }
}

async function seed() {
  try {
    console.log('🔄 开始同步数据库表（force: true）...')
    await sequelize.sync({ force: true })
    console.log('✅ 数据库表同步完成\n')

    const counts = {}

    for (const { name, model, label } of seedOrder) {
      const data = loadSeedData(name)
      if (data.length === 0) {
        console.log(`📌 ${label}... 无数据，跳过`)
        counts[name] = 0
        continue
      }

      console.log(`📌 ${label}...`)
      try {
        await model.bulkCreate(data, { validate: false })
        console.log(`✅ ${label}创建完成（${data.length}条）`)
        counts[name] = data.length
      } catch (err) {
        console.log(`❌ ${label}创建失败: ${err.message}`)
        console.log(`   尝试逐条插入...`)
        let success = 0
        for (const item of data) {
          try {
            await model.create(item, { validate: false })
            success++
          } catch (itemErr) {
            console.log(`   ⚠️  跳过一条数据: ${itemErr.message}`)
          }
        }
        console.log(`✅ ${label}创建完成（${success}/${data.length}条）`)
        counts[name] = success
      }
    }

    console.log('\n🎉 种子数据初始化完成！')
    for (const { name, label } of seedOrder) {
      if (counts[name] > 0) {
        console.log(`   - ${label}：${counts[name]} 条`)
      }
    }
    console.log(`\n   默认登录账号：admin / 123456`)

    await sequelize.close()
    process.exit(0)
  } catch (err) {
    console.error('❌ 种子数据初始化失败:', err)
    try {
      await sequelize.close()
    } catch (_) {
    }
    process.exit(1)
  }
}

seed()
