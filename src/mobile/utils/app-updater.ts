/**
 * 移动端 APK 自动更新（带失败重试）
 *
 * 两阶段重试：
 *   Phase A — 版本号 fetch 重试（最多 3 次，指数退避 1s/2s/4s）
 *   Phase B — APK URL 打开重试（最多 3 次，三种降级方式 + 手动复制兜底）
 *
 * 关键设计：
 *   1. 只有**成功触发下载**才写 mes_update_prompted_date（当天不再弹）
 *   2. 用户点"稍后"→ 不写 prompted_date，下次启动继续弹
 *   3. 所有重试耗尽后 → Toast 显示 APK URL 让用户手动复制
 *   4. PC 浏览器自动跳过（只在 Android Capacitor 环境工作）
 */

import { Dialog, Toast } from 'antd-mobile'
import { getAppVersion } from './app-version'

/** vite build 时注入的 API 绝对地址 */
const API_BASE: string =
  ((import.meta as any).env?.VITE_API_BASE_URL as string) || ''

const APK_URL = `${API_BASE}/download/milk-can-mes-latest.apk`
const VERSION_URL = API_BASE ? `${API_BASE}/version` : '/api/version'

/** 编译时原生 buildNumber（Vite define 注入） */
const NATIVE_BUILD: number = Number(
  ((import.meta as any).env?.__APP_BUILD__ as string) || '0'
)

const MAX_FETCH_RETRIES = 3
const MAX_OPEN_RETRIES = 3

export function getNativeBuildNumber(): number {
  return NATIVE_BUILD
}

/** ===== Phase A: 版本号 fetch（带重试） ===== */
async function fetchServerVersionWithRetry(): Promise<{ version: string; build: number } | null> {
  let lastError: unknown = null
  for (let attempt = 0; attempt <= MAX_FETCH_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        // 指数退避：1s / 2s / 4s
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt - 1) * 1000))
      }
      const resp = await fetch(VERSION_URL, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout?.(8000), // 8s 超时（现代浏览器支持）
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const json = await resp.json()
      const data = json?.data
      if (!data?.version || !data?.buildNumber) throw new Error('invalid payload')

      const info = { version: String(data.version), build: Number(data.buildNumber) }
      // 同步写入 localStorage 缓存（让 app-version.ts 的 getAppVersion() 下次也能读到）
      try {
        localStorage.setItem('mes_app_version', JSON.stringify({
          version: info.version,
          build: String(info.build),
          gitSha: data.gitSha,
          cachedAt: Date.now(),
        }))
      } catch { /* ignore */ }
      return info
    } catch (e) {
      lastError = e
    }
  }
  // 重试耗尽：静默失败，不打扰用户（用户在移动网络差时不想被弹"检查更新失败"）
  console.warn('[app-updater] 版本号 fetch 失败（重试 3 次耗尽）:', lastError)
  return null
}

/** ===== Phase B: APK URL 打开（带重试 + 降级） ===== */
async function openApkWithRetry(): Promise<boolean> {
  const openStrategies: Array<() => boolean> = [
    // 策略 1：Capacitor/Android 系统浏览器
    () => { try { window.open(APK_URL, '_system'); return true } catch { return false } },
    // 策略 2：浏览器新标签
    () => { try { window.open(APK_URL, '_blank'); return true } catch { return false } },
    // 策略 3：location.href 直接跳转（兜底）
    () => { try { window.location.href = APK_URL; return true } catch { return false } },
  ]

  for (let attempt = 0; attempt < openStrategies.length && attempt < MAX_OPEN_RETRIES; attempt++) {
    const ok = openStrategies[attempt]()
    if (ok) return true
    // 短暂等待后试下一种策略
    if (attempt < openStrategies.length - 1) {
      await new Promise((r) => setTimeout(r, 300))
    }
  }

  // 全部失败 → 手动兜底
  Toast.show({
    content: '自动打开下载失败，请手动复制下载链接',
    position: 'bottom',
    duration: 2000,
  })
  try {
    await Dialog.alert({
      title: '📦 手动下载',
      content: `自动打开下载链接失败，请复制以下 URL 到浏览器访问：\n\n${APK_URL}`,
      confirmText: '复制链接',
      onConfirm: () => {
        navigator.clipboard?.writeText(APK_URL).then(() => {
          Toast.show({ content: '已复制到剪贴板', position: 'bottom' })
        }).catch(() => {
          // clipboard 不可用时也只能提醒
          Toast.show({ content: '复制失败，请手动长按选择', position: 'bottom' })
        })
      },
    })
  } catch { /* Dialog 被取消或不支持 */ }
  return false
}

/** ===== 主入口 ===== */
export async function checkAndPromptUpdate(): Promise<void> {
  // 1. 非 Android / 非 Capacitor 跳过
  const isAndroid = /android/i.test(navigator.userAgent) ||
                    (window as any).Capacitor?.getPlatform?.() === 'android'
  if (!isAndroid) return

  // 2. 先从缓存读一次（快速路径，避免 fetch 阻塞）
  const cached = getAppVersion()
  let serverBuild = Number(cached.build) || 0
  let serverVersion = cached.version
  const nativeBuild = getNativeBuildNumber()

  // 3. 有缓存但服务器端可能已更新 —— 异步 fetch 重试覆盖
  const fresh = await fetchServerVersionWithRetry()
  if (fresh) {
    serverBuild = fresh.build
    serverVersion = fresh.version
  }
  // 缓存和 fresh 都拿不到 → build=0 → 跳过
  if (serverBuild === 0 || nativeBuild === 0) return
  if (serverBuild <= nativeBuild) return

  // 4. 防打扰：同一天已成功触发过下载 → 不再弹
  const lastSuccess = localStorage.getItem('mes_update_prompted_date')
  const today = new Date().toISOString().slice(0, 10)
  if (lastSuccess === today) return

  // 5. 弹窗
  const confirmed = await Dialog.confirm({
    title: '📦 发现新版本',
    content: `当前 build${nativeBuild} → 最新 build${serverBuild}\n点击「立即更新」将下载最新版 APK，完成后安装即可。`,
    confirmText: '立即更新',
    cancelText: '稍后',
  })
  if (!confirmed) {
    // 用户点"稍后" —— 不写 prompted_date，下次启动继续弹
    return
  }

  // 6. 打开下载（带重试）
  const opened = await openApkWithRetry()
  if (opened) {
    // 只有成功触发下载才写日期（防打扰）
    localStorage.setItem('mes_update_prompted_date', today)
    Toast.show({ content: '已开始下载，完成后请点击安装', position: 'bottom', duration: 2500 })
  }
  // 未成功 → 不写日期，下次启动继续弹（用户可能是在信号差的地方）
  void serverVersion
}
