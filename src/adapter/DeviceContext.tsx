/**
 * 设备上下文 + Provider + Hook
 *
 * v2 — 修复 localStorage 脏缓存导致 PC 被误判的三个 bug：
 *   Bug1: loadFromStorage() 兜底硬编码 phone → 改成 detectDeviceType() 实时检测
 *   Bug2: localStorage 存了 manualOverride='phone' 后，platform 变了（用户换 PC）
 *         也不漂移检测 → 加平台漂移检测：detect.platform=web 且 manualOverride!=pc → reset auto
 *   Bug3: 没有版本号机制，旧缓存永远生效 → 加 CONFIG_VERSION=2，低版本自动 reset
 *
 * 用法：
 *   <DeviceProvider>
 *     <App />
 *   </DeviceProvider>
 *
 *   const { device, config, setManualType, switchMode } = useDevice()
 */
import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import type { DeviceConfig, DeviceInfo, DeviceMode, DeviceType } from './types'
import { DEVICE_CAPABILITY, DEVICE_CONFIG_KEY } from './types'
import { detectDeviceType } from './deviceDetector'

interface DeviceContextValue {
  /** 当前生效的设备类型（final，经过 mode + override 解析） */
  type: DeviceType
  /** 自动识别结果（仅 auto 模式下有意义） */
  detected: DeviceInfo
  /** 当前配置 */
  config: DeviceConfig
  /** 能力映射（barcode / tvRemote / interactive ...） */
  capability: (typeof DEVICE_CAPABILITY)[DeviceType]
  /** 手动切换模式/类型 */
  switchMode: (mode: DeviceMode) => void
  setManualType: (t: DeviceType) => void
  /** 重置为自动识别 */
  reset: () => void
  /** 从 localStorage 强制重新读取 */
  refresh: () => void
}

const DeviceContext = createContext<DeviceContextValue | null>(null)

/** 缓存版本号 —— 每次 DeviceConfig 结构或 drift 规则变了就 +1，自动清旧缓存 */
const CONFIG_VERSION = 2

/** localStorage 的 DeviceConfig 增强版（带版本号） */
interface StoredConfig extends DeviceConfig {
  _v?: number
}

/**
 * 从 localStorage 加载配置，**三重防误判**：
 *   1. 版本号检查 —— 旧版本直接丢
 *   2. 平台漂移检测 —— manualOverride 是移动端但 detect 结果是 PC Web → reset
 *   3. 兜底动态化 —— 永远基于 detectDeviceType()，不硬编码 phone
 */
function loadFromStorage(): DeviceConfig {
  const detected = detectDeviceType()
  const defaultCfg: DeviceConfig = { type: detected.type, mode: 'auto' }

  try {
    const raw = localStorage.getItem(DEVICE_CONFIG_KEY)
    if (!raw) return defaultCfg
    const stored: StoredConfig = JSON.parse(raw)

    // 版本号落后 → 强制 reset（结构/漂移规则变了）
    if ((stored._v ?? 0) < CONFIG_VERSION) {
      console.warn('[Device] 缓存版本落后，重置', { storedV: stored._v, current: CONFIG_VERSION })
      return defaultCfg
    }

    // 平台漂移检测（PC 场景最关键的防线！）
    // 用户之前用手机/F12模拟存了 manualOverride='phone'，现在用 PC 浏览器打开
    // detect.platform === 'web' → 一定是 PC → 忽略手机缓存，强制 reset
    if (stored.mode === 'manual' && stored.manualOverride) {
      const isManualMobile = stored.manualOverride === 'phone' || stored.manualOverride === 'pda' || stored.manualOverride === 'tablet'
      const detectPc = detected.platform === 'web'
      if (isManualMobile && detectPc) {
        console.warn('[Device] 平台漂移：缓存是手动移动端，但检测到 PC Web → reset auto', {
          cached: stored.manualOverride,
          detected: detected.type,
          platform: detected.platform,
        })
        return defaultCfg
      }
    }

    // auto 模式：type 也跟 detect 结果对齐（handle resize 或首次进入）
    if (stored.mode === 'auto') {
      return { type: detected.type, mode: 'auto' }
    }

    // manual 模式且不是冲突场景：原样返回（保留用户手动选择）
    return { type: stored.type, mode: stored.mode, manualOverride: stored.manualOverride }
  } catch {
    console.warn('[Device] localStorage 解析失败，使用默认配置')
    return defaultCfg
  }
}

function persist(cfg: DeviceConfig) {
  try {
    const withVersion: StoredConfig = { ...cfg, _v: CONFIG_VERSION }
    localStorage.setItem(DEVICE_CONFIG_KEY, JSON.stringify(withVersion))
  } catch {
    /* ignore */
  }
}

function resolveType(detected: DeviceInfo, config: DeviceConfig): DeviceType {
  if (config.mode === 'manual' && config.manualOverride) return config.manualOverride
  return detected.type
}

export const DeviceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [detected] = useState<DeviceInfo>(() => detectDeviceType())
  const [config, setConfig] = useState<DeviceConfig>(() => loadFromStorage())

  // 启动日志 —— 真机/浏览器控制台可见，方便排查
  useEffect(() => {
    const finalType = resolveType(detected, config)
    console.log('[Device] init', {
      finalType,
      detected: detected.type,
      platform: detected.platform,
      width: detected.width,
      config: { ...config },
      ua: detected.ua?.slice(0, 80),
    })
  }, [detected, config])

  // 自动模式下监听 resize 重新检测（PC 浏览器缩放窗口场景）
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => {
      if (config.mode !== 'auto') return
      const info = detectDeviceType()
      // platform 漂移（PC ↔ Mobile）时强制 reset，防止 F12 模拟残留
      if (info.platform !== detected.platform) {
        console.info('[Device] 平台漂移 resize', { from: detected.platform, to: info.platform, newType: info.type })
        setConfig(() => ({ type: info.type, mode: 'auto' }))
      } else {
        setConfig((c) => ({ ...c, type: info.type }))
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [config.mode, detected.platform])

  const type = useMemo(() => resolveType(detected, config), [detected, config])

  const capability = useMemo(() => DEVICE_CAPABILITY[type], [type])

  const switchMode = useCallback((mode: DeviceMode) => {
    const info = detectDeviceType()
    setConfig((c) => {
      const next: DeviceConfig = { ...c, mode, type: mode === 'auto' ? info.type : (c.manualOverride ?? info.type) }
      persist(next)
      return next
    })
  }, [])

  const setManualType = useCallback((t: DeviceType) => {
    setConfig((c) => {
      const next: DeviceConfig = { ...c, mode: 'manual', manualOverride: t, type: t }
      persist(next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    const info = detectDeviceType()
    setConfig(() => {
      const next: DeviceConfig = { mode: 'auto', type: info.type }
      persist(next)
      return next
    })
  }, [])

  const refresh = useCallback(() => {
    const info = detectDeviceType()
    const cfg = loadFromStorage()
    // detect 用最新；config 已内置漂移检测（loadFromStorage 里调了 detect）
    setConfig(cfg)
    void info // detected 是稳定状态不用改
  }, [])

  const value: DeviceContextValue = useMemo(
    () => ({ type, detected, config, capability, switchMode, setManualType, reset, refresh }),
    [type, detected, config, capability, switchMode, setManualType, reset, refresh]
  )

  return React.createElement(DeviceContext.Provider, { value }, children)
}

export function useDevice(): DeviceContextValue {
  const ctx = React.useContext(DeviceContext)
  if (!ctx) throw new Error('useDevice must be used within <DeviceProvider>')
  return ctx
}
