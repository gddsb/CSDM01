import {
  User, Role, Process, Material, ProductionLine, Device,
  DefectType, Order, WorkOrder, ProcessReport,
  ManpowerRecord, ExceptionRecord,
} from './models/index.js'
import sequelize from './config/database.js'
import bcrypt from 'bcryptjs'

/**
 * 数据库初始化种子数据
 * 同步数据库表并写入基础数据（角色、用户、工序、料品、产线、设备、不良分类、订单、工单、报工、人员、异常）
 *
 * 说明：
 * - 所有主键为 INTEGER 自增，此处通过显式整数 ID 写入以便维护外键关联
 * - status 字段为 TINYINT：1=启用/运行/已下达/开工，0=待机/待下达/开立，2=维护中/故障/已关闭/完工/试产，3=关闭
 * - created_by / report_user / record_user / line_leader / responsible_person 为 STRING，存储用户名
 */
async function seed() {
  try {
    console.log('🔄 开始同步数据库表（force: true）...')
    await sequelize.sync({ force: true })
    console.log('✅ 数据库表同步完成')

    // 统一密码加密
    const password = bcrypt.hashSync('123456', 10)

    // 1. 创建角色（9个）
    console.log('📌 创建角色...')
    await Role.bulkCreate([
      { role_id: 1, role_name: '超级管理员', role_code: 'SUPER_ADMIN', type: '系统默认', scope: '系统全部权限，用户管理，系统配置', sort_order: 1, status: 1 },
      { role_id: 2, role_name: '计划员', role_code: 'PLANNER', type: '系统默认', scope: '生产计划制定、下达、调整，计划进度查看', sort_order: 2, status: 1 },
      { role_id: 3, role_name: '质量管理员', role_code: 'QC_MANAGER', type: '系统默认', scope: '质量标准制定，质量抽检审批，不合格品处置', sort_order: 3, status: 1 },
      { role_id: 4, role_name: '质量检验员', role_code: 'QC_INSPECTOR', type: '系统默认', scope: '质量检测执行，检测数据录入，异常上报', sort_order: 4, status: 1 },
      { role_id: 5, role_name: '生产管理', role_code: 'PROD_MANAGER', type: '系统默认', scope: '生产任务管理，生产调度，人员管理，报表审批', sort_order: 5, status: 1 },
      { role_id: 6, role_name: '工序操作人', role_code: 'OPERATOR', type: '系统默认', scope: '本工序生产操作，数据录入，设备点检', sort_order: 6, status: 1 },
      { role_id: 7, role_name: '系统管理员', role_code: 'ADMIN', type: '可选', scope: '日常系统管理（权限低于超级管理员）', sort_order: 7, status: 1 },
      { role_id: 8, role_name: '设备维护员', role_code: 'MAINTENANCE', type: '可选', scope: '设备维修，保养记录', sort_order: 8, status: 1 },
      { role_id: 9, role_name: '看板查看者', role_code: 'DASHBOARD_VIEWER', type: '可选', scope: '大屏/看板只读查看', sort_order: 9, status: 1 },
    ])
    console.log('✅ 角色创建完成（9条）')

    // 2. 创建用户（9个）
    console.log('📌 创建用户...')
    await User.bulkCreate([
      { user_id: 1, username: 'admin', password, real_name: '超级管理员', employee_no: 'EMP001', department: '系统管理部', role_id: 1, phone: '13800000001', email: 'admin@milk.com', status: 1, last_login_time: '2026-06-30 08:30:00' },
      { user_id: 2, username: 'sysadmin', password, real_name: '系统管理员', employee_no: 'EMP002', department: '信息部', role_id: 7, phone: '13800000002', email: 'it@milk.com', status: 1, last_login_time: '2026-06-29 17:20:00' },
      { user_id: 3, username: 'planner', password, real_name: '计划员', employee_no: 'EMP003', department: '生产计划部', role_id: 2, phone: '13800000003', email: 'plan@milk.com', status: 1, last_login_time: '2026-06-30 09:00:00' },
      { user_id: 4, username: 'qm', password, real_name: '质量管理员', employee_no: 'EMP004', department: '质量管理部', role_id: 3, phone: '13800000004', email: 'qc@milk.com', status: 1, last_login_time: '2026-06-30 08:45:00' },
      { user_id: 5, username: 'qc', password, real_name: '质量检验员', employee_no: 'EMP005', department: '质量管理部', role_id: 4, phone: '13800000005', email: 'qci@milk.com', status: 1, last_login_time: '2026-06-30 07:50:00' },
      { user_id: 6, username: 'pm', password, real_name: '生产管理', employee_no: 'EMP006', department: '生产部', role_id: 5, phone: '13800000006', email: 'prod@milk.com', status: 1, last_login_time: '2026-06-30 08:00:00' },
      { user_id: 7, username: 'op', password, real_name: '工序操作人', employee_no: 'EMP007', department: '生产部', role_id: 6, phone: '13800000007', email: 'op@milk.com', status: 1, last_login_time: '2026-06-30 07:30:00' },
      { user_id: 8, username: 'maint', password, real_name: '设备维护员', employee_no: 'EMP008', department: '设备部', role_id: 8, phone: '13800000008', email: 'maint@milk.com', status: 1, last_login_time: '2026-06-29 16:00:00' },
      { user_id: 9, username: 'viewer', password, real_name: '看板查看者', employee_no: 'EMP009', department: '综合管理部', role_id: 9, phone: '13800000009', email: 'view@milk.com', status: 1, last_login_time: '2026-06-28 10:00:00' },
    ])
    console.log('✅ 用户创建完成（9条）')

    // 3. 创建工序（11道）
    console.log('📌 创建工序...')
    await Process.bulkCreate([
      { process_id: 1, process_code: 'P-01', process_name: '裁剪下料', sort_order: 1, status: 1 },
      { process_id: 2, process_code: 'P-02', process_name: '小料检测', sort_order: 2, status: 1 },
      { process_id: 3, process_code: 'P-03', process_name: '成圆焊接', sort_order: 3, status: 1 },
      { process_id: 4, process_code: 'P-04', process_name: '补涂烘干', sort_order: 4, status: 1 },
      { process_id: 5, process_code: 'P-05', process_name: '倒罐检测', sort_order: 5, status: 1 },
      { process_id: 6, process_code: 'P-06', process_name: '翻边封口', sort_order: 6, status: 1 },
      { process_id: 7, process_code: 'P-07', process_name: '正压测漏', sort_order: 7, status: 1 },
      { process_id: 8, process_code: 'P-08', process_name: '在线光检测', sort_order: 8, status: 1 },
      { process_id: 9, process_code: 'P-09', process_name: '人工全检', sort_order: 9, status: 1 },
      { process_id: 10, process_code: 'P-10', process_name: '码垛包装', sort_order: 10, status: 1 },
      { process_id: 11, process_code: 'P-11', process_name: '成品检验', sort_order: 11, status: 1 },
    ])
    console.log('✅ 工序创建完成（11条）')

    // 4. 创建料品（5个）
    console.log('📌 创建料品...')
    const ml900 = await Material.create({ material_code: 'ML-900-A', material_name: '900g奶粉罐', specification: '900g奶粉罐', category_name: '成品罐', unit_name: '个', film_no: 'A312-012-0001', version_no: 'V1', cutting_size: '300x200mm', printing_process: '胶印', color_separation: 'CMYK', material_thickness: 0.23, material_width: 300, material_height: 200, unit_weight: 0.15, weight_unit: 'kg', volume_unit: 'm³', inventory_category: '成品', unit_code: 'PC', is_active: true, effective_date: '2026-01-01', expiry_date: '2027-12-31' })
    const ml400 = await Material.create({ material_code: 'ML-400-B', material_name: '400g奶粉罐', specification: '400g奶粉罐', category_name: '成品罐', unit_name: '个', film_no: 'A312-013-0002', version_no: 'V1', cutting_size: '250x180mm', printing_process: '胶印', color_separation: 'CMYK', material_thickness: 0.20, material_width: 250, material_height: 180, unit_weight: 0.12, weight_unit: 'kg', volume_unit: 'm³', inventory_category: '成品', unit_code: 'PC', is_active: true, effective_date: '2026-01-01', expiry_date: '2027-12-31' })
    const ml800 = await Material.create({ material_code: 'ML-800-C', material_name: '800g奶粉罐', specification: '800g奶粉罐', category_name: '成品罐', unit_name: '个', film_no: 'A312-014-0003', version_no: 'V2', cutting_size: '280x190mm', printing_process: '胶印', color_separation: 'CMYK', material_thickness: 0.22, material_width: 280, material_height: 190, unit_weight: 0.14, weight_unit: 'kg', volume_unit: 'm³', inventory_category: '成品', unit_code: 'PC', is_active: true, effective_date: '2026-01-01', expiry_date: '2027-12-31' })
    const ml1200 = await Material.create({ material_code: 'ML-1200-D', material_name: '1200g奶粉罐', specification: '1200g奶粉罐', category_name: '成品罐', unit_name: '个', film_no: 'A312-015-0004', version_no: 'V1', cutting_size: '320x220mm', printing_process: '胶印', color_separation: 'CMYK', material_thickness: 0.25, material_width: 320, material_height: 220, unit_weight: 0.18, weight_unit: 'kg', volume_unit: 'm³', inventory_category: '成品', unit_code: 'PC', is_active: false, effective_date: '2026-01-01', expiry_date: '2026-06-30' })
    const mtMar = await Material.create({ material_code: 'MT-MAR-A', material_name: '马口铁基材', specification: '0.23mm镀锡板', category_name: '原材料', unit_name: '片', film_no: '-', version_no: '-', cutting_size: '1000x1200mm', printing_process: '-', color_separation: '-', material_thickness: 0.23, material_width: 1000, material_height: 1200, unit_weight: 2.2, weight_unit: 'kg', volume_unit: 'm³', inventory_category: '原材料', unit_code: 'PC', is_active: true, effective_date: '2026-01-01', expiry_date: '2027-12-31' })
    console.log('✅ 料品创建完成（5条）')

    // 5. 创建产线（3条）—— 需先于设备创建（设备 line_id 引用产线）
    console.log('📌 创建产线...')
    await ProductionLine.bulkCreate([
      { line_id: 1, line_code: 'LINE-A', line_name: 'A线', workshop: '一号车间', line_leader: 'pm', sort_order: 1, status: 1 },
      { line_id: 2, line_code: 'LINE-B', line_name: 'B线', workshop: '一号车间', line_leader: 'pm', sort_order: 2, status: 1 },
      { line_id: 3, line_code: 'LINE-C', line_name: 'C线', workshop: '二号车间', line_leader: 'pm', sort_order: 3, status: 2 },
    ])
    console.log('✅ 产线创建完成（3条）')

    // 6. 创建设备（4台：焊接机2台、测漏机1台、码垛机1台）
    console.log('📌 创建设备...')
    await Device.bulkCreate([
      { device_id: 1, device_type: '焊接机', device_code: 'DEV-W001', device_name: '自动焊接机1号', device_model: 'WJ-200', serial_no: 'SN2024001', location: '一号车间-A线', line_id: 1, responsible_person: 'maint', is_special: false, status: 1, last_inspection_date: '2026-03-15', inspection_cycle: '6', next_inspection_date: '2026-09-15', manufacturer: '北京机械', purchase_date: '2024-01-10', warranty_end: '2026-01-10' },
      { device_id: 2, device_type: '测漏机', device_code: 'DEV-L001', device_name: '正压测漏机1号', device_model: 'CL-300', serial_no: 'SN2024002', location: '一号车间-A线', line_id: 1, responsible_person: 'maint', is_special: true, status: 1, last_inspection_date: '2026-01-20', inspection_cycle: '12', next_inspection_date: '2027-01-20', manufacturer: '上海检测', purchase_date: '2023-06-15', warranty_end: '2025-06-15' },
      { device_id: 3, device_type: '码垛机', device_code: 'DEV-P001', device_name: '自动码垛机1号', device_model: 'MD-500', serial_no: 'SN2024003', location: '一号车间-A线', line_id: 1, responsible_person: 'maint', is_special: false, status: 0, last_inspection_date: '2026-02-10', inspection_cycle: '6', next_inspection_date: '2026-08-10', manufacturer: '广州智造', purchase_date: '2024-03-20', warranty_end: '2026-03-20' },
      { device_id: 4, device_type: '焊接机', device_code: 'DEV-W002', device_name: '自动焊接机2号', device_model: 'WJ-200', serial_no: 'SN2024004', location: '一号车间-B线', line_id: 2, responsible_person: 'maint', is_special: false, status: 2, last_inspection_date: '2025-12-05', inspection_cycle: '6', next_inspection_date: '2026-06-05', manufacturer: '北京机械', purchase_date: '2024-01-10', warranty_end: '2026-01-10' },
    ])
    console.log('✅ 设备创建完成（4条）')

    // 7. 创建不良分类（7个）
    // available_units / related_processes 为 STRING，用逗号分隔存储
    console.log('📌 创建不良分类...')
    await DefectType.bulkCreate([
      { defect_id: 1, defect_code: 'D-MAT-01', defect_name: '材料划伤', defect_type: '来料不良', defect_unit: '个', available_units: '个,片', display: true, sort_order: 1, status: 1, related_processes: '1', defect_description: '材料表面有划痕' },
      { defect_id: 2, defect_code: 'D-MAT-02', defect_name: '材料变形', defect_type: '来料不良', defect_unit: '个', available_units: '个,片', display: true, sort_order: 2, status: 1, related_processes: '1', defect_description: '材料形状变形' },
      { defect_id: 3, defect_code: 'D-PRC-01', defect_name: '焊接不良', defect_type: '制程不良', defect_unit: '个', available_units: '个,处', display: true, sort_order: 3, status: 1, related_processes: '3', defect_description: '焊接处有气孔、虚焊等' },
      { defect_id: 4, defect_code: 'D-PRC-02', defect_name: '补涂漏涂', defect_type: '制程不良', defect_unit: '个', available_units: '个,处', display: true, sort_order: 4, status: 1, related_processes: '4', defect_description: '补涂区域有漏涂' },
      { defect_id: 5, defect_code: 'D-PRC-03', defect_name: '封口不良', defect_type: '制程不良', defect_unit: '个', available_units: '个', display: false, sort_order: 5, status: 1, related_processes: '6', defect_description: '封口不严密' },
      { defect_id: 6, defect_code: 'D-SCP-01', defect_name: '尺寸超差', defect_type: '检验报废', defect_unit: '个', available_units: '个', display: true, sort_order: 6, status: 1, related_processes: '2,5', defect_description: '成品尺寸超出公差范围' },
      { defect_id: 7, defect_code: 'D-SCP-02', defect_name: '测漏不合格', defect_type: '检验报废', defect_unit: '个', available_units: '个', display: true, sort_order: 7, status: 1, related_processes: '5', defect_description: '正压测漏不合格' },
    ])
    console.log('✅ 不良分类创建完成（7条）')

    // 8. 创建生产订单（4个）
    // status: 0=待下达, 1=已下达, 2=已关闭
    console.log('📌 创建生产订单...')
    await Order.bulkCreate([
      { order_id: 1, order_no: 'MO-16260630001', material_id: ml900.material_id, material_code: 'ML-900-A', material_name: '900g奶粉罐', specification: '900g奶粉罐', film_version: 'A312-012-0001', version_no: 'V1', planned_qty: 20000, finished_qty: 4983, plan_start_time: '2026-06-30 08:00', plan_end_time: '2026-07-02 18:00', status: 1, release_time: '2026-06-30 07:30', created_by: 'planner' },
      { order_id: 2, order_no: 'MO-16260630002', material_id: ml400.material_id, material_code: 'ML-400-B', material_name: '400g奶粉罐', specification: '400g奶粉罐', film_version: 'A312-013-0002', version_no: 'V1', planned_qty: 15000, finished_qty: 0, plan_start_time: '2026-07-01 08:00', plan_end_time: '2026-07-03 18:00', status: 0, release_time: null, created_by: 'planner' },
      { order_id: 3, order_no: 'MO-16260629001', material_id: ml800.material_id, material_code: 'ML-800-C', material_name: '800g奶粉罐', specification: '800g奶粉罐', film_version: 'A312-014-0003', version_no: 'V2', planned_qty: 10000, finished_qty: 9965, plan_start_time: '2026-06-29 08:00', plan_end_time: '2026-06-30 18:00', status: 2, release_time: '2026-06-28 16:00', close_time: '2026-06-30 17:00', created_by: 'planner' },
      { order_id: 4, order_no: 'MO-16260628001', material_id: ml900.material_id, material_code: 'ML-900-A', material_name: '900g奶粉罐', specification: '900g奶粉罐', film_version: 'A312-012-0001', version_no: 'V1', planned_qty: 18000, finished_qty: 18000, plan_start_time: '2026-06-28 08:00', plan_end_time: '2026-06-30 18:00', status: 2, release_time: '2026-06-27 16:00', close_time: '2026-06-30 16:30', created_by: 'planner' },
    ])
    console.log('✅ 生产订单创建完成（4条）')

    // 9. 创建工单（4个）
    // status: 0=开立, 1=开工, 2=完工, 3=关闭
    console.log('📌 创建工单...')
    await WorkOrder.bulkCreate([
      { work_order_id: 1, work_order_no: 'WO20260630001', order_id: 1, order_no: 'MO-16260630001', line_id: 1, line_name: 'A线', material_id: ml900.material_id, material_name: '900g奶粉罐', target_qty: 20000, finished_qty: 4983, start_time: '2026-06-30 08:00', finish_time: null, total_hours: 0, effective_hours: 0, labor_hours: 0, status: 1, created_by: 'pm' },
      { work_order_id: 2, work_order_no: 'WO20260629001', order_id: 3, order_no: 'MO-16260629001', line_id: 2, line_name: 'B线', material_id: ml800.material_id, material_name: '800g奶粉罐', target_qty: 10000, finished_qty: 9965, start_time: '2026-06-29 08:00', finish_time: '2026-06-30 17:00', total_hours: 33.0, effective_hours: 30.5, labor_hours: 244.0, status: 2, created_by: 'pm' },
      { work_order_id: 3, work_order_no: 'WO20260628001', order_id: 4, order_no: 'MO-16260628001', line_id: 1, line_name: 'A线', material_id: ml900.material_id, material_name: '900g奶粉罐', target_qty: 18000, finished_qty: 18000, start_time: '2026-06-28 08:00', finish_time: '2026-06-30 16:30', total_hours: 56.5, effective_hours: 52.0, labor_hours: 416.0, status: 3, created_by: 'pm' },
      { work_order_id: 4, work_order_no: 'WO20260701001', order_id: 2, order_no: 'MO-16260630002', line_id: 1, line_name: 'A线', material_id: ml400.material_id, material_name: '400g奶粉罐', target_qty: 15000, finished_qty: 0, start_time: '2026-07-02 08:00', finish_time: null, total_hours: 0, effective_hours: 0, labor_hours: 0, status: 0, created_by: 'pm' },
    ])
    console.log('✅ 工单创建完成（4条）')

    // 10. 创建工序报工记录（4条）
    console.log('📌 创建工序报工记录...')
    await ProcessReport.bulkCreate([
      { report_id: 1, work_order_id: 1, work_order_no: 'WO20260630001', process_id: 1, process_name: '裁剪下料', input_qty: 5000, defect_material: 10, defect_process: 5, defect_scrap: 2, output_qty: 4983, device_id: 1, device_name: '自动焊接机1号', report_user: 'op', report_user_name: '工序操作人', report_time: '2026-06-30 10:30:00' },
      { report_id: 2, work_order_id: 1, work_order_no: 'WO20260630001', process_id: 2, process_name: '小料检测', input_qty: 4983, defect_material: 3, defect_process: 0, defect_scrap: 1, output_qty: 4979, device_id: null, device_name: '-', report_user: 'op', report_user_name: '工序操作人', report_time: '2026-06-30 11:15:00' },
      { report_id: 3, work_order_id: 1, work_order_no: 'WO20260630001', process_id: 3, process_name: '成圆焊接', input_qty: 4979, defect_material: 2, defect_process: 8, defect_scrap: 0, output_qty: 4969, device_id: 1, device_name: '自动焊接机1号', report_user: 'pm', report_user_name: '生产管理', report_time: '2026-06-30 12:00:00' },
      { report_id: 4, work_order_id: 2, work_order_no: 'WO20260629001', process_id: 1, process_name: '裁剪下料', input_qty: 10000, defect_material: 20, defect_process: 10, defect_scrap: 5, output_qty: 9965, device_id: 4, device_name: '自动焊接机2号', report_user: 'op', report_user_name: '工序操作人', report_time: '2026-06-29 10:00:00' },
    ])
    console.log('✅ 工序报工记录创建完成（4条）')

    // 11. 创建人员投入记录（3条）
    console.log('📌 创建人员投入记录...')
    await ManpowerRecord.bulkCreate([
      { record_id: 1, work_order_id: 1, work_order_no: 'WO20260630001', skilled_workers: 3, general_workers: 5, contract_workers: 2, auxiliary_workers: 1, remarks: '白班', record_user: 'pm', record_user_name: '生产管理' },
      { record_id: 2, work_order_id: 2, work_order_no: 'WO20260629001', skilled_workers: 2, general_workers: 4, contract_workers: 2, auxiliary_workers: 0, remarks: '白班', record_user: 'pm', record_user_name: '生产管理' },
      { record_id: 3, work_order_id: 2, work_order_no: 'WO20260629001', skilled_workers: 2, general_workers: 3, contract_workers: 1, auxiliary_workers: 0, remarks: '夜班', record_user: 'pm', record_user_name: '生产管理' },
    ])
    console.log('✅ 人员投入记录创建完成（3条）')

    // 12. 创建异常工时记录（3条）
    console.log('📌 创建异常工时记录...')
    await ExceptionRecord.bulkCreate([
      { record_id: 1, work_order_id: 1, work_order_no: 'WO20260630001', order_id: 1, order_no: 'MO-16260630001', exception_type: 'E04', exception_type_name: '设备故障', device_id: 1, device_name: '自动焊接机1号', start_time: '2026-06-30 09:00', end_time: '2026-06-30 09:30', duration: 30, reason: '焊接头过热，停机冷却', record_user: 'op', record_user_name: '工序操作人' },
      { record_id: 2, work_order_id: 2, work_order_no: 'WO20260629001', order_id: 3, order_no: 'MO-16260629001', exception_type: 'E01', exception_type_name: '换型调机', device_id: null, device_name: '-', start_time: '2026-06-29 08:00', end_time: '2026-06-29 09:30', duration: 90, reason: '从900g切换至800g规格换型', record_user: 'pm', record_user_name: '生产管理' },
      { record_id: 3, work_order_id: 2, work_order_no: 'WO20260629001', order_id: 3, order_no: 'MO-16260629001', exception_type: 'E03', exception_type_name: '停机待料', device_id: null, device_name: '-', start_time: '2026-06-29 14:00', end_time: '2026-06-29 15:00', duration: 60, reason: '等待马口铁基材到货', record_user: 'pm', record_user_name: '生产管理' },
    ])
    console.log('✅ 异常工时记录创建完成（3条）')

    console.log('\n🎉 种子数据初始化完成！')
    console.log('   - 角色：9 条')
    console.log('   - 用户：9 条（密码均为 123456）')
    console.log('   - 工序：11 条')
    console.log('   - 料品：5 条')
    console.log('   - 产线：3 条')
    console.log('   - 设备：4 条')
    console.log('   - 不良分类：7 条')
    console.log('   - 生产订单：4 条')
    console.log('   - 工单：4 条')
    console.log('   - 工序报工：4 条')
    console.log('   - 人员记录：3 条')
    console.log('   - 异常记录：3 条')

    await sequelize.close()
    process.exit(0)
  } catch (err) {
    console.error('❌ 种子数据初始化失败:', err)
    try {
      await sequelize.close()
    } catch (_) {
      // ignore close error
    }
    process.exit(1)
  }
}

seed()
