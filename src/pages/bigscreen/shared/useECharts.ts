import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

export function useECharts(optionFactory: () => echarts.EChartsOption, deps: unknown[] = []) {
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const c = echarts.init(ref.current)
    chartRef.current = c
    const onResize = () => c.resize()
    window.addEventListener('resize', onResize)
    c.setOption(optionFactory())
    return () => {
      window.removeEventListener('resize', onResize)
      c.dispose()
      chartRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { ref, chartRef }
}

export function extractDates<T extends { data_time?: string; created_at?: string; createdAt?: string }>(items: T[]): string[] {
  const set = new Set<string>()
  items.forEach(i => { const d = i.data_time || i.created_at || i.createdAt; if (d) set.add(d.slice(0, 10)) })
  return Array.from(set).sort()
}

export function filterByDate<T extends { data_time?: string; created_at?: string; createdAt?: string }>(items: T[], date?: string): T[] {
  if (!date) return items
  return items.filter(i => {
    const d = i.data_time || i.created_at || i.createdAt
    return d && d.slice(0, 10) === date
  })
}
