# 移动端 Phase 1 实施计划（分 3 批落地）

## 批次划分

| 批次 | 范围 | 交付物 | 可验收 |
|------|------|--------|--------|
| **Batch A** | 骨架跑通 | MobileLayout + antd-mobile 主题 + `/m/*` 路由 + 自动跳转 + MobileLogin + MobileDashboard | APK 能登录、能看到 4 个快捷入口卡片、能切换 Tab |
| **Batch B** | 核心业务 | useBarcode hook + 报工 + 来料检验 + 设备点检 | 扫码/手动输入 → 业务提交 → 后端有数据 |
| **Batch C** | iOS + 打包 + 收尾 | iOS 工程初始化 + 构建 scripts + APK/IPA 上传链路 + MobileProfile（退出/改密）+ 权限驱动 TabBar | Mac 上能 Archive IPA；APK 冷启动版本检测完整 |

下面是每个批次的详细步骤。

---

## Batch A：骨架跑通

### Repository Research 结论
- antd-mobile 5.42.3 + antd-mobile-icons 0.3.0 已在 deps，未使用
- Capacitor android/ 工程 + APK 构建链路已通
- 后端登录 `/api/auth/login` 返回 `{success, token, user, perm_codes}`
- `antd-mobile` 与 `antd` ConfigProvider **不能嵌套**，需要独立路由子树
- phone/pda 访问 `/` 需自动跳 `/m/dashboard`；PC 访问 `/m/*` 需自动跳 `/dashboard`

### Files to Create（Batch A）
- `src/mobile/theme.ts` — antd-mobile ConfigProvider 主题，brandColor `#2196F3`
- `src/mobile/MobileLayout.tsx` — TabBar（首页/报工/检验/设备/我的）+ NavBar + Outlet + 安全区 padding
- `src/mobile/pages/MobileLogin.tsx` — 大字、简洁、键盘安全；登录成功跳 `/m/dashboard`
- `src/mobile/pages/MobileDashboard.tsx` — 4-6 个大卡片快捷入口 + 今日统计
- `src/mobile/styles/mobile.css` — 100dvh、iOS 输入框 16px、禁用 tap highlight、safe-area
- `src/mobile/index.ts` — 统一导出

### Files to Modify（Batch A）
- `src/main.tsx` — 引入 `/m/*` 路由子树；最外层设备检测 → 自动入口跳转
- `public/index.html` — 加 `viewport-fit=cover` + iOS meta

### Implementation Steps（Batch A）
1. 写 `src/mobile/styles/mobile.css` — 100dvh 容器、safe-area、iOS 输入框 16px、禁用 PC 风格的 `html, body { font-size: 14px }` 覆盖
2. 写 `src/mobile/theme.ts` — antd-mobile ConfigProvider `{ theme: { '--brand-color': '#2196F3', ... } }`
3. 写 `src/mobile/MobileLayout.tsx` — TabBar 5 项（首页/报工/检验/设备/我的）+ NavBar 顶栏 + Outlet，底部 safe-area padding；TabBar 图标用 antd-mobile-icons
4. 写 `src/mobile/pages/MobileLogin.tsx` — 调现有 `useApp().login()`，antd-mobile Form + Input + Button，登录后 navigate(`/m/dashboard`)
5. 写 `src/mobile/pages/MobileDashboard.tsx` — Grid 大卡片入口（报工/来料检/设备点检/质量追溯 + 更多）+ 今日统计（调现有 Dashboard 后端接口）
6. 修改 `main.tsx`：
   - 最外层 `AppRoutes` 之前加一个 `<DeviceEntryRedirect>` 组件：phone/pda 访问根 → `/m/dashboard`；PC 访问 `/m/*` → `/dashboard`
   - 新增 `<Route path="/m">` 子路由，里面放 MobileLayout + MobileLogin / MobileDashboard 等
   - `/m` 子路由内的 ConfigProvider 用 antd-mobile 的
7. 修改 `public/index.html` — viewport 加 `viewport-fit=cover`；加 `apple-mobile-web-app-capable` / `apple-mobile-web-app-status-bar-style` meta
8. 本地验证：`npx vite build --mode capacitor` 无 error

### Validation（Batch A）
- ✅ `vite build --mode capacitor` 成功
- ✅ Android Studio / Logcat：APK 启动 → MobileLogin → admin/admin123 → MobileDashboard 4 卡片可见
- ✅ TabBar 切换无报错
- ✅ PC 浏览器访问 `/` 仍看到 PC Dashboard，不受影响
- ✅ PC 浏览器访问 `/m/login` 自动重定向回 `/dashboard`

### Risks（Batch A）
- **antd-mobile 与 antd 的 ConfigProvider 冲突** → 两个路由子树各自包自己的 ConfigProvider，不嵌套
- **deviceDetector 初始化时机** → DeviceProvider 必须在 AppRoutes 之上，否则入口重定向读不到 type
- **main.tsx 变大** → 把移动端路由单独抽到 `src/mobile/routes.tsx`，main.tsx 只 import 合并

---

## Batch B：核心业务

### Files to Create（Batch B）
- `src/mobile/hooks/useBarcode.ts` — 包装 `BarcodeScanner.startScan()`，失败 fallback 手动输入
- `src/mobile/components/BarcodeButton.tsx` — 扫码按钮（圆形，底部悬浮或页内）
- `src/mobile/pages/MobileProcessReporting.tsx` — 报工 3 步：扫码工单 → 选工序+填数 → 提交
- `src/mobile/pages/MobileIncomingInspection.tsx` — 来料检 3 步：扫码批次 → 检验项+拍照 → 判定提交
- `src/mobile/pages/MobileDeviceInspection.tsx` — 设备点检 2 步：扫码设备 → 点检项勾选 → 提交

### Files to Modify（Batch B）
- `src/mobile/MobileLayout.tsx` — TabBar 加真实 link 路径
- `src/mobile/pages/MobileDashboard.tsx` — 卡片入口加真实 navigate 跳转
- `src/mobile/routes.tsx`（Batch A 会抽出来）— 注册新路由

### Implementation Steps（Batch B）
1. 写 `useBarcode`：返回 `{ scan, cancel, isScanning }`；Capacitor 环境用原生扫码，Web 环境弹 Input 手动输入
2. 写 MobileProcessReporting：
   - 工单列表 `GET /api/production/report-orders`（status=待报工）
   - 报工工序详情 → `POST /api/production/report-orders` 创建新工序记录
   - 提交后调 `POST /api/production/report-orders/:id/finish`
3. 写 MobileIncomingInspection：
   - 来料单列表 → 检验项目 checklist → 判定合格/不合格 → `POST /api/quality/incoming-inspections`
4. 写 MobileDeviceInspection：
   - 设备列表按产线过滤 → `POST /api/basic/device-records`（如有点检接口用点检）
5. 每个页面都用 antd-mobile 的 `Steps` / `Form` / `Stepper` / `ImageUploader`

### Validation（Batch B）
- ✅ 扫码按钮能调起原生扫码（Android 真机）
- ✅ 手动输入 fallback 正常（Web 模拟模式）
- ✅ 报工提交后 PC 端 ProcessReporting 列表能看到新记录
- ✅ 来料检验提交后后端 IncomingInspection 列表有数据
- ✅ 三个页面之间 TabBar 切换流畅

---

## Batch C：iOS + 打包 + 收尾

### Files to Create（Batch C）
- `ios/` — Capacitor iOS 工程（`npx cap add ios` 生成）

### Files to Modify（Batch C）
- `package.json` — 新增 `mobile:build` / `mobile:sync:ios` scripts
- `src/mobile/MobileLayout.tsx` — TabBar / Dashboard 入口按 `perm_codes` 动态显示
- `server/data/releases.json` — iOS 版本信息（可选）

### Implementation Steps（Batch C）
1. 本地 Mac：`cd /workspace && npx cap add ios && npx cap sync ios`
2. Xcode 打开 `ios/App/App.xcworkspace` → Signing & Capabilities 选 Team
3. Archive → Distribute App → TestFlight / App Store
4. Android release 签名（如果之前只有 debug）
5. 写 `scripts/mobile-release.sh` 一键脚本：vite build + cap sync + 上传 APK + 更新 releases.json
6. MobileProfile 页面（退出、改密）
7. TabBar 按 `perm_codes` 动态显隐：没 production:reporting → 隐藏报工入口，等

### Validation（Batch C）
- ✅ APK 从服务器下载安装 → 冷启动 → 版本检测弹窗触发（releases.json 更新过）
- ✅ iOS Simulator 上 MobileLogin → MobileDashboard 全流程
- ✅ TabBar 权限隐藏生效：无 `device:list` 权限的用户看不到设备入口
