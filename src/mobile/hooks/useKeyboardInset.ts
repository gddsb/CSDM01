/**
 * useKeyboardInset —— 软键盘弹起后返回遮挡高度（px）
 *
 * 业务背景：Capacitor Android 走 adjustPan 时，软键盘弹起不会让 WebView 变矮，
 * 浏览器可视视口只是被整体上移了 K 像素；adjustResize 虽然让 WebView 变矮，
 * 但 dvh 锁死了外层容器高度 → 滚动容器的 scrollTop 基准仍错位。
 *
 * 本 hook 用 visualViewport 差值（不拍脑袋固定像素）精准算出 K 值，
 * 业务页把 K 当 paddingBottom 加到滚动容器上，scrollIntoView 才真正可见。
 *
 * 兼容性：
 *   - iOS Safari / Capacitor iOS → visualViewport 有值 ✅
 *   - Android Chrome / Capacitor（adjustPan）→ visualViewport 有值 ✅
 *   - 极老浏览器（无 visualViewport）→ 降级返回 0，组件用 scrollIntoView 裸滚兜底
 *
 * 资源管理：所有监听 + 定时器严格在 unmount 时成对清理，避免内存泄漏。
 */
import { useEffect, useRef, useState } from 'react'

/** 最小阈值（px）：过滤 iOS 地址栏伸缩（约 40px）导致的 fake 键盘 */
const KEYBOARD_THRESHOLD = 80

/** orientationchange 后重新校准基准高度的延迟（等旋转动画收尾） */
const REBASE_DELAY_MS = 300

export function useKeyboardInset() {
  const [inset, setInset] = useState(0)
  const baseHeightRef = useRef<number>(0)
  const rebaseTimerRef = useRef<number | null>(null)

  useEffect(() => {
    // 初始化基准高度（此时键盘必然没弹起）
    baseHeightRef.current = window.innerHeight

    const compute = () => {
      const vv = window.visualViewport
      if (!vv) return
      const current = vv.height
      const base = baseHeightRef.current || window.innerHeight
      // 差值 = 基准 - 当前 vv 高；offsetTop 修正（iOS 偶尔有）
      const raw = base - current + (vv.offsetTop || 0)
      const next = raw > KEYBOARD_THRESHOLD ? raw : 0
      if (next !== inset) setInset(Math.round(next))
    }

    const handleRebase = () => {
      // 旋转屏幕时重置基准（横屏高度本来就小，不能和竖屏基准比）
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

    // 首帧算一次（防止页面在键盘弹起后才 mount）
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return inset
}
