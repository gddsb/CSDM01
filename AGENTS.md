# AGENTS.md — 奶粉罐 MES AI 开发规则入口

## 一句话定位
东莞大满包装长沙分公司的奶粉罐 MES，PC 管理端 + 移动端现场执行双端协同。
前端 React 18 / TS 5 / Vite 5 / AntD 5 + AntD Mobile 5 / ECharts 6
后端 Node / Express 4 / TS / Sequelize 6 / JWT
DB MySQL 8.0（沙箱已装 milk_can_mes）；包管理器 **pnpm**（前后端独立）

## 📋 执行流程红线（最优先，每次任务必遵循）

| # | 流程 | 说明 |
|---|------|------|
| E1 | **用户输入需求/修改要求/询问方案 → 先出方案，等用户明确确认后才能改代码** | 不默默执行。方案要包含：改哪些文件、核心逻辑、可能的坑、预期结果。用户说"可以"/"执行"/"好的"等明确同意后再动手。 |
| E2 | **改完代码 → 自动 deploy H5（deploy.sh）** | 正常流程，用户不用单独提。 |
| E3 | **APK 编译（build-apk.sh）只在用户明确要求时才执行** | 用户说"编译 APK"/"构建 APK"/"打包 APP"才跑。不要在 deploy.sh 后自动触发 APK 编译（~4 分钟耗时）。 |

## 🚨 违规告知（次优先）

**AI 在开发过程中遇到以下情况，必须立即告知用户，不得默默执行：**

| 编号 | 场景 | 告知方式 |
|------|------|---------|
| V1 | 用户要求执行的操作违反规则 | 明确说明违反了哪一条规则、风险、建议替代方案 |
| V2 | 需要修改规则本身 | 说明现有规则是什么、用户想改成什么、为什么要改、改完的影响 |
| V3 | 发现现有规则有矛盾或覆盖不到 | 指出矛盾点，提出建议补充 |
| V4 | 执行 build/deploy 等有破坏性的操作 | 明确列出将执行的动作、影响范围、是否可撤销 |
| V5 | 涉及生产环境数据变更 | 列出变更 SQL/接口、影响的表/行、回滚方案 |
| V6 | 需要超时 / 超预算运行命令 | 预估耗时、资源消耗、原因 |
| V7 | 发现已有代码违反规则 | 指出具体文件和行、建议修复方式（但不自动改） |

**告知模板**：
```
⚠️ 这一步违反了规则 [规则文件.md:章节名]
当前规则：...
你要求的：...
风险：...
建议：...
是否继续？
```

## 什么时候读哪份

| 我要做什么 | 读哪份 |
|-----------|--------|
| 改完代码要部署到 prod | **先读 docs/build-deploy/prod-ssh.md**（沙箱→prod SSH 必须走 HTTP CONNECT 代理） |
| 任何任务开始（默认必读） | docs/index.md + docs/build-deploy.md |
| 改 React/TSX/PC 页面 | docs/frontend/index.md |
| 改 ant-mobile 移动端 | docs/frontend/index.md + docs/frontend/mobile.md |
| 改 ECharts 大屏 | docs/frontend/index.md + docs/frontend/bigscreen.md |
| 改 Node/Express/Sequelize | docs/backend/index.md + docs/backend/api-contract.md |
| 写鉴权/限流/上传 | docs/backend/security.md |
| 加字段/改表结构/写 SQL | docs/database/index.md |
| 碰任何时间字段/时区 | docs/database/timezone.md |
| 遇到奇怪问题排查 Bug | docs/common-pitfalls.md |

## 快速索引
```
docs/
├── index.md                ← 本文件规则扩展（目录结构、权限模型等）
├── build-deploy.md         ← 默认必读：构建/运行/部署/沙箱
│   └── prod-ssh.md         ← 部署前必读：沙箱→prod SSH 必须走 HTTP CONNECT 代理
├── common-pitfalls.md      ← 默认必读：已踩坑清单
├── frontend/
│   ├── index.md            ← 默认必读：前端开发规则
│   ├── mobile.md
│   └── bigscreen.md
├── backend/
│   ├── index.md            ← 默认必读：后端开发规则
│   ├── api-contract.md
│   └── security.md
└── database/
    ├── index.md
    └── timezone.md
```

## 默认登录账号（无需记忆）
admin / sysadmin / planner / qm / qc / pm / op / maint / viewer · 密码全部 123456
