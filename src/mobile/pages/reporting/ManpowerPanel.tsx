/**
 * 工单人员工时面板
 * —— 工单级（不分工序），Tab: 人员
 *
 * 逻辑：开工时后端自动创建 manpower_record，前端只改人数保存
 * 工时按开工时间到当前/完工时间自动计算
 *
 * 后端接口：
 *   GET  /production/manpower-records?report_order_id=xxx
 *   POST /production/manpower-records
 *   PUT  /production/manpower-records/:id
 */
import { useCallback, useEffect, useState } from 'react'
import React from 'react'
import { Button, Toast } from 'antd-mobile'
import api from '../../../utils/api'
import type { ManpowerRow, ReportOrder } from './types'

interface Props {
  report: ReportOrder
  editable: boolean
  manpower: ManpowerRow | null
  setManpower: (updater: (prev: ManpowerRow | null) => ManpowerRow | null) => void
}

const COUNT_STYLE: React.CSSProperties = {
  flex: 1, padding: '10px 12px', borderRadius: 8,
  border: '1px solid var(--m-border)', fontSize: 15,
  background: 'var(--m-surface)',
}

export function ManpowerPanel({ report, editable, manpower, setManpower }: Props) {
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

  const handleSave = useCallback(async () => {
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

  const rows = [
    { label: '技工', v: skilled, setV: setSkilled },
    { label: '普工', v: general, setV: setGeneral },
    { label: '劳务', v: labor, setV: setLabor },
    { label: '其他', v: other, setV: setOther },
  ]
  const totalPeople = skilled + general + labor + other

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--m-text-3)', marginBottom: 10 }}>
        🕐 开工时间: <b style={{ color: 'var(--m-text)' }}>{report.report_time?.slice(0, 16) || '—'}</b>
        {report.finish_time && <span style={{ marginLeft: 8 }}>完工: <b style={{ color: 'var(--m-text)' }}>{report.finish_time.slice(0, 16)}</b></span>}
        <span style={{ marginLeft: 10, color: 'var(--brand-color)' }}>总人数: <b>{totalPeople}</b></span>
      </div>
      {rows.map(({ label, v, setV }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
          <span style={{ width: 50, fontSize: 13, color: 'var(--m-text-2)' }}>{label}</span>
          <input
            type="number" min={0} value={v} disabled={!editable}
            onChange={(e) => setV(Number(e.target.value) || 0)}
            style={{ ...COUNT_STYLE, background: editable ? 'var(--m-surface)' : 'var(--m-surface-2)' }}
          />
        </div>
      ))}
      {editable && (
        <Button color="primary" size="small" block onClick={handleSave} style={{ marginTop: 12 }}>
          💾 保存人员配置
        </Button>
      )}
      {!editable && (
        <div style={{ fontSize: 11, color: 'var(--m-text-3)', textAlign: 'center', marginTop: 8 }}>
          报工单已完工 · 只读
        </div>
      )}
    </div>
  )
}
