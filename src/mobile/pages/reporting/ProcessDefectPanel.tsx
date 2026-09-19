/**
 * 工序不良记录面板（工序级）
 * —— Tab: 不良
 *
 * 字段对齐 PC ProcessReporting:
 *   - 不良类型（Select，按工序过滤 related_processes）
 *   - 数量（必须 > 0）
 *   - 单位（联动 DefectType.available_units）
 *   - 不良图片（ProcessImageUploader，存 defect_images JSON）
 *
 * 后端接口：
 *   POST /production/process-defects        (body 含 defect_images: string[])
 *   PUT  /production/process-defects/:id
 *   DEL  /production/process-defects/:id
 *
 * 业务校验：
 *   - 工序必须属于当前报工单（后端 validateProcessBelongsToReportOrder）
 *   - 不良数量不能超该工序报工产出（后端校验）
 */
import { useCallback, useMemo, useState } from 'react'
import React from 'react'
import { Button, Dialog, Toast } from 'antd-mobile'
import api from '../../../utils/api'
import { ProcessImageUploader } from './ProcessImageUploader'
import type { DefectRow, DefectType, ProcessRow, ReportOrder } from './types'

interface Props {
  report: ReportOrder
  activeProcessId: number | null
  editable: boolean
  /** 从 defect_types 字典来，已过滤 category_name='制程检验类型' AND defect_type!='检验报废' */
  defectTypes: DefectType[]
  /** 全量缺陷记录（主文件拉了一次，这里按 process_id 过滤） */
  allDefects: DefectRow[]
  setAllDefects: (updater: (prev: DefectRow[]) => DefectRow[]) => void
}

/** 后端返回的 defect_images 可能是 JSON string 或 null，前端统一转 string[] */
function parseImages(raw: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter(Boolean) as string[]
  if (typeof raw === 'string') {
    try { return JSON.parse(raw).filter(Boolean) } catch { return [] }
  }
  return []
}

export function ProcessDefectPanel({
  report, activeProcessId, editable, defectTypes, allDefects, setAllDefects,
}: Props) {
  // 1. 按当前工序过滤记录
  const processDefects = useMemo(
    () => allDefects.filter(d => String(d.process_id) === String(activeProcessId)),
    [allDefects, activeProcessId],
  )

  // 2. 按当前工序过滤不良类型（related_processes 逻辑）
  const filteredTypes = useMemo(() => {
    if (!activeProcessId) return []
    return defectTypes.filter(t => {
      const rel = Array.isArray(t.related_processes) ? t.related_processes : []
      if (rel.length === 0) return true // 关联工序为空 = 全工序可用
      return rel.some(x => String(x) === String(activeProcessId))
    })
  }, [defectTypes, activeProcessId])

  // 3. 不良类型 → 可用单位
  const getUnitOptions = useCallback((defectTypeId: number | null | undefined): string[] => {
    if (!defectTypeId) return []
    const t = defectTypes.find(x => x.defect_id === defectTypeId)
    if (!t) return []
    if (t.available_units && Array.isArray(t.available_units) && t.available_units.length > 0) {
      return t.available_units
    }
    if (t.defect_unit) return [t.defect_unit]
    return []
  }, [defectTypes])

  // ========== 新增 / 编辑 ==========
  const [expandedId, setExpandedId] = useState<number | string | null>(null) // 哪一行在编辑
  const [draft, setDraft] = useState<DefectRow>({ quantity: 0 })

  const startAdd = () => {
    setDraft({
      report_order_id: report.report_order_id,
      process_id: activeProcessId || undefined,
      quantity: 0,
    })
    setExpandedId('__new__')
  }

  const startEdit = (row: DefectRow) => {
    setDraft({
      ...row,
      defect_images: parseImages(row.defect_images),
    })
    setExpandedId(row.id || row.defect_id! || '__unknown__')
  }

  const cancelEdit = () => {
    setExpandedId(null)
    setDraft({ quantity: 0 })
  }

  const handleSave = useCallback(async () => {
    if (!draft.defect_type_id) { Toast.show({ content: '请选不良类型', icon: 'fail' }); return }
    if (!draft.quantity || draft.quantity <= 0) { Toast.show({ content: '数量 > 0', icon: 'fail' }); return }

    const images = Array.isArray(draft.defect_images) ? draft.defect_images : []
    const payload: any = {
      report_order_id: report.report_order_id,
      process_id: activeProcessId,
      defect_type_id: draft.defect_type_id,
      quantity: Number(draft.quantity),
      unit: draft.unit || '',
      defect_images: images,
    }
    try {
      let r: any
      if (expandedId === '__new__' || !draft.defect_id) {
        r = await api.post('/production/process-defects', payload)
      } else {
        r = await api.put(`/production/process-defects/${draft.defect_id}`, payload)
      }
      if (!r.success) throw new Error(r.message || '保存失败')

      // 把新/更新的记录合并回 allDefects
      const saved = r.data
      const idx = allDefects.findIndex(d => d.defect_id === saved.defect_id || d.id === expandedId)
      const merged: DefectRow = {
        defect_id: saved.defect_id,
        id: saved.defect_id,
        defect_type_id: saved.defect_type_id,
        quantity: Number(saved.quantity),
        unit: saved.unit || '',
        defect_code: filteredTypes.find(t => t.defect_id === saved.defect_type_id)?.defect_code,
        defect_name: filteredTypes.find(t => t.defect_id === saved.defect_type_id)?.defect_name,
        defect_type: filteredTypes.find(t => t.defect_id === saved.defect_type_id)?.defect_type,
        defect_images: saved.defect_images || images,
        report_order_id: saved.report_order_id,
        process_id: saved.process_id,
      }
      setAllDefects(prev => idx >= 0 ? prev.map(d => d.id === merged.id ? merged : d) : [...prev, merged])
      Toast.show({ content: '已保存', icon: 'success' })
      cancelEdit()
    } catch (e: any) {
      Toast.show({ content: e?.message || '保存失败', icon: 'fail' })
    }
  }, [draft, expandedId, report.report_order_id, activeProcessId, allDefects, filteredTypes, setAllDefects])

  const handleDel = useCallback(async (row: DefectRow) => {
    const ok = await Dialog.confirm({ content: '删除该不良记录？', confirmText: '删除', cancelText: '取消' })
    if (!ok) return
    try {
      if (row.defect_id) await api.delete(`/production/process-defects/${row.defect_id}`)
      setAllDefects(prev => prev.filter(d => d.defect_id !== row.defect_id))
      Toast.show({ content: '已删除', icon: 'success' })
    } catch (e: any) { Toast.show({ content: e?.message || '删除失败', icon: 'fail' }) }
  }, [setAllDefects])

  const selStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid #e0e0e0', fontSize: 14, background: '#fff',
  }
  const inputStyle: React.CSSProperties = {
    padding: '10px 12px', borderRadius: 8,
    border: '1px solid #e0e0e0', fontSize: 15,
    background: '#fff',
  }

  return (
    <div>
      {/* 只读列表 */}
      {processDefects.length > 0 && processDefects.map((row) => {
        const rowKey = row.defect_id || row.id
        const isExpanded = expandedId === rowKey
        if (isExpanded) {
          return (
            <div key={rowKey} style={{ borderTop: '1px solid #e8e8e8', paddingTop: 10, marginTop: 6 }}>
              {/* 紧凑一行：类型 + 单位 + 数量 + 保存/取消 */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={draft.defect_type_id || ''}
                  onChange={(e) => {
                    const id = e.target.value ? Number(e.target.value) : null
                    const t = filteredTypes.find(x => x.defect_id === id)
                    const defaultUnit = (t?.available_units && t.available_units[0]) || t?.defect_unit || ''
                    setDraft(d => ({ ...d, defect_type_id: id, unit: d.unit || defaultUnit }))
                  }}
                  style={{ flex: 2, minWidth: 110, padding: '7px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12, background: '#fff' }}
                >
                  <option value="">不良类型</option>
                  {filteredTypes.map(t => (
                    <option key={t.defect_id} value={t.defect_id}>{t.defect_code} {t.defect_name}</option>
                  ))}
                </select>
                <select
                  value={draft.unit || ''}
                  onChange={(e) => setDraft(d => ({ ...d, unit: e.target.value }))}
                  style={{ flex: 1, minWidth: 60, padding: '7px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12, background: '#fff' }}
                >
                  <option value="">单位</option>
                  {getUnitOptions(draft.defect_type_id).map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <input
                  type="number" min={0} value={draft.quantity || ''}
                  onChange={(e) => setDraft(d => ({ ...d, quantity: Number(e.target.value) || 0 }))}
                  placeholder="数量"
                  style={{ width: 70, padding: '7px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12, background: '#fff' }}
                />
                <Button size="mini" color="primary" onClick={handleSave} style={{ flexShrink: 0 }}>保存</Button>
                <Button size="mini" fill="outline" onClick={cancelEdit} style={{ flexShrink: 0 }}>取消</Button>
                {draft.defect_id && (
                  <Button size="mini" fill="outline" onClick={() => handleDel(draft as DefectRow)} style={{ flexShrink: 0 }}>删除</Button>
                )}
              </div>
              {/* 不良图片 */}
              <div style={{ marginTop: 8 }}>
                <ProcessImageUploader
                  reportNo={report.report_no} category="defect"
                  value={Array.isArray(draft.defect_images) ? draft.defect_images : []}
                  onChange={(urls) => setDraft(d => ({ ...d, defect_images: urls }))}
                  label="不良图片"
                />
              </div>
            </div>
          )
        }
        // 只读展示
        return (
          <div key={rowKey} onClick={() => editable && startEdit(row)} style={{
            padding: '10px 0', borderTop: '1px solid #f0f0f0', cursor: editable ? 'pointer' : 'default',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#333' }}>
                  {row.defect_code && <span style={{ color: '#999', fontSize: 11, marginRight: 6 }}>{row.defect_code}</span>}
                  {row.defect_name || '—'}
                  {row.defect_type && <span style={{ color: '#aaa', fontSize: 11, marginLeft: 6 }}>({row.defect_type})</span>}
                </div>
                <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>
                  数量 ×{row.quantity} {row.unit || ''}
                  {parseImages(row.defect_images).length > 0 && (
                    <span style={{ marginLeft: 8 }}>📷 {parseImages(row.defect_images).length} 张图片</span>
                  )}
                </div>
              </div>
              {editable && <span style={{ color: '#ccc', fontSize: 16 }}>›</span>}
            </div>
          </div>
        )
      })}

      {/* 空状态 */}
      {processDefects.length === 0 && (
        <div style={{ textAlign: 'center', padding: 20, color: '#bbb', fontSize: 12 }}>— 该工序暂无不良记录 —</div>
      )}

      {/* 新增按钮 */}
      {editable && activeProcessId && expandedId !== '__new__' && (
        <Button size="mini" color="primary" block onClick={startAdd} style={{ marginTop: 6 }}>
          ➕ 新增不良
        </Button>
      )}
      {/* 新增展开表单 */}
      {expandedId === '__new__' && (
        <div style={{ borderTop: '1px dashed #ddd', paddingTop: 10, marginTop: 6 }}>
          {/* 紧凑一行：类型 + 单位 + 数量 + 保存/取消 */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={draft.defect_type_id || ''}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null
                const t = filteredTypes.find(x => x.defect_id === id)
                const defaultUnit = (t?.available_units && t.available_units[0]) || t?.defect_unit || ''
                setDraft(d => ({ ...d, defect_type_id: id, unit: defaultUnit }))
              }}
              style={{ flex: 2, minWidth: 110, padding: '7px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12, background: '#fff' }}
            >
              <option value="">不良类型</option>
              {filteredTypes.map(t => (
                <option key={t.defect_id} value={t.defect_id}>{t.defect_code} {t.defect_name}</option>
              ))}
            </select>
            <select
              value={draft.unit || ''}
              onChange={(e) => setDraft(d => ({ ...d, unit: e.target.value }))}
              style={{ flex: 1, minWidth: 60, padding: '7px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12, background: '#fff' }}
            >
              <option value="">单位</option>
              {getUnitOptions(draft.defect_type_id).map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <input
              type="number" min={0} value={draft.quantity || ''}
              onChange={(e) => setDraft(d => ({ ...d, quantity: Number(e.target.value) || 0 }))}
              placeholder="数量"
              style={{ width: 70, padding: '7px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12, background: '#fff' }}
            />
            <Button size="mini" color="primary" onClick={handleSave} style={{ flexShrink: 0 }}>保存</Button>
            <Button size="mini" fill="outline" onClick={cancelEdit} style={{ flexShrink: 0 }}>取消</Button>
          </div>
          {/* 不良图片 */}
          <div style={{ marginTop: 8 }}>
            <ProcessImageUploader
              reportNo={report.report_no} category="defect"
              value={Array.isArray(draft.defect_images) ? draft.defect_images : []}
              onChange={(urls) => setDraft(d => ({ ...d, defect_images: urls }))}
              label="不良图片"
            />
          </div>
        </div>
      )}
      {!activeProcessId && (
        <div style={{ textAlign: 'center', padding: 20, color: '#bbb', fontSize: 12 }}>请先选择工序</div>
      )}
    </div>
  )
}
