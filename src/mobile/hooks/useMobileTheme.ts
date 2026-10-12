/**
 * 移动端主题切换 hook（P3.5）
 *
 * 行为：
 * 1. 首次进入读取 localStorage('mes_mobile_theme')，未设置时跟随系统 prefers-color-scheme
 * 2. 切换后写入 localStorage，并同步设置 <html data-theme="dark|light"> 供 CSS 覆盖
 * 3. 监听系统主题变化（仅当用户未手动设置过时跟随）
 *
 * 设计目标：让夜班/暗光环境下长时间使用移动端不刺眼。
 */
import { useCallback, useEffect, useState } from 'react'

export type MobileThemeKey = 'light' | 'dark'

const STORAGE_KEY = 'mes_mobile_theme'

function detectSystemTheme(): MobileThemeKey {
  // 移动端 APP 安装后默认浅色，不跟随系统 prefers-color-scheme（避免用户手机系统深色导致 APP 默认深色）
  return 'light'
}

function readStoredTheme(): MobileThemeKey | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch { /* 隐私模式禁用 localStorage */ }
  return null
}

function applyTheme(key: MobileThemeKey) {
  const html = document.documentElement
  html.setAttribute('data-theme', key)
  // 同时设置 color-scheme 让浏览器原生控件（滚动条/输入框）也走深色
  html.style.colorScheme = key
}

export function useMobileTheme() {
  // 初始值：用户已选 > 系统偏好
  const [theme, setTheme] = useState<MobileThemeKey>(() => {
    const stored = readStoredTheme()
    return stored || detectSystemTheme()
  })

  // 应用到 <html>
  useEffect(() => {
    applyTheme(theme)
    // 注意：不再监听系统主题变化 — APP 默认浅色，用户切换后持久化存储
  }, [theme])

  const changeTheme = useCallback((key: MobileThemeKey) => {
    setTheme(key)
    try { localStorage.setItem(STORAGE_KEY, key) } catch { /* 静默降级 */ }
    applyTheme(key)
  }, [])

  const toggleTheme = useCallback(() => {
    changeTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, changeTheme])

  return { theme, changeTheme, toggleTheme, isDark: theme === 'dark' }
}
