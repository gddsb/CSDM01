/**
 * 工单报废记录面板
 * —— 工单级（不分工序），Tab: 报废
 *
 * 后端接口：
 *   GET  /production/scrap-defects?report_order_id=xxx
 *   POST /production/scrap-defects
 *   PUT  /production/scrap-defects/:id
 *   DEL  /production/scrap-defects/:id
 *
 * 报废类型从 defect_types 字典来，category_name='制程检验类型' AND defect_type='检验报废'
 */
import { useCallback, useState } from 'react'
import React from 'react'
import { Button, Dialog, Toast } from 'antd-mobile'
import api from '../../../utils/api'
import type { DefectType, ReportOrder, ScrapRow } from './types'

interface Props {
  report: ReportOrder
  editable: boolean
  /** 报废类型下拉选项（已在主文件 preload 好） */
  scrapTypes: DefectType[]
  rows: ScrapRow[]
  setRows: (updater: (prev: ScrapRow[]) => ScrapRow[]) => void
}

export function ScrapPanel({ report, editable, scrapTypes, rows, setRows }: Props) {
  const [draft, setDraft] = useState<ScrapRow>({ quantity: 0 })

  const resetDraft = () => setDraft({ quantity: 0 })

  const handleAdd = useCallback(async () => {
    if (!draft.defect_type_id) { Toast.show({ content: '请选报废项目', icon: 'fail' }); return }
    if (!draft.quantity || draft.quantity <= 0) { Toast.show({ content: '数量 > 0', icon: 'fail' }); return }
    try {
      const payload = {
        report_order_id: report.report_order_id,
        defect_type_id: draft.defect_type_id,
        quantity: draft.quantity,
      }
      const r: any = await api.post('/production/scrap-defects', payload)
      if (!r.success) throw new Error(r.message || '保存失败')
      const newRow: ScrapRow = {
        ...draft,
        id: r.data?.scrap_id ?? Date.now(),
        scrap_id: r.data?.scrap_id,
        defect_code: scrapTypes.find(t => t.defect_id === draft.defect_type_id)?.defect_code,
        defect_name: scrapTypes.find(t => t.defect_id === draft.defect_type_id)?.defect_name,
        defect_type: '检验报废',
      }
      setRows(prev => [...prev, newRow])
      Toast.show({ content: '已添加', icon: 'success' })
      resetDraft()
    } catch (e: any) {
      Toast.show({ content: e?.message || '保存失败', icon: 'fail' })
    }
  }, [draft, report.report_order_id, scrapTypes, setRows])

  const handleDel = useCallback(async (row: ScrapRow) => {
    const ok = await Dialog.confirm({ content: '删除该报废记录？', confirmText: '删除', cancelText: '取消' })
    if (!ok) return
    try {
      if (row.scrap_id) await api.delete(`/production/scrap-defects/${row.scrap_id}`)
      setRows(prev => prev.filter(r => r !== row))
      Toast.show({ content: '已删除', icon: 'success' })
    } catch (e: any) {
      Toast.show({ content: e?.message || '删除失败', icon: 'fail' })
    }
  }, [setRows])

  const selStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid #e0e0e0', fontSize: 14, background: '#fff',
  }
  const inputStyle: React.CSSProperties = {
    flex: 1, padding: '10px 12px', borderRadius: 8,
    border: '1px solid #e0e0e0', fontSize: 15,
  }

  return (
    <div>
      {/* 列表 */}
      {rows.length > 0 && rows.map((row) => (
        <div key={String(row.id)} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 0', borderTop: '1px solid #f0f0f0',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, color: '#333', fontWeight: 500 }}>
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

      {/* 新增 */}
      {editable && (
        <div style={{
          borderTop: '1px dashed #ddd', paddingTop: 10, marginTop: 6,
        }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>➕ 新增报废</div>
          <select
            value={draft.defect_type_id || ''}
            onChange={(e) => {
              const id = e.target.value ? Number(e.target.value) : null
              const t = scrapTypes.find(x => x.defect_id === id)
              setDraft(d => ({ ...d, defect_type_id: id }))
            }}
            style={selStyle}
          >
            <option value="">请选择报废项目</option>
            {scrapTypes.map(t => (
              <option key={t.defect_id} value={t.defect_id}>
                {t.defect_code} {t.defect_name}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <input
              type="number" min={0} value={draft.quantity || ''}
              onChange={(e) => setDraft(d => ({ ...d, quantity: Number(e.target.value) || 0 }))}
              placeholder="数量"
              style={inputStyle}
            />
            <Button size="mini" color="primary" onClick={handleAdd}>添加</Button>
          </div>
        </div>
      )}
    </div>
  )
}
