/**
 * 工序投料（物料）记录面板（工序级）
 * —— Tab: 投料
 *
 * 字段对齐 PC ProcessReporting:
 *   - 物料类型（投入 / 退回）
 *   - 料号（Select 从 /basic/materials 主数据来，带搜索）
 *   - 料品名称 + 规格（从主数据自动带出）
 *   - 批号（material_batch）
 *   - 包号（package_no）
 *   - 数量
 *   - 标签图片（ProcessImageUploader，存 label_images JSON）
 *
 * 后端接口：
 *   POST /production/process-materials       (body 含 label_images: string[])
 *   PUT  /production/process-materials/:id
 *   DEL  /production/process-materials/:id
 *
 * ProcessMaterial 模型核心字段：
 *   material_type: CHAR(4) '投入'|'退回'
 *   bas_material_id: VARCHAR(36) → MaterialMaster.bas_material_id
 *   material_batch: VARCHAR(64)
 *   package_no: VARCHAR(64)
 *   quantity: DECIMAL
 *   label_images: TEXT (JSON)
 */
import { useCallback, useMemo, useState } from 'react'
import React from 'react'
import { Button, Dialog, Toast } from 'antd-mobile'
import api from '../../../utils/api'
import { ProcessImageUploader } from './ProcessImageUploader'
import type { MaterialMaster, MaterialRow, ReportOrder } from './types'

interface Props {
  report: ReportOrder
  activeProcessId: number | null
  editable: boolean
  /** 料品主数据列表（主文件 preload） */
  materials: MaterialMaster[]
  allMaterials: MaterialRow[]
  setAllMaterials: (updater: (prev: MaterialRow[]) => MaterialRow[]) => void
}

function parseImages(raw: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter(Boolean) as string[]
  if (typeof raw === 'string') {
    try { return JSON.parse(raw).filter(Boolean) } catch { return [] }
  }
  return []
}

export function ProcessMaterialPanel({
  report, activeProcessId, editable, materials, allMaterials, setAllMaterials,
}: Props) {
  const processMaterials = useMemo(
    () => allMaterials.filter(m => String(m.process_id) === String(activeProcessId)),
    [allMaterials, activeProcessId],
  )

  const [expandedId, setExpandedId] = useState<number | string | null>(null)
  const [draft, setDraft] = useState<MaterialRow>({
    material_type: '投入',
    quantity: 0,
  })

  const startAdd = () => {
    setDraft({
      report_order_id: report.report_order_id,
      process_id: activeProcessId || undefined,
      material_type: '投入',
      quantity: 0,
    })
    setExpandedId('__new__')
  }
  const startEdit = (row: MaterialRow) => {
    setDraft({ ...row, label_images: parseImages(row.label_images) })
    setExpandedId(row.id || row.material_id! || '__unknown__')
  }
  const cancelEdit = () => { setExpandedId(null); setDraft({ material_type: '投入', quantity: 0 }) }

  const handleMaterialSelect = (basMaterialId: string) => {
    const m = materials.find(x => x.bas_material_id === basMaterialId)
    setDraft(d => ({
      ...d,
      bas_material_id: basMaterialId || undefined,
      material_code: m?.material_code || undefined,
      material_name: m?.material_name || undefined,
      specification: m?.specification || undefined,
    }))
  }

  const handleSave = useCallback(async () => {
    if (!draft.bas_material_id) { Toast.show({ content: '请选料号', icon: 'fail' }); return }
    if (!draft.quantity || draft.quantity <= 0) { Toast.show({ content: '数量 > 0', icon: 'fail' }); return }

    const labelImages = Array.isArray(draft.label_images) ? draft.label_images : []
    const payload: any = {
      report_order_id: report.report_order_id,
      process_id: activeProcessId,
      material_type: draft.material_type || '投入',
      bas_material_id: draft.bas_material_id,
      material_batch: draft.material_batch || null,
      package_no: draft.package_no || null,
      quantity: Number(draft.quantity),
      label_images: labelImages,
    }
    try {
      let r: any
      if (expandedId === '__new__' || !draft.material_id) {
        r = await api.post('/production/process-materials', payload)
      } else {
        r = await api.put(`/production/process-materials/${draft.material_id}`, payload)
      }
      if (!r.success) throw new Error(r.message || '保存失败')

      const saved = r.data
      const idx = allMaterials.findIndex(m => m.material_id === saved.material_id || m.id === expandedId)
      const merged: MaterialRow = {
        id: saved.material_id,
        material_id: saved.material_id,
        report_order_id: saved.report_order_id,
        process_id: saved.process_id,
        material_type: saved.material_type,
        bas_material_id: saved.bas_material_id,
        material_code: saved.material_code ?? draft.material_code,
        material_name: saved.material_name ?? draft.material_name,
        specification: saved.specification ?? draft.specification,
        material_batch: saved.material_batch,
        package_no: saved.package_no,
        quantity: Number(saved.quantity),
        label_images: saved.label_images || labelImages,
      }
      setAllMaterials(prev => idx >= 0 ? prev.map(m => m.id === merged.id ? merged : m) : [...prev, merged])
      Toast.show({ content: '已保存', icon: 'success' })
      cancelEdit()
    } catch (e: any) { Toast.show({ content: e?.message || '保存失败', icon: 'fail' }) }
  }, [draft, expandedId, report.report_order_id, activeProcessId, allMaterials, setAllMaterials])

  const handleDel = useCallback(async (row: MaterialRow) => {
    const ok = await Dialog.confirm({ content: '删除该投料记录？', confirmText: '删除', cancelText: '取消' })
    if (!ok) return
    try {
      if (row.material_id) await api.delete(`/production/process-materials/${row.material_id}`)
      setAllMaterials(prev => prev.filter(m => m.material_id !== row.material_id))
      Toast.show({ content: '已删除', icon: 'success' })
    } catch (e: any) { Toast.show({ content: e?.message || '删除失败', icon: 'fail' }) }
  }, [setAllMaterials])

  const selStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--m-border)', fontSize: 14, background: 'var(--m-surface)',
  }
  const inputStyle: React.CSSProperties = {
    padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--m-border)', fontSize: 14, background: 'var(--m-surface)',
  }

  return (
    <div>
      {/* 只读列表 */}
      {processMaterials.length > 0 && processMaterials.map((row) => {
        const rowKey = row.material_id || row.id
        const isExpanded = expandedId === rowKey

        if (isExpanded) {
          return (
            <div key={rowKey} style={{ borderTop: '1px solid #e8e8e8', paddingTop: 10, marginTop: 6 }}>
              {/* 行1：类型 + 料品 同一行 */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <select value={draft.material_type || '投入'} onChange={(e) => setDraft(d => ({ ...d, material_type: e.target.value as any }))}
                  style={{ width: 70, padding: '7px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12, background: 'var(--m-surface)' }}>
                  <option value="投入">投入</option>
                  <option value="退回">退回</option>
                </select>
                <select value={draft.bas_material_id || ''} onChange={(e) => handleMaterialSelect(e.target.value)}
                  style={{ flex: 1, padding: '7px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12, background: 'var(--m-surface)' }}>
                  <option value="">料品</option>
                  {materials.map(m => (
                    <option key={m.bas_material_id} value={m.bas_material_id}>
                      {m.material_code} {m.material_name}
                    </option>
                  ))}
                </select>
              </div>
              {draft.material_name && (
                <div style={{ fontSize: 11, color: 'var(--brand-color)', marginTop: 3, marginBottom: 4 }}>
                  自动带出: {draft.material_name} {draft.specification && `· ${draft.specification}`}
                </div>
              )}
              {/* 行2：批号 + 包号 + 数量 + 保存/取消 同一行 */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                <input placeholder="批号" value={draft.material_batch || ''}
                  onChange={(e) => setDraft(d => ({ ...d, material_batch: e.target.value }))}
                  style={{ flex: 2, minWidth: 70, padding: '7px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12, background: 'var(--m-surface)' }} />
                <input placeholder="包号" value={draft.package_no || ''}
                  onChange={(e) => setDraft(d => ({ ...d, package_no: e.target.value }))}
                  style={{ flex: 2, minWidth: 70, padding: '7px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12, background: 'var(--m-surface)' }} />
                <input type="number" min={0} placeholder="数量" value={draft.quantity || ''}
                  onChange={(e) => setDraft(d => ({ ...d, quantity: Number(e.target.value) || 0 }))}
                  style={{ width: 60, padding: '7px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12, background: 'var(--m-surface)' }} />
                <Button size="mini" color="primary" onClick={handleSave} style={{ flexShrink: 0 }}>保存</Button>
                <Button size="mini" fill="outline" onClick={cancelEdit} style={{ flexShrink: 0 }}>取消</Button>
                {draft.material_id && (
                  <Button size="mini" fill="outline" onClick={() => handleDel(draft as MaterialRow)} style={{ flexShrink: 0 }}>删除</Button>
                )}
              </div>
              {/* 标签图片 */}
              <div style={{ marginTop: 8 }}>
                <ProcessImageUploader
                  reportNo={report.report_no} category="label"
                  value={Array.isArray(draft.label_images) ? draft.label_images : []}
                  onChange={(urls) => setDraft(d => ({ ...d, label_images: urls }))}
                  label="标签图片"
                />
              </div>
            </div>
          )
        }

        return (
          <div key={rowKey} onClick={() => editable && startEdit(row)} style={{
            padding: '10px 0', borderTop: '1px solid #f0f0f0', cursor: editable ? 'pointer' : 'default',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: row.material_type === '退回' ? '#f44336' : 'var(--m-text)' }}>
                  {row.material_code && <span style={{ color: 'var(--m-text-3)', fontSize: 11, marginRight: 6 }}>{row.material_code}</span>}
                  {row.material_name || '—'}
                  {row.material_type === '退回' && <span style={{ color: 'var(--brand-color-danger)', fontSize: 10, marginLeft: 4 }}>[退回]</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--m-text-3)', marginTop: 2 }}>
                  数量 ×{row.quantity}
                  {row.material_batch && <span style={{ marginLeft: 6 }}>批:{row.material_batch}</span>}
                  {row.package_no && <span style={{ marginLeft: 6 }}>包:{row.package_no}</span>}
                  {parseImages(row.label_images).length > 0 && (
                    <span style={{ marginLeft: 6 }}>📷 {parseImages(row.label_images).length} 张</span>
                  )}
                </div>
              </div>
              {editable && <span style={{ color: 'var(--m-text-3)', fontSize: 16 }}>›</span>}
            </div>
          </div>
        )
      })}

      {processMaterials.length === 0 && (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--m-text-3)', fontSize: 12 }}>— 该工序暂无投料记录 —</div>
      )}

      {editable && activeProcessId && expandedId !== '__new__' && (
        <Button size="mini" color="primary" block onClick={startAdd} style={{ marginTop: 6 }}>
          ➕ 新增投料
        </Button>
      )}

      {expandedId === '__new__' && (
        <div style={{ borderTop: '1px dashed #ddd', paddingTop: 10, marginTop: 6 }}>
          {/* 行1：类型 + 料品 同一行 */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <select value={draft.material_type} onChange={(e) => setDraft(d => ({ ...d, material_type: e.target.value as any }))}
              style={{ width: 70, padding: '7px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12, background: 'var(--m-surface)' }}>
              <option value="投入">投入</option>
              <option value="退回">退回</option>
            </select>
            <select value={draft.bas_material_id || ''} onChange={(e) => handleMaterialSelect(e.target.value)}
              style={{ flex: 1, padding: '7px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12, background: 'var(--m-surface)' }}>
              <option value="">料品</option>
              {materials.map(m => (
                <option key={m.bas_material_id} value={m.bas_material_id}>{m.material_code} {m.material_name}</option>
              ))}
            </select>
          </div>
          {draft.material_name && (
            <div style={{ fontSize: 11, color: 'var(--brand-color)', marginTop: 3, marginBottom: 4 }}>
              自动带出: {draft.material_name} {draft.specification && `· ${draft.specification}`}
            </div>
          )}
          {/* 行2：批号 + 包号 + 数量 + 保存/取消 同一行 */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
            <input placeholder="批号" value={draft.material_batch || ''}
              onChange={(e) => setDraft(d => ({ ...d, material_batch: e.target.value }))}
              style={{ flex: 2, minWidth: 70, padding: '7px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12, background: 'var(--m-surface)' }} />
            <input placeholder="包号" value={draft.package_no || ''}
              onChange={(e) => setDraft(d => ({ ...d, package_no: e.target.value }))}
              style={{ flex: 2, minWidth: 70, padding: '7px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12, background: 'var(--m-surface)' }} />
            <input type="number" min={0} placeholder="数量" value={draft.quantity || ''}
              onChange={(e) => setDraft(d => ({ ...d, quantity: Number(e.target.value) || 0 }))}
              style={{ width: 60, padding: '7px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12, background: 'var(--m-surface)' }} />
            <Button size="mini" color="primary" onClick={handleSave} style={{ flexShrink: 0 }}>保存</Button>
            <Button size="mini" fill="outline" onClick={cancelEdit} style={{ flexShrink: 0 }}>取消</Button>
          </div>
          {/* 标签图片 */}
          <div style={{ marginTop: 8 }}>
            <ProcessImageUploader
              reportNo={report.report_no} category="label"
              value={Array.isArray(draft.label_images) ? draft.label_images : []}
              onChange={(urls) => setDraft(d => ({ ...d, label_images: urls }))}
              label="标签图片"
            />
          </div>
        </div>
      )}

      {!activeProcessId && (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--m-text-3)', fontSize: 12 }}>请先选择工序</div>
      )}
    </div>
  )
}
