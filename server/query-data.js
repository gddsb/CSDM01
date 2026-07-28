import sequelize from './src/config/database.js'
import {
  Order, Supplier, Customer, Device, ProductionLine,
  Process, Material, User, Role, InspectionStandard,
  ReportOrder, LineProcess, LineDevice, DefectType
} from './src/models/index.js'

async function query() {
  try {
    console.log('=== 生产订单 ===')
    const orders = await Order.findAll({ raw: true, limit: 30 })
    console.log('总数:', orders.length)
    orders.forEach(o => console.log(
      '  ID:', o.order_id,
      'No:', o.order_no,
      '料号:', o.material_code,
      '料名:', o.material_name,
      '数量:', o.planned_qty,
      '状态:', o.status
    ))

    console.log('\n=== 供应商 ===')
    const suppliers = await Supplier.findAll({ raw: true })
    console.log('总数:', suppliers.length)
    suppliers.forEach(s => console.log(
      '  ID:', s.supplier_id,
      'Code:', s.supplier_code,
      'Name:', s.supplier_name,
      'Cat:', s.supplier_category
    ))

    console.log('\n=== 客户 ===')
    const customers = await Customer.findAll({ raw: true })
    console.log('总数:', customers.length)
    customers.forEach(c => console.log(
      '  ID:', c.customer_id,
      'Code:', c.customer_code,
      'Name:', c.customer_name
    ))

    console.log('\n=== 设备 ===')
    const devices = await Device.findAll({ raw: true })
    console.log('总数:', devices.length)
    devices.forEach(d => console.log(
      '  ID:', d.device_id,
      'Code:', d.device_code,
      'Name:', d.device_name,
      'Type:', d.device_type,
      'LineID:', d.line_id
    ))

    console.log('\n=== 产线 ===')
    const lines = await ProductionLine.findAll({ raw: true })
    console.log('总数:', lines.length)
    lines.forEach(l => console.log(
      '  ID:', l.line_id,
      'Code:', l.line_code,
      'Name:', l.line_name
    ))

    console.log('\n=== 工序 ===')
    const processes = await Process.findAll({ raw: true })
    console.log('总数:', processes.length)
    processes.forEach(p => console.log(
      '  ID:', p.process_id,
      'Code:', p.process_code,
      'Name:', p.process_name
    ))

    console.log('\n=== 料品 ===')
    const materials = await Material.findAll({ raw: true })
    console.log('总数:', materials.length)
    materials.forEach(m => console.log(
      '  ID:', m.material_id,
      'Code:', m.material_code,
      'Name:', m.material_name
    ))

    console.log('\n=== 检验标准 ===')
    const standards = await InspectionStandard.findAll({ raw: true })
    console.log('总数:', standards.length)
    standards.forEach(s => console.log(
      '  ID:', s.standard_id,
      'No:', s.standard_no,
      'Name:', s.standard_name,
      'Type:', s.inspection_type
    ))

    console.log('\n=== 用户 ===')
    const users = await User.findAll({ raw: true })
    console.log('总数:', users.length)
    users.forEach(u => console.log(
      '  ID:', u.user_id,
      'User:', u.username,
      'Name:', u.real_name,
      'RoleID:', u.role_id
    ))

    console.log('\n=== 已有报工单 ===')
    const ros = await ReportOrder.findAll({ raw: true })
    console.log('总数:', ros.length)
    ros.forEach(r => console.log(
      '  ID:', r.report_order_id,
      'No:', r.report_no,
      'OrderID:', r.order_id,
      'LineID:', r.line_id,
      'Qty:', r.report_qty,
      'Status:', r.status
    ))

    console.log('\n=== 产线工序关联 ===')
    const lps = await LineProcess.findAll({ raw: true })
    console.log('总数:', lps.length)
    lps.forEach(l => console.log(
      '  LineID:', l.line_id,
      'ProcessID:', l.process_id,
      'Sort:', l.sort_order
    ))

    console.log('\n=== 不良类型 ===')
    const defects = await DefectType.findAll({ raw: true })
    console.log('总数:', defects.length)
    defects.forEach(d => console.log(
      '  ID:', d.defect_id,
      'Code:', d.defect_code,
      'Name:', d.defect_name,
      'Cat:', d.category_name,
      'Type:', d.defect_type
    ))

    await sequelize.close()
  } catch (err) {
    console.error('Error:', err.message)
    console.error(err.stack)
    await sequelize.close()
  }
}
query()
