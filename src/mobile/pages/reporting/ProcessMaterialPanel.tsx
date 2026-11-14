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
import { Button, Dialog, Input, Picker, Popup, Toast } from 'antd-mobile'
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

/** 退回料品映射 key → 原投入汇总信息（含净投入 = 投入 - 退回） */
interface ReturnableInfo {
  bas_material_id: string
  totalInputQty: number
  totalReturnQty: number  // 已退回总额（不含当前编辑中的）
  netAvailableQty: number // totalInputQty - totalReturnQty
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
    () => allMaterials
      .filter(m => String(m.process_id) === String(activeProcessId))
      .sort((a, b) => {
        // 优先 createdAt 倒序（ProcessMaterial 模型用 record_time 作 createdAt 列），无时间时用 material_id 倒序
        const at = (a as any).createdAt || (a as any).record_time
        const bt = (b as any).createdAt || (b as any).record_time
        const ta = at ? new Date(at).getTime() : 0
        const tb = bt ? new Date(bt).getTime() : 0
        if (ta !== tb) return tb - ta
        const idA = Number(a.material_id ?? a.id ?? 0)
        const idB = Number(b.material_id ?? b.id ?? 0)
        return idB - idA
      }),
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

  // ========== 净投入汇总：当前工序所有记录按 bas_material_id 分组，算投入总额和退回总额 ==========
  // netAvailableQty 才是真正能退回的上限（不是纯 totalInputQty）
  // 同时用于校验：任何保存/修改后净投入不能 < 0
  const returnableMap = useMemo(() => {
    const m = new Map<string, ReturnableInfo>()
    for (const row of processMaterials) {
      if (!row.bas_material_id) continue
      if (String(row.process_id) !== String(activeProcessId)) continue
      const key = row.bas_material_id
      const existing = m.get(key)
      const qty = Number(row.quantity || 0)
      if (existing) {
        if (row.material_type === '投入') existing.totalInputQty += qty
        else if (row.material_type === '退回') existing.totalReturnQty += qty
      } else {
        m.set(key, {
          bas_material_id: key,
          totalInputQty: row.material_type === '投入' ? qty : 0,
          totalReturnQty: row.material_type === '退回' ? qty : 0,
          netAvailableQty: 0, // 下面统一算
          material_code: row.material_code,
          material_name: row.material_name,
          specification: row.specification,
          material_batch: row.material_batch,
          package_no: row.package_no,
        })
      }
    }
    // 统一算 netAvailableQty
    for (const v of m.values()) {
      v.netAvailableQty = Math.max(0, v.totalInputQty - v.totalReturnQty)
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

  // ========== 当前选中料品的退回上限（净投入 = 投入 - 已退回）==========
  const currentReturnLimit = useMemo(() => {
    if (draft.material_type !== '退回' || !draft.bas_material_id) return 0
    return returnableMap.get(draft.bas_material_id)?.netAvailableQty || 0
  }, [draft.material_type, draft.bas_material_id, returnableMap])

  // ========== 净投入校验（保存前预检）==========
  /** 保存后净投入是否 ≥ 0（按 bas_material_id 分组） */
  const checkNetInputBeforeSave = (): { ok: boolean; limitInfo?: string } => {
    const qty = Number(draft.quantity) || 0
    if (qty <= 0) return { ok: false, limitInfo: '数量 > 0' }
    if (!draft.bas_material_id) return { ok: true }

    // 汇总当前工序除"正在编辑的这条"外的所有投入/退回
    let invest = 0
    let returns = 0
    for (const row of processMaterials) {
      // 排除当前正在编辑的这条（新增态没有 material_id，自动跳过）
      if (row.material_id && draft.material_id && String(row.material_id) === String(draft.material_id)) continue
      if (row.bas_material_id !== draft.bas_material_id) continue
      if (row.material_type === '投入') invest += Number(row.quantity || 0)
      else if (row.material_type === '退回') returns += Number(row.quantity || 0)
    }
    // 加上当前编辑的新值
    const newInvest = invest + (draft.material_type === '投入' ? qty : 0)
    const newReturns = returns + (draft.material_type === '退回' ? qty : 0)
    const net = newInvest - newReturns
    if (net < 0) {
      return {
        ok: false,
        limitInfo: `${draft.material_type === '投入' ? '投入总额不能小于已退回' : '退回数量超出可退回净额'}（净剩 ${fmtInt(Math.max(0, invest - returns))}）`,
      }
    }
    return { ok: true }
  }

  // ========== 选中料品 ==========
  const handlePickMaterial = (basMaterialId: string) => {
    setShowPicker(false)
    setPickerKeyword('')
    if (!basMaterialId) return

    // 优先从 candidateList 找（退回场景只在这里有），否则从全量 materials 找
    const m = candidateList.find(x => x.bas_material_id === basMaterialId)
           || materials.find(x => x.bas_material_id === basMaterialId)

    if (draft.material_type === '退回') {
      // 退回：自动带出原投入的批次/包号 + 限制数量上限（净投入）
      const rinfo = returnableMap.get(basMaterialId)
      const nextDraft: MaterialRow = {
        ...draft,
        bas_material_id: basMaterialId,
        material_code: m?.material_code,
        material_name: m?.material_name,
        specification: m?.specification,
        material_batch: rinfo?.material_batch || draft.material_batch || '',
        package_no: rinfo?.package_no || draft.package_no || '',
        quantity: rinfo?.netAvailableQty || draft.quantity || 0,
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
    // 只能编辑最第一条（最新）记录，历史流水不可直接修改
    const rowKey = String(row.material_id || row.id)
    if (processMaterials.length > 0 && String(processMaterials[0].material_id || processMaterials[0].id) !== rowKey) {
      Toast.show({ content: '历史流水不可直接修改，请先删除后面的记录', icon: 'fail', position: 'bottom' })
      return
    }
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
    // 净投入校验：任何类型（投入/退回）保存后净投入不能 < 0
    const netCheck = checkNetInputBeforeSave()
    if (!netCheck.ok) {
      Toast.show({ content: netCheck.limitInfo || '净投入校验失败', icon: 'fail', position: 'bottom' })
      return
    }

    const qty = Number(draft.quantity) || 0
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
    width: 64, padding: '7px 8px', borderRadius: 6, border: '1px solid var(--m-border)',
    fontSize: 12, background: 'var(--m-surface)', flexShrink: 0,
  }
  const inputStyle: React.CSSProperties = {
    padding: '7px 8px', borderRadius: 6, border: '1px solid var(--m-border)',
    fontSize: 12, background: 'var(--m-surface)',
  }
  /** 表单 JSX —— 3 行布局：
   * Row1: 左 select（投入/退回） | 右 按钮组（保存/取消/删除）
   * Row2: 可点击多行料品卡片（料号 + 料品名称 + 规格，自动换行/高度）
   * Row3: 批号 / 包号 / 数量
   * Row4: 标签图片
   */
  // 投入/退回类型 Picker columns（顶层 useMemo）
  const typeColumns = useMemo(() => [[
    { label: '投入', value: '投入' },
    { label: '退回', value: '退回' },
  ]], [])

  const formRow1 = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
      {/* 投入/退回类型 Picker（onConfirm 复用 handleTypeChange 的业务校验） */}
      <Picker
        columns={typeColumns}
        value={[draft.material_type || '投入']}
        onConfirm={(v) => handleTypeChange(v[0] as any)}
      >
        {(_items, { open }) => (
          <div onClick={open} role="button" tabIndex={0} style={typeSelectStyle}>
            {draft.material_type || '投入'}
          </div>
        )}
      </Picker>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <Button size="mini" color="primary" onClick={handleSave}>保存</Button>
        <Button size="mini" fill="outline" onClick={cancelEdit}>取消</Button>
        {draft.material_id && (
          <Button size="mini" fill="outline" onClick={() => handleDel(draft as MaterialRow)}>删除</Button>
        )}
      </div>
    </div>
  )

  // 多行料品卡片（点击打开 Popup picker）
  const formRow2 = (
    <div
      onClick={() => setShowPicker(true)}
      style={{
        border: draft.bas_material_id ? '1px solid var(--m-border)' : '1px dashed var(--m-border)',
        borderRadius: 6, padding: '8px 10px', cursor: 'pointer',
        background: draft.bas_material_id ? 'var(--m-surface)' : 'var(--m-surface-2)',
        marginBottom: 6,
      }}
    >
      {draft.bas_material_id ? (
        <>
          {draft.material_code && (
            <div style={{ fontSize: 11, color: 'var(--m-text-3)', lineHeight: 1.3 }}>
              {draft.material_code}
            </div>
          )}
          <div style={{
            fontSize: 13, color: 'var(--m-text)', fontWeight: 500,
            marginTop: 2, lineHeight: 1.4, wordBreak: 'break-all',
          }}>
            {draft.material_name}
          </div>
          {(draft as any).specification && (
            <div style={{ fontSize: 11, color: 'var(--m-text-3)', marginTop: 3, lineHeight: 1.3 }}>
              规格：{(draft as any).specification}
            </div>
          )}
          {(draft as any).unit && (
            <span style={{ fontSize: 11, color: 'var(--m-text-3)', marginLeft: 6 }}>
              单位：{(draft as any).unit}
            </span>
          )}
        </>
      ) : (
        <div style={{ color: 'var(--m-text-3)', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{draft.material_type === '退回' ? '点击选退回料品（仅当前工序已投入）' : '点击选料品'}</span>
          <span style={{ fontSize: 14 }}>›</span>
        </div>
      )}
    </div>
  )

  const formRow3 = (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
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
      {/* ===== 顶部：新增按钮 + 新增表单 ===== */}
      {editable && activeProcessId && expandedId !== '__new__' && (
        <Button size="mini" color="primary" block style={{ height: 48, fontSize: 15 }} onClick={startAdd}>
          ➕ 新增投料
        </Button>
      )}
      {expandedId === '__new__' && (
        <div style={{ borderTop: '1px dashed var(--m-border)', paddingTop: 10, marginTop: 6 }}>
          {formRow1}{formRow2}{formRow3}{formImage}
        </div>
      )}
      {expandedId === '__new__' && processMaterials.length > 0 && (
        <div style={{ borderTop: '1px solid var(--m-border)', marginTop: 6 }} />
      )}

      {/* ===== 记录列表（时间倒序，最新在前）===== */}
      {processMaterials.length > 0 && processMaterials.map((row, idx) => {
        const rowKey = row.material_id || row.id
        const isExpanded = expandedId === rowKey
        // 方案 A：只有第一条（idx=0，最新）可编辑，历史流水只读
        const isLatest = idx === 0 && editable

        if (isExpanded) {
          return (
            <div key={rowKey} style={{ borderTop: '1px solid var(--m-border)', paddingTop: 10, marginTop: 6 }}>
              {formRow1}{formRow2}{formRow3}{formImage}
            </div>
          )
        }

        return (
          <div key={rowKey} onClick={() => editable && startEdit(row)} style={{
            padding: '10px 0', borderTop: '1px solid var(--m-border)',
            cursor: isLatest ? 'pointer' : 'default',
            opacity: isLatest ? 1 : 0.85,
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
              {isLatest && <span style={{ color: 'var(--m-text-3)', fontSize: 16 }}>›</span>}
              {!isLatest && editable && <span style={{ color: 'var(--m-text-4, #bbb)', fontSize: 11, marginLeft: 4 }}>🔒</span>}
            </div>
          </div>
        )
      })}

      {processMaterials.length === 0 && (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--m-text-3)', fontSize: 12 }}>— 该工序暂无投料记录 —</div>
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
