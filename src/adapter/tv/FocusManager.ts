/**
 * TV FocusManager — TV 遥控器焦点导航
 *
 * 核心：在一个可聚焦区域内，用方向键模拟"按最近邻移动焦点"。
 * 解决 WebView 中遥控器方向键穿透 Tab 顺序或完全不工作的问题。
 *
 * 设计目标：
 *  1. 只在 TV 端启用（DeviceManager 会在 DeviceContext type=tv 时初始化）
 *  2. 纯前端实现，无需原生桥接
 *  3. 不侵入业务组件：业务组件只需把可聚焦元素加 data-focus 属性
 *     + 保持原生 focus 样式（:focus-visible）
 *  4. 不影响触屏/鼠标（触屏点击自动 focus，鼠标用 tab 键）
 */
import { useEffect, useRef } from 'react'

interface FocusTarget {
  el: HTMLElement
  rect: DOMRect
}

/** 按键映射 */
const KEY_MAP: Record<string, 'up' | 'down' | 'left' | 'right' | 'enter' | 'back'> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  ' ': 'enter', Enter: 'enter',
  Escape: 'back', Backspace: 'back',
}

function isFocusable(el: HTMLElement): boolean {
  if (!(el instanceof HTMLElement)) return false
  if ((el as HTMLInputElement | HTMLButtonElement).disabled) return false
  const style = getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') return false
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0
}

function collectFocusTargets(scope: HTMLElement): FocusTarget[] {
  const nodes = scope.querySelectorAll<HTMLElement>(
    '[data-focus], [role="button"], [tabindex]:not([tabindex="-1"]), button, a, input, textarea, select'
  )
  const out: FocusTarget[] = []
  for (const el of nodes) {
    if (isFocusable(el)) out.push({ el, rect: el.getBoundingClientRect() })
  }
  return out
}

/** 在 targets 中寻找 direction 方向上最近的元素 */
function findNext(from: FocusTarget, targets: FocusTarget[], dir: 'up' | 'down' | 'left' | 'right'): FocusTarget | null {
  let best: FocusTarget | null = null
  let bestDist = Infinity
  const cx = from.rect.left + from.rect.width / 2
  const cy = from.rect.top + from.rect.height / 2

  for (const t of targets) {
    if (t.el === from.el) continue
    const tx = t.rect.left + t.rect.width / 2
    const ty = t.rect.top + t.rect.height / 2

    let match = false
    if (dir === 'up' && ty < cy - 4) match = true
    if (dir === 'down' && ty > cy + 4) match = true
    if (dir === 'left' && tx < cx - 4) match = true
    if (dir === 'right' && tx > cx + 4) match = true
    if (!match) continue

    const dx = tx - cx
    const dy = ty - cy
    const dist = dx * dx + dy * dy
    if (dist < bestDist) {
      bestDist = dist
      best = t
    }
  }
  return best
}

/**
 * useTvFocus — TV 遥控器焦点导航 Hook
 * 用法：const ref = useTvFocus()；挂在可聚焦的容器 div 上。
 */
export function useTvFocus(): React.RefObject<HTMLDivElement> {
  const scopeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const scope = scopeRef.current
    if (!scope) return

    const onKey = (e: KeyboardEvent) => {
      const dir = KEY_MAP[e.key]
      if (!dir) return
      // 只有方向键拦截；Enter / Back 让浏览器自行处理
      if (dir !== 'up' && dir !== 'down' && dir !== 'left' && dir !== 'right') return

      const active = document.activeElement as HTMLElement | null
      const targets = collectFocusTargets(scope)
      if (targets.length === 0) return

      let current = targets.find((t) => t.el === active)
      if (!current) {
        // 当前焦点不在本 scope 内，选择 scope 内第一个可聚焦元素
        const first = targets[0]
        first.el.focus({ preventScroll: true })
        e.preventDefault()
        return
      }

      const next = findNext(current, targets, dir)
      if (next) {
        next.el.focus({ preventScroll: true })
        e.preventDefault()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return scopeRef
}
