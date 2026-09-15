/**
 * 过程检验移动端
 *
 * 3 步流程：
 *   Step 1: 选/扫在制品（来源：开工态的报工单）
 *   Step 2: 填过程参数 + 判定
 *   Step 3: 提交 → 直接生成过程检验记录（已完成态）
 *
 * 后端接口：
 *   GET  /api/basic/process-inspections/wip?keyword=xxx   在制品列表
 *   POST /api/basic/process-inspections/submit           一步提交
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, List, SearchBar, Toast, Radio, Input, Steps, PullToRefresh } from 'antd-mobile'
import api from '../../utils/api'
import { offlinePost } from '../offline/offlineApi'
import { useBarcode } from '../hooks/useBarcode'

interface WipRow {
  report_order_id: number
  work_order_no: string
  process_name?: string
  product_name?: string
  material_code?: string
  quantity?: number
}

type Step = 0 | 1 | 2

export default function MobileProcessInspection() {
  const navigate = useNavigate()
  const { scan } = useBarcode()
  const [step, setStep] = useState<Step>(0)
  const [list, setList] = useState<WipRow[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<WipRow | null>(null)
  const [temperature, setTemperature] = useState('')
  const [humidity, setHumidity] = useState('')
  const [ph, setPh] = useState('')
  const [result, setResult] = useState<'合格' | '不合格'>('合格')
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successNo, setSuccessNo] = useState('')

  const load = async (kw?: string): Promise<WipRow[]> => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page: 1, page_size: 30 }
      if (kw) params.keyword = kw
      const r: any = await api.get('/basic/process-inspections/wip', { params })
      const list: WipRow[] = r.success ? (r.data?.list || []) : []
      setList(list)
      return list
    } catch {
      return []
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const onScan = async () => {
    const r = await scan()
    if (!r) return
    setKeyword(r.code)
    const list2 = await load(r.code)
    if (list2.length === 1) {
      setSelected(list2[0])
      setStep(1)
    } else if (list2.length > 1) {
      Toast.show({ content: `命中 ${list2.length} 条，请手动选择`, position: 'bottom', duration: 1500 })
    } else {
      Toast.show({ content: '未找到匹配在制品', position: 'bottom' })
    }
  }

  const onSearch = () => { load(keyword.trim()) }

  const submit = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      const r: any = await offlinePost('/basic/process-inspections/submit', {
        report_order_id: selected.report_order_id,
        work_order_no: selected.work_order_no,
        process_name: selected.process_name,
        product_name: selected.product_name,
        material_code: selected.material_code,
        quantity: selected.quantity,
        temperature,
        humidity,
        ph,
        result,
        remarks,
      }, { source: 'process-inspection' })
      if (!r.success) {
        Toast.show({ content: r.message || '提交失败', position: 'bottom' })
        return
      }
      // 离线入队时给出更明显的提示
      if (r.data?.queued) {
        Toast.show({ content: '已暂存，网络恢复后自动同步', icon: 'success', position: 'bottom' })
      }
      setSuccessNo(r.data?.inspection_no || '（离线暂存）')
      setStep(2)
    } catch (e: any) {
      Toast.show({ content: e?.message || '提交失败', position: 'bottom' })
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setStep(0); setSelected(null)
    setTemperature(''); setHumidity(''); setPh('')
    setResult('合格'); setRemarks(''); setKeyword(''); setSuccessNo('')
    load()
  }

  if (step === 2 && selected) {
    return (
      <div className="mobile-page" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 60 }}>{result === '合格' ? '✅' : '⚠️'}</div>
        <div style={{ fontSize: 18, fontWeight: 600, margin: '16px 0 8px' }}>
          过程检验{result}
        </div>
        {successNo && (
          <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>
            单号：{successNo}
          </div>
        )}
        <div style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
          {selected.work_order_no} · {selected.process_name}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button block fill="outline" onClick={() => navigate(-1)}>返回</Button>
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
            placeholder="扫工单号 / 手输"
            value={keyword}
            onChange={setKeyword}
            onSearch={onSearch}

            style={{ marginBottom: 12 }}
          />
          <Button size="mini" onClick={onScan} style={{marginTop:8}}>扫码</Button>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>加载中...</div>
          ) : list.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
              暂无在制品<br />
              <span style={{ fontSize: 12 }}>请先在 PC 端下发生产订单并开工报工</span>
            </div>
          ) : (
            <PullToRefresh onRefresh={async () => { await load(keyword.trim() || undefined) }}>
              <List>
                {list.map(r => (
                  <List.Item
                    key={r.report_order_id}
                    onClick={() => { setSelected(r); setStep(1) }}
                    arrow
                    description={
                      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                        {r.process_name} · {r.product_name} · {r.quantity ?? '—'}件
                      </div>
                    }>
                    <div style={{ fontWeight: 500 }}>{r.work_order_no}</div>
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
            <div style={{ fontSize: 15, fontWeight: 600 }}>{selected.work_order_no} · {selected.process_name}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              {selected.product_name} · 计划 {selected.quantity ?? '—'}
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
            <div style={{ display: 'flex', gap: 20 }}>
<Radio.Group value={result} onChange={(v) => setResult(v as any)}>

              <Radio value="合格">合格</Radio>
              <Radio value="不合格">不合格</Radio>
            </Radio.Group>            </div>

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
