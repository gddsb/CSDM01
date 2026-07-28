import sequelize from './src/config/database.js'
import {
  Order, Supplier, Customer, Device, ProductionLine,
  Process, Material, User, InspectionStandard, InspectionStandardItem,
  ReportOrder, ReportProcess, LineProcess, DefectType,
  ProcessException, ProcessDefect, ProcessMaterial
} from './src/models/index.js'
import IncomingInspection from './src/models/IncomingInspection.js'
import IncomingInspectionItem from './src/models/IncomingInspectionItem.js'
import ProductInspection from './src/models/ProductInspection.js'
import ProductInspectionItem from './src/models/ProductInspectionItem.js'

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function pad(n, len = 2) { return String(n).padStart(len, '0') }

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

async function generateSuppliers() {
  console.log('\n=== 1. 生成供应商数据 ===')
  const count = await Supplier.count()
  if (count > 0) { console.log('供应商已存在:', count, '条，跳过'); return }

  const catNames = ['马口铁供应商', '铝盖供应商', '胶托供应商', '包装材料供应商', '辅料供应商', '设备配件供应商']
  const suppliers = []
  for (let i = 1; i <= 30; i++) {
    suppliers.push({
      supplier_code: 'S' + pad(i, 4),
      supplier_name: ['深圳市', '广州市', '东莞市', '佛山市', '中山市'][i % 5] +
        ['鑫源', '宏达', '盛达', '恒信', '瑞丰', '华兴', '金泰', '博远'][i % 8] +
        catNames[i % catNames.length],
      short_name: ['鑫源', '宏达', '盛达', '恒信', '瑞丰', '华兴'][i % 6],
      supplier_category: catNames[i % catNames.length],
      contact_person: ['张', '李', '王', '刘', '陈', '杨', '黄', '赵'][i % 8] +
        ['经理', '总', '主管', '先生', '女士'][i % 5],
      phone: '138' + pad(rand(10000000, 99999999), 8),
      email: 'supplier' + i + '@example.com',
      address: ['广东省深圳市宝安区', '广东省东莞市长安镇', '广东省佛山市顺德区'][i % 3] + '工业区' + i + '号',
      status: 1,
      credit_level: ['A级', 'B级', 'A级'][i % 3],
      tax_id: '91440300MA5' + pad(i, 6) + 'X',
      bank_account: '6222' + pad(i, 14),
      bank_name: ['中国银行', '工商银行', '建设银行', '招商银行'][i % 4] + '深圳分行',
      sort_order: i,
      created_by: 'seed',
      created_at: new Date(),
      updated_at: new Date()
    })
  }
  await Supplier.bulkCreate(suppliers)
  console.log('✅ 生成供应商:', suppliers.length, '条')
}

async function generateReportOrders() {
  console.log('\n=== 2. 生成生产报工单及子表数据 ===')
  const existing = await ReportOrder.count()
  if (existing > 0) { console.log('报工单已存在:', existing, '条，跳过'); return }

  const orders = await Order.findAll({ raw: true })
  const lines = await ProductionLine.findAll({ raw: true })
  const users = await User.findAll({ raw: true })
  const lineProcesses = await LineProcess.findAll({ raw: true })
  const defectTypes = await DefectType.findAll({ raw: true })
  const materials = await Material.findAll({ raw: true, limit: 50 })
  const devices = await Device.findAll({ raw: true })

  const opUsers = users.filter(u => u.role_id === 6 || u.username === 'op')
  const pmUsers = users.filter(u => u.role_id === 5 || u.username === 'pm')
  const maintUsers = users.filter(u => u.role_id === 8 || u.username === 'maint')

  const reportOrders = []
  const reportProcesses = []
  const processDefects = []
  const processExceptions = []
  const processMaterials = []

  let roId = 1

  const mayStart = new Date(2026, 4, 1)
  const julEnd = new Date(2026, 6, 31)

  for (const order of orders) {
    const line = pick(lines)
    const lineId = line.line_id
    const lineDevices = devices.filter(d => d.line_id === lineId || d.line_id == null)

    // 每个生产订单生成1-2个报工单
    const roCount = rand(1, 2)
    for (let r = 0; r < roCount; r++) {
      const reportUser = pick(opUsers)
      const finishUser = pick(pmUsers)

      const reportQty = Math.floor(order.planned_qty * (0.7 + Math.random() * 0.3))
      const reportDate = randomDate(mayStart, julEnd)
      const reportTime = new Date(reportDate.getTime() + r * 3600000 * 2)
      const finishTime = new Date(reportTime.getTime() + rand(2, 8) * 3600000)

      const ro = {
        report_order_id: roId,
        order_id: order.order_id,
        order_no: order.order_no,
        report_no: 'WO-16' + reportTime.getFullYear().toString().slice(2) +
          pad(reportTime.getMonth() + 1) + pad(reportTime.getDate()) + pad(roId, 3),
        line_id: lineId,
        line_name: line.line_name,
        material_id: order.material_id,
        material_code: order.material_code,
        material_name: order.material_name,
        specification: order.specification || '',
        report_qty: reportQty,
        report_time: reportTime,
        finish_time: finishTime,
        close_time: finishTime,
        status: 1,
        report_user_id: reportUser.user_id,
        report_user_name: reportUser.real_name || reportUser.username,
        finish_user_id: finishUser.user_id,
        finish_user_name: finishUser.real_name || finishUser.username,
        close_user_id: finishUser.user_id,
        close_user_name: finishUser.real_name || finishUser.username,
        remarks: '模拟生成报工单数据',
        created_at: reportTime,
        updated_at: finishTime
      }
      reportOrders.push(ro)

      // 生成报工工序
      const procs = lineProcesses.filter(lp => lp.line_id === lineId)
      for (const lp of procs) {
        const proc = await Process.findByPk(lp.process_id, { raw: true })
        if (!proc) continue

        reportProcesses.push({
          report_order_id: roId,
          process_id: proc.process_id,
          process_code: proc.process_code,
          process_name: proc.process_name,
          has_material: proc.process_code === 'WLD' || proc.process_code === 'BCT' ? 1 : 0,
          must_report: 1,
          sort_order: lp.sort_order,
          created_at: reportTime,
          updated_at: reportTime
        })

        // 随机生成工序不良（约30%概率）
        if (Math.random() < 0.3) {
          const defectCount = rand(1, 2)
          for (let d = 0; d < defectCount; d++) {
            const def = pick(defectTypes)
            processDefects.push({
              report_order_id: roId,
              process_id: proc.process_id,
              defect_type_id: def.defect_id,
              quantity: rand(1, 20),
              unit: '个',
              created_at: reportTime
            })
          }
        }

        // 随机生成工序物料（约40%概率）
        if (Math.random() < 0.4 && materials.length > 0) {
          const mat = pick(materials)
          processMaterials.push({
            report_order_id: roId,
            process_id: proc.process_id,
            material_type: mat.material_category || '辅料',
            bas_material_id: mat.material_id,
            material_batch: 'B' + pad(rand(1000, 9999)),
            package_no: 'P' + pad(rand(100, 999)),
            quantity: rand(10, 500),
            created_at: reportTime
          })
        }
      }

      // 随机生成异常工时（约20%概率）
      if (Math.random() < 0.2 && lineDevices.length > 0) {
        const excTypes = ['设备故障', '物料短缺', '质量异常', '人员短缺', '工艺问题']
        const device = pick(lineDevices)
        const confirmer = pick(maintUsers.length > 0 ? maintUsers : pmUsers)
        processExceptions.push({
          report_order_id: roId,
          exception_type: pick(excTypes),
          device_id: device.device_id,
          device_code: device.device_code,
          device_name: device.device_name,
          stop_type: pick(['计划停机', '非计划停机', '故障停机']),
          confirm_user: confirmer.username,
          confirm_user_name: confirmer.real_name || confirmer.username,
          start_time: new Date(reportTime.getTime() + rand(30, 120) * 60000),
          end_time: new Date(reportTime.getTime() + rand(120, 300) * 60000),
          duration: rand(30, 180) / 60,
          description: '模拟生成异常工时记录',
          record_user: reportUser.username,
          record_user_name: reportUser.real_name || reportUser.username,
          created_at: reportTime
        })
      }

      roId++
    }
  }

  await ReportOrder.bulkCreate(reportOrders)
  console.log('✅ 生成报工单:', reportOrders.length, '条')
  if (reportProcesses.length > 0) {
    await ReportProcess.bulkCreate(reportProcesses)
    console.log('✅ 生成报工工序:', reportProcesses.length, '条')
  }
  if (processDefects.length > 0) {
    await ProcessDefect.bulkCreate(processDefects)
    console.log('✅ 生成工序不良:', processDefects.length, '条')
  }
  if (processExceptions.length > 0) {
    await ProcessException.bulkCreate(processExceptions)
    console.log('✅ 生成异常工时:', processExceptions.length, '条')
  }
  if (processMaterials.length > 0) {
    await ProcessMaterial.bulkCreate(processMaterials)
    console.log('✅ 生成工序物料:', processMaterials.length, '条')
  }
}

async function generateIncomingInspections() {
  console.log('\n=== 3. 生成来料检验记录 ===')
  const existing = await IncomingInspection.count()
  if (existing > 0) { console.log('来料检验已存在:', existing, '条，跳过'); return }

  const suppliers = await Supplier.findAll({ raw: true })
  const materials = await Material.findAll({ raw: true })
  const users = await User.findAll({ raw: true })
  const qcUsers = users.filter(u => u.role_id === 4 || u.username === 'qc')
  const qmUsers = users.filter(u => u.role_id === 3 || u.username === 'qm')

  const inspections = []
  const items = []

  const mayStart = new Date(2026, 4, 1)
  const julEnd = new Date(2026, 6, 31)
  let inspId = 1

  for (const supplier of suppliers) {
    const count = rand(3, 8)
    for (let i = 0; i < count; i++) {
      const mat = pick(materials)
      const inspDate = randomDate(mayStart, julEnd)
      const inspector = pick(qcUsers)
      const reviewer = pick(qmUsers)
      const result = Math.random() < 0.85 ? '合格' : '不合格'

      const inspNo = 'LL' + inspDate.getFullYear().toString().slice(2) +
        pad(inspDate.getMonth() + 1) + pad(inspDate.getDate()) + pad(inspId, 4)

      inspections.push({
        inspection_id: inspId,
        inspection_no: inspNo,
        supplier_id: supplier.supplier_id,
        supplier_name: supplier.supplier_name,
        supplier_code: supplier.supplier_code,
        material_id: mat.material_id,
        material_code: mat.material_code,
        material_name: mat.material_name,
        specification: mat.specification || '',
        supplier_batch_no: 'B' + pad(rand(1000, 9999)),
        internal_batch_no: 'NB' + pad(rand(10000, 99999)),
        quantity: rand(100, 5000),
        arrival_date: new Date(inspDate.getTime() - 86400000),
        result: result,
        handle_type: result === '合格' ? '入库' : '退货',
        handle_reason: result === '合格' ? '' : '检验不合格，作退货处理',
        trigger_type: '手工',
        status: 3,
        inspector_id: inspector.user_id,
        inspector_name: inspector.real_name || inspector.username,
        reviewer_id: reviewer.user_id,
        reviewer_name: reviewer.real_name || reviewer.username,
        inspection_time: inspDate,
        review_time: new Date(inspDate.getTime() + 3600000),
        remarks: '模拟生成来料检验记录',
        created_at: inspDate,
        updated_at: inspDate
      })

      const itemCount = rand(3, 5)
      for (let j = 0; j < itemCount; j++) {
        const itemResult = Math.random() < 0.9 ? '合格' : '不合格'
        items.push({
          inspection_id: inspId,
          item_name: ['外观', '尺寸', '材质', '重量', '颜色', '包装', '标识'][j % 7],
          standard_value: '符合标准',
          actual_value: itemResult === '合格' ? '符合' : '不符合',
          result: itemResult,
          remark: '',
          sort_order: j,
          created_at: inspDate,
          updated_at: inspDate
        })
      }

      inspId++
    }
  }

  await IncomingInspection.bulkCreate(inspections)
  console.log('✅ 生成来料检验:', inspections.length, '条')
  if (items.length > 0) {
    await IncomingInspectionItem.bulkCreate(items)
    console.log('✅ 生成来料检验项:', items.length, '条')
  }
}

async function generateProductInspections() {
  console.log('\n=== 4. 生成产品检验记录（首件/制程/成品） ===')
  const existing = await ProductInspection.count()
  if (existing > 0) { console.log('产品检验已存在:', existing, '条，跳过'); return }

  const reportOrders = await ReportOrder.findAll({ raw: true })
  const standards = await InspectionStandard.findAll({ raw: true })
  const standardItems = await InspectionStandardItem.findAll({ raw: true })
  const users = await User.findAll({ raw: true })
  const qcUsers = users.filter(u => u.role_id === 4 || u.username === 'qc')
  const qmUsers = users.filter(u => u.role_id === 3 || u.username === 'qm')

  const itemsByStandard = {}
  for (const si of standardItems) {
    if (!itemsByStandard[si.standard_id]) itemsByStandard[si.standard_id] = []
    itemsByStandard[si.standard_id].push(si)
  }

  const inspections = []
  const items = []
  let inspId = 1

  const inspTypes = ['首件', '制程', '成品']

  for (const ro of reportOrders) {
    const count = rand(1, 3)
    const usedTypes = new Set()

    for (let i = 0; i < count; i++) {
      let type = pick(inspTypes)
      if (usedTypes.size < inspTypes.length) {
        while (usedTypes.has(type)) type = pick(inspTypes)
      }
      usedTypes.add(type)

      const standard = standards.find(s => s.inspection_type === type) || standards[0]
      const stdItems = itemsByStandard[standard?.standard_id] || []
      const finishTime = ro.finish_time ? new Date(ro.finish_time) : new Date(ro.report_time)
      const inspDate = new Date(finishTime.getTime() - rand(0, 120) * 60000)
      const inspector = pick(qcUsers)
      const reviewer = pick(qmUsers)
      const result = Math.random() < 0.88 ? '合格' : '不合格'

      const prefixMap = { '首件': 'SJ', '制程': 'ZC', '成品': 'CP', '其它': 'QT' }
      const inspNo = (prefixMap[type] || 'QT') + inspDate.getFullYear().toString().slice(2) +
        pad(inspDate.getMonth() + 1) + pad(inspDate.getDate()) + pad(inspId, 4)

      inspections.push({
        inspection_id: inspId,
        inspection_no: inspNo,
        inspection_type: type,
        report_order_id: ro.report_order_id,
        report_order_no: ro.report_no,
        material_id: ro.material_id,
        material_code: ro.material_code,
        material_name: ro.material_name,
        specification: ro.specification || '',
        standard_id: standard?.standard_id || null,
        standard_name: standard?.standard_name || '',
        result: result,
        trigger_type: '手工',
        status: 3,
        inspector_id: inspector.user_id,
        inspector_name: inspector.real_name || inspector.username,
        reviewer_id: reviewer.user_id,
        reviewer_name: reviewer.real_name || reviewer.username,
        inspection_time: inspDate,
        review_time: new Date(inspDate.getTime() + rand(30, 120) * 60000),
        remarks: '模拟生成' + type + '检验记录',
        created_at: inspDate,
        updated_at: inspDate
      })

      for (let j = 0; j < stdItems.length; j++) {
        const si = stdItems[j]
        const itemResult = Math.random() < 0.92 ? '合格' : '不合格'
        const actualValue = itemResult === '合格'
          ? (si.unit ? si.standard_value : '符合')
          : (si.unit ? si.standard_value + '（超标）' : '不符合')
        items.push({
          inspection_id: inspId,
          item_name: si.item_name,
          category: si.category || '',
          standard_value: si.standard_value || '',
          actual_value: actualValue,
          result: itemResult,
          remarks: itemResult === '合格' ? '' : '需返工处理',
          sort_order: si.sort_order || j,
          inspector_id: inspector.user_id,
          inspector_name: inspector.real_name || inspector.username,
          inspection_time: inspDate,
          created_at: inspDate,
          updated_at: inspDate
        })
      }

      inspId++
    }
  }

  await ProductInspection.bulkCreate(inspections)
  console.log('✅ 生成产品检验:', inspections.length, '条')
  if (items.length > 0) {
    await ProductInspectionItem.bulkCreate(items)
    console.log('✅ 生成产品检验项:', items.length, '条')
  }
}

async function main() {
  console.log('🚀 开始生成模拟数据...')
  const startTime = Date.now()

  try {
    await generateSuppliers()
    await generateReportOrders()
    await generateIncomingInspections()
    await generateProductInspections()

    console.log('\n🎉 所有模拟数据生成完成！')
    console.log('耗时:', ((Date.now() - startTime) / 1000).toFixed(2), '秒')
  } catch (err) {
    console.error('❌ 生成失败:', err.message)
    console.error(err.stack)
  } finally {
    await sequelize.close()
  }
}

main()
