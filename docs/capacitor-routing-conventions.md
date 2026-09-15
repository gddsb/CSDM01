# Capacitor 路由重定向规范

> 版本: v1.0 · 2026-09-15
> 适用范围: 移动端 / PC / TV 三端共存的 React + React Router 架构

---

## 核心原则

**路由重定向判定「在哪个壳里运行」，不判定「设备是什么类型」。**

只有在 **Capacitor 原生壳内**（有 `window.Capacitor` 对象）才自动走移动端路由子树（`/m/*`）。
任何纯 Web 浏览器 —— 无论是 PC 桌面浏览器、手机 Chrome、iPad Safari —— 一律留在 PC 路由子树（`/dashboard` 等）。

## 为什么不能依赖 useDevice / deviceDetector

`useDevice()` 的判定结果会被以下因素污染：

| 污染源 | 后果 |
|--------|------|
| `localStorage` 缓存（`DEVICE_CONFIG_KEY = 'mcm:device-config'`） | 之前手动选过 `tablet` / `phone`，浏览器再打开永远是那个值 |
| 桌面浏览器 UA + ≥1200px 宽屏 | 被 deviceDetector 误判为 `tablet` |
| 调试时手动 `setManualType('phone')` 忘了 reset | 整个 session 都被锁死 |
| Capacitor 版本升级后 UA 变化 | 启发式识别逻辑失效 |

**今天（2026-09-15）我们已经踩过这个坑**：PC 浏览器登录 admin 后被强跳到 `/m/dashboard`，且 MobileLayout 还漏了 `Outlet` import 导致白屏。修了 3 处才恢复。

## 判定方法（唯一正确姿势）

```typescript
// ✅ 正确
function inCapacitorShell(): boolean {
  const w = typeof window !== 'undefined' ? window : null
  if (!w) return false
  if ((w as any).Capacitor) return true
  // 某些壳内 UA 带 Capacitor
  if (/capacitor/i.test(navigator.userAgent)) return true
  return false
}
```

### 调试强制覆盖（可选）

```typescript
// ?mobile=1 或 #mobile=1 强制进入移动端路由 —— 仅开发调试用
const forceMobile = typeof window !== 'undefined' && (
  window.location.search.toLowerCase().includes('mobile=1') ||
  window.location.hash.toLowerCase().includes('mobile=1')
)
const shouldUseMobile = inCapacitorShell() || forceMobile
```

## 禁止事项

| ❌ 禁止写法 | 为什么 | ✅ 正确替代 |
|------------|--------|------------|
| `useDevice().type === 'phone' \|\| type === 'tablet'` | localStorage 缓存污染 | 用 `inCapacitorShell()` |
| `useDevice().capability.barcode` 来决定路由 | capability 也依赖 type | 用 `inCapacitorShell()` |
| `window.innerWidth < 768` | 浏览器窗口可以缩窄 | 壳环境检测 |
| `navigator.userAgent.includes('Mobile')` | Chrome DevTools 可模拟，且 PDA/平板 UA 不稳定 | 壳环境检测 |

## 唯一允许的 useDevice 场景

`useDevice()` 只用于 **UI 层的能力适配**，不用于路由重定向：

| 场景 | 示例 |
|------|------|
| 控制扫码按钮是否显示 | `capability.barcode && <BarcodeButton />` |
| TV 端遥控器焦点导航 | `useTvFocus()` |
| 设备能力提示文案 | 显示"当前设备不支持硬件扫码" |
| 手动切换调试（设备设置页） | 用户主动点击"切换为 PDA 模式" |

## 两个跳转逻辑的分工

| 逻辑 | 谁来做 | 依据 |
|------|--------|------|
| Web 访问 `/m/*` → 跳 `/dashboard` | AppRoutes 内 + DeviceEntryRedirect（反向始终生效） | 纯 path 判断 |
| 原生壳访问 `/` → 跳 `/m/dashboard` | AppRoutes 内 + DeviceEntryRedirect | `inCapacitorShell()` |
| TV 访问 `/` → 跳 `/tv/display` | AppRoutes 内 | `useDevice().type === 'tv'`（TV 壳独有，无 PC 冲突）|

## 文件位置（规范实施点）

| 文件 | 职责 |
|------|------|
| `src/main.tsx` AppRoutes | **主入口**：基于 `inCapacitorShell()` 做跳转（当前唯一生效的地方） |
| `src/mobile/DeviceEntryRedirect.tsx` | 独立组件形式的同一逻辑，方便嵌入其他路由树（保持同步即可） |
| `src/adapter/deviceDetector.ts` | 保留为 UI 适配层服务，**不再参与路由决策** |
| `src/adapter/DeviceContext.tsx` | 同上 |

## 修改历史

| 日期 | 变更 | 原因 |
|------|------|------|
| 2026-09-15 | deviceDetector 新增 `pc` 类型；AppRoutes 重定向改用 `inCapacitorShell()` | 修复 PC 浏览器被误跳移动端的 bug |
| 2026-09-15 | MobileLayout 补 `Outlet` import | 修复 `Outlet is not defined` 运行时错误 |
