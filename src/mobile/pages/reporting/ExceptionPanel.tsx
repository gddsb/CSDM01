/**
 * 工单工时（异常）记录面板
 * —— 工单级（不分工序），Tab: 工时
 *
 * 后端接口：
 *   GET  /production/process-exceptions?report_order_id=xxx
 *   POST /production/process-exceptions
 *   PUT  /production/process-exceptions/:id
 *   DEL  /production/process-exceptions/:id
 */
import { useCallback, useState } from 'react'
import React from 'react'
import { Button, Dialog, Toast } from 'antd-mobile'
import api from '../../../utils/api'
import type { ExceptionRow, ReportOrder } from './types'

const EXCEPTION_TYPES = ['换型换线', '设备故障', '质量异常', '待料', '工装调整', '其他']

interface Props {
  report: ReportOrder
  editable: boolean
  rows: ExceptionRow[]
  setRows: (updater: (prev: ExceptionRow[]) => ExceptionRow[]) => void
}

export function ExceptionPanel({ report, editable, rows, setRows }: Props) {
  const [draft, setDraft] = useState<ExceptionRow>({})

  const handleAdd = useCallback(async () => {
    if (!draft.exception_type) { Toast.show({ content: '请选异常类型', icon: 'fail' }); return }
    try {
      const payload: any = {
        report_order_id: report.report_order_id,
        exception_type: draft.exception_type,
        start_time: draft.start_time || new Date().toISOString().slice(0, 19).replace('T', ' '),
        end_time: draft.end_time || null,
        remark: draft.remark || null,
      }
      if (draft.start_time && draft.end_time) {
        const s = new Date(draft.start_time).getTime()
        const e = new Date(draft.end_time).getTime()
        if (e > s) payload.duration = Math.round((e - s) / 60000)
      }
      const r: any = await api.post('/production/process-exceptions', payload)
      if (!r.success) throw new Error(r.message || '保存失败')
      setRows(prev => [...prev, { ...draft, ...payload, id: r.data?.exception_id ?? Date.now() }])
      Toast.show({ content: '已添加', icon: 'success' })
      setDraft({})
    } catch (e: any) {
      Toast.show({ content: e?.message || '保存失败', icon: 'fail' })
    }
  }, [draft, report.report_order_id, setRows])

  const handleDel = useCallback(async (row: ExceptionRow) => {
    const ok = await Dialog.confirm({ content: '删除该工时记录？', confirmText: '删除', cancelText: '取消' })
    if (!ok) return
    try {
      if (row.exception_id) await api.delete(`/production/process-exceptions/${row.exception_id}`)
      setRows(prev => prev.filter(r => r !== row))
      Toast.show({ content: '已删除', icon: 'success' })
    } catch (e: any) {
      Toast.show({ content: e?.message || '删除失败', icon: 'fail' })
    }
  }, [setRows])

  const inputStyle: React.CSSProperties = {
    flex: 1, padding: '10px 12px', borderRadius: 8,
    border: '1px solid #e0e0e0', fontSize: 14,
  }
  const selStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid #e0e0e0', fontSize: 14, background: '#fff',
  }

  return (
    <div>
      {/* 列表 */}
      {rows.length > 0 && rows.map((row) => (
        <div key={String(row.id)} style={{
          padding: '10px 0', borderTop: '1px solid #f0f0f0',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#333' }}>
              {row.exception_type || '—'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {row.duration != null && (
                <span style={{ color: '#ff9800', fontWeight: 600 }}>
                  {row.duration > 0 ? `${row.duration}分钟` : '进行中'}
                </span>
              )}
              {editable && (
                <Button size="mini" fill="outline" onClick={() => handleDel(row)}>删</Button>
              )}
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#999', marginTop: 3 }}>
            {(row.start_time || '—').slice(5, 16).replace('T', ' ')} → {(row.end_time || '至今').slice(5, 16).replace('T', ' ')}
          </div>
          {row.remark && (
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>📝 {row.remark}</div>
          )}
        </div>
      ))}
      {rows.length === 0 && (
        <div style={{ textAlign: 'center', padding: 20, color: '#bbb', fontSize: 12 }}>— 暂无工时记录 —</div>
      )}

      {/* 新增 */}
      {editable && (
        <div style={{ borderTop: '1px dashed #ddd', paddingTop: 10, marginTop: 6 }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>➕ 新加工时</div>
          <select
            value={draft.exception_type || ''}
            onChange={(e) => setDraft(d => ({ ...d, exception_type: e.target.value }))}
            style={selStyle}
          >
            <option value="">请选择异常类型</option>
            {EXCEPTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input type="datetime-local" value={draft.start_time || ''} onChange={(e) => setDraft(d => ({ ...d, start_time: e.target.value }))} style={inputStyle} placeholder="开始时间" />
            <input type="datetime-local" value={draft.end_time || ''} onChange={(e) => setDraft(d => ({ ...d, end_time: e.target.value }))} style={inputStyle} placeholder="结束时间（可选）" />
          </div>
          <input
            type="text" placeholder="备注（可选）" value={draft.remark || ''}
            onChange={(e) => setDraft(d => ({ ...d, remark: e.target.value }))}
            style={{ ...inputStyle, width: '100%', marginTop: 8 }}
          />
          <div style={{ marginTop: 10 }}>
            <Button size="mini" color="primary" onClick={handleAdd}>添加工时</Button>
          </div>
        </div>
      )}
    </div>
  )
}
