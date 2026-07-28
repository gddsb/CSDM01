// 生成前端 mock 数据（基于数据库真实数据）
import sequelize from './src/config/database.js'
import {
  Supplier, Customer, Device, ProductionLine, ReportOrder, Material
} from './src/models/index.js'

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function pad(n, len = 2) { return String(n).padStart(len, '0') }

function fmtDate(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
}

function fmtDateOnly(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

async function main() {
  const mayStart = new Date(2026, 4, 1)
  const julEnd = new Date(2026, 6, 31)

  const suppliers = await Supplier.findAll({ raw: true })
  const customers = await Customer.findAll({ raw: true })
  const devices = await Device.findAll({ raw: true })
  const lines = await ProductionLine.findAll({ raw: true })
  const reportOrders = await ReportOrder.findAll({ raw: true })
  const materials = await Material.findAll({ raw: true, limit: 30 })

  console.log('// === 基于真实数据生成的模拟数据 ===')
  console.log('')

  // ========== 微生物检验 ==========
  console.log('// 微生物检验（5~7月，基于真实报工单）')
  console.log('export const microbeInspections = [')
  let mbId = 1
  for (const ro of reportOrders.slice(0, 15)) {
    const inspDate = new Date(ro.report_time || ro.created_at)
    const types = ['正常', '复检']
    const objs = ['成品', '半成品']
    const results = Math.random() < 0.95 ? '合格' : '不合格'
    console.log(`  { inspection_id: 'mb${mbId}', inspection_no: 'MB${inspDate.getFullYear()}${pad(inspDate.getMonth()+1)}${pad(inspDate.getDate())}${pad(mbId,3)}', inspection_type: '${pick(types)}', object_type: '${pick(objs)}', report_order_id: ${ro.report_order_id}, report_order_no: '${ro.report_no}', standard_id: 1, result: '${results}', inspector_id: 4, inspector_name: '质量检验员', inspection_time: '${fmtDate(inspDate)}', status: '已完成' },`)
    mbId++
  }
  console.log(']')
  console.log('')

  // ========== 环境检验 ==========
  console.log('// 环境检验（5~7月，更衣室/车间/产线三个区域）')
  console.log('export const envInspections = [')
  const areas = [
    { id: 'g1', name: '更衣室' },
    { id: 'c1', name: '一号车间' },
    { id: 'l1', name: 'A线' },
    { id: 'l2', name: 'B线' }
  ]
  let evId = 1
  for (let m = 5; m <= 7; m++) {
    for (const area of areas) {
      const inspDate = new Date(2026, m - 1, rand(1, 28))
      const result = Math.random() < 0.9 ? '合格' : '不合格'
      const correction = result === '不合格' ? '增加消毒频次，重新清洁后复查' : null
      const recheckDate = result === '不合格' ? `'2026-${pad(m)}-${pad(rand(inspDate.getDate()+1, 28))}'` : null
      console.log(`  { inspection_id: 'ev${evId}', inspection_no: 'ENV${inspDate.getFullYear()}${pad(inspDate.getMonth()+1)}${pad(inspDate.getDate())}${pad(evId,3)}', area_id: '${area.id}', area_name: '${area.name}', trigger_type: '${pick(['自动','手工'])}', result: '${result}', correction_action: ${correction ? `'${correction}'` : null}, recheck_date: ${recheckDate}, recheck_result: ${result === '不合格' ? "'合格'" : null}, inspector_id: 4, inspector_name: '质量检验员', inspection_date: '${fmtDateOnly(inspDate)}', status: '已完成' },`)
      evId++
    }
  }
  console.log(']')
  console.log('')

  // ========== 客户投诉 ==========
  console.log('// 客户投诉（基于真实客户，5~7月）')
  console.log('export const complaints = [')
  const complaintTypes = ['外观缺陷', '密封性', '尺寸偏差', '印刷质量', '包装破损', '重量不足']
  const sources = ['经营部', '客户直接', '销售部', '售后服务']
  const methods = ['电话', '邮件', '微信', '传真']
  let cpId = 1
  for (let i = 0; i < 12; i++) {
    const customer = pick(customers)
    const mat = pick(materials)
    const inspDate = randomDate(mayStart, julEnd)
    const statuses = ['已关闭', '处理中', '已登记', '已回复']
    const type = pick(complaintTypes)
    console.log(`  { complaint_id: 'cp${cpId}', complaint_no: 'CS${inspDate.getFullYear().toString().slice(2)}${pad(inspDate.getMonth()+1)}${pad(inspDate.getDate())}${pad(cpId,3)}', source: '${pick(sources)}', customer_id: ${customer.customer_id}, customer_name: '${customer.customer_name}', contact_person: '${pick(['张经理','李工','王主管','刘总','陈工'])}', material_id: '${mat.material_id}', material_name: '${mat.material_name}', batch_no: 'BATCH${rand(10000,99999)}', complaint_type: '${type}', complaint_desc: '客户反馈${type}问题，需调查处理', complaint_time: '${fmtDate(inspDate)}', complaint_method: '${pick(methods)}', require_reply: ${rand(0,1)}, reply_deadline: '2026-${pad(inspDate.getMonth()+1)}-${pad(Math.min(inspDate.getDate()+7,28))}', handle_direction: '${pick(['介入处理','仅调查分析','直接回复'])}', status: '${pick(statuses)}', registered_by: 'u4', registered_by_name: '质量管理员' },`)
    cpId++
  }
  console.log(']')
  console.log('')

  // ========== 供应商投诉 ==========
  console.log('// 供应商投诉（基于真实供应商，5~7月）')
  console.log('export const supplierComplaints = [')
  const supCompTypes = ['材料质量', '交货延迟', '数量不符', '包装问题', '单据问题']
  let scId = 1
  for (let i = 0; i < 10; i++) {
    const supplier = pick(suppliers)
    const inspDate = randomDate(mayStart, julEnd)
    const type = pick(supCompTypes)
    console.log(`  { complaint_id: 'sc${scId}', complaint_no: 'SC${inspDate.getFullYear().toString().slice(2)}${pad(inspDate.getMonth()+1)}${pad(inspDate.getDate())}${pad(scId,3)}', supplier_id: ${supplier.supplier_id}, supplier_code: '${supplier.supplier_code}', supplier_name: '${supplier.supplier_name}', complaint_type: '${type}', complaint_reason: '${type}问题，已通知供应商', complaint_date: '${fmtDateOnly(inspDate)}', reply_content: ${i % 3 === 0 ? "'已收到，正在调查处理'" : null}, reply_date: ${i % 3 === 0 ? `'2026-${pad(inspDate.getMonth()+1)}-${pad(Math.min(inspDate.getDate()+3,28))}'` : null}, status: '${pick(['已发出','已回复','处理中'])}', created_by: 'u4', created_by_name: '质量管理员' },`)
    scId++
  }
  console.log(']')
  console.log('')

  // ========== 设备点检记录 ==========
  console.log('// 设备点检记录（基于真实设备，5~7月）')
  console.log('export const deviceCheckRecords = [')
  const checkTypes = ['日常点检', '周点检', '月度点检']
  const checkStatuses = ['正常', '异常', '待维修']
  let dcId = 1
  for (const dev of devices.slice(0, 15)) {
    for (let m = 5; m <= 7; m++) {
      const inspDate = new Date(2026, m - 1, rand(1, 28))
      const status = Math.random() < 0.85 ? '正常' : (Math.random() < 0.5 ? '异常' : '待维修')
      console.log(`  { check_id: 'dc${dcId}', check_no: 'DC${inspDate.getFullYear()}${pad(inspDate.getMonth()+1)}${pad(inspDate.getDate())}${pad(dcId,3)}', device_id: ${dev.device_id}, device_code: '${dev.device_code}', device_name: '${dev.device_name}', check_type: '${pick(checkTypes)}', check_date: '${fmtDateOnly(inspDate)}', status: '${status}', abnormal_desc: ${status !== '正常' ? `'设备${status}，需处理'` : null}, checker_id: 8, checker_name: '设备维护员', remark: '' },`)
      dcId++
    }
  }
  console.log(']')
  console.log('')

  // ========== 设备维保记录 ==========
  console.log('// 设备维保记录（基于真实设备，5~7月）')
  console.log('export const deviceMaintenanceRecords = [')
  const maintTypes = ['预防性维护', '故障维修', '定期保养', '零部件更换']
  const maintStatuses = ['已完成', '进行中', '待配件']
  let dmId = 1
  for (const dev of devices.slice(0, 12)) {
    for (let m = 5; m <= 7; m++) {
      if (Math.random() < 0.6) {
        const inspDate = new Date(2026, m - 1, rand(1, 28))
        const type = pick(maintTypes)
        const status = pick(maintStatuses)
        console.log(`  { maintenance_id: 'dm${dmId}', maintenance_no: 'DM${inspDate.getFullYear()}${pad(inspDate.getMonth()+1)}${pad(inspDate.getDate())}${pad(dmId,3)}', device_id: ${dev.device_id}, device_code: '${dev.device_code}', device_name: '${dev.device_name}', maintenance_type: '${type}', maintenance_date: '${fmtDateOnly(inspDate)}', content: '${type}：检查设备运行状态，清洁润滑', cost: ${rand(100, 5000)}, status: '${status}', operator_id: 8, operator_name: '设备维护员', remark: '' },`)
        dmId++
      }
    }
  }
  console.log(']')
  console.log('')

  // ========== 设备OEE ==========
  console.log('// 设备OEE（基于真实设备，5~7月）')
  console.log('export const deviceOEE = [')
  let oeeId = 1
  for (const dev of devices.slice(0, 15)) {
    for (let m = 5; m <= 7; m++) {
      for (let w = 1; w <= 4; w++) {
        const availability = (85 + Math.random() * 15).toFixed(2)
        const performance = (80 + Math.random() * 18).toFixed(2)
        const quality = (95 + Math.random() * 5).toFixed(2)
        const oee = (availability * performance * quality / 10000).toFixed(2)
        const weekDate = new Date(2026, m - 1, w * 7 - 6)
        console.log(`  { oee_id: 'oee${oeeId}', device_id: ${dev.device_id}, device_code: '${dev.device_code}', device_name: '${dev.device_name}', period: '周', period_start: '${fmtDateOnly(weekDate)}', period_end: '${fmtDateOnly(new Date(weekDate.getTime()+6*86400000))}', planned_runtime: ${rand(40, 48)}, actual_runtime: ${rand(34, 46)}, availability: ${availability}, performance: ${performance}, quality: ${quality}, oee: ${oee}, output_qty: ${rand(5000, 30000)}, defect_qty: ${rand(10, 200)} },`)
        oeeId++
      }
    }
  }
  console.log(']')

  await sequelize.close()
}

main()
