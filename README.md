# 奶粉罐生产管理系统 (Milk Can MES)

> 版本：V1.0.0.109
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
- [Ubuntu 22.04 LTS 生产部署指南](#ubuntu-2204-lts-生产部署指南)
- [默认登录账号](#默认登录账号)
- [主题系统](#主题系统)
- [页面布局规范](#页面布局规范)
- [业务状态流转](#业务状态流转)
- [业务规则与控件规范](#业务规则与控件规范)
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
| 数据字典 | `/system/dictionary` | 数据库表字典查看，展示所有数据表结构和字段详情 |
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
| 产线档案 | `/basic/lines` | 生产线配置、状态管理、产线-工序关联配置、产线-设备关联配置、新增产线时可同步配置工序设备 |
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

**状态机**：`开立 → 下达 → 开工 → 关闭`（工单完工未达标时可回退到"下达"）

| 状态 | 编辑 | 下发 | 删除 | 关闭 | 查看 |
|------|------|------|------|------|------|
| 开立 | ✓ | ✓ | ✓ | ✗ | ✗ |
| 下发 | ✗ | ✗ | ✗ | ✓ | ✓ |
| 开工 | ✗ | ✗ | ✗ | ✓ | ✓ |
| 关闭 | ✗ | ✗ | ✗ | ✗ | ✓ |

**订单号规则**：`MO-16` + `YYMMDD` + 3位流水号（如 `MO-16260704001`）

**业务规则**：

- 新增订单时，料品下拉仅显示 **C 开头且状态为生效**的料品
- 选中料品后自动带入：料号、料品名称、规格、菲林编号、版本
- **计划数量只能为正整数**
- 支持按订单号、料号、料品名称、状态、计划时间区间查询
- 输入框失焦/状态下拉变更/日期选择完成时**立即触发筛选**
- 计划开始日期不得早于今天，计划完成日期不得早于计划开始日期
- 仅"开立"状态可编辑，可修改数量、计划开始日期、计划完成日期
- 订单详情页展示关联工单、人员、异常记录

#### 工单状态流转

**状态机**：`开立 → 开工 → 完工`

| 状态 | 编辑 | 开工 | 删除 | 完工 | 详情 |
|------|------|------|------|------|------|
| 开立 | ✓ | ✓ | ✓ | ✗ | ✓ |
| 开工 | ✗ | ✗ | ✗ | ✓ | ✓ |
| 完工 | ✗ | ✗ | ✗ | ✗ | ✓ |

**业务规则**：

- 新增工单时，关联生产订单**只能选择状态为"下发"且没有未完工工单**的订单
- 选择产线后，**自动按工序顺序带入该产线当前有效的工序**
- 工单计划数量**必须为正整数且大于 0**
- 开工后**自动生成报工记录和人员记录**，各工序可自由报工
- **工时计算规则**：按 0.5 小时取值
- 工单完工后，关联记录自动转为只读
- **订单状态联动**：
  - 工单完工时，若订单累计完工数量 ≥ 计划数量，生产订单状态改为"完工"
  - 工单完工时，若订单累计完工数量 < 计划数量，生产订单状态改为"下发"

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
│   │   │   ├── DictController.js     # 数据字典控制器
│   │   │   ├── SystemConfigController.js  # 系统配置控制器
│   │   │   ├── OperationLogController.js  # 操作日志控制器
│   │   │   ├── MaterialController.js # 料品档案控制器
│   │   │   ├── CustomerController.js # 客户档案控制器
│   │   │   ├── ProductionLineController.js  # 产线控制器
│   │   │   ├── LineRelationController.js    # 产线关联控制器（工序/设备）
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
│   │   │   ├── DictType.js           # 字典类型模型
│   │   │   ├── DictData.js           # 字典项模型
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

# 导入设备档案种子数据（26 条设备记录）
node src/import-devices.js
```

**设备档案种子数据**：包含 26 条设备记录，涵盖生产设备（自动焊接机、翻边滚筋封罐组合机、光检设备、码垛机等）和其他设备（叉车等），存储在 `master_device` 表。

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

## Ubuntu 22.04 LTS 生产部署指南

### 0. 数据库选型建议

| 维度 | SQLite（默认） | MySQL（推荐生产） |
|------|---------------|-----------------|
| **适用场景** | 开发测试、小团队（≤10人）、试运行 | 正式生产、多用户并发、数据量大 |
| **并发能力** | 单写多读，写入时全库锁 | 高并发读写，行级锁，连接池 |
| **数据规模** | 建议 < 10GB，单表 < 千万级 | TB 级数据，亿级记录 |
| **运维成本** | 零运维，无需安装数据库服务 | 需要安装、配置、调优、监控 |
| **备份方式** | 直接拷贝数据库文件 | mysqldump / 主从复制 |
| **稳定性** | 文件级，异常断电有损坏风险 | 事务日志，崩溃恢复能力强 |

> **生产环境强烈推荐使用 MySQL 8.0+**。项目基于 Sequelize ORM 开发，已完全兼容 MySQL，只需修改环境变量即可切换。

### 1. 系统环境准备

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 验证安装
node -v   # 应显示 v20.x.x
npm -v    # 应显示 10.x.x

# 安装构建工具（sqlite3 编译需要）
sudo apt install -y build-essential python3

# 安装 Git
sudo apt install -y git

# 安装 Nginx（反向代理）
sudo apt install -y nginx

# 安装 MySQL 8.0（生产环境推荐）
sudo apt install -y mysql-server

# 启动 MySQL 并设置开机自启
sudo systemctl start mysql
sudo systemctl enable mysql

# 安装 PM2（进程管理）
sudo npm install -g pm2
```

### 2. 项目部署

```bash
# 克隆项目（或上传项目文件）
cd /opt
git clone https://github.com/gddsb/CSDM01.git milk-can-mes
cd milk-can-mes

# 前端安装与构建
npm install
npm run build

# 后端安装
cd server
npm install

# 重新编译 sqlite3（如遇到问题）
npm rebuild sqlite3

# 初始化数据库
node src/seed.js

# 返回项目根目录
cd ..
```

### 3. MySQL 数据库初始化（生产环境）

```bash
# 登录 MySQL
sudo mysql -u root

# 在 MySQL 中执行以下命令：
# CREATE DATABASE milk_can_mes CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
# CREATE USER 'milk_can_mes'@'localhost' IDENTIFIED BY 'your-strong-password';
# GRANT ALL PRIVILEGES ON milk_can_mes.* TO 'milk_can_mes'@'localhost';
# FLUSH PRIVILEGES;
# EXIT;

# 修改后端环境变量
cd /opt/milk-can-mes/server
nano .env
# 修改以下配置：
# DB_DIALECT=mysql
# DB_HOST=localhost
# DB_PORT=3306
# DB_NAME=milk_can_mes
# DB_USER=milk_can_mes
# DB_PASSWORD=your-strong-password

# 初始化数据库表结构和默认数据
node src/seed.js
```

### 4. 使用 PM2 启动后端服务

```bash
# 创建 PM2 配置文件
cat > ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [
    {
      name: 'milk-can-mes-server',
      cwd: '/opt/milk-can-mes/server',
      script: 'src/app.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        DB_DIALECT: 'mysql',
        DB_HOST: 'localhost',
        DB_PORT: 3306,
        DB_NAME: 'milk_can_mes',
        DB_USER: 'milk_can_mes',
        DB_PASSWORD: 'your-strong-password'
      }
    }
  ]
}
EOF

# 启动服务
pm2 start ecosystem.config.cjs

# 查看状态
pm2 status

# 设置开机自启
pm2 startup
pm2 save
```

### 5. Nginx 反向代理配置

```bash
# 创建 Nginx 配置
sudo cat > /etc/nginx/sites-available/milk-can-mes << 'EOF'
server {
    listen 80;
    server_name 43.138.218.55;  # 替换为你的域名或服务器公网IP

    # 安全头配置（防止常见 Web 攻击）
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";

    # 前端静态文件
    location / {
        root /opt/milk-can-mes/dist;
        index index.html;
        try_files $uri $uri/ /index.html;

        # 缓存控制：HTML 不缓存，其他资源缓存 7 天
        if ($uri ~* "\.(html|htm)$") {
            expires -1;
        }
        if ($uri ~* "\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$") {
            expires 7d;
            add_header Cache-Control "public, immutable";
        }
    }

    # 后端 API 代理
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # 超时设置（防止长请求被中断）
        proxy_connect_timeout 60s;
        proxy_read_timeout 120s;
        proxy_send_timeout 60s;
    }

    # 上传文件代理（头像、不良图片等）
    location /uploads {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        # 文件缓存 7 天
        expires 7d;
        add_header Cache-Control "public";
    }
}
EOF

# 启用配置
sudo ln -s /etc/nginx/sites-available/milk-can-mes /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx

# 设置开机自启
sudo systemctl enable nginx
```

### 6. 防火墙配置

```bash
# 开放 HTTP 端口
sudo ufw allow 80/tcp

# 开放 HTTPS 端口（如需 SSL）
sudo ufw allow 443/tcp

# 启用防火墙
sudo ufw enable

# 查看状态
sudo ufw status
```

### 7. SSL 证书配置（可选）

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 申请证书
sudo certbot --nginx -d your-domain.com

# 自动续期测试
sudo certbot renew --dry-run
```

### 8. 常用运维命令

```bash
# 查看 PM2 服务状态
pm2 status

# 查看日志
pm2 logs milk-can-mes-server

# 重启服务
pm2 restart milk-can-mes-server

# 停止服务
pm2 stop milk-can-mes-server

# 重新部署（更新代码后）
cd /opt/milk-can-mes
npm run build
pm2 restart milk-can-mes-server

# 查看 Nginx 状态
sudo systemctl status nginx

# 重新加载 Nginx 配置
sudo systemctl reload nginx
```

### 9. 代码更新（生产环境）

#### 9.1 标准更新流程

```bash
# 1. 进入项目目录
cd /opt/milk-can-mes

# 2. 拉取最新代码
git pull origin trae/agent-KDO8Sm

# 3. 更新前端依赖（如 package.json 有变更）
npm install

# 4. 重新构建前端
npm run build

# 5. 更新后端依赖（如 server/package.json 有变更）
cd server
npm install
cd ..

# 6. 重启后端服务
pm2 restart milk-can-mes-server

# 7. 查看更新状态
pm2 status
```

#### 9.2 更新数据库结构（如有变更）

```bash
# 如果数据库表结构有变更，先备份数据
cd /opt/milk-can-mes/server
mysqldump -u milk_can_mes -p milk_can_mes > /opt/backups/milk_can_mes_before_update.sql

# 重新初始化数据库（会清空所有数据！）
# 仅在确认需要重新初始化时执行
node src/seed.js
```

#### 9.3 回滚到上一版本

```bash
# 回滚代码到上一版本
cd /opt/milk-can-mes
git log --oneline -5   # 查看最近5个提交
git revert <commit-hash>  # 撤销指定提交
# 或
git checkout <commit-hash>  # 强制回退到指定版本

# 重新构建
npm run build

# 重启服务
pm2 restart milk-can-mes-server
```

#### 9.4 更新检查清单

| 步骤 | 检查项 | 命令 |
|------|--------|------|
| 1 | 代码是否拉取成功 | `git log --oneline -1` |
| 2 | 前端构建是否成功 | `npm run build` |
| 3 | 后端服务是否正常 | `pm2 status` |
| 4 | API 是否可访问 | `curl http://localhost:3001/api/health` |
| 5 | 前端是否可访问 | 浏览器访问首页 |

#### 9.5 更新后验证

```bash
# 检查后端服务状态
pm2 logs milk-can-mes-server --lines 20

# 检查前端页面
curl -I http://localhost/

# 检查 API 响应
curl http://localhost/api/health
```

### 10. 数据备份

#### 10.1 MySQL 备份（生产环境）

```bash
# 手动备份
mysqldump -u milk_can_mes -p milk_can_mes > /opt/backups/milk_can_mes_$(date +%Y%m%d).sql

# 设置定时备份（crontab）
crontab -e
# 添加：每天凌晨 2 点备份
0 2 * * * mysqldump -u milk_can_mes -pyour-password milk_can_mes > /opt/backups/milk_can_mes_$(date +\%Y\%m\%d).sql

# 恢复数据库
mysql -u milk_can_mes -p milk_can_mes < milk_can_mes_20260706.sql
```

#### 10.2 SQLite 备份（开发/小团队）

```bash
# SQLite 数据库备份
cp /opt/milk-can-mes/server/data/database.sqlite /opt/backups/database_$(date +%Y%m%d).sqlite

# 设置定时备份（crontab）
crontab -e
# 添加：每天凌晨 2 点备份
0 2 * * * cp /opt/milk-can-mes/server/data/database.sqlite /opt/backups/database_$(date +\%Y\%m\%d).sqlite
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
| 看板查看者 | viewer | 123456 | 仅查看大屏和报表，登录后默认跳转到生产实时看板 |

**登录后默认页面**：
- **看板查看者**角色登录后默认打开 `/bigscreen/production`（生产实时看板）
- **其他角色**登录后默认打开 `/dashboard`（工作台首页）

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

### 页面滚动规范

- **左侧菜单栏**：固定定位（`position: fixed`），高度 100vh，菜单过长时内部滚动，`z-index: 100`
- **顶部信息栏**：固定定位（`position: fixed`），高度 64px，不随内容滚动，`z-index: 99`，左侧间距随侧边栏宽度变化（220px / 80px）
- **内容区域**：独立滚动区域，`margin-top: 64px`，`overflow-y: auto`，`min-height: calc(100vh - 64px)`
- **布局结构**：主容器 `overflow: hidden`，侧边栏使用 `position: fixed`，内容区域使用 `margin-left` 适配侧边栏宽度
- **收缩适配**：侧边栏收缩时（80px），顶部栏和内容区通过 CSS 类名 `.collapsed` 自动适配左侧间距
- **滚动问题修复**：解决了侧边栏和顶部栏在用户鼠标滚动时一同滚动的问题，确保布局稳定不抖动

---

## 业务状态流转

### 生产订单状态

| 状态值 | 显示名称 | 说明 |
|--------|---------|------|
| 0 | 开立 | 初始状态，可编辑、下发、删除 |
| 1 | 下发 | 已下发到生产，可完工 |
| 2 | 完工 | 订单完工，仅可查看 |

### 工单状态

| 状态值 | 显示名称 | 说明 |
|--------|---------|------|
| 0 | 开立 | 初始状态，可编辑、开工、删除 |
| 1 | 开工 | 生产中，可完工 |
| 2 | 完工 | 最终状态，不可编辑 |

---

## 业务规则与控件规范

### 1. 基础数据模块

#### 1.1 料品档案

**页面路径**：`/basic/materials`

**列表排序**：按创建时间倒序（最新的在前）

**列表列**：料品编码、料品名称、规格、分类名称、单位、状态、生效日期、失效日期、操作

**统计卡片**：
- 料品总数（蓝色）
- 生效数（绿色）
- 失效数（红色）

**筛选条件**：
- 关键字（料品编码/名称模糊搜索）
- 状态（生效/失效）
- 分类名称（下拉，来自现有数据去重）

**表单字段（24+字段）**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 分类名称 | 文本 | 否 | 料品所属分类 |
| 料品编码 | 文本 | 是 | 唯一编码 |
| 料品名称 | 文本 | 是 | 料品名 |
| 规格型号 | 文本 | 否 | 规格 |
| 单位名称 | 文本 | 否 | 计量单位 |
| 菲林编号 | 文本 | 否 | 印刷菲林号 |
| 版本号 | 文本 | 否 | BOM 版本 |
| 裁切尺寸 | 文本 | 否 | 裁切规格 |
| 印刷工艺 | 文本 | 否 | 印刷方式 |
| 分色数 | 数字 | 否 | 颜色分色数 |
| 落料直径 | 数字 | 否 | 落料规格 |
| 材料厚度 | 数字 | 否 | 厚度(mm) |
| 材料宽度 | 数字 | 否 | 宽度(mm) |
| 材料高度 | 数字 | 否 | 高度(mm) |
| 废料重量 | 数字 | 否 | 单耗废料重 |
| 单重 | 数字 | 否 | 单件重量 |
| 单容积 | 数字 | 否 | 单件体积 |
| 重量单位 | 文本 | 否 | 如 g/kg |
| 体积单位 | 文本 | 否 | 如 ml/L |
| 库存分类 | 文本 | 否 | 库存归类 |
| 单位编码 | 文本 | 否 | 单位编码 |
| 关联客户 | 下拉 | 否 | 关联客户档案 |
| 是否生效 | 开关 | 是 | 默认开启 |
| 生效日期 | 日期 | 否 | 生效起始时间 |
| 失效日期 | 日期 | 否 | 失效时间 |

**关联规则**：
- 料品关联客户（从客户档案下拉选择），显示为「客户名称（简称）」
- 新增时 `is_active` 默认为 `true`

**计算公式**：无

#### 1.2 客户档案

**页面路径**：`/basic/customers`

**列表列**：客户编码、客户名称、简称、客户等级、信用等级、联系人、联系电话、状态、操作

**统计卡片**：客户总数、生效数、失效数

**筛选条件**：关键字（编码/名称）、状态、客户等级

**表单核心字段**：
- 客户编码、客户名称、简称（必填）
- 客户等级、信用等级
- 联系人、联系电话、邮箱、地址
- 税务登记号、开户银行、银行账号
- 生效/失效开关 + 日期范围

#### 1.3 产线档案

**页面路径**：`/basic/lines`

**列表列**：选择、产线编号、产线名称、负责人、产线工序、工序设备、状态、所属车间、排序号、操作

**统计卡片**：
- 总产线数（蓝色）
- 运行中（绿色）
- 维护中（橙色）

**筛选条件**：关键字、状态、车间（下拉去重）

**状态值**：运行中 / 维护中 / 停用

**表单字段**：
- 产线编码、产线名称、所属车间、负责人（必填）
- 联系电话、描述
- 状态（下拉：运行中/维护中/停用）

**表单配置区域**（新增/编辑弹窗下方）：
- **工序设备配置**：表格展示已关联的工序和设备（排序、工序编号、工序名称、设备编号、设备名称）
- 支持添加工序、添加设备（可选择关联到特定工序）、移除操作
- 提示文字："添加产线后可配置关联的工序和设备，设备可关联到特定工序"

**列表下方区域**：
- 用户点击产线列表的「选择」按钮后，在列表下方显示该产线的工序设备关联列表
- 显示列：排序、工序编号、工序名称、设备编号、设备名称
- 支持移除操作

**详情窗口**：
- 产线基本信息（产线编号、产线名称、状态、所属车间、负责人、排序号）
- 工序设备关联列表（排序、工序编号、工序名称、设备编号、设备名称）

**关联规则**：
- 产线与工序为多对多关系（`bas_line_process` 关联表）
- 产线与设备为多对多关系（`bas_line_device` 关联表），设备可关联到特定工序

#### 1.4 工序档案

**页面路径**：`/basic/processes`

**列表列**：工序编码、工序名称、工序类型、顺序号、是否关键工序、状态、操作

**筛选条件**：关键字、工序类型、状态

**表单字段**：
- 工序编码、工序名称（必填）
- 工序类型、顺序号（数字）
- 是否关键工序（开关）
- 标准工时（小时）
- 描述

#### 1.5 设备档案（基础）

**页面路径**：`/basic/devices`

**列表排序**：默认按设备类型升序、设备编号升序排序

**列表列**：设备编号、设备名称、型号、类型、位置、状态、特种设备、上次检定、下次检定、操作

**统计卡片**：
- 设备总数（蓝色）
- 运行中（绿色）
- 维修（橙色）
- 特种设备数（红色）

**筛选条件**：
- 关键字（设备编号/名称/型号模糊搜索）
- 设备类型（下拉，来自现有数据去重）
- 状态（运行/维修/停用）
- 是否特种设备（是/否）
- 筛选框宽度统一为 150px，所有控件放在一行

**表单字段**：
- 设备编码（新增时必填，编辑时不可修改）
- 设备名称（必填）
- 设备类型（必填）
- 设备型号
- 出厂编号
- 安装位置（必填）
- 状态（运行/维修/停用，默认运行）
- 是否特种设备（是/否，默认否）
- 负责人
- 制造商
- 购置日期
- 保修截止
- 上次检定日期
- 检定周期（月）
- 下次检定日期

**业务规则**：
- 设备编号在录入后不可修改
- 设备不允许删除（操作列仅显示查看、编辑按钮）
- 状态值：运行=1, 维修=2, 停用=0

#### 1.6 不良分类

**页面路径**：`/basic/defects`

**列表列（从左到右）**：
不良编码 → 大类名称 → 分类名称 → 不良项目 → 默认单位 → 关联工序 → 不良描述 → 状态 → 操作

**统计卡片**：不良分类总数、生效数、失效数

**筛选条件**：
- 关键字（编码/名称）
- 状态
- 不良类型（来料不良/制程不良/检验报废）

**大类 → 分类联动规则**：

| 大类名称 | 可选分类名称 |
|---------|-------------|
| 来料检验类 | 来料不良 |
| 制程检验类 | 来料不良、制程不良、检验报废 |

**关联工序规则**：
- 当大类为「来料检验类」时，**关联工序自动清空且禁用**（不可选）
- 当大类为「制程检验类」时，关联工序列表可用，可多选工序
- 切换大类时自动清空已选关联工序

**不良图片规则**：
- 每个不良项最多上传 **10 张**图片
- 上传卡片尺寸：**72×72px**（紧凑型）
- 图片支持拖拽排序
- 查看页面图片支持点击放大预览（`Image.PreviewGroup`，支持缩放/旋转）

**图片去重规则**：
- 同一不良项下，通过 **MD5 哈希值**判断图片是否重复
- 上传时进行两重校验：
  1. 本次上传的多张图片之间是否重复
  2. 与该不良项已上传的图片是否重复
- 检测到重复时直接报错提示，不上传重复文件
- 数据库表 `bas_defect_image` 存储 `file_hash` 字段

**不良编码规则**：
- 新增时由系统**自动生成**，输入框禁用
- 自动编码接口：`GET /basic/defect-types/next-code`
- 保存时若编码为空，会兜底重新获取编码后再提交
- 编辑时编码可修改

**表单字段顺序**：
不良编码 → 大类名称 → 分类名称 → 不良项目 → 默认单位 → 关联工序 → 不良描述 → 状态 → 不良图片

**分类名称标签颜色**：
- 来料不良 → blue
- 制程不良 → orange
- 检验报废 → red

**保存行为**：新增/编辑保存成功后自动关闭弹窗

---

### 2. 生产管理模块

#### 2.1 生产订单

**页面路径**：`/production/orders`

**列表排序**：按**订单编号倒序**（`order_no DESC`），最新的订单在前

**列表列**：订单编号、料品编码、料品名称、规格型号、计划数量、已完工数量、计划开始、计划完成、状态、操作

**统计卡片**：总订单数、开立数、下发数、完工数

**筛选条件**：
- 关键字（订单号/料品名模糊搜索）
- 料号（模糊搜索）
- 状态多选框（开立/下发/完工，默认选中开立、下发）
- 计划时间范围（开始日期~结束日期）
- 失焦/切换状态/选择日期后**立即触发查询**

**状态机**：`开立 → 下发 → 完工`

| 状态 | 编辑 | 下发 | 删除 | 完工 | 查看 |
|------|------|------|------|------|------|
| 开立 | ✓ | ✓ | ✓ | ✗ | ✓ |
| 下发 | ✗ | ✗ | ✗ | ✓ | ✓ |
| 完工 | ✗ | ✗ | ✗ | ✗ | ✓ |

**订单号规则**：`MO-16` + `YYMMDD` + 3位流水号（示例：`MO-16260704001`）
- 日重置：每日流水号从 001 开始重新计数

**料品筛选规则**：
- 新增订单时，料品下拉**仅显示 C 开头的成品罐料品**
- 选中料品后自动带入：料号、料品名称、规格、菲林编号、版本号

**表单校验**：
- 料品：必选
- 计划数量：必填，正整数
- 计划开始日期：不得早于今天
- 计划完成日期：不得早于计划开始日期

**订单详情**：查看抽屉展示订单基本信息 + 关联工单列表 + 关联人员记录 + 关联异常记录

#### 2.2 工单列表

**页面路径**：`/production/workorders`

**列表排序**：按**工单编号倒序**（`work_order_no DESC`），最新的工单在前

**列表列**：工单编号、生产订单、料品名称、产线、计划数量、已完成数量、开始时间、完成时间、状态、操作

**统计卡片**：
- 总工单数（蓝色）
- 开立（灰色）
- 开工（橙色）
- 完工（绿色）

**筛选条件**：
- 关键字（工单号/订单号/料品名）
- 状态下拉
- 产线下拉

**状态机**：`开立 → 开工 → 关闭 → 完工`

| 状态 | 编辑 | 开工 | 删除 | 关闭 | 完工 |
|------|------|------|------|------|------|
| 开立 | ✓ | ✓ | ✓ | ✗ | ✗ |
| 开工 | ✗ | ✗ | ✗ | ✓ | ✗ |
| 关闭 | ✗ | ✗ | ✗ | ✗ | ✓ |
| 完工 | ✗ | ✗ | ✗ | ✗ | ✗ |

**工单号规则**：`WO` + `YYYYMMDD` + 3位流水号
- 日重置：每日流水号从 001 开始

**新增工单规则**：
- 生产订单下拉**仅显示「下发」状态**的订单
- 选中生产订单后，自动带入料品信息
- **计划数量标签右侧**间隔 2 个字符位置显示「未生产数量」
- 未生产数量 = 订单计划数量 - 订单完工数量
  - `Math.max(0, planned_qty - finished_qty)`
- 颜色使用主题强调色 `var(--color-accent)`，12px，字重 500

**表单字段**：
- 生产订单（下拉，必选）
- 产线（下拉，必选）
- 计划数量（数字，必填，未生产数量提示）
- 计划日期区间（日期区间选择框，`YYYY-MM-DD` 格式）
- 负责人
- 备注

**表单变更说明**：
- 删除「班组长」字段
- 计划开始时间和计划完成时间合并为日期区间选择框

**工时计算**：工单完工后自动计算工时，按 0.5 小时取整

**工单详情**：查看抽屉展示基本信息 + 工序报工记录 + 人员记录 + 异常记录

#### 2.3 生产报工（工序级）

**页面路径**：`/production/reporting`

**列表列**：工单编号、工序、操作人、班次、报工数量、不良数量、不良明细、报工时间、操作

**统计卡片**：
- 总报工记录数（蓝色）
- 今日报工（青色）
- 累计产量（橙色）
- 累计不良（红色）

**筛选条件**：关键字、工序、工单

**报工表单字段**：
- 工单编号（下拉，必选）
- 工序（下拉，必选）
- 操作人（文本）
- 班次（下拉：白班/夜班，默认白班）
- 报工数量（数字，默认 0）
- 不良数量（数字，默认 0）
- 不良明细（文本域）
- 报工时间（日期时间，默认当前时间）
- 备注

**关联规则**：
- 工单下拉显示所有工单
- 工序下拉显示所有工序
- 保存时自动冗余工单号和工序名称

#### 2.4 人员记录

**页面路径**：`/production/manpower`

**列表列**：工单编号、产线、工序、人员姓名、班次、工时、产量、日期、操作

**统计卡片**：
- 总记录数（蓝色）
- 累计工时（橙色）
- 累计产量（青色）
- 当前页人数（紫色）

**筛选条件**：关键字、工单、班次

**表单字段**：
- 工单编号（下拉，必选）
- 产线（下拉，必选）
- 工序（下拉，必选）
- 人员姓名（文本）
- 班次（白班/夜班，默认白班）
- 工时（数字，默认 8）
- 产量（数字，默认 0）
- 日期（日期，默认今天）

#### 2.5 异常记录

**页面路径**：`/production/exceptions`

**列表列**：异常编号、关联订单、关联工单、异常类型、异常描述、发生时间、处理状态、操作

**统计卡片**：总异常数、未处理数、处理中、已完成

**筛选条件**：关键字、异常类型、处理状态

**表单字段**：
- 异常编号（自动生成）
- 关联生产订单（下拉）
- 关联工单（下拉）
- 异常类型（下拉）
- 异常描述（文本域）
- 发生时间（日期时间）
- 处理人
- 处理结果
- 处理状态（未处理/处理中/已完成）

---

### 3. 质量管理模块（页面框架）

| 模块 | 路径 | 说明 |
|------|------|------|
| 检验标准管理 | `/quality/standards` | 检验标准定义与版本控制 |
| 来料检验 | `/quality/incoming` | 原材料/外购件入厂检验 |
| 过程检验 | `/quality/process` | 生产过程中的工序检验 |
| 成品检验 | `/quality/finished` | 成品出厂前最终检验 |
| 产品微生物检验 | `/quality/microbe` | 微生物检测记录 |
| 环境检验 | `/quality/environment` | 生产环境洁净度检测 |
| 客诉管理 | `/quality/complaints` | 客户投诉处理与跟踪 |
| 供应商投诉 | `/quality/supplier` | 供应商质量投诉处理 |
| 检测仪器管理 | `/quality/instruments` | 仪器档案、校准记录 |

> 以上模块已创建页面框架，完整业务逻辑待后续开发。

---

### 4. 设备管理模块（页面框架）

| 模块 | 路径 | 说明 |
|------|------|------|
| 设备档案 | `/device/list` | 设备基础信息、特种设备检定记录 |
| 点检记录 | `/device/check-records` | 设备日常点检记录 |
| 维修保养 | `/device/maintenance` | 设备维修计划与保养记录 |
| 设备OEE | `/device/oee` | 设备综合效率分析 |

> 以上模块已创建页面框架，完整业务逻辑待后续开发。

---

### 5. 系统管理模块

#### 5.1 用户管理

**页面路径**：`/system/users`

**列表列**：用户名、姓名、角色、手机号、邮箱、状态、创建时间、操作

**筛选条件**：关键字（用户名/姓名）、角色、状态

**表单字段**：
- 用户名、姓名（必填）
- 密码（新增时必填，编辑时可选）
- 角色（下拉，必选）
- 手机号、邮箱
- 状态（启用/禁用）

**操作**：新增、编辑、删除、启用/禁用切换

#### 5.2 角色权限

**页面路径**：`/system/roles`

**列表列**：角色编码、角色名称、描述、状态、操作

**权限分配**：树形结构菜单/权限选择，支持全选/半选

**规则**：
- 角色名称唯一
- 启用状态的角色才能分配给用户

#### 5.3 菜单管理

**页面路径**：`/system/menus`

**树形结构**：支持多级菜单
- 目录 / 菜单 / 按钮 三种类型
- 支持排序、图标、路由路径配置

#### 5.4 数据字典

**页面路径**：`/system/dictionary`

**功能概述**：展示系统所有数据库表清单及其字段结构详情，用于快速查阅数据库字典信息。

**页面布局**：
- **顶部**：统计卡片（数据表总数、系统表数、业务表数）
- **筛选区**：表名/说明搜索、表分类筛选（系统表/基础数据表/业务表）、重置、刷新
- **主表格**：数据表列表

**列表列**：序号、表名、分类、字段数、记录数、说明、最后更新、操作（查看）

**表分类**：
- **系统表**（蓝色 Tag）：`sys_` 前缀，包含用户、角色、权限、配置、日志等
- **基础数据表**（绿色 Tag）：`bas_` / `master_` 前缀，包含料品、客户、产线、工序、设备、不良分类等
- **业务表**（橙色 Tag）：`production_` / `prod_` 前缀，包含订单、工单、报工、异常记录等

**字段详情抽屉**（点击「查看」按钮打开）：
- 表基本信息：表名、分类、字段数、记录数、最后更新、说明
- 字段明细表格：序号、字段名、类型、可空、主键、默认值、说明

**业务规则**：
- 表格按「分类排序（系统表→基础数据表→业务表） + 表名字母序」排序
- 支持按表名和说明模糊搜索
- 支持按表分类筛选
- 字段详情通过数据库 `describeTable` 实时获取，确保与实际表结构一致

**后端接口**：
- 获取数据库信息及表清单：`GET /api/system/config/database`
- 返回数据包含：数据库连接信息、表清单数组、各表字段详情对象

#### 5.5 编码规则

**页面路径**：`/basic/number-rules`

**功能特性**：
- 支持自由组合：前缀、日期格式、分隔符、序号位数、重置周期
- 启用即审核，同一表单字段仅一个生效规则
- 启用新规则自动停用旧规则
- 支持规则预览
- 操作列仅显示可操作按钮，已审核规则隐藏编辑和删除

**重置周期**：不重置 / 按日重置 / 按月重置 / 按年重置

#### 5.6 操作日志

**页面路径**：`/system/logs`

**列表列**：操作时间、操作人、模块、操作类型、操作内容、IP地址

**筛选条件**：模块、操作人、时间范围

**记录内容**：登录、登出、新增、编辑、删除、导入、导出等关键操作

---

### 6. 通用页面控件规范

#### 6.1 三段式页面结构

所有业务页面统一使用 `ThreeSectionPage` 组件，包含：

| 区域 | 占比 | 背景色 | 说明 |
|------|------|--------|------|
| 上部：页面信息区 | 15%~20% | `--bg-main` | 页面标题、面包屑、操作按钮、统计卡片 |
| 中部：筛选功能区 | 10%~15% | `--bg-card` | 筛选条件表单，可折叠 |
| 下部：列表区 | 65%~75% | `--bg-card` | 数据表格，默认每页 30 条 |

#### 6.2 操作按钮配色

| 按钮类型 | 配色方案 | 用途示例 |
|----------|---------|---------|
| 新增按钮 | 主色渐变（primary → secondary） | 新增、创建 |
| 导出按钮 | 成功色渐变 | 导出 Excel |
| 配置按钮 | 强调色渐变 | 配置、设置 |

#### 6.3 表格规范

- 表头文字统一居中
- 操作列统一固定宽度
- 小间距模式：单元格 padding 4px~8px
- 料品名称列：最小宽度 200px，内容过长自动换行
- 默认分页：每页 30 条
- 状态使用 `Tag` 组件展示，不同状态对应不同颜色

#### 6.4 表单规范

- 必填项带红色星号（`required: true`）
- Modal 表单使用 `destroyOnClose` 销毁内部组件
- 编辑时通过 `afterOpenChange` 回调在打开动画结束后赋值
- 数字输入默认 0 或空值
- 日期格式统一 `YYYY-MM-DD`，日期时间 `YYYY-MM-DD HH:mm:ss`

#### 6.5 筛选交互规范

- 输入框采用「输入态 → 已应用查询态」双状态模式
- 失焦时立即触发查询（onBlur）
- 下拉选择变更时立即触发查询
- 日期选择完成时立即触发查询
- 重置按钮清空所有筛选条件并重置为第 1 页

#### 6.6 主题与颜色规范

- 使用 CSS 变量（`var(--xxx)`）而不是硬编码颜色
- 强调信息使用 `var(--color-accent)`（随主题切换）
- 状态色：成功 `--color-success`、警告 `--color-warning`、错误 `--color-error`
- 文字色：主要 `--text-primary`、次要 `--text-secondary`

---

## 大屏看板规则

### 数据展示规则

- **当天数据优先**：所有大屏默认显示当天数据；当天无数据时自动回退到上一个有数据的日期
- **ECharts 动画禁用**：工序产出统计、工单实时进度图表禁用动画（`animation: false`），确保数据实时准确
- **生产订单排序**：按 `下发 → 开工 → 完工` 顺序排列
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
| GET | `/api/basic/production-lines/:id/processes` | 获取产线关联工序列表 |
| POST | `/api/basic/production-lines/:id/processes` | 添加产线-工序关联 |
| DELETE | `/api/basic/production-lines/:id/processes/:processId` | 删除产线-工序关联 |
| PUT | `/api/basic/production-lines/:id/processes/sort` | 更新工序排序 |
| GET | `/api/basic/production-lines/:id/devices` | 获取产线关联设备列表 |
| POST | `/api/basic/production-lines/:id/devices` | 添加产线-设备关联 |
| DELETE | `/api/basic/production-lines/:id/devices/:deviceId` | 删除产线-设备关联 |
| PUT | `/api/basic/production-lines/:id/devices/sort` | 更新设备排序 |
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

### 模型清单（26个）

| 模型 | 表名 | 说明 |
|------|------|------|
| User | `sys_user` | 用户表 |
| Role | `sys_role` | 角色表 |
| Permission | `sys_permission` | 权限/菜单表 |
| RolePermission | `sys_role_permission` | 角色-权限关联表 |
| OperationLog | `sys_operation_log` | 操作日志表 |
| SystemConfig | `sys_config` | 系统配置表 |
| DictType | `sys_dict_type` | 字典类型表 |
| DictData | `sys_dict_data` | 字典项表 |
| Material | `bas_material` | 料品档案表 |
| Customer | `bas_customer` | 客户档案表 |
| ProductionLine | `bas_production_line` | 产线档案表 |
| Process | `bas_process` | 工序档案表 |
| LineProcess | `bas_line_process` | 产线-工序关联表 |
| Device | `bas_device` | 设备档案表 |
| LineDevice | `bas_line_device` | 产线-设备关联表 |
| DefectType | `bas_defect_type` | 不良分类表（树形自关联） |
| DefectImage | `bas_defect_image` | 不良图片表 |
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
- **字典类型 - 字典项**：一对多（DictType.hasMany(DictData, { foreignKey: 'dict_type', sourceKey: 'dict_type' })）
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
- 版本：V1.0.0.109
- 所属公司：东莞市大满包装实业有限公司长沙分公司
