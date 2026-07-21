# 奶粉罐生产管理系统 (Milk Can MES)

> 版本：V1.0.1.1
>
> 东莞市大满包装实业有限公司长沙分公司 — 奶粉罐生产制造执行系统

基于 React + TypeScript 5.x + Ant Design + Vite + Node.js + Express + Sequelize + SQLite/MySQL 构建的现代化生产制造执行系统，覆盖生产管理、质量管理、设备管理、数据大屏、报表中心、移动端等核心业务模块。

---

## 目录

- [项目概述](#项目概述)
- [技术栈](#技术栈)
- [功能模块](#功能模块)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [生产部署指南](#生产部署指南)
- [默认登录账号](#默认登录账号)
- [主题系统](#主题系统)
- [移动端](#移动端)
- [API 接口概览](#api-接口概览)
- [数据库模型](#数据库模型)
- [编码规则](#编码规则)
- [开发规范](#开发规范)
- [常见问题](#常见问题)

---

## 项目概述

奶粉罐生产管理系统（Milk Can MES）是一套面向金属包装制造行业的生产制造执行系统，针对奶粉罐生产过程的全流程数字化管理需求而设计。系统涵盖从基础数据维护、生产订单下发、报工执行、质量检验、设备管理到数据可视化的完整业务链条，同时支持 PC 端与移动端双端访问。

### 核心价值

- **生产透明化**：实时掌握订单进度、报工状态、产线运行情况
- **质量可追溯**：全流程质量数据记录，不良项目与工序关联
- **设备可视化**：设备档案、点检、维修、OEE 分析一体化
- **决策数据化**：多维度报表与大屏看板，数据驱动决策
- **双端协同**：PC 端管理 + 移动端报工，满足车间现场需求
- **个性体验**：六套主题配色，支持自定义头像，灵活适配不同场景

---

## 技术栈

### 前端技术栈

| 技术 | 版本 | 分类 | 说明 |
|------|------|------|------|
| React | 18.3 | 核心框架 | 前端 UI 框架 |
| TypeScript | 5.6 | 类型系统 | JavaScript 超集，静态类型检查 |
| React DOM | 18.3 | 核心框架 | React DOM 渲染 |
| React Router DOM | 6.26 | 路由管理 | 声明式路由，支持嵌套路由与路由守卫 |
| Ant Design | 5.21 | UI 组件库 | 企业级 UI 设计，支持暗色模式 |
| Ant Design Mobile | 5.42 | 移动端 UI | 移动端组件库 |
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
| TypeScript | 5.6 | 类型系统 | JavaScript 超集，静态类型检查 |
| Express | 4.21 | Web 框架 | 轻量级 Web 应用框架 |
| Sequelize | 6.37 | ORM 框架 | 多数据库支持的 ORM |
| SQLite | - | 数据库 | 开发环境默认数据库，零配置 |
| MySQL | 8.0+ | 数据库 | 生产环境推荐数据库 |
| mysql2 | 3.11 | 数据库驱动 | MySQL Node.js 驱动 |
| sqlite3 | 6.0 | 数据库驱动 | SQLite Node.js 驱动 |
| JWT (jsonwebtoken) | 9.0 | 身份认证 | 基于 Token 的身份认证 |
| bcryptjs | 2.4 | 密码加密 | 密码哈希加密 |
| CORS | 2.8 | 跨域处理 | 跨域资源共享中间件 |
| dotenv | 16.4 | 环境配置 | 环境变量管理 |
| Morgan | 1.10 | 日志 | HTTP 请求日志 |
| Multer | 2.2 | 文件上传 | 文件上传处理中间件 |
| http-proxy | 1.18 | 代理 | 开发环境前端代理 |
| tsx | 4.23 | 运行工具 | TypeScript 执行引擎，开发环境直接运行 TS |

---

## 功能模块

### 1. 系统管理

| 模块 | 路径 | 功能说明 |
|------|------|---------|
| 用户管理 | `/system/users` | 用户增删改查、角色分配、启用/禁用、搜索筛选 |
| 角色管理 | `/system/roles` | 角色定义、权限分配、角色增删改 |
| 菜单管理 | `/system/menus` | 菜单/权限树形结构管理，支持多级菜单 |
| 数据字典 | `/system/dictionary` | 数据库表字典查看，展示所有数据表结构和字段详情 |
| 系统配置 | `/system/config` | 参数配置、项目环境、数据库配置、备份还原、文件查看（多页签） |
| 操作日志 | `/system/logs` | 用户操作行为审计，支持按模块/用户/时间筛选 |

**系统配置页包含：**

- **项目环境**：磁盘信息、操作系统、运行时、技术栈版本、前端/后端服务器状态、重启服务
- **参数配置**：系统名称、公司名称等基础参数
- **数据库配置**：数据库类型、连接信息、数据迁移
- **备份还原**：数据库备份列表、创建备份、还原备份、删除备份
- **文件查看**：查看 uploads 目录及其子目录所有文件

### 2. 基础数据

| 模块 | 路径 | 功能说明 |
|------|------|---------|
| 料品档案 | `/basic/materials` | 料品基础信息，支持分类、规格、尺寸、重量、印刷工艺等 |
| 客户档案 | `/basic/customers` | 客户基础信息、信用等级、税务银行信息、生效失效日期 |
| 产线档案 | `/basic/lines` | 生产线配置、产线-工序关联、产线-设备关联配置 |
| 工序档案 | `/basic/processes` | 生产工序定义、顺序调整 |
| 设备档案（基础） | `/basic/devices` | 设备基础信息、特种设备管理 |
| 不良项目管理 | `/basic/defects` | 不良项目维护、检验类型与不良类型联动、不良图片、关联工序 |
| 编码管理 | `/basic/number-rules` | 自动编号规则配置，支持前缀、日期格式、分隔符、序号位数、重置周期 |

### 3. 生产管理

| 模块 | 路径 | 功能说明 |
|------|------|---------|
| 生产订单 | `/production/orders` | 订单创建、下发、关闭全生命周期，订单号自动生成 |
| 生产报工 | `/production/reporting` | 生产报工单管理，支持多日报工，子表格数据按报工单归属 |

#### 生产订单业务流程

**状态机**：`开立 → 下发 → 完工`

| 状态 | 编辑 | 下发 | 删除 | 完工 | 查看 |
|------|------|------|------|------|------|
| 开立 | ✓ | ✓ | ✓ | ✗ | ✓ |
| 下发 | ✗ | ✗ | ✗ | ✓ | ✓ |
| 完工 | ✗ | ✗ | ✗ | ✗ | ✓ |

**订单号规则**：`MO-16` + `YYMMDD` + 3位流水号（如 `MO-16260704001`）

#### 生产报工业务模型

- **生产报工单**是**生产订单**的下级独立单据
- 一个生产订单可对应多张生产报工单（适用于多日生产场景）
- 子表格数据（不良记录、物料记录、异常工时、人员记录）均挂在具体报工单下
- 子表格的只读/可编辑状态与所属报工单保持一致

**报工图片命名规则**：`报工单号 + 年月日 + 三位流水码`（如 `WO260719001-20260721-001`），存放在 `uploads/reports/` 目录，上传时使用 MD5 去重校验。

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

### 9. 移动端

| 模块 | 路径 | 功能说明 |
|------|------|---------|
| 移动端首页 | `/mobile/home` | 功能入口导航 |
| 生产订单 | `/mobile/orders` | 生产订单列表与详情 |
| 生产报工 | `/mobile/reporting` | 报工单列表、报工详情、不良记录、物料记录、检验报废、图片上传 |
| 个人中心 | `/mobile/profile` | 用户信息、设置 |

移动端使用 Ant Design Mobile 组件库，适配手机屏幕，支持车间现场扫码报工、图片上传等操作。

---

## 项目结构

```
milk-can-mes/
├── src/                              # 前端源码
│   ├── assets/                       # 静态资源（Logo图片等）
│   │   ├── logo-rect.png
│   │   └── logo-square.png
│   ├── components/                   # 公共组件
│   │   └── ThreeSectionPage.tsx      # 三段式页面通用组件
│   ├── contexts/                     # React Context
│   │   └── AppContext.tsx            # 全局状态（用户、主题等）
│   ├── layouts/                      # 布局组件
│   │   └── MainLayout.tsx            # 主布局（侧边栏+顶栏+内容区）
│   ├── mobile/                       # 移动端模块
│   │   ├── MobileLayout.tsx          # 移动端布局
│   │   ├── MobileRoutes.tsx          # 移动端路由
│   │   ├── mobile.css                # 移动端样式
│   │   └── pages/                    # 移动端页面
│   │       ├── MobileHome.tsx
│   │       ├── MobileLogin.tsx
│   │       ├── ProfilePage.tsx
│   │       └── production/
│   │           ├── OrderList.tsx
│   │           ├── OrderDetail.tsx
│   │           ├── ReportList.tsx
│   │           └── ReportDetail.tsx
│   ├── pages/                        # PC端页面组件
│   │   ├── basic/                    # 基础数据模块
│   │   │   ├── MaterialManagement.tsx
│   │   │   ├── CustomerManagement.tsx
│   │   │   ├── ProductionLine.tsx
│   │   │   ├── ProcessManagement.tsx
│   │   │   ├── DeviceManagement.tsx
│   │   │   ├── DefectManagement.tsx
│   │   │   └── NumberRuleManagement.tsx
│   │   ├── bigscreen/                # 数据大屏模块
│   │   │   ├── ProductionBigScreen.tsx
│   │   │   ├── QualityBigScreen.tsx
│   │   │   └── ManagementBigScreen.tsx
│   │   ├── device/                   # 设备管理模块
│   │   │   ├── DeviceManagement.tsx
│   │   │   ├── CheckRecord.tsx
│   │   │   ├── Maintenance.tsx
│   │   │   └── DeviceOEE.tsx
│   │   ├── production/               # 生产管理模块
│   │   │   ├── OrderManagement.tsx
│   │   │   └── ProcessReporting.tsx
│   │   ├── quality/                  # 质量管理模块
│   │   │   ├── InspectionStandard.tsx
│   │   │   ├── IncomingInspection.tsx
│   │   │   ├── ProcessInspection.tsx
│   │   │   ├── FinishedInspection.tsx
│   │   │   ├── MicrobeInspection.tsx
│   │   │   ├── EnvironmentInspection.tsx
│   │   │   ├── ComplaintManagement.tsx
│   │   │   ├── SupplierComplaint.tsx
│   │   │   └── InstrumentManagement.tsx
│   │   ├── report/                   # 报表中心模块
│   │   │   ├── DailyReport.tsx
│   │   │   ├── MonthlyReport.tsx
│   │   │   ├── EfficiencyReport.tsx
│   │   │   ├── ProductionReport.tsx
│   │   │   ├── QualityReport.tsx
│   │   │   └── ExceptionReport.tsx
│   │   ├── system/                   # 系统管理模块
│   │   │   ├── UserManagement.tsx
│   │   │   ├── RoleManagement.tsx
│   │   │   ├── MenuManagement.tsx
│   │   │   ├── DataDictionary.tsx
│   │   │   ├── SystemConfig.tsx
│   │   │   └── OperationLogs.tsx
│   │   ├── Dashboard.tsx             # 工作台首页
│   │   └── Login.tsx                 # 登录页
│   ├── styles/                       # 全局样式
│   │   ├── global.css                # 全局样式（布局、组件、主题）
│   │   └── bigscreen.css             # 大屏专属样式
│   ├── themes/                       # 主题配置
│   │   └── index.ts                  # 六套主题定义与切换函数
│   ├── utils/                        # 工具函数
│   │   ├── api.ts                    # Axios 实例与拦截器
│   │   └── index.ts                  # 通用工具函数
│   ├── mock/                         # Mock 数据
│   │   └── data.ts
│   ├── main.tsx                      # 应用入口（路由配置）
│   └── vite-env.d.ts                 # Vite 类型声明
├── server/                           # 后端源码
│   ├── src/
│   │   ├── config/                   # 配置文件
│   │   │   └── database.ts           # 数据库配置（SQLite/MySQL 切换）
│   │   ├── controllers/              # 控制器（业务逻辑层）
│   │   │   ├── AuthController.ts     # 认证控制器
│   │   │   ├── UserController.ts     # 用户管理控制器
│   │   │   ├── RoleController.ts     # 角色管理控制器
│   │   │   ├── PermissionController.ts  # 权限/菜单控制器
│   │   │   ├── DictController.ts     # 数据字典控制器
│   │   │   ├── SystemConfigController.ts  # 系统配置控制器
│   │   │   ├── OperationLogController.ts  # 操作日志控制器
│   │   │   ├── MaterialController.ts # 料品档案控制器
│   │   │   ├── CustomerController.ts # 客户档案控制器
│   │   │   ├── ProductionLineController.ts  # 产线控制器
│   │   │   ├── LineRelationController.ts    # 产线关联控制器（工序/设备）
│   │   │   ├── ProcessController.ts  # 工序控制器
│   │   │   ├── DeviceController.ts   # 设备控制器
│   │   │   ├── DefectTypeController.ts  # 不良项目控制器
│   │   │   ├── DefectImageController.ts # 不良图片控制器
│   │   │   ├── NumberRuleController.ts  # 编码规则控制器
│   │   │   ├── OrderController.ts    # 生产订单控制器
│   │   │   ├── ReportOrderController.ts  # 报工单控制器
│   │   │   ├── ReportImageController.ts  # 报工图片控制器
│   │   │   ├── ManpowerRecordController.ts # 人员记录控制器
│   │   │   ├── ProcessDefectController.ts  # 不良记录控制器
│   │   │   ├── ProcessExceptionController.ts  # 异常工时控制器
│   │   │   ├── ProcessMaterialController.ts # 物料记录控制器
│   │   │   ├── UploadController.ts   # 通用上传控制器
│   │   │   └── FileManagerController.ts # 文件管理控制器
│   │   ├── middleware/               # 中间件
│   │   │   └── auth.ts               # JWT 认证、权限校验、操作日志
│   │   ├── models/                   # 数据模型（Sequelize Model）
│   │   │   ├── index.ts              # 模型导出与关联定义
│   │   │   ├── User.ts               # 用户模型
│   │   │   ├── Role.ts               # 角色模型
│   │   │   ├── Permission.ts         # 权限/菜单模型
│   │   │   ├── RolePermission.ts     # 角色-权限关联表
│   │   │   ├── DictType.ts           # 字典类型模型
│   │   │   ├── DictData.ts           # 字典项模型
│   │   │   ├── DataDictionary.ts     # 数据字典模型
│   │   │   ├── OperationLog.ts       # 操作日志模型
│   │   │   ├── SystemConfig.ts       # 系统配置模型
│   │   │   ├── Material.ts           # 料品档案模型
│   │   │   ├── Customer.ts           # 客户档案模型
│   │   │   ├── ProductionLine.ts     # 产线模型
│   │   │   ├── Process.ts            # 工序模型
│   │   │   ├── LineProcess.ts        # 产线-工序关联表
│   │   │   ├── Device.ts             # 设备模型
│   │   │   ├── LineDevice.ts         # 产线-设备关联表
│   │   │   ├── DefectType.ts         # 不良项目模型
│   │   │   ├── DefectImage.ts        # 不良图片模型
│   │   │   ├── NumberRule.ts         # 编码规则模型
│   │   │   ├── Sequence.ts           # 序号流水号模型
│   │   │   ├── Order.ts              # 生产订单模型
│   │   │   ├── ReportOrder.ts        # 报工单模型
│   │   │   ├── ReportProcess.ts      # 报工工序模型
│   │   │   ├── ReportImage.ts        # 报工图片模型
│   │   │   ├── ManpowerRecord.ts     # 人员投入记录模型
│   │   │   ├── ProcessDefect.ts      # 不良记录模型
│   │   │   ├── ProcessException.ts   # 异常工时记录模型
│   │   │   └── ProcessMaterial.ts    # 物料记录模型
│   │   ├── routes/                   # 路由定义
│   │   │   ├── index.ts              # 路由总入口
│   │   │   ├── auth.ts               # 认证路由
│   │   │   ├── system.ts             # 系统管理路由
│   │   │   ├── basic.ts              # 基础数据路由
│   │   │   └── production.ts         # 生产管理路由
│   │   ├── utils/                    # 工具函数
│   │   │   ├── jwt.ts                # JWT 签发与验证
│   │   │   ├── response.ts           # 统一响应格式
│   │   │   ├── sequence.ts           # 序号生成器
│   │   │   └── statusMap.ts          # 状态码映射
│   │   ├── app.ts                    # 应用入口（Express 实例化）
│   │   ├── seed.ts                   # 数据初始化脚本
│   │   ├── clean-init.ts             # 数据清理脚本
│   │   ├── migrate.ts                # 数据库列迁移
│   │   ├── import-materials.ts       # 料品档案种子数据导入
│   │   └── import-devices.ts         # 设备档案种子数据导入
│   ├── data/                         # SQLite 数据库文件
│   │   ├── mes.db
│   │   └── backups/                  # 备份文件目录
│   ├── uploads/                      # 上传文件目录
│   │   ├── avatars/                  # 用户头像
│   │   ├── tmp/                      # 临时上传目录
│   │   ├── defects/                  # 不良图片
│   │   ├── apps/                     # 应用文件
│   │   └── reports/                  # 报工图片
│   ├── seed-data/                    # 种子数据 JSON 文件
│   ├── .env                          # 环境变量
│   ├── tsconfig.json                 # TypeScript 配置
│   └── package.json
├── dist/                             # 前端构建产物
├── index.html                        # HTML 入口
├── vite.config.ts                    # Vite 配置
├── tsconfig.json                     # TypeScript 配置
├── package.json                      # 前端依赖
├── ecosystem.config.cjs              # PM2 生产配置
├── ecosystem.dev.cjs                 # PM2 开发配置
├── nginx-milk-can-mes-dev.conf       # Nginx 配置示例
├── setup.sh                          # 一键部署脚本
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
npm run seed

# 启动后端服务
npm run dev
```

后端服务默认运行在 `http://localhost:3001`

> 后端基于 **tsx** 运行 TypeScript，无需手动编译，开发时直接运行 `.ts` 文件。
> 开发环境下后端会自动代理非 API 请求到前端 Vite 开发服务器（`http://localhost:5173`）。

### 数据库操作

```bash
# 进入后端目录
cd server

# 初始化数据库
npm run seed

# 清空所有业务数据（保留角色和 admin 用户）
npx tsx src/clean-init.ts

# 导入料品档案种子数据
npx tsx src/import-materials.ts

# 导入设备档案种子数据
npx tsx src/import-devices.ts
```

### 环境变量配置

在 `server/.env` 文件中可配置以下环境变量：

```env
# 数据库配置
DB_DIALECT=sqlite      # 数据库类型：sqlite / mysql
DB_HOST=localhost      # MySQL 主机
DB_PORT=3306           # MySQL 端口
DB_NAME=mes            # 数据库名
DB_USER=root           # MySQL 用户名
DB_PASSWORD=           # MySQL 密码

# 服务配置
PORT=3001              # 服务端口

# JWT 配置
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
```

---

## 生产部署指南

### 数据库选型建议

| 维度 | SQLite（默认） | MySQL（推荐生产） |
|------|---------------|-----------------|
| **适用场景** | 开发测试、小团队（≤10人）、试运行 | 正式生产、多用户并发、数据量大 |
| **并发能力** | 单写多读，写入时全库锁 | 高并发读写，行级锁，连接池 |
| **数据规模** | 建议 < 10GB，单表 < 千万级 | TB 级数据，亿级记录 |
| **运维成本** | 零运维，无需安装数据库服务 | 需要安装、配置、调优、监控 |

> **生产环境强烈推荐使用 MySQL 8.0+**。项目基于 Sequelize ORM 开发，已完全兼容 MySQL，只需修改环境变量即可切换。

### 部署步骤

```bash
# 1. 克隆项目
git clone <repository-url> milk-can-mes
cd milk-can-mes

# 2. 前端安装与构建
npm install
npm run build

# 3. 后端安装
cd server
npm install

# 4. 初始化数据库
npm run seed

# 5. 使用 PM2 启动服务
cd ..
pm2 start ecosystem.config.cjs
```

### PM2 配置

项目根目录提供 `ecosystem.config.cjs` 配置文件，包含两个应用：

- `milk-can-mes-api`：后端 API 服务（端口 3001）
- `milk-can-mes-web`：前端静态文件服务（端口 5173）

### Nginx 反向代理（推荐）

生产环境建议使用 Nginx 作为反向代理，参考配置文件 `nginx-milk-can-mes-dev.conf`。

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
2. **持久化**：主题选择保存在 localStorage（`mes_theme`），刷新后保留

---

## 移动端

### 访问方式

- 开发环境：`http://localhost:5173/mobile/home`
- 生产环境：`https://your-domain/mobile/home`

### 功能模块

- **首页**：功能入口导航卡片
- **生产订单**：订单列表查看、订单详情
- **生产报工**：报工单列表、报工详情、不良记录、物料记录、检验报废、图片上传
- **个人中心**：用户信息展示、设置

### 技术特点

- 使用 Ant Design Mobile 5.x 组件库
- 复用 PC 端 JWT 认证体系
- 复用 PC 端 API 接口
- 响应式布局，适配手机屏幕

---

## API 接口概览

所有 API 接口统一前缀：`/api`

### 认证接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/login` | 用户登录 |
| POST | `/auth/logout` | 用户登出 |
| GET | `/auth/me` | 获取当前用户信息 |

### 系统管理接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST/PUT/DELETE | `/system/users` | 用户管理 |
| GET/POST/PUT/DELETE | `/system/roles` | 角色管理 |
| GET/POST/PUT/DELETE | `/system/menus` | 菜单管理 |
| GET | `/system/dictionary` | 数据字典 |
| GET/PUT | `/system/config` | 系统配置 |
| GET | `/system/config/health` | 健康检查 |
| GET/POST/DELETE | `/system/config/backups` | 备份管理 |
| POST | `/system/config/restart` | 重启服务 |
| GET | `/system/logs` | 操作日志 |

### 基础数据接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST/PUT/DELETE | `/basic/materials` | 料品档案 |
| GET/POST/PUT/DELETE | `/basic/customers` | 客户档案 |
| GET/POST/PUT/DELETE | `/basic/lines` | 产线档案 |
| GET/POST/DELETE | `/basic/lines/:id/processes` | 产线工序关联 |
| GET/POST/DELETE | `/basic/lines/:id/devices` | 产线设备关联 |
| GET/POST/PUT/DELETE | `/basic/processes` | 工序档案 |
| GET/POST/PUT/DELETE | `/basic/devices` | 设备档案 |
| GET/POST/PUT/DELETE | `/basic/defects` | 不良项目 |
| GET/POST/DELETE | `/basic/defects/:id/images` | 不良图片 |
| GET | `/basic/defects/next-code` | 下一个不良编码 |
| GET/POST/PUT/DELETE | `/basic/number-rules` | 编码规则 |

### 生产管理接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST/PUT/DELETE | `/production/orders` | 生产订单 |
| POST | `/production/orders/:id/release` | 订单下发 |
| POST | `/production/orders/:id/close` | 订单关闭 |
| GET/POST/PUT/DELETE | `/production/report-orders` | 报工单 |
| POST | `/production/report-orders/:id/finish` | 报工完成 |
| GET | `/production/report-orders/:id/processes` | 报工工序 |
| GET/POST/PUT/DELETE | `/production/manpower-records` | 人员记录 |
| GET/POST/PUT/DELETE | `/production/defect-records` | 不良记录 |
| GET/POST/PUT/DELETE | `/production/scrap-records` | 报废记录 |
| GET/POST/PUT/DELETE | `/production/exception-records` | 异常工时 |
| GET/POST/PUT/DELETE | `/production/material-records` | 物料记录 |
| GET/POST/DELETE | `/production/report-images` | 报工图片 |
| POST | `/production/report-images/:report_no/:category/upload` | 上传报工图片 |

### 通用上传接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/upload/image` | 通用图片上传（单文件） |

---

## 数据库模型

### 核心数据表

| 表名 | 模型名 | 说明 |
|------|--------|------|
| `sys_user` | User | 用户表 |
| `sys_role` | Role | 角色表 |
| `sys_permission` | Permission | 权限/菜单表 |
| `sys_role_permission` | RolePermission | 角色权限关联表 |
| `sys_operation_log` | OperationLog | 操作日志表 |
| `sys_config` | SystemConfig | 系统配置表 |
| `sys_dict_type` | DictType | 字典类型表 |
| `sys_dict_data` | DictData | 字典数据表 |
| `sys_data_dictionary` | DataDictionary | 数据字典表 |
| `bas_material` | Material | 料品档案表 |
| `bas_customer` | Customer | 客户档案表 |
| `bas_production_line` | ProductionLine | 产线档案表 |
| `bas_process` | Process | 工序档案表 |
| `bas_line_process` | LineProcess | 产线工序关联表 |
| `bas_device` | Device | 设备档案表 |
| `bas_line_device` | LineDevice | 产线设备关联表 |
| `bas_defect_type` | DefectType | 不良项目表 |
| `bas_defect_image` | DefectImage | 不良图片表 |
| `bas_number_rule` | NumberRule | 编码规则表 |
| `bas_sequence` | Sequence | 序号流水号表 |
| `prod_order` | Order | 生产订单表 |
| `prod_report_order` | ReportOrder | 报工单表 |
| `prod_report_process` | ReportProcess | 报工工序表 |
| `prod_report_image` | ReportImage | 报工图片表 |
| `prod_manpower_record` | ManpowerRecord | 人员记录表 |
| `prod_process_defect` | ProcessDefect | 不良记录表 |
| `prod_process_exception` | ProcessException | 异常工时表 |
| `prod_process_material` | ProcessMaterial | 物料记录表 |

### 主要关联关系

- **用户 - 角色**：多对一（User.belongsTo(Role)）
- **角色 - 权限**：多对多（Role.belongsToMany(Permission, through: RolePermission)）
- **客户 - 料品**：一对多（Customer.hasMany(Material)）
- **产线 - 工序**：多对多（ProductionLine.belongsToMany(Process, through: LineProcess)）
- **产线 - 设备**：多对多（ProductionLine.belongsToMany(Device, through: LineDevice)）
- **订单 - 报工单**：一对多（Order.hasMany(ReportOrder)）
- **报工单 - 报工工序**：一对多（ReportOrder.hasMany(ReportProcess)）
- **报工单 - 不良记录**：一对多（ReportOrder.hasMany(ProcessDefect)）
- **报工单 - 物料记录**：一对多（ReportOrder.hasMany(ProcessMaterial)）
- **报工单 - 异常工时**：一对多（ReportOrder.hasMany(ProcessException)）
- **报工单 - 报工图片**：一对多（ReportOrder.hasMany(ReportImage)）
- **不良项目 - 不良图片**：一对多（DefectType.hasMany(DefectImage)）

---

## 编码规则

### 不良项目编码规则

**格式**：`检验类型缩写-不良类型缩写-两位流水码`

| 检验类型 | 缩写 | 不良类型 | 缩写 |
|---------|------|---------|------|
| 来料检验类型 | IC | 外观不良 | COS |
| 来料检验类型 | IC | 尺寸不良 | DIM |
| 来料检验类型 | IC | 理化不良 | PHC |
| 来料检验类型 | IC | 材质不良 | MAT |
| 来料检验类型 | IC | 标识不良 | LBL |
| 来料检验类型 | IC | 污染异物 | CON |
| 来料检验类型 | IC | 运输不良 | TRD |
| 制程检验类型 | PC | 制程不良 | PNC |
| 制程检验类型 | PC | 来料不良 | INC |
| 制程检验类型 | PC | 检验报废 | SCR |

**示例**：
- `IC-COS-01`（来料检验类型-外观不良-第1条）
- `PC-PNC-01`（制程检验类型-制程不良-第1条）
- `PC-SCR-01`（制程检验类型-检验报废-第1条）

### 生产订单编码规则

**格式**：`MO-16` + `YYMMDD` + 3位流水号

**示例**：`MO-16260704001`

### 报工单编码规则

**格式**：`WO` + `YYMMDD` + 3位流水号

**示例**：`WO260704001`

### 报工图片命名规则

**格式**：`报工单号` + `-` + `YYYYMMDD` + `-` + 三位流水码

**示例**：`WO260719001-20260721-001`

> 图片存放在 `uploads/reports/` 目录，上传时使用 MD5 哈希去重校验。

---

## 开发规范

### 页面布局规范

系统大部分业务页面采用统一的"三段式"布局结构：

| 区域 | 占比 | 背景色 | 说明 |
|------|------|--------|------|
| 上部：页面信息区 | 15%~20% | 主背景色 | 页面标题、面包屑、操作按钮、统计卡片 |
| 中部：筛选功能区 | 10%~15% | 卡片背景色 | 筛选条件表单，可折叠 |
| 下部：列表区 | 65%~75% | 卡片背景色 | 数据表格，默认每页 30 条 |

### 代码规范

- 使用 TypeScript 编写，优先使用类型安全
- 组件使用函数式组件 + Hooks
- API 请求统一使用 `utils/api.ts` 中的 Axios 实例
- 全局状态使用 React Context（AppContext）
- 样式优先使用 CSS 变量，支持主题切换

### 后端开发规范

- 控制器（Controller）负责处理 HTTP 请求和响应
- 模型（Model）负责数据持久化
- 路由（Route）负责 URL 映射
- 中间件（Middleware）负责认证、日志等横切关注点
- 工具函数（Utils）负责通用功能

### Git 提交规范

```
<type>: <subject>

type 类型：
- feat: 新功能
- fix: 修复bug
- docs: 文档更新
- style: 代码格式调整
- refactor: 重构
- perf: 性能优化
- test: 测试相关
- chore: 构建/工具相关
```

---

## 常见问题

### 1. 前端启动后白屏？

检查浏览器控制台是否有报错，确认后端服务是否启动（`http://localhost:3001/api/health`）。

### 2. 后端启动报错 "Cannot find module"？

请先在 `server` 目录下执行 `npm install` 安装依赖。

### 3. 图片上传失败？

- 确保 `server/uploads` 目录及其子目录存在
- 检查文件大小是否超过 5MB 限制
- 确认文件格式为图片格式

### 4. 如何切换数据库？

修改 `server/.env` 文件中的 `DB_DIALECT` 配置（`sqlite` 或 `mysql`），配置对应的数据库连接信息，然后执行 `npm run seed` 初始化数据库。

### 5. 移动端如何访问？

在浏览器中访问 `http://localhost:5173/mobile/home`，或使用手机扫描二维码（需确保手机和电脑在同一局域网）。

### 6. 如何重置管理员密码？

直接修改数据库 `sys_user` 表中对应用户的 `password` 字段，密码使用 bcryptjs 加密。或在系统中使用管理员账号修改。

---

## License

Private
