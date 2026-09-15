/**
 * 成品检验移动端
 * 后端: ProductInspectionController /basic/product-inspections
 * 流程: 选/扫检验单 → 查看检验项 → 逐项判定 → 整体提交
 */
import { useEffect, useState } from 'react'
import { Steps, Button, List, SearchBar, Toast, Radio, Checkbox, Tag } from 'antd-mobile'
import api from '../../utils/api'
import { useBarcode } from '../hooks/useBarcode'

interface Inspection {
  inspection_id: number
  inspection_no: string
  status?: string
  result?: string
  inspection_type?: string
  material_code?: string
  material_name?: string
  report_order_no?: string
  standard_name?: string
}

interface QcItem {
  qc_item_id?: number | string
  item_name: string
  item_code?: string
  result?: string // '合格' | '不合格'
  [k: string]: any
}

type Step = 0 | 1 | 2

export default function MobileProductInspection() {
  const { scan } = useBarcode()
  const [step, setStep] = useState<Step>(0)
  const [list, setList] = useState<Inspection[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Inspection | null>(null)
  const [items, setItems] = useState<QcItem[]>([])
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page: 1, page_size: 30, status: '检验中' }
      if (keyword) params.inspection_no = keyword
      const r: any = await api.get('/basic/product-inspections', { params })
      if (r.success) setList(r.data?.list || r.data?.rows || [])
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const onPick = async (ins: Inspection) => {
    setSelected(ins); setStep(1)
    // 拉详情取检验项
    try {
      const r: any = await api.get(`/basic/product-inspections/${ins.inspection_id}`)
      if (r.success && r.data?.items?.length) {
        setItems(r.data.items.map((it: any) => ({
          qc_item_id: it.qc_item_id,
          item_name: it.item_name,
          item_code: it.item_code,
          result: it.result || undefined,
        })))
      } else {
        setItems([])
        Toast.show({ content: '该检验单暂无检验项', position: 'bottom' })
      }
    } catch (e: any) {
      Toast.show({ content: e?.message || '加载失败', position: 'bottom' })
    }
  }

  const onScan = async () => {
    const r = await scan(); if (!r) return
    setKeyword(r.code); await load()
    if (list.length === 1) onPick(list[0])
  }

  const setItemResult = (idx: number, v: string) => {
    setItems(arr => arr.map((it, i) => i === idx ? { ...it, result: v } : it))
  }

  const submit = async () => {
    if (!selected) return
    const undone = items.filter(i => !i.result)
    if (undone.length > 0) {
      Toast.show({ content: `还有 ${undone.length} 项未判定`, position: 'bottom' })
      return
    }
    setSubmitting(true)
    try {
      // 先 start（如果还是待检）
      try { await api.put(`/basic/product-inspections/${selected.inspection_id}/start`) } catch {}
      const finalResult = items.every(i => i.result === '合格') ? '合格' : '不合格'
      await api.put(`/basic/product-inspections/${selected.inspection_id}`, {
        result: finalResult,
        remarks,
        items: items.map(i => ({ ...i, result: i.result })),
      })
      await api.put(`/basic/product-inspections/${selected.inspection_id}/submit`)
      setStep(2)
    } catch (e: any) {
      Toast.show({ content: e?.message || '提交失败', position: 'bottom' })
    } finally { setSubmitting(false) }
  }

  const reset = () => {
    setStep(0); setSelected(null); setItems([]); setRemarks(''); setKeyword(''); load()
  }

  // =========== Render ===========

  if (step === 2) {
    const allOk = items.every(i => i.result === '合格')
    return (
      <div className="mobile-page" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 60 }}>{allOk ? '✅' : '⚠️'}</div>
        <div style={{ fontSize: 18, fontWeight: 600, margin: '16px 0 8px' }}>
          {allOk ? '成品检验合格' : '检验不合格'}
        </div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
          单号: {selected?.inspection_no} · {items.length} 项全部判定完成
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button block fill="outline" onClick={reset}>返回</Button>
          <Button block color="primary" onClick={reset}>继续检验</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mobile-page" style={{ paddingTop: 12 }}>
      <Steps current={step} direction="vertical" style={{ marginBottom: 16 }}>
        <Steps.Step title="选检验单" description={step > 0 ? selected?.inspection_no : ''} />
        <Steps.Step title="逐项判定" description={step > 1 ? `${items.filter(i=>i.result).length}/${items.length}` : ''} />
        <Steps.Step title="提交" />
      </Steps>

      {step === 0 && (
        <>
          <SearchBar
            placeholder="扫/输检验单号"
            value={keyword} onChange={setKeyword} onSearch={load}
            onRightIconClick={onScan}
            right={<span style={{ fontSize: 12, color: '#2196F3' }}>扫码</span>}
            style={{ marginBottom: 12 }}
          />
          {loading ? <EmptyHint text="加载中..." /> : list.length === 0 ? (
            <EmptyHint text="暂无可检成品单" sub="请先在 PC 端创建成品检验单" />
          ) : (
            <List>
              {list.map(r => (
                <List.Item key={r.inspection_id} onClick={() => onPick(r)} arrow
                  description={
                    <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                      {r.material_code} {r.material_name?.slice(0, 16)} · {r.status}
                      {r.inspection_type && <Tag color="primary" style={{ marginLeft: 6 }}>{r.inspection_type}</Tag>}
                    </div>
                  }>
                  <div style={{ fontWeight: 500 }}>{r.inspection_no}</div>
                </List.Item>
              ))}
            </List>
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

          {items.length === 0 ? (
            <EmptyHint text="该单暂无检验项" sub="无法移动端判定" />
          ) : (
            <div style={{ background: '#fff', borderRadius: 10, padding: 14, border: '1px solid #eef0f3', marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                检验项（{items.filter(i=>i.result).length}/{items.length}）
              </div>
              {items.map((it, idx) => (
                <div key={it.qc_item_id ?? idx} style={{
                  padding: '10px 0', borderBottom: idx < items.length-1 ? '1px solid #f0f0f0' : 'none',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>
                    {idx + 1}. {it.item_name}
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                    <Radio.CheckboxItem
                      checked={it.result === '合格'}
                      onChange={() => setItemResult(idx, '合格')}
                    >合格</Radio.CheckboxItem>
                    <Radio.CheckboxItem
                      checked={it.result === '不合格'}
                      onChange={() => setItemResult(idx, '不合格')}
                    >不合格</Radio.CheckboxItem>
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 14, fontSize: 12, color: '#666' }}>备注</div>
              <textarea
                value={remarks} onChange={(e) => setRemarks(e.target.value)}
                placeholder="不合格说明（可选）" rows={2}
                style={{ width: '100%', marginTop: 4, padding: 8, borderRadius: 8, border: '1px solid #eef0f3', fontSize: 14 }}
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <Button block fill="outline" onClick={() => setStep(0)}>上一步</Button>
            <Button block color="primary" loading={submitting} disabled={items.length === 0} onClick={submit}>
              提交
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function EmptyHint({ text, sub }: { text: string; sub?: string }) {
  return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>{text}{sub && <div style={{ fontSize: 12, marginTop: 6 }}>{sub}</div>}</div>
}
