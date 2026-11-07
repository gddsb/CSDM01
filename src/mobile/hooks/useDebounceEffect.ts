/**
 * useDebounceEffect — 值变化后延迟执行 effect，期间新变化重置计时器。
 * 替代手动 setTimeout + clearTimeout，避免各页面重复写。
 *
 * 典型用途：SearchBar onChange 输入防抖，停下 500ms 后才发请求。
 *
 * @param value   被监听的值（通常是 keyword string）
 * @param effect  值稳定后执行的回调
 * @param delay   延迟毫秒数，默认 500
 */
import { useEffect, useRef } from 'react'

export function useDebounceEffect<T>(
  value: T,
  effect: (v: T) => void,
  delay = 500,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => effect(value), delay)
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
}
