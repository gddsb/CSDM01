/**
 * useEdgeSwipeBack —— 屏幕左侧边缘右滑返回手势
 *
 * 设计要点（参考 Pointer Events 最佳实践）：
 * 1. 仅在屏幕左侧 EDGE_WIDTH 区域内 pointerdown 才开始识别（避免与页面内左右滑动冲突）
 * 2. pointerdown → 记录起点 + 绑定 document 级 move/up/cancel（避免组件内部 pointer capture 丢失事件）
 * 3. pointermove 超阈值即触发（DX > TRIGGER_DX 且 DX > DY × 1.2）—— 不等 pointerup
 * 4. 垂直位移过大（DY > MAX_DY）直接取消 — 避免与纵向滚动冲突
 * 5. enable=false 时完全不监听 —— 首页/我的等不能返回的页面关闭
 *
 * 与页面滚动的冲突治理：
 *   根元素 touch-action 设为 pan-y（CSS 层），让浏览器处理纵向滚动；
 *   本 hook 只在"水平位移明显大于垂直"时才拦截事件。
 */
import { useEffect, useRef } from 'react'

interface Options {
  /** 是否启用 —— 仅 canBack=true 时启用 */
  enable: boolean
  /** 触发回调（通常是 navigate(-1)） */
  onBack: () => void
  /** 边缘检测宽度（默认 30px） */
  edgeWidth?: number
  /** 触发水平位移阈值（默认 80px） */
  triggerDx?: number
  /** 允许的最大垂直位移（超过即取消，避免与纵向滚动冲突；默认 60px） */
  maxDy?: number
}

export function useEdgeSwipeBack({
  enable,
  onBack,
  edgeWidth = 30,
  triggerDx = 80,
  maxDy = 60,
}: Options) {
  const state = useRef<{
    active: boolean
    startX: number
    startY: number
    startedAt: number
    fired: boolean
  }>({ active: false, startX: 0, startY: 0, startedAt: 0, fired: false })

  useEffect(() => {
    if (!enable) return

    // pointerdown 仅捕获边缘启动
    const onDown = (e: PointerEvent) => {
      // 只在屏幕左侧边缘启动
      if (e.clientX > edgeWidth) return

      // 已有弹窗/Dialog 打开时不触发（防误触）
      const anyDialog = document.querySelector('.adm-dialog, .adm-action-sheet, .adm-toast')
      if (anyDialog) return

      state.current.active = true
      state.current.startX = e.clientX
      state.current.startY = e.clientY
      state.current.startedAt = Date.now()
      state.current.fired = false

      // 捕获 pointer 确保后续 move/up 不会因为滚动/系统手势丢失
      ;(e.currentTarget as Element)?.setPointerCapture?.(e.pointerId)
    }

    const onMove = (e: PointerEvent) => {
      if (!state.current.active || state.current.fired) return
      const dx = e.clientX - state.current.startX
      const dy = Math.abs(e.clientY - state.current.startY)

      // 垂直位移过大 → 用户在滚动，取消
      if (dy > maxDy) {
        state.current.active = false
        return
      }

      // 水平位移达到阈值 且 水平位移明显大于垂直 → 触发
      if (dx >= triggerDx && dx > dy * 1.2) {
        state.current.fired = true
        state.current.active = false
        onBack()
      }
    }

    const onUp = () => {
      state.current.active = false
    }

    const onCancel = () => {
      state.current.active = false
    }

    // pointerdown 绑到 window（capture 阶段优先触发）
    window.addEventListener('pointerdown', onDown, true)
    // move/up/cancel 绑到 document —— 即使 pointer 离开初始元素也能收到
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onCancel)

    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onCancel)
    }
  }, [enable, onBack, edgeWidth, triggerDx, maxDy])
}
