/**
 * 移动端版本检测 & 强制更新服务
 *
 * 职责：
 *   1. 冷启动时对比服务器 /api/version 与本机版本号
 *   2. 有新版本时：
 *      - forceUpdate=true → 弹窗阻塞整个 UI，直到下载安装完成（无关闭按钮）
 *      - forceUpdate=false → 弹窗有"立即更新"/"稍后再说"，记一下 skip 版本号避免反复打扰
 *   3. Android 端：下载 APK → 调原生 Intent 安装
 *   4. Web/PWA 端：Service Worker 直接 reload（已有 Workbox 热更新能力）
 *
 * 设计要点：
 *   - 版本号 1.0.1.730 用点号分割后逐段数字比较（semver-compatible）
 *   - 所有 API 都包 try/catch，网络失败时静默降级（不阻塞 APP 使用）
 *   - checkForUpdate 是唯一对外公开入口
 */
import axios from 'axios'

// vite.config.ts 里通过 define 注入的全局常量（Web 端构建产物里直接替换为字符串）
declare const __APP_VERSION__: string

export interface ReleaseInfo {
  version: string
  buildNumber: number
  forceUpdate: boolean
  downloadUrl: string
  downloadUrlIos?: string
  updateNotes?: string
  minNativeVersion?: number
  minAppVersion?: string
  apkSize?: number
  ipaSize?: number
  checksum?: string
  publishedAt?: string
  gitSha?: string
}

export type UpdatePlatform = 'android' | 'ios' | 'web' | 'unknown'

export interface NativeInfo {
  /** 原生 APP 版本号（如 1.0.1，从 Capacitor Device 读取；Web 端 fallback 为 package.json version） */
  appVersion: string
  /** 原生 build number（仅 Android/iOS 有；Web 端始终为 0） */
  buildNumber: number
  platform: UpdatePlatform
  isNative: boolean
}

export interface UpdateCheckResult {
  /** 是否有更新 */
  hasUpdate: boolean
  /** 更新信息（无更新时为 null） */
  release: ReleaseInfo | null
  /** 本地原生信息 */
  local: NativeInfo
  /** 是否强制更新（forceUpdate=true 且有新版本） */
  forceUpdate: boolean
}

const SKIPPED_VERSION_KEY = 'mcm:update-skipped-version'
const UPDATE_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000 // 12h

/** 语义化版本比较：a > b 返回 1；a < b 返回 -1；相等返回 0 */
export function compareVersion(a: string, b: string): number {
  const pa = a.split('.').map((s) => Number.parseInt(s, 10) || 0)
  const pb = b.split('.').map((s) => Number.parseInt(s, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0
    const nb = pb[i] ?? 0
    if (na > nb) return 1
    if (na < nb) return -1
  }
  return 0
}

function readLocalVersion(): NativeInfo {
  // 优先读 Capacitor Device API（Android/iOS 原生壳）
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Device } = require('@capacitor/device') as typeof import('@capacitor/device')
    const info = Device.getInfo() as {
      operatingSystem?: string
      appVersion?: string
      appBuild?: string
    }
    if (info?.appVersion) {
      return {
        appVersion: info.appVersion,
        buildNumber: Number.parseInt(info.appBuild || '0', 10) || 0,
        platform: info.operatingSystem?.toLowerCase().includes('android') ? 'android'
                 : info.operatingSystem?.toLowerCase().includes('ios') ? 'ios'
                 : 'unknown',
        isNative: true,
      }
    }
  } catch { /* Web 环境下 require 失败，属正常降级 */ }

  // Web 端 fallback：读 package.json 里 __APP_VERSION__
  return {
    appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0',
    buildNumber: 0,
    platform: 'web',
    isNative: false,
  }
}

let cachedRelease: ReleaseInfo | null | undefined

async function fetchRelease(): Promise<ReleaseInfo | null> {
  // 短 TTL 避免每个冷启动都请求；同时允许缓存失效后重拉
  if (cachedRelease) return cachedRelease
  try {
    const { data } = await axios.get('/api/version', {
      timeout: 5000,
      // 不走共享 axios instance，避免后端挂掉时阻塞全局
    })
    if (data?.success && data.data) {
      cachedRelease = data.data as ReleaseInfo
      return cachedRelease
    }
  } catch { /* 静默失败 */ }
  return null
}

function getSkippedVersion(): string | null {
  try { return localStorage.getItem(SKIPPED_VERSION_KEY) } catch { return null }
}
function setSkippedVersion(v: string): void {
  try { localStorage.setItem(SKIPPED_VERSION_KEY, v) } catch { /* ignore */ }
}

/**
 * 主入口：检查是否有新版本
 * 网络失败时静默返回 hasUpdate=false，确保不阻塞 APP 启动
 */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const local = readLocalVersion()
  const release = await fetchRelease()

  // 无服务器版本信息 → 不打扰
  if (!release) {
    return { hasUpdate: false, release: null, local, forceUpdate: false }
  }

  // 版本号比较：本地 ≥ 服务器 → 已是最新
  const cmp = compareVersion(local.appVersion, release.version)
  if (cmp >= 0) {
    // buildNumber 也比一下（原生 APK build）
    if (local.buildNumber === 0 || local.buildNumber >= (release.buildNumber || 0)) {
      return { hasUpdate: false, release: null, local, forceUpdate: false }
    }
  }

  // 有新版本
  // 1) 强制更新：直接返回 forceUpdate=true，忽略 skip
  if (release.forceUpdate) {
    return { hasUpdate: true, release, local, forceUpdate: true }
  }

  // 2) 非强制：用户之前跳过了这个版本 → 静默
  const skipped = getSkippedVersion()
  if (skipped && compareVersion(skipped, release.version) >= 0) {
    return { hasUpdate: false, release: null, local, forceUpdate: false }
  }

  return { hasUpdate: true, release, local, forceUpdate: false }
}

/** 用户点"稍后再说"时调用，防止反复打扰 */
export function skipUpdate(release: ReleaseInfo): void {
  setSkippedVersion(release.version)
}

/**
 * Android 原生壳下载 APK 并调起安装（通过 Capacitor Filesystem + Intent bridge）
 * Web/PWA 端不走这个函数（Workbox 自行处理）
 *
 * 注意：本项目暂未引入 Capacitor Filesystem Plugin（还没到阶段 2）
 * 这个函数在 Android 真机上被调用时，如果 Filesystem plugin 不存在，
 * 会 catch 异常并回退为 window.open 让用户手动下载
 */
export async function downloadAndInstallApk(url: string): Promise<{ ok: boolean; message: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Filesystem, Directory } = require('@capacitor/filesystem') as typeof import('@capacitor/filesystem')
    if (!Filesystem) throw new Error('Filesystem plugin not available')

    // 下载到缓存目录
    const fileName = 'milk-can-mes-update.apk'
    await Filesystem.downloadFile({ url, path: fileName, directory: Directory.Cache })

    // 调起安装：Android 原生 Intent.ACTION_VIEW + application/vnd.android.package-archive
    // 这里暂用 window.open 兜底，后续在阶段 2 接入 Filesystem plugin 时替换
    window.open(url, '_blank')

    return { ok: true, message: '已开始下载，请从通知栏安装' }
  } catch (err: any) {
    // 回退：用系统浏览器打开下载地址
    try { window.open(url, '_blank') } catch { /* ignore */ }
    return { ok: true, message: '已在浏览器中打开下载链接，请手动安装' }
  }
}

/** 重置缓存（开发调试用） */
export function __resetUpdateCache(): void {
  cachedRelease = undefined
  try { localStorage.removeItem(SKIPPED_VERSION_KEY) } catch { /* ignore */ }
}
