/**
 * 来料检验移动端
 * - 选/扫来料单 → 判定合格/不合格 → 提交
 * - 如果还没有来料单则快速创建一条新记录
 */
import { useEffect, useState } from 'react'
import { Steps, Button, List, SearchBar, Toast, Dialog, Radio, Input } from 'antd-mobile'
import api from '../../utils/api'
import { useBarcode } from '../hooks/useBarcode'

interface Row {
  inspection_id: number
  inspection_no: string
  supplier_name?: string
  material_name?: string
  material_code?: string
  quantity?: number
  status?: string
  result?: string
}

type Step = 0 | 1 | 2

export default function MobileIncomingInspection() {
  const { scan } = useBarcode()
  const [step, setStep] = useState<Step>(0)
  const [list, setList] = useState<Row[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Row | null>(null)
  const [result, setResult] = useState<'合格' | '不合格'>('合格')
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successNo, setSuccessNo] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page: 1, page_size: 30 }
      if (keyword) params.inspection_no = keyword
      const r: any = await api.get('/basic/incoming-inspections', { params })
      if (r.success) setList(r.data?.list || r.data?.rows || [])
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleScan = async () => {
    const r = await scan()
    if (!r) return
    setKeyword(r.code)
    await load()
    if (list.length === 1) { setSelected(list[0]); setStep(1) }
  }

  const onSubmit = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      // 判定 → 改状态
      await api.put(`/basic/incoming-inspections/${selected.inspection_id}`, {
        result,
        remarks,
      })
      // 报审完成
      try { await api.put(`/basic/incoming-inspections/${selected.inspection_id}/start`) } catch {}
      try { await api.put(`/basic/incoming-inspections/${selected.inspection_id}/submit`) } catch {}
      setSuccessNo(selected.inspection_no)
      setStep(2)
    } catch (e: any) {
      Toast.show({ content: e?.message || '提交失败', position: 'bottom' })
    } finally { setSubmitting(false) }
  }

  const reset = () => {
    setStep(0); setSelected(null); setResult('合格'); setRemarks('')
    setSuccessNo(''); setKeyword(''); load()
  }

  return (
    <div className="mobile-page" style={{ paddingTop: 12 }}>
      <Steps current={step} direction="vertical" style={{ marginBottom: 16 }}>
        <Steps.Step title="选来料单" description={step > 0 ? selected?.inspection_no : ''} />
        <Steps.Step title="判定" description={step > 1 ? result : ''} />
        <Steps.Step title="完成" />
      </Steps>

      {step === 0 && (
        <>
          <SearchBar
            placeholder="扫检验单号 / 手输"
            value={keyword}
            onChange={setKeyword}
            onSearch={load}
            onRightIconClick={handleScan}
            right={<span style={{ fontSize: 12, color: '#2196F3' }}>扫码</span>}
            style={{ marginBottom: 12 }}
          />
          {loading ? <EmptyHint text="加载中..." /> : list.length === 0 ? (
            <EmptyHint text="暂无可检来料单" sub="请先在 PC 端创建来料检验记录" />
          ) : (
            <List>
              {list.map((r) => (
                <List.Item
                  key={r.inspection_id}
                  onClick={() => { setSelected(r); setStep(1) }}
                  arrow
                  description={
                    <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                      {r.supplier_name || '—'} · {r.material_code} {r.material_name || ''} · {r.quantity ?? '—'}
                      <span style={{ marginLeft: 8, color: '#bbb' }}>{r.status}</span>
                    </div>
                  }
                >
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
              {selected.supplier_name} · {selected.material_code} {selected.material_name}
            </div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>数量: {selected.quantity ?? '—'}</div>
          </div>

          <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>检验判定</div>
          <Radio.Group
            value={result}
            onChange={(v) => setResult(v as any)}
            style={{ display: 'flex', gap: 16, marginBottom: 20 }}
          >
            <Radio value="合格">合格</Radio>
            <Radio value="不合格">不合格</Radio>
          </Radio.Group>

          <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>备注（可选）</div>
          <Input
            type="textarea"
            value={remarks}
            onChange={setRemarks}
            placeholder="不合格原因 / 特殊说明"
            rows={3}
            style={{ background: '#fff', borderRadius: 10, border: '1px solid #eef0f3', marginBottom: 20 }}
          />

          <div style={{ display: 'flex', gap: 12 }}>
            <Button block fill="outline" onClick={() => setStep(0)}>上一步</Button>
            <Button block color="primary" loading={submitting} onClick={onSubmit}>提交</Button>
          </div>
        </>
      )}

      {step === 2 && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 56 }}>{result === '合格' ? '✅' : '⚠️'}</div>
          <div style={{ fontSize: 18, fontWeight: 600, margin: '16px 0 8px' }}>
            {result === '合格' ? '检验合格' : '判定为不合格'}
          </div>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 24 }}>单号: {successNo}</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Button block fill="outline" onClick={() => setStep(0)}>返回</Button>
            <Button block color="primary" onClick={reset}>继续检验</Button>
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyHint({ text, sub }: { text: string; sub?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
      {text}{sub && <div style={{ fontSize: 12, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}
