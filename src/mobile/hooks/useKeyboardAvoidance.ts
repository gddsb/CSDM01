/**
 * useKeyboardAvoidance —— 全局挂一次，覆盖所有移动端页面的输入框键盘避让
 *
 * 业务背景：
 *   scrollTopMax = scrollHeight - clientHeight，输入框在列表底部时即使滚到尽头也推不动，
 *   因为 scrollHeight 不够大。解法是聚焦时给滚动容器加 keyboardInset + buffer 的 paddingBottom，
 *   把 scrollHeight 撑大，让最底部的输入框也能滚到键盘上方。
 *
 *   当前 MobileProcessReporting 已经有一套完整实现，但只挂在自己页面的 useEffect 里。
 *   当用户导航到 MicrobeInspection / SparePart / ExceptionReport 等独立页面时，
 *   MobileProcessReporting unmount → handler 全卸载 → 这些页面的输入框又被键盘遮挡。
 *
 *   把这套逻辑抽成 hook，在 MobileLayout 里全局挂一次，所有子页面共享。
 *
 * 覆盖范围（2 类滚动容器都支持）：
 *   - .mobile-page-scroll-list   （fixed-header 模式，有 sticky 子头 → stickyTabH=48）
 *   - .mobile-page-scrollable     （整页滚动模式，无 sticky → stickyTabH=0）
 *
 * 还原链路（OR，任一满足即还原）：
 *   ① focusout          —— 离开 INPUT 且同容器外
 *   ② keyboardDidHide   —— Capacitor Keyboard plugin 原生级（键盘一收必触发）
 *   ③ visualViewport 恢复基准高度 —— iOS/Safari 兜底
 *
 * 依赖：getKeyboardHeight() 来自 useKeyboardInset（三层降级：plugin → visualViewport → 0）
 */
import { useEffect } from 'react'
import { getKeyboardHeight } from './useKeyboardInset'

const TOP_PADDING = 12
const KEYBOARD_BUFFER = 20
const FALLBACK_PADDING = 320
const VV_RESTORE_THRESHOLD = 60
const FOCUS_DELAY_MS = 400

const INPUT_TAG_SET = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

export function useKeyboardAvoidance() {
  useEffect(() => {
    // —— 支持两种滚动容器 ——
    const findScrollList = (el: HTMLElement): HTMLElement | null =>
      el.closest<HTMLElement>('.mobile-page-scroll-list, .mobile-page-scrollable')

    const stickyTabHeightOf = (list: HTMLElement): number =>
      list.querySelector('.mobile-sticky-sub-header') ? 48 : 0

    // list → 原始 padding-bottom（WeakMap，不阻止 GC）
    const basePaddingRef = new WeakMap<HTMLElement, string>()
    // 当前被撑大过的所有 list（keyboardDidHide 兜底还原需要遍历）
    const modifiedLists: Set<HTMLElement> = new Set()

    const setKeyboardPadding = (list: HTMLElement, kbH: number) => {
      if (!basePaddingRef.has(list)) {
        basePaddingRef.set(list, list.style.paddingBottom || '')
      }
      const extra = Math.max(kbH, FALLBACK_PADDING) + KEYBOARD_BUFFER
      list.style.paddingBottom = `${extra}px`
      modifiedLists.add(list)
    }

    const restorePadding = (list: HTMLElement) => {
      const orig = basePaddingRef.get(list)
      if (orig !== undefined) {
        list.style.paddingBottom = orig || ''
        basePaddingRef.delete(list)
      }
      modifiedLists.delete(list)
    }

    const restoreAll = () => {
      modifiedLists.forEach(l => restorePadding(l))
      modifiedLists.clear()
    }

    const scrollElIntoSafeArea = (el: HTMLElement, list: HTMLElement) => {
      const stickyTabH = stickyTabHeightOf(list)
      const listRect = list.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()
      // el 在滚动容器内部的绝对 Y
      const relY = elRect.top - listRect.top + list.scrollTop
      const targetScroll = Math.max(0, relY - (stickyTabH + TOP_PADDING))
      const maxScroll = Math.max(0, list.scrollHeight - list.clientHeight)
      list.scrollTop = Math.min(targetScroll, maxScroll)
    }

    const focusHandler = (e: FocusEvent) => {
      const el = e.target as HTMLElement
      if (!el || !INPUT_TAG_SET.has(el.tagName)) return
      const list = findScrollList(el)
      if (!list) return
      setKeyboardPadding(list, getKeyboardHeight())
      setTimeout(() => scrollElIntoSafeArea(el, list), FOCUS_DELAY_MS)
    }

    const blurHandler = (e: FocusEvent) => {
      const el = e.target as HTMLElement
      if (!el || !INPUT_TAG_SET.has(el.tagName)) return
      const next = (e as FocusEvent).relatedTarget as HTMLElement | null
      // 同容器内切换焦点（比如数量 input → 单位 select）→ 保持 padding 撑大状态，避免抖动
      if (next && findScrollList(next) === findScrollList(el)) return
      const list = findScrollList(el)
      if (list) restorePadding(list)
    }

    document.addEventListener('focusin', focusHandler)
    document.addEventListener('focusout', blurHandler)

    // —— 兜底还原 ①：Capacitor Keyboard plugin keyboardDidHide ——
    let kbHandle: { remove: () => void } | null = null
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Keyboard } = require('@capacitor/keyboard')
      Keyboard.addListener('keyboardDidHide', () => restoreAll()).then(
        (h: { remove: () => void }) => { kbHandle = h },
        () => { /* 旧版 plugin 可能返回 undefined */ }
      )
    } catch { /* 纯浏览器环境（vite dev server）下 module 不存在 */ }

    // —— 兜底还原 ②：visualViewport 恢复到基准高度附近（iOS/Safari）——
    let origVVH = window.innerHeight
    const vv = window.visualViewport
    const vvResizeHandler = () => {
      if (vv && vv.height >= origVVH - VV_RESTORE_THRESHOLD) restoreAll()
    }
    if (vv) vv.addEventListener('resize', vvResizeHandler)

    // 旋转屏幕时重置基准高度
    const orientHandler = () => { origVVH = window.innerHeight }
    window.addEventListener('orientationchange', orientHandler)

    return () => {
      document.removeEventListener('focusin', focusHandler)
      document.removeEventListener('focusout', blurHandler)
      if (kbHandle) { try { kbHandle.remove() } catch { /* noop */ } }
      if (vv) vv.removeEventListener('resize', vvResizeHandler)
      window.removeEventListener('orientationchange', orientHandler)
    }
  }, [])
}
