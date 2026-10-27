/**
 * useKeyboardAvoidance —— 全局挂一次，覆盖所有移动端页面的输入框键盘避让
 *
 * 业务背景：
 *   scrollTopMax = scrollHeight - clientHeight，输入框在列表底部时即使滚到尽头也推不动，
 *   因为 scrollHeight 不够大。解法是聚焦时给滚动容器加 keyboardInset + buffer 的 paddingBottom，
 *   把 scrollHeight 撑大，让最底部的输入框也能滚到键盘上方。
 *
 * 覆盖范围（3 层滚动容器）：
 *   1) .mobile-page-scroll-list / .mobile-page-scrollable   （普通页面根容器）
 *   2) .adm-dialog-content / .adm-modal-content / .adm-popup （antd-mobile 弹层根，portal 到 body）
 *   3) 最近的 overflow:auto / scroll 祖先                     （Dialog 里手动加 maxHeight+overflow）
 *
 *   不覆盖的 → findScrollList 返回 null → focusHandler 直接 return（安全降级）
 *   例如 NavBar 上的搜索框（absolute/fixed，没有滚动容器），这种场景 adjustResize 本身能处理。
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
    // —— 3 层滚动容器查找 ——
    const findScrollList = (el: HTMLElement): HTMLElement | null => {
      // 1) 普通页面根容器
      const pageList = el.closest<HTMLElement>(
        '.mobile-page-scroll-list, .mobile-page-scrollable'
      )
      if (pageList) return pageList

      // 2) antd-mobile 弹层（Dialog/Modal/Popup portal 到 body 下，closest 找不到页面祖先）
      const portalRoot = el.closest<HTMLElement>(
        '.adm-dialog-content, .adm-modal-content, .adm-popup, .adm-popup-body'
      )
      if (portalRoot) return portalRoot

      // 3) 弹层内手动 overflow:auto 的祖先（Dialog 里 maxHeight:70vh + overflow:auto）
      let node: HTMLElement | null = el.parentElement
      while (node) {
        const st = window.getComputedStyle(node)
        const ov = (st.overflowY || st.overflow || '').toLowerCase()
        if (ov === 'auto' || ov === 'scroll') return node
        node = node.parentElement
      }

      return null
    }

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
      const relY = elRect.top - listRect.top + list.scrollTop
      const targetScroll = Math.max(0, relY - (stickyTabH + TOP_PADDING))
      const maxScroll = Math.max(0, list.scrollHeight - list.clientHeight)
      list.scrollTop = Math.min(targetScroll, maxScroll)
    }

    const focusHandler = (e: FocusEvent) => {
      const el = e.target as HTMLElement
      if (!el || !INPUT_TAG_SET.has(el.tagName)) return
      const list = findScrollList(el)
      if (!list) return  // NavBar/TabBar 上的 input（无滚动容器）→ 跳过，adjustResize 兜底
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
      if (list) {
        restorePadding(list)
        // Android 兜底：物理键收起键盘时 blur 可能先到但键盘还没完全收，50ms 后再检查
        setTimeout(() => {
          const active = document.activeElement as HTMLElement | null
          if (!active || !INPUT_TAG_SET.has(active.tagName)) {
            const list2 = findScrollList(el)
            if (list2) restorePadding(list2)
          }
        }, 50)
      }
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

    // —— 兜底还原 ③：window resize（Android 无 visualViewport 时键盘收起会触发 innerHeight 变化）——
    const windowResizeHandler = () => {
      if (window.innerHeight >= origVVH - VV_RESTORE_THRESHOLD) restoreAll()
    }
    window.addEventListener('resize', windowResizeHandler)

    // —— 兜底还原 ④：pageshow（切后台回来 / PWA 恢复时强制还原）——
    const pageShowHandler = () => {
      setTimeout(restoreAll, 0)
    }
    window.addEventListener('pageshow', pageShowHandler)

    // 旋转屏幕时重置基准高度
    const orientHandler = () => { origVVH = window.innerHeight }
    window.addEventListener('orientationchange', orientHandler)

    return () => {
      document.removeEventListener('focusin', focusHandler)
      document.removeEventListener('focusout', blurHandler)
      if (kbHandle) { try { kbHandle.remove() } catch { /* noop */ } }
      if (vv) vv.removeEventListener('resize', vvResizeHandler)
      window.removeEventListener('resize', windowResizeHandler)
      window.removeEventListener('pageshow', pageShowHandler)
      window.removeEventListener('orientationchange', orientHandler)
    }
  }, [])
}
