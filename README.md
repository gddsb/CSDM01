# 奶粉罐生产管理系统 (Milk Can MES)

> 版本：v4.3.0
>
> 东莞市大满包装实业有限公司长沙分公司 — 奶粉罐生产制造执行系统

基于 React + Ant Design + Vite + Node.js + SQLite/MySQL 构建的现代化生产制造执行系统，覆盖生产管理、质量管理、设备管理、数据大屏、报表中心等核心业务模块。

---

## 目录

- [项目概述](#项目概述)
- [技术栈](#技术栈)
- [功能模块](#功能模块)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [默认登录账号](#默认登录账号)
- [主题系统](#主题系统)
- [页面布局规范](#页面布局规范)
- [业务状态流转](#业务状态流转)
- [大屏看板规则](#大屏看板规则)
- [API 接口概览](#api-接口概览)
- [数据库模型](#数据库模型)
- [编码规则系统](#编码规则系统)
- [用户设置与头像](#用户设置与头像)
- [系统配置与运维](#系统配置与运维)
- [开发规范与要求](#开发规范与要求)
- [后续规划功能](#后续规划功能)
- [常见问题](#常见问题)

---

## 项目概述

奶粉罐生产管理系统（Milk Can MES）是一套面向金属包装制造行业的生产制造执行系统，针对奶粉罐生产过程的全流程数字化管理需求而设计。系统涵盖从基础数据维护、生产订单下发、工单执行、质量检验、设备管理到数据可视化的完整业务链条。

### 核心价值

- **生产透明化**：实时掌握订单进度、工单状态、产线运行情况
- **质量可追溯**：全流程质量数据记录，支持正向/反向追溯
- **设备可视化**：设备档案、点检、维修、OEE 分析一体化
- **决策数据化**：多维度报表与大屏看板，数据驱动决策
- **体验个性化**：六套主题配色，支持自定义头像，灵活适配不同使用场景

---

## 技术栈

### 前端技术栈

| 技术 | 版本 | 分类 | 说明 |
|------|------|------|------|
| React | 18.3 | 核心框架 | 前端 UI 框架 |
| React DOM | 18.3 | 核心框架 | React DOM 渲染 |
| React Router DOM | 6.26 | 路由管理 | 声明式路由，支持嵌套路由与路由守卫 |
| Ant Design | 5.21 | UI 组件库 | 企业级 UI 设计，支持暗色模式 |
| @ant-design/icons | 5.5 | 图标库 | Ant Design 官方图标库 |
| Vite | 5.4 | 构建工具 | 下一代前端构建工具，开发热更新 |
| @vitejs/plugin-react | 4.3 | Vite 插件 | React 支持插件 |
| Axios | 1.18 | HTTP 客户端 | 统一请求拦截与响应处理 |
| Day.js | 1.11 | 日期处理 | 轻量级日期时间库 |
| ECharts | 6.1 | 图表库 | 大屏数据可视化 |
| CSS Variables | - | 主题系统 | 基于 CSS 自定义属性的多主题切换 |

### 后端技术栈

| 技术 | 版本 | 分类 | 说明 |
|------|------|------|------|
| Node.js | 20+ | 运行时 | JavaScript 服务端运行环境 |
| Express | 4.21 | Web 框架 | 轻量级 Web 应用框架 |
| Sequelize | 6.37 | ORM 框架 | 多数据库支持的 ORM |
| SQLite | - | 数据库 | 开发环境默认数据库，零配置 |
| MySQL | 8.0+ | 数据库 | 生产环境推荐数据库 |
| mysql2 | 3.11 | 数据库驱动 | MySQL Node.js 驱动 |
| sqlite3 | 5.1 | 数据库驱动 | SQLite Node.js 驱动 |
| JWT (jsonwebtoken) | 9.0 | 身份认证 | 基于 Token 的身份认证 |
| bcryptjs | 2.4 | 密码加密 | 密码哈希加密 |
| CORS | 2.8 | 跨域处理 | 跨域资源共享中间件 |
| dotenv | 16.4 | 环境配置 | 环境变量管理 |
| Morgan | 1.10 | 日志 | HTTP 请求日志 |
| Multer | 2.2 | 文件上传 | 文件上传处理中间件 |

### 规划技术栈

| 领域 | 技术方案 | 状态 |
|------|---------|------|
| 缓存层 | Redis | 规划中 |
| 消息队列 | RabbitMQ / BullMQ | 规划中 |
| 移动端 | UniApp / Flutter | 规划中 |
| 单元测试 | Vitest + Jest | 规划中 |
| CI/CD | GitHub Actions / Jenkins | 规划中 |
| 容器化 | Docker + Docker Compose | 规划中 |

---

## 功能模块

### 1. 系统管理

| 模块 | 路径 | 功能说明 |
|------|------|---------|
| 用户管理 | `/system/users` | 用户增删改查、角色分配、启用/禁用、搜索筛选 |
| 角色权限 | `/system/roles` | 角色定义、权限分配、角色增删改 |
| 菜单管理 | `/system/menus` | 菜单/权限树形结构管理，支持多级菜单 |
| 数据字典 | `/system/dictionary` | 系统数据字典维护 |
| 系统配置 | `/system/config` | 参数配置、项目环境、数据库配置、备份还原（多页签） |
| 操作日志 | `/system/logs` | 用户操作行为审计，支持按模块/用户/时间筛选 |

**系统配置页包含：**

- **参数配置**：系统名称、公司名称等基础参数
- **项目环境**：磁盘信息、操作系统、运行时、技术栈版本、重启服务
- **数据库配置**：数据库类型、连接信息、数据迁移
- **备份还原**：数据库备份列表、创建备份、还原备份、删除备份

### 2. 基础数据

| 模块 | 路径 | 功能说明 |
|------|------|---------|
| 料品档案 | `/basic/materials` | 料品基础信息（24字段），支持分类、规格、尺寸、重量、印刷工艺等 |
| 客户档案 | `/basic/customers` | 客户基础信息、信用等级、税务银行信息、生效失效日期 |
| 产线档案 | `/basic/lines` | 生产线配置、状态管理、产线-工序关联、产线-设备关联 |
| 工序档案 | `/basic/processes` | 生产工序定义、顺序调整 |
| 设备档案（基础） | `/basic/devices` | 设备基础信息 |
| 制程不良分类 | `/basic/defects` | 不良类型树形多级分类、单位定义 |
| 编码管理 | `/basic/number-rules` | 自动编号规则配置，支持前缀、日期格式、分隔符、序号位数、重置周期 |

**料品档案字段（24个）：**

- **标识类**：material_id、material_code、material_name、specification、version_no、film_no
- **分类类**：material_category、material_type、unit、status
- **尺寸类**：can_diameter、can_height、can_thickness、cover_diameter、cover_thickness
- **重量类**：net_weight、gross_weight、tare_weight
- **工艺类**：printing_process、color_count、coating_type
- **日期类**：effective_date、expiry_date
- **审计类**：created_at、updated_at

### 3. 生产管理

| 模块 | 路径 | 功能说明 |
|------|------|---------|
| 生产订单 | `/production/orders` | 订单创建、下发、关闭全生命周期，订单号自动生成 |
| 工单列表 | `/production/workorders` | 工单全生命周期管理，自动计算工时 |
| 生产报工 | `/production/reporting` | 工序级报工，投入/产出/不良登记 |
| 生产报工(工单) | `/production/reporting-by-order` | 按工单维度的报工视图 |
| 人员记录 | `/production/manpower` | 工单人员配置与班次管理 |
| 异常记录 | `/production/exceptions` | 生产异常登记，关联订单与工单 |

#### 生产订单业务流程

**状态机**：`开立 → 已下达 → 已关闭`

| 状态 | 编辑 | 下发 | 删除 | 关闭 | 查看 |
|------|------|------|------|------|------|
| 开立 | ✓ | ✓ | ✓ | ✗ | ✗ |
| 已下达 | ✗ | ✗ | ✗ | ✓ | ✓ |
| 已关闭 | ✗ | ✗ | ✗ | ✗ | ✓ |

**订单号规则**：`MO-16` + `YYMMDD` + 3位流水号（如 `MO-16260704001`）

**业务规则**：

- 新增订单时，料品下拉仅显示 C 开头的成品罐料品
- 选中料品后自动带入料号、料品名称、规格、菲林编号、版本
- 支持按订单号、料号、状态、计划时间区间查询
- 输入框失焦/状态下拉变更/日期选择完成时立即触发筛选
- 仅"开立"状态可编辑，可修改数量、计划开始日期、计划完成日期
- 计划开始日期不得早于今天，计划完成日期不得早于计划开始日期
- 订单详情页展示关联工单、人员、异常记录

#### 工单状态流转

**状态机**：`开立 → 开工 → 关闭 → 完工`

| 状态 | 编辑 | 开工 | 删除 | 关闭 | 完工 |
|------|------|------|------|------|------|
| 开立 | ✓ | ✓ | ✓ | ✗ | ✗ |
| 开工 | ✗ | ✗ | ✗ | ✓ | ✗ |
| 关闭 | ✗ | ✗ | ✗ | ✗ | ✓ |
| 完工 | ✗ | ✗ | ✗ | ✗ | ✗ |

**工时计算规则**：按 0.5 小时取值，工单完工后关联记录自动转为只读。

### 4. 质量管理

| 模块 | 路径 | 功能说明 |
|------|------|---------|
| 检验标准管理 | `/quality/standards` | 检验标准定义与版本控制 |
| 来料检验 | `/quality/incoming` | 原材料/外购件入厂检验 |
| 过程检验 | `/quality/process` | 生产过程中的工序检验 |
| 成品检验 | `/quality/finished` | 成品出厂前最终检验 |
| 产品微生物检验 | `/quality/microbe` | 微生物检测记录 |
| 环境检验 | `/quality/environment` | 生产环境洁净度检测 |
| 客诉管理 | `/quality/complaints` | 客户投诉处理与跟踪 |
| 供应商投诉 | `/quality/supplier` | 供应商质量投诉处理 |
| 检测仪器管理 | `/quality/instruments` | 仪器档案、校准记录 |

### 5. 设备管理

| 模块 | 路径 | 功能说明 |
|------|------|---------|
| 设备档案 | `/device/list` | 设备基础信息、特种设备检定记录 |
| 点检记录 | `/device/check-records` | 设备日常点检记录 |
| 维修保养 | `/device/maintenance` | 设备维修计划与保养记录 |
| 设备OEE | `/device/oee` | 设备综合效率分析 |

### 6. 数据大屏

| 模块 | 路径 | 功能说明 |
|------|------|---------|
| 生产实时看板 | `/bigscreen/production` | 工单进度、产线状态、产出统计、环境数据 |
| 质量分析看板 | `/bigscreen/quality` | 质量趋势、不良分析、检验合格率 |
| 管理驾驶舱 | `/bigscreen/management` | 综合数据展示、关键指标概览 |

> 大屏页面为独立全屏页面，不使用主布局，支持 F11 全屏展示。

### 7. 报表中心

| 模块 | 路径 | 功能说明 |
|------|------|---------|
| 生产日报 | `/report/daily` | 每日生产数据汇总 |
| 质量月报 | `/report/monthly` | 月度质量数据统计 |
| 效率分析 | `/report/efficiency` | 生产效率多维度分析 |
| 生产报表 | `/report/production` | 生产数据综合报表 |
| 质量报表 | `/report/quality` | 质量数据综合报表 |
| 异常分析报表 | `/report/exception` | 异常数据统计与分析 |

### 8. 工作台

| 模块 | 路径 | 功能说明 |
|------|------|---------|
| 工作台首页 | `/dashboard` | 待办事项、数据概览、快捷入口 |

---

## 项目结构

```
milk-can-mes/
├── src/                              # 前端源码
│   ├── assets/                       # 静态资源（Logo图片等）
│   │   └── logo-square.png
│   ├── components/                   # 公共组件
│   │   └── ThreeSectionPage.jsx      # 三段式页面通用组件
│   ├── contexts/                     # React Context
│   │   └── AppContext.jsx            # 全局状态（用户、主题等）
│   ├── layouts/                      # 布局组件
│   │   └── MainLayout.jsx            # 主布局（侧边栏+顶栏+内容区）
│   ├── pages/                        # 页面组件
│   │   ├── basic/                    # 基础数据模块
│   │   │   ├── MaterialManagement.jsx
│   │   │   ├── CustomerManagement.jsx
│   │   │   ├── ProductionLine.jsx
│   │   │   ├── ProcessManagement.jsx
│   │   │   ├── DeviceManagement.jsx
│   │   │   ├── DefectManagement.jsx
│   │   │   └── NumberRuleManagement.jsx
│   │   ├── bigscreen/                # 数据大屏模块
│   │   │   ├── ProductionBigScreen.jsx
│   │   │   ├── QualityBigScreen.jsx
│   │   │   └── ManagementBigScreen.jsx
│   │   ├── device/                   # 设备管理模块
│   │   │   ├── DeviceManagement.jsx
│   │   │   ├── CheckRecord.jsx
│   │   │   ├── Maintenance.jsx
│   │   │   └── DeviceOEE.jsx
│   │   ├── production/               # 生产管理模块
│   │   │   ├── OrderManagement.jsx
│   │   │   ├── WorkOrderManagement.jsx
│   │   │   ├── ProcessReporting.jsx
│   │   │   ├── ProductionReportByOrder.jsx
│   │   │   ├── ManpowerRecord.jsx
│   │   │   └── ExceptionRecord.jsx
│   │   ├── quality/                  # 质量管理模块
│   │   │   ├── InspectionStandard.jsx
│   │   │   ├── IncomingInspection.jsx
│   │   │   ├── ProcessInspection.jsx
│   │   │   ├── FinishedInspection.jsx
│   │   │   ├── MicrobeInspection.jsx
│   │   │   ├── EnvironmentInspection.jsx
│   │   │   ├── ComplaintManagement.jsx
│   │   │   ├── SupplierComplaint.jsx
│   │   │   └── InstrumentManagement.jsx
│   │   ├── report/                   # 报表中心模块
│   │   │   ├── DailyReport.jsx
│   │   │   ├── MonthlyReport.jsx
│   │   │   ├── EfficiencyReport.jsx
│   │   │   ├── ProductionReport.jsx
│   │   │   ├── QualityReport.jsx
│   │   │   └── ExceptionReport.jsx
│   │   ├── system/                   # 系统管理模块
│   │   │   ├── UserManagement.jsx
│   │   │   ├── RoleManagement.jsx
│   │   │   ├── MenuManagement.jsx
│   │   │   ├── DataDictionary.jsx
│   │   │   ├── SystemConfig.jsx
│   │   │   └── OperationLogs.jsx
│   │   ├── Dashboard.jsx             # 工作台首页
│   │   └── Login.jsx                 # 登录页
│   ├── styles/                       # 全局样式
│   │   ├── global.css                # 全局样式（布局、组件、主题）
│   │   └── bigscreen.css             # 大屏专属样式
│   ├── themes/                       # 主题配置
│   │   └── index.js                  # 六套主题定义与切换函数
│   ├── utils/                        # 工具函数
│   │   └── api.js                    # Axios 实例与拦截器
│   ├── mock/                         # Mock 数据
│   │   └── data.js
│   ├── main.jsx                      # 应用入口（路由配置）
│   └── AppContext.jsx
├── server/                           # 后端源码
│   ├── src/
│   │   ├── config/                   # 配置文件
│   │   │   └── database.js           # 数据库配置（SQLite/MySQL 切换）
│   │   ├── controllers/              # 控制器（业务逻辑层）
│   │   │   ├── AuthController.js     # 认证控制器
│   │   │   ├── UserController.js     # 用户管理控制器
│   │   │   ├── RoleController.js     # 角色管理控制器
│   │   │   ├── PermissionController.js  # 权限/菜单控制器
│   │   │   ├── SystemConfigController.js  # 系统配置控制器
│   │   │   ├── OperationLogController.js  # 操作日志控制器
│   │   │   ├── MaterialController.js # 料品档案控制器
│   │   │   ├── CustomerController.js # 客户档案控制器
│   │   │   ├── ProductionLineController.js  # 产线控制器
│   │   │   ├── ProcessController.js  # 工序控制器
│   │   │   ├── DeviceController.js   # 设备控制器
│   │   │   ├── DefectTypeController.js  # 不良分类控制器
│   │   │   ├── NumberRuleController.js  # 编码规则控制器
│   │   │   ├── OrderController.js    # 生产订单控制器
│   │   │   ├── WorkOrderController.js  # 工单控制器
│   │   │   ├── ProcessReportController.js  # 工序报工控制器
│   │   │   ├── ManpowerRecordController.js # 人员记录控制器
│   │   │   └── ExceptionRecordController.js  # 异常记录控制器
│   │   ├── middleware/               # 中间件
│   │   │   └── auth.js               # JWT 认证、权限校验、操作日志
│   │   ├── models/                   # 数据模型（Sequelize Model）
│   │   │   ├── index.js              # 模型导出与关联定义
│   │   │   ├── User.js               # 用户模型
│   │   │   ├── Role.js               # 角色模型
│   │   │   ├── Permission.js         # 权限/菜单模型
│   │   │   ├── RolePermission.js     # 角色-权限关联表
│   │   │   ├── OperationLog.js       # 操作日志模型
│   │   │   ├── SystemConfig.js       # 系统配置模型
│   │   │   ├── Material.js           # 料品档案模型
│   │   │   ├── Customer.js           # 客户档案模型
│   │   │   ├── ProductionLine.js     # 产线模型
│   │   │   ├── Process.js            # 工序模型
│   │   │   ├── LineProcess.js        # 产线-工序关联表
│   │   │   ├── Device.js             # 设备模型
│   │   │   ├── LineDevice.js         # 产线-设备关联表
│   │   │   ├── DefectType.js         # 不良分类模型（自关联树形）
│   │   │   ├── NumberRule.js         # 编码规则模型
│   │   │   ├── Sequence.js           # 序号流水号模型
│   │   │   ├── Order.js              # 生产订单模型
│   │   │   ├── WorkOrder.js          # 工单模型
│   │   │   ├── ProcessReport.js      # 工序报工模型
│   │   │   ├── ManpowerRecord.js     # 人员投入记录模型
│   │   │   └── ExceptionRecord.js    # 异常记录模型
│   │   ├── routes/                   # 路由定义
│   │   │   ├── index.js              # 路由总入口
│   │   │   ├── auth.js               # 认证路由
│   │   │   ├── system.js             # 系统管理路由
│   │   │   ├── basic.js              # 基础数据路由
│   │   │   └── production.js         # 生产管理路由
│   │   ├── utils/                    # 工具函数
│   │   │   ├── jwt.js                # JWT 签发与验证
│   │   │   ├── response.js           # 统一响应格式
│   │   │   ├── sequence.js           # 序号生成器
│   │   │   └── statusMap.js          # 状态码映射
│   │   ├── app.js                    # 应用入口（Express 实例化）
│   │   ├── seed.js                   # 数据初始化脚本
│   │   ├── clean-init.js             # 数据清理脚本
│   │   ├── migrate.js                # 数据库列迁移
│   │   └── import-materials.js       # 料品档案种子数据导入
│   ├── data/                         # SQLite 数据库文件
│   │   ├── milk_can_mes.sqlite
│   │   └── backups/                  # 备份文件目录
│   ├── uploads/                      # 上传文件目录
│   │   ├── avatars/                  # 用户头像
│   │   └── tmp/                      # 临时上传目录
│   ├── .env                          # 环境变量
│   └── package.json
├── dist/                             # 前端构建产物
├── index.html                        # HTML 入口
├── vite.config.js                    # Vite 配置
├── package.json                      # 前端依赖
└── README.md
```

---

## 快速开始

### 环境要求

- Node.js >= 18.x（推荐 20.x LTS）
- npm >= 9.x
- （可选）MySQL >= 8.0（生产环境使用）

### 前端开发

```bash
# 安装依赖
npm install

# 启动开发服务器（默认端口 5173）
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

前端开发服务器默认运行在 `http://localhost:5173`

### 后端开发

```bash
# 进入后端目录
cd server

# 安装依赖
npm install

# 初始化数据库（创建表结构和默认数据）
node src/seed.js

# 启动后端服务
node src/app.js
# 或使用 watch 模式（自动重启）
npm run dev
```

后端服务默认运行在 `http://localhost:3001`

### 数据库操作

```bash
# 进入后端目录
cd server

# 清空所有业务数据（保留角色和 admin 用户）
node src/clean-init.js

# 重新初始化完整数据
node src/seed.js

# 导入料品档案种子数据（114 条料品记录）
node src/import-materials.js
```

### 环境变量配置

在 `server/.env` 文件中可配置以下环境变量：

```env
# 数据库配置
DB_DIALECT=sqlite      # 数据库类型：sqlite / mysql
DB_HOST=localhost      # MySQL 主机
DB_PORT=3306           # MySQL 端口
DB_NAME=milk_can_mes   # 数据库名
DB_USER=root           # MySQL 用户名
DB_PASSWORD=           # MySQL 密码

# 服务配置
PORT=3001              # 服务端口

# JWT 配置
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
```

---

## 默认登录账号

| 角色 | 用户名 | 密码 | 说明 |
|------|--------|------|------|
| 超级管理员 | admin | 123456 | 系统最高权限 |
| 系统管理员 | sysadmin | 123456 | 系统配置、用户管理 |
| 计划员 | planner | 123456 | 生产计划、订单管理 |
| 质量管理员 | qm | 123456 | 质量管理、标准配置 |
| 质量检验员 | qc | 123456 | 质量检验、数据录入 |
| 生产管理 | pm | 123456 | 生产管理、工单执行 |
| 工序操作人 | op | 123456 | 工序报工、数据录入 |
| 设备维护员 | maint | 123456 | 设备管理、维护记录 |
| 看板查看者 | viewer | 123456 | 仅查看大屏和报表 |

---

## 主题系统

系统内置 6 套主题配色方案，基于 CSS Variables 实现，支持运行时动态切换。

### 主题列表

| 主题标识 | 名称 | 图标 | 深色模式 | 主色调 |
|----------|------|------|---------|--------|
| `pureMilk` | 纯净奶源 | 🥛 | 否 | `#2196F3`（科技蓝） |
| `darkFactory` | 暗夜工厂 | 🌙 | 是 | `#58A6FF`（GitHub 蓝） |
| `blueSky` | 蓝天牧场 | 🌤️ | 否 | `#4A90D9`（天空蓝） |
| `metal` | 金属质感 | 🔩 | 否 | `#607D8B`（工业灰蓝） |
| `greenOasis` | 自然绿洲 | 🌿 | 否 | `#43A047`（自然绿） |
| `warmAmber` | 暖阳琥珀 | 🔥 | 否 | `#E65100`（琥珀橙） |

### 主题切换方式

1. **顶部导航栏**：点击右上角圆形主题图标按钮，按顺序循环切换
2. **循环顺序**：纯净奶源 → 暗夜工厂 → 蓝天牧场 → 金属质感 → 自然绿洲 → 暖阳琥珀（循环往复）
3. **持久化**：主题选择保存在 localStorage（`mes_theme`），刷新后保留

### CSS 变量清单

每套主题定义以下 CSS 自定义属性：

| 变量名 | 用途 |
|--------|------|
| `--bg-main` | 页面主背景色 |
| `--bg-card` | 卡片/面板背景色 |
| `--color-primary` | 主色调（品牌色） |
| `--color-secondary` | 辅助色 |
| `--color-accent` | 强调色 |
| `--color-success` | 成功色 |
| `--color-warning` | 警告色 |
| `--color-error` | 错误/危险色 |
| `--text-primary` | 主要文字颜色 |
| `--text-secondary` | 次要文字颜色 |
| `--border-color` | 边框颜色 |
| `--nav-bg` | 侧边导航栏背景色 |
| `--nav-text` | 侧边导航栏文字颜色 |

---

## 页面布局规范

### 三段式页面结构

系统大部分业务页面采用统一的"三段式"布局结构，遵循以下规范：

| 区域 | 占比 | 背景色 | 间距 | 说明 |
|------|------|--------|------|------|
| 上部：页面信息区 | 15%~20% | 主背景色（`--bg-main`） | 常规 | 页面标题、面包屑、操作按钮、统计卡片 |
| 中部：筛选功能区 | 10%~15% | 卡片背景色（`--bg-card`） | 小行间距 4-8px | 筛选条件表单，可折叠 |
| 下部：列表区 | 65%~75% | 卡片背景色（`--bg-card`） | 小行间距 | 数据表格，默认每页 30 条 |

### 操作按钮配色规范

| 按钮类型 | 配色方案 | 用途示例 |
|----------|---------|---------|
| 新增按钮 | 主色渐变（primary → secondary） | 新增、创建 |
| 导出按钮 | 成功色渐变 | 导出 Excel |
| 配置按钮 | 强调色渐变 | 配置、设置 |

### 表格规范

- 表头文字统一居中
- 操作列统一宽度
- 小间距模式：单元格 padding 4px~8px
- 料品名称列：最小宽度 200px，内容过长自动换行
- 默认分页：每页 30 条

---

## 业务状态流转

### 生产订单状态

| 状态值 | 显示名称 | 说明 |
|--------|---------|------|
| 0 | 开立 | 初始状态，可编辑、下发、删除 |
| 1 | 已下达 | 已下发到生产，可关闭 |
| 2 | 已关闭 | 订单关闭，仅可查看 |

### 工单状态

| 状态值 | 显示名称 | 说明 |
|--------|---------|------|
| 0 | 开立 | 初始状态，可编辑、开工、删除 |
| 1 | 开工 | 生产中，可关闭 |
| 2 | 关闭 | 已关闭，可完工 |
| 3 | 完工 | 最终状态，不可编辑 |

---

## 大屏看板规则

### 数据展示规则

- **当天数据优先**：所有大屏默认显示当天数据；当天无数据时自动回退到上一个有数据的日期
- **ECharts 动画禁用**：工序产出统计、工单实时进度图表禁用动画（`animation: false`），确保数据实时准确
- **生产订单排序**：按 `已开工 → 待下达 → 已关闭` 顺序排列
- **隐藏滚动条**：产线运行状态、设备状态列表隐藏滚动条（`.bs-no-scrollbar` 类，兼容 Firefox/IE/Chrome/Safari）
- **卡片等分**：工序产出统计与工单实时进度卡片宽度平均分配（`flex: 1`）

### 闲置态交互

- **15秒无操作自动隐藏**：监听 `mousemove`/`mousedown`/`keydown`/`touchstart`/`wheel` 事件
- 超过 15 秒无操作时，自动隐藏左上角看板名称按钮与切换 Tab
- 仅显示系统时间（HH:MM:SS）+ 在线指示灯
- 任意操作立即恢复完整界面

### 环境数据模拟

大屏右上角实时显示"温度 / 湿度 / 压差"三项环境数据：

| 参数 | 范围 | 说明 |
|------|------|------|
| 温度 | 20~23°C | 保留 1 位小数 |
| 湿度 | 58~63% | 保留 1 位小数 |
| 压差 | 15~21Pa | 保留 1 位小数 |

- 每 8 秒刷新一次
- 每次变化与上一次数值差不超过 2
- 采用平滑随机算法（超出边界时镜像反射回区间内）

### 顶部布局

- 左侧：看板名称 + 切换 Tab
- 中间：大屏标题
- 右侧：环境数据组（温度/湿度/压差）+ 当前时间，位置比标题低一行

---

## API 接口概览

### 接口基础信息

- Base URL: `/api`
- 认证方式：Bearer Token（JWT）
- 响应格式：统一 JSON 格式 `{ code, success, message, data }`

### 认证接口

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | `/api/auth/login` | 用户登录 | 否 |
| GET | `/api/auth/profile` | 获取当前用户信息 | 是 |
| POST | `/api/auth/logout` | 退出登录 | 是 |

### 系统管理接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST/PUT/DELETE | `/api/system/users` | 用户管理 CRUD |
| POST | `/api/system/users/:id/toggle` | 启用/禁用用户 |
| GET/POST/PUT/DELETE | `/api/system/roles` | 角色管理 CRUD |
| GET | `/api/system/roles/:id/permissions` | 获取角色权限 |
| PUT | `/api/system/roles/:id/permissions` | 分配角色权限 |
| GET/POST/PUT/DELETE | `/api/system/permissions` | 权限/菜单管理 |
| GET | `/api/system/permissions/menu` | 获取用户菜单树 |
| GET | `/api/system/logs` | 操作日志列表 |
| GET/PUT | `/api/system/config` | 系统配置获取/保存 |
| GET | `/api/system/config/environment` | 获取项目环境信息 |
| POST | `/api/system/config/restart` | 重启后端服务 |
| GET | `/api/system/config/database` | 获取数据库信息 |
| GET | `/api/system/config/database/migration-targets` | 获取可迁移数据库列表 |
| POST | `/api/system/config/database/migrate` | 执行数据迁移 |
| GET/POST | `/api/system/config/backups` | 备份列表/创建备份 |
| POST | `/api/system/config/backups/restore` | 还原备份 |
| DELETE | `/api/system/config/backups/:filename` | 删除备份 |
| POST | `/api/system/users/me/avatar` | 上传自定义头像 |
| PUT | `/api/system/users/me/avatar` | 设置预设头像 |
| PUT | `/api/system/users/me/profile` | 更新个人信息 |

### 基础数据接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST/PUT/DELETE | `/api/basic/materials` | 料品档案 CRUD |
| GET/POST/PUT/DELETE | `/api/basic/customers` | 客户档案 CRUD |
| GET/POST/PUT/DELETE | `/api/basic/production-lines` | 产线档案 CRUD |
| GET/POST/PUT/DELETE | `/api/basic/processes` | 工序档案 CRUD |
| GET/POST/PUT/DELETE | `/api/basic/devices` | 设备档案 CRUD |
| GET/POST/PUT/DELETE | `/api/basic/defect-types` | 不良分类 CRUD |
| GET/POST/PUT/DELETE | `/api/basic/number-rules` | 编码规则 CRUD |
| POST | `/api/basic/number-rules/:id/toggle` | 启用/停用规则 |
| POST | `/api/basic/number-rules/:id/audit` | 审核规则 |
| GET | `/api/basic/number-rules/:id/preview` | 预览规则生成效果 |

### 生产管理接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST/PUT/DELETE | `/api/production/orders` | 生产订单 CRUD |
| POST | `/api/production/orders/:id/release` | 下达订单 |
| POST | `/api/production/orders/:id/close` | 关闭订单 |
| GET/POST/PUT/DELETE | `/api/production/work-orders` | 工单 CRUD |
| POST | `/api/production/work-orders/:id/start` | 开工 |
| POST | `/api/production/work-orders/:id/finish` | 完工 |
| POST | `/api/production/work-orders/:id/close` | 关闭 |
| GET/POST | `/api/production/process-reports` | 工序报工列表/新增 |
| GET/POST | `/api/production/manpower-records` | 人员记录列表/新增 |
| GET/POST | `/api/production/exceptions` | 异常记录列表/新增 |

---

## 数据库模型

### 模型清单（24个）

| 模型 | 表名 | 说明 |
|------|------|------|
| User | `sys_user` | 用户表 |
| Role | `sys_role` | 角色表 |
| Permission | `sys_permission` | 权限/菜单表 |
| RolePermission | `sys_role_permission` | 角色-权限关联表 |
| OperationLog | `sys_operation_log` | 操作日志表 |
| SystemConfig | `sys_config` | 系统配置表 |
| Material | `bas_material` | 料品档案表 |
| Customer | `bas_customer` | 客户档案表 |
| ProductionLine | `bas_production_line` | 产线档案表 |
| Process | `bas_process` | 工序档案表 |
| LineProcess | `bas_line_process` | 产线-工序关联表 |
| Device | `bas_device` | 设备档案表 |
| LineDevice | `bas_line_device` | 产线-设备关联表 |
| DefectType | `bas_defect_type` | 不良分类表（树形自关联） |
| NumberRule | `bas_number_rule` | 编码规则表 |
| Sequence | `sys_sequence` | 序号流水号表 |
| Order | `prod_order` | 生产订单表 |
| WorkOrder | `prod_work_order` | 工单表 |
| ProcessReport | `prod_process_report` | 工序报工表 |
| ManpowerRecord | `prod_manpower_record` | 人员投入记录表 |
| ExceptionRecord | `prod_exception_record` | 异常记录表 |

### 主要关联关系

- **用户 - 角色**：多对一（User.belongsTo(Role)）
- **角色 - 权限**：多对多（Role.belongsToMany(Permission, through: RolePermission)）
- **订单 - 工单**：一对多（Order.hasMany(WorkOrder)）
- **工单 - 工序报工**：一对多（WorkOrder.hasMany(ProcessReport)）
- **工单 - 人员记录**：一对多（WorkOrder.hasMany(ManpowerRecord)）
- **工单 - 异常记录**：一对多（WorkOrder.hasMany(ExceptionRecord)）
- **订单 - 异常记录**：一对多（Order.hasMany(ExceptionRecord)）
- **客户 - 料品**：一对多（Customer.hasMany(Material)）
- **产线 - 工序**：多对多（ProductionLine.belongsToMany(Process, through: LineProcess)）
- **产线 - 设备**：多对多（ProductionLine.belongsToMany(Device, through: LineDevice)）
- **不良分类**：自关联树形（DefectType.hasMany(DefectType, as: children)）

---

## 编码规则系统

### 功能特性

- 支持自由组合：前缀、日期格式、分隔符、序号位数、重置周期
- 启用即审核，同一表单字段仅一个生效规则
- 启用新规则自动停用旧规则
- 支持规则预览，查看生成效果
- 操作列仅显示可操作按钮，已审核规则隐藏编辑和删除按钮

### 重置周期

- 不重置
- 按日重置
- 按月重置
- 按年重置

---

## 用户设置与头像

### 预设头像

系统内置 20 种预设头像（基于 DiceBear API），涵盖三种风格：

- **avataaars 风格**：10 个（Felix、Aneka、Mimi、Bandit、Lily、Leo、Sophie、Toto、Coco、Max）
- **fun-emoji 风格**：5 个（Whiskers、Bubbles、Shadow、Sunny、Pepper）
- **bottts 风格**：5 个（Alpha、Beta、Gamma、Delta、Omega）

### 自定义上传

- 支持上传自定义头像（仅图片格式）
- 单文件最大 2MB
- 上传后系统自动删除旧的自定义头像文件

### 存储与服务

- 自定义头像保存至 `server/uploads/avatars/`
- 临时上传目录：`server/uploads/tmp/`
- 后端通过 `express.static` 服务 `/uploads` 路径
- 浏览器缓存 7 天

### 相关接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/users/me/avatar` | 上传自定义头像（multipart/form-data） |
| PUT | `/api/users/me/avatar` | 设置预设头像（body: { avatar_url }） |
| PUT | `/api/users/me/profile` | 更新姓名/手机/邮箱 |

---

## 系统配置与运维

### 项目环境信息

系统配置 → 项目环境 页面展示以下系统级信息：

- **磁盘信息**：总容量、已用、可用、已用百分比、挂载点
- **操作系统**：系统版本、类型、内核版本、主机名、运行时长
- **运行时信息**：Node.js 版本、CPU 架构、内存使用情况
- **技术栈**：前端与后端各依赖名称、版本、分类（从 package.json 实时读取）
- **重启服务**：一键重启后端服务，自动等待恢复并刷新

### 数据库迁移

系统支持在 SQLite / MySQL / PostgreSQL / SQL Server 等常见数据库环境之间迁移：

- **迁移前自动备份**：迁移前自动对当前数据库进行全量备份
- **备份位置**：`server/data/backups/`
- **迁移流程**：测试连接 → 逐表复制数据 → 更新 .env 配置 → 返回统计
- **迁移接口**：
  - `GET /api/config/database/migration-targets` — 获取可迁移目标列表
  - `POST /api/config/database/migrate` — 执行数据迁移

### 备份还原

- 支持手动创建数据库备份
- 备份文件列表管理
- 一键还原指定备份
- 支持删除过期备份

### 服务重启

- 在系统配置页面可一键重启后端服务
- 重启过程约 5 秒
- 重启后自动刷新项目环境信息
- 需"系统配置"操作权限

---

## 开发规范与要求

### 代码规范

1. **命名规范**
   - 组件：PascalCase（如 `UserManagement`）
   - 文件：PascalCase（组件）、camelCase（工具函数）
   - CSS 类：kebab-case（如 `.app-sider`）
   - 后端接口：kebab-case（如 `/production-lines`）

2. **目录规范**
   - 页面组件按业务模块分目录
   - 公共组件放在 `components/` 目录
   - 工具函数放在 `utils/` 目录
   - 样式文件放在 `styles/` 目录

3. **样式规范**
   - 使用 CSS 变量（`var(--xxx)`）而不是硬编码颜色
   - 全局样式在 `global.css` 中定义
   - 组件内样式优先使用内联 style 或 CSS Module
   - 过渡动画统一 0.2s~0.3s

4. **接口规范**
   - 统一使用 `api.js` 中的 axios 实例
   - 请求拦截器自动添加 Bearer Token
   - 响应拦截器统一处理 401 跳转登录
   - 错误统一通过 `message.error` 提示

5. **状态管理**
   - 全局状态使用 React Context（`AppContext`）
   - 页面级状态使用组件内 useState
   - 数据持久化使用 localStorage（token、用户信息、主题）

6. **路由规范**
   - 受保护路由使用 `ProtectedRoute` 包裹
   - 路由路径按模块层级组织（`/模块/页面`）
   - 大屏路由独立于主布局之外

7. **表格规范**
   - 表头居中对齐
   - 操作列固定宽度
   - 日期格式统一使用 dayjs 格式化
   - 状态使用 Tag 组件展示

### 提交规范（建议）

- feat: 新功能
- fix: 修复 bug
- docs: 文档更新
- style: 代码格式调整
- refactor: 重构
- perf: 性能优化
- test: 测试相关
- chore: 构建/工具/依赖相关

---

## 后续规划功能

### 已完成功能 ✅

- [x] 系统管理（用户、角色、权限、菜单、配置、日志）
- [x] 基础数据（料品、客户、产线、工序、设备、不良、编码）
- [x] 生产管理（订单、工单、报工、人员、异常）
- [x] 六套主题系统
- [x] 三段式页面布局规范
- [x] JWT 认证体系
- [x] 操作日志审计
- [x] 数据大屏（生产/质量/管理）
- [x] 报表中心（6类报表）
- [x] 质量管理页面框架
- [x] 设备管理页面框架
- [x] 用户头像系统
- [x] 数据库迁移
- [x] 备份还原
- [x] 服务重启

### 开发中 / 待完善 🚧

- [ ] 质量管理模块完整业务逻辑
- [ ] 设备管理模块完整业务逻辑
- [ ] 报表中心真实数据与图表
- [ ] 数据大屏真实数据对接
- [ ] 数据字典功能完善

### 规划中功能 📋

#### 短期规划（v4.4 ~ v4.5）

- [ ] 生产排程功能
- [ ] 物料需求计划（MRP）
- [ ] 条码/二维码支持
- [ ] 打印模板配置
- [ ] 高级筛选与自定义列
- [ ] 数据导出（Excel/PDF）
- [ ] 消息通知系统

#### 中期规划（v5.0）

- [ ] 移动端 App / 小程序
- [ ] 设备数据实时采集（IoT）
- [ ] 看板触摸交互优化
- [ ] 多语言支持（中英双语）
- [ ] 工作流引擎
- [ ] 审批流程配置

#### 长期规划（v6.0+）

- [ ] 微服务架构改造
- [ ] 插件化扩展机制
- [ ] 智能排产（AI 算法）
- [ ] 质量预测与预警
- [ ] 数字孪生 3D 可视化
- [ ] 供应链协同平台

### 技术债务与优化项

- [ ] 前端单元测试覆盖
- [ ] 后端单元测试覆盖
- [ ] E2E 自动化测试
- [ ] 接口文档自动生成（Swagger）
- [ ] 性能监控与告警
- [ ] Docker 容器化部署
- [ ] CI/CD 流水线
- [ ] 代码质量检查（ESLint + Prettier）

---

## 常见问题

### Q1：前端启动后无法连接后端？

请检查：
1. 后端服务是否正常启动（默认端口 3001）
2. Vite 代理配置是否正确（`vite.config.js` 中的 `server.proxy`）
3. 浏览器控制台是否有 CORS 或网络错误

### Q2：数据库初始化失败？

请检查：
1. `server/data/` 目录是否有写入权限
2. 如果使用 MySQL，确保数据库已创建且连接信息正确
3. 查看控制台输出的具体错误信息

### Q3：主题切换不生效？

请检查：
1. 浏览器是否支持 CSS Variables（现代浏览器均支持）
2. 控制台是否有报错
3. 尝试清除 localStorage 后刷新

### Q4：如何切换到 MySQL 数据库？

1. 修改 `server/.env` 文件，设置 `DB_DIALECT=mysql`
2. 配置 MySQL 连接信息（主机、端口、库名、用户名、密码）
3. 重启后端服务
4. 或在系统配置 → 数据库配置 中使用"数据迁移"功能一键切换

### Q5：忘记管理员密码怎么办？

可以运行以下脚本重置 admin 密码为 123456：

```bash
cd server
node -e "
import('./src/models/index.js').then(async ({ User }) => {
  const bcrypt = await import('bcryptjs')
  await User.update({ password: bcrypt.hashSync('123456', 10) }, { where: { username: 'admin' } })
  console.log('Admin password reset to 123456')
  process.exit(0)
})
"
```

---

## 许可证

本项目为企业内部使用软件，版权归东莞市大满包装实业有限公司长沙分公司所有。

---

## 联系方式

- 项目名称：奶粉罐生产管理系统 (Milk Can MES)
- 版本：v4.3.0
- 所属公司：东莞市大满包装实业有限公司长沙分公司
