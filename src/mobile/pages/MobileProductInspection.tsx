/**
 * 成品检验移动端 — Phase 5-C 补齐 per-item + sample values
 *
 * 复用 useInspectionWorkflow + ItemRow/Section/Empty（来自 MobileIncomingInspection）
 * 流程与 PC ProductInspection.tsx 完全对齐：start → items → 样品值 → submit
 */
import { useEffect, useState } from 'react'
import { Steps, Button, List, SearchBar, Toast, Dialog, Input, PullToRefresh } from 'antd-mobile'
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

export default function MobileProductInspection() {
  const { scan } = useBarcode()
  const [step, setStep] = useState<Step>(0)
  const [list, setList] = useState<Row[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Row | null>(null)
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const workflow = useInspectionWorkflow('product')
  const { items, loadDetail, setItemResult, addSampleValue, updateSample, removeSample, submitAll } = workflow

  const load = async (kw?: string): Promise<Row[]> => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page: 1, page_size: 30 }
      const k = kw ?? keyword
      if (k) params.inspection_no = k
      const r: any = await api.get('/basic/product-inspections', { params })
      const l: Row[] = r.success ? (r.data?.list || r.data?.rows || []) : []
      setList(l); return l
    } catch { return [] } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

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
        <div style={{ fontSize: 13, color: '#666', marginBottom: 24 }}>
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
    <div className="mobile-page" style={{ paddingTop: 12, paddingBottom: 24 }}>
      <Steps current={step} direction="vertical" style={{ marginBottom: 16 }}>
        <Steps.Step title="选检验单" description={step > 0 ? selected?.inspection_no : ''} />
        <Steps.Step title="逐项判定" description={step > 1 ? `${doneItems}/${items.length}` : ''} />
        <Steps.Step title="提交" />
      </Steps>

      {step === 0 && (
        <>
          <SearchBar placeholder="扫/输检验单号" value={keyword} onChange={setKeyword}
            onSearch={load} onRightIconClick={onScan}
            right={<span style={{ fontSize: 12, color: '#2196F3' }}>扫码</span>}
            style={{ marginBottom: 12 }} />
          {loading ? <Empty text="加载中..." /> : list.length === 0 ? (
            <Empty text="暂无可检成品单" sub="请先在 PC 端创建成品检验单" />
          ) : (
            <PullToRefresh onRefresh={() => load()}>
              <List>
                {list.map((r) => (
                  <List.Item key={r.inspection_id} onClick={() => onPick(r)} arrow
                    description={
                      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                        {r.material_code} {r.material_name?.slice(0, 20)}
                        <span style={{ marginLeft: 8, color: '#bbb' }}>{r.status}</span>
                      </div>
                    }>
                    <div style={{ fontWeight: 500 }}>{r.inspection_no}</div>
                  </List.Item>
                ))}
              </List>
            </PullToRefresh>
          )}
        </>
      )}

      {step === 1 && selected && (
        <>
          <div style={{ background: '#fff', borderRadius: 10, padding: 14, marginBottom: 14, border: '1px solid #eef0f3' }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{selected.inspection_no}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              {selected.material_code} · {selected.material_name?.slice(0, 20)}
            </div>
            <div style={{ fontSize: 12, color: '#888' }}>
              工单: {selected.report_order_no} · 标准: {selected.standard_name}
            </div>
          </div>

          <Section title={`检验项（${doneItems}/${items.length}）`}>
            {items.length === 0 ? (
              <div style={{ fontSize: 12, color: '#999', padding: 10 }}>
                该单暂无检验项（PC 端未加载标准），无法移动端判定
              </div>
            ) : items.map((it, idx) => (
              <ItemRow key={it.item_id || idx} idx={idx} item={it}
                setItemResult={setItemResult} addSampleValue={addSampleValue}
                updateSample={updateSample} removeSample={removeSample} />
            ))}
          </Section>

          <Section title="备注（可选）">
            <Input type="textarea" value={remarks} onChange={setRemarks} rows={2}
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
}
