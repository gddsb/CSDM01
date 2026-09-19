/**
 * 工单报废记录面板
 * —— Tab: 报废
 *
 * 🔑 与 PC 端完全对齐：
 *   - 报废数据存 ProcessDefect 表（production_process_defect）
 *   - process_id 改为可选（报废场景允许无工序）
 *   - 查询时按工单维度聚合显示（前端过滤 defect_type === '检验报废'）
 *   - 新增/编辑/删除统一调 /production/process-defects 接口
 */
import { useCallback, useState } from 'react'
import React from 'react'
import { Button, Dialog, Toast } from 'antd-mobile'
import api from '../../../utils/api'
import type { DefectType, ReportOrder, ScrapRow, ProcessRow } from './types'

interface Props {
  report: ReportOrder
  /** 当前工序（可选，不传则报废不绑工序） */
  activeProcessId: number | null
  processes: ProcessRow[]
  editable: boolean
  /** 报废类型下拉（category_name='报废类型' 或 defect_type='检验报废'） */
  scrapTypes: DefectType[]
  rows: ScrapRow[]
  setRows: (updater: (prev: ScrapRow[]) => ScrapRow[]) => void
}

export function ScrapPanel({
  report, activeProcessId, processes, editable, scrapTypes, rows, setRows,
}: Props) {
  const [draft, setDraft] = useState<ScrapRow>({ quantity: 0 })

  // 工序可选：优先 activeProcessId，否则取第一道，再否则 null
  const resolvedProcessId = activeProcessId ?? processes[0]?.process_id ?? null

  const handleAdd = useCallback(async () => {
    if (!draft.defect_type_id) { Toast.show({ content: '请选报废项目', icon: 'fail' }); return }
    if (!draft.quantity || Number(draft.quantity) <= 0) { Toast.show({ content: '数量 > 0', icon: 'fail' }); return }

    try {
      const payload: any = {
        report_order_id: report.report_order_id,
        defect_type_id: draft.defect_type_id,
        quantity: Number(draft.quantity),
        unit: draft.unit || '',
      }
      // 工序可选：有就传，没有就不传
      if (resolvedProcessId) payload.process_id = resolvedProcessId

      const r: any = await api.post('/production/process-defects', payload)
      if (!r?.success) throw new Error(r?.message || '保存失败')

      const saved = r.data
      const t = scrapTypes.find(x => x.defect_id === draft.defect_type_id)
      const newRow: ScrapRow = {
        id: saved.defect_id,
        scrap_id: saved.defect_id,
        defect_type_id: saved.defect_type_id,
        defect_code: t?.defect_code,
        defect_name: t?.defect_name,
        defect_type: '检验报废',
        quantity: Number(saved.quantity),
        _isNew: false,
      }
      setRows(prev => [...prev, newRow])
      Toast.show({ content: '已添加', icon: 'success' })
      setDraft({ quantity: 0 })
    } catch (e: any) {
      Toast.show({ content: e?.message || '保存失败', icon: 'fail' })
    }
  }, [draft, report.report_order_id, resolvedProcessId, scrapTypes, setRows])

  const handleDel = useCallback(async (row: ScrapRow) => {
    const ok = await Dialog.confirm({ content: '删除该报废记录？', confirmText: '删除', cancelText: '取消' })
    if (!ok) return
    try {
      const id = row.scrap_id ?? row.id
      if (id) await api.delete(`/production/process-defects/${id}`)
      setRows(prev => prev.filter(r => (r.scrap_id ?? r.id) !== id))
      Toast.show({ content: '已删除', icon: 'success' })
    } catch (e: any) {
      Toast.show({ content: e?.message || '删除失败', icon: 'fail' })
    }
  }, [setRows])

  const selStyle: React.CSSProperties = {
    flex: 2, minWidth: 110, padding: '7px 8px', borderRadius: 6,
    border: '1px solid #ddd', fontSize: 12, background: '#fff',
  }
  const inputStyle: React.CSSProperties = {
    flex: 1, minWidth: 60, padding: '7px 8px', borderRadius: 6,
    border: '1px solid #ddd', fontSize: 12, background: '#fff',
  }

  return (
    <div>
      {/* 工序提示（复用工序报工的当前工序，只读展示） */}
      <div style={{ fontSize: 11, color: '#888', padding: '4px 0 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
        📌 存储工序:
        {resolvedProcessId
          ? <b style={{ color: '#1890ff', fontSize: 12 }}>{processes.find(p => p.process_id === resolvedProcessId)?.process_name || '—'}</b>
          : <span style={{ color: '#f44336' }}>未选（请到工序报工选择）</span>}
      </div>

      {/* 列表 */}
      {rows.length > 0 && rows.map((row) => (
        <div key={String(row.scrap_id ?? row.id)} style={{
          padding: '10px 0', borderTop: '1px solid #f0f0f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#333' }}>
              {row.defect_code && <span style={{ color: '#999', fontSize: 11, marginRight: 6 }}>{row.defect_code}</span>}
              {row.defect_name || '—'}
            </div>
            {row.defect_type && <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{row.defect_type}</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span style={{ color: '#f44336', fontWeight: 700, fontSize: 16 }}>×{row.quantity}</span>
            {editable && (
              <Button size="mini" fill="outline" onClick={() => handleDel(row)}>删</Button>
            )}
          </div>
        </div>
      ))}
      {rows.length === 0 && (
        <div style={{ textAlign: 'center', padding: 20, color: '#bbb', fontSize: 12 }}>— 暂无报废记录 —</div>
      )}

      {/* 新增（单行布局） */}
      {editable && (
        <div style={{ borderTop: '1px dashed #ddd', paddingTop: 10, marginTop: 6 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={draft.defect_type_id || ''}
              onChange={(e) => setDraft(d => ({ ...d, defect_type_id: e.target.value ? Number(e.target.value) : null }))}
              style={selStyle}
            >
              <option value="">报废项目</option>
              {scrapTypes.map(t => (
                <option key={t.defect_id} value={t.defect_id}>{t.defect_code} {t.defect_name}</option>
              ))}
            </select>
            <input
              type="number" min={0} value={draft.quantity || ''}
              onChange={(e) => setDraft(d => ({ ...d, quantity: Number(e.target.value) || 0 }))}
              placeholder="数量"
              style={{ width: 60, padding: '7px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12, background: '#fff' }}
            />
            <input
              value={draft.unit || ''}
              onChange={(e) => setDraft(d => ({ ...d, unit: e.target.value }))}
              placeholder="单位"
              style={{ width: 60, padding: '7px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12, background: '#fff' }}
            />
            <Button size="mini" color="primary" onClick={handleAdd} style={{ flexShrink: 0 }}>添加</Button>
          </div>
        </div>
      )}
    </div>
  )
}
