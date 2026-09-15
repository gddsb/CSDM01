/**
 * 过程检验移动端
 * 后端暂缺专用 Controller（PC 端也 mock），先做成"选在制品 → 填过程参数 → 快速判定"
 * 后续有后端接口时只需把 fetchRecord / submit 两个函数替换即可
 */
import { useState } from 'react'
import { Button, List, SearchBar, Toast, Radio, Input, Steps } from 'antd-mobile'
import { useBarcode } from '../hooks/useBarcode'

interface WipRow {
  work_order_no: string
  process_name: string
  product_name?: string
  quantity?: number
}

type Step = 0 | 1 | 2

export default function MobileProcessInspection() {
  const { scan } = useBarcode()
  const [step, setStep] = useState<Step>(0)
  const [list] = useState<WipRow[]>([
    { work_order_no: 'WO260915001', process_name: '杀菌', product_name: '700g圣元卡迪夫3段', quantity: 1200 },
    { work_order_no: 'WO260915002', process_name: '灌装', product_name: '400g爱智宝1段', quantity: 800 },
    { work_order_no: 'WO260915003', process_name: '喷粉', product_name: '1000g优护2段', quantity: 2000 },
  ])
  const [keyword, setKeyword] = useState('')
  const [selected, setSelected] = useState<WipRow | null>(null)
  const [temperature, setTemperature] = useState('')
  const [humidity, setHumidity] = useState('')
  const [ph, setPh] = useState('')
  const [result, setResult] = useState<'合格' | '不合格'>('合格')
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const filtered = keyword
    ? list.filter(r => r.work_order_no.includes(keyword) || (r.product_name || '').includes(keyword))
    : list

  const onScan = async () => {
    const r = await scan(); if (!r) return
    setKeyword(r.code)
  }

  const submit = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      // TODO: 替换为真实后端接口，例如 POST /basic/process-inspections
      await new Promise(resolve => setTimeout(resolve, 400))
      setStep(2)
    } catch (e: any) {
      Toast.show({ content: e?.message || '提交失败', position: 'bottom' })
    } finally { setSubmitting(false) }
  }

  const reset = () => {
    setStep(0); setSelected(null)
    setTemperature(''); setHumidity(''); setPh(''); setResult('合格'); setRemarks(''); setKeyword('')
  }

  if (step === 2 && selected) {
    return (
      <div className="mobile-page" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 60 }}>{result === '合格' ? '✅' : '⚠️'}</div>
        <div style={{ fontSize: 18, fontWeight: 600, margin: '16px 0 8px' }}>
          过程检验{result}
        </div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
          {selected.work_order_no} · {selected.process_name}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button block fill="outline" onClick={() => setStep(0)}>返回</Button>
          <Button block color="primary" onClick={reset}>继续</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mobile-page" style={{ paddingTop: 12 }}>
      <Steps current={step} direction="vertical" style={{ marginBottom: 16 }}>
        <Steps.Step title="选在制品" description={step > 0 ? selected?.work_order_no : ''} />
        <Steps.Step title="填参数" description={step > 1 ? result : ''} />
        <Steps.Step title="提交" />
      </Steps>

      {step === 0 && (
        <>
          <SearchBar
            placeholder="扫工单 / 手输"
            value={keyword} onChange={setKeyword}
            onRightIconClick={onScan}
            right={<span style={{ fontSize: 12, color: '#2196F3' }}>扫码</span>}
            style={{ marginBottom: 12 }}
          />
          <List>
            {filtered.map(r => (
              <List.Item key={r.work_order_no} onClick={() => { setSelected(r); setStep(1) }} arrow
                description={
                  <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                    {r.process_name} · {r.product_name} · {r.quantity}件
                  </div>
                }>
                <div style={{ fontWeight: 500 }}>{r.work_order_no}</div>
              </List.Item>
            ))}
          </List>
          <div style={{ textAlign: 'center', fontSize: 11, color: '#aaa', padding: '20px 0' }}>
            过程检验后端接口暂未开放 · 当前为演示数据
          </div>
        </>
      )}

      {step === 1 && selected && (
        <>
          <div style={{ background: '#fff', borderRadius: 10, padding: 14, marginBottom: 14, border: '1px solid #eef0f3' }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{selected.work_order_no} · {selected.process_name}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              {selected.product_name} · 计划 {selected.quantity}
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 10, padding: 14, border: '1px solid #eef0f3', marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>过程参数（快速填写）</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Input placeholder="温度 (°C)" type="number" value={temperature} onChange={setTemperature} />
              <Input placeholder="湿度 (%)" type="number" value={humidity} onChange={setHumidity} />
              <Input placeholder="pH 值" value={ph} onChange={setPh} />
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 10, padding: 14, border: '1px solid #eef0f3', marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 10 }}>判定</div>
            <Radio.Group value={result} onChange={(v) => setResult(v as any)}
              style={{ display: 'flex', gap: 20 }}>
              <Radio value="合格">合格</Radio>
              <Radio value="不合格">不合格</Radio>
            </Radio.Group>
            <textarea
              value={remarks} onChange={(e) => setRemarks(e.target.value)}
              placeholder="说明（可选）" rows={2}
              style={{ width: '100%', marginTop: 12, padding: 8, borderRadius: 8, border: '1px solid #eef0f3', fontSize: 14 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <Button block fill="outline" onClick={() => setStep(0)}>上一步</Button>
            <Button block color="primary" loading={submitting} onClick={submit}>提交</Button>
          </div>
        </>
      )}
    </div>
  )
}
