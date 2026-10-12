/**
 * 设备自动识别器（v2 — 修复 PC 被误判）
 *
 * 核心设计：**先看 platform，再看宽度/UA**
 *   platform === 'web'   → 一定是 PC 浏览器（不管宽度、不管 UA 关键词）
 *   platform === 'android'|'ios' → 才走移动端三档（tablet → pda → phone）
 *   platform === 'unknown' → 兜底 phone
 *
 * 为什么这样改：
 *   旧版 UA 排除列表 `!/mobile|phone|android|iphone|ipad|ipod/.test(ua)` 会误伤：
 *   比如 PC Chrome 开了移动模拟后忘了关，UA 里还留着 "Mobile" 关键字 → 被漏掉 PC 分支
 *   → 落到 tablet/phone 分支 → PC 用户被迫看移动端 UI
 *
 * 优先级（递减）:
 *   1. Android TV / Leanback UA → tv
 *   2. PC 浏览器（platform === 'web'）→ pc
 *   3. 壳内宽屏（android/ios + width >= 768）→ tablet
 *   4. PDA 关键词 / 工业 PDA 启发式 → pda
 *   5. 常规手机 → phone
 *   6. 兜底 → phone
 */
import type { DeviceType, DeviceInfo } from './types'

const PDA_KEYWORDS = [
  'pda', 'handheld', 'hht', 'barcode', 'scan', 'termi',
  'cipherlab', 'keyence', 'honeywell', 'zebra', 'samsung-handheld',
  'datalogic', 'intermec', 'motorola', 'rugged',
]

const TV_KEYWORDS = ['android tv', 'leanback', 'atv', 'androidtv', 'bigscreen', 'smarttv']

const TABLET_WIDTH_MIN = 768

function detectPlatform(ua: string): 'android' | 'ios' | 'web' | 'unknown' {
  const lower = ua.toLowerCase()
  if (/android/.test(lower)) return 'android'
  if (/iphone|ipad|ipod/.test(lower)) return 'ios'
  // Windows / Mac / Linux / ChromeOS → 纯浏览器 Web 平台
  if (/windows|mac os x|linux|cros|x11/.test(lower)) return 'web'
  return 'unknown'
}

/**
 * 判断是否运行在 Capacitor **原生壳内**（Android APK / iOS IPA）
 *
 * ⚠️ 为什么不用 `!!window.Capacitor` 做判定：
 *   Vite + Capacitor 打包时，`@capacitor/core` 会把 `window.Capacitor` 对象注入到
 *   JS bundle 里 —— 不管跑在 Web 还是原生壳！所以 `!!window.Capacitor` 在纯 PC
 *   浏览器里也返回 true，这就是之前 PC 被误判跳到 /m/dashboard 的根因。
 *
 * 正确判定：`window.Capacitor.isNativePlatform() === true`
 *   - Web 环境：isNativePlatform() 返回 false，getPlatform() 返回 "web"
 *   - 原生壳内：isNativePlatform() 返回 true，getPlatform() 返回 "android"/"ios"
 *
 * UA 兜底：壳内某些早期版本 isNativePlatform 可能不可用，此时 UA 含 "Capacitor"
 *
 * 本函数已统一 export 到 adapter/index，路由判定、扫码、版本检测都用这一个。
 */
export function isInNativeShell(): boolean {
  if (typeof window === 'undefined') return false
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  if (cap && typeof cap.isNativePlatform === 'function') {
    return cap.isNativePlatform() === true
  }
  // UA 兜底（某些壳内版本 isNativePlatform 可能不可用）
  if (typeof navigator !== 'undefined' && /capacitor/i.test(navigator.userAgent)) {
    return true
  }
  return false
}

function getCapacitorDeviceInfo(): Partial<DeviceInfo> | null {
  try {
    // 运行在 Capacitor 壳内时可读取原生 API
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Device } = require('@capacitor/device')
    const info = Device.getInfo()
    if (!info) return null
    const { identifier, model, operatingSystem, osVersion, manufacturer } = info
    const ua = `${identifier} ${model || ''} ${operatingSystem || ''} ${osVersion || ''} ${manufacturer || ''}`
    const platform = operatingSystem?.toLowerCase().includes('android') ? 'android' : 'unknown'
    return { ua: ua.toLowerCase(), platform }
  } catch {
    return null
  }
}

export function detectDeviceType(): DeviceInfo {
  // 优先尝试 Capacitor 原生 API
  const capInfo = getCapacitorDeviceInfo()

  const width = typeof window !== 'undefined' ? window.innerWidth : 375
  const height = typeof window !== 'undefined' ? window.innerHeight : 667
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  const ua = capInfo?.ua || (typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '')
  const platform = capInfo?.platform || detectPlatform(ua)

  let type: DeviceType

  // 1. TV / Leanback（最高优先级，TV 大屏必须单独路由）
  if (TV_KEYWORDS.some((k) => ua.includes(k))) {
    type = 'tv'
  }
  // 2. PC 浏览器（Web 平台 → 一定是 PC，不管宽度！）
  //    Chrome DevTools 移动模拟也改变不了 platform，所以不会误判
  else if (platform === 'web') {
    type = 'pc'
  }
  // 3. 壳内宽屏 tablet（Android tablet / iPad）
  else if (width >= TABLET_WIDTH_MIN) {
    type = 'tablet'
  }
  // 4. PDA 关键词命中（手持终端）
  else if (PDA_KEYWORDS.some((k) => ua.includes(k))) {
    type = 'pda'
  }
  // 5. 工业 PDA 启发式：Android + 中等宽度 + 较高 DPI
  else if (platform === 'android' && width >= 360 && width <= 600 && dpr >= 2.5) {
    type = 'pda'
  }
  // 6. 常规手机（剩下的壳内小屏）
  else {
    type = 'phone'
  }

  return { type, width, height, dpr, ua, platform }
}
