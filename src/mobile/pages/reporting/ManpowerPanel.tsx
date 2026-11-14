/**
 * 工单人员工时面板
 * —— 工单级（不分工序），Tab: 人员
 *
 * 逻辑：开工时后端自动创建 manpower_record，前端只改人数保存
 * 工时按开工时间到当前/完工时间自动计算
 * 休息时间独立卡片 + 独立保存按钮（POST /production/break-times/batch，先删后写）
 *
 * 后端接口：
 *   GET  /production/manpower-records?report_order_id=xxx
 *   POST /production/manpower-records
 *   PUT  /production/manpower-records/:id
 *   GET  /production/break-times?report_order_id=xxx
 *   POST /production/break-times/batch  { report_order_id, records }
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import React from 'react'
import { Button, Toast, Picker } from 'antd-mobile'
import { fmtLocalDateTime } from '../../../utils/localTime'
import api from '../../../utils/api'
import type { BreakTimeRow, ManpowerRow, ReportOrder } from './types'

interface Props {
  report: ReportOrder
  editable: boolean
  manpower: ManpowerRow | null
  setManpower: (updater: (prev: ManpowerRow | null) => ManpowerRow | null) => void
  breakTimes: BreakTimeRow[]
  setBreakTimes: React.Dispatch<React.SetStateAction<BreakTimeRow[]>>
  onDirtyChange?: (dirty: boolean) => void
}

const COUNT_STYLE: React.CSSProperties = {
  padding: '4px 0', borderRadius: 6,
  border: '1px solid var(--m-border)', fontSize: 15,
  background: 'var(--m-surface)',
  boxSizing: 'border-box', width: '100%',
}

// ========== 时间工具（无 dayjs 依赖，纯字符串处理） ==========

/**
 * 从完整时间字符串（可能是 UTC ISO 带 Z）提取本地 HH:mm
 * —— 不能用正则抠字符串！因为 Sequelize timezone 会把 DATETIME 墙时间转成 UTC
 *    返回 JSON 形如 "2026-09-16T04:00:00.000Z"（04 UTC = 12 CST）
 *    必须 new Date() 解析 → 自动按浏览器本地时区转换 → getHours() 才是墙时间
 * 失败返回 '00:00'
 */
function extractHHmm(fullTime: string | undefined): string {
  if (!fullTime) return '00:00'
  const d = new Date(fullTime)
  if (isNaN(d.getTime())) return '00:00'
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

/** 把 HH:mm 拼到基准日期上，返回完整 'YYYY-MM-DD HH:mm:ss'
 *  @param hhmm '12:00'
 *  @param baseDate 完整时间字符串（含日期），用作日期部分
 *  @param nextDay 如果 true，日期 +1 天（处理跨天休息如 22:00-06:00）
 */
function mergeHHmmToDate(hhmm: string, baseDate: string | undefined, nextDay = false): string {
  // 解析 baseDate 的日期部分
  let year = 2025, month = 1, day = 1
  if (baseDate) {
    const d = new Date(baseDate)
    if (!isNaN(d.getTime())) {
      year = d.getFullYear()
      month = d.getMonth() + 1
      day = d.getDate()
    }
  }
  if (nextDay) {
    const d = new Date(year, month - 1, day + 1)
    year = d.getFullYear()
    month = d.getMonth() + 1
    day = d.getDate()
  }
  const [h, m] = hhmm.split(':').map(Number)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
}

/** 计算两段完整时间字符串的分钟差 */
function calcMinutes(start: string, end: string): number {
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  if (isNaN(s) || isNaN(e) || e <= s) return 0
  return Math.round((e - s) / 60000)
}

// ========== 主组件 ==========

export function ManpowerPanel({
  report, editable, manpower, setManpower,
  breakTimes, setBreakTimes, onDirtyChange,
}: Props) {
  // ---- 人员配置状态 ----
  const [skilled, setSkilled] = useState(0)
  const [general, setGeneral] = useState(0)
  const [labor, setLabor] = useState(0)
  const [other, setOther] = useState(0)

  useEffect(() => {
    if (manpower) {
      setSkilled(Number(manpower.skilled_count || 0))
      setGeneral(Number(manpower.general_count || 0))
      setLabor(Number(manpower.labor_count || 0))
      setOther(Number(manpower.other_count || 0))
    }
  }, [manpower])

  const manpowerDirty = useMemo(() => {
    if (!manpower) return (skilled + general + labor + other) > 0
    return skilled !== Number(manpower.skilled_count || 0) ||
           general !== Number(manpower.general_count || 0) ||
           labor !== Number(manpower.labor_count || 0) ||
           other !== Number(manpower.other_count || 0)
  }, [skilled, general, labor, other, manpower])

  // ---- 休息时间状态（独立 dirty） ----
  const [breakDirty, setBreakDirty] = useState(false)

  // 时分 Picker 列（常驻，避免每次渲染重建）
  const timeColumns = useMemo(() => [
    Array.from({ length: 24 }, (_, i) => ({
      label: String(i).padStart(2, '0'), value: String(i).padStart(2, '0'),
    })),
    Array.from({ length: 60 }, (_, i) => ({
      label: String(i).padStart(2, '0'), value: String(i).padStart(2, '0'),
    })),
  ], [])

  // 合并 dirty 上报（任一 dirty 即 dirty）
  useEffect(() => {
    onDirtyChange?.(manpowerDirty || breakDirty)
    return () => { onDirtyChange?.(false) }
  }, [manpowerDirty, breakDirty, onDirtyChange])

  // ========== 保存人员配置 ==========
  const handleSaveManpower = useCallback(async () => {
    const total = skilled + general + labor + other
    if (total <= 0) { Toast.show({ content: '请填至少一项人数', icon: 'fail' }); return }
    const payload = {
      report_order_id: report.report_order_id,
      skilled_count: skilled,
      general_count: general,
      labor_count: labor,
      other_count: other,
    }
    try {
      let r: any
      if (manpower?.record_id) {
        r = await api.put(`/production/manpower-records/${manpower.record_id}`, payload)
      } else {
        r = await api.post('/production/manpower-records', payload)
      }
      const data = (r as any).data || manpower || payload
      setManpower(() => ({ ...data, record_id: data.record_id }))
      Toast.show({ content: '已保存人员配置', icon: 'success' })
    } catch (e: any) {
      Toast.show({ content: e?.message || '保存失败', icon: 'fail' })
    }
  }, [skilled, general, labor, other, report.report_order_id, manpower, setManpower])

  // ========== 休息时间操作 ==========

  /** 添加一段新的休息时间（默认 12:00-13:00，复用 report.report_time 日期） */
  const addBreak = useCallback(() => {
    setBreakTimes(prev => {
      // 找一个未占用的时间段：从 12:00 开始，如果已存在就顺延到已有结束时间
      const existingEnds = prev
        .filter(b => calcMinutes(b.start_time, b.end_time) > 0)
        .map(b => extractHHmm(b.end_time))
        .sort()
      let startHHmm = '12:00'
      let endHHmm = '13:00'
      if (existingEnds.includes(startHHmm)) {
        startHHmm = existingEnds[existingEnds.length - 1]
        const [h, m] = startHHmm.split(':').map(Number)
        const endDate = new Date(2025, 0, 1, h, m + 60)
        endHHmm = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`
      }
      return [...prev, {
        start_time: mergeHHmmToDate(startHHmm, report.report_time),
        end_time: mergeHHmmToDate(endHHmm, report.report_time),
      }]
    })
    setBreakDirty(true)
  }, [report.report_time, setBreakTimes])

  /** 更新某段休息时间的某个时间点 */
  const updateBreak = useCallback((idx: number, field: 'start_time' | 'end_time', hhmm: string) => {
    setBreakTimes(prev => prev.map((b, i) => {
      if (i !== idx) return b
      // 处理跨天：如果是 end_time 且 end < start，则日期 +1
      const otherField = field === 'start_time' ? 'end_time' : 'start_time'
      const otherHHmm = extractHHmm((b as any)[otherField])
      let nextDay = false
      if (field === 'end_time') {
        const [h1, m1] = hhmm.split(':').map(Number)
        const [h2, m2] = otherHHmm.split(':').map(Number)
        if ((h1 * 60 + m1) <= (h2 * 60 + m2)) nextDay = true
      }
      return {
        ...b,
        [field]: mergeHHmmToDate(hhmm, report.report_time, nextDay),
      }
    }))
    setBreakDirty(true)
  }, [report.report_time, setBreakTimes])

  /** 删除一段休息时间 */
  const deleteBreak = useCallback((idx: number) => {
    setBreakTimes(prev => prev.filter((_, i) => i !== idx))
    setBreakDirty(true)
  }, [setBreakTimes])

  /** 保存所有休息时间（batch: 先删后写） */
  const saveBreaks = useCallback(async () => {
    // 校验：每段 end 必须 > start
    const validRecords = breakTimes.filter(b => calcMinutes(b.start_time, b.end_time) > 0)
    // 按 start_time 排序
    validRecords.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

    // 检查有没有冲突的时间段
    for (let i = 0; i < validRecords.length - 1; i++) {
      if (new Date(validRecords[i].end_time).getTime() > new Date(validRecords[i + 1].start_time).getTime()) {
        Toast.show({ content: '休息时间段有重叠，请检查', icon: 'fail' })
        return
      }
    }

    try {
      await api.post('/production/break-times/batch', {
        report_order_id: String(report.report_order_id),
        records: validRecords.map(b => ({
          start_time: b.start_time,
          end_time: b.end_time,
          remark: b.remark || null,
        })),
      })
      Toast.show({ content: '已保存休息时间', icon: 'success' })
      setBreakDirty(false)
    } catch (e: any) {
      Toast.show({ content: e?.message || '保存失败', icon: 'fail' })
    }
  }, [breakTimes, report.report_order_id])

  /** 从系统默认配置刷新休息时间 */
  const refreshDefaults = useCallback(async () => {
    try {
      let patterns: any[] = []
      try {
        const res: any = await api.get('/system/configs', { params: { config_key: 'default_break_times' } })
        const list = res?.data
        if (Array.isArray(list)) {
          const raw = list.find((c: any) => c.config_key === 'default_break_times')?.config_value
          if (raw) {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
            if (Array.isArray(parsed)) patterns = parsed
          }
        }
      } catch { /* 静默 */ }

      if (!patterns || patterns.length === 0) {
        patterns = [
          { start: '12:00', end: '13:00' },
          { start: '18:00', end: '18:30' },
        ]
      }

      const newBreaks: BreakTimeRow[] = patterns.map((p: any) => {
        // 跨天处理
        const [sh, sm] = String(p.start).split(':').map(Number)
        const [eh, em] = String(p.end).split(':').map(Number)
        const endNextDay = (eh * 60 + em) <= (sh * 60 + sm)
        return {
          start_time: mergeHHmmToDate(String(p.start), report.report_time),
          end_time: mergeHHmmToDate(String(p.end), report.report_time, endNextDay),
        }
      })

      setBreakTimes(newBreaks)
      setBreakDirty(true)
      Toast.show({ content: `已加载 ${newBreaks.length} 段默认休息时间`, icon: 'success' })
    } catch (e: any) {
      Toast.show({ content: e?.message || '加载失败', icon: 'fail' })
    }
  }, [report.report_time, setBreakTimes])

  // ========== 计算休息合计 ==========
  const breakTotalMinutes = useMemo(() => {
    return breakTimes.reduce((sum, b) => {
      // 优先用 duration_minutes（DB 存的），否则前端算
      const m = (b as any).duration_minutes ?? calcMinutes(b.start_time, b.end_time)
      return sum + (m > 0 ? m : 0)
    }, 0)
  }, [breakTimes])

  // ========== 渲染 ==========

  const rows = [
    { label: '技工', v: skilled, setV: setSkilled },
    { label: '普工', v: general, setV: setGeneral },
    { label: '劳务', v: labor, setV: setLabor },
    { label: '其他', v: other, setV: setOther },
  ]
  const totalPeople = skilled + general + labor + other

  return (
    <div style={{ boxSizing: 'border-box', overflow: 'hidden' }}>
      {/* ===== 顶部：开工时间 + 人员配置 ===== */}
      <div style={{ fontSize: 12, color: 'var(--m-text-3)', marginBottom: 10 }}>
        🕐 开工时间: <b style={{ color: 'var(--m-text)' }}>{report.report_time ? fmtLocalDateTime(report.report_time).slice(0, 16).replace("T", " ") : '—'}</b>
        {report.finish_time && <span style={{ marginLeft: 8 }}>完工: <b style={{ color: 'var(--m-text)' }}>{fmtLocalDateTime(report.finish_time).slice(0, 16).replace("T", " ")}</b></span>}
        <span style={{ marginLeft: 10, color: 'var(--brand-color)' }}>总人数: <b>{totalPeople}</b></span>
      </div>
      {/* 固定 4 列单行 —— box-sizing:border-box 确保 padding+border 不撑破 1fr */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: 6,
        width: '100%',
        boxSizing: 'border-box',
      }}>
        {rows.map(({ label, v, setV }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 11, color: 'var(--m-text-2)', textAlign: 'center', lineHeight: '16px' }}>{label}</span>
            <input
              type="number" min={0} maxLength={2}
              value={v === 0 ? '' : v} placeholder="0" disabled={!editable}
              onChange={(e) => {
                const raw = e.target.value
                if (raw.length > 2) return
                setV(Number(raw) || 0)
              }}
              style={{
                ...COUNT_STYLE,
                textAlign: 'center',
                background: editable ? 'var(--m-surface)' : 'var(--m-surface-2)',
              }}
            />
          </div>
        ))}
      </div>
      {editable && (
        <Button color="primary" size="small" block onClick={handleSaveManpower} disabled={!manpowerDirty} style={{ marginTop: 12 }}>
          💾 保存人员配置
        </Button>
      )}
      {!editable && (
        <div style={{ fontSize: 11, color: 'var(--m-text-3)', textAlign: 'center', marginTop: 8 }}>
          报工单已完工 · 只读
        </div>
      )}

      {/* ===== 分割线 ===== */}
      <div style={{
        height: 1, background: 'var(--m-border)',
        margin: '16px 0',
      }} />

      {/* ===== 休息时间卡片 ===== */}
      <div>
        {/* 标题行 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 10,
        }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>🌙 休息时间</span>
          {editable && (
            <span
              style={{ fontSize: 12, color: 'var(--brand-color)', cursor: 'pointer' }}
              onClick={refreshDefaults}
            >🔄 刷新默认</span>
          )}
        </div>

        {/* 时间段列表 */}
        {breakTimes.length === 0 ? (
          <div style={{
            fontSize: 12, color: 'var(--m-text-3)', textAlign: 'center',
            padding: '16px 0', border: '1px dashed var(--m-border)', borderRadius: 8,
          }}>
            暂无休息时间段
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {breakTimes.map((b, idx) => {
              const startHHmm = extractHHmm(b.start_time)
              const endHHmm = extractHHmm(b.end_time)
              const mins = calcMinutes(b.start_time, b.end_time)
              return (
                <div key={b.break_time_id || idx} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 10px', borderRadius: 8,
                  border: '1px solid var(--m-border)',
                  background: 'var(--m-surface-2)',
                }}>
                  {/* 开始时间 Picker */}
                  {editable ? (
                    <Picker
                      columns={timeColumns}
                      value={startHHmm.split(':')}
                      onConfirm={(v) => updateBreak(idx, 'start_time', `${v[0]}:${v[1]}`)}
                    >
                      {(_items, { open }) => (
                        <div style={{
                          flex: 1, minWidth: 0, padding: '6px 8px',
                          borderRadius: 6, border: '1px solid var(--m-border)',
                          fontSize: 14, background: 'var(--m-surface)',
                          textAlign: 'center', color: 'var(--brand-color)', fontWeight: 600,
                        }} onClick={open} role="button" tabIndex={0}>{startHHmm}</div>
                      )}
                    </Picker>
                  ) : (
                    <div style={{
                      flex: 1, minWidth: 0, padding: '6px 8px',
                      borderRadius: 6, border: '1px solid var(--m-border)',
                      fontSize: 14, background: 'var(--m-surface-2)',
                      textAlign: 'center', color: 'var(--m-text)',
                    }}>{startHHmm}</div>
                  )}
                  <span style={{ fontSize: 14, color: 'var(--m-text-3)' }}>→</span>
                  {/* 结束时间 Picker */}
                  {editable ? (
                    <Picker
                      columns={timeColumns}
                      value={endHHmm.split(':')}
                      onConfirm={(v) => updateBreak(idx, 'end_time', `${v[0]}:${v[1]}`)}
                    >
                      {(_items, { open }) => (
                        <div style={{
                          flex: 1, minWidth: 0, padding: '6px 8px',
                          borderRadius: 6, border: '1px solid var(--m-border)',
                          fontSize: 14, background: 'var(--m-surface)',
                          textAlign: 'center', color: 'var(--brand-color)', fontWeight: 600,
                        }} onClick={open} role="button" tabIndex={0}>{endHHmm}</div>
                      )}
                    </Picker>
                  ) : (
                    <div style={{
                      flex: 1, minWidth: 0, padding: '6px 8px',
                      borderRadius: 6, border: '1px solid var(--m-border)',
                      fontSize: 14, background: 'var(--m-surface-2)',
                      textAlign: 'center', color: 'var(--m-text)',
                    }}>{endHHmm}</div>
                  )}
                  {/* 分钟显示 */}
                  <span style={{
                    fontSize: 12, color: mins > 0 ? 'var(--brand-color)' : '#ff4d4f',
                    minWidth: 48, textAlign: 'right', flexShrink: 0,
                  }}>
                    {mins > 0 ? `${mins}分` : '无效'}
                  </span>
                  {/* 删除按钮 */}
                  {editable && (
                    <span
                      style={{
                        fontSize: 16, color: 'var(--brand-color-danger)',
                        cursor: 'pointer', padding: '0 2px', flexShrink: 0,
                      }}
                      onClick={() => deleteBreak(idx)}
                    >✕</span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* 添加按钮 + 统计 + 保存 */}
        {editable && (
          <>
            {/* ➕ 添加休息时间段 */}
            <Button
              size="small" fill="outline" block
              onClick={addBreak}
              style={{ marginTop: 10 }}
            >➕ 添加休息时间段
            </Button>

            {/* 休息合计 */}
            <div style={{
              fontSize: 12, color: 'var(--m-text-3)',
              marginTop: 10, textAlign: 'center',
            }}>
              休息合计: <b style={{ color: 'var(--brand-color)', fontSize: 14 }}>{breakTotalMinutes}</b> 分钟
              {report.report_time && report.finish_time && (() => {
                const gross = calcMinutes(report.report_time, report.finish_time)
                const net = gross > 0 ? gross - breakTotalMinutes : 0
                const h = Math.floor(net / 60)
                const m = net % 60
                return (
                  <span style={{ marginLeft: 8 }}>
                    实际工时: <b style={{ color: 'var(--m-text)', fontSize: 14 }}>{h}h{m}m</b>
                  </span>
                )
              })()}
            </div>

            {/* 保存休息时间 */}
            <Button
              color="primary" size="small" block
              onClick={saveBreaks}
              disabled={!breakDirty}
              style={{ marginTop: 8 }}
            >💾 保存休息时间
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
