/**
 * 成品检验移动端 — Phase 5-C 补齐 per-item + sample values
 *
 * 复用 useInspectionWorkflow + ItemRow/Section/Empty（来自 MobileIncomingInspection）
 * 流程与 PC ProductInspection.tsx 完全对齐：start → items → 样品值 → submit
 */
import { useEffect, useState } from 'react'
import { Button, List, SearchBar, Toast, Dialog, Input, PullToRefresh, Tabs, TextArea } from 'antd-mobile'
import api from '../../utils/api'
import { useBarcode } from '../hooks/useBarcode'
import { useInspectionWorkflow } from '../hooks/useInspectionWorkflow'
import { offlinePut } from '../offline/offlineApi'
import { ItemRow, Section, Empty } from './MobileIncomingInspection'

interface Row {
  inspection_id: number; inspection_no: string; status?: string; result?: string
  material_code?: string; material_name?: string; report_order_no?: string; standard_name?: string
}

type Step = 0 | 1 | 2

/** 状态 Tab — 与 PC 端 ProductInspection.tsx 对齐（不显示 已关闭） */
type StatusTab = '全部' | '待检' | '检验中' | '审核中' | '已完成'
const PRODUCT_TABS: { key: StatusTab; label: string; color: string }[] = [
  { key: '全部',   label: '全部',   color: 'var(--m-text-3)' },
  { key: '待检',   label: '待检',   color: 'var(--brand-color-warning)' },
  { key: '检验中', label: '检验中', color: 'var(--brand-color)' },
  { key: '审核中', label: '审核中', color: 'var(--brand-color-warning)' },
  { key: '已完成', label: '已完成', color: 'var(--brand-color-success)' },
]

export default function MobileProductInspection() {
  const { scan } = useBarcode()
  const [step, setStep] = useState<Step>(0)
  const [list, setList] = useState<Row[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Row | null>(null)
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [tab, setTab] = useState<StatusTab>('全部')

  const workflow = useInspectionWorkflow('product')
  const { items, loadDetail, setItemResult, addSampleValue, updateSample, removeSample, submitAll } = workflow

  const load = async (kw?: string, status?: StatusTab): Promise<Row[]> => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page: 1, pageSize: 30 }
      const k = kw ?? keyword
      if (k) params.inspection_no = k
      const s = status ?? tab
      if (s !== '全部') params.status = s
      const r: any = await api.get('/basic/product-inspections', { params })
      const l: Row[] = r.success ? (r.data?.list || r.data?.rows || []) : []
      setList(l); return l
    } catch { return [] } finally { setLoading(false) }
  }
  useEffect(() => { load(undefined, tab) }, [tab])

  const onPick = async (row: Row) => {
    setSelected(row); setStep(1)
    try { await loadDetail(row.inspection_id) }
    catch (e: any) { Toast.show({ content: e?.message || '加载检验项失败', position: 'bottom' }) }
  }

  const onScan = async () => {
    const r = await scan(); if (!r) return
    setKeyword(r.code)
    const list2 = await load(r.code)
    if (list2.length === 1) onPick(list2[0])
    else if (list2.length > 1) Toast.show({ content: `命中 ${list2.length} 条`, position: 'bottom' })
    else Toast.show({ content: '未找到匹配检验单', position: 'bottom' })
  }

  const totalSamples = items.reduce((s, it) => s + it.sample_values.length, 0)
  const doneItems = items.filter((i) => i.result).length

  const onSubmit = async () => {
    if (!selected) return
    const undone = items.filter((i) => !i.result)
    if (items.length > 0 && undone.length > 0) {
      const ok = await Dialog.confirm({
        content: `还有 ${undone.length} 项未判定，确认按默认不合格提交？`,
        confirmText: '确认提交', cancelText: '继续编辑',
      })
      if (!ok) return
    }
    setSubmitting(true)
    try {
      items.forEach((it, idx) => {
        if (!it.result) setItemResult(idx, '不合格')
      })
      const overall = items.length > 0 && items.every((i) => i.result === '合格') ? '合格' : '不合格'
      if (items.length > 0) {
        await submitAll(selected.inspection_id, { result: overall, remarks })
      } else {
        // 简易模式（与旧版兼容）
        try { await offlinePut(`/basic/product-inspections/${selected.inspection_id}/start`, {}, { source: 'inspection-product' }) } catch {}
        await offlinePut(`/basic/product-inspections/${selected.inspection_id}`, { result: overall, remarks }, { source: 'inspection-product' })
        await offlinePut(`/basic/product-inspections/${selected.inspection_id}/submit`, {}, { source: 'inspection-product' })
      }
      setStep(2)
    } catch (e: any) { Toast.show({ content: e?.message || '提交失败', position: 'bottom' }) }
    finally { setSubmitting(false) }
  }

  const reset = () => {
    setStep(0); setSelected(null); setRemarks(''); setKeyword('')
    workflow.setItems([]); load()
  }

  if (step === 2) {
    const allOk = items.every((i) => i.result === '合格')
    return (
      <div className="mobile-page" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 60 }}>{allOk ? '✅' : '⚠️'}</div>
        <div style={{ fontSize: 18, fontWeight: 600, margin: '16px 0 8px' }}>
          成品检验{allOk ? '合格' : '不合格'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--m-text-2)', marginBottom: 24 }}>
          单号: {selected?.inspection_no} · {items.length} 项 · {totalSamples} 个样品
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button block fill="outline" onClick={reset}>返回</Button>
          <Button block color="primary" onClick={reset}>继续检验</Button>
        </div>
      </div>
    )
  }

  return (
    step === 0 ? (
      <div className="mobile-page-fixed-header">
        <div className="mobile-sticky-header">
          <SearchBar placeholder="扫/输检验单号" value={keyword} onChange={setKeyword}
            onSearch={(v) => load(v, tab)} />
          {/* 状态 Tab */}
          <div style={{
            background: 'var(--m-surface)', borderRadius: 12, padding: '4px 10px', marginTop: 8,
            boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
          }}>
            <Tabs activeKey={tab} onChange={(k) => setTab(k as StatusTab)}>
              {PRODUCT_TABS.map((t) => (
                <Tabs.Tab
                  key={t.key}
                  title={
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 6px' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.color }} />
                      {t.label}
                    </span>
                  }
                />
              ))}
            </Tabs>
          </div>
        </div>
        <div className="mobile-page-scroll-list">
          {loading ? <Empty text="加载中..." /> : list.length === 0 ? (
            <Empty text="暂无可检成品单" sub="请先在 PC 端创建成品检验单" />
          ) : (
            <PullToRefresh onRefresh={() => load(undefined, tab)}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 2px' }}>
                {list.map((r) => {
                  const st = r.status || '待检'
                  const isDone = st === '已完成'
                  const stColor = PRODUCT_TABS.find((t) => t.key === st)?.color || 'var(--brand-color-warning)'
                  return (
                    <div
                      key={r.inspection_id}
                      onClick={() => onPick(r)}
                      style={{
                        background: 'var(--m-surface)', borderRadius: 14, padding: '14px 14px 12px 18px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.02)',
                        borderLeft: `3px solid ${stColor}`,
                      }}
                    >
                      {/* 第一行 — 单号 + 状态 */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--m-text)', flexShrink: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {r.inspection_no}
                        </div>
                        <span style={{
                          fontSize: 11, padding: '3px 10px', borderRadius: 12, flexShrink: 0,
                          background: stColor + '15', color: stColor,
                          fontWeight: 600, border: `1px solid ${stColor}44`, letterSpacing: 0.5,
                        }}>
                          {st}
                        </span>
                      </div>
                      {/* 第二行 — 物料信息（左） + 操作按钮（右） */}
                      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0, lineHeight: 1.4, fontSize: 13, color: 'var(--m-text-2)' }}>
                          <span style={{ color: 'var(--m-text-3)' }}>{r.material_code}</span>
                          {r.material_name && <span style={{ marginLeft: 6 }}>· {r.material_name?.slice(0, 20)}</span>}
                          <div style={{ fontSize: 11, color: 'var(--m-text-3)', marginTop: 2 }}>
                            工单 {r.report_order_no || '—'} · {r.standard_name || '—'}
                          </div>
                        </div>
                        <Button
                          size="mini"
                          color="primary"
                          disabled={isDone}
                          onClick={(e) => { e.stopPropagation(); onPick(r) }}
                        >
                          {isDone ? '已完成' : '检验'}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </PullToRefresh>
          )}
        </div>
      </div>
    ) : (
    <div className="mobile-page" style={{ paddingTop: 12, paddingBottom: 24 }}>
      {step === 1 && selected && (
        <>
          <div style={{ background: 'var(--m-surface)', borderRadius: 10, padding: 14, marginBottom: 14, border: '1px solid var(--m-border)' }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{selected.inspection_no}</div>
            <div style={{ fontSize: 12, color: 'var(--m-text-3)', marginTop: 4 }}>
              {selected.material_code} · {selected.material_name?.slice(0, 20)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--m-text-3)' }}>
              工单: {selected.report_order_no} · 标准: {selected.standard_name}
            </div>
          </div>

          <Section title={`检验项（${doneItems}/${items.length}）`}>
            {items.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--m-text-3)', padding: 10 }}>
                该单暂无检验项（PC 端未加载标准），无法移动端判定
              </div>
            ) : items.map((it, idx) => (
              <ItemRow key={it.item_id || idx} idx={idx} item={it}
                setItemResult={setItemResult} addSampleValue={addSampleValue}
                updateSample={updateSample} removeSample={removeSample} />
            ))}
          </Section>

          <Section title="备注（可选）">
            <TextArea  value={remarks} onChange={setRemarks} rows={2}
              placeholder="不合格说明 / 特殊说明" />
          </Section>

          <div style={{ display: 'flex', gap: 12 }}>
            <Button block fill="outline" onClick={() => setStep(0)}>上一步</Button>
            <Button block color="primary" loading={submitting} disabled={items.length === 0}
              onClick={onSubmit}>
              提交（{totalSamples} 样品）
            </Button>
          </div>
        </>
      )}
    </div>
    )
  )
}
