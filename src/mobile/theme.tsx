/**
 * 移动端主题
 *
 * 【UI 重构 2026-11-07】合并两套 token 体系 + antd-mobile v5 适配：
 *   - --brand-* / --m-* 变量唯一定义在 mobile.css 的 .mobile-app 上
 *   - antd-mobile v5 通过 --adm-color-primary CSS 变量主题化（mobile.css 里已映射）
 *   - ConfigProvider 不接受 theme prop（仅 locale + 组件 icon 自定义），删除旧的 theme={{ token }}
 *   - 默认深色主打（detectSystemTheme 返回 dark）
 */
import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { useMobileTheme, MobileThemeKey } from './hooks/useMobileTheme'
import { ConfigProvider as MobileConfigProvider } from 'antd-mobile'

interface MobileThemeContextValue {
  theme: MobileThemeKey
  isDark: boolean
  changeTheme: (k: MobileThemeKey) => void
  toggleTheme: () => void
}

const MobileThemeContext = createContext<MobileThemeContextValue | null>(null)

export function MobileThemeProvider({ children }: { children: ReactNode }) {
  const { theme, isDark, changeTheme, toggleTheme } = useMobileTheme()
  // antd-mobile v5 组件通过 --adm-color-primary 自动读 mobile.css 里的 CSS 变量
  // ConfigProvider 仅保留基础上下文（无 theme prop —— v5 不支持）
  void isDark // 主题切换时 MobileThemeProvider 重渲染，保证消费者拿到最新值
  return (
    <MobileThemeContext.Provider value={{ theme, isDark, changeTheme, toggleTheme }}>
      <MobileConfigProvider>
        {children}
      </MobileConfigProvider>
    </MobileThemeContext.Provider>
  )
}

/** 在移动端任意子组件中读取/切换主题 */
export function useMobileThemeContext(): MobileThemeContextValue {
  const ctx = useContext(MobileThemeContext)
  if (!ctx) {
    return {
      theme: 'dark', /* 静默降级也用深色（默认主打） */
      isDark: true,
      changeTheme: () => {},
      toggleTheme: () => {},
    }
  }
  return ctx
}
