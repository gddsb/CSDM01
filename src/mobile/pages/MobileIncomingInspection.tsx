/**
 * 来料检验移动端 — Phase 5-C 补齐 per-item + sample values
 *
 * 与 PC IncomingInspection.tsx 对齐：
 *   - start → 加载详情 items → 逐项判定 + N 个样品测量值
 *   - PUT 主表 → POST 样品值 → submit
 *   - 写操作全部走 offlineApi（离线暂存）
 */
import { useEffect, useState } from 'react'
import { Button, List, SearchBar, Toast, Dialog, Radio, Input, PullToRefresh , TextArea} from 'antd-mobile'
import api from '../../utils/api'
import { useBarcode } from '../hooks/useBarcode'
import { useInspectionWorkflow, type InspectionItem } from '../hooks/useInspectionWorkflow'
import { offlinePut } from '../offline/offlineApi'

interface Row {
  inspection_id: number; inspection_no: string; order_id?: number; order_no?: string
  supplier_name?: string; material_name?: string; material_code?: string
  quantity?: number; status?: string; result?: string
}

type Step = 0 | 1 | 2

export default function MobileIncomingInspection() {
  const { scan } = useBarcode()
  const [step, setStep] = useState<Step>(0)
  const [list, setList] = useState<Row[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Row | null>(null)
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successNo, setSuccessNo] = useState('')

  const workflow = useInspectionWorkflow('incoming')
  const { items, loadDetail, setItemResult, addSampleValue, updateSample, removeSample, submitAll } = workflow

  const load = async (kw?: string): Promise<Row[]> => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page: 1, pageSize: 30 }
      const k = kw ?? keyword
      if (k) params.inspection_no = k
      const r: any = await api.get('/basic/incoming-inspections', { params })
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
    else if (list2.length > 1) Toast.show({ content: `命中 ${list2.length} 条，请手动选择`, position: 'bottom' })
    else Toast.show({ content: '未找到匹配来料单', position: 'bottom' })
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
      // 先让所有未定项为不合格
      items.forEach((it, idx) => {
        if (!it.result) setItemResult(idx, '不合格')
      })
      const allDone = items.length > 0 ? true : false

      const overall = items.length > 0 && items.every((i) => i.result === '合格') ? '合格' : '不合格'
      if (allDone) {
        await submitAll(selected.inspection_id, { result: overall, remarks })
      } else {
        // 没有检验项 → 简易模式（与旧版逻辑保持兼容）
        try { await offlinePut(`/basic/incoming-inspections/${selected.inspection_id}/start`, {}, { source: 'inspection-incoming' }) } catch {}
        await offlinePut(`/basic/incoming-inspections/${selected.inspection_id}`, { result: overall, remarks }, { source: 'inspection-incoming' })
        await offlinePut(`/basic/incoming-inspections/${selected.inspection_id}/submit`, {}, { source: 'inspection-incoming' })
      }
      setSuccessNo(selected.inspection_no); setStep(2)
    } catch (e: any) {
      Toast.show({ content: e?.message || '提交失败', position: 'bottom' })
    } finally { setSubmitting(false) }
  }

  const reset = () => {
    setStep(0); setSelected(null); setRemarks(''); setSuccessNo(''); setKeyword('')
    workflow.setItems([]); load()
  }

  if (step === 2) {
    const allOk = items.every((i) => i.result === '合格')
    return (
      <div className="mobile-page" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 60 }}>{allOk ? '✅' : '⚠️'}</div>
        <div style={{ fontSize: 18, fontWeight: 600, margin: '16px 0 8px' }}>
          来料检验{allOk ? '合格' : '不合格'}
        </div>
        <div style={{ fontSize: 13, color: '#666', marginBottom: 24 }}>
          单号: {successNo} · {items.length} 项判定 · {totalSamples} 个样品
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
            onSearch={load} />
          {/* 需求3: 扫码按钮已隐藏，保留代码以备后续开启 */}
          {/* <Button size="mini" onClick={onScan} style={{marginTop:8}}>扫码</Button> */}
        </div>
        <div className="mobile-page-scroll-list">
          {loading ? <Empty text="加载中..." /> : list.length === 0 ? (
            <Empty text="暂无可检来料单" sub="请先在 PC 端创建来料检验记录" />
          ) : (
            <PullToRefresh onRefresh={() => load()}>
              <List>
                {list.map((r) => (
                  <List.Item key={r.inspection_id} onClick={() => onPick(r)} arrow
                    description={
                      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                        {r.supplier_name || '—'} · {r.material_code} {r.material_name || ''} · {r.quantity ?? '—'}
                        <span style={{ marginLeft: 8, color: '#bbb' }}>{r.status}</span>
                      </div>
                    }>
                    <div style={{ fontWeight: 500 }}>{r.inspection_no}</div>
                  </List.Item>
                ))}
              </List>
            </PullToRefresh>
          )}
        </div>
      </div>
    ) : (
    <div className="mobile-page" style={{ paddingTop: 12, paddingBottom: 24 }}>
      {step === 1 && selected && (
        <>
          <div style={{ background: '#fff', borderRadius: 10, padding: 14, marginBottom: 14, border: '1px solid #eef0f3' }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{selected.inspection_no}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              {selected.supplier_name} · {selected.material_code} {selected.material_name} · 数量 {selected.quantity ?? '—'}
            </div>
          </div>

          <Section title={`检验项（${doneItems}/${items.length}）`}>
            {items.length === 0 ? (
              <div style={{ fontSize: 12, color: '#999', padding: 10 }}>
                该单暂无检验项（PC 端未加载标准），请直接整体判定
              </div>
            ) : items.map((it, idx) => (
              <ItemRow key={it.item_id || idx} idx={idx} item={it}
                setItemResult={setItemResult} addSampleValue={addSampleValue}
                updateSample={updateSample} removeSample={removeSample} />
            ))}
          </Section>

          <Section title="整体判定">
            <div style={{ display: 'flex', gap: 20, marginBottom: 8 }}>
<Radio.Group value={items.every((i) => !i.result) ? undefined : (items.some((i) => i.result === '不合格') ? '不合格' : '合格')}
              onChange={() => { /* 从 items 自动推导 */ }}>

              <Radio value="合格">合格（{items.filter((i) => i.result === '合格').length} 项）</Radio>
              <Radio value="不合格">不合格（{items.filter((i) => i.result === '不合格').length} 项）</Radio>
            </Radio.Group>            </div>

            <div style={{ fontSize: 11, color: '#999' }}>整体结果 = 所有项都合格才算合格</div>
          </Section>

          <Section title="备注（可选）">
            <TextArea  value={remarks} onChange={setRemarks} rows={2}
              placeholder="不合格原因 / 特殊说明" />
          </Section>

          <div style={{ display: 'flex', gap: 12 }}>
            <Button block fill="outline" onClick={() => setStep(0)}>上一步</Button>
            <Button block color="primary" loading={submitting} onClick={onSubmit}>
              提交（{totalSamples} 样品）
            </Button>
          </div>
        </>
      )}
    </div>
    )
  )
}

// ========== 可复用子组件（ProductInspection 会复用 ItemRow）==========

export function ItemRow({
  idx, item, setItemResult, addSampleValue, updateSample, removeSample,
}: {
  idx: number; item: InspectionItem
  setItemResult: (idx: number, r: '合格' | '不合格') => void
  addSampleValue: (idx: number) => void
  updateSample: (idx: number, svIdx: number, p: any) => void
  removeSample: (idx: number, svIdx: number) => void
}) {
  const status = item.result || '待判'
  const ok = item.result === '合格'
  const fail = item.result === '不合格'
  const color = ok ? '#4CAF50' : fail ? '#F44336' : '#FF9800'
  return (
    <div style={{
      marginBottom: 10, padding: 10, borderRadius: 8,
      background: ok ? '#f1f8e9' : fail ? '#ffebee' : '#fafafa',
      border: '1px solid ' + (ok ? '#c5e1a5' : fail ? '#ef9a9a' : '#eee'),
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>
            {idx + 1}. {item.item_name}
          </div>
          {item.standard_value != null && (
            <div style={{ fontSize: 11, color: '#888' }}>标准值: {item.standard_value}</div>
          )}
        </div>
        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, background: color + '22', color }}>
          {status}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
<Radio.Group value={item.result} onChange={(v) => setItemResult(idx, v as any)}>

        <Radio value="合格">合格</Radio>
        <Radio value="不合格">不合格</Radio>
      </Radio.Group>      </div>


      {/* 样品值 */}
      {item.sample_values.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
            样品值（{item.sample_values.length}）
          </div>
          {item.sample_values.map((sv, si) => (
            <div key={si} style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
              <Input value={sv.sample_no} onChange={(v) => updateSample(idx, si, { sample_no: v })}
                placeholder="S1" style={{ flex: 0.8 }} />
              <Input value={String(sv.measure_value_num ?? sv.measure_value_text ?? '')}
                onChange={(v) => {
                  const num = Number(v)
                  updateSample(idx, si, Number.isNaN(num)
                    ? { measure_value_text: v, measure_value_num: undefined }
                    : { measure_value_num: num, measure_value_text: v })
                }}
                type="number" placeholder="测量值" style={{ flex: 1.2 }} />
              <Input value={sv.defect_desc || ''} onChange={(v) => updateSample(idx, si, { defect_desc: v })}
                placeholder="缺陷(可选)" style={{ flex: 1.2 }} />
              <Button size="mini" fill="outline" onClick={() => removeSample(idx, si)}>✕</Button>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 6 }}>
        <Button size="mini" fill="outline" onClick={() => addSampleValue(idx)}>+ 加样品</Button>
      </div>
    </div>
  )
}

export function Section({ title, children }: { title: string; children: any }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: 12,
      border: '1px solid #eef0f3', marginBottom: 12,
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  )
}

export function Empty({ text, sub }: { text: string; sub?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
      {text}{sub && <div style={{ fontSize: 12, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}
