/**
 * 工序投料（物料）记录面板（工序级）
 * —— Tab: 投料
 *
 * 字段对齐 PC ProcessReporting:
 *   - 物料类型（投入 / 退回）
 *   - 料号（Popup 搜索面板选择）
 *   - 料品名称 + 规格（从主数据自动带出）
 *   - 批号（material_batch）
 *   - 包号（package_no）
 *   - 数量
 *   - 标签图片（ProcessImageUploader，存 label_images JSON）
 *
 * 退回料品规则：
 *   - 只能从当前工序已保存的 "投入" 记录里选
 *   - 数量不能超过原投入汇总数量
 *   - 批次/包号自动带出原投入记录的值（退回用同一批次）
 *
 * 后端接口：
 *   POST /production/process-materials       (body 含 label_images: string[])
 *   PUT  /production/process-materials/:id
 *   DEL  /production/process-materials/:id
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import React from 'react'
import { Button, Dialog, Input, Popup, Toast } from 'antd-mobile'
import api from '../../../utils/api'
import { ProcessImageUploader } from './ProcessImageUploader'
import { fmtInt } from '../../utils/format'
import type { MaterialMaster, MaterialRow, ReportOrder } from './types'

interface Props {
  report: ReportOrder
  activeProcessId: number | null
  editable: boolean
  /** 料品主数据列表（主文件 preload） */
  materials: MaterialMaster[]
  allMaterials: MaterialRow[]
  setAllMaterials: (updater: (prev: MaterialRow[]) => MaterialRow[]) => void
  onDirtyChange?: (dirty: boolean) => void
}

function parseImages(raw: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter((v: unknown) => typeof v === 'string' && v.trim())
  if (typeof raw === 'string') {
    try { return JSON.parse(raw).filter((v: unknown) => typeof v === 'string' && v.trim()) } catch { return [] }
  }
  return []
}

/** 退回料品映射 key → 原投入汇总信息 */
interface ReturnableInfo {
  bas_material_id: string
  totalInputQty: number
  material_code?: string
  material_name?: string
  specification?: string
  material_batch?: string
  package_no?: string
}

export function ProcessMaterialPanel({
  report, activeProcessId, editable, materials, allMaterials, setAllMaterials, onDirtyChange,
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
  // 批号/包号/数量：受控 input（value={draft.xxx} + onChange → setDraft）— 与 state 直接绑定，无需 ref+useEffect 同步

  // 料品选择器 Popup
  const [showPicker, setShowPicker] = useState(false)
  const [pickerKeyword, setPickerKeyword] = useState('')

  useEffect(() => {
    onDirtyChange?.(expandedId !== null)
    return () => { onDirtyChange?.(false) }
  }, [expandedId, onDirtyChange])

  // ========== 退回料品候选：当前工序已保存的 "投入" 记录去重汇总 ==========
  const returnableMap = useMemo(() => {
    const m = new Map<string, ReturnableInfo>()
    for (const row of processMaterials) {
      if (row.material_type !== '投入' || !row.bas_material_id) continue
      if (String(row.process_id) !== String(activeProcessId)) continue
      const key = row.bas_material_id
      const existing = m.get(key)
      if (existing) {
        existing.totalInputQty += Number(row.quantity || 0)
      } else {
        m.set(key, {
          bas_material_id: key,
          totalInputQty: Number(row.quantity || 0),
          material_code: row.material_code,
          material_name: row.material_name,
          specification: row.specification,
          material_batch: row.material_batch,
          package_no: row.package_no,
        })
      }
    }
    return m
  }, [processMaterials, activeProcessId])

  // ========== 当前候选列表：投入=全量 / 退回=returnable ==========
  const candidateList = useMemo(() => {
    if (draft.material_type === '退回') {
      // 退回：把 returnableMap 转成 MaterialMaster 格式
      return Array.from(returnableMap.values()).map(r => ({
        bas_material_id: r.bas_material_id,
        material_code: r.material_code || '',
        material_name: r.material_name || '',
        specification: r.specification,
      }))
    }
    // 投入：全量主数据
    return materials
  }, [draft.material_type, returnableMap, materials])

  // ========== 搜索过滤 ==========
  const filteredList = useMemo(() => {
    const kw = pickerKeyword.trim().toLowerCase()
    if (!kw) return candidateList
    return candidateList.filter(m =>
      (m.material_code || '').toLowerCase().includes(kw) ||
      (m.material_name || '').toLowerCase().includes(kw) ||
      (m.specification || '').toLowerCase().includes(kw),
    )
  }, [candidateList, pickerKeyword])

  // ========== 当前选中料品的退回上限 ==========
  const currentReturnLimit = useMemo(() => {
    if (draft.material_type !== '退回' || !draft.bas_material_id) return 0
    return returnableMap.get(draft.bas_material_id)?.totalInputQty || 0
  }, [draft.material_type, draft.bas_material_id, returnableMap])

  // ========== 选中料品 ==========
  const handlePickMaterial = (basMaterialId: string) => {
    setShowPicker(false)
    setPickerKeyword('')
    if (!basMaterialId) return

    // 优先从 candidateList 找（退回场景只在这里有），否则从全量 materials 找
    const m = candidateList.find(x => x.bas_material_id === basMaterialId)
           || materials.find(x => x.bas_material_id === basMaterialId)

    if (draft.material_type === '退回') {
      // 退回：自动带出原投入的批次/包号 + 限制数量上限
      const rinfo = returnableMap.get(basMaterialId)
      const nextDraft: MaterialRow = {
        ...draft,
        bas_material_id: basMaterialId,
        material_code: m?.material_code,
        material_name: m?.material_name,
        specification: m?.specification,
        material_batch: rinfo?.material_batch || draft.material_batch || '',
        package_no: rinfo?.package_no || draft.package_no || '',
        quantity: rinfo?.totalInputQty || draft.quantity || 0,
      }
      setDraft(nextDraft)
      Toast.show({ content: '已带出原投入批次信息', position: 'bottom' })
    } else {
      setDraft(d => ({
        ...d,
        bas_material_id: basMaterialId,
        material_code: m?.material_code,
        material_name: m?.material_name,
        specification: m?.specification,
      }))
    }
  }

  // ========== 动作 ==========
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
  const cancelEdit = () => {
    setExpandedId(null)
    setDraft({ material_type: '投入', quantity: 0 })
  }

  // 切换物料类型时，清空料品选择（投入/退回候选互斥）
  const handleTypeChange = (newType: '投入' | '退回') => {
    if (draft.material_type === newType) return
    // 切换到退回时，如果没有可退回的投入记录，直接提示
    if (newType === '退回' && returnableMap.size === 0) {
      Toast.show({ content: '当前工序暂无投入记录可退回', icon: 'fail', position: 'bottom' })
      return
    }
    const nextDraft: MaterialRow = {
      ...draft,
      material_type: newType,
      bas_material_id: undefined,
      material_code: undefined,
      material_name: undefined,
      specification: undefined,
      material_batch: newType === '投入' ? '' : draft.material_batch,
      package_no: newType === '投入' ? '' : draft.package_no,
      quantity: 0,
    }
    setDraft(nextDraft)
    // 注意：expandedId 不是 '__new__'/null 时 useEffect 会自动 sync
    // 如果当前是新增态（expandedId='__new__'），保持 input 空即可，不需要手动 sync
  }

  const handleSave = useCallback(async () => {
    if (!draft.bas_material_id) { Toast.show({ content: '请选料品', icon: 'fail' }); return }
    // 受控 input：draft 就是最新值，直接读
    const qty = Number(draft.quantity) || 0
    if (qty <= 0) { Toast.show({ content: '数量 > 0', icon: 'fail' }); return }
    // 退回不能超过原投入
    if (draft.material_type === '退回' && currentReturnLimit > 0 && qty > currentReturnLimit) {
      Toast.show({ content: `退回数量不能超过原投入 ${fmtInt(currentReturnLimit)}`, icon: 'fail', position: 'bottom' })
      return
    }

    const labelImages = Array.isArray(draft.label_images) ? draft.label_images : []
    const payload: any = {
      report_order_id: report.report_order_id,
      process_id: activeProcessId,
      material_type: draft.material_type || '投入',
      bas_material_id: draft.bas_material_id,
      material_batch: draft.material_batch || null,
      package_no: draft.package_no || null,
      quantity: qty,
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
      onDirtyChange?.(false)
    } catch (e: any) { Toast.show({ content: e?.message || '保存失败', icon: 'fail' }) }
  }, [draft, expandedId, report.report_order_id, activeProcessId, allMaterials, setAllMaterials, currentReturnLimit])

  const handleDel = useCallback(async (row: MaterialRow) => {
    const ok = await Dialog.confirm({ content: '删除该投料记录？', confirmText: '删除', cancelText: '取消' })
    if (!ok) return
    try {
      if (row.material_id) await api.delete(`/production/process-materials/${row.material_id}`)
      setAllMaterials(prev => prev.filter(m => m.material_id !== row.material_id))
      Toast.show({ content: '已删除', icon: 'success' })
    } catch (e: any) { Toast.show({ content: e?.message || '删除失败', icon: 'fail' }) }
  }, [setAllMaterials])

  // ========== UI 组件 ==========
  const typeSelectStyle: React.CSSProperties = {
    width: 70, padding: '7px 8px', borderRadius: 6, border: '1px solid #ddd',
    fontSize: 12, background: 'var(--m-surface)', flexShrink: 0,
  }
  const inputStyle: React.CSSProperties = {
    padding: '7px 8px', borderRadius: 6, border: '1px solid #ddd',
    fontSize: 12, background: 'var(--m-surface)',
  }
  // 料品选择按钮样式（模拟原生 select 外观）
  const materialBtnStyle: React.CSSProperties = {
    flex: 1, padding: '7px 8px', borderRadius: 6, border: '1px solid #ddd',
    fontSize: 12, background: 'var(--m-surface)', color: 'var(--m-text)',
    textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  }

  /** 表单 JSX（直接内联，不通过局部函数组件 —— 避免受控 input onChange 触发 re-render 时函数引用变化导致 React remount DOM 丢焦点）
   * 两个使用点各写一份，没有隐式魔法 */
  const formRow1 = (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <select value={draft.material_type || '投入'} onChange={(e) => handleTypeChange(e.target.value as any)}
        style={typeSelectStyle}>
        <option value="投入">投入</option>
        <option value="退回">退回</option>
      </select>
      <Button size="mini" block style={materialBtnStyle} onClick={() => setShowPicker(true)}>
        <span style={{
          color: draft.bas_material_id ? 'var(--m-text)' : 'var(--m-text-3)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {draft.bas_material_id
            ? `${draft.material_code || ''} ${draft.material_name || ''}`.trim()
            : draft.material_type === '退回' ? '选退回料品（仅当前工序已投入）' : '选料品'}
        </span>
        <span style={{ color: 'var(--m-text-3)', fontSize: 12, marginLeft: 4 }}>›</span>
      </Button>
    </div>
  )
  const formRow2 = (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
      <input placeholder="批号"
        value={draft.material_batch ?? ''}
        onChange={(e) => setDraft(d => ({ ...d, material_batch: e.target.value }))}
        disabled={draft.material_type === '退回'}
        style={{ ...inputStyle, flex: 2, minWidth: 70, cursor: draft.material_type === '退回' ? 'not-allowed' : 'text', opacity: draft.material_type === '退回' ? 0.65 : 1 }} />
      <input placeholder="包号"
        value={draft.package_no ?? ''}
        onChange={(e) => setDraft(d => ({ ...d, package_no: e.target.value }))}
        disabled={draft.material_type === '退回'}
        style={{ ...inputStyle, flex: 2, minWidth: 70, cursor: draft.material_type === '退回' ? 'not-allowed' : 'text', opacity: draft.material_type === '退回' ? 0.65 : 1 }} />
      <input type="number" min={0}
        value={draft.quantity ?? ''}
        onChange={(e) => setDraft(d => ({ ...d, quantity: Number(e.target.value) || 0 }))}
        max={currentReturnLimit > 0 ? currentReturnLimit : undefined}
        placeholder={draft.material_type === '退回' ? `≤${fmtInt(currentReturnLimit || 0)}` : '数量'}
        style={{ ...inputStyle, width: 60 }} />
      <Button size="mini" color="primary" onClick={handleSave} style={{ flexShrink: 0 }}>保存</Button>
      <Button size="mini" fill="outline" onClick={cancelEdit} style={{ flexShrink: 0 }}>取消</Button>
      {draft.material_id && (
        <Button size="mini" fill="outline" onClick={() => handleDel(draft as MaterialRow)} style={{ flexShrink: 0 }}>删除</Button>
      )}
    </div>
  )
  const formImage = (
    <div style={{ marginTop: 8 }}>
      <ProcessImageUploader
        reportNo={report.report_no} category="label"
        value={Array.isArray(draft.label_images) ? draft.label_images : []}
        onChange={(urls) => setDraft(d => ({ ...d, label_images: urls }))}
        label="标签图片"
      />
    </div>
  )

  return (
    <div>
      {/* ========== 只读列表 ========== */}
      {processMaterials.length > 0 && processMaterials.map((row) => {
        const rowKey = row.material_id || row.id
        const isExpanded = expandedId === rowKey

        if (isExpanded) {
          return (
            <div key={rowKey} style={{ borderTop: '1px solid #e8e8e8', paddingTop: 10, marginTop: 6 }}>
              {formRow1}{formRow2}{formImage}
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
                  数量 ×{fmtInt(row.quantity)}
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

      {/* ========== 新增投料表单 ========== */}
      {expandedId === '__new__' && (
        <div style={{ borderTop: '1px dashed #ddd', paddingTop: 10, marginTop: 6 }}>
          {formRow1}{formRow2}{formImage}
        </div>
      )}

      {!activeProcessId && (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--m-text-3)', fontSize: 12 }}>请先选择工序</div>
      )}

      {/* ========== 料品选择器 Popup ========== */}
      <Popup
        visible={showPicker}
        onMaskClick={() => { setShowPicker(false); setPickerKeyword('') }}
        position="bottom"
        bodyStyle={{ maxHeight: '70vh', borderRadius: '12px 12px 0 0', overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #eee' }}>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>
            {draft.material_type === '退回' ? '选退回料品' : '选料品'}
            <span style={{ color: 'var(--m-text-3)', fontSize: 11, marginLeft: 6, fontWeight: 400 }}>
              （{filteredList.length}/{candidateList.length}）
            </span>
          </div>
          <div
            onClick={() => { setShowPicker(false); setPickerKeyword('') }}
            style={{ fontSize: 20, color: 'var(--m-text-3)', padding: '0 8px', cursor: 'pointer' }}
          >✕</div>
        </div>
        <div style={{ padding: '8px 12px' }}>
          <Input
            placeholder="🔍 搜索料号/名称/规格"
            value={pickerKeyword}
            onChange={(v) => setPickerKeyword(v)}
            style={{ '--font-size': '14px' }}
            clearable
          />
        </div>
        <div style={{ maxHeight: 'calc(70vh - 100px)', overflowY: 'auto', padding: '0 12px 20px' }}>
          {draft.material_type === '退回' && returnableMap.size === 0 && (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--m-text-3)', fontSize: 12 }}>
              当前工序暂无投入记录可退回
            </div>
          )}
          {draft.material_type === '退回' && returnableMap.size > 0 && filteredList.length === 0 && (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--m-text-3)', fontSize: 12 }}>
              无匹配料品
            </div>
          )}
          {candidateList.length > 0 && filteredList.length === 0 && draft.material_type !== '退回' && (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--m-text-3)', fontSize: 12 }}>无匹配料品</div>
          )}
          {filteredList.map((m) => {
            // 退回场景：显示原投入汇总数量
            const rinfo = draft.material_type === '退回' ? returnableMap.get(m.bas_material_id) : null
            const isSelected = draft.bas_material_id === m.bas_material_id
            return (
              <div key={m.bas_material_id}
                onClick={() => handlePickMaterial(m.bas_material_id)}
                style={{
                  padding: '10px 8px', borderBottom: '1px solid #f5f5f5',
                  cursor: 'pointer',
                  background: isSelected ? 'var(--m-surface-2, #f5f5f5)' : 'transparent',
                }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>
                  {m.material_code && <span style={{ color: 'var(--m-text-3)', fontSize: 11, marginRight: 6 }}>{m.material_code}</span>}
                  {m.material_name || '—'}
                  {isSelected && <span style={{ color: 'var(--brand-color)', marginLeft: 6 }}>✓</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--m-text-3)', marginTop: 2 }}>
                  {m.specification && <span>{m.specification}</span>}
                  {rinfo && (
                    <span style={{ marginLeft: m.specification ? 8 : 0, color: '#f44336' }}>
                      原投入 ×{fmtInt(rinfo.totalInputQty)}
                      {rinfo.material_batch && <span style={{ marginLeft: 4 }}>批:{rinfo.material_batch}</span>}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Popup>
    </div>
  )
}
