/**
 * 移动端 APK 版本管理 + 自动更新（唯一入口）
 *
 * 数据源：GET /api/version（公开接口，读 server/data/releases.json）
 * 本地版本：编译期注入 __APP_VERSION__ / __APP_BUILD__ / __APP_GIT_SHA__（rebuild_v2.sh 保证同源）
 *
 * 更新流程：
 *   1. fetchRelease() 带指数退避（1s/2s/4s）与 10 分钟内存缓存
 *   2. 比较：先 version，再 buildNumber（本地 build 缺失时按 0 处理，不提前判定"已最新"）
 *   3. 弹窗（forceUpdate → 不可取消；否则可"稍后"，同一 build 不再提示）
 *   4. APP 内下载（Filesystem + progress 事件监听）→ 可选 SHA256 校验 → InstallApk 原生安装
 *   5. 失败降级：window.open(_system/_blank) → location.href → 手动复制链接
 */

import { Dialog, Toast } from 'antd-mobile'

const API_BASE: string =
  ((import.meta as any).env?.VITE_API_BASE_URL as string) || ''

const VERSION_URL = API_BASE ? `${API_BASE}/version` : '/api/version'
const DEFAULT_APK_URL = `${API_BASE}/download/milk-can-mes-latest.apk`

/** 编译期注入（必须用裸标识符，Vite define 不替换 import.meta.env 上的属性） */
const LOCAL_VERSION: string = String((__APP_VERSION__ as string) || '0.0.0')
const LOCAL_BUILD: number = Number((__APP_BUILD__ as string) || '0')

const MAX_FETCH_RETRIES = 3
const RELEASE_CACHE_TTL = 10 * 60 * 1000
const SKIP_KEY = 'mes_update_skipped'
const PROMPT_DATE_KEY = 'mes_update_prompted_date'

export interface ServerRelease {
  version: string
  build: number
  forceUpdate: boolean
  downloadUrl: string
  downloadUrlIos: string
  apkSize: number
  checksum: string
  updateNotes: string
}

let releaseCache: { at: number; data: ServerRelease } | null = null

/** 当前安装包编译期 buildNumber（0 表示该包未注入，需重新安装） */
export function getNativeBuildNumber(): number {
  return LOCAL_BUILD
}

/** 当前安装包编译期版本号 */
export function getLocalVersion(): string {
  return LOCAL_VERSION
}

/** 北京日期 YYYY-MM-DD（避免 UTC 导致每天 08:00 才重置提示限流） */
function beijingDate(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

/** 语义版本比较：a > b 返回 1，相等 0，小于 -1 */
function compareVersion(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number(n) || 0)
  const pb = b.split('.').map((n) => Number(n) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0
    const y = pb[i] || 0
    if (x > y) return 1
    if (x < y) return -1
  }
  return 0
}

/** 是否需要更新：先比 version，相等再比 buildNumber */
function shouldUpdate(server: ServerRelease): boolean {
  const cmp = compareVersion(server.version, LOCAL_VERSION)
  if (cmp > 0) return true
  if (cmp < 0) return false
  return server.build > LOCAL_BUILD
}

/** Capacitor Android Filesystem + InstallApk 原生插件动态加载 */
async function loadCapacitorPlugins() {
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    // InstallApkPlugin 是原生 Java 插件，Capacitor 运行时自动注册到 window.Capacitor.Plugins.InstallApk
    const InstallApkPlugin = (window as any).Capacitor?.Plugins?.InstallApk || null
    return { Filesystem, Directory, InstallApkPlugin, ready: true }
  } catch {
    return { ready: false }
  }
}

/** ===== 获取服务端发布信息（带重试 + 缓存） ===== */
async function fetchRelease(forceRefresh = false): Promise<ServerRelease | null> {
  if (!forceRefresh && releaseCache && Date.now() - releaseCache.at < RELEASE_CACHE_TTL) {
    return releaseCache.data
  }

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

      const release: ServerRelease = {
        version: String(data.version),
        build: Number(data.buildNumber),
        forceUpdate: Boolean(data.forceUpdate),
        downloadUrl: String(data.downloadUrl || DEFAULT_APK_URL),
        downloadUrlIos: String(data.downloadUrlIos || ''),
        apkSize: Number(data.apkSize) || 0,
        checksum: String(data.checksum || ''),
        updateNotes: String(data.updateNotes || ''),
      }
      releaseCache = { at: Date.now(), data: release }

      // 同步版本展示缓存（app-version.ts 读取）
      try {
        localStorage.setItem('mes_app_version', JSON.stringify({
          version: release.version,
          build: String(release.build),
          gitSha: data.gitSha,
          cachedAt: Date.now(),
        }))
      } catch { /* localStorage 不可用时忽略 */ }
      return release
    } catch (e) {
      lastError = e
    }
  }
  console.warn('[app-updater] 版本信息拉取失败（重试耗尽）:', lastError)
  return null
}

/** APK 下载到应用私有临时目录 cache/apk/ 下，仅该子目录由 FileProvider 暴露 */
const APK_PATH = 'apk/update.apk'

/** SHA256 校验（crypto.subtle 仅在安全上下文可用；不可用时跳过并告警） */
async function verifyChecksum(plugins: any, expected: string): Promise<void> {
  const { Filesystem, Directory } = plugins
  const subtle = (globalThis.crypto as any)?.subtle
  if (!subtle) {
    console.warn('[app-updater] 当前环境无 crypto.subtle，跳过安装包校验')
    return
  }
  const res: any = await Filesystem.readFile({ path: APK_PATH, directory: Directory.Cache })
  const b64 = typeof res?.data === 'string' ? res.data : ''
  if (!b64) {
    console.warn('[app-updater] 无法读取安装包，跳过校验')
    return
  }
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const digest = await subtle.digest('SHA-256', bytes)
  const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
  if (hex !== expected.toLowerCase()) {
    throw new Error('安装包 SHA256 校验失败')
  }
}

/** ===== APP 内下载 + 原生安装 ===== */
async function downloadAndInstallNative(release: ServerRelease): Promise<boolean> {
  const plugins = await loadCapacitorPlugins()
  if (!plugins.ready) return false

  const { Filesystem, Directory, InstallApkPlugin } = plugins as any
  const url = release.downloadUrl || DEFAULT_APK_URL

  try {
    // 清理上次残留
    try { await Filesystem.deleteFile({ path: APK_PATH, directory: Directory.Cache }) } catch { /* 不存在时忽略 */ }

    Toast.show({ content: '开始下载更新…', position: 'bottom', duration: 1500 })

    // Capacitor 的进度通过 addListener('progress') 派发，返回对象上没有 progress 方法
    let listener: any = null
    try {
      listener = await Filesystem.addListener('progress', (p: any) => {
        const total = Number(p?.contentLength || 0)
        const loaded = Number(p?.bytesLoaded ?? p?.bytes ?? 0)
        if (total > 0) {
          const percent = Math.min(100, Math.round((loaded / total) * 100))
          Toast.show({ content: `下载中 ${percent}%`, position: 'bottom', duration: 800 })
        }
      })
    } catch { /* 低版本插件不支持 progress 事件时忽略 */ }

    await Filesystem.downloadFile({
      url,
      path: APK_PATH,
      directory: Directory.Cache,
      recursive: true,
    })
    try { listener?.remove?.() } catch { /* 忽略 */ }

    // 文件完整性：存在且大小与服务端一致
    const stat: any = await Filesystem.stat({ path: APK_PATH, directory: Directory.Cache })
    const actualSize = Number(stat?.size || 0)
    if (actualSize <= 0) throw new Error('安装包下载失败（文件为空）')
    if (release.apkSize > 0 && actualSize !== release.apkSize) {
      throw new Error(`安装包大小不一致（${actualSize} ≠ ${release.apkSize}）`)
    }

    if (release.checksum) {
      try {
        await verifyChecksum(plugins, release.checksum)
      } catch (e) {
        Toast.show({ content: '安装包校验失败，已中止安装', position: 'bottom', duration: 3000 })
        console.error('[app-updater] checksum 校验失败:', e)
        return false
      }
    }

    if (!InstallApkPlugin) {
      throw new Error('原生安装插件不可用，请重新安装最新 APK')
    }

    Toast.show({ content: '下载完成 ✅ 即将打开系统安装器', position: 'bottom', duration: 1500 })
    await InstallApkPlugin.install({ path: APK_PATH, directory: Directory.Cache })
    return true
  } catch (e: any) {
    const msg = String(e?.message || e || '')
    // 未授权“安装未知来源应用”：已跳转系统设置页，视为流程已处理，不再降级浏览器
    if (/UNKNOWN_SOURCE|未知来源/.test(msg)) {
      Toast.show({ content: '请允许本应用安装未知来源应用后重试', position: 'bottom', duration: 3000 })
      return true
    }
    console.warn('[app-updater] APP 内下载/安装失败，回退到系统浏览器:', e)
    Toast.show({ content: `APP 内安装失败：${msg || '未知错误'}`, position: 'bottom', duration: 2500 })
    return false
  }
}

/** ===== 降级：系统浏览器打开下载地址 ===== */
async function openApkFallback(url: string): Promise<boolean> {
  const target = url || DEFAULT_APK_URL
  const strategies: Array<() => boolean> = [
    () => { try { window.open(target, '_system'); return true } catch { return false } },
    () => { try { window.open(target, '_blank'); return true } catch { return false } },
    () => { try { window.location.href = target; return true } catch { return false } },
  ]

  for (let attempt = 0; attempt < strategies.length; attempt++) {
    const ok = strategies[attempt]()
    if (ok) return true
    if (attempt < strategies.length - 1) {
      await new Promise((r) => setTimeout(r, 300))
    }
  }

  Toast.show({ content: '自动打开下载失败，请手动复制链接', position: 'bottom', duration: 2000 })
  try {
    await Dialog.alert({
      title: '📦 手动下载',
      content: `自动下载失败，请复制以下 URL 到浏览器访问：\n\n${target}`,
      confirmText: '复制链接',
      onConfirm: () => {
        navigator.clipboard?.writeText(target).then(() => {
          Toast.show({ content: '已复制到剪贴板', position: 'bottom' })
        }).catch(() => {
          Toast.show({ content: '复制失败，请手动长按选择', position: 'bottom' })
        })
      },
    })
  } catch { /* Dialog 被取消或不支持 */ }
  return false
}

export type UpdateCheckResult =
  | 'updated'      // 已触发更新流程（下载/安装）
  | 'up-to-date'   // 确实已是最新版本
  | 'cancelled'    // 用户点击“稍后”/取消
  | 'failed'       // 版本信息拉取或安装失败
  | 'unsupported'  // 非 Android 环境

/**
 * 检查并提示更新（唯一入口）
 * @param userInitiated 用户主动点击"检查更新"：忽略当天限流与"稍后"记忆，强制刷新服务端数据
 */
export async function checkAndPromptUpdate(userInitiated = false): Promise<UpdateCheckResult> {
  const isAndroid = /android/i.test(navigator.userAgent) ||
    (window as any).Capacitor?.getPlatform?.() === 'android'
  if (!isAndroid) return 'unsupported'

  const release = await fetchRelease(userInitiated)
  if (!release) return 'failed'
  if (!shouldUpdate(release)) return 'up-to-date'

  const skipKey = `${release.version}|${release.build}`
  if (!userInitiated) {
    if (!release.forceUpdate && localStorage.getItem(SKIP_KEY) === skipKey) return 'up-to-date'
    if (localStorage.getItem(PROMPT_DATE_KEY) === beijingDate()) return 'up-to-date'
  }
  localStorage.setItem(PROMPT_DATE_KEY, beijingDate())

  const notes = release.updateNotes ? `\n\n${release.updateNotes}` : ''
  const content = `当前 v${LOCAL_VERSION} · build${LOCAL_BUILD}\n最新 v${release.version} · build${release.build}${notes}`

  if (release.forceUpdate) {
    // 强制更新：只有"立即更新"一个按钮，不可取消
    await Dialog.alert({ title: '📦 必须更新', content, confirmText: '立即更新' })
  } else {
    const go = await Dialog.confirm({
      title: '📦 发现新版本',
      content,
      confirmText: '立即更新',
      cancelText: '稍后',
    })
    if (!go) {
      localStorage.setItem(SKIP_KEY, skipKey)
      return 'cancelled'
    }
  }

  let opened = await downloadAndInstallNative(release)
  if (!opened) opened = await openApkFallback(release.downloadUrl)
  return opened ? 'updated' : 'failed'
}
