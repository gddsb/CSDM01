/**
 * 移动端 APK 自动更新
 *
 * 工作流（简化版，零原生插件）：
 *   1. getNativeBuildNumber()   —— 读 Vite 编译时注入的 __APP_BUILD__（来自 rebuild_v2.sh）
 *   2. checkAndPromptUpdate()   —— 对比 localStorage 缓存的 server buildNumber
 *   3. Dialog.confirm 弹框     —— 用户点"立即更新" → window.open(APK_URL)
 *   4. Android 系统下载管理器  —— 完成后通知栏点击 → 系统安装界面
 *   5. 用户安装完成后 App 自动重启
 *
 * 为什么不用 Capacitor Filesystem 下载到 cache + Intent 安装？
 *   - 需要原生桥接 Capacitor Android Intent API（无现成插件）
 *   - Android 13+ 未知来源 APK 权限流程更复杂
 *   - 当前 window.open 已覆盖 99% 场景（系统浏览器接管下载）
 *
 * 依赖：
 *   - /api/version 公开端点（后端已实现）
 *   - /download/milk-can-mes-latest.apk（rebuild_v2.sh 部署到生产 nginx）
 *   - Vite define __APP_BUILD__ 注入（rebuild_v2.sh Step 4 已传）
 */

import { Dialog, Toast } from 'antd-mobile'
import { getAppVersion } from './app-version'

/** vite build 时注入的 API 绝对地址（rebuild_v2.sh 注入 http://43.138.218.55/api） */
const API_BASE: string =
  ((import.meta as any).env?.VITE_API_BASE_URL as string) || ''

const APK_URL = `${API_BASE}/download/milk-can-mes-latest.apk`

/** 编译时原生 buildNumber（Vite define 注入，来自 AndroidManifest android:versionCode） */
const NATIVE_BUILD: number = Number(
  ((import.meta as any).env?.__APP_BUILD__ as string) || '0'
)

/** 获取原生 buildNumber */
export function getNativeBuildNumber(): number {
  return NATIVE_BUILD
}

/** 对比 server 和 native buildNumber，有更新则弹窗提示
 *
 *  - 仅在 MobileLogin 启动时检查一次（不打扰用户正常使用）
 *  - server buildNumber 来自 localStorage 缓存（由 refreshAppVersion 提前 fetch）
 *  - 如果缓存没有（网络差首次启动）则静默跳过
 */
export async function checkAndPromptUpdate(): Promise<void> {
  // 只有 Android APK（Capacitor）才提示；PC 浏览器跳过
  const isAndroid = /android/i.test(navigator.userAgent) ||
                    (window as any).Capacitor?.getPlatform?.() === 'android'
  if (!isAndroid) return

  const serverInfo = getAppVersion()
  const serverBuild = Number(serverInfo.build) || 0
  const nativeBuild = getNativeBuildNumber()

  if (serverBuild === 0 || nativeBuild === 0) return // 信息不足，跳过
  if (serverBuild <= nativeBuild) return // 已是最新

  // 同一天只弹一次（用户可能多次启动 App 还没装完）
  const lastPrompt = localStorage.getItem('mes_update_prompted_date')
  const today = new Date().toISOString().slice(0, 10)
  if (lastPrompt === today) return

  localStorage.setItem('mes_update_prompted_date', today)

  const confirmed = await Dialog.confirm({
    title: '📦 发现新版本',
    content: `当前 build${nativeBuild} → 最新 build${serverBuild}\n点击「立即更新」将下载最新版 APK，完成后安装即可。`,
    confirmText: '立即更新',
    cancelText: '稍后',
  })

  if (!confirmed) return

  // 打开 APK 下载 URL（Android 系统浏览器/下载管理器接管）
  try {
    window.open(APK_URL, '_system')
    Toast.show({ content: '已开始下载，完成后请点击安装', position: 'bottom', duration: 2500 })
  } catch {
    // Capacitor 环境 window.open 可能被拦截，降级用 location.href
    window.location.href = APK_URL
  }
}
