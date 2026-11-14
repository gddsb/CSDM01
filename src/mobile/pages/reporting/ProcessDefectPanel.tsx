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
import { useCallback, useEffect, useMemo, useState } from 'react'
import React from 'react'
import { Button, Dialog, Image as AntdImage, Picker, Toast } from 'antd-mobile'
import api from '../../../utils/api'
import { resolveUploadUrl } from '../../../utils/resolveUploadUrl'
import { fmtInt } from '../../utils/format'
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
  /** 上报 dirty 状态 —— 父组件 Tab 切换拦截用 */
  onDirtyChange?: (dirty: boolean) => void
}

/** 后端返回的 defect_images 可能是 JSON string 或 null，前端统一转 string[] */
function parseImages(raw: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter((v: unknown) => typeof v === "string" && v.trim())
  if (typeof raw === 'string') {
    try { return JSON.parse(raw).filter((v: unknown) => typeof v === "string" && v.trim()) } catch { return [] }
  }
  return []
}

export function ProcessDefectPanel({
  report, activeProcessId, editable, defectTypes, allDefects, setAllDefects, onDirtyChange,
}: Props) {
  // 1. 按当前工序过滤记录 + 按时间倒序（最新在前）
  const processDefects = useMemo(
    () => allDefects
      .filter(d => String(d.process_id) === String(activeProcessId))
      .sort((a, b) => {
        // 优先 createdAt 倒序（ProcessDefect 模型用 record_time 作 createdAt 列），无时间时用 defect_id 倒序
        const at = (a as any).createdAt || (a as any).record_time
        const bt = (b as any).createdAt || (b as any).record_time
        const ta = at ? new Date(at).getTime() : 0
        const tb = bt ? new Date(bt).getTime() : 0
        if (ta !== tb) return tb - ta
        const idA = Number(a.defect_id ?? a.id ?? 0)
        const idB = Number(b.defect_id ?? b.id ?? 0)
        return idB - idA
      }),
    [allDefects, activeProcessId],
  )

  // 2. 按当前工序过滤不良类型（related_processes 逻辑）
  const filteredTypes = useMemo(() => {
    if (!activeProcessId) return []
    // 已存在的同工序不良类型 id 集合 → 去重（同一工序同一不良类型不允许重复报）
    const existTypeIds = new Set(processDefects.map(d => Number(d.defect_type_id)).filter(Boolean))
    return defectTypes.filter(t => {
      // 过滤已存在的不良类型
      if (existTypeIds.has(t.defect_id)) return false
      const rel = Array.isArray(t.related_processes) ? t.related_processes : []
      if (rel.length === 0) return true // 关联工序为空 = 全工序可用
      return rel.some(x => String(x) === String(activeProcessId))
    })
  }, [defectTypes, activeProcessId, processDefects])

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

  // ========== 新增 / 编辑（state 必须在 useMemo 之前声明，避免 TDZ 崩溃）==========
  const [expandedId, setExpandedId] = useState<number | string | null>(null) // 哪一行在编辑
  const [draft, setDraft] = useState<DefectRow>({ quantity: 0 })

  // ========== antd-mobile Picker columns（顶层 useMemo，columns 不能在 IIFE/Hook 内嵌套）==========
  const defectTypeColumns = useMemo(() => [
    filteredTypes.map(t => ({
      label: `${t.defect_code || ''} ${t.defect_name || ''}`.trim(),
      value: String(t.defect_id),
    })),
  ], [filteredTypes])

  // 单位 options（依赖当前已选不良类型）— 顶层 useMemo，不能引用 IIFE 内的局部变量
  const unitOptions = useMemo(
    () => draft.defect_type_id ? getUnitOptions(draft.defect_type_id) : [],
    [draft.defect_type_id, getUnitOptions],
  )
  const unitColumns = useMemo(() => [
    unitOptions.map(u => ({ label: u, value: u })),
  ], [unitOptions])

  // dirty 上报：正在编辑（expandedId 非空）即为 dirty；unmount 时清掉
  useEffect(() => {
    onDirtyChange?.(expandedId !== null)
    return () => { onDirtyChange?.(false) }
  }, [expandedId, onDirtyChange])

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
      // merged.defect_images 必须统一成 string[]：
      //   PUT 返回 { images: string[] }  +  { defect_images: JSON string }
      //   POST/list 只返回 { defect_images: JSON string }
      // 优先级：PUT 原生数组 > parse 后端 string > 直接用 draft 当前数组（最可靠）
      const mergedImages: string[] = Array.isArray(saved?.images)
        ? saved.images
        : parseImages(saved?.defect_images)?.length > 0
          ? parseImages(saved.defect_images)
          : images
      const merged: DefectRow = {
        defect_id: saved.defect_id,
        id: saved.defect_id,
        defect_type_id: saved.defect_type_id,
        quantity: Number(saved.quantity),
        unit: saved.unit || '',
        defect_code: filteredTypes.find(t => t.defect_id === saved.defect_type_id)?.defect_code,
        defect_name: filteredTypes.find(t => t.defect_id === saved.defect_type_id)?.defect_name,
        defect_type: filteredTypes.find(t => t.defect_id === saved.defect_type_id)?.defect_type,
        defect_images: mergedImages,
        report_order_id: saved.report_order_id,
        process_id: saved.process_id,
      }
      // 双字段匹配：旧项可能用 defect_id 或 id 存后端编号
      const isSame = (d: DefectRow) =>
        Number(d.defect_id) === Number(merged.defect_id) ||
        Number(d.id) === Number(merged.id) ||
        String(d.defect_id) === String(expandedId)
      setAllDefects(prev => {
        const has = prev.find(isSame)
        return has ? prev.map(d => isSame(d) ? merged : d) : [...prev, merged]
      })
      Toast.show({ content: '已保存', icon: 'success' })
      cancelEdit()
      onDirtyChange?.(false)
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
    border: '1px solid var(--m-border)', fontSize: 14, background: 'var(--m-surface)',
  }
  const inputStyle: React.CSSProperties = {
    padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--m-border)', fontSize: 15,
    background: 'var(--m-surface)',
  }

  return (
    <div>
      {/* ===== 顶部：新增按钮 + 新增表单 ===== */}
      {editable && activeProcessId && expandedId !== '__new__' && (
        <Button size="mini" color="primary" block style={{ height: 48, fontSize: 15 }} onClick={startAdd}>
          ➕ 新增不良
        </Button>
      )}
      {expandedId === '__new__' && (
        <div style={{ borderTop: '1px dashed var(--m-border)', paddingTop: 10, marginTop: 6 }}>
          {/* 紧凑一行：类型 + 单位 + 数量 ... 保存/取消（按钮组右对齐）*/}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* 不良类型 Picker */}
            {(() => {
              const currentType = filteredTypes.find(t => t.defect_id === Number(draft.defect_type_id))
              return (
                <Picker
                  columns={defectTypeColumns}
                  value={draft.defect_type_id ? [String(draft.defect_type_id)] : []}
                  onConfirm={(v) => {
                    const id = Number(v[0]) || null
                    const t = filteredTypes.find(x => x.defect_id === id)
                    const defaultUnit = (t?.available_units && t.available_units[0]) || t?.defect_unit || ''
                    setDraft(d => ({ ...d, defect_type_id: id, unit: defaultUnit }))
                  }}
                >
                  {(_items, { open }) => (
                    <div onClick={open} role="button" tabIndex={0} style={{
                      flex: 2, minWidth: 110, padding: '7px 8px', borderRadius: 6,
                      border: '1px solid var(--m-border)', fontSize: 12, background: 'var(--m-surface)',
                      textAlign: 'center', minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: currentType ? 'var(--m-text)' : 'var(--m-text-3)',
                    }}>
                      {currentType ? `${currentType.defect_code || ''} ${currentType.defect_name}`.trim() : '不良类型'}
                    </div>
                  )}
                </Picker>
              )
            })()}
            {/* 单位 Picker（动态：依赖已选不良类型；无类型时禁用——在 trigger 上守卫 open()） */}
            {(() => {
              const disabled = unitOptions.length === 0
              return (
                <Picker
                  columns={unitColumns}
                  value={draft.unit ? [draft.unit] : []}
                  onConfirm={(v) => setDraft(d => ({ ...d, unit: String(v[0] ?? '') }))}
                >
                  {(_items, { open }) => (
                    <div onClick={() => !disabled && open()} role="button" tabIndex={0} aria-disabled={disabled} style={{
                      flex: 1, minWidth: 60, padding: '7px 8px', borderRadius: 6,
                      border: disabled ? '1px dashed var(--m-border)' : '1px solid var(--m-border)',
                      fontSize: 12, background: disabled ? 'transparent' : 'var(--m-surface)',
                      textAlign: 'center', minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: draft.unit ? 'var(--m-text)' : 'var(--m-text-3)',
                      opacity: disabled ? 0.5 : 1,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                    }}>
                      {disabled ? '单位' : (draft.unit || '单位')}
                    </div>
                  )}
                </Picker>
              )
            })()}
            <input
              type="number" min={0} value={draft.quantity || ''}
              onChange={(e) => setDraft(d => ({ ...d, quantity: Number(e.target.value) || 0 }))}
              placeholder="数量"
              style={{ width: 70, padding: '7px 8px', borderRadius: 6, border: '1px solid var(--m-border)', fontSize: 12, background: 'var(--m-surface)' }}
            />
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <Button size="mini" color="primary" onClick={handleSave}>保存</Button>
              <Button size="mini" fill="outline" onClick={cancelEdit}>取消</Button>
            </div>
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
      {expandedId === '__new__' && processDefects.length > 0 && (
        <div style={{ borderTop: '1px solid var(--m-border)', marginTop: 6 }} />
      )}

      {/* ===== 记录列表（时间倒序，最新在前）===== */}
      {processDefects.length > 0 && processDefects.map((row) => {
        const rowKey = row.defect_id || row.id
        const isExpanded = expandedId === rowKey
        if (isExpanded) {
          return (
            <div key={rowKey} style={{ borderTop: '1px solid var(--m-border)', paddingTop: 10, marginTop: 6 }}>
              {/* 紧凑一行：类型 + 单位 + 数量 ... 保存/取消/删除（按钮组右对齐）*/}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* 不良类型 Picker（编辑模式：保留已有单位 d.unit || defaultUnit） */}
                {(() => {
                  const currentType = filteredTypes.find(t => t.defect_id === Number(draft.defect_type_id))
                  return (
                    <Picker
                      columns={defectTypeColumns}
                      value={draft.defect_type_id ? [String(draft.defect_type_id)] : []}
                      onConfirm={(v) => {
                        const id = Number(v[0]) || null
                        const t = filteredTypes.find(x => x.defect_id === id)
                        const defaultUnit = (t?.available_units && t.available_units[0]) || t?.defect_unit || ''
                        setDraft(d => ({ ...d, defect_type_id: id, unit: d.unit || defaultUnit }))
                      }}
                    >
                      {(_items, { open }) => (
                        <div onClick={open} role="button" tabIndex={0} style={{
                          flex: 2, minWidth: 110, padding: '7px 8px', borderRadius: 6,
                          border: '1px solid var(--m-border)', fontSize: 12, background: 'var(--m-surface)',
                          textAlign: 'center', minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: currentType ? 'var(--m-text)' : 'var(--m-text-3)',
                        }}>
                          {currentType ? `${currentType.defect_code || ''} ${currentType.defect_name}`.trim() : '不良类型'}
                        </div>
                      )}
                    </Picker>
                  )
                })()}
                {/* 单位 Picker（动态：依赖已选不良类型；无类型时禁用——在 trigger 上守卫 open()） */}
                {(() => {
                  const disabled = unitOptions.length === 0
                  return (
                    <Picker
                      columns={unitColumns}
                      value={draft.unit ? [draft.unit] : []}
                      onConfirm={(v) => setDraft(d => ({ ...d, unit: String(v[0] ?? '') }))}
                    >
                      {(_items, { open }) => (
                        <div onClick={() => !disabled && open()} role="button" tabIndex={0} aria-disabled={disabled} style={{
                          flex: 1, minWidth: 60, padding: '7px 8px', borderRadius: 6,
                          border: disabled ? '1px dashed var(--m-border)' : '1px solid var(--m-border)',
                          fontSize: 12, background: disabled ? 'transparent' : 'var(--m-surface)',
                          textAlign: 'center', minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: draft.unit ? 'var(--m-text)' : 'var(--m-text-3)',
                          opacity: disabled ? 0.5 : 1,
                          cursor: disabled ? 'not-allowed' : 'pointer',
                        }}>
                          {disabled ? '单位' : (draft.unit || '单位')}
                        </div>
                      )}
                    </Picker>
                  )
                })()}
                <input
                  type="number" min={0} value={draft.quantity || ''}
                  onChange={(e) => setDraft(d => ({ ...d, quantity: Number(e.target.value) || 0 }))}
                  placeholder="数量"
                  style={{ width: 70, padding: '7px 8px', borderRadius: 6, border: '1px solid var(--m-border)', fontSize: 12, background: 'var(--m-surface)' }}
                />
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <Button size="mini" color="primary" onClick={handleSave}>保存</Button>
                  <Button size="mini" fill="outline" onClick={cancelEdit}>取消</Button>
                  {draft.defect_id && (
                    <Button size="mini" fill="outline" onClick={() => handleDel(draft as DefectRow)}>删除</Button>
                  )}
                </div>
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
            padding: '10px 0', borderTop: '1px solid var(--m-border)', cursor: editable ? 'pointer' : 'default',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--m-text)' }}>
                  {row.defect_code && <span style={{ color: 'var(--m-text-3)', fontSize: 11, marginRight: 6 }}>{row.defect_code}</span>}
                  {row.defect_name || '—'}
                  {row.defect_type && <span style={{ color: 'var(--m-text-3)', fontSize: 11, marginLeft: 6 }}>({row.defect_type})</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--m-text-3)', marginTop: 2 }}>
                  数量 ×{fmtInt(row.quantity)} {row.unit || ''}
                  {(() => {
                    const imgs = parseImages(row.defect_images)
                    if (imgs.length === 0) return null
                    return <span style={{ marginLeft: 6 }}>📷 {imgs.length} 张</span>
                  })()}
                </div>
              </div>
              {editable && <span style={{ color: 'var(--m-text-3)', fontSize: 16 }}>›</span>}
            </div>
          </div>
        )
      })}

      {/* 空状态 */}
      {processDefects.length === 0 && (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--m-text-3)', fontSize: 12 }}>— 该工序暂无不良记录 —</div>
      )}

      {!activeProcessId && (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--m-text-3)', fontSize: 12 }}>请先选择工序</div>
      )}
    </div>
  )
}
