/**
 * 设备自动识别器
 *
 * 优先级（递减）:
 *  1. Android TV / Leanback UA → tv
 *  2. 宽度 ≥ 1200px（桌面浏览器调试）→ tablet
 *  3. 宽度 ≥ 768px 且非 mobile UA → tablet
 *  4. UA 包含手持设备特征（PDA/手持终端关键词）→ pda
 *  5. 宽度在 480~768px → phone
 *  6. 宽度 < 480px → phone
 *  7. 兜底 → phone（弹出手动选择弹窗）
 *
 * 注意：Android TV 在 WebView 环境下 Capacitor Device API
 * 会给出更精确的 platform 信息，这里做两层降级：
 *   try { Capacitor Device.getInfo() } → catch → 走纯 Web heuristic
 */
import type { DeviceType, DeviceInfo } from './types'

const PDA_KEYWORDS = [
  'pda', 'handheld', 'hht', 'barcode', 'scan', 'termi',
  'cipherlab', 'keyence', 'honeywell', 'zebra', 'samsung-handheld',
  'datalogic', 'intermec', 'motorola', 'rugged',
]

const TV_KEYWORDS = ['android tv', 'leanback', 'atv', 'androidtv', 'bigscreen', 'smarttv']

const TABLET_WIDTH_MIN = 768
const PHONE_WIDTH_MIN = 480

function detectPlatform(ua: string): 'android' | 'ios' | 'web' | 'unknown' {
  const lower = ua.toLowerCase()
  if (/android/.test(lower)) return 'android'
  if (/iphone|ipad|ipod/.test(lower)) return 'ios'
  if (/mac|windows|linux|cros/.test(lower)) return 'web'
  return 'unknown'
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

  // 1. TV / Leanback
  if (TV_KEYWORDS.some((k) => ua.includes(k))) {
    type = 'tv'
  }
  // 2. PC 桌面浏览器（Web platform + 宽屏 + 非移动端 UA）
  else if (platform === 'web' && width >= 1024 && !/mobile|phone|android|iphone|ipad|ipod/.test(ua)) {
    type = 'pc'
  }
  // 3. 宽屏 tablet（桌面浏览器调试常见）
  else if (width >= 1200 && platform === 'web') {
    type = 'tablet'
  }
  // 4. 常规 tablet（Android tablet / iPad）
  else if (width >= TABLET_WIDTH_MIN && !/mobile|phone/.test(ua)) {
    type = 'tablet'
  }
  // 5. PDA 关键词
  else if (PDA_KEYWORDS.some((k) => ua.includes(k))) {
    type = 'pda'
  }
  // 6. 工业 PDA 启发式：Android + 中等宽度 + 较高 DPI
  else if (platform === 'android' && width >= 360 && width <= 600 && dpr >= 2.5) {
    type = 'pda'
  }
  // 7. Phone
  else if (width < PHONE_WIDTH_MIN || /mobile|phone/.test(ua)) {
    type = 'phone'
  }
  // 8. 兜底（小屏 web → phone）
  else {
    type = 'phone'
  }

  return { type, width, height, dpr, ua, platform }
}
