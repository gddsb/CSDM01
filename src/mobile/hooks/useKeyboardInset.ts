/**
 * useKeyboardInset —— 软键盘弹起后返回遮挡高度（px）
 *
 * 三层优先级（从准到糙）：
 *   1. Capacitor Keyboard plugin（原生级，给确切 keyboardHeight，Android+iOS 都可用）
 *   2. visualViewport 高度差值（iOS Safari 原生支持；Android Chrome adjustResize 可用）
 *   3. 返回 0 —— 调用方自行用固定值兜底（如 320px）
 *
 * 业务方为什么需要这个值：
 *   滚动容器的 scrollTopMax = scrollHeight - clientHeight，当编辑记录在列表底部时，
 *   即使滚到 max 也推不动输入框。把 keyboardInset + 缓冲加到 padding-bottom 上，
 *   就能撑开滚动空间，让最底部的输入框也能滚到键盘上方。
 *
 * 资源管理：所有监听 + 定时器严格在 unmount 时成对清理。
 */
import { useEffect, useRef, useState } from 'react'

const VV_THRESHOLD = 80         // 过滤 iOS 地址栏伸缩（~40px）导致的 fake 键盘
const REBASE_DELAY_MS = 300     // orientationchange 后重算基准的延迟（等旋转动画收尾）
const MAX_REASONABLE_INSET = 400 // 保护：插件/visualViewport 偶发脏值不超过此上限

// Capacitor Keyboard plugin 是动态 import（可能未安装），用 any 兜底避免 ts 报模块不存在
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let KeyboardPlugin: any = null
try {
  // 仅在 Capacitor runtime（WebView）里有值；纯浏览器（vite dev server）里 throw → catch
  const mod = require('@capacitor/keyboard')
  KeyboardPlugin = mod?.Keyboard ?? null
} catch { /* pure browser — 不接 plugin，下面的 getInset 会自动走 visualViewport 分支 */ }

export function useKeyboardInset() {
  const [inset, setInset] = useState(0)
  const baseHeightRef = useRef<number>(0)
  const rebaseTimerRef = useRef<number | null>(null)
  const pluginHandleRef = useRef<{ remove: () => void } | null>(null)

  useEffect(() => {
    // 初始化基准高度（此时键盘必然没弹起）
    baseHeightRef.current = window.innerHeight

    // —— 优先级 1：Capacitor Keyboard plugin ——
    if (KeyboardPlugin && typeof KeyboardPlugin.addListener === 'function') {
      let mounted = true
      KeyboardPlugin.addListener('keyboardDidShow', (info: { keyboardHeight: number }) => {
        if (!mounted) return
        const h = info?.keyboardHeight || 0
        const clamped = Math.min(h, MAX_REASONABLE_INSET)
        setInset(Math.round(clamped))
      }).then((handle: { remove: () => void }) => {
        pluginHandleRef.current = handle
      }).catch(() => { /* 某些旧版 plugin 返回 undefined */ })

      KeyboardPlugin.addListener('keyboardDidHide', () => {
        setInset(0)
      })

      return () => {
        mounted = false
        if (pluginHandleRef.current) {
          try { pluginHandleRef.current.remove() } catch { /* noop */ }
          pluginHandleRef.current = null
        }
      }
    }

    // —— 优先级 2：visualViewport 差值 ——
    const compute = () => {
      const vv = window.visualViewport
      if (!vv) return
      const base = baseHeightRef.current || window.innerHeight
      const raw = base - vv.height + (vv.offsetTop || 0)
      if (raw > VV_THRESHOLD) {
        setInset(Math.round(Math.min(raw, MAX_REASONABLE_INSET)))
      } else {
        setInset(0)
      }
    }

    const handleRebase = () => {
      if (rebaseTimerRef.current) window.clearTimeout(rebaseTimerRef.current)
      rebaseTimerRef.current = window.setTimeout(() => {
        baseHeightRef.current = window.innerHeight
        setInset(0)
        compute()
      }, REBASE_DELAY_MS)
    }

    const vv = window.visualViewport
    if (vv) {
      vv.addEventListener('resize', compute)
      vv.addEventListener('scroll', compute)
    }
    window.addEventListener('resize', compute)
    window.addEventListener('orientationchange', handleRebase)

    const raf = window.requestAnimationFrame?.(compute)

    return () => {
      if (vv) {
        vv.removeEventListener('resize', compute)
        vv.removeEventListener('scroll', compute)
      }
      window.removeEventListener('resize', compute)
      window.removeEventListener('orientationchange', handleRebase)
      if (rebaseTimerRef.current) window.clearTimeout(rebaseTimerRef.current)
      if (raf && window.cancelAnimationFrame) window.cancelAnimationFrame(raf)
    }
  }, [])

  return inset
}

/**
 * 键盘高度获取器（用于 focusin handler 里，每次聚焦时取最新值）
 * 独立于 hook，因为 focusin handler 是全局 document 监听，不在 React render 周期内。
 */
export function getKeyboardHeight(): number {
  // 1) Keyboard plugin（如果加载了）
  if (KeyboardPlugin && typeof KeyboardPlugin.getKeyboardHeight === 'function') {
    try {
      // getKeyboardHeight 是同步 API（v6+），返回像素数；旧版可能不存在
      const h = KeyboardPlugin.getKeyboardHeight()
      if (typeof h === 'number' && h > 0) return Math.min(h, MAX_REASONABLE_INSET)
    } catch { /* noop */ }
  }
  // 2) visualViewport 差值
  const vv = window.visualViewport
  if (vv) {
    const base = window.innerHeight
    const raw = base - vv.height + (vv.offsetTop || 0)
    if (raw > VV_THRESHOLD) return Math.round(Math.min(raw, MAX_REASONABLE_INSET))
  }
  return 0
}
