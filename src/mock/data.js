// Mock数据 - 基于设计文档

// 9种角色
export const roles = [
  { role_id: 'r1', role_name: '超级管理员', role_code: 'SUPER_ADMIN', type: '系统默认', scope: '系统全部权限，用户管理，系统配置，数据字典' },
  { role_id: 'r2', role_name: '计划员', role_code: 'PLANNER', type: '系统默认', scope: '生产计划制定、下达、调整，计划进度查看' },
  { role_id: 'r3', role_name: '质量管理员', role_code: 'QC_MANAGER', type: '系统默认', scope: '质量标准制定，质量抽检审批，不合格品处置审批' },
  { role_id: 'r4', role_name: '质量检验员', role_code: 'QC_INSPECTOR', type: '系统默认', scope: '质量检测执行，检测数据录入，异常上报' },
  { role_id: 'r5', role_name: '生产管理', role_code: 'PROD_MANAGER', type: '系统默认', scope: '生产任务管理，生产调度，人员管理，报表审批，班组管理' },
  { role_id: 'r6', role_name: '工序操作人', role_code: 'OPERATOR', type: '系统默认', scope: '本工序生产操作，数据录入，设备点检' },
  { role_id: 'r7', role_name: '系统管理员', role_code: 'ADMIN', type: '可选', scope: '日常系统管理（权限低于超级管理员）' },
  { role_id: 'r8', role_name: '设备维护员', role_code: 'MAINTENANCE', type: '可选', scope: '设备维修，保养记录' },
  { role_id: 'r9', role_name: '看板查看者', role_code: 'DASHBOARD_VIEWER', type: '可选', scope: '大屏/看板只读查看' },
]

// 9个默认用户
export const users = [
  { user_id: 'u1', username: '超级管理员', real_name: '超级管理员', employee_no: 'EMP001', department: '系统管理部', role_id: 'r1', role_name: '超级管理员', phone: '13800000001', email: 'admin@milk.com', status: 1, last_login_time: '2026-06-30 08:30:00' },
  { user_id: 'u2', username: '系统管理员', real_name: '系统管理员', employee_no: 'EMP002', department: '信息部', role_id: 'r7', role_name: '系统管理员', phone: '13800000002', email: 'it@milk.com', status: 1, last_login_time: '2026-06-29 17:20:00' },
  { user_id: 'u3', username: '计划员', real_name: '计划员', employee_no: 'EMP003', department: '生产计划部', role_id: 'r2', role_name: '计划员', phone: '13800000003', email: 'plan@milk.com', status: 1, last_login_time: '2026-06-30 09:00:00' },
  { user_id: 'u4', username: '质量管理员', real_name: '质量管理员', employee_no: 'EMP004', department: '质量管理部', role_id: 'r3', role_name: '质量管理员', phone: '13800000004', email: 'qc@milk.com', status: 1, last_login_time: '2026-06-30 08:45:00' },
  { user_id: 'u5', username: '质量检验员', real_name: '质量检验员', employee_no: 'EMP005', department: '质量管理部', role_id: 'r4', role_name: '质量检验员', phone: '13800000005', email: 'qci@milk.com', status: 1, last_login_time: '2026-06-30 07:50:00' },
  { user_id: 'u6', username: '生产管理', real_name: '生产管理', employee_no: 'EMP006', department: '生产部', role_id: 'r5', role_name: '生产管理', phone: '13800000006', email: 'prod@milk.com', status: 1, last_login_time: '2026-06-30 08:00:00' },
  { user_id: 'u7', username: '工序操作人', real_name: '工序操作人', employee_no: 'EMP007', department: '生产部', role_id: 'r6', role_name: '工序操作人', phone: '13800000007', email: 'op@milk.com', status: 1, last_login_time: '2026-06-30 07:30:00' },
  { user_id: 'u8', username: '设备维护员', real_name: '设备维护员', employee_no: 'EMP008', department: '设备部', role_id: 'r8', role_name: '设备维护员', phone: '13800000008', email: 'maint@milk.com', status: 1, last_login_time: '2026-06-29 16:00:00' },
  { user_id: 'u9', username: '看板查看者', real_name: '看板查看者', employee_no: 'EMP009', department: '综合管理部', role_id: 'r9', role_name: '看板查看者', phone: '13800000009', email: 'view@milk.com', status: 1, last_login_time: '2026-06-28 10:00:00' },
]

// 11道默认工序
export const processes = [
  { process_id: 'p1', process_code: 'P-01', process_name: '裁剪下料', sort_order: 1, status: '启用' },
  { process_id: 'p2', process_code: 'P-02', process_name: '小料检测', sort_order: 2, status: '启用' },
  { process_id: 'p3', process_code: 'P-03', process_name: '成圆焊接', sort_order: 3, status: '启用' },
  { process_id: 'p4', process_code: 'P-04', process_name: '补涂烘干', sort_order: 4, status: '启用' },
  { process_id: 'p5', process_code: 'P-05', process_name: '倒罐检测', sort_order: 5, status: '启用' },
  { process_id: 'p6', process_code: 'P-06', process_name: '翻边封口', sort_order: 6, status: '启用' },
  { process_id: 'p7', process_code: 'P-07', process_name: '正压测漏', sort_order: 7, status: '启用' },
  { process_id: 'p8', process_code: 'P-08', process_name: '在线光检测', sort_order: 8, status: '启用' },
  { process_id: 'p9', process_code: 'P-09', process_name: '人工全检', sort_order: 9, status: '启用' },
  { process_id: 'p10', process_code: 'P-10', process_name: '码垛包装', sort_order: 10, status: '启用' },
  { process_id: 'p11', process_code: 'P-11', process_name: '成品检验', sort_order: 11, status: '启用' },
]

// 料品档案
export const materials = [
  { material_id: 'm1', material_code: 'ML-900-A', material_name: '900g奶粉罐', specification: '900g奶粉罐', film_version: 'A312-012-0001', version_no: 'V1', status: '启用', category_code: 'C01', category_name: '成品罐', customer_code: 'CUST-001', customer_name: '伊利乳业', unit: '个', min_safety_stock: 5000, max_safety_stock: 50000 },
  { material_id: 'm2', material_code: 'ML-400-B', material_name: '400g奶粉罐', specification: '400g奶粉罐', film_version: 'A312-013-0002', version_no: 'V1', status: '启用', category_code: 'C01', category_name: '成品罐', customer_code: 'CUST-002', customer_name: '蒙牛乳业', unit: '个', min_safety_stock: 3000, max_safety_stock: 30000 },
  { material_id: 'm3', material_code: 'ML-800-C', material_name: '800g奶粉罐', specification: '800g奶粉罐', film_version: 'A312-014-0003', version_no: 'V2', status: '启用', category_code: 'C01', category_name: '成品罐', customer_code: 'CUST-003', customer_name: '飞鹤乳业', unit: '个', min_safety_stock: 4000, max_safety_stock: 40000 },
  { material_id: 'm4', material_code: 'ML-1200-D', material_name: '1200g奶粉罐', specification: '1200g奶粉罐', film_version: 'A312-015-0004', version_no: 'V1', status: '试产', category_code: 'C01', category_name: '成品罐', customer_code: 'CUST-004', customer_name: '君乐宝', unit: '个', min_safety_stock: 2000, max_safety_stock: 20000 },
  { material_id: 'm5', material_code: 'MT-MAR-A', material_name: '马口铁基材', specification: '0.23mm镀锡板', film_version: '-', version_no: '-', status: '启用', category_code: 'C02', category_name: '原材料', customer_code: '-', customer_name: '-', unit: '片', min_safety_stock: 10000, max_safety_stock: 100000 },
]

// 产线
export const productionLines = [
  { line_id: 'l1', line_code: 'LINE-A', line_name: 'A线', status: '运行中', workshop: '一号车间', line_leader: 'u6', sort_order: 1,
    line_processes: [
      { process_id: 'p1', device_id: 'd3' },
      { process_id: 'p2', device_id: 'd1' },
      { process_id: 'p3', device_id: 'd1' },
      { process_id: 'p4', device_id: 'd2' },
      { process_id: 'p5', device_id: 'd2' },
    ] },
  { line_id: 'l2', line_code: 'LINE-B', line_name: 'B线', status: '运行中', workshop: '一号车间', line_leader: 'u6', sort_order: 2,
    line_processes: [
      { process_id: 'p1', device_id: 'd3' },
      { process_id: 'p2', device_id: 'd1' },
      { process_id: 'p3', device_id: 'd4' },
      { process_id: 'p4', device_id: 'd2' },
      { process_id: 'p5', device_id: 'd2' },
    ] },
  { line_id: 'l3', line_code: 'LINE-C', line_name: 'C线', status: '维护中', workshop: '二号车间', line_leader: 'u6', sort_order: 3,
    line_processes: [
      { process_id: 'p1', device_id: 'd3' },
      { process_id: 'p2', device_id: 'd1' },
      { process_id: 'p3', device_id: 'd1' },
      { process_id: 'p4', device_id: 'd2' },
      { process_id: 'p5', device_id: 'd2' },
    ] },
]

// 设备档案
export const devices = [
  { device_id: 'd1', device_type: '焊接机', device_code: 'DEV-W001', device_name: '自动焊接机1号', device_model: 'WJ-200', serial_no: 'SN2024001', location: '一号车间-A线', status: '运行', responsible_person: 'u8', is_special: 0, last_inspection_date: '2026-03-15', inspection_cycle: 6, next_inspection_date: '2026-09-15', manufacturer: '北京机械', purchase_date: '2024-01-10', warranty_end: '2026-01-10' },
  { device_id: 'd2', device_type: '测漏机', device_code: 'DEV-L001', device_name: '正压测漏机1号', device_model: 'CL-300', serial_no: 'SN2024002', location: '一号车间-A线', status: '运行', responsible_person: 'u8', is_special: 1, last_inspection_date: '2026-01-20', inspection_cycle: 12, next_inspection_date: '2027-01-20', manufacturer: '上海检测', purchase_date: '2023-06-15', warranty_end: '2025-06-15' },
  { device_id: 'd3', device_type: '码垛机', device_code: 'DEV-P001', device_name: '自动码垛机1号', device_model: 'MD-500', serial_no: 'SN2024003', location: '一号车间-A线', status: '待机', responsible_person: 'u8', is_special: 0, last_inspection_date: '2026-02-10', inspection_cycle: 6, next_inspection_date: '2026-08-10', manufacturer: '广州智造', purchase_date: '2024-03-20', warranty_end: '2026-03-20' },
  { device_id: 'd4', device_type: '焊接机', device_code: 'DEV-W002', device_name: '自动焊接机2号', device_model: 'WJ-200', serial_no: 'SN2024004', location: '一号车间-B线', status: '故障', responsible_person: 'u8', is_special: 0, last_inspection_date: '2025-12-05', inspection_cycle: 6, next_inspection_date: '2026-06-05', manufacturer: '北京机械', purchase_date: '2024-01-10', warranty_end: '2026-01-10' },
]

// 不良分类
export const defectTypes = [
  { defect_id: 'df1', defect_code: 'D-MAT-01', defect_name: '材料划伤', defect_type: '来料不良', defect_unit: '个', available_units: ['个','片'], display: true, sort_order: 1, status: '启用', related_processes: ['p1'], defect_description: '材料表面有划痕', defect_images: [] },
  { defect_id: 'df2', defect_code: 'D-MAT-02', defect_name: '材料变形', defect_type: '来料不良', defect_unit: '个', available_units: ['个','片'], display: true, sort_order: 2, status: '启用', related_processes: ['p1'], defect_description: '材料形状变形', defect_images: [] },
  { defect_id: 'df3', defect_code: 'D-PRC-01', defect_name: '焊接不良', defect_type: '制程不良', defect_unit: '个', available_units: ['个','处'], display: true, sort_order: 3, status: '启用', related_processes: ['p3'], defect_description: '焊接处有气孔、虚焊等', defect_images: [] },
  { defect_id: 'df4', defect_code: 'D-PRC-02', defect_name: '补涂漏涂', defect_type: '制程不良', defect_unit: '个', available_units: ['个','处'], display: true, sort_order: 4, status: '启用', related_processes: ['p4'], defect_description: '补涂区域有漏涂', defect_images: [] },
  { defect_id: 'df5', defect_code: 'D-PRC-03', defect_name: '封口不良', defect_type: '制程不良', defect_unit: '个', available_units: ['个'], display: false, sort_order: 5, status: '启用', related_processes: ['p6'], defect_description: '封口不严密', defect_images: [] },
  { defect_id: 'df6', defect_code: 'D-SCP-01', defect_name: '尺寸超差', defect_type: '检验报废', defect_unit: '个', available_units: ['个'], display: true, sort_order: 6, status: '启用', related_processes: ['p2','p5'], defect_description: '成品尺寸超出公差范围', defect_images: [] },
  { defect_id: 'df7', defect_code: 'D-SCP-02', defect_name: '测漏不合格', defect_type: '检验报废', defect_unit: '个', available_units: ['个'], display: true, sort_order: 7, status: '启用', related_processes: ['p5'], defect_description: '正压测漏不合格', defect_images: [] },
]

// 生产订单
export const orders = [
  { order_id: 'o1', order_no: 'MO-16260630001', material_id: 'm1', material_code: 'ML-900-A', material_name: '900g奶粉罐', specification: '900g奶粉罐', film_version: 'A312-012-0001', version_no: 'V1', planned_qty: 20000, finished_qty: 4983, plan_start_time: '2026-06-30 08:00', plan_end_time: '2026-07-02 18:00', status: '下发', release_time: '2026-06-30 07:30', created_by: 'u3', created_at: '2026-06-29 14:00:00' },
  { order_id: 'o2', order_no: 'MO-16260630002', material_id: 'm2', material_code: 'ML-400-B', material_name: '400g奶粉罐', specification: '400g奶粉罐', film_version: 'A312-013-0002', version_no: 'V1', planned_qty: 15000, finished_qty: 0, plan_start_time: '2026-07-01 08:00', plan_end_time: '2026-07-03 18:00', status: '开立', release_time: null, created_by: 'u3', created_at: '2026-06-30 09:00:00' },
  { order_id: 'o3', order_no: 'MO-16260629001', material_id: 'm3', material_code: 'ML-800-C', material_name: '800g奶粉罐', specification: '800g奶粉罐', film_version: 'A312-014-0003', version_no: 'V2', planned_qty: 10000, finished_qty: 9965, plan_start_time: '2026-06-29 08:00', plan_end_time: '2026-06-30 18:00', status: '完工', release_time: '2026-06-28 16:00', close_time: '2026-06-30 17:00', created_by: 'u3', created_at: '2026-06-28 15:00:00' },
  { order_id: 'o4', order_no: 'MO-16260628001', material_id: 'm1', material_code: 'ML-900-A', material_name: '900g奶粉罐', specification: '900g奶粉罐', film_version: 'A312-012-0001', version_no: 'V1', planned_qty: 18000, finished_qty: 18000, plan_start_time: '2026-06-28 08:00', plan_end_time: '2026-06-30 18:00', status: '完工', release_time: '2026-06-27 16:00', close_time: '2026-06-30 16:30', created_by: 'u3', created_at: '2026-06-27 14:00:00' },
]

// 工单
export const workOrders = [
  { work_order_id: 'w1', work_order_no: 'WO20260630001', order_id: 'o1', order_no: 'MO-16260630001', line_id: 'l1', line_name: 'A线', material_name: '900g奶粉罐', target_qty: 20000, start_time: '2026-06-30 08:00', finish_time: null, total_hours: null, effective_hours: null, labor_hours: null, status: '开工', created_by: 'u6', created_at: '2026-06-30 07:45:00' },
  { work_order_id: 'w2', work_order_no: 'WO20260629001', order_id: 'o3', order_no: 'MO-16260629001', line_id: 'l2', line_name: 'B线', material_name: '800g奶粉罐', target_qty: 10000, start_time: '2026-06-29 08:00', finish_time: '2026-06-30 17:00', total_hours: 33.0, effective_hours: 30.5, labor_hours: 244.0, status: '完工', created_by: 'u6', created_at: '2026-06-29 07:50:00' },
  { work_order_id: 'w3', work_order_no: 'WO20260628001', order_id: 'o4', order_no: 'MO-16260628001', line_id: 'l1', line_name: 'A线', material_name: '900g奶粉罐', target_qty: 18000, start_time: '2026-06-28 08:00', finish_time: '2026-06-30 16:30', total_hours: 56.5, effective_hours: 52.0, labor_hours: 416.0, status: '关闭', created_by: 'u6', created_at: '2026-06-28 07:40:00' },
  { work_order_id: 'w4', work_order_no: 'WO20260701001', order_id: 'o2', order_no: 'MO-16260630002', line_id: 'l1', line_name: 'A线', material_id: 'm2', material_name: '400g奶粉罐', target_qty: 15000, start_time: '2026-07-02 08:00', finish_time: null, total_hours: null, effective_hours: null, labor_hours: null, status: '开立', created_by: 'u6', created_at: '2026-07-01 08:00:00' },
]

// 工序报工记录
export const processReports = [
  { report_id: 'rp1', work_order_id: 'w1', work_order_no: 'WO20260630001', process_id: 'p1', process_name: '裁剪下料', input_qty: 5000, defect_material: 10, defect_process: 5, defect_scrap: 2, output_qty: 4983, device_id: 'd1', device_name: '自动焊接机1号', report_user: 'u7', report_user_name: '工序操作人', report_time: '2026-06-30 10:30:00' },
  { report_id: 'rp2', work_order_id: 'w1', work_order_no: 'WO20260630001', process_id: 'p2', process_name: '小料检测', input_qty: 4983, defect_material: 3, defect_process: 0, defect_scrap: 1, output_qty: 4979, device_id: null, device_name: '-', report_user: 'u7', report_user_name: '工序操作人', report_time: '2026-06-30 11:15:00' },
  { report_id: 'rp3', work_order_id: 'w1', work_order_no: 'WO20260630001', process_id: 'p3', process_name: '成圆焊接', input_qty: 4979, defect_material: 2, defect_process: 8, defect_scrap: 0, output_qty: 4969, device_id: 'd1', device_name: '自动焊接机1号', report_user: 'u6', report_user_name: '生产管理', report_time: '2026-06-30 12:00:00' },
  { report_id: 'rp4', work_order_id: 'w2', work_order_no: 'WO20260629001', process_id: 'p1', process_name: '裁剪下料', input_qty: 10000, defect_material: 20, defect_process: 10, defect_scrap: 5, output_qty: 9965, device_id: 'd4', device_name: '自动焊接机2号', report_user: 'u7', report_user_name: '工序操作人', report_time: '2026-06-29 10:00:00' },
]

// 人员投入记录
export const manpowerRecords = [
  { record_id: 'mr1', work_order_id: 'w1', work_order_no: 'WO20260630001', skilled_workers: 3, general_workers: 5, contract_workers: 2, auxiliary_workers: 1, remarks: '白班', record_user: 'u6', record_user_name: '生产管理', created_at: '2026-06-30 08:00:00' },
  { record_id: 'mr2', work_order_id: 'w2', work_order_no: 'WO20260629001', skilled_workers: 2, general_workers: 4, contract_workers: 2, auxiliary_workers: 0, remarks: '白班', record_user: 'u6', record_user_name: '生产管理', created_at: '2026-06-29 08:00:00' },
  { record_id: 'mr3', work_order_id: 'w2', work_order_no: 'WO20260629001', skilled_workers: 2, general_workers: 3, contract_workers: 1, auxiliary_workers: 0, remarks: '夜班', record_user: 'u6', record_user_name: '生产管理', created_at: '2026-06-29 20:00:00' },
]

// 异常工时记录
export const exceptionRecords = [
  { record_id: 'er1', work_order_id: 'w1', work_order_no: 'WO20260630001', order_id: 'o1', order_no: 'MO-16260630001', exception_type: 'E04', exception_type_name: '设备故障', device_id: 'd1', device_name: '自动焊接机1号', start_time: '2026-06-30 09:00', end_time: '2026-06-30 09:30', duration: 30, reason: '焊接头过热，停机冷却', record_user: 'u7', record_user_name: '工序操作人' },
  { record_id: 'er2', work_order_id: 'w2', work_order_no: 'WO20260629001', order_id: 'o3', order_no: 'MO-16260629001', exception_type: 'E01', exception_type_name: '换型调机', device_id: null, device_name: '-', start_time: '2026-06-29 08:00', end_time: '2026-06-29 09:30', duration: 90, reason: '从900g切换至800g规格换型', record_user: 'u6', record_user_name: '生产管理' },
  { record_id: 'er3', work_order_id: 'w2', work_order_no: 'WO20260629001', order_id: 'o3', order_no: 'MO-16260629001', exception_type: 'E03', exception_type_name: '停机待料', device_id: null, device_name: '-', start_time: '2026-06-29 14:00', end_time: '2026-06-29 15:00', duration: 60, reason: '等待马口铁基材到货', record_user: 'u6', record_user_name: '生产管理' },
]

// 检验标准
export const inspectionStandards = [
  { standard_id: 's1', standard_no: 'STD-900-A', standard_name: '900g奶粉罐成品检验标准', standard_type: '通用标准', customer_code: '-', material_id: 'm1', material_name: '900g奶粉罐', version_no: 'V3', effective_date: '2026-01-01', status: '生效', created_by: 'u4' },
  { standard_id: 's2', standard_no: 'STD-400-B', standard_name: '400g奶粉罐成品检验标准', standard_type: '通用标准', customer_code: '-', material_id: 'm2', material_name: '400g奶粉罐', version_no: 'V2', effective_date: '2026-01-01', status: '生效', created_by: 'u4' },
  { standard_id: 's3', standard_no: 'STD-900-YL', standard_name: '伊利专用900g检验标准', standard_type: '客户专用标准', customer_code: 'CUST-001', material_id: 'm1', material_name: '900g奶粉罐', version_no: 'V1', effective_date: '2026-03-15', status: '生效', created_by: 'u4' },
  { standard_id: 's4', standard_no: 'STD-MAT-M', standard_name: '马口铁基材来料检验标准', standard_type: '通用标准', customer_code: '-', material_id: 'm5', material_name: '马口铁基材', version_no: 'V2', effective_date: '2026-01-01', status: '生效', created_by: 'u4' },
]

// 来料检验
export const incomingInspections = [
  { inspection_id: 'ic1', inspection_no: 'JC20260628001', supplier_code: 'SUP-001', supplier_name: '宝钢包装', material_id: 'm5', material_name: '马口铁基材', supplier_batch_no: 'BG20260620', internal_batch_no: 'IN-20260628-01', quantity: 50000, arrival_date: '2026-06-28', standard_id: 's4', standard_name: '马口铁基材来料检验标准', result: '合格', handle_type: '入库', inspector: 'u5', inspector_name: '质量检验员', inspection_time: '2026-06-28 14:00:00', status: '已完成' },
  { inspection_id: 'ic2', inspection_no: 'JC20260629001', supplier_code: 'SUP-002', supplier_name: '中粮包装', material_id: 'm5', material_name: '马口铁基材', supplier_batch_no: 'ZL20260625', internal_batch_no: 'IN-20260629-01', quantity: 30000, arrival_date: '2026-06-29', standard_id: 's4', standard_name: '马口铁基材来料检验标准', result: '不合格', handle_type: '退货', handle_reason: '表面划伤超标', inspector: 'u5', inspector_name: '质量检验员', inspection_time: '2026-06-29 10:00:00', status: '已完成' },
  { inspection_id: 'ic3', inspection_no: 'JC20260630001', supplier_code: 'SUP-001', supplier_name: '宝钢包装', material_id: 'm5', material_name: '马口铁基材', supplier_batch_no: 'BG20260629', internal_batch_no: 'IN-20260630-01', quantity: 40000, arrival_date: '2026-06-30', standard_id: 's4', standard_name: '马口铁基材来料检验标准', result: null, handle_type: null, inspector: 'u5', inspector_name: '质量检验员', inspection_time: null, status: '检验中' },
]

// 成品检验
export const finishedInspections = [
  { inspection_id: 'fc1', inspection_no: 'CP20260630001', work_order_id: 'w2', work_order_no: 'WO20260629001', trigger_type: '自动', standard_id: 's1', standard_name: '900g奶粉罐成品检验标准', result: '合格', handle_type: '入库', inspector: 'u5', inspector_name: '质量检验员', inspection_time: '2026-06-30 16:00:00', status: '已完成' },
  { inspection_id: 'fc2', inspection_no: 'CP20260628001', work_order_id: 'w3', work_order_no: 'WO20260628001', trigger_type: '自动', standard_id: 's1', standard_name: '900g奶粉罐成品检验标准', result: '合格', handle_type: '入库', inspector: 'u5', inspector_name: '质量检验员', inspection_time: '2026-06-30 15:30:00', status: '已完成' },
]

// 微生物检验
export const microbeInspections = [
  { inspection_id: 'mb1', inspection_no: 'MB20260630001', inspection_type: '正常', object_type: '成品', work_order_id: 'w2', work_order_no: 'WO20260629001', standard_id: 's1', result: '合格', inspector: 'u5', inspector_name: '质量检验员', inspection_time: '2026-06-30 16:30:00', status: '已完成' },
  { inspection_id: 'mb2', inspection_no: 'MB20260628001', inspection_type: '正常', object_type: '原材料', incoming_id: 'ic1', standard_id: 's4', result: '合格', inspector: 'u5', inspector_name: '质量检验员', inspection_time: '2026-06-28 15:00:00', status: '已完成' },
]

// 环境检验
export const envInspections = [
  { inspection_id: 'ev1', inspection_no: 'ENV20260630001', area_id: 'a1', area_name: '一号车间', trigger_type: '自动', result: '合格', correction_action: null, inspector: 'u5', inspector_name: '质量检验员', inspection_date: '2026-06-30', status: '已完成' },
  { inspection_id: 'ev2', inspection_no: 'ENV20260629001', area_id: 'a2', area_name: '清洁区', trigger_type: '自动', result: '不合格', correction_action: '增加消毒频次，重新清洁后复查', recheck_date: '2026-06-30', recheck_result: '合格', inspector: 'u5', inspector_name: '质量检验员', inspection_date: '2026-06-29', status: '已完成' },
]

// 客诉管理
export const complaints = [
  { complaint_id: 'cp1', complaint_no: 'CS260625001', source: '经营部', customer_name: '伊利乳业', contact_person: '张经理', material_id: 'm1', material_name: '900g奶粉罐', batch_no: 'WO20260620001', complaint_type: '外观缺陷', complaint_desc: '罐体表面印刷色差，部分批次存在轻微划痕', complaint_time: '2026-06-25 10:00:00', complaint_method: '电话', require_reply: 1, reply_deadline: '2026-06-28', handle_direction: '介入处理', status: '已关闭', registered_by: 'u4', registered_by_name: '质量管理员' },
  { complaint_id: 'cp2', complaint_no: 'CS260628001', source: '客户直接', customer_name: '蒙牛乳业', contact_person: '李工', material_id: 'm2', material_name: '400g奶粉罐', batch_no: 'WO20260625001', complaint_type: '密封性', complaint_desc: '客户反馈部分罐体密封不严', complaint_time: '2026-06-28 14:00:00', complaint_method: '邮件', require_reply: 1, reply_deadline: '2026-07-01', handle_direction: '仅调查分析', status: '处理中', registered_by: 'u4', registered_by_name: '质量管理员' },
]

// 供应商投诉
export const supplierComplaints = [
  { complaint_id: 'sc1', complaint_no: 'SC260629001', supplier_code: 'SUP-002', supplier_name: '中粮包装', complaint_type: '材料质量', complaint_reason: '马口铁基材表面划伤超标，到货检验不合格', related_inspection_id: 'ic2', complaint_date: '2026-06-29', pdf_path: '/pdf/sc260629001.pdf', reply_content: null, reply_attachment: null, reply_date: null, status: '已发出', created_by: 'u4', created_by_name: '质量管理员' },
]

// 检测仪器
export const instruments = [
  { instrument_id: 'i1', instrument_no: 'DI260630001', instrument_name: '千分尺', instrument_model: '0-25mm', department: '质量管理部', location: '质检室', calibration_cycle: 365, last_calibration_date: '2026-06-15', next_calibration_date: '2027-06-15', status: '正常', remarks: '' },
  { instrument_id: 'i2', instrument_no: 'DI260328001', instrument_name: '测厚仪', instrument_model: 'TT130', department: '质量管理部', location: '质检室', calibration_cycle: 180, last_calibration_date: '2026-01-10', next_calibration_date: '2026-07-10', status: '即将到期', remarks: '' },
  { instrument_id: 'i3', instrument_no: 'DI260328002', instrument_name: '微生物培养箱', instrument_model: 'SPX-150', department: '质量管理部', location: '微生物室', calibration_cycle: 365, last_calibration_date: '2025-05-01', next_calibration_date: '2026-05-01', status: '已超期', remarks: '待外部校准' },
]

// 数据库字典 - 表清单（与实际数据库模型一致）
export const dbTables = [
  { table_name: 'sys_user', field_count: 19, record_count: 9, category: '系统表', purpose: '系统用户表，存储所有登录用户信息及权限关联', last_update: '2026-07-05 09:00:00' },
  { table_name: 'sys_role', field_count: 11, record_count: 9, category: '系统表', purpose: '系统角色表，定义角色名称、编码及排序', last_update: '2026-07-05 09:00:00' },
  { table_name: 'sys_permission', field_count: 12, record_count: 40, category: '系统表', purpose: '系统权限表，存储菜单、页面、按钮、API权限定义', last_update: '2026-07-05 09:00:00' },
  { table_name: 'sys_role_permission', field_count: 3, record_count: 128, category: '系统表', purpose: '角色权限关联表，建立角色与权限的多对多关系', last_update: '2026-07-05 09:00:00' },
  { table_name: 'sys_operation_log', field_count: 13, record_count: 3520, category: '系统表', purpose: '操作日志表，记录用户所有关键操作行为', last_update: '2026-07-05 09:00:00' },
  { table_name: 'sys_config', field_count: 9, record_count: 13, category: '系统表', purpose: '系统配置表，存储系统参数配置项', last_update: '2026-07-05 09:00:00' },
  { table_name: 'sys_sequence', field_count: 6, record_count: 12, category: '系统表', purpose: '业务编号序列表，用于自动编号生成的原子计数', last_update: '2026-07-05 09:00:00' },
  { table_name: 'sys_number_rule', field_count: 20, record_count: 12, category: '系统表', purpose: '编号规则表，用于系统自动编号的可视化配置管理', last_update: '2026-07-05 09:00:00' },
  { table_name: 'bas_material', field_count: 28, record_count: 5, category: '基础数据表', purpose: '料品档案表，存储奶粉罐料品基础信息及规格参数', last_update: '2026-07-05 09:00:00' },
  { table_name: 'bas_customer', field_count: 22, record_count: 24, category: '基础数据表', purpose: '客户档案表，存储客户基本信息及信用等级', last_update: '2026-07-05 09:00:00' },
  { table_name: 'master_production_line', field_count: 9, record_count: 3, category: '基础数据表', purpose: '产线表，管理生产线的编号、名称及状态', last_update: '2026-07-05 09:00:00' },
  { table_name: 'master_process', field_count: 7, record_count: 11, category: '基础数据表', purpose: '工序表，定义奶粉罐生产工序名称及顺序', last_update: '2026-07-05 09:00:00' },
  { table_name: 'master_device', field_count: 19, record_count: 4, category: '基础数据表', purpose: '设备档案表，存储设备基础信息及特种设备检定日期', last_update: '2026-07-05 09:00:00' },
  { table_name: 'master_defect_type', field_count: 15, record_count: 7, category: '基础数据表', purpose: '不良分类表，按检验类型（来料检验类型/制程检验类型）和不良类型二级分类管理不良项及单位', last_update: '2026-07-06 09:00:00' },
  { table_name: 'bas_line_process', field_count: 7, record_count: 20, category: '基础数据表', purpose: '产线工序关联表，描述产线与工序多对多关系', last_update: '2026-07-05 09:00:00' },
  { table_name: 'bas_line_device', field_count: 7, record_count: 10, category: '基础数据表', purpose: '产线设备关联表，描述产线、设备与工序的三方关联', last_update: '2026-07-05 09:00:00' },
  { table_name: 'production_order', field_count: 18, record_count: 4, category: '业务表', purpose: '生产订单表，记录生产订单信息及计划数量', last_update: '2026-07-05 09:00:00' },
  { table_name: 'production_work_order', field_count: 19, record_count: 4, category: '业务表', purpose: '工单表，记录生产工单及工时计算数据', last_update: '2026-07-05 09:00:00' },
  { table_name: 'production_process_report', field_count: 16, record_count: 4, category: '业务表', purpose: '工序报工记录表，记录每道工序的产量和不良数据', last_update: '2026-07-05 09:00:00' },
  { table_name: 'production_manpower_record', field_count: 11, record_count: 3, category: '业务表', purpose: '人员投入记录表，记录工单的人员配置及班次', last_update: '2026-07-05 09:00:00' },
  { table_name: 'production_exception_record', field_count: 17, record_count: 3, category: '业务表', purpose: '异常工时记录表，记录生产异常及关联订单工单', last_update: '2026-07-05 09:00:00' },
]

// 操作日志
export const operationLogs = [
  { log_id: 'log1', user_id: 'u1', user_name: '超级管理员', module: '系统管理', action: '登录', content: '用户登录系统', ip_address: '192.168.1.100', created_at: '2026-06-30 08:30:00' },
  { log_id: 'log2', user_id: 'u3', user_name: '计划员', module: '生产管理', action: '新增', content: '创建生产订单 MO-16260630001', ip_address: '192.168.1.101', created_at: '2026-06-29 14:00:00' },
  { log_id: 'log3', user_id: 'u6', user_name: '生产管理', module: '生产管理', action: '新增', content: '创建工单 WO20260630001', ip_address: '192.168.1.102', created_at: '2026-06-30 07:45:00' },
  { log_id: 'log4', user_id: 'u7', user_name: '工序操作人', module: '生产管理', action: '报工', content: '工单WO20260630001 裁剪下料工序报工', ip_address: '192.168.1.103', created_at: '2026-06-30 10:30:00' },
  { log_id: 'log5', user_id: 'u5', user_name: '质量检验员', module: '质量管理', action: '检验', content: '完成来料检验 JC20260628001', ip_address: '192.168.1.104', created_at: '2026-06-28 14:00:00' },
  { log_id: 'log6', user_id: 'u4', user_name: '质量管理员', module: '质量管理', action: '登记', content: '登记客诉 CS260628001', ip_address: '192.168.1.105', created_at: '2026-06-28 14:00:00' },
]
