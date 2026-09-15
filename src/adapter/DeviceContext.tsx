/**
 * 设备上下文 + Provider + Hook
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

function loadFromStorage(): DeviceConfig {
  try {
    const raw = localStorage.getItem(DEVICE_CONFIG_KEY)
    if (raw) return JSON.parse(raw) as DeviceConfig
  } catch {
    /* ignore */
  }
  return { type: 'phone', mode: 'auto' }
}

function persist(cfg: DeviceConfig) {
  try {
    localStorage.setItem(DEVICE_CONFIG_KEY, JSON.stringify(cfg))
  } catch {
    /* ignore */
  }
}

function resolveType(detected: DeviceInfo, config: DeviceConfig): DeviceType {
  if (config.mode === 'manual' && config.manualOverride) return config.manualOverride
  return detected.type
}

export const DeviceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [detected, setDetected] = useState<DeviceInfo>(() => detectDeviceType())
  const [config, setConfig] = useState<DeviceConfig>(() => loadFromStorage())

  // 自动模式下监听 resize / orientation change 重新检测
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => {
      const info = detectDeviceType()
      setDetected(info)
      if (config.mode === 'auto') setConfig((c) => ({ ...c, type: info.type }))
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [config.mode])

  const type = useMemo(() => resolveType(detected, config), [detected, config])

  const capability = useMemo(() => DEVICE_CAPABILITY[type], [type])

  const switchMode = useCallback((mode: DeviceMode) => {
    setConfig((c) => {
      const next: DeviceConfig = { ...c, mode, type: mode === 'auto' ? detected.type : (c.manualOverride ?? detected.type) }
      persist(next)
      return next
    })
  }, [detected])

  const setManualType = useCallback((t: DeviceType) => {
    setConfig((c) => {
      const next: DeviceConfig = { ...c, mode: 'manual', manualOverride: t, type: t }
      persist(next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    const info = detectDeviceType()
    setDetected(info)
    setConfig((c) => {
      const next: DeviceConfig = { ...c, mode: 'auto', manualOverride: undefined, type: info.type }
      persist(next)
      return next
    })
  }, [])

  const refresh = useCallback(() => {
    setConfig(loadFromStorage())
    setDetected(detectDeviceType())
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
