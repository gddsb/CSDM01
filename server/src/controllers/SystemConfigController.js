import { SystemConfig, DataDictionary } from '../models/index.js'
import { success, fail } from '../utils/response.js'
import sequelize from '../config/database.js'
import { Sequelize, Op } from 'sequelize'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import http from 'http'
import net from 'net'

// 默认配置（设计文档 §2.2.2 系统配置表）
const defaultConfigs = [
  { config_key: 'system_name', config_value: '长沙大满MES', config_desc: '系统名称' },
  { config_key: 'system_version', config_value: 'V1.0.0.236', config_desc: '系统版本（只读）' },
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

// 获取系统配置（键值对）
export const getConfig = async (req, res) => {
  try {
    const configs = await SystemConfig.findAll()
    const result = {}
    configs.forEach(c => {
      result[c.config_key] = c.config_value
    })
    for (const def of defaultConfigs) {
      if (result[def.config_key] === undefined) {
        result[def.config_key] = def.config_value
      }
    }
    return success(res, result, '获取成功')
  } catch (err) {
    console.error('获取系统配置失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 保存系统配置（system_version 只读，不允许通过此接口修改）
export const saveConfig = async (req, res) => {
  try {
    const configs = { ...req.body }
    // 系统版本只读，强制忽略前端传入的值
    delete configs.system_version
    const username = req.user?.username || 'system'
    for (const [key, value] of Object.entries(configs)) {
      const val = typeof value === 'object' ? JSON.stringify(value) : String(value)
      const [config, created] = await SystemConfig.findOrCreate({
        where: { config_key: key },
        defaults: { config_value: val, config_desc: key, updated_by: username },
      })
      if (!created) {
        await config.update({ config_value: val, updated_by: username })
      }
    }
    return success(res, null, '保存成功')
  } catch (err) {
    console.error('保存系统配置失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 项目环境信息（只读展示）
export const getEnvironment = async (req, res) => {
  try {
    const mem = process.memoryUsage()

    // 读取后端 package.json 获取版本
    let backendPkg = {}
    try {
      const pkgPath = path.resolve(process.cwd(), 'package.json')
      backendPkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    } catch (e) { /* ignore */ }

    // 读取前端 package.json 获取版本
    let frontendPkg = {}
    try {
      const pkgPath = path.resolve(process.cwd(), '..', 'package.json')
      frontendPkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    } catch (e) { /* ignore */ }

    const getDepVersion = (pkg, name) => {
      if (!pkg) return 'unknown'
      let v = pkg.dependencies?.[name]
      if (!v) v = pkg.devDependencies?.[name]
      return v ? v.replace(/^[\^~]/, '') : 'unknown'
    }

    // 技术栈信息
    const tech_stack = {
      frontend: {
        name: '前端技术栈',
        items: [
          { key: 'React', version: getDepVersion(frontendPkg, 'react'), category: '框架' },
          { key: 'Ant Design', version: getDepVersion(frontendPkg, 'antd'), category: 'UI组件库' },
          { key: 'React Router', version: getDepVersion(frontendPkg, 'react-router-dom'), category: '路由' },
          { key: 'Vite', version: getDepVersion(frontendPkg, 'vite'), category: '构建工具' },
          { key: 'Axios', version: getDepVersion(frontendPkg, 'axios'), category: 'HTTP客户端' },
          { key: 'Day.js', version: getDepVersion(frontendPkg, 'dayjs'), category: '日期处理' },
          { key: 'ECharts', version: getDepVersion(frontendPkg, 'echarts'), category: '数据可视化' },
          { key: '@ant-design/icons', version: getDepVersion(frontendPkg, '@ant-design/icons'), category: '图标库' },
        ],
        version: frontendPkg.version || 'unknown',
      },
      backend: {
        name: '后端技术栈',
        items: [
          { key: 'Node.js', version: process.version.replace(/^v/, ''), category: '运行环境' },
          { key: 'Express', version: getDepVersion(backendPkg, 'express'), category: 'Web框架' },
          { key: 'Sequelize', version: Sequelize.version || getDepVersion(backendPkg, 'sequelize'), category: 'ORM框架' },
          { key: 'SQLite', version: getDepVersion(backendPkg, 'sqlite3'), category: '数据库' },
          { key: 'MySQL', version: getDepVersion(backendPkg, 'mysql2'), category: '数据库' },
          { key: 'JWT (jsonwebtoken)', version: getDepVersion(backendPkg, 'jsonwebtoken'), category: '身份认证' },
          { key: 'bcryptjs', version: getDepVersion(backendPkg, 'bcryptjs'), category: '密码加密' },
          { key: 'Multer', version: getDepVersion(backendPkg, 'multer'), category: '文件上传' },
          { key: 'CORS', version: getDepVersion(backendPkg, 'cors'), category: '跨域中间件' },
          { key: 'dotenv', version: getDepVersion(backendPkg, 'dotenv'), category: '环境变量' },
          { key: 'Morgan', version: getDepVersion(backendPkg, 'morgan'), category: '日志中间件' },
        ],
        version: backendPkg.version || 'unknown',
      },
    }

    // 操作系统版本
    let os_version = ''
    let os_hostname = ''
    let os_type = ''
    let os_release = ''
    let os_uptime = 0
    let cpus = []
    try {
      const os = await import('os')
      os_type = os.type()
      os_release = os.release()
      os_hostname = os.hostname()
      os_uptime = Math.floor(os.uptime())
      os_version = `${os.type()} ${os.release()} (${os.arch()})`
      cpus = os.cpus() || []
    } catch (e) {
      os_version = `${process.platform} ${process.arch}`
    }
    // 磁盘信息（当前工作目录所在分区）
    let disk_info = { total: 0, free: 0, used: 0, used_percent: 0, mount: '' }
    try {
      const targetPath = process.cwd()
      const isWin = process.platform === 'win32'
      const { execFile } = await import('child_process')
      await new Promise((resolve) => {
        if (isWin) {
          execFile('wmic', ['logicaldisk', 'where', "DeviceID='C:'", 'get', 'Size,FreeSpace', '/format:csv'], { timeout: 3000 }, (err, stdout) => {
            if (!err && stdout) {
              const lines = stdout.trim().split(/\r?\n/).filter(Boolean)
              const line = lines[lines.length - 1]
              const parts = line.split(',').filter(Boolean)
              if (parts.length >= 2) {
                const free = Number(parts[0])
                const total = Number(parts[1])
                if (total > 0) {
                  disk_info = {
                    total, free, used: total - free,
                    used_percent: Number(((total - free) / total * 100).toFixed(1)),
                    mount: 'C:',
                  }
                }
              }
            }
            resolve()
          })
        } else {
          execFile('df', ['-k', targetPath], { timeout: 3000 }, (err, stdout) => {
            if (!err && stdout) {
              const lines = stdout.trim().split(/\r?\n/)
              if (lines.length >= 2) {
                const parts = lines[1].trim().split(/\s+/)
                if (parts.length >= 6) {
                  const total = Number(parts[1]) * 1024
                  const used = Number(parts[2]) * 1024
                  const free = Number(parts[3]) * 1024
                  const usedPercent = Number(parts[4].replace('%', ''))
                  disk_info = { total, free, used, used_percent: usedPercent, mount: parts[5] }
                }
              }
            }
            resolve()
          })
        }
      })
    } catch (e) {
      // 磁盘信息获取失败，保持默认值
    }
    const checkPort = (port, hostname = 'localhost') => {
      return new Promise((resolve) => {
        const socket = new net.Socket()
        const timer = setTimeout(() => {
          socket.destroy()
          resolve(false)
        }, 1000)
        socket.once('connect', () => {
          clearTimeout(timer)
          socket.destroy()
          resolve(true)
        })
        socket.once('error', () => {
          clearTimeout(timer)
          socket.destroy()
          resolve(false)
        })
        socket.connect(port, hostname)
      })
    }

    // 从请求头推断前端实际访问端口（Origin/Referer）
    let frontend_port = parseInt(process.env.VITE_PORT, 10) || 5173
    const originHeader = req.headers.origin || req.headers.referer || ''
    if (originHeader) {
      try {
        const match = originHeader.match(/^https?:\/\/[^:/]+(?::(\d+))?/)
        if (match && match[1]) {
          frontend_port = parseInt(match[1], 10)
        } else if (match && !match[1]) {
          // 标准端口 80/443，前端由 nginx 等反向代理提供，视为运行中
          frontend_port = originHeader.startsWith('https') ? 443 : 80
        }
      } catch (e) { /* 解析失败保持默认 */ }
    }
    const backend_port = parseInt(process.env.PORT, 10) || 3001
    // 后端能响应此请求，说明后端正在运行
    const backend_running = true
    const frontend_running = await checkPort(frontend_port)

    const info = {
      node_version: process.version,
      platform: `${process.platform} ${process.arch}`,
      os_type: os_type,
      os_release: os_release,
      os_version: os_version,
      os_hostname: os_hostname,
      os_uptime: os_uptime,
      cpu_count: cpus.length,
      cpu_model: cpus.length > 0 ? cpus[0].model : '',
      pid: process.pid,
      uptime: Math.floor(process.uptime()),
      cwd: process.cwd(),
      env: process.env.NODE_ENV || 'development',
      memory_rss: Math.round(mem.rss / 1024 / 1024),
      memory_heap_used: Math.round(mem.heapUsed / 1024 / 1024),
      memory_heap_total: Math.round(mem.heapTotal / 1024 / 1024),
      disk_total: disk_info.total,
      disk_free: disk_info.free,
      disk_used: disk_info.used,
      disk_used_percent: disk_info.used_percent,
      disk_mount: disk_info.mount,
      sequelize_version: Sequelize.version || 'unknown',
      tech_stack,
      server_time: new Date().toISOString(),
      frontend_server: {
        name: '前端服务器 (Vite)',
        status: frontend_running ? 'running' : 'offline',
        port: frontend_port,
      },
      backend_server: {
        name: '后端服务器 (Express)',
        status: backend_running ? 'running' : 'offline',
        port: backend_port,
      },
    }
    return success(res, info, '获取成功')
  } catch (err) {
    console.error('获取项目环境失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 重启后端服务
export const restartServer = async (req, res) => {
  try {
    const result = {
      message: '服务正在重启，请稍候...',
      estimated_time: 5000,
      restart_time: new Date().toISOString(),
    }
    res.json({ code: 200, success: true, data: result, message: '重启指令已发送' })

    // 延迟 500ms 后启动新进程并退出当前进程
    const restartDelay = 500
    setTimeout(async () => {
      try {
        const { exec } = await import('child_process')
        const nodeBin = process.execPath
        const scriptPath = path.resolve(process.cwd(), 'src', 'app.js')
        const logPath = path.resolve(process.cwd(), 'restart.log')

        // 使用 nohup 方式启动新进程，确保脱离父进程
        const cmd = process.platform === 'win32'
          ? `start /B "" "${nodeBin}" "${scriptPath}"`
          : `nohup "${nodeBin}" "${scriptPath}" >> "${logPath}" 2>&1 &`

        exec(cmd, { cwd: process.cwd(), env: { ...process.env, RESTARTED: '1' } }, (err) => {
          if (err) console.error('启动新进程失败:', err)
          process.exit(0)
        })
      } catch (restartErr) {
        console.error('重启失败:', restartErr)
      }
    }, restartDelay)
  } catch (err) {
    console.error('重启服务失败:', err)
    return fail(res, '重启服务失败', 500)
  }
}

// 表名 → { category, purpose }（数据库表结构元数据，模块级常量）
const tableCategoryMap = {
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
  bas_material: { category: '基础数据表', purpose: '料品档案表，存储奶粉罐料品基础信息及规格参数' },
  bas_customer: { category: '基础数据表', purpose: '客户档案表，存储客户基本信息及信用等级' },
  master_production_line: { category: '基础数据表', purpose: '产线表，管理生产线的编号、名称、车间及状态，与工序多对多关联' },
  master_process: { category: '基础数据表', purpose: '工序表，定义奶粉罐生产工序名称及顺序' },
  master_device: { category: '基础数据表', purpose: '设备档案表，存储设备基础信息及特种设备检定日期' },
  master_defect_type: { category: '基础数据表', purpose: '不良分类表，按大类名称和分类名称二级分类管理不良项及单位' },
  master_defect_image: { category: '基础数据表', purpose: '不良图片表，存储不良项的示例图片用于参考对比' },
  bas_line_process: { category: '基础数据表', purpose: '产线工序关联表，描述产线与工序的多对多关系，支持排序' },
  bas_line_device: { category: '基础数据表', purpose: '产线设备关联表，描述产线、设备与工序的三方关联' },
  production_order: { category: '业务表', purpose: '生产订单表，记录生产订单信息及计划数量' },
  production_work_order: { category: '业务表', purpose: '工单表，记录生产工单及工时计算数据' },
  production_process_report: { category: '业务表', purpose: '工序报工记录表，记录每道工序的产量和不良数据' },
  production_manpower_record: { category: '业务表', purpose: '人员投入记录表，记录工单的人员配置及班次' },
  production_exception_record: { category: '业务表', purpose: '异常工时记录表，记录生产异常及关联订单工单' },
}

// 表名 → { 字段名: 中文注释 }（数据库表结构元数据，模块级常量）
const columnCommentMap = {
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
    inspection_cycle: '检定周期',
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
    order_no: '订单编号',
    material_id: '料品ID',
    material_code: '料品编码',
    material_name: '料品名称',
    specification: '规格型号',
    film_version: '菲林版本',
    version_no: '版本号',
    planned_qty: '计划数量',
    finished_qty: '已完工数量',
    plan_start_time: '计划开始时间',
    plan_end_time: '计划完成时间',
    status: '订单状态（0开立 1已下达 2已关闭）',
    release_time: '下达时间',
    close_time: '关闭时间',
    created_by: '创建人',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  production_work_order: {
    work_order_id: '工单ID（主键）',
    work_order_no: '工单编号',
    order_id: '生产订单ID',
    order_no: '生产订单编号',
    line_id: '产线ID',
    line_name: '产线名称',
    material_id: '料品ID',
    material_name: '料品名称',
    target_qty: '计划数量',
    finished_qty: '已完成数量',
    start_time: '开工时间',
    finish_time: '完工时间',
    total_hours: '总工时',
    effective_hours: '有效工时',
    labor_hours: '人工工时',
    status: '工单状态（0开立 1开工 2关闭 3完工）',
    created_by: '创建人',
    created_at: '创建时间',
    updated_at: '更新时间',
  },
  production_process_report: {
    report_id: '报工ID（主键）',
    work_order_id: '工单ID',
    work_order_no: '工单编号',
    process_id: '工序ID',
    process_name: '工序名称',
    input_qty: '投入数量',
    defect_material: '来料不良数量',
    defect_process: '制程不良数量',
    defect_scrap: '检验报废数量',
    output_qty: '产出数量',
    device_id: '设备ID',
    device_name: '设备名称',
    report_user: '报工人账号',
    report_user_name: '报工人姓名',
    report_time: '报工时间',
    created_at: '创建时间',
  },
  production_manpower_record: {
    record_id: '记录ID（主键）',
    work_order_id: '工单ID',
    work_order_no: '工单编号',
    skilled_workers: '熟练工人数',
    general_workers: '普通工人数',
    contract_workers: '合同工人数',
    auxiliary_workers: '辅助工人数',
    remarks: '备注',
    record_user: '记录人账号',
    record_user_name: '记录人姓名',
    created_at: '创建时间',
  },
  production_exception_record: {
    record_id: '异常记录ID（主键）',
    work_order_id: '工单ID',
    work_order_no: '工单编号',
    order_id: '生产订单ID',
    order_no: '生产订单编号',
    exception_type: '异常类型',
    exception_type_name: '异常类型名称',
    device_id: '设备ID',
    device_name: '设备名称',
    start_time: '开始时间',
    end_time: '结束时间',
    duration: '持续时间(小时)',
    reason: '异常原因',
    handle_result: '处理结果',
    record_user: '记录人账号',
    record_user_name: '记录人姓名',
    created_at: '创建时间',
  },
}

// 扫描数据库表结构，返回 { tables, columnsMap }
// tables: [{ table_name, category, purpose, field_count, record_count, last_update }]
// columnsMap: { [tableName]: [{ name, type, nullable, primaryKey, defaultValue, comment }] }
async function collectDatabaseSchema() {
  const queryInterface = sequelize.getQueryInterface()
  const allTables = await queryInterface.showAllTables()
  const tables = []
  const columnsMap = {}

  for (const tableName of allTables) {
    let recordCount = 0
    try {
      const result = await sequelize.query(`SELECT COUNT(*) as count FROM "${tableName}"`, { type: sequelize.QueryTypes.SELECT })
      recordCount = result[0]?.count || 0
    } catch (e) {
      // ignore
    }
    const cols = await queryInterface.describeTable(tableName)
    const colComments = columnCommentMap[tableName] || {}
    const colList = Object.entries(cols).map(([name, col]) => ({
      name,
      type: col.type,
      nullable: col.allowNull,
      primaryKey: col.primaryKey,
      defaultValue: col.defaultValue !== undefined && col.defaultValue !== null ? String(col.defaultValue).replace(/'/g, '') : null,
      comment: col.comment || colComments[name] || '',
    }))
    columnsMap[tableName] = colList

    const meta = tableCategoryMap[tableName] || { category: '其他', purpose: '' }
    tables.push({
      table_name: tableName,
      category: meta.category,
      field_count: colList.length,
      record_count: recordCount,
      purpose: meta.purpose,
      last_update: new Date().toISOString(),
    })
  }

  tables.sort((a, b) => {
    const catOrder = { '系统表': 0, '基础数据表': 1, '业务表': 2, '其他': 3 }
    return (catOrder[a.category] - catOrder[b.category]) || a.table_name.localeCompare(b.table_name)
  })

  return { tables, columnsMap }
}

// 数据库配置信息（密码脱敏）+ 数据表清单
export const getDatabaseInfo = async (req, res) => {
  try {
    const dialect = process.env.DB_DIALECT || 'sqlite'
    const info = {
      dialect,
      host: process.env.DB_HOST || (dialect === 'sqlite' ? '-' : 'localhost'),
      port: process.env.DB_PORT || (dialect === 'sqlite' ? '-' : 3306),
      database: process.env.DB_NAME || (dialect === 'sqlite' ? 'milk_can_mes.sqlite' : 'milk_can_mes'),
      username: process.env.DB_USER || (dialect === 'sqlite' ? '-' : 'root'),
      password_set: !!(process.env.DB_PASSWORD && process.env.DB_PASSWORD.length > 0),
      storage: dialect === 'sqlite' ? (process.env.DB_STORAGE || './data/milk_can_mes.sqlite') : '-',
    }
    try {
      await sequelize.authenticate()
      info.connection_status = 'connected'
    } catch (e) {
      info.connection_status = 'error'
      info.connection_error = e.message
    }

    const { tables, columnsMap } = await collectDatabaseSchema()

    info.tables = tables
    info.columns = columnsMap
    info.table_count = tables.length

    return success(res, info, '获取成功')
  } catch (err) {
    console.error('获取数据库配置失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 备份目录（仅 SQLite 支持，MySQL 需调用 mysqldump）
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const BACKUP_DIR = path.resolve(__dirname, '../../data/backups')
const SQLITE_PATH = path.resolve(__dirname, '../../data/milk_can_mes.sqlite')

// 列出备份文件
export const listBackups = async (req, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true })
      return success(res, [], '获取成功')
    }
    const files = fs.readdirSync(BACKUP_DIR)
    const backups = files
      .filter(f => f.endsWith('.sqlite') || f.endsWith('.db'))
      .map(f => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f))
        return {
          filename: f,
          size: stat.size,
          created_at: stat.mtime.toISOString(),
        }
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    return success(res, backups, '获取成功')
  } catch (err) {
    console.error('列出备份失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 创建备份
export const createBackup = async (req, res) => {
  try {
    const dialect = process.env.DB_DIALECT || 'sqlite'
    if (dialect !== 'sqlite') {
      return fail(res, '当前数据库类型暂不支持界面备份，请使用数据库管理工具进行备份', 400)
    }
    if (!fs.existsSync(SQLITE_PATH)) {
      return fail(res, '数据库文件不存在', 404)
    }
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true })
    }
    const ts = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+/, '').replace(' ', '_')
    const filename = `backup_${ts}.sqlite`
    const target = path.join(BACKUP_DIR, filename)
    // 使用 copyFileSync 创建备份
    fs.copyFileSync(SQLITE_PATH, target)
    const stat = fs.statSync(target)
    return success(res, { filename, size: stat.size, created_at: stat.mtime.toISOString() }, '备份成功')
  } catch (err) {
    console.error('创建备份失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 还原备份
export const restoreBackup = async (req, res) => {
  try {
    const dialect = process.env.DB_DIALECT || 'sqlite'
    if (dialect !== 'sqlite') {
      return fail(res, '当前数据库类型暂不支持界面还原，请使用数据库管理工具进行还原', 400)
    }
    const { filename } = req.body
    if (!filename) return fail(res, '请选择备份文件', 400)
    // 防止路径穿越
    const safe = path.basename(filename)
    const source = path.join(BACKUP_DIR, safe)
    if (!fs.existsSync(source)) return fail(res, '备份文件不存在', 404)
    // 关闭当前连接后再还原
    fs.copyFileSync(source, SQLITE_PATH)
    return success(res, null, '还原成功，建议重启服务以使连接生效')
  } catch (err) {
    console.error('还原备份失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 删除备份
export const deleteBackup = async (req, res) => {
  try {
    const { filename } = req.params
    const safe = path.basename(filename)
    const target = path.join(BACKUP_DIR, safe)
    if (!fs.existsSync(target)) return fail(res, '备份文件不存在', 404)
    fs.unlinkSync(target)
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除备份失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 需要强制同步默认值的关键配置项
// 这些 key 的值若与历史旧默认值一致，则刷新为新默认值（避免覆盖用户自定义值）
const LEGACY_DEFAULT_VALUES = {
  system_name: ['奶粉罐MES', '奶粉罐生产系统', '长沙大满生产制造系统'],
  company_name: ['恒丰包装科技有限公司'],
  shift_setting: ['白班,夜班', '白班,夜班,中班'],
  default_line: [''],
}

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
    return fail(res, '服务器错误', 500)
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
      return fail(res, '不支持的迁移目标数据库类型', 400)
    }
    // 1. 迁移前自动备份当前数据（仅 SQLite 支持界面备份）
    const currentDialect = process.env.DB_DIALECT || 'sqlite'
    let backupInfo = null
    if (currentDialect === 'sqlite') {
      try {
        if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true })
        if (fs.existsSync(SQLITE_PATH)) {
          const ts = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+/, '').replace(' ', '_')
          const backupName = `backup_${ts}.sqlite`
          const backupPath = path.join(BACKUP_DIR, backupName)
          fs.copyFileSync(SQLITE_PATH, backupPath)
          const stat = fs.statSync(backupPath)
          backupInfo = {
            filename: backupName,
            size: stat.size,
            created_at: stat.mtime.toISOString(),
          }
        }
      } catch (e) {
        console.error('迁移前自动备份失败:', e.message)
      }
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
      return fail(res, `目标数据库连接失败：${e.message}`, 400)
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
      try { await targetSequelize.close() } catch (closeErr) {}
      return fail(res, `数据迁移失败：${e.message}`, 500)
    }

    // 4. 关闭目标连接
    try { await targetSequelize.close() } catch (e) {}

    // 5. 更新 .env 文件，使下次启动时使用新数据库
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
      setEnv('DB_PASSWORD', req.body?.password || '')
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
    return fail(res, '服务器错误', 500)
  }
}

// 刷新数据字典：扫描数据库表结构并持久化到 sys_data_dictionary
export const refreshDataDictionary = async (req, res) => {
  try {
    const { tables, columnsMap } = await collectDatabaseSchema()
    const now = new Date()
    let upsertCount = 0
    for (const t of tables) {
      const fields = columnsMap[t.table_name] || []
      await DataDictionary.upsert({
        table_name: t.table_name,
        category: t.category,
        purpose: t.purpose,
        field_count: t.field_count,
        record_count: t.record_count,
        fields,
        last_update: now,
      })
      upsertCount++
    }
    // 删除字典表中已不存在的表（数据库中已删除的表）
    const allTableNames = tables.map(t => t.table_name)
    if (allTableNames.length > 0) {
      await DataDictionary.destroy({ where: { table_name: { [Op.notIn]: allTableNames } } })
    }
    return success(res, { total: upsertCount, refreshed_at: now.toISOString() }, `数据字典更新成功，共 ${upsertCount} 张表`)
  } catch (err) {
    console.error('刷新数据字典失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 查询数据字典列表（服务端筛选+分页）
export const listDataDictionary = async (req, res) => {
  try {
    const { keyword, category, page = 1, pageSize = 30 } = req.query
    const where = {}
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
        ['table_name', 'ASC'],
      ],
      limit,
      offset,
    })
    return success(res, { list: rows, total: count }, '获取成功')
  } catch (err) {
    console.error('查询数据字典失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export default {
  getConfig,
  saveConfig,
  getEnvironment,
  getDatabaseInfo,
  listDataDictionary,
  refreshDataDictionary,
  listBackups,
  createBackup,
  restoreBackup,
  deleteBackup,
  migrateDatabase,
  getMigrationTargets,
  initDefaultConfigs,
}
