# 移动端分阶段开发计划

> 项目：大满 MES 移动端 (Capacitor + antd-mobile)
> 仓库：https://github.com/gddsb/CSDM01
> 更新：2026-09-15
> 规范：[capacitor-routing-conventions.md](./capacitor-routing-conventions.md)

---

## 现状盘点（Batch A + Batch B 已完成）

### 基础设施 ✅

| 模块 | 文件 | 说明 |
|------|------|------|
| 目录结构 | `src/mobile/{pages,hooks,components,styles}` | 独立于 PC，antd-mobile 独立 ConfigProvider |
| 布局 | `MobileLayout.tsx` | 底部 TabBar（工作台 / 检验 / 设备 / 我的）+ NavBar |
| 路由 | `routes.tsx` | `/m/*` 独立路由子树 |
| 重定向 | `DeviceEntryRedirect.tsx` + `AppRoutes` | **只看 Capacitor shell，不看 useDevice** |
| 扫码 hook | `useBarcode.ts` | 原生 @capacitor-community/barcode-scanner + prompt fallback |
| 全局样式 | `styles/mobile.css` | 100dvh / safe-area / iOS 输入框 16px |

### 已上线业务页面 ✅

| 页面 | 路由 | 核心流程 | 后端接口 |
|------|------|---------|----------|
| 登录 | `/m/login` | 账号密码 | `POST /auth/login` |
| 工作台 | `/m/dashboard` | 统计卡片 + 快捷入口 | `GET /dashboard/stats` |
| 报工 | `/m/process-reporting` | 3步：选订单→选产线+填数量→提交+完工 | `POST /production/reporting/orders/:id/report` |
| 来料检验 | `/m/incoming-inspection` | 选/扫单→合格/不合格→报审 | `PUT /basic/incoming-inspections/:id` |
| 设备点检 | `/m/device-inspection` | 扫/选设备→待执行记录→点检项→提交 | `PUT /basic/device-records/:id/start|submit` |
| 我的 | `/m/profile` | 用户卡片 + 退出 | — |

### 部署链路 ✅

```
vite build --mode capacitor
→ cap sync android
→ gradle assembleDebug (6.6MB APK)
→ 上传 /download/
→ PC 侧边栏底部 + 用户下拉菜单 → Modal → 直接下载
```

---

## Batch C — 业务补全（紧追 Batch B）

**目标**：把生产现场最常用的 3 个模块补齐，形成"生产-检验-设备"三大业务闭环。

### C1 · 成品检验页面

| 项 | 内容 |
|----|------|
| 路由 | `/m/product-inspection` |
| 流程 | 选/扫订单 → 展示检验项 → 逐项合格/不合格 → 整体判定 |
| 后端 | `ProductInspectionController`（已有） |
| 表单 | antd-mobile Checkbox / Radio / Input 组合 |
| 差异 | 来料是"单条快速判定"，成品是"按检验项逐项填" |
| 预计 | 1 天 |

### C2 · 过程检验页面

| 项 | 内容 |
|----|------|
| 路由 | `/m/process-inspection` |
| 流程 | 选/扫在制品 → 过程参数填写 → 提交 |
| 后端 | `ProcessInspectionController`（已有） |
| 差异 | 按工序维度，可能有多条记录 |
| 预计 | 0.5 天 |

### C3 · 报工历史 + 快速查询

| 项 | 内容 |
|----|------|
| 路由 | `/m/process-reporting/history`（作为 MobileProcessReporting 的二级 Tab） |
| 功能 | 今日报工记录 / 扫码查订单状态 / 未完成报工提醒 |
| 后端 | `GET /production/reporting/orders?status=in_progress` |
| 预计 | 0.5 天 |

### C4 · TabBar 按权限动态显隐

| 项 | 内容 |
|----|------|
| 依据 | `currentUser.perm_codes`（后端返回的权限码列表） |
| 规则 | `production:reporting` 才显示报工入口；`quality:incoming` 才显示来料检验 |
| 兜底 | 无权限的 Tab 直接隐藏，不可达 |
| 预计 | 0.5 天 |

### C5 · UI 打磨 + 空态/错误态/Loading 统一

| 项 | 内容 |
|----|------|
| 抽组件 | `EmptyHint`（已存在，但只在 2 个页面）→ 全局共享 |
| 统一 | 所有页面加骨架屏 / Toast 反馈 / 防重复提交（button loading） |
| 安全区 | 确认 iPhone 刘海屏、iPad 均正常 |
| 预计 | 1 天 |

### Batch C 验收标准

- [ ] 5 个模块全部上线 APK
- [ ] 权限不足的用户看不到 TabBar 对应入口
- [ ] iPhone / Android 双端真机跑通 5 条主流程
- [ ] vite build + cap sync + APK 全链路无报错
- [ ] push + 部署 + PC 下载入口点击 → 版本号正确

### Batch C 预计工时

**3.5 人日**（可压缩到 2 天做 C1-C3，C4/C5 跟随）

---

## Batch D — iOS + 发布工程化

**前置条件**：Mac 机器 + Apple 开发者账号 + Xcode 15+

### D1 · iOS 工程初始化

```bash
npx cap add ios
npx cap sync ios
```

| 项 | 内容 |
|----|------|
| 网络安全 | iOS ATS 例外（当前 HTTP）或后端升级 HTTPS |
| 配置 | `Info.plist` 加 NSPhotoLibraryUsageDescription（扫码需要） |
| 证书 | 开发证书 → TestFlight → App Store |
| 预计 | 1 天（配置）+ 1 天（真机调） |

### D2 · 一键构建 + 上传脚本

| 项 | 内容 |
|----|------|
| 脚本 | `scripts/mobile-release.sh` 统一参数（版本号、环境、iOS/Android） |
| 版本号 | 从 package.json 读取，写入 AndroidManifest / Info.plist |
| 产出 | APK + IPA + releases.json 更新 + SCP 到生产服务器 |
| 预计 | 1 天 |

### D3 · 发布 API + 版本弹窗

| 项 | 内容 |
|----|------|
| 后端 | `/api/version`（已有）确保返回最新 downloadUrl + forceUpdate |
| 移动端 | 冷启动时调接口，`forceUpdate=true` 强制弹窗引导下载 |
| PC 端下载入口 | 追加 iOS 下载链接（TestFlight URL 或直接 IPA 链接） |
| 预计 | 0.5 天 |

### Batch D 验收标准

- [ ] `./scripts/mobile-release.sh android` 一键产出 APK 并上传
- [ ] `./scripts/mobile-release.sh ios` 一键产出 IPA 并上传
- [ ] 移动端 AppUpdateLoader 正确触发强更弹窗
- [ ] PC 下载入口 iOS 按钮不再 disabled

### Batch D 预计工时

**3.5 人日**

---

## Batch E — 深度特性（后期需求）

**前置条件**：Batch D 完成 + 生产现场反馈驱动。

### E1 · PDA 硬件按键适配

> 用户原指令：**"暂时没有 PDA,后续单独做 PDA 按键适配"**

| 项 | 内容 |
|----|------|
| 设备 | Honeywell / Zebra / Cipherlab 等手持终端 |
| 技术 | Capacitor `@capacitor/hardware-keys` 或厂商 SDK |
| 触发 | 物理扫描键 → 自动触发 `useBarcode.scan()` |
| 快捷键 | F1-F5 → 快速切换"报工/检验/点检" |
| 扫描模式 | 连续扫（不弹窗，直接追加到当前表单） |
| 预计 | 2-3 天（需真机调试） |

### E2 · 离线优先（Offline-First）

| 项 | 内容 |
|----|------|
| 存储 | Dexie.js IndexedDB（已有 adapter/offline/db.ts 骨架） |
| 队列 | 提交失败 → 进本地队列 → 网络恢复后自动 sync |
| 状态 | 页面显式展示"离线模式 / N 条待同步" |
| 幂等 | 每条离线记录带 UUID，服务端去重 |
| 预计 | 3-4 天 |

### E3 · 更多业务页面

| 候选 | 优先级 | 后端依赖 |
|------|--------|---------|
| 微生物检验 | ⭐⭐⭐ | MicrobeInspectionController |
| 环境检验 | ⭐⭐ | EnvInspectionController |
| 设备保养执行 | ⭐⭐⭐ | DeviceMaintenanceController |
| 异常上报 | ⭐⭐ | ProcessExceptionController |
| 工单详情（只读） | ⭐ | OrderController |
| 投诉处理 | ⭐ | ComplaintController |

### E4 · 性能 + 无障碍

| 项 | 内容 |
|----|------|
| 首屏 | React.lazy + preload |
| 滚动长列表 | react-window / antd-mobile InfiniteScroll |
| 无障碍 | aria-label / 对比度 / 大字模式 |
| 低内存 | 大图压缩上传 |
| 预计 | 1-2 天 |

---

## 优先级矩阵

```
高优先级
├── Batch C 业务补全（现场要用）
└── Batch D iOS 发布（上架交付）
      │
中优先级
├── E1 PDA 硬件按键（用户明确说了"后续"）
└── E3 更多业务页面（等现场反馈）
      │
低优先级
├── E2 离线优先（有网环境不急）
└── E4 性能/无障碍（打磨阶段）
```

## 交付节奏建议

| 时间 | 交付 |
|------|------|
| Week 1 | Batch C 全部上线（5 个模块 + APK） |
| Week 2 | Batch D iOS 配置 + 发布脚本 |
| Week 3+ | E1 PDA（看现场有没有真机）/ E3 其他页面 |

## 关键风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| 没有 Mac 机器 | Batch D iOS 完全阻塞 | 用 CI Runner 或云 Mac |
| 现场没有 PDA | E1 无法真机调 | 先做 web fallback，有真机再补 |
| HTTPS 未部署 | iOS ATS 阻止 HTTP 接口 | iOS 用临时 ATS Exception，尽快全量 HTTPS |
| 现场离线刚需 | Batch C 后直接 E2 插队 | 提前和车间沟通网络状况 |
| 后端接口字段变更多 | 移动端维护成本 | 移动端严格走复用现有接口，不新造 |
