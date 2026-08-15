import React, { useState, useEffect, useRef, useCallback } from 'react'
import * as echarts from 'echarts'
import { workOrders, processReports, productionLines, orders, processes } from '../../../mock/data'
import '../../../styles/bigscreen.css'

const DATA_REFRESH_INTERVAL = 30 * 1000

function extractDates(items: any[], ...fields: string[]): string[] {
  const set = new Set<string>()
  items.forEach((item: any) => {
    fields.forEach(f => {
      const v = item[f]
      if (v && typeof v === 'string') {
        const m = v.match(/^(\d{4}-\d{2}-\d{2})/)
        if (m) set.add(m[1])
      }
    })
  })
  return Array.from(set).sort()
}

function getActiveDate() {
  const allDates = extractDates(processReports, 'report_time')
    .concat(extractDates(workOrders, 'start_time', 'created_at'))
    .concat(extractDates(orders, 'created_at', 'release_time'))
  if (allDates.length === 0) return null
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  if (allDates.includes(todayStr)) return todayStr
  const pastDates = allDates.filter(d => d <= todayStr)
  return pastDates.length > 0 ? pastDates[pastDates.length - 1] : allDates[allDates.length - 1]
}

function filterByDate<T>(items: T[], dateStr: string | null, ...fields: string[]): T[] {
  if (!dateStr) return items
  return items.filter(item =>
    fields.some(f => {
      const v = (item as any)[f]
      return v && typeof v === 'string' && v.startsWith(dateStr)
    })
  )
}

export default function MobileBigScreen() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [activeDate, setActiveDate] = useState(getActiveDate())
  const [dataVersion, setDataVersion] = useState(0)
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight)

  const lineChartRef = useRef(null)
  const processBarRef = useRef(null)
  const lineChartRef2 = useRef(null)
  const processBarRef2 = useRef(null)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveDate(getActiveDate())
      setDataVersion(v => v + 1)
    }, DATA_REFRESH_INTERVAL)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const checkOrientation = () => setIsLandscape(window.innerWidth > window.innerHeight)
    window.addEventListener('resize', checkOrientation)
    window.addEventListener('orientationchange', checkOrientation)
    return () => {
      window.removeEventListener('resize', checkOrientation)
      window.removeEventListener('orientationchange', checkOrientation)
    }
  }, [])

  const formatTime = (d) => {
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  const dateProcessReports = filterByDate(processReports, activeDate, 'report_time')
  const activeWorkOrders = workOrders.filter(w => w.status === '开工' || w.status === '已开工')
  const todayStartWorkOrders = workOrders.filter(w => activeDate && w.start_time && w.start_time.startsWith(activeDate))
  const todayStartQty = todayStartWorkOrders.reduce((s, w) => s + w.target_qty, 0)
  const currentOutput = activeWorkOrders.reduce((sum, w) => {
    const reported = processReports
      .filter(r => r.work_order_id === w.work_order_id)
      .reduce((s, r) => s + r.output_qty, 0)
    return sum + reported
  }, 0)
  const totalOutput = dateProcessReports.reduce((s, r) => s + r.output_qty, 0)
  const totalDefect = dateProcessReports.reduce((s, r) => s + r.defect_material + r.defect_process + r.defect_scrap, 0)
  const totalInput = dateProcessReports.filter(r => r.process_name === '裁剪下料').reduce((s, r) => s + r.input_qty, 0)
  const yieldRate = totalInput > 0 ? ((totalInput - totalDefect) / totalInput * 100).toFixed(1) : '0.0'
  const activeLines = productionLines.filter(l => l.status !== '停用')

  const kpiData = [
    { label: '开工工单', value: activeWorkOrders.length, unit: '个', color: '#58A6FF' },
    { label: '今日开工', value: todayStartQty, unit: '罐', color: '#3FB950' },
    { label: '今日投入', value: totalInput, unit: '罐', color: '#F0883E' },
    { label: '当前产出', value: currentOutput, unit: '罐', color: '#a78bfa' },
  ]

  const mustReportProcessNames = processes.filter(p => Number(p.must_report) === 1).map(p => p.process_name)
  const processStats: Record<string, { name: string; input: number; output: number; defect: number }> = {}
  dateProcessReports.forEach(r => {
    if (!mustReportProcessNames.includes(r.process_name)) return
    if (!processStats[r.process_name]) {
      processStats[r.process_name] = { name: r.process_name, input: 0, output: 0, defect: 0 }
    }
    processStats[r.process_name].input += r.input_qty
    processStats[r.process_name].output += r.output_qty
    processStats[r.process_name].defect += r.defect_material + r.defect_process + r.defect_scrap
  })
  const processList = Object.values(processStats)

  const chartWorkOrders = workOrders
    .filter(w => {
      const startMatch = activeDate && w.start_time && w.start_time.startsWith(activeDate)
      const finishMatch = activeDate && w.finish_time && w.finish_time.startsWith(activeDate)
      return startMatch || finishMatch
    })
    .filter(w => w.status !== '完工')
    .map(w => {
      const reported = processReports
        .filter(r => r.work_order_id === w.work_order_id)
        .reduce((s, r) => s + r.output_qty, 0)
      const pct = w.target_qty > 0 ? Math.round(reported / w.target_qty * 100) : 0
      return { ...w, reported, pct }
    })

  const displayOrders = orders.filter(o => {
    if (!activeDate) return false
    const releasedToday = o.release_time && o.release_time.startsWith(activeDate) && o.status === '下发'
    const todayWorkOrderIds = workOrders
      .filter(w => w.start_time && w.start_time.startsWith(activeDate))
      .map(w => w.order_id)
    const startedToday = todayWorkOrderIds.includes(o.order_id)
    const finishedToday = workOrders
      .filter(w => w.finish_time && w.finish_time.startsWith(activeDate))
      .some(w => w.order_id === o.order_id)
    return releasedToday || startedToday || finishedToday
  })

  const noAnimation = { animation: false, animationDuration: 0, animationDurationUpdate: 0, animationEasingUpdate: 'linear' as const }

  useEffect(() => {
    if (!lineChartRef.current) return
    const chart = echarts.init(lineChartRef.current)
    lineChartRef2.current = chart
    const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00']
    const allLineData = {
      'A线': { data: [520, 580, 610, 590, 540, 480, 560, 600, 620, 580, 530, 450, 380], color: '#00d4ff' },
      'B线': { data: [480, 520, 550, 530, 500, 460, 510, 540, 560, 530, 490, 420, 360], color: '#00ff88' },
      'C线': { data: [0, 0, 0, 0, 0, 0, 0, 360, 420, 440, 410, 350, 0], color: '#a78bfa' },
    }
    const legendData = activeLines.map(l => l.line_name)
    const series = activeLines.map(l => {
      const d = allLineData[l.line_name] || { data: [], color: '#58A6FF' }
      return {
        name: l.line_name, type: 'line', smooth: true, symbol: 'circle', symbolSize: 6, data: d.data,
        lineStyle: { color: d.color, width: 2 },
        itemStyle: { color: d.color },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: d.color + '44' }, { offset: 1, color: d.color + '00' }]) },
      }
    })
    chart.setOption({
      ...noAnimation,
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(13,27,42,0.92)', borderColor: 'rgba(88,166,255,0.4)', textStyle: { color: '#E6EDF3' } },
      legend: { top: 2, icon: 'roundRect', itemWidth: 12, itemHeight: 3, textStyle: { color: '#8B949E', fontSize: 10 }, data: legendData },
      grid: { left: '8%', right: '5%', top: '18%', bottom: '15%', containLabel: true },
      xAxis: { type: 'category', boundaryGap: false, data: hours, axisLine: { lineStyle: { color: 'rgba(88,166,255,0.3)' } }, axisTick: { show: false }, axisLabel: { color: '#C9D1D9', fontSize: 9 } },
      yAxis: { type: 'value', axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#8B949E', fontSize: 9 }, splitLine: { lineStyle: { color: 'rgba(88,166,255,0.08)' } } },
      series: series,
    })
    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)
    return () => { chart.dispose(); window.removeEventListener('resize', handleResize); lineChartRef2.current = null }
  }, [activeLines.length])

  useEffect(() => {
    if (!processBarRef.current) return
    let chart = processBarRef2.current
    if (!chart) {
      chart = echarts.init(processBarRef.current)
      processBarRef2.current = chart
    }
    const names = processList.length > 0 ? processList.map(p => p.name) : ['暂无数据']
    const outputs = processList.length > 0 ? processList.map(p => p.output) : [0]
    chart.setOption({
      ...noAnimation,
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'rgba(13,27,42,0.92)', borderColor: 'rgba(88,166,255,0.4)', textStyle: { color: '#E6EDF3' } },
      grid: { left: '8%', right: '5%', top: '12%', bottom: '18%', containLabel: true },
      xAxis: { type: 'category', data: names, axisLine: { lineStyle: { color: 'rgba(88,166,255,0.3)' } }, axisTick: { show: false }, axisLabel: { color: '#C9D1D9', fontSize: 9 } },
      yAxis: { type: 'value', axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#8B949E', fontSize: 9 }, splitLine: { lineStyle: { color: 'rgba(88,166,255,0.08)' } } },
      series: [{
        name: '产出', type: 'bar', barWidth: '50%', data: outputs,
        itemStyle: { borderRadius: [4, 4, 0, 0], color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#00d4ff' }, { offset: 1, color: 'rgba(0,212,255,0.2)' }]) },
        label: { show: true, position: 'top', color: '#E6EDF3', fontSize: 9 },
      }],
    })
    const handleResize = () => chart && chart.resize()
    window.addEventListener('resize', handleResize)
    return () => { window.removeEventListener('resize', handleResize) }
  }, [processList, dataVersion])

  if (!isLandscape) {
    return (
      <div style={{
        width: '100vw', height: '100vh', display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: '#0d1b2a', color: '#E6EDF3', gap: 16
      }}>
        <div style={{ fontSize: 48 }}>📱↔️</div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>请横屏查看生产看板</div>
        <div style={{ fontSize: 12, color: '#8B949E' }}>请将设备横屏以获得最佳体验</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#0d1b2a', padding: 8, gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ color: '#3FB950', fontSize: 10 }}>● 实时</div>
        <div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>奶粉罐生产实时监控</div>
        <div style={{ color: '#8B949E', fontSize: 10, fontFamily: 'monospace' }}>{formatTime(currentTime)}</div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {kpiData.map((kpi, i) => (
          <div key={i} style={{
            flex: 1, padding: '8px 6px', borderRadius: 6,
            background: 'rgba(88,166,255,0.06)', border: '1px solid rgba(88,166,255,0.15)',
            textAlign: 'center'
          }}>
            <div style={{ color: kpi.color, fontSize: 18, fontWeight: 700, fontFamily: 'DIN, Courier New, monospace' }}>
              {kpi.value}<span style={{ fontSize: 10 }}>{kpi.unit}</span>
            </div>
            <div style={{ color: '#8B949E', fontSize: 10, marginTop: 2 }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 8 }}>
        <div style={{ flex: 1.2, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            flex: 1, minHeight: 0, padding: 8, borderRadius: 6,
            background: 'rgba(88,166,255,0.04)', border: '1px solid rgba(88,166,255,0.1)'
          }}>
            <div style={{ color: '#58A6FF', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>产线运行状态</div>
            <div style={{ overflow: 'auto', maxHeight: 'calc(100% - 24px)' }}>
              {activeLines.map(line => (
                <div key={line.line_id} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 4px', borderLeft: `3px solid ${line.status === '运行中' ? '#3FB950' : line.status === '维护中' ? '#D29922' : '#F85149'}`,
                  marginBottom: 4, background: 'rgba(255,255,255,0.02)', borderRadius: 3
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: line.status === '运行中' ? '#3FB950' : line.status === '维护中' ? '#D29922' : '#F85149'
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#E6EDF3', fontSize: 11, fontWeight: 600 }}>{line.line_name}</div>
                    <div style={{ color: '#8B949E', fontSize: 9 }}>{line.workshop}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            flex: 1, minHeight: 0, padding: 8, borderRadius: 6,
            background: 'rgba(88,166,255,0.04)', border: '1px solid rgba(88,166,255,0.1)'
          }}>
            <div style={{ color: '#58A6FF', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>订单概览</div>
            <div style={{ overflow: 'auto', maxHeight: 'calc(100% - 24px)' }}>
              {displayOrders.length === 0 && <div style={{ color: '#8B949E', fontSize: 10, textAlign: 'center', padding: 10 }}>暂无当日数据</div>}
              {displayOrders.map(o => (
                <div key={o.order_id} style={{
                  padding: '5px 4px', borderBottom: '1px solid rgba(88,166,255,0.06)',
                  marginBottom: 2
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ color: '#E6EDF3', fontSize: 10, fontWeight: 600 }}>{o.order_no}</span>
                    <span style={{
                      fontSize: 9, padding: '1px 4px', borderRadius: 3,
                      background: o.status === '下发' ? 'rgba(88,166,255,0.2)' : o.status === '完工' ? 'rgba(63,185,80,0.2)' : 'rgba(139,148,158,0.2)',
                      color: o.status === '下发' ? '#58A6FF' : o.status === '完工' ? '#3FB950' : '#8B949E'
                    }}>{o.status}</span>
                  </div>
                  <div style={{ color: '#8B949E', fontSize: 9 }}>{o.material_name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ flex: 2, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            flex: 1, minHeight: 0, padding: '4px 8px 8px', borderRadius: 6,
            background: 'rgba(88,166,255,0.04)', border: '1px solid rgba(88,166,255,0.1)'
          }}>
            <div style={{ color: '#58A6FF', fontSize: 11, fontWeight: 600 }}>产线产出趋势</div>
            <div ref={lineChartRef} style={{ width: '100%', height: 'calc(100% - 16px)' }} />
          </div>

          <div style={{
            flex: 1, minHeight: 0, padding: '4px 8px 8px', borderRadius: 6,
            background: 'rgba(88,166,255,0.04)', border: '1px solid rgba(88,166,255,0.1)'
          }}>
            <div style={{ color: '#58A6FF', fontSize: 11, fontWeight: 600 }}>工序产出统计</div>
            <div ref={processBarRef} style={{ width: '100%', height: 'calc(100% - 16px)' }} />
          </div>
        </div>

        <div style={{ flex: 1.2, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            flex: 1, minHeight: 0, padding: 8, borderRadius: 6,
            background: 'rgba(88,166,255,0.04)', border: '1px solid rgba(88,166,255,0.1)'
          }}>
            <div style={{ color: '#58A6FF', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>工单进度</div>
            <div style={{ overflow: 'auto', maxHeight: 'calc(100% - 24px)' }}>
              {chartWorkOrders.length === 0 && <div style={{ color: '#8B949E', fontSize: 10, textAlign: 'center', padding: 10 }}>暂无当日数据</div>}
              {chartWorkOrders.map(w => (
                <div key={w.work_order_id} style={{ padding: '5px 4px', borderBottom: '1px solid rgba(88,166,255,0.06)', marginBottom: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ color: '#E6EDF3', fontSize: 10, fontWeight: 600 }}>{w.work_order_no}</span>
                    <span style={{ color: '#3FB950', fontSize: 10, fontWeight: 700 }}>{w.pct}%</span>
                  </div>
                  <div style={{ fontSize: 9, color: '#8B949E', marginBottom: 3 }}>{w.line_name} · {w.material_name}</div>
                  <div style={{ width: '100%', height: 4, background: 'rgba(88,166,255,0.15)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      width: `${w.pct}%`, height: '100%',
                      background: 'linear-gradient(90deg, #00ff88, #00d4ff)', borderRadius: 2
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontSize: 9, color: '#8B949E' }}>
                    <span>完工 {w.reported.toLocaleString()}</span>
                    <span>目标 {w.target_qty.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            flex: 1, minHeight: 0, padding: 8, borderRadius: 6,
            background: 'rgba(88,166,255,0.04)', border: '1px solid rgba(88,166,255,0.1)'
          }}>
            <div style={{ color: '#58A6FF', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>不良统计</div>
            <div style={{ overflow: 'auto', maxHeight: 'calc(100% - 24px)' }}>
              {(() => {
                const dist: Record<string, number> = {}
                dateProcessReports.forEach(r => {
                  dist['来料不良'] = (dist['来料不良'] || 0) + r.defect_material
                  dist['制程不良'] = (dist['制程不良'] || 0) + r.defect_process
                  dist['检验报废'] = (dist['检验报废'] || 0) + r.defect_scrap
                })
                const total = Object.values(dist).reduce((s, v) => s + v, 0)
                const colors = { '来料不良': '#ffd93d', '制程不良': '#ff6b6b', '检验报废': '#a78bfa' }
                return (
                  <>
                    <div style={{ textAlign: 'center', marginBottom: 8 }}>
                      <div style={{ color: '#ff6b6b', fontSize: 22, fontWeight: 700 }}>{total}</div>
                      <div style={{ color: '#8B949E', fontSize: 9 }}>不良总数(件)</div>
                    </div>
                    {Object.entries(dist).map(([name, value]) => (
                      <div key={name} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '4px 2px', borderBottom: '1px solid rgba(88,166,255,0.04)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: colors[name] }} />
                          <span style={{ color: '#C9D1D9', fontSize: 10 }}>{name}</span>
                        </div>
                        <span style={{ color: colors[name], fontSize: 10, fontWeight: 600 }}>
                          {value} ({total > 0 ? Math.round(value / total * 100) : 0}%)
                        </span>
                      </div>
                    ))}
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
