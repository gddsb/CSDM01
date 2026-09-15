/**
 * 移动端主题
 * antd-mobile ConfigProvider 主题 token
 * 品牌色 #2196F3 与 PC 端保持一致
 */
import { ConfigProvider } from 'antd-mobile'
import type { ReactNode } from 'react'

const mobileTheme = {
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

export function MobileThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider theme={mobileTheme}>
      {children}
    </ConfigProvider>
  )
}

export { mobileTheme }
