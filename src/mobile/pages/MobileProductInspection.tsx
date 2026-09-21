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

  /** 打开新增弹窗 — 弹 Dialog 让用户选检验类型 + 开工态报工单 */
  const openCreate = async () => {
    let wipList: any[] = []
    try {
      const r: any = await api.get('/production/report-orders', { params: { page: 1, pageSize: 20, status: 0 } })
      wipList = r.success ? (r.data?.list || r.data?.rows || []) : []
    } catch (e: any) {
      Toast.show({ content: e?.message || '加载报工单失败', position: 'bottom' }); return
    }
    if (wipList.length === 0) {
      Toast.show({ content: '当前无开工中的报工单，请先开工', position: 'bottom' }); return
    }

    type Callback = (type: string, reportOrderId: number) => Promise<boolean | void>
    const FormComponent: React.FC<{ wipList: any[]; onConfirm: Callback }> = ({ wipList, onConfirm }) => {
      const [type, setType] = useState('终检')
      const [selectedId, setSelId] = useState<number | null>(null)
      const [submitting, setSubmitting] = useState(false)
      return (
        <div style={{ padding: '0 0 8px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>检验类型</div>
          <Radio.Group
            value={type}
            onChange={(v) => setType(v as string)}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}
          >
            {['首件检验', '巡检', '终检', '抽检'].map((t) => (
              <Radio key={t} value={t}>{t}</Radio>
            ))}
          </Radio.Group>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>选择报工单（开工中）</div>
          <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--m-border)', borderRadius: 10 }}>
            {wipList.map((o: any) => {
              const isSel = selectedId === o.report_order_id
              return (
                <div
                  key={o.report_order_id}
                  onClick={() => setSelId(o.report_order_id)}
                  style={{
                    padding: '10px 12px', borderBottom: '1px solid var(--m-border)', cursor: 'pointer',
                    background: isSel ? 'var(--brand-color)' : 'var(--m-surface)',
                    color: isSel ? 'var(--m-surface)' : 'var(--m-text)',
                    fontSize: 13,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{o.report_no || o.work_order_no}</div>
                  <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
                    {o.material_code || ''} · {o.material_name || ''} · 计划 {Math.round(o.planned_qty || o.quantity || 0)} 件
                  </div>
                </div>
              )
            })}
          </div>
          <Button
            block color="primary"
            loading={submitting}
            disabled={!selectedId}
            style={{ marginTop: 16 }}
            onClick={async () => {
              if (!selectedId) { Toast.show({ content: '请选一个报工单', position: 'bottom' }); return }
              setSubmitting(true)
              try {
                const ok = await onConfirm(type, selectedId)
                if (ok !== false) Dialog.clear()
              } finally { setSubmitting(false) }
            }}
          >
            创建检验单
          </Button>
        </div>
      )
    }

    Dialog.show({
      content: <FormComponent wipList={wipList} onConfirm={async (type, id) => {
        try {
          const r: any = await api.post('/basic/product-inspections', {
            inspection_type: type, report_order_id: id, trigger_type: '手工',
          })
          if (r.success) {
            Toast.show({ content: '已创建，去待检 Tab 查看', position: 'bottom' })
            setTab('待检'); await load(undefined, '待检')
          } else {
            Toast.show({ content: r.message || '创建失败', position: 'bottom' }); return false
          }
        } catch (e: any) { Toast.show({ content: e?.message || '创建失败', position: 'bottom' }); return false }
      }} />,
      closeOnMaskClick: true,
      actions: [
        { key: 'cancel', text: '取消', onClick: () => { /* Dialog 自行关闭 */ } },
      ],
    })
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
          {/* ➕ 新增检验按钮 */}
          <Button
            color="primary" fill="outline"
            style={{ marginBottom: 10, width: '100%', height: 40, borderRadius: 10 }}
            onClick={openCreate}
          >
            ➕ 新建检验
          </Button>
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
