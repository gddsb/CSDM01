/**
 * 设备类型枚举
 * - auto 模式下 DeviceDetector 会自动判定为以下四种之一
 * - manual 模式下用户可手动锁定
 */
export type DeviceType = 'phone' | 'pda' | 'tablet' | 'tv' | 'pc'

export type DeviceMode = 'auto' | 'manual'

export interface DeviceCapability {
  /** 支持扫码 */
  barcode: boolean
  /** 支持硬件按键 */
  hardwareKeys: boolean
  /** 支持遥控器焦点导航 */
  tvRemote: boolean
  /** 支持离线提交 */
  offlineSubmit: boolean
  /** 是否允许业务操作（TV 端为 false，仅纯展示） */
  interactive: boolean
  /** 是否需要跳过登录（TV 大屏直接展示） */
  skipLogin: boolean
  /** 是否隐藏系统管理/自动任务入口 */
  hideSystemAdmin: boolean
}

export interface DeviceConfig {
  type: DeviceType
  mode: DeviceMode
  /** 用户上次手动选定的设备类型（manual 模式使用） */
  manualOverride?: DeviceType
}

export interface DeviceInfo {
  type: DeviceType
  width: number
  height: number
  dpr: number
  ua: string
  platform: 'android' | 'ios' | 'web' | 'unknown'
}

/** 每种设备的默认能力 */
export const DEVICE_CAPABILITY: Record<DeviceType, DeviceCapability> = {
  phone: {
    barcode: false,
    hardwareKeys: false,
    tvRemote: false,
    offlineSubmit: true,
    interactive: true,
    skipLogin: false,
    hideSystemAdmin: true,
  },
  pda: {
    barcode: true,
    hardwareKeys: true,
    tvRemote: false,
    offlineSubmit: true,
    interactive: true,
    skipLogin: false,
    hideSystemAdmin: true,
  },
  tablet: {
    barcode: false,
    hardwareKeys: false,
    tvRemote: false,
    offlineSubmit: true,
    interactive: true,
    skipLogin: false,
    hideSystemAdmin: true,
  },
  pc: {
    barcode: false,
    hardwareKeys: false,
    tvRemote: false,
    offlineSubmit: false,
    interactive: true,
    skipLogin: false,
    hideSystemAdmin: false,
  },
  tv: {
    barcode: false,
    hardwareKeys: false,
    tvRemote: true,
    offlineSubmit: true,
    interactive: false,
    skipLogin: true,
    hideSystemAdmin: true,
  },
}

/** localStorage key */
export const DEVICE_CONFIG_KEY = 'mcm:device-config'

/** 移动端需要屏蔽的路由前缀 */
export const BLOCKED_ROUTE_PREFIXES = ['/system', '/auto', '/settings'] as const
