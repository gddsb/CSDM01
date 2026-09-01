# 奶粉罐生产管理系统 (Milk Can MES)

> 前端 v1.0.1.730 · 后端 v1.0.1.736
>
> 东莞市大满包装实业有限公司长沙分公司 — 奶粉罐生产制造执行系统

基于 React + TypeScript + Ant Design + Vite + Node.js + Express + Sequelize 构建的现代化制造执行系统，覆盖生产、质量、设备、大屏、报表、移动端等核心业务模块。

---

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端框架 | React | 18.3 |
| 语言 | TypeScript | 5.6 |
| UI | Ant Design 5.21 / Ant Design Mobile 5.42 | — |
| 构建 | Vite 5.4 + vite-plugin-pwa | — |
| 图表 | ECharts 6.1 | — |
| 后端运行时 | Node.js | 20+ |
| 后端框架 | Express 4.21 + tsx | — |
| ORM | Sequelize 6.37 | — |
| 数据库 | SQLite（开发）/ MySQL 8.0+（生产） | — |
| 图片处理 | sharp 0.35 | — |
| 认证 | JWT (jsonwebtoken) | — |
| 包管理器 | **统一使用 pnpm**（前后端） | — |

---

## 项目结构

```
milk-can-mes/
├── src/                          # 前端 React 源码
│   ├── pages/
│   │   ├── basic/                # 基础数据（物料/产线/工序/缺陷）
│   │   ├── production/           # 生产管理（订单/报工）
│   │   ├── quality/              # 质量管理（检验/投诉/仪器）
│   │   ├── device/               # 设备管理（档案/保养/维修/OEE）
│   │   ├── report/               # 报表中心
│   │   ├── bigscreen/            # 数据大屏
│   │   ├── system/               # 系统管理（用户/角色/字典/日志）
│   │   └── auto/                 # 自动任务
│   ├── mobile/                   # 移动端路由
│   ├── layouts/ components/ contexts/ hooks/ utils/ styles/
│   ├── main.tsx                  # 路由与入口
│   └── vite-env.d.ts
├── server/                       # 后端 Express + Sequelize
│   ├── src/
│   │   ├── app.ts                # Express 入口
│   │   ├── controllers/          # 48 个业务控制器
│   │   ├── routes/               # 路由（auth/basic/production/system/auto）
│   │   ├── models/               # 80+ Sequelize 模型
│   │   ├── middleware/           # 鉴权/日志/错误处理
│   │   ├── migrations/           # 数据库迁移
│   │   ├── seed-data/            # 种子数据
│   │   ├── services/ utils/ validators/ types/
│   │   └── init-db.ts / migrate.ts / seed.ts
│   ├── data/                     # SQLite 数据库文件（本地开发）
│   ├── uploads/                  # 上传文件（运行时目录）
│   ├── package.json / pnpm-lock.yaml
│   └── tsconfig.json
├── public/                       # Vite 静态资源
├── scripts/deploy.sh             # 生产服务器一键部署
├── vite.config.ts
├── capacitor.config.json         # Capacitor 移动端配置
├── package.json / pnpm-lock.yaml
└── README.md
```

---

## 快速开始

### 环境要求

- Node.js 20+
- pnpm 9+（`npm i -g pnpm`）
- MySQL 8.0+（生产环境必填）或 SQLite（零配置开发）

### 安装与运行

```bash
# 1. 克隆仓库
git clone <repo-url> milk-can-mes && cd milk-can-mes

# 2. 前端依赖（根目录）
pnpm install

# 3. 后端依赖
cd server && pnpm install && cd ..

# 4. 初始化数据库（首次运行）
cd server && pnpm run seed && cd ..

# 5. 启动后端（端口 3001）
cd server && pnpm run dev &

# 6. 启动前端（端口 5173，自动代理 /api 和 /uploads 到 3001）
cd .. && pnpm run dev
```

打开 http://localhost:5173 即可访问。

### 构建与生产运行

```bash
# 前端构建（产物 → dist/）
pnpm run build

# 后端编译（TypeScript → server/dist/）
cd server && pnpm run build && cd ..

# 后端生产运行
cd server && pnpm run prod   # 即 node dist/app.js
```

### 数据库切换为 MySQL

在 `server/.env` 中配置：

```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=milk_can_mes
DB_DIALECT=mysql
```

首次启动会自动执行数据库迁移 + 种子数据。

---

## 功能模块

| 模块 | 功能 |
|------|------|
| **基础数据** | 物料、产线、工序、缺陷、客户、供应商、编号规则 |
| **生产管理** | 生产订单、工序报工、人工记录 |
| **质量管理** | 来料检、过程检、成品检、微生物检、环境检、不良记录、投诉、仪器 |
| **设备管理** | 设备档案、保养（点检+维护+大修）、故障维修、OEE、备件、校准、文档 |
| **数据大屏** | 生产看板、质量看板、管理驾驶舱、环境看板、展示大屏 |
| **报表中心** | 生产报表、质量报表、异常报表、日报、月报、效率报表 |
| **系统管理** | 用户、角色、权限、菜单、数据字典、操作日志、系统日志、系统配置 |
| **自动任务** | 任务设置、任务日志、定时任务（PM2 或 Cron） |
| **移动端** | 生产报工、不良记录、物料记录、保养执行、图片上传 |

---

## 图片上传规格

保养/故障/报告图片上传统一后端处理（sharp 库）：

| 项目 | 规则 |
|------|------|
| 支持格式 | JPG / JPEG / PNG / WebP |
| 单张大小 | ≤ 5MB（multer limit） |
| 尺寸压缩 | 长边自动压缩至 ≤ 1600px |
| 输出格式 | 统一转换为 JPEG（quality 82） |
| 水印 | 右下角时间+设备编号+触发频率 |
| 去重 | SHA256 哈希，同记录内不允许重复上传 |
| 存储路径 | `/uploads/device/maintenance/YYYY-MM/BMIMG_{日期}_{记录ID}_{序号}_{哈希}.jpg` |
| Nginx 映射 | `location ^~ /uploads/` → `/opt/milk-can-mes/server/uploads/` |

⚠️ **不支持** HEIC/HEIF、BMP、TIFF、GIF 动画。iPhone 用户请将相机格式设为"兼容性最佳"。

---

## 部署指南

### 生产服务器配置

| 项 | 值 |
|----|----|
| 服务器 IP | 43.138.218.55 |
| SSH 用户 | ubuntu |
| 部署路径 | `/opt/milk-can-mes` |
| 后端进程 | PM2，名称 `milk-can-mes-server` |
| 启动命令 | `cd server && npm start`（实际用 tsx src/app.ts） |
| 后端端口 | 3001（Nginx 反代 `/api` 和 `/uploads`） |
| 前端 | Nginx 直接服务 `dist/` |
| 数据库 | MySQL `milk_can_mes`（root: 123456） |

### 常用运维命令

```bash
# 拉取最新代码并更新
cd /opt/milk-can-mes
git pull --ff-only origin main
cd server && pnpm install && cd ..
pnpm run build
sudo chown -R ubuntu:ubuntu dist
pm2 restart milk-can-mes-server

# PM2 常用
pm2 status                # 查看状态
pm2 logs milk-can-mes-server --lines 50   # 查看日志
pm2 flush milk-can-mes-server            # 清空日志
pm2 save                  # 保存进程列表（开机自启）

# Nginx
sudo systemctl status nginx
sudo nginx -t && sudo systemctl reload nginx
```

### Nginx 关键配置（节选）

```nginx
# 前端静态资源
server {
    listen 80;
    root /opt/milk-can-mes/dist;
    index index.html;

    # API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
    }

    # 上传文件（^~ 确保优先匹配，不受正则 location 干扰）
    location ^~ /uploads/ {
        alias /opt/milk-can-mes/server/uploads/;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | 123456 | 超级管理员 |

---

## 编码规范

- **前端**：ESLint + Prettier + Ant Design 组件库；按业务模块懒加载（`src/main.tsx`）
- **后端**：按 `controllers / routes / models / middleware / validators / services / utils` 分层；Sequelize 模型统一放在 `server/src/models/`；路由注册在 `server/src/routes/index.ts`
- **API 约定**：统一响应 `{ success, code, message, data }`；错误码在 `server/src/utils/error.ts` 集中定义
- **包管理器**：前后端统一使用 **pnpm**，禁止使用 npm/yarn（已在 `.gitignore` 中屏蔽锁文件）

---

## 脚本工具

| 路径 | 说明 |
|------|------|
| `scripts/deploy.sh` | 生产服务器一键部署（通过代理 SCP 传变更文件） |

---

## 目录约定（.gitignore 关键条目）

```
node_modules/              # 依赖
dist/                      # 前端构建产物
server/dist/               # 后端编译产物
server/uploads/            # 运行时上传文件
server/data/*.sqlite       # 本地 SQLite 数据库
.env / server/.env         # 环境变量
*.log / server/logs/       # 日志
*.tsbuildinfo              # TypeScript 构建缓存
package-lock.json          # 统一使用 pnpm
```
