/**
 * 工序检验报废记录面板（工序报工 → 检验报废 Tab）
 *
 * 业务规则：
 *   - 只能新增，保存后的记录不可修改、不可删除（append-only）
 *   - 报废数据存 ProcessDefect 表，前端按 defect_type='检验报废' 过滤
 *
 * 后端接口：
 *   POST /production/process-defects   (新增)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import React from 'react'
import { Button, Dialog, Picker, Toast } from 'antd-mobile'
import api from '../../../utils/api'
import { fmtInt } from '../../utils/format'
import type { DefectType, ReportOrder, ScrapRow, ProcessRow } from './types'

interface Props {
  report: ReportOrder
  activeProcessId: number | null
  processes: ProcessRow[]
  editable: boolean
  scrapTypes: DefectType[]
  rows: ScrapRow[]
  setRows: (updater: (prev: ScrapRow[]) => ScrapRow[]) => void
  onDirtyChange?: (dirty: boolean) => void
}

/** ProcessDefect 模型用 record_time 作为 createdAt 列（Sequelize 别名） */
function getTime(row: any): string | undefined {
  return row.createdAt || row.record_time || row.created_at
}

/** 按时间倒序（无则用 scrap_id/id） */
function sortDesc(list: ScrapRow[]): ScrapRow[] {
  return [...list].sort((a, b) => {
    const ta = getTime(a) ? new Date(getTime(a)!).getTime() : 0
    const tb = getTime(b) ? new Date(getTime(b)!).getTime() : 0
    if (ta !== tb) return tb - ta
    const ia = Number(a.scrap_id ?? a.id ?? 0)
    const ib = Number(b.scrap_id ?? b.id ?? 0)
    return ib - ia
  })
}

/** 格式化时间：同一天 HH:mm，跨天 MM/DD HH:mm */
function fmtTime(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  if (sameDay) return `${hh}:${mm}`
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mo}/${dd} ${hh}:${mm}`
}

export function ScrapPanel({
  report, activeProcessId, processes, editable, scrapTypes, rows, setRows, onDirtyChange,
}: Props) {
  const [expanded, setExpanded] = useState(false)   // 是否正在添加（空表单展开）
  const [draft, setDraft] = useState<ScrapRow>({ quantity: 0 })

  // dirty 上报：展开状态 + 有填写内容
  const dirty = useMemo(() => {
    if (!expanded) return false
    return !!(draft.defect_type_id) || Number(draft.quantity) > 0
  }, [expanded, draft.defect_type_id, draft.quantity])

  useEffect(() => {
    onDirtyChange?.(dirty)
    return () => { onDirtyChange?.(false) }
  }, [dirty, onDirtyChange])

  const resolvedProcessId = activeProcessId ?? processes[0]?.process_id ?? null
  const sortedRows = useMemo(() => sortDesc(rows), [rows])

  // 报废类型 Picker columns（顶层 useMemo）
  const scrapTypeColumns = useMemo(() => [
    scrapTypes.map(t => ({
      label: `${t.defect_code || ''} ${t.defect_name || ''}`.trim(),
      value: String(t.defect_id),
    })),
  ], [scrapTypes])

  const startAdd = () => {
    setDraft({ quantity: 0 })
    setExpanded(true)
  }
  const cancelAdd = () => {
    setExpanded(false)
    setDraft({ quantity: 0 })
  }

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
        unit: saved.unit || draft.unit || '',
        createdAt: getTime(saved) || new Date().toISOString(),
      }
      setRows(prev => sortDesc([...prev, newRow]))
      Toast.show({ content: '已添加', icon: 'success' })
      cancelAdd()
    } catch (e: any) {
      Toast.show({ content: e?.message || '保存失败', icon: 'fail' })
    }
  }, [draft, report.report_order_id, resolvedProcessId, scrapTypes, setRows])

  const selStyle: React.CSSProperties = {
    flex: 2, minWidth: 110, padding: '7px 8px', borderRadius: 6,
    border: '1px solid var(--m-border)', fontSize: 12, background: 'var(--m-surface)',
  }

  return (
    <div>
      {/* 工序提示 */}
      <div style={{ fontSize: 11, color: 'var(--m-text-3)', padding: '4px 0 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
        📌 存储工序:
        {resolvedProcessId
          ? <b style={{ color: 'var(--brand-color)', fontSize: 12 }}>{processes.find(p => p.process_id === resolvedProcessId)?.process_name || '—'}</b>
          : <span style={{ color: 'var(--brand-color-danger)' }}>未选（请到工序报工选择）</span>}
      </div>

      {/* 添加按钮（独立 block 全宽，未展开时显示——移到最顶部） */}
      {editable && !expanded && (
        <div style={{ marginBottom: 8 }}>
          <Button size="mini" color="primary" block style={{ height: 48, fontSize: 15 }} onClick={startAdd}>
            ➕ 添加检验报废
          </Button>
        </div>
      )}

      {/* 新增表单（展开态——紧跟添加按钮下方） */}
      {expanded && (
        <div style={{ borderTop: '1px dashed var(--m-border)', paddingTop: 10, marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* 报废类型 Picker */}
            {(() => {
              const current = scrapTypes.find(t => t.defect_id === Number(draft.defect_type_id))
              return (
                <Picker
                  columns={scrapTypeColumns}
                  value={draft.defect_type_id ? [String(draft.defect_type_id)] : []}
                  onConfirm={(v) => setDraft(d => ({ ...d, defect_type_id: Number(v[0]) || null }))}
                >
                  {(_items, { open }) => (
                    <div onClick={open} role="button" tabIndex={0} style={{ ...selStyle, color: current ? 'var(--m-text)' : 'var(--m-text-3)' }}>
                      {current ? `${current.defect_code || ''} ${current.defect_name}`.trim() : '报废项目'}
                    </div>
                  )}
                </Picker>
              )
            })()}
            <input
              type="number" min={0} value={draft.quantity || ''}
              onChange={(e) => setDraft(d => ({ ...d, quantity: Number(e.target.value) || 0 }))}
              placeholder="数量"
              style={{ width: 60, padding: '7px 8px', borderRadius: 6, border: '1px solid var(--m-border)', fontSize: 12, background: 'var(--m-surface)' }}
            />
            <input
              value={draft.unit || ''}
              onChange={(e) => setDraft(d => ({ ...d, unit: e.target.value }))}
              placeholder="单位"
              style={{ width: 60, padding: '7px 8px', borderRadius: 6, border: '1px solid var(--m-border)', fontSize: 12, background: 'var(--m-surface)' }}
            />
            <Button size="mini" color="primary" onClick={handleAdd} style={{ flexShrink: 0 }}>保存</Button>
            <Button size="mini" fill="outline" onClick={cancelAdd} style={{ flexShrink: 0 }}>取消</Button>
          </div>
        </div>
      )}

      {/* 列表（纯展示，保存后不可修改/删除） */}
      {sortedRows.length > 0 && sortedRows.map((row) => (
        <div key={String(row.scrap_id ?? row.id)} style={{
          padding: '10px 0', borderTop: '1px solid var(--m-border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--m-text)' }}>
                {row.defect_code && <span style={{ color: 'var(--m-text-3)', fontSize: 11, marginRight: 4 }}>{row.defect_code}</span>}
                {row.defect_name || '—'}
              </span>
              {getTime(row) && (
                <span style={{ fontSize: 11, color: 'var(--m-text-3)', marginLeft: 'auto' }}>
                  {fmtTime(getTime(row))}
                </span>
              )}
            </div>
            {row.defect_type && (
              <div style={{ fontSize: 11, color: 'var(--m-text-3)', marginTop: 2 }}>
                {row.defect_type}
                {row.unit && <span style={{ marginLeft: 6 }}>单位: {row.unit}</span>}
              </div>
            )}
          </div>
          <div style={{ color: 'var(--brand-color-danger)', fontWeight: 700, fontSize: 16, flexShrink: 0, marginLeft: 10 }}>
            ×{fmtInt(row.quantity)}
          </div>
        </div>
      ))}

      {/* 空状态 */}
      {sortedRows.length === 0 && !expanded && (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--m-text-3)', fontSize: 12 }}>— 暂无报废记录 —</div>
      )}
    </div>
  )
}
