import { SystemConfig, DataDictionary } from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'

/** 系统配置内存缓存（60秒 TTL）—— 配置读取高频、写入低频 */
let sysConfigCache: { value: Record<string, any>; expireAt: number } | null = null
const SYSCONFIG_CACHE_TTL = 60 * 1000
export function clearSysConfigCache() { sysConfigCache = null }
import sequelize from '../config/database.js'
import { Sequelize, Op, QueryTypes } from 'sequelize'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import http from 'http'
import net from 'net'
import { exec } from 'child_process'
import { logger } from '../utils/logger.js'
import { formatDateTime, nowBeijingStr } from '../utils/date.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BACKUP_DIR = process.env.BACKUP_DIR || path.resolve(__dirname, '../../backups')
const SQLITE_PATH = process.env.DB_STORAGE || path.resolve(__dirname, '../../data/milk_can_mes.sqlite')
const LEGACY_DEFAULT_VALUES: Record<string, string[]> = {
  system_version: ['V1.0.0'],
  defect_warning_threshold: ['5'],
  microbe_cycle: ['30'],
}

// ============= 数据字典刷新：异步任务进度 + 频率限制 =============
type DictRefreshStatus = 'pending' | 'running' | 'success' | 'failed'
interface DictRefreshTask {
  taskId: string
  status: DictRefreshStatus
  totalTables: number
  processedTables: number
  currentTable: string
  message: string
  startedAt: number
  finishedAt?: number
  error?: string
  result?: { total: number; refreshed_at: string }
}
const dictRefreshTaskStore = new Map<string, DictRefreshTask>()
// 频率限制：上次刷新完成或开始的时间戳（至少 60s 才允许再次刷新）
let dictRefreshLastAt = 0
const DICT_REFRESH_MIN_INTERVAL_MS = 60 * 1000
// 允许同时只有一个刷新任务
let dictRefreshRunning = false

function generateTaskId(): string {
  return `dict_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// 并发控制工具：将 items 切分为多批次并发执行，每批 concurrency 个
async function runConcurrently<T, R>(
  items: T[],
  worker: (item: T, idx: number) => Promise<R>,
  concurrency: number = 8,
  onProgress?: (done: number, total: number, currentItem?: T) => void,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let idx = 0
  let done = 0
  const next = async (workerIdx: number) => {
    while (idx < items.length) {
      const currentIdx = idx++
      const item = items[currentIdx]
      try {
        results[currentIdx] = await worker(item, currentIdx)
      } catch (e) {
        results[currentIdx] = e as R
      }
      done++
      if (onProgress) onProgress(done, items.length, item)
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    (_, i) => next(i),
  )
  await Promise.all(workers)
  return results
}


// 默认配置（设计文档 §2.2.2 系统配置表）
const defaultConfigs = [
  { config_key: 'system_name', config_value: '长沙大满MES', config_desc: '系统名称' },
  { config_key: 'system_version', config_value: 'V1.0.1.722', config_desc: '系统版本（只读）' },
  { config_key: 'company_name', config_value: '东莞市大满包装实业有限公司长沙分公司', config_desc: '公司名称' },
  { config_key: 'contact_phone', config_value: '0731-88888888', config_desc: '联系电话' },
  { config_key: 'default_line', config_value: 'A线', config_desc: '默认产线' },
  { config_key: 'standard_hours', config_value: '8', config_desc: '标准工时' },
  // 班次设定：默认白班
  { config_key: 'shift_setting', config_value: '白班', config_desc: '班次设置（默认白班）' },
  { config_key: 'default_standard', config_value: '', config_desc: '默认检验标准' },
  { config_key: 'defect_warning_threshold', config_value: '3', config_desc: '不良率预警阈值(%)' },
  { config_key: 'microbe_cycle', config_value: '7', config_desc: '微生物检测周期(天)' },
  { config_key: 'device_alarm', config_value: 'true', config_desc: '设备故障报警' },
  { config_key: 'quality_alarm', config_value: 'true', config_desc: '质量异常报警' },
  { config_key: 'stock_warning', config_value: 'true', config_desc: '库存预警' },
]

// 获取系统配置（键值对）—— 带 60 秒内存缓存
export const getConfig = async (req, res) => {
  try {
    // 命中缓存直接返回
    if (sysConfigCache && sysConfigCache.expireAt > Date.now()) {
      return success(res, sysConfigCache.value, '获取成功')
    }
    const configs = await SystemConfig.findAll()
    const result: Record<string, any> = {}
    configs.forEach(c => {
      result[c.config_key] = c.config_value
    })
    for (const def of defaultConfigs) {
      if (result[def.config_key] === undefined) {
        result[def.config_key] = def.config_value
      }
    }
    const versionDef = defaultConfigs.find(d => d.config_key === 'system_version')
    if (versionDef) {
      result.system_version = versionDef.config_value
    }
    // 写入缓存
    sysConfigCache = { value: result, expireAt: Date.now() + SYSCONFIG_CACHE_TTL }
    return success(res, result, '获取成功')
  } catch (err) {
    console.error('获取系统配置失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

const ALLOWED_CONFIG_KEYS = new Set(defaultConfigs.map(d => d.config_key).filter(k => k !== 'system_version'))

// 保存系统配置（system_version 只读，不允许通过此接口修改）
export const saveConfig = async (req, res) => {
  try {
    const configs = { ...req.body }
    delete configs.system_version
    const username = req.user?.username || 'system'
    for (const [key, value] of Object.entries(configs)) {
      if (!ALLOWED_CONFIG_KEYS.has(key)) {
        logger.warn(`[saveConfig] 拒绝写入未知配置项: ${key}`)
        continue
      }
      const val = typeof value === 'object' ? JSON.stringify(value) : String(value)
      const [config, created] = await SystemConfig.findOrCreate({
        where: { config_key: key },
        defaults: { config_value: val, config_desc: key, updated_by: username },
      })
      if (!created) {
        await config.update({ config_value: val, updated_by: username })
      }
    }
    // 写入成功后清除缓存，下次读取会重新加载
    clearSysConfigCache()
    return success(res, null, '保存成功')
  } catch (err) {
    console.error('保存系统配置失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 项目环境信息（只读展示）


export const tableCategoryMap = {
  sys_user: { category: '系统表', purpose: '系统用户表，存储所有登录用户信息及权限关联' },
  sys_role: { category: '系统表', purpose: '系统角色表，定义角色名称、编码及排序' },
  sys_permission: { category: '系统表', purpose: '系统权限表，存储菜单、页面、按钮、API权限定义' },
  sys_role_permission: { category: '系统表', purpose: '角色权限关联表，建立角色与权限的多对多关系' },
  sys_operation_log: { category: '系统表', purpose: '操作日志表，记录用户所有关键操作行为' },
  sys_config: { category: '系统表', purpose: '系统配置表，存储系统参数配置项' },
  sys_sequence: { category: '系统表', purpose: '业务编号序列表，用于自动编号生成的原子计数' },
  sys_dict_type: { category: '系统表', purpose: '数据字典类型表' },
  sys_dict_data: { category: '系统表', purpose: '数据字典项表' },
  sys_number_rule: { category: '系统表', purpose: '编码规则表，用于系统自动编号的可视化配置管理' },
  sys_app_version: { category: '系统表', purpose: '应用版本管理表，管理APP/PAD等客户端版本发布' },
  sys_data_dictionary: { category: '系统表', purpose: '数据字典表，存储数据库表结构元数据快照' },
  bas_material: { category: '基础数据表', purpose: '料品档案表，存储奶粉罐料品基础信息及规格参数' },
  bas_customer: { category: '基础数据表', purpose: '客户档案表，存储客户基本信息及信用等级' },
  master_production_line: { category: '基础数据表', purpose: '产线表，管理生产线的编号、名称、车间及状态，与工序多对多关联' },
  master_process: { category: '基础数据表', purpose: '工序表，定义奶粉罐生产工序名称及顺序' },
  master_device: { category: '基础数据表', purpose: '设备档案表，存储设备基础信息及特种设备检定日期' },
  master_defect_type: { category: '基础数据表', purpose: '不良分类表，按大类名称和分类名称二级分类管理不良项及单位' },
  master_defect_image: { category: '基础数据表', purpose: '不良图片表，存储不良项的示例图片用于参考对比' },
  bas_line_process: { category: '基础数据表', purpose: '产线工序关联表，描述产线与工序的多对多关系，支持排序' },
  bas_line_device: { category: '基础数据表', purpose: '产线设备关联表，描述产线、设备与工序的三方关联' },
  production_order: { category: '业务表', purpose: '生产订单表，记录生产订单信息及计划数量，状态机：开立→下发→开工→完工→关闭' },
  production_report_order: { category: '业务表', purpose: '生产报工单主表，订单下发后直接创建报工单进行开工报工（无工单层），状态机：开工→完工' },
  production_report_process: { category: '业务表', purpose: '报工工序子表，创建报工单时从产线工序表继承，记录报工单关联的工序及排序信息' },
  production_manpower_record: { category: '业务表', purpose: '报工单人员投入记录表，记录报工单的人员配置、班次及工时信息' },
  production_process_exception: { category: '业务表', purpose: '报工单异常工时记录表，记录生产异常及关联设备信息' },
  production_process_defect: { category: '业务表', purpose: '工序不良记录子表，仅记录外键关联，详情通过关联不良分类表查询获取' },
  production_process_material: { category: '业务表', purpose: '工序物料记录子表，仅记录外键关联，详情通过关联基础料品表查询获取' },
  production_report_image: { category: '业务表', purpose: '报工单图片记录子表，统一存储报工单关联的不良/标签/异常图片' },
  quality_inspection_standard: { category: '基础数据表', purpose: '检验标准主表，存储检验标准基本信息（标准编号、名称、检验类型、标准类型、版本号、状态等），与检验标准项目子表一对多关联' },
  quality_inspection_standard_item: { category: '基础数据表', purpose: '检验标准项目子表，存储检验项目名称、大类、方法、抽样方式、标准值、单位等详细信息，与检验标准主表多对一关联' },
  quality_product_inspection: { category: '业务表', purpose: '产品检测主表，存储产品检测基本信息，含检验编号、类型、关联报工单、检验标准、结果、状态等，与检测项目子表一对多关联' },
  quality_product_inspection_item: { category: '业务表', purpose: '产品检测项目子表，存储检测项目的标准值、检测值、判定结果、检测人及检测时间，与产品检测主表多对一关联' },
  quality_incoming_inspection: { category: '业务表', purpose: '来料检验主表，存储来料检验基本信息，含检验编号、关联检验标准、供应商、批次、结果、状态等，与检验项目子表一对多关联' },
  quality_incoming_inspection_item: { category: '业务表', purpose: '来料检验项目子表，存储检验项目、标准值、检测值、判定结果等详细信息，与来料检验主表多对一关联' },
  quality_microbe_inspection: { category: '业务表', purpose: '微生物检验和环境检验主表，存储微生物及环境检测基本信息，含检验编号、类型、关联单据、检验标准、结果、状态等' },
  quality_microbe_inspection_item: { category: '业务表', purpose: '微生物检验和环境检验子表，存储微生物及环境检验的检验项目、标准值、检测值、判定结果等详细信息' },
  sys_user_setting: { category: '系统表', purpose: '用户个性化设置表，存储用户对表格列宽、筛选条件等个性化配置' },
  task_setting: { category: '基础数据表', purpose: '自动任务设置表，存储任务类型、名称、数据源URL、执行参数等配置信息' },
  task_sync_log: { category: '基础数据表', purpose: '同步任务日志表，记录数据同步任务的执行状态、进度、步骤日志及结果信息' },
  task_scheduled: { category: '基础数据表', purpose: '定时任务计划表，存储周期性/定时/单次任务的调度配置、执行时间及上次执行结果' },
  task_item: { category: '业务表', purpose: 'U9料品档案表，存储从U9系统同步的料品基础信息、规格参数及分类信息' },
  task_customer: { category: '业务表', purpose: 'U9客户档案表，存储从U9系统同步的客户基本信息、分类及信用状态' },
  task_production_order: { category: '业务表', purpose: 'U9生产订单采集表，从U9 ERP制造订单MO列表同步的原始生产订单数据（字段与业务主表production_order对齐，含采集独有字段）' },
  task_purchase_receipt: { category: '业务表', purpose: 'U9采购收货采集表，从U9 ERP采购管理-标准收货列表同步的原始采购收货数据（含单据号、料品、供应商、数量、批次等信息）' },
  bas_supplier: { category: '基础数据表', purpose: '供应商档案表，存储供应商基本信息、联系方式及信用等级（与来料检验、采购收货关联）' },
  task_env_monitor_data: { category: '业务表', purpose: '环境监测数据表，存储车间环境监测因子（温湿度等）的实时采集数据' },
  task_env_alarm_record: { category: '业务表', purpose: '环境报警记录表，存储环境监测超限的报警信息、级别及处理状态' },
  task_weather_info: { category: '业务表', purpose: '气象信息表，存储城市/区域的实时天气数据（温度、湿度、大气压等）' },
  task_energy_meter_data: { category: '业务表', purpose: '能源采集数据表，存储从云集云能源平台采集的总表有功/无功总电能历史记录' },
}

// 表名 → { 字段名: 中文注释 }（数据库表结构元数据，模块级常量）
export const columnCommentMap = {
  sys_user: {
    user_id: '用户ID（主键）',
    username: '登录账号',
    password: '登录密码（加密存储）',
    real_name: '真实姓名',
    employee_no: '工号',
    department: '所属部门',
    position: '岗位名称',
    role_id: '角色ID（关联sys_role）',
    phone: '联系电话',
    email: '电子邮箱',
    avatar_url: '头像地址',
    status: '状态（1启用 0禁用）',
    last_login_time: '最后登录时间',
    last_login_ip: '最后登录IP',
    pwd_reset_required: '首次登录需修改密码（1是 0否）',
    created_by: '创建人',
    remarks: '备注信息',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  sys_role: {
    role_id: '角色ID（主键）',
    role_name: '角色名称',
    role_code: '角色编码',
    type: '角色类型',
    is_system_default: '是否系统默认角色（1是 0否）',
    description: '角色描述',
    scope: '数据权限范围',
    sort_order: '排序号',
    status: '状态（1启用 0禁用）',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  sys_permission: {
    perm_id: '权限ID（主键）',
    parent_id: '父级权限ID',
    perm_name: '权限名称',
    perm_code: '权限编码',
    type: '权限类型（目录/菜单/按钮）',
    icon: '图标',
    path: '路由路径',
    component: '组件路径',
    sort_order: '排序号',
    visible: '是否在菜单显示（1显示 0隐藏）',
    status: '状态（1启用 0禁用）',
    created_at: '创建时间',
  },
  sys_role_permission: {
    id: '主键ID',
    role_id: '角色ID',
    perm_id: '权限ID',
  },
  sys_operation_log: {
    log_id: '日志ID（主键）',
    user_id: '操作用户ID',
    username: '操作用户名',
    module: '操作模块',
    action: '操作类型',
    operation: '操作动作',
    content: '操作内容',
    method: '请求方法',
    params: '请求参数',
    ip: 'IP地址',
    ip_address: 'IP地址（冗余）',
    status: '操作状态（1成功 0失败）',
    created_at: '创建时间',
  },
  sys_config: {
    config_id: '配置ID（主键）',
    config_key: '配置键',
    config_value: '配置值',
    config_type: '配置类型（string/number/boolean/json）',
    config_group: '配置分组（security/system/business）',
    config_desc: '配置说明',
    updated_by: '更新人',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  sys_sequence: {
    seq_id: '序列ID（主键）',
    seq_key: '序列键',
    seq_date: '序列日期（YYYYMMDD格式）',
    current_value: '当前序号值',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  sys_dict_type: {
    dict_id: '字典类型ID（主键）',
    dict_name: '字典名称',
    dict_type: '字典类型编码',
    status: '状态（1启用 0停用）',
    remark: '备注',
    created_by: '创建人',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  sys_dict_data: {
    dict_code: '字典编码（主键）',
    dict_sort: '显示排序',
    dict_label: '字典标签',
    dict_value: '字典键值',
    dict_type: '字典类型',
    css_class: '样式属性（CSS类）',
    list_class: '表格回显样式（Tag颜色）',
    is_default: '是否默认（1是 0否）',
    status: '状态（1启用 0停用）',
    remark: '备注',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  sys_number_rule: {
    rule_id: '规则ID（主键）',
    rule_name: '规则名称',
    rule_code: '规则编码',
    prefix: '前缀',
    date_format: '日期格式（none/YYMMDD/YYYYMMDD/YYYY）',
    separator: '分隔符',
    seq_width: '序号位数',
    reset_by: '重置周期（daily/yearly/never）',
    target_table: '关联表名',
    target_field: '关联字段名',
    target_label: '关联字段中文说明',
    current_no: '当前最新编号',
    used_count: '已使用记录数',
    status: '状态（1启用 0停用）',
    is_locked: '是否已审核（1是 0否）',
    description: '规则说明',
    created_by: '创建人',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  bas_material: {
    material_id: '料品ID（主键）',
    category_name: '分类名称',
    material_code: '料品编码',
    material_name: '料品名称',
    specification: '规格型号',
    unit_name: '单位名称',
    film_no: '菲林编号',
    version_no: '版本号',
    cutting_size: '裁切尺寸',
    printing_process: '印刷工艺',
    color_separation: '分色数',
    blanking_diameter: '落料直径',
    material_thickness: '材料厚度(mm)',
    material_width: '材料宽度(mm)',
    material_height: '材料高度(mm)',
    scrap_weight: '废料重量',
    unit_weight: '单重',
    unit_volume: '单容积',
    weight_unit: '重量单位',
    volume_unit: '体积单位',
    inventory_category: '库存分类',
    unit_code: '单位编码',
    customer_id: '关联客户ID',
    is_active: '是否生效（1是 0否）',
    effective_date: '生效日期',
    expiry_date: '失效日期',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  bas_customer: {
    customer_id: '客户ID（主键）',
    customer_code: '客户编码',
    customer_name: '客户名称',
    short_name: '客户简称',
    customer_category: '客户分类',
    customer_type: '客户类型',
    contact_person: '联系人',
    phone: '联系电话',
    email: '电子邮箱',
    address: '联系地址',
    status: '状态（1启用 0停用）',
    effective_date: '生效日期',
    expiry_date: '失效日期',
    credit_level: '信用等级（A/B/C/D）',
    tax_id: '纳税人识别号',
    bank_account: '银行账号',
    bank_name: '开户银行',
    remark: '备注',
    sort_order: '排序号',
    created_by: '创建人',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  master_production_line: {
    line_id: '产线ID（主键）',
    line_code: '产线编码',
    line_name: '产线名称',
    workshop: '所属车间',
    line_leader: '产线负责人（预留字段）',
    sort_order: '排序号',
    status: '状态（1运行中 2维护中 0停用）',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  master_process: {
    process_id: '工序ID（主键）',
    process_code: '工序编码',
    process_name: '工序名称',
    sort_order: '排序号',
    has_material: '是否引入物料（1是 0否）',
    status: '状态（1启用 0停用）',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  master_device: {
    device_id: '设备ID（主键）',
    device_code: '设备编码',
    device_name: '设备名称',
    device_type: '设备类型',
    device_model: '设备型号',
    serial_no: '出厂编号',
    location: '所在位置',
    line_id: '所属产线ID',
    responsible_person: '负责人',
    is_special: '是否特种设备（1是 0否）',
    status: '状态（1运行 2维修 0停用）',
    last_inspection_date: '上次检定日期',
    inspection_cycle: '检定周期(天)',
    next_inspection_date: '下次检定日期',
    manufacturer: '生产厂家',
    purchase_date: '购置日期',
    warranty_end: '保修截止日期',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  master_defect_type: {
    defect_id: '不良项ID（主键）',
    defect_code: '不良编码',
    defect_name: '不良项目',
    defect_type: '不良类型',
    defect_description: '不良描述',
    category_name: '分类名称',
    parent_id: '父级分类ID',
    defect_unit: '默认单位',
    available_units: '可选单位列表',
    display: '是否显示（1是 0否）',
    sort_order: '排序号',
    status: '状态（1启用 0停用）',
    related_processes: '关联工序ID列表',
    category_desc: '分类描述',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  master_defect_image: {
    image_id: '图片ID（主键）',
    defect_id: '关联不良项ID',
    image_url: '图片访问路径',
    image_name: '图片文件名',
    sort_order: '排序号',
    file_hash: '文件MD5哈希值（用于去重）',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  bas_line_process: {
    id: '主键ID',
    line_id: '产线ID',
    process_id: '工序ID',
    sort_order: '排序号',
    status: '状态（1启用 0停用）',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  bas_line_device: {
    id: '主键ID',
    line_id: '产线ID',
    device_id: '设备ID',
    process_id: '工序ID',
    sort_order: '排序号',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  production_order: {
    order_id: '订单ID（主键）',
    order_no: '订单编号（MO-16+YYMMDD+3位序号）',
    material_id: '料品ID',
    material_code: '料品编码',
    material_name: '料品名称',
    specification: '规格型号',
    film_version: '菲林编号',
    version_no: '版本号',
    planned_qty: '计划数量（正整数）',
    finished_qty: '已完工数量',
    u9_qualified: 'U9累计合格数量',
    plan_start_time: '计划开始时间（不得早于今天）',
    plan_end_time: '计划完成时间（不得早于计划开始日期）',
    u9_status: 'U9状态（原始字符串：开立/开工/完工等）',
    status: '订单状态（0开立 1下发 2开工 3完工 4关闭）',
    release_time: '下发时间',
    close_time: '关闭时间',
    created_by: '创建人',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  production_report_order: {
    report_order_id: '生产报工单ID（主键）',
    order_id: '关联生产订单ID',
    order_no: '订单号（冗余）',
    report_no: '报工单号（WO-16+YYMMDD+3位序号）',
    line_id: '生产产线ID',
    line_name: '产线名称（冗余）',
    material_id: '料品ID（从订单带出）',
    material_code: '料号（冗余）',
    material_name: '料品名称（冗余）',
    specification: '规格（冗余）',
    report_qty: '报工数量',
    report_time: '报工时间（创建时间）',
    finish_time: '完工时间',
    status: '工单状态（0开工 1完工）',
    report_user_id: '报工人员ID',
    report_user_name: '报工人员姓名（冗余）',
    finish_user_id: '完工人员ID',
    finish_user_name: '完工人员姓名（冗余）',
    remarks: '备注',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  production_report_process: {
    id: '主键ID',
    report_order_id: '生产报工单ID（关联production_report_order）',
    process_id: '工序ID（关联master_process）',
    process_code: '工序编码',
    process_name: '工序名称',
    has_material: '是否引入物料（0否 1是）',
    sort_order: '排序号',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  production_manpower_record: {
    record_id: '记录ID（主键）',
    report_order_id: '生产报工单ID（关联production_report_order）',
    record_date: '记录日期',
    shift: '班次',
    start_time: '开始时间',
    end_time: '结束时间',
    hours: '工时（小时）',
    skilled_count: '熟练工人数',
    general_count: '普通工人数',
    labor_count: '劳务工人数',
    other_count: '其他工人数',
    total_people: '总人数',
    man_hours: '人工工时（人数×小时）',
    remarks: '备注',
    record_user: '记录人账号',
    record_user_name: '记录人姓名',
    created_at: '创建时间',
  },
  production_process_defect: {
    defect_id: '不良记录ID（主键）',
    report_order_id: '生产报工单ID（关联production_report_order）',
    process_id: '工序ID（关联master_process）',
    defect_type_id: '不良分类ID（关联master_defect_type，详情通过关联查询获取）',
    quantity: '不良数量',
    unit: '单位',
    defect_images: '不良图片（JSON数组）',
    record_time: '记录时间（即created_at）',
  },
  production_process_exception: {
    exception_id: '异常ID（主键）',
    report_order_id: '生产报工单ID（关联production_report_order）',
    exception_type: '异常类型',
    device_id: '设备ID（关联master_device）',
    device_code: '设备编码',
    device_name: '设备名称',
    stop_type: '停机类型',
    confirm_user: '确认人账号',
    confirm_user_name: '确认人姓名',
    start_time: '开始时间',
    end_time: '结束时间',
    duration: '持续时间(小时)',
    description: '异常描述',
    exception_images: '异常图片(JSON数组)',
    record_user: '记录人账号',
    record_user_name: '记录人姓名',
    created_at: '创建时间',
  },
  production_report_image: {
    image_id: '图片ID（主键）',
    report_order_id: '生产报工单ID（关联production_report_order）',
    category: '图片分类（defect不良/label标签/exception异常）',
    image_url: '图片访问路径',
    file_hash: '文件MD5哈希值（用于去重）',
    created_at: '创建时间',
  },
  production_process_material: {
    material_id: '物料记录ID（主键）',
    report_order_id: '生产报工单ID（关联production_report_order）',
    process_id: '工序ID（关联master_process）',
    material_type: '物料类型（投入/产出）',
    bas_material_id: '基础料品ID（关联bas_material，详情通过关联查询获取）',
    material_batch: '物料批次',
    package_no: '包装编号',
    quantity: '数量',
    label_images: '标签图片（JSON数组）',
    record_time: '记录时间（即created_at）',
  },
  sys_app_version: {
    id: '版本ID（主键）',
    version: '版本号',
    platform: '平台（all/android/ios）',
    description: '版本描述',
    download_url: '下载地址',
    is_force: '是否强制更新（1是 0否）',
    is_latest: '是否最新版本（1是 0否）',
    file_size: '文件大小',
    created_by: '创建人',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  sys_data_dictionary: {
    dict_id: '字典ID（主键）',
    table_name: '表名',
    category: '表分类（系统表/基础数据表/业务表）',
    purpose: '表用途说明',
    field_count: '字段数',
    record_count: '记录数',
    fields: '字段列表（JSON）',
    last_update: '最后更新时间',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  quality_inspection_standard: {
    standard_id: '检验标准ID（主键）',
    standard_no: '标准编号（唯一）',
    standard_name: '标准名称',
    inspection_type: '检验类型：首件/制程/成品/其它',
    standard_type: '标准类型：材料检验/产品检验/环境检验/微生物检验标准/其它检验',
    customer_code: '客户编码',
    material_id: '参照料品ID',
    material_name: '料品名称（冗余）',
    version_no: '版本号（默认V1）',
    effective_date: '生效日期',
    status: '状态：开立/生效/失效',
    created_by: '创建人ID',
    description: '描述',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  quality_inspection_standard_item: {
    item_id: '检验标准项目ID（主键）',
    standard_id: '关联检验标准ID',
    item_name: '项目名称',
    category: '项目大类：外观/尺寸/性能/理化/微生物/环境',
    method: '检验方法',
    sample_rule: '抽样方式',
    standard_value: '标准要求',
    unit: '单位',
    defect_level: '缺陷等级：A类致命缺陷、B类严重缺陷、C类次要缺陷',
    sort_order: '排序',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  sys_user_setting: {
    setting_id: '设置ID（主键）',
    user_id: '用户ID',
    setting_key: '设置键',
    setting_value: '设置值（JSON）',
    setting_type: '设置类型（string/json/number/boolean）',
    setting_group: '设置分组（table/filter/preference）',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  quality_product_inspection: {
    inspection_id: '产品检测ID（主键）',
    inspection_no: '检验编号（按类型两位前缀+日期+序号）',
    inspection_type: '检验类型：首件/制程/成品/其它',
    report_order_id: '关联报工单ID',
    report_order_no: '报工单号（冗余）',
    material_id: '料品ID（从报工单带出）',
    material_code: '料号（从报工单带出，冗余）',
    material_name: '产品名称/料品名称（从报工单带出，冗余）',
    specification: '规格（从报工单带出，冗余）',
    standard_id: '关联检验标准ID',
    standard_name: '检验标准名称（冗余）',
    result: '总结果：合格/不合格',
    trigger_type: '触发方式：自动/手工',
    status: '状态：0=待检, 1=检验中, 2=审核中, 3=已完成, 4=已关闭',
    inspector_id: '检验人ID',
    inspector_name: '检验人姓名（冗余）',
    reviewer_id: '审核人ID',
    reviewer_name: '审核人姓名（冗余）',
    inspection_time: '检验时间',
    review_time: '审核时间',
    remarks: '备注',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  quality_product_inspection_item: {
    item_id: '检测项目ID（主键）',
    inspection_id: '关联产品检测主表ID',
    item_name: '检测项目名称',
    standard_value: '项目标准值',
    actual_value: '项目检测值',
    result: '项目判定结果：0=不合格, 1=合格',
    inspector_id: '项目检测人ID',
    inspector_name: '项目检测人姓名（冗余）',
    inspection_time: '项目检测时间',
    sort_order: '排序',
    remarks: '备注',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  task_setting: {
    setting_id: '设置ID（主键）',
    task_type: '任务类型（items/customers/env_monitor/weather）',
    name: '任务名称',
    description: '任务描述',
    source_url: '数据源URL',
    field_count: '字段数量',
    is_active: '是否启用（1启用 0停用）',
    params: '执行参数（JSON）',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  task_sync_log: {
    task_id: '任务ID（主键）',
    task_biz_id: '业务任务ID（UUID）',
    task_type: '任务类型（items/customers/env_monitor/weather）',
    status: '状态（pending/running/completed/failed）',
    progress: '进度（0-100）',
    current_step: '当前步骤说明',
    steps: '步骤日志（JSON）',
    total_records: '总记录数',
    output_file: '输出文件路径',
    output_size: '输出文件大小（bytes）',
    error_msg: '错误信息',
    started_at: '开始时间',
    ended_at: '结束时间',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  task_scheduled: {
    schedule_id: '计划ID（主键）',
    schedule_biz_id: '计划业务ID',
    name: '计划名称',
    task_type: '任务类型',
    exec_mode: '执行方式（periodic/scheduled/once）',
    config: '调度配置（JSON）',
    next_run_at: '下次执行时间',
    last_run_at: '上次执行时间',
    last_run_result: '上次执行结果',
    is_enabled: '是否启用（1启用 0停用）',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  task_item: {
    item_id: '料品ID（主键）',
    task_id: '来源同步任务ID',
    main_category_code: '主分类代码',
    category_name: '分类名称',
    item_code: '料号',
    item_name: '品名',
    specification: '规格',
    unit_name: '单位名称',
    film_no: '菲林编号',
    cutting_size: '开料尺寸',
    print_process: '印刷工艺',
    color_info: '分色信息',
    blank_diameter: '落料直径',
    material_thickness: '材料厚度',
    material_width: '材料宽度',
    material_height: '材料高度',
    scrap_weight: '边角料重量',
    stock_unit_weight: '库存单位重量',
    stock_unit_volume: '库存单位体积',
    weight_unit: '重量单位',
    volume_unit: '体积单位',
    inventory_category: '库存分类',
    unit_code: '单位编码',
    is_active: '是否生效（1是 0否）',
    effective_date: '生效日期',
    expiration_date: '失效日期',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  task_customer: {
    customer_id: '客户ID（主键）',
    task_id: '来源同步任务ID',
    customer_code: '客户编码',
    customer_name: '客户名称',
    short_name: '简称',
    category_id: '客户分类ID',
    category_name: '分类名称',
    is_active: '是否生效（1是 0否）',
    expire_date: '失效日期',
    effective_date: '生效日期',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  task_env_monitor_data: {
    monitor_id: '监测ID（主键）',
    factor_id: '因子ID',
    device_addr: '设备地址',
    device_name: '设备名称',
    node_id: '节点ID',
    register_id: '寄存器ID',
    factor_name: '因子名称',
    value: '当前值',
    raw_data: '原始数据',
    unit: '单位',
    coefficient: '系数',
    device_status: '设备状态',
    collect_time: '采集时间（平台时间戳）',
    data_time: '数据时间（系统采集时间）',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  task_env_alarm_record: {
    alarm_id: '报警ID（主键）',
    factor_id: '因子ID',
    device_addr: '设备地址',
    device_name: '设备名称',
    node_id: '节点ID',
    register_id: '寄存器ID',
    factor_name: '因子名称',
    alarm_info: '报警信息',
    alarm_level: '报警级别',
    alarm_range: '报警限值',
    current_value: '当前报警值',
    unit: '单位',
    alarm_time: '报警时间',
    is_handled: '是否已处理（0未处理 1已处理）',
    handle_msg: '处理意见',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  task_weather_info: {
    weather_id: '气象ID（主键）',
    city: '城市/区县名称',
    temperature: '温度（℃）',
    humidity: '相对湿度（%）',
    pressure: '大气压（hPa）',
    weather_time: '气象发布/观测时间',
    source: '数据来源站点',
    raw_data: '原始片段（调试用）',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  task_energy_meter_data: {
    id: '主键ID',
    task_setting_id: '关联任务设置ID',
    reading_date: '采集时间',
    device_addr: '通讯地址',
    device_name: '电表名称',
    forward_active_energy: '正向有功总电能(kWh)',
    forward_reactive_energy: '正向无功总电能(kvarh)',
    reverse_active_energy: '反向有功总电能(kWh)',
    reverse_reactive_energy: '反向无功总电能(kvarh)',
    raw_data: '原始数据片段(调试用)',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  task_production_order: {
    order_id: '采集记录ID（主键）',
    task_id: '来源同步任务ID',
    source_type: '来源类型',
    doc_type_name: '单据类别名称',
    biz_create_date: '业务制单日期',
    order_no: '单据编号',
    status: '单据状态（开立/开工/完工等）',
    material_code: '料品料号',
    material_name: '料品品名',
    specification: '规格',
    film_version: '菲林编号',
    version_no: '版本',
    barcode: '条形码',
    planned_qty: '排产数量',
    qualified_qty: '累计合格数量',
    plan_start_time: '计划开工日期',
    plan_end_time: '计划完工日期',
    created_by: '业务制单人',
    raw_data: '原始数据（JSON）',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  task_purchase_receipt: {
    receipt_id: '采集记录ID（主键）',
    task_id: '来源同步任务ID',
    receipt_no: '单据编号（采购收货单号）',
    material_code: '料号',
    material_name: '料品名称',
    specification: '料品规格',
    business_type: '业务类型（如标准采购）',
    received_qty: '实收数量-采购单位',
    receive_lot_no: '收货批号',
    supplier_lot_no: '供应商批号',
    source_doc_no: '来源采购订单号',
    line_no: '行号',
    supplier_code: '供应商编码',
    supplier_name: '供应商名称',
    status: '单据状态（如业务关闭/开立/审核等）',
    created_by: '创建人',
    receipt_date: '业务日期（收货日期）',
    raw_data: '原始数据（JSON，采集独有字段）',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  bas_supplier: {
    supplier_id: '供应商ID（主键）',
    supplier_code: '供应商编码（唯一）',
    supplier_name: '供应商名称',
    short_name: '供应商简称',
    supplier_category: '供应商分类',
    contact_person: '联系人',
    phone: '联系电话',
    email: '电子邮箱',
    address: '联系地址',
    status: '状态（1启用 0停用）',
    credit_level: '信用等级（A/B/C/D）',
    tax_id: '纳税人识别号',
    bank_account: '银行账号',
    bank_name: '开户银行',
    remark: '备注',
    sort_order: '排序号',
    created_by: '创建人',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  quality_incoming_inspection: {
    id: '主键ID',
    inspection_no: '检验编号',
    inspection_type: '检验类型',
    standard_id: '检验标准ID',
    supplier_id: '供应商ID',
    supplier_name: '供应商名称',
    batch_no: '批次号',
    material_id: '料品ID',
    material_name: '料品名称',
    quantity: '抽检数量',
    result: '检验结果',
    status: '状态',
    inspector: '检验人',
    inspected_at: '检验时间',
    approved_by: '审核人',
    approved_at: '审核时间',
    remarks: '备注',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  quality_incoming_inspection_item: {
    id: '主键ID',
    inspection_id: '检验单ID',
    incoming_id: '来料检验主表ID',
    standard_id: '检验标准ID',
    item_name: '检验项目名称',
    item_category: '检验项目大类',
    inspection_method: '检验方法',
    sampling_method: '抽样方式',
    standard_value: '标准值',
    measured_value: '检测值',
    unit: '单位',
    result: '判定结果',
    inspector: '检测人',
    inspected_at: '检测时间',
    remarks: '备注',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  quality_microbe_inspection: {
    id: '主键ID',
    inspection_no: '检验编号',
    inspection_type: '检验类型',
    report_order_id: '关联报工单ID',
    incoming_id: '来料检验ID',
    order_id: '生产订单ID',
    standard_id: '检验标准ID',
    result: '检验结果',
    status: '状态',
    inspector: '检验人',
    inspected_at: '检验时间',
    approved_by: '审核人',
    approved_at: '审核时间',
    remarks: '备注',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  quality_microbe_inspection_item: {
    id: '主键ID',
    inspection_id: '检验主表ID',
    item_name: '检验项目名称',
    standard_value: '标准值',
    measured_value: '检测值',
    unit: '单位',
    result: '判定结果',
    inspector: '检测人',
    inspected_at: '检测时间',
    remarks: '备注',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
}

// 扫描数据库表结构，返回 { tables, columnsMap }
// tables: [{ table_name, category, purpose, field_count, record_count, last_update }]
// columnsMap: { [tableName]: [{ name, type, nullable, primaryKey, defaultValue, comment }] }
interface CollectSchemaOptions {
  /** 并发数（避免打满连接池），默认 8 */
  concurrency?: number
  /** MySQL 大表阈值（行数），超过则用 information_schema.TABLE_ROWS 近似值，避免全表 COUNT。默认 100_000 */
  mysqlApproxThreshold?: number
  /** 进度回调：用于刷新任务的状态更新 */
  onProgress?: (done: number, total: number, currentTable?: string) => void
}

async function collectDatabaseSchema(options: CollectSchemaOptions = {}) {
  const { concurrency = 8, mysqlApproxThreshold = 100_000, onProgress } = options
  const queryInterface = sequelize.getQueryInterface()
  const allTables = await queryInterface.showAllTables()
  const tables: any[] = []
  const columnsMap: Record<string, any[]> = {}
  const total = allTables.length
  let processed = 0

  const updateProgress = (currentTable?: string) => {
    processed++
    onProgress?.(processed, total, currentTable)
  }

  // ====== 1) 批量获取行数：策略按 DB 类型区分 ======
  const recordCountMap: Record<string, number> = {}
  const dialect = sequelize.getDialect()

  if (dialect === 'mysql') {
    // MySQL: 先从 information_schema 拿近似行数（毫秒级，TABLE_ROWS 是 InnoDB 估算值）
    const dbName = (sequelize.config?.database || process.env.DB_NAME) as string
    let approxRows: any[] = []
    try {
      approxRows = (await sequelize.query(
        `SELECT TABLE_NAME as tbl, TABLE_ROWS as cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = :dbName`,
        { type: QueryTypes.SELECT, replacements: { dbName } },
      )) as any[]
    } catch (e) {
      logger.warn('[collectDatabaseSchema] information_schema 查询失败，退化为逐表 COUNT:', e?.message)
      approxRows = []
    }
    const approxMap: Record<string, number> = {}
    for (const r of approxRows) approxMap[r.tbl] = Number(r.cnt) || 0

    // 大表（超过阈值）直接用近似值；小表用精确 COUNT(*)；未知表也用精确 COUNT
    const tablesNeedExactCount = allTables.filter((t: string) => {
      const approx = approxMap[t] ?? -1
      return approx < 0 || approx <= mysqlApproxThreshold
    })

    // 并发精确 COUNT
    if (tablesNeedExactCount.length > 0) {
      const exactResults = await runConcurrently(
        tablesNeedExactCount,
        async (t: string) => {
          try {
            const r = await sequelize.query(`SELECT COUNT(*) as count FROM \`${t}\``, { type: QueryTypes.SELECT })
            return { table: t, count: Number((r[0] as any)?.count ?? 0) }
          } catch {
            return { table: t, count: approxMap[t] || 0 }
          }
        },
        concurrency,
      )
      for (const r of exactResults) {
        recordCountMap[r.table] = r.count
      }
    }
    // 大表用近似值填充
    for (const t of allTables) {
      if (recordCountMap[t] === undefined) recordCountMap[t] = approxMap[t] || 0
    }
  } else {
    // SQLite: 逐表并发 COUNT (*)
    const countResults = await runConcurrently(
      allTables,
      async (t: string) => {
        try {
          const r = await sequelize.query(`SELECT COUNT(*) as count FROM "${t}"`, { type: QueryTypes.SELECT })
          return { table: t, count: Number((r[0] as any)?.count ?? 0) }
        } catch {
          return { table: t, count: 0 }
        }
      },
      concurrency,
    )
    for (const r of countResults) recordCountMap[r.table] = r.count
  }

  // ====== 2) 并发获取所有表结构 describeTable ======
  const describeResults = await runConcurrently(
    allTables,
    async (t: string) => {
      try {
        const cols = await queryInterface.describeTable(t)
        const colComments = columnCommentMap[t] || {}
        const colList = Object.entries(cols).map(([name, col]: [string, any]) => ({
          name,
          type: col.type,
          nullable: col.allowNull,
          primaryKey: col.primaryKey,
          defaultValue:
            col.defaultValue !== undefined && col.defaultValue !== null
              ? String(col.defaultValue).replace(/'/g, '')
              : null,
          comment: col.comment || colComments[name] || '',
        }))
        return { table: t, cols: colList, ok: true }
      } catch (e) {
        return { table: t, cols: [], ok: false }
      } finally {
        updateProgress(t)
      }
    },
    concurrency,
  )

  for (const r of describeResults) {
    columnsMap[r.table] = r.cols
    const meta = tableCategoryMap[r.table] || { category: '其他', purpose: '' }
    tables.push({
      table_name: r.table,
      category: meta.category,
      purpose: meta.purpose,
      field_count: r.cols.length,
      record_count: recordCountMap[r.table] || 0,
      last_update: nowBeijingStr(),
    })
  }

  tables.sort((a, b) => {
    const catOrder: Record<string, number> = { '系统表': 0, '基础数据表': 1, '业务表': 2, '其他': 3 }
    const businessOrder = [
      'production_order',
      'production_report_order',
      'production_report_process',
      'production_manpower_record',
      'production_process_exception',
      'production_process_defect',
      'production_process_material',
      'production_report_image',
      'quality_product_inspection',
      'quality_product_inspection_item',
    ]
    if (a.category === b.category && a.category === '业务表') {
      const ai = businessOrder.indexOf(a.table_name)
      const bi = businessOrder.indexOf(b.table_name)
      if (ai >= 0 && bi >= 0) return ai - bi
      if (ai >= 0) return -1
      if (bi >= 0) return 1
    }
    return (catOrder[a.category] ?? 3) - (catOrder[b.category] ?? 3) || a.table_name.localeCompare(b.table_name)
  })

  return { tables, columnsMap }
}

// 数据库配置信息（密码脱敏）+ 数据表清单





export const initDefaultConfigs = async () => {
  for (const def of defaultConfigs) {
    const [record, created] = await SystemConfig.findOrCreate({
      where: { config_key: def.config_key },
      defaults: def,
    })
    if (created) continue
    // 对关键配置项，若当前值是历史旧默认值，则刷新为新默认值
    const legacy = LEGACY_DEFAULT_VALUES[def.config_key]
    if (legacy && legacy.includes(record.config_value)) {
      await record.update({ config_value: def.config_value, config_desc: def.config_desc })
    }
  }
}

// ===== 数据库迁移 =====

// 获取可用迁移目标（常见的几种数据库环境）
export const getMigrationTargets = async (req, res) => {
  try {
    const currentDialect = process.env.DB_DIALECT || 'sqlite'
    const targets = [
      {
        dialect: 'sqlite',
        name: 'SQLite（开发/单机版）',
        default_port: '-',
        default_storage: './data/milk_can_mes.sqlite',
        description: '嵌入式数据库，无需安装，适合开发演示与单机部署',
      },
      {
        dialect: 'mysql',
        name: 'MySQL 8（生产环境）',
        default_port: 3306,
        description: '推荐的生产级数据库，支持高并发与完整事务',
      },
      {
        dialect: 'postgres',
        name: 'PostgreSQL（高级环境）',
        default_port: 5432,
        description: '支持更复杂的查询与扩展类型，适合数据分析场景',
      },
      {
        dialect: 'mariadb',
        name: 'MariaDB（开源兼容）',
        default_port: 3306,
        description: 'MySQL 的开源分支，兼容 MySQL 协议',
      },
    ]
    // 标记当前正在使用的数据库类型
    const list = targets.map(t => ({ ...t, is_current: t.dialect === currentDialect }))
    return success(res, { current: currentDialect, targets: list }, '获取成功')
  } catch (err) {
    console.error('获取迁移目标失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 读取当前 .env 文件内容
function readEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return ''
  return fs.readFileSync(envPath, 'utf-8')
}

// 写入 .env 文件
function writeEnvFile(content) {
  const envPath = path.resolve(process.cwd(), '.env')
  fs.writeFileSync(envPath, content, 'utf-8')
}

// 更新或追加 .env 中的键值
function updateEnvLine(content, key, value) {
  const lines = content.split(/\r?\n/)
  const regex = new RegExp(`^\\s*${key}\\s*=`, 'i')
  let found = false
  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i])) {
      lines[i] = `${key}=${value}`
      found = true
      break
    }
  }
  if (!found) lines.push(`${key}=${value}`)
  return lines.join('\n')
}

// 执行数据迁移
// 入参：{ target: 'sqlite'|'mysql'|'postgres'|'mariadb', host, port, database, username, password, storage }
export const migrateDatabase = async (req, res) => {
  const username = req.user?.username || 'system'
  try {
    const target = (req.body?.target || '').toLowerCase()
    const validTargets = ['sqlite', 'mysql', 'postgres', 'mariadb']
    if (!validTargets.includes(target)) {
      return fail(res, '不支持的迁移目标数据库类型', ErrorCode.PARAM_INVALID)
    }
    // 1. 迁移前自动备份当前数据
    const currentDialect = process.env.DB_DIALECT || 'mysql'
    let backupInfo = null
    try {
      if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true })
      const ts = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+/, '').replace(' ', '_')

      if (currentDialect === 'sqlite' && fs.existsSync(SQLITE_PATH)) {
        const backupName = `backup_${ts}.sqlite`
        const backupPath = path.join(BACKUP_DIR, backupName)
        fs.copyFileSync(SQLITE_PATH, backupPath)
        const stat = fs.statSync(backupPath)
        backupInfo = {
          filename: backupName,
          size: stat.size,
          created_at: formatDateTime(stat.mtime),
        }
      } else if (currentDialect === 'mysql') {
        const backupName = `backup_${ts}.sql`
        const backupPath = path.join(BACKUP_DIR, backupName)
        const dbHost = process.env.DB_HOST || 'localhost'
        const dbPort = process.env.DB_PORT || '3306'
        const dbUser = process.env.DB_USER || 'root'
        const dbPassword = process.env.DB_PASSWORD || ''
        const dbName = process.env.DB_NAME || 'milk_can_mes'
        const passwordArg = dbPassword ? `-p${dbPassword}` : ''
        const cmd = `mysqldump -h ${dbHost} -P ${dbPort} -u ${dbUser} ${passwordArg} --default-character-set=utf8mb4 --single-transaction --routines --triggers ${dbName} > "${backupPath}"`

        await new Promise<void>((resolve, reject) => {
          exec(cmd, { timeout: 300000 }, (err) => {
            if (err) reject(err)
            else resolve()
          })
        })

        if (fs.existsSync(backupPath) && fs.statSync(backupPath).size > 0) {
          const stat = fs.statSync(backupPath)
          backupInfo = {
            filename: backupName,
            size: stat.size,
            created_at: formatDateTime(stat.mtime),
          }
        }
      }
    } catch (e) {
      console.error('迁移前自动备份失败:', e.message)
    }

    // 2. 测试目标数据库连接
    let targetSequelize
    try {
      if (target === 'sqlite') {
        const storage = req.body?.storage || './data/milk_can_mes.sqlite'
        const { Sequelize } = await import('sequelize')
        // 确保目录存在
        const storageAbs = path.resolve(process.cwd(), storage)
        const storageDir = path.dirname(storageAbs)
        if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true })
        targetSequelize = new Sequelize({
          dialect: 'sqlite',
          storage: storageAbs,
          logging: false,
          define: { timestamps: true, underscored: true },
        })
      } else {
        const { Sequelize } = await import('sequelize')
        targetSequelize = new Sequelize(
          req.body?.database || 'milk_can_mes',
          req.body?.username || 'root',
          req.body?.password || '',
          {
            host: req.body?.host || 'localhost',
            port: Number(req.body?.port) || (target === 'postgres' ? 5432 : 3306),
            dialect: target,
            logging: false,
            define: { timestamps: true, underscored: true },
          }
        )
      }
      await targetSequelize.authenticate()
    } catch (e) {
      return fail(res, `目标数据库连接失败：${e.message}`, ErrorCode.PARAM_INVALID)
    }

    // 3. 复制数据：从当前 sequelize 读取所有表数据，写入目标 sequelize
    const models = Object.values(sequelize.models || {})
    const result = { tables: [], total_rows: 0 }
    try {
      // 在目标数据库创建表结构
      const targetModels = []
      for (const model of models) {
        const Model = targetSequelize.define(model.name, model.getAttributes(), {
          tableName: model.getTableName(),
          timestamps: true,
          underscored: true,
        })
        targetModels.push(Model)
      }
      await targetSequelize.sync({ force: false, alter: false })

      // 逐表复制数据
      for (let i = 0; i < models.length; i++) {
        const srcModel = models[i]
        const dstModel = targetModels[i]
        const tableName = srcModel.getTableName()
        try {
          const rows = await srcModel.findAll({ raw: true })
          if (rows.length > 0) {
            // 批量插入，遇到错误则跳过该表（避免索引/约束冲突导致整体失败）
            try {
              await dstModel.bulkCreate(rows, { validate: false, ignoreDuplicates: true })
            } catch (e) {
              console.warn(`表 ${tableName} 批量插入部分失败:`, e.message)
            }
          }
          result.tables.push({ name: tableName, rows: rows.length })
          result.total_rows += rows.length
        } catch (e) {
          console.warn(`表 ${tableName} 数据迁移失败:`, e.message)
          result.tables.push({ name: tableName, rows: 0, error: e.message })
        }
      }
    } catch (e) {
      try { await targetSequelize.close() } catch (err) {
        logger.warn('[SilentCatch] 静默异常被捕获', err?.message)
    }
      return fail(res, `数据迁移失败：${e.message}`, ErrorCode.SYSTEM_ERROR)
    }

    // 4. 关闭目标连接
    try { await targetSequelize.close() } catch (err) {
        logger.warn('[SilentCatch] 静默异常被捕获', err?.message)
    }

    // 5. 更新 .env 文件，使下次启动时使用新数据库（密码不回写，需手动配置）
    let envContent = readEnvFile()
    const setEnv = (key, value) => { envContent = updateEnvLine(envContent, key, value) }
    setEnv('DB_DIALECT', target)
    if (target === 'sqlite') {
      setEnv('DB_STORAGE', req.body?.storage || './data/milk_can_mes.sqlite')
    } else {
      setEnv('DB_HOST', req.body?.host || 'localhost')
      setEnv('DB_PORT', req.body?.port || (target === 'postgres' ? 5432 : 3306))
      setEnv('DB_NAME', req.body?.database || 'milk_can_mes')
      setEnv('DB_USER', req.body?.username || 'root')
    }
    writeEnvFile(envContent)

    return success(res, {
      target,
      backup: backupInfo,
      migration: result,
      note: '迁移已完成。需要重启后端服务以使新数据库生效。',
    }, `数据迁移成功，共迁移 ${result.total_rows} 行数据`)
  } catch (err) {
    console.error('数据库迁移失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 刷新数据字典核心逻辑（扫描数据库表结构并持久化到 sys_data_dictionary）
// 带可选进度回调，用于异步任务的状态更新
async function refreshDictionaryDataInternal(options?: {
  concurrency?: number
  onProgress?: (done: number, total: number, currentTable?: string) => void
  onPersistProgress?: (done: number, total: number, currentTable?: string) => void
}) {
  const { concurrency, onProgress, onPersistProgress } = options || {}
  const { tables, columnsMap } = await collectDatabaseSchema({
    concurrency,
    onProgress,
  })
  const now = new Date()
  // 并发执行 upsert（分批）
  const total = tables.length
  const BATCH = 16
  let upsertCount = 0
  for (let i = 0; i < tables.length; i += BATCH) {
    const batch = tables.slice(i, i + BATCH)
    await Promise.all(
      batch.map(async (t) => {
        const fields = columnsMap[t.table_name] || []
        try {
          await DataDictionary.upsert({
            table_name: t.table_name,
            category: t.category,
            purpose: t.purpose,
            field_count: t.field_count,
            record_count: t.record_count,
            fields,
            last_update: now,
          })
        } finally {
          upsertCount++
          onPersistProgress?.(upsertCount, total, t.table_name)
        }
      }),
    )
  }
  // 删除字典表中已不存在的表（数据库中已删除的表）
  const allTableNames = tables.map((t) => t.table_name)
  if (allTableNames.length > 0) {
    await DataDictionary.destroy({ where: { table_name: { [Op.notIn]: allTableNames } } })
  }
  return { total: upsertCount, refreshed_at: formatDateTime(now) }
}

// 旧导出（同步执行，用于 init-db 等内部场景）—— 保持向后兼容
export const refreshDictionaryData = async () => refreshDictionaryDataInternal()

// 新导出：仅当字典表为空时才刷新（用于服务启动初始化，避免每次重启全表扫描）
export const refreshDictionaryDataIfEmpty = async () => {
  try {
    const n = await DataDictionary.count()
    if (n > 0) {
      console.log(`[DataDictionary] 字典表已有 ${n} 条记录，跳过初始化扫描`)
      return { skipped: true, existing: n }
    }
  } catch (e) {
    logger.warn('[DataDictionary] 检查字典表数据失败，将执行刷新:', e?.message)
  }
  const r = await refreshDictionaryDataInternal()
  return { skipped: false, ...r }
}

// ============= 异步刷新任务：提交 + 进度查询 =============

// 执行异步刷新后台任务（不阻塞）
async function runDictRefreshAsync(task: DictRefreshTask) {
  dictRefreshRunning = true
  try {
    task.status = 'running'
    task.message = '开始扫描数据库表结构'
    const result = await refreshDictionaryDataInternal({
      concurrency: 8,
      onProgress: (done, total, cur) => {
        task.processedTables = done
        task.totalTables = total
        task.currentTable = cur || ''
        task.message = `扫描表结构 ${done}/${total}${cur ? `（当前: ${cur}）` : ''}`
      },
      onPersistProgress: (done, total, cur) => {
        task.processedTables = done
        task.totalTables = total
        task.currentTable = cur || ''
        task.message = `写入字典表 ${done}/${total}${cur ? `（当前: ${cur}）` : ''}`
      },
    })
    task.status = 'success'
    task.message = `刷新完成，共 ${result.total} 张表`
    task.result = result
    task.finishedAt = Date.now()
  } catch (e: any) {
    task.status = 'failed'
    task.error = e?.message || String(e)
    task.message = `刷新失败：${task.error}`
    task.finishedAt = Date.now()
    console.error('[DataDictionary] 异步刷新失败:', e)
  } finally {
    dictRefreshRunning = false
    dictRefreshLastAt = Date.now()
  }
}

// POST /refresh —— 立即返回任务 ID，后台异步刷新
export const refreshDataDictionary = async (req, res) => {
  // 1) 频率限制
  const nowTs = Date.now()
  if (dictRefreshRunning) {
    // 已有任务在跑，返回当前运行中的任务
    const running = Array.from(dictRefreshTaskStore.values()).find((t) => t.status === 'running')
    if (running) {
      return success(
        res,
        { taskId: running.taskId, status: running.status, message: '已有刷新任务运行中，请稍后查询进度' },
        '已有刷新任务运行中',
      )
    }
  }
  const elapsed = nowTs - dictRefreshLastAt
  if (dictRefreshLastAt > 0 && elapsed < DICT_REFRESH_MIN_INTERVAL_MS) {
    const remain = Math.ceil((DICT_REFRESH_MIN_INTERVAL_MS - elapsed) / 1000)
    return fail(
      res,
      `刷新操作过于频繁，请在 ${remain} 秒后重试（已限制为每 60 秒最多一次）`,
      ErrorCode.RATE_LIMITED,
    )
  }
  // 2) 创建任务并立即返回
  const taskId = generateTaskId()
  const task: DictRefreshTask = {
    taskId,
    status: 'pending',
    totalTables: 0,
    processedTables: 0,
    currentTable: '',
    message: '任务已排队，即将开始执行',
    startedAt: nowTs,
  }
  dictRefreshTaskStore.set(taskId, task)
  // 最多保留最近 20 个任务记录
  if (dictRefreshTaskStore.size > 20) {
    const oldestFirst = Array.from(dictRefreshTaskStore.keys()).slice(0, dictRefreshTaskStore.size - 20)
    oldestFirst.forEach((k) => dictRefreshTaskStore.delete(k))
  }
  // 异步启动（不 await）
  setImmediate(() => runDictRefreshAsync(task))
  return success(res, { taskId, status: task.status, message: task.message }, '刷新任务已提交，可通过 taskId 查询进度')
}

// GET /refresh/:taskId —— 查询刷新任务进度
export const getRefreshProgress = async (req, res) => {
  const { taskId } = req.params
  if (!taskId) return fail(res, 'taskId 不能为空', ErrorCode.PARAM_INVALID)
  const task = dictRefreshTaskStore.get(taskId)
  if (!task) return fail(res, '任务不存在或已过期', ErrorCode.RECORD_NOT_FOUND)
  const payload = {
    taskId: task.taskId,
    status: task.status,
    totalTables: task.totalTables,
    processedTables: task.processedTables,
    currentTable: task.currentTable,
    message: task.message,
    progressPercent:
      task.totalTables > 0 ? Math.min(100, Math.round((task.processedTables / task.totalTables) * 100)) : 0,
    startedAt: task.startedAt ? formatDateTime(task.startedAt) : null,
    finishedAt: task.finishedAt ? formatDateTime(task.finishedAt) : null,
    error: task.error || null,
    result: task.result || null,
  }
  return success(res, payload, '查询成功')
}

// 查询数据字典列表（服务端筛选+分页）
export const listDataDictionary = async (req, res) => {
  try {
    const { keyword, category, page = 1, pageSize = 30 } = req.query
    const where: any = {}
    if (keyword) {
      where[Op.or] = [
        { table_name: { [Op.like]: `%${keyword}%` } },
        { purpose: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (category) {
      where.category = category
    }
    const limit = Math.min(parseInt(pageSize, 10) || 30, 200)
    const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit
    const { rows, count } = await DataDictionary.findAndCountAll({
      where,
      order: [
        // 按分类排序：系统表/基础数据表/业务表/其他
        sequelize.literal(`CASE category WHEN '系统表' THEN 0 WHEN '基础数据表' THEN 1 WHEN '业务表' THEN 2 ELSE 3 END`),
        // 业务表按自定义顺序排序
        sequelize.literal(`CASE table_name 
          WHEN 'production_order' THEN 0
          WHEN 'production_work_order' THEN 1
          WHEN 'production_process_report' THEN 2
          WHEN 'production_manpower_record' THEN 3
          WHEN 'production_process_exception' THEN 4
          WHEN 'production_process_defect' THEN 5
          WHEN 'production_process_material' THEN 6
          ELSE 999
        END`),
        ['table_name', 'ASC'],
      ],
      limit,
      offset,
    })
    return success(res, { list: rows, total: count }, '获取成功')
  } catch (err) {
    console.error('查询数据字典失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

