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
- [业务逻辑详解](#业务逻辑详解)
- [项目结构](#项目结构)
- [数据库设计](#数据库设计)
- [快速开始](#快速开始)
- [生产部署指南](#生产部署指南)
- [默认登录账号](#默认登录账号)
- [主题系统](#主题系统)
- [移动端](#移动端)
- [API 接口概览](#api-接口概览)
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

### 业务架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        决策层（大屏/报表）                        │
│   生产实时看板 │ 质量分析看板 │ 管理驾驶舱 │ 生产/质量/异常报表    │
├─────────────────────────────────────────────────────────────────┤
│                        业务层（PC端）                             │
│   系统管理 │ 基础数据 │ 生产管理 │ 质量管理 │ 设备管理            │
├─────────────────────────────────────────────────────────────────┤
│                        执行层（移动端）                           │
│   生产订单 │ 生产报工 │ 不良记录 │ 物料记录 │ 图片上传            │
├─────────────────────────────────────────────────────────────────┤
│                        数据层                                    │
│   SQLite(开发) / MySQL(生产) + 文件存储(uploads)                │
└─────────────────────────────────────────────────────────────────┘
```

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

---

## 业务逻辑详解

### 1. 生产订单业务流程

#### 1.1 状态机

```
开立 ──下发──▶ 下发（开工） ──完工──▶ 完工
  │                                    │
  └──────────────删除──────────────┘
```

| 状态值 | 显示名称 | 编辑 | 下发 | 开工 | 删除 | 完工 | 查看 |
|--------|---------|------|------|------|------|------|------|
| 0 | 开立 | ✓ | ✓ | ✗ | ✓ | ✗ | ✓ |
| 1 | 下发 | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ |
| 2 | 开工 | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| 3 | 完工 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| 4 | 关闭 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

#### 1.2 订单号规则

- **格式**：`MO-16` + `YYMMDD` + 3位流水号
- **示例**：`MO-16260704001`
- **日重置**：每日流水号从 001 开始重新计数

#### 1.3 新增订单业务规则

1. **料品筛选**：料品下拉**仅显示 C 开头的成品罐料品**且状态为生效
2. **自动带入**：选中料品后自动带入料号、料品名称、规格、菲林编号、版本号
3. **数量校验**：计划数量只能为正整数
4. **日期校验**：计划开始日期不得早于今天，计划完成日期不得早于计划开始日期
5. **编辑限制**：仅"开立"状态可编辑，可修改数量、计划开始日期、计划完成日期

#### 1.4 下发逻辑

订单下发时自动创建第一张报工单：

1. 校验订单状态为"开立"
2. 更新订单状态为"下发"
3. 生成报工单号（`WO` + `YYMMDD` + 3位流水号）
4. 从产线工序表继承工序到报工工序子表
5. 创建报工单记录，状态为"开工"

#### 1.5 订单详情

订单详情页展示以下关联数据：
- 基本信息（订单号、料品、数量、状态等）
- 关联报工单列表
- 人员记录汇总
- 异常工时记录汇总

---

### 2. 生产报工业务流程

#### 2.1 业务模型

```
生产订单（1） ──── （N）生产报工单
                      │
                      ├── 报工工序（N）
                      ├── 不良记录（N）
                      ├── 物料记录（N）
                      ├── 异常工时（N）
                      ├── 人员记录（N）
                      └── 报工图片（N）
```

- **生产报工单**是**生产订单**的下级独立单据
- 一个生产订单可对应多张生产报工单（适用于多日生产场景）
- 子表格数据（不良记录、物料记录、异常工时、人员记录）均挂在具体报工单下
- 子表格的只读/可编辑状态与所属报工单保持一致

#### 2.2 报工单状态机

| 状态值 | 显示名称 | 说明 |
|--------|---------|------|
| 0 | 开工 | 报工进行中，子表格可编辑 |
| 1 | 完工 | 报工已完成，子表格只读，可新增下一张报工单 |

#### 2.3 报工工序继承机制

创建报工单时，自动从产线工序表（`bas_line_process`）继承工序列表：

1. 根据产线 ID 查询该产线的所有有效工序（状态=启用）
2. 按工序顺序（`sort_order`）升序排序
3. 将工序信息复制到报工工序表（`production_report_process`）
4. 继承字段：工序ID、工序编码、工序名称、是否引入物料、排序号
5. 唯一约束：同一报工单内同一工序不重复（`report_order_id + process_id` 联合唯一）

#### 2.4 不良记录业务逻辑

##### 不良分类三级体系

```
检验类型（2种）
  ├── 来料检验类型
  │     ├── 外观不良 (COS)
  │     ├── 尺寸不良 (DIM)
  │     ├── 理化不良 (PHC)
  │     ├── 材质不良 (MAT)
  │     ├── 标识不良 (LBL)
  │     ├── 污染异物 (CON)
  │     └── 运输不良 (TRD)
  └── 制程检验类型
        ├── 制程不良 (PNC)
        ├── 来料不良 (INC)
        └── 检验报废 (SCR)
```

##### 不良编码命名规则

- **格式**：`检验类型缩写-不良类型缩写-两位流水码`
- **示例**：`IC-COS-01`（来料检验类型-外观不良-第1条）
- 完整编码前缀表参见 [编码规则](#编码规则) 章节

##### 不良记录筛选规则

**生产不良记录页签**：
- `category_name = '制程检验类型'`
- `defect_type ≠ '检验报废'`
- `status = '启用'`
- 已选用的项目自动过滤（同一报工同一工序不重复选）
- **按工序过滤**：关联工序为空的不良项目在所有工序可用，有关联工序的只在关联工序中可用

**检验报废记录页签**：
- `category_name = '制程检验类型'`
- `defect_type = '检验报废'`
- `status = '启用'`
- 已选用的项目自动过滤
- **按工序过滤**（同上）

##### 不良编码显示规则

- 下拉列表显示：`不良编码 + 不良分类 + 不良项目`
- 选中后单元格显示：仅显示`不良编码`
- 列宽：10字符宽度，下拉菜单根据内容自动宽度

##### 不良图片

- 不良项目可关联多张不良图片
- 图片上传至 `uploads/defects/` 目录
- 图片信息存储在 `bas_defect_image` 表

#### 2.5 物料记录业务逻辑

- 物料记录关联料品档案（`bas_material_id` 字符串类型，关联 `bas_material.material_id` UUID）
- 字段：物料类型、料号、批次号、包号、数量、标签图片
- 料号下拉菜单弹出显示：`料号 + 料品名称`，选中后单元格只显示料号
- 物料记录支持引入物料标识（工序的 `has_material` 字段控制）

#### 2.6 异常工时业务逻辑

- 记录设备停机/异常情况的工时损失
- 字段：异常类型、设备、停机类型、确认人、开始时间、恢复时间、持续时长(小时)、异常描述、异常图片
- 持续时长自动计算：`(end_time - start_time) / 3600`
- 异常图片以 JSON 数组形式存储

#### 2.7 人员记录业务逻辑

- 记录报工期间的人力投入情况
- 人员分类：熟手、普工、劳务、其他
- 字段：记录日期、班次、开始时间、结束时间、工时、各类型人数、总人数、人时
- 总人数 = 熟手 + 普工 + 劳务 + 其他
- 人时 = 总人数 × 工时

#### 2.8 报工图片上传

##### 图片分类

| 分类标识 | 分类名称 | 说明 |
|---------|---------|------|
| `defect` | 不良图片 | 关联不良记录的图片 |
| `label` | 标签图片 | 物料标签类图片 |
| `exception` | 异常图片 | 异常工时相关图片 |

##### 命名规则

- **格式**：`报工单号` + `-` + `YYYYMMDD` + `-` + 三位流水码
- **示例**：`WO260719001-20260721-001`
- 流水码按当日该报工单已上传图片数量递增

##### 存储位置

- 文件目录：`uploads/reports/`（服务器启动时自动创建）
- 数据库表：`production_report_image`

##### 去重机制

使用 MD5 哈希值判断图片是否重复，上传时双重校验：

1. **本次上传内去重**：多张上传图片之间互相比对 MD5
2. **历史记录去重**：与该报工单已上传的图片 MD5 对比
3. 检测到重复时直接报错提示，不上传重复文件

##### 上传接口流程

```
前端 (FormData, files字段)
    │
    ▼
后端 Multer 中间件 → 临时目录 uploads/tmp/
    │
    ▼
计算文件 MD5 → 去重校验
    │
    ▼
生成文件名（报工单号+日期+流水码）
    │
    ▼
移动到 uploads/reports/ 目录
    │
    ▼
写入 production_report_image 表
    │
    ▼
返回成功响应（图片列表）
```

---

### 3. 基础数据业务逻辑

#### 3.1 料品档案

- **主键**：UUID 类型（`material_id`）
- **分类体系**：支持料品分类（`category_name`）
- **客户关联**：料品关联客户（`customer_id` → `bas_customer.customer_id`）
- **尺寸重量**：冲切直径、料厚、料宽、料高、废品重量、单件重量、单件体积
- **印刷信息**：菲林编号、版本号、印刷工艺、分色
- **状态管理**：启用/停用，支持生效日期和失效日期
- **料号唯一**：`material_code` 字段唯一约束

#### 3.2 客户档案

- **客户分类**：奶粉罐/废品/蛋白粉/其它粉罐/内部客户等
- **信用等级**：A/B/C/D
- **税务银行**：纳税人识别号、开户银行、银行账号
- **生效管理**：生效日期、失效日期、状态（启用/停用）
- **客户编号**：`customer_code` 唯一，如 C001、C002

#### 3.3 产线档案

- **产线-工序关联**：多对多关系，通过 `bas_line_process` 中间表
- **产线-设备关联**：多对多关系，通过 `bas_line_device` 中间表
- **状态管理**：运行中/维护中/停用
- **排序管理**：`sort_order` 控制显示顺序
- **产线负责人**：`line_leader` 字段

#### 3.4 工序档案

- **工序编码**：`process_code` 唯一
- **引入物料**：`has_material` 标记该工序是否需要记录物料
- **状态管理**：启用/停用
- **排序管理**：`sort_order` 控制工序顺序

#### 3.5 不良项目管理

- **检验类型联动**：选择检验类型后，不良类型下拉选项动态变化
- **关联工序**：不良项目可关联多个工序，影响报工页面下拉可选范围
- **可用单位**：支持多个计量单位，逗号分隔存储
- **状态管理**：启用/停用
- **树形结构**：支持 `parent_id` 上级分类（0=顶级）
- **新增时状态默认值**：启用
- **不良编码自动生成**：保存时根据检验类型和不良类型自动生成下一个编码

#### 3.6 编码规则管理

支持自定义编号规则，配置项包括：
- 编号名称
- 编号前缀
- 日期格式（如 YYMMDD）
- 分隔符
- 序号位数
- 重置周期（日/月/年/不重置）

---

### 4. 系统管理业务逻辑

#### 4.1 用户认证

- **认证方式**：JWT Token
- **密码加密**：bcryptjs 哈希
- **Token 有效期**：7 天
- **登录流程**：用户名密码验证 → 生成 Token → 返回用户信息和 Token
- **请求验证**：所有 `/api/` 接口（除 `/api/auth/login`）需携带 Authorization Header

#### 4.2 权限体系

```
用户（N） ─── （1）角色（N） ─── （N）权限/菜单
```

- 用户归属一个角色
- 角色关联多个权限（菜单）
- 权限支持树形结构（多级菜单）
- 前端根据用户角色权限动态渲染菜单

#### 4.3 操作日志

- 自动记录用户的增删改操作
- 记录字段：操作模块、操作类型、操作人、操作时间、IP地址、请求参数
- 支持按模块、用户、时间范围筛选查询

#### 4.4 数据字典

- 自动读取数据库中所有数据表结构
- 展示表名、字段名、字段类型、是否主键、是否允许空、默认值、字段注释
- 方便开发人员快速了解数据库结构

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
│   │   │   ├── ProcessException.ts   # 异常工时模型
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

## 数据库设计

### 数据表分类

| 分类 | 表名前缀 | 示例 | 说明 |
|------|---------|------|------|
| 系统类 | `sys_` | `sys_user`, `sys_role` | 系统管理相关表 |
| 基础类 | `bas_` / `master_` | `bas_material`, `master_process` | 基础档案表 |
| 生产类 | `production_` / `prod_` | `production_order`, `prod_report_order` | 生产业务表 |
| 字典类 | `bas_dict_` | `bas_dict_type`, `bas_dict_data` | 数据字典表 |

### 核心数据表详细结构

#### 1. 生产订单表（production_order）

| 字段名 | 类型 | 主键 | 必填 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| order_id | INTEGER | ✓ | ✓ | 自增 | 生产订单ID |
| order_no | STRING(50) | ✗ | ✓ | - | 订单号（唯一） |
| material_id | UUID | ✗ | ✗ | - | 料品ID |
| material_code | STRING(50) | ✗ | ✗ | - | 料号（冗余） |
| material_name | STRING(100) | ✗ | ✗ | - | 料品名称（冗余） |
| specification | STRING(200) | ✗ | ✗ | - | 规格（冗余） |
| film_version | STRING(50) | ✗ | ✗ | - | 菲林编号 |
| version_no | STRING(50) | ✗ | ✗ | - | 版本号 |
| planned_qty | DECIMAL(12,2) | ✗ | ✗ | 0 | 计划数量 |
| finished_qty | DECIMAL(12,2) | ✗ | ✗ | 0 | 完工数量 |
| plan_start_time | DATE | ✗ | ✗ | - | 计划开始时间 |
| plan_end_time | DATE | ✗ | ✗ | - | 计划完成时间 |
| status | TINYINT | ✗ | ✗ | 0 | 状态：0=开立,1=下发,2=开工,3=完工,4=关闭 |
| release_time | DATE | ✗ | ✗ | - | 下发时间 |
| close_time | DATE | ✗ | ✗ | - | 关闭时间 |
| created_by | STRING(50) | ✗ | ✗ | - | 创建人 |
| created_at | DATE | ✗ | ✗ | - | 创建时间 |
| updated_at | DATE | ✗ | ✗ | - | 更新时间 |

#### 2. 生产报工单表（production_report_order）

| 字段名 | 类型 | 主键 | 必填 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| report_order_id | INTEGER | ✓ | ✓ | 自增 | 报工单ID |
| order_id | INTEGER | ✗ | ✓ | - | 关联生产订单ID |
| order_no | STRING(50) | ✗ | ✗ | - | 订单号（冗余） |
| report_no | STRING(50) | ✗ | ✓ | - | 报工单号（唯一） |
| line_id | INTEGER | ✗ | ✗ | - | 生产产线ID |
| line_name | STRING(100) | ✗ | ✗ | - | 产线名称（冗余） |
| material_id | UUID | ✗ | ✗ | - | 料品ID |
| material_code | STRING(50) | ✗ | ✗ | - | 料号（冗余） |
| material_name | STRING(200) | ✗ | ✗ | - | 料品名称（冗余） |
| specification | STRING(200) | ✗ | ✗ | - | 规格（冗余） |
| report_qty | DECIMAL(12,2) | ✗ | ✗ | 0 | 报工数量 |
| report_time | DATE | ✗ | ✗ | - | 报工时间 |
| finish_time | DATE | ✗ | ✗ | - | 完工时间 |
| status | TINYINT | ✗ | ✗ | 0 | 状态：0=开工,1=完工 |
| report_user_id | INTEGER | ✗ | ✗ | - | 报工人员ID |
| report_user_name | STRING(50) | ✗ | ✗ | - | 报工人员姓名（冗余） |
| finish_user_id | INTEGER | ✗ | ✗ | - | 完工人员ID |
| finish_user_name | STRING(50) | ✗ | ✗ | - | 完工人员姓名（冗余） |
| remarks | STRING(500) | ✗ | ✗ | - | 备注 |
| created_at | DATE | ✗ | ✗ | - | 创建时间 |
| updated_at | DATE | ✗ | ✗ | - | 更新时间 |

#### 3. 报工工序表（production_report_process）

| 字段名 | 类型 | 主键 | 必填 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| id | INTEGER | ✓ | ✓ | 自增 | 主键ID |
| report_order_id | INTEGER | ✗ | ✓ | - | 关联报工单ID |
| process_id | INTEGER | ✗ | ✓ | - | 工序ID |
| process_code | STRING(30) | ✗ | ✓ | - | 工序编码 |
| process_name | STRING(50) | ✗ | ✓ | - | 工序名称 |
| has_material | TINYINT | ✗ | ✗ | 0 | 是否引入物料：0=否,1=是 |
| sort_order | INTEGER | ✗ | ✗ | 0 | 工序顺序 |
| created_at | DATE | ✗ | ✗ | - | 创建时间 |
| updated_at | DATE | ✗ | ✗ | - | 更新时间 |

> **唯一约束**：`report_order_id + process_id` 联合唯一

#### 4. 不良项目表（master_defect_type）

| 字段名 | 类型 | 主键 | 必填 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| defect_id | INTEGER | ✓ | ✓ | 自增 | 不良项目ID |
| defect_code | STRING(50) | ✗ | ✓ | - | 不良编码（唯一） |
| defect_name | STRING(100) | ✗ | ✓ | - | 不良项目名称 |
| defect_type | STRING(50) | ✗ | ✗ | - | 不良类型 |
| category_name | STRING(50) | ✗ | ✗ | - | 分类名称（检验类型） |
| parent_id | INTEGER | ✗ | ✗ | 0 | 上级分类ID（0=顶级） |
| defect_unit | STRING(20) | ✗ | ✗ | - | 默认单位 |
| available_units | STRING(255) | ✗ | ✗ | - | 可用单位（逗号分隔） |
| display | BOOLEAN | ✗ | ✗ | true | 是否显示 |
| sort_order | INTEGER | ✗ | ✗ | 0 | 排序号 |
| status | TINYINT | ✗ | ✗ | 1 | 状态：1=启用,0=停用 |
| related_processes | STRING(255) | ✗ | ✗ | - | 关联工序ID（逗号分隔） |
| category_desc | STRING(500) | ✗ | ✗ | - | 分类描述 |
| created_at | DATE | ✗ | ✗ | - | 创建时间 |
| updated_at | DATE | ✗ | ✗ | - | 更新时间 |

#### 5. 不良记录表（production_process_defect）

| 字段名 | 类型 | 主键 | 必填 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| defect_id | INTEGER | ✓ | ✓ | 自增 | 不良记录ID |
| report_order_id | INTEGER | ✗ | ✗ | - | 报工单ID |
| process_id | INTEGER | ✗ | ✗ | - | 工序ID |
| defect_type_id | INTEGER | ✗ | ✗ | - | 不良分类ID（关联master_defect_type.defect_id） |
| quantity | DECIMAL(12,2) | ✗ | ✗ | 0 | 数量 |
| unit | STRING(20) | ✗ | ✗ | - | 单位 |
| defect_images | TEXT | ✗ | ✗ | - | 不良图片（JSON数组） |
| record_time | DATE | ✗ | ✗ | - | 记录时间（=createdAt） |

#### 6. 物料记录表（production_process_material）

| 字段名 | 类型 | 主键 | 必填 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| material_id | INTEGER | ✓ | ✓ | 自增 | 物料记录ID |
| report_order_id | INTEGER | ✗ | ✗ | - | 报工单ID |
| process_id | INTEGER | ✗ | ✗ | - | 工序ID |
| material_type | STRING(100) | ✗ | ✗ | - | 物料类型 |
| bas_material_id | STRING | ✗ | ✗ | - | 关联基础料品表ID |
| material_batch | STRING(100) | ✗ | ✗ | - | 物料批次 |
| package_no | STRING(100) | ✗ | ✗ | - | 包号 |
| quantity | DECIMAL(12,2) | ✗ | ✗ | 0 | 数量 |
| label_images | TEXT | ✗ | ✗ | - | 标签图片（JSON） |
| record_time | DATE | ✗ | ✗ | - | 记录时间 |

#### 7. 异常工时表（production_process_exception）

| 字段名 | 类型 | 主键 | 必填 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| exception_id | INTEGER | ✓ | ✓ | 自增 | 异常记录ID |
| report_order_id | INTEGER | ✗ | ✗ | - | 报工单ID |
| exception_type | STRING(50) | ✗ | ✗ | - | 异常类型 |
| device_id | INTEGER | ✗ | ✗ | - | 设备ID |
| device_code | STRING(50) | ✗ | ✗ | - | 设备编码（冗余） |
| device_name | STRING(100) | ✗ | ✗ | - | 设备名称（冗余） |
| stop_type | STRING(100) | ✗ | ✗ | - | 停机类型 |
| confirm_user | STRING(50) | ✗ | ✗ | - | 确认人 |
| confirm_user_name | STRING(50) | ✗ | ✗ | - | 确认人姓名（冗余） |
| start_time | DATE | ✗ | ✗ | - | 开始时间 |
| end_time | DATE | ✗ | ✗ | - | 恢复时间 |
| duration | DECIMAL(10,2) | ✗ | ✗ | 0 | 持续时长(小时) |
| description | STRING(500) | ✗ | ✗ | - | 异常描述 |
| exception_images | TEXT | ✗ | ✗ | - | 异常图片（JSON数组） |
| record_user | STRING(50) | ✗ | ✗ | - | 记录人 |
| record_user_name | STRING(50) | ✗ | ✗ | - | 记录人姓名（冗余） |
| created_at | DATE | ✗ | ✗ | - | 创建时间 |

#### 8. 人员记录表（production_manpower_record）

| 字段名 | 类型 | 主键 | 必填 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| record_id | INTEGER | ✓ | ✓ | 自增 | 记录ID |
| report_order_id | INTEGER | ✗ | ✗ | - | 报工单ID |
| record_date | DATEONLY | ✗ | ✗ | - | 记录日期 |
| shift | STRING(20) | ✗ | ✗ | - | 班次 |
| start_time | DATE | ✗ | ✗ | - | 开始时间 |
| end_time | DATE | ✗ | ✗ | - | 结束时间 |
| hours | DECIMAL(10,2) | ✗ | ✗ | 0 | 工时 |
| skilled_count | INTEGER | ✗ | ✗ | 0 | 熟手人数 |
| general_count | INTEGER | ✗ | ✗ | 0 | 普工人数 |
| labor_count | INTEGER | ✗ | ✗ | 0 | 劳务人数 |
| other_count | INTEGER | ✗ | ✗ | 0 | 其他人数 |
| total_people | INTEGER | ✗ | ✗ | 0 | 总人数 |
| man_hours | DECIMAL(10,2) | ✗ | ✗ | 0 | 人时 |
| remarks | STRING(500) | ✗ | ✗ | - | 备注 |
| record_user | STRING(50) | ✗ | ✗ | - | 记录人 |
| record_user_name | STRING(50) | ✗ | ✗ | - | 记录人姓名（冗余） |
| created_at | DATE | ✗ | ✗ | - | 创建时间 |

#### 9. 报工图片表（production_report_image）

| 字段名 | 类型 | 主键 | 必填 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| image_id | INTEGER | ✓ | ✓ | 自增 | 图片ID |
| report_order_id | INTEGER | ✗ | ✓ | - | 关联报工单ID |
| category | STRING(30) | ✗ | ✓ | - | 图片分类：defect/label/exception |
| image_url | STRING(500) | ✗ | ✓ | - | 图片URL |
| file_hash | STRING(64) | ✗ | ✗ | - | 文件哈希（MD5，用于去重） |
| created_at | DATE | ✗ | ✗ | - | 创建时间 |

#### 10. 料品档案表（bas_material）

| 字段名 | 类型 | 主键 | 必填 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| material_id | UUID | ✓ | ✓ | UUIDV4 | 料品ID |
| category_name | STRING(50) | ✗ | ✓ | - | 分类名称 |
| material_code | STRING(50) | ✗ | ✓ | - | 料号（唯一） |
| material_name | STRING(200) | ✗ | ✓ | - | 料品名称 |
| specification | STRING(200) | ✗ | ✗ | - | 规格 |
| unit_name | STRING(50) | ✗ | ✓ | - | 单位名称 |
| film_no | STRING(50) | ✗ | ✗ | - | 菲林编号 |
| version_no | STRING(50) | ✗ | ✗ | - | 版本号 |
| cutting_size | STRING(50) | ✗ | ✗ | - | 冲切尺寸 |
| printing_process | STRING(50) | ✗ | ✗ | - | 印刷工艺 |
| color_separation | STRING(50) | ✗ | ✗ | - | 分色 |
| blanking_diameter | DECIMAL(11,2) | ✗ | ✗ | - | 冲切直径 |
| material_thickness | DECIMAL(11,2) | ✗ | ✗ | - | 料厚 |
| material_width | DECIMAL(11,2) | ✗ | ✗ | - | 料宽 |
| material_height | DECIMAL(11,2) | ✗ | ✗ | - | 料高 |
| scrap_weight | DECIMAL(11,2) | ✗ | ✗ | - | 废品重量 |
| unit_weight | DECIMAL(11,2) | ✗ | ✗ | - | 单件重量 |
| unit_volume | DECIMAL(11,2) | ✗ | ✗ | - | 单件体积 |
| weight_unit | STRING(20) | ✗ | ✗ | - | 重量单位 |
| volume_unit | STRING(20) | ✗ | ✗ | - | 体积单位 |
| inventory_category | STRING(20) | ✗ | ✗ | - | 库存分类 |
| unit_code | STRING(20) | ✗ | ✗ | - | 单位编码 |
| customer_id | INTEGER | ✗ | ✗ | - | 关联客户ID |
| is_active | BOOLEAN | ✗ | ✓ | true | 是否启用 |
| effective_date | DATE | ✗ | ✓ | - | 生效日期 |
| expiry_date | DATE | ✗ | ✓ | - | 失效日期 |
| created_at | DATE | ✗ | ✗ | - | 创建时间 |
| updated_at | DATE | ✗ | ✗ | - | 更新时间 |

#### 11. 用户表（sys_user）

| 字段名 | 类型 | 主键 | 必填 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| user_id | INTEGER | ✓ | ✓ | 自增 | 用户ID |
| username | STRING(50) | ✗ | ✓ | - | 用户名（唯一） |
| password | STRING(100) | ✗ | ✓ | - | 密码（bcrypt加密） |
| real_name | STRING(50) | ✗ | ✓ | - | 真实姓名 |
| employee_no | STRING(50) | ✗ | ✗ | - | 工号 |
| department | STRING(50) | ✗ | ✗ | - | 部门 |
| position | STRING(50) | ✗ | ✗ | - | 岗位 |
| role_id | INTEGER | ✗ | ✗ | - | 角色ID |
| phone | STRING(20) | ✗ | ✗ | - | 电话 |
| email | STRING(100) | ✗ | ✗ | - | 邮箱 |
| avatar_url | STRING(255) | ✗ | ✗ | - | 头像地址 |
| status | TINYINT | ✗ | ✗ | 1 | 状态：1=启用,0=禁用 |
| last_login_time | DATE | ✗ | ✗ | - | 最后登录时间 |
| last_login_ip | STRING(45) | ✗ | ✗ | - | 最后登录IP |
| pwd_reset_required | TINYINT | ✗ | ✓ | 0 | 首次登录需改密：0=否,1=是 |
| created_by | STRING(50) | ✗ | ✗ | - | 创建人 |
| remarks | STRING(500) | ✗ | ✗ | - | 备注 |
| created_at | DATE | ✗ | ✗ | - | 创建时间 |
| updated_at | DATE | ✗ | ✗ | - | 更新时间 |

### 数据库关联关系

```
sys_user (N) ── (1) sys_role (N) ── (N) sys_permission
                    │
                    └── sys_role_permission (中间表)

bas_customer (1) ── (N) bas_material

master_production_line (N) ── (N) master_process
        │                            │
        └── bas_line_process ────────┘ (中间表)

master_production_line (N) ── (N) master_device
        │                            │
        └── bas_line_device ────────┘ (中间表)

production_order (1) ── (N) production_report_order
                             │
                             ├── (N) production_report_process
                             ├── (N) production_process_defect
                             ├── (N) production_process_material
                             ├── (N) production_process_exception
                             ├── (N) production_manpower_record
                             └── (N) production_report_image

master_defect_type (1) ── (N) bas_defect_image
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

### 移动端报工详情页面结构

报工详情页采用 Tab 页签式布局，包含以下页签：

| 页签 | 说明 |
|------|------|
| 基本信息 | 报工单基本信息展示 |
| 不良记录 | 不良记录列表，新增时筛选制程检验类型且非检验报废的不良项目 |
| 物料记录 | 物料记录列表，料号下拉显示料号+料品名称 |
| 检验报废 | 检验报废记录列表，筛选制程检验类型且不良类型=检验报废 |
| 图片上传 | 报工图片上传，支持多图，MD5去重 |

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

### 统一响应格式

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {},
  "total": 100
}
```

- `code`：状态码，200 表示成功
- `message`：提示信息
- `data`：响应数据
- `total`：总记录数（分页接口返回）

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

### 7. 报工图片上传提示服务器错误？

- 检查 `uploads/reports/` 目录是否存在且有写入权限
- 查看后端日志确认具体错误信息
- 确认报工单号是否正确

### 8. 新增不良项目时不良类型无法选中？

- 请确保先选择"检验类型"，不良类型选项会根据检验类型动态变化
- 状态默认值为"启用"

---

## License

Private
