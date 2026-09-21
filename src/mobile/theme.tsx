/**
 * 移动端主题（P3.5：浅色 / 深色动态切换）
 *
 * 在 .mobile-app 容器上挂 data-theme 属性 + CSS 变量供 mobile.css 覆盖背景/文字色。
 */
import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { useMobileTheme, MobileThemeKey } from './hooks/useMobileTheme'
import { ConfigProvider as MobileConfigProvider } from 'antd-mobile'

/** 浅色主题 token（与 PC 端品牌色 #2196F3 一致） */
const lightTheme = {
  '--brand-color': '#2196F3',
  '--brand-color-fill': '#E3F2FD',
  '--brand-color-hover': '#1976D2',
  '--brand-color-active': '#1565C0',
  '--brand-color-warning': '#FF9800',
  '--brand-color-success': '#4CAF50',
  '--brand-color-danger': '#F44336',
  '--font-size': '16px',
  '--border-radius': '10px',
  '--border-radius-sm': '6px',
  '--safe-area-top': 'env(safe-area-inset-top, 0px)',
  '--safe-area-bottom': 'env(safe-area-inset-bottom, 0px)',
} as const

/** 深色主题 token：品牌色稍亮，配深色背景更和谐 */
const darkTheme = {
  '--brand-color': '#64B5F6',
  '--brand-color-fill': '#1E3A5F',
  '--brand-color-hover': '#90CAF9',
  '--brand-color-active': '#BBDEFB',
  '--brand-color-warning': '#FFB74D',
  '--brand-color-success': '#81C784',
  '--brand-color-danger': '#E57373',
  '--font-size': '16px',
  '--border-radius': '10px',
  '--border-radius-sm': '6px',
  '--safe-area-top': 'env(safe-area-inset-top, 0px)',
  '--safe-area-bottom': 'env(safe-area-inset-bottom, 0px)',
} as const

interface MobileThemeContextValue {
  theme: MobileThemeKey
  isDark: boolean
  changeTheme: (k: MobileThemeKey) => void
  toggleTheme: () => void
}

const MobileThemeContext = createContext<MobileThemeContextValue | null>(null)

export function MobileThemeProvider({ children }: { children: ReactNode }) {
  const { theme, isDark, changeTheme, toggleTheme } = useMobileTheme()
  const brandColor = isDark ? darkTheme['--brand-color'] : lightTheme['--brand-color']
  return (
    <MobileThemeContext.Provider value={{ theme, isDark, changeTheme, toggleTheme }}>
      <MobileConfigProvider theme={{ token: { colorPrimary: brandColor } }}>
        {children}
      </MobileConfigProvider>
    </MobileThemeContext.Provider>
  )
}

/** 在移动端任意子组件中读取/切换主题 */
export function useMobileThemeContext(): MobileThemeContextValue {
  const ctx = useContext(MobileThemeContext)
  if (!ctx) {
    // 静默降级：未挂载 Provider 时默认浅色，不崩
    return {
      theme: 'light',
      isDark: false,
      changeTheme: () => {},
      toggleTheme: () => {},
    }
  }
  return ctx
}

export { lightTheme as mobileTheme, lightTheme, darkTheme }
