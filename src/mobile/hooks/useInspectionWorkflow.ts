/**
 * 来料检验 / 产品检验 — 共享的检验项 + 样品值工作流（Phase 5-C）
 *
 * 对齐 PC IncomingInspection.tsx / ProductInspection.tsx 的核心流程：
 *   1) start   PUT  /basic/{type}-inspections/:id/start
 *   2) 加载详情 GET  /basic/{type}-inspections/:id → items (含 item_id)
 *   3) 逐项：判定合格/不合格 + N 个样品测量值
 *   4) 保存主表 PUT  /basic/{type}-inspections/:id  payload { items: [...] }
 *   5) 样品值  POST /inspection-items/:item_id/sample-values  payload { sample_values: [...] }
 *   6) 提交    PUT  /basic/{type}-inspections/:id/submit
 *
 * type = 'incoming' | 'product'
 */
import { useState, useCallback } from 'react'
import api from '../../utils/api'
import { offlinePut } from '../offline/offlineApi'

export interface InspectionItem {
  item_id?: number
  item_name: string
  item_code?: string
  item_type?: string
  standard_value?: string | number
  result?: '合格' | '不合格'
  sample_values: SampleValue[]
  [k: string]: any
}

export interface SampleValue {
  sample_no: string
  dimension_code?: string
  dimension_name?: string
  measure_value_num?: number | string
  measure_value_text?: string
  defect_desc?: string
  measured_at?: string
}

export type InspectionType = 'incoming' | 'product'

const API_ROOT = {
  incoming: '/basic/incoming-inspections',
  product: '/basic/product-inspections',
} as const

export function useInspectionWorkflow(type: InspectionType) {
  const root = API_ROOT[type]
  const [items, setItems] = useState<InspectionItem[]>([])

  /** 拉详情并映射 items */
  const loadDetail = useCallback(async (id: number) => {
    const r: any = await api.get(`${root}/${id}`)
    if (!r.success) return
    const rawItems = r.data?.items || r.data?.qc_items || []
    setItems(rawItems.map((it: any) => ({
      item_id: it.item_id,
      item_name: it.item_name || it.qc_item_name || '检验项',
      item_code: it.item_code || it.qc_item_code,
      standard_value: it.standard_value,
      result: it.result,
      sample_values: Array.isArray(it.sample_values) ? it.sample_values : [],
    })))
  }, [root])

  const setItemResult = (idx: number, result: '合格' | '不合格') => {
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, result } : it)))
  }

  const addSampleValue = (idx: number) => {
    setItems((arr) => arr.map((it, i) => i === idx
      ? {
          ...it,
          sample_values: [
            ...it.sample_values,
            { sample_no: String(it.sample_values.length + 1) },
          ],
        }
      : it))
  }

  const updateSample = (itemIdx: number, svIdx: number, patch: Partial<SampleValue>) => {
    setItems((arr) => arr.map((it, i) => {
      if (i !== itemIdx) return it
      const svs = it.sample_values.map((sv, si) => (si === svIdx ? { ...sv, ...patch } : sv))
      return { ...it, sample_values: svs }
    }))
  }

  const removeSample = (itemIdx: number, svIdx: number) => {
    setItems((arr) => arr.map((it, i) => {
      if (i !== itemIdx) return it
      const svs = it.sample_values.filter((_, si) => si !== svIdx)
      return { ...it, sample_values: svs }
    }))
  }

  /** 5-C 主流程：start → 保存主表 → 保存样品值 → submit */
  const submitAll = async (inspectionId: number, extraPayload: Record<string, any> = {}) => {
    // 1) start（幂等）
    try { await offlinePut(`${root}/${inspectionId}/start`, {}, { source: `inspection-${type}` }) } catch {}

    // 2) PUT 主表（items upsert）
    const mainRes: any = await offlinePut(
      `${root}/${inspectionId}`,
      { items: items.map(i => ({
        item_id: i.item_id, item_name: i.item_name,
        item_code: i.item_code, result: i.result,
      })), ...extraPayload },
      { source: `inspection-${type}` },
    )
    if (!mainRes.success) throw new Error(mainRes.message || '保存主表失败')

    // 3) POST sample-values per item（必须 item_id 已存在）
    let svSaved = 0
    for (const it of items) {
      if (!it.item_id || it.sample_values.length === 0) continue
      try {
        const svs = it.sample_values.map((s) => ({
          sample_no: s.sample_no,
          dimension_code: s.dimension_code,
          dimension_name: s.dimension_name,
          measure_value_num: s.measure_value_num,
          measure_value_text: s.measure_value_text,
          defect_desc: s.defect_desc,
          measured_at: s.measured_at || new Date().toISOString(),
        }))
        await api.post(`/inspection-items/${it.item_id}/sample-values`, { sample_values: svs })
        svSaved++
      } catch { /* 样品值不阻塞主流程 */ }
    }

    // 4) submit
    await offlinePut(`${root}/${inspectionId}/submit`, {}, { source: `inspection-${type}` })
    return { mainRes, svSaved }
  }

  return {
    items, setItems,
    loadDetail, setItemResult, addSampleValue, updateSample, removeSample,
    submitAll,
  }
}
