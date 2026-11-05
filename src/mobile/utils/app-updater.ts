/**
 * 移动端 APK 自动更新（两阶段重试 + APP 内下载 + 原生安装）
 *
 * 更新流程：
 *   1. fetchServerVersionWithRetry() — 带指数退避（1s/2s/4s）
 *   2. 用户确认 → Filesystem.downloadFile() 显示进度
 *   3. 下载完成 → InstallApkPlugin.install() 触发系统安装界面
 *   4. 安装完成 → Android 自动冷启动 App
 *
 * 降级策略（APP 内下载失败时）：
 *   window.open(APK_URL, '_system') → '_blank' → location.href → 手动复制 URL
 */

import { Dialog, Toast } from 'antd-mobile'
import { getAppVersion } from './app-version'

const API_BASE: string =
  ((import.meta as any).env?.VITE_API_BASE_URL as string) || ''

const APK_URL = `${API_BASE}/download/milk-can-mes-latest.apk`
const VERSION_URL = API_BASE ? `${API_BASE}/version` : '/api/version'

/** 编译期注入的 buildNumber（rebuild_v2.sh 用 APP_BUILD=${BUILD} 注入，与 releases.json 一致）
 *  注意：必须用裸标识符 __APP_BUILD__，Vite define 不会替换 import.meta.env 上的属性 */
const NATIVE_BUILD: number = Number((__APP_BUILD__ as string) || '0')

const MAX_FETCH_RETRIES = 3

/** Capacitor Android Filesystem + InstallApk 原生插件动态加载 */
async function loadCapacitorPlugins() {
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    // InstallApkPlugin 是原生 Java 插件（android/app/src/main/java/...），
    // Capacitor 运行时自动注册到 window.Capacitor.Plugins.InstallApk
    const InstallApkPlugin = (window as any).Capacitor?.Plugins?.InstallApk || null
    return { Filesystem, Directory, InstallApkPlugin, ready: true }
  } catch {
    return { ready: false }
  }
}

export function getNativeBuildNumber(): number {
  return NATIVE_BUILD
}

/** ===== Phase A: 版本号 fetch（带重试） ===== */
async function fetchServerVersionWithRetry(): Promise<{ version: string; build: number } | null> {
  let lastError: unknown = null
  for (let attempt = 0; attempt <= MAX_FETCH_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt - 1) * 1000))
      }
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 8000)
      const resp = await fetch(VERSION_URL, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const json = await resp.json()
      const data = json?.data
      if (!data?.version || !data?.buildNumber) throw new Error('invalid payload')

      const info = { version: String(data.version), build: Number(data.buildNumber) }
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
  console.warn('[app-updater] 版本号 fetch 失败（重试 3 次耗尽）:', lastError)
  return null
}

/** ===== Phase B1: APP 内下载 + 原生安装 ===== */
async function downloadAndInstallNative(): Promise<boolean> {
  const plugins = await loadCapacitorPlugins()
  if (!plugins.ready) return false

  const { Filesystem, Directory, InstallApkPlugin } = plugins as any

  try {
    // 确保上次残留文件被清理
    try { await Filesystem.deleteFile({ path: 'update.apk', directory: Directory.Cache }) } catch { /* ignore */ }

    Toast.show({ content: '开始下载更新…', position: 'bottom', duration: 1500 })

    const result: any = await Filesystem.downloadFile({
      url: APK_URL,
      path: 'update.apk',
      directory: Directory.Cache,
      progress: true,
    })

    // 进度回调
    if (result?.progress) {
      result.progress((p: any) => {
        const percent = Math.round((p.bytes / p.contentLength) * 100)
        Toast.show({ content: `下载中 ${percent}%`, position: 'bottom', duration: 800 })
      })
    }

    Toast.show({ content: '下载完成 ✅ 即将开始安装', position: 'bottom', duration: 1500 })

    // 触发系统安装界面
    if (InstallApkPlugin) {
      await InstallApkPlugin.install({ path: 'update.apk', directory: Directory.Cache })
    } else {
      // fallback: intent scheme
      const fileUri = result?.path || ''
      window.location.href = `intent://#Intent;action=android.intent.action.VIEW;type=application/vnd.android.package-archive;S.path=${encodeURIComponent(fileUri)};end`
    }
    return true
  } catch (e) {
    console.warn('[app-updater] APP 内下载失败，回退到系统下载管理器:', e)
    return false
  }
}

/** ===== Phase B2: 降级（系统下载管理器 + 手动兜底） ===== */
async function openApkFallback(): Promise<boolean> {
  const openStrategies: Array<() => boolean> = [
    () => { try { window.open(APK_URL, '_system'); return true } catch { return false } },
    () => { try { window.open(APK_URL, '_blank'); return true } catch { return false } },
    () => { try { window.location.href = APK_URL; return true } catch { return false } },
  ]

  for (let attempt = 0; attempt < openStrategies.length; attempt++) {
    const ok = openStrategies[attempt]()
    if (ok) return true
    if (attempt < openStrategies.length - 1) {
      await new Promise((r) => setTimeout(r, 300))
    }
  }

  // 全部失败 → 手动兜底
  Toast.show({ content: '自动打开下载失败，请手动复制链接', position: 'bottom', duration: 2000 })
  try {
    await Dialog.alert({
      title: '📦 手动下载',
      content: `自动下载失败，请复制以下 URL 到浏览器访问：\n\n${APK_URL}`,
      confirmText: '复制链接',
      onConfirm: () => {
        navigator.clipboard?.writeText(APK_URL).then(() => {
          Toast.show({ content: '已复制到剪贴板', position: 'bottom' })
        }).catch(() => {
          Toast.show({ content: '复制失败，请手动长按选择', position: 'bottom' })
        })
      },
    })
  } catch { /* Dialog 被取消或不支持 */ }
  return false
}

/** ===== 主入口 =====
 * @returns true = 触发了更新流程（弹窗/下载/降级），false = 已是最新/跳过
 */
export async function checkAndPromptUpdate(ignoreDateLock = false): Promise<boolean> {
  const isAndroid = /android/i.test(navigator.userAgent) ||
                    (window as any).Capacitor?.getPlatform?.() === 'android'
  if (!isAndroid) return false

  const cached = getAppVersion()
  let serverBuild = Number(cached.build) || 0
  let serverVersion = cached.version
  const nativeBuild = getNativeBuildNumber()

  const fresh = await fetchServerVersionWithRetry()
  if (fresh) {
    serverBuild = fresh.build
    serverVersion = fresh.version
  }
  if (serverBuild === 0 || nativeBuild === 0) return false
  if (serverBuild <= nativeBuild) {
    // 已是最新
    return false
  }

  if (!ignoreDateLock) {
    const lastSuccess = localStorage.getItem('mes_update_prompted_date')
    const today = new Date().toISOString().slice(0, 10)
    if (lastSuccess === today) return false
  }

  const confirmed = await Dialog.confirm({
    title: '📦 发现新版本',
    content: `当前 build${nativeBuild} → 最新 build${serverBuild}\n点击「立即更新」将下载最新版 APK，完成后安装即可。`,
    confirmText: '立即更新',
    cancelText: '稍后',
  })
  if (!confirmed) return false  // 用户点"稍后"也算未触发

  // 优先尝试 APP 内下载 + 原生安装，失败则回退
  let opened = await downloadAndInstallNative()
  if (!opened) {
    opened = await openApkFallback()
  }

  if (opened) {
    localStorage.setItem('mes_update_prompted_date', new Date().toISOString().slice(0, 10))
  }
  void serverVersion
  return opened
}
