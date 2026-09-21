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
 *   GET  /api/basic/process-inspections?status=2          已完成列表
 *   POST /api/basic/process-inspections/submit           一步提交
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, List, SearchBar, Toast, Radio, Input, PullToRefresh, Tabs } from 'antd-mobile'
import api from '../../utils/api'
import { offlinePost } from '../offline/offlineApi'

interface WipRow {
  report_order_id: number
  work_order_no: string
  inspection_no?: string
  process_name?: string
  product_name?: string
  material_code?: string
  quantity?: number
}

type Step = 0 | 1 | 2

type StatusTab = '全部' | '待检' | '已完成'
const PROCESS_TABS: { key: StatusTab; label: string; color: string }[] = [
  { key: '全部',   label: '全部',   color: 'var(--m-text-3)' },
  { key: '待检',   label: '待检',   color: 'var(--brand-color-warning)' },
  { key: '已完成', label: '已完成', color: 'var(--brand-color-success)' },
]

export default function MobileProcessInspection() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(0)
  const [list, setList] = useState<any[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<any | null>(null)
  const [temperature, setTemperature] = useState('')
  const [humidity, setHumidity] = useState('')
  const [ph, setPh] = useState('')
  const [result, setResult] = useState<'合格' | '不合格'>('合格')
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successNo, setSuccessNo] = useState('')
  const [tab, setTab] = useState<StatusTab>('全部')

  const load = async (tabKey?: StatusTab, kw?: string): Promise<any[]> => {
    const currentTab = tabKey ?? tab
    const k = kw ?? keyword
    setLoading(true)
    try {
      let wipList: any[] = []
      let doneList: any[] = []
      const params: Record<string, unknown> = { page: 1, pageSize: 30 }
      if (k) params.keyword = k

      if (currentTab === '全部' || currentTab === '待检') {
        try {
          const wipRes: any = await api.get('/basic/process-inspections/wip', { params })
          wipList = (wipRes.success ? (wipRes.data?.list || wipRes.data) : []) || []
        } catch { /* ignore */ }
      }
      if (currentTab === '全部' || currentTab === '已完成') {
        try {
          const doneRes: any = await api.get('/basic/process-inspections', { params: { ...params, status: 2 } })
          doneList = doneRes.success ? (doneRes.data?.list || doneRes.data?.rows || []) : []
        } catch { /* ignore */ }
      }

      const merged = [
        ...wipList.map((w: any) => ({ kind: 'wip' as const, ...w })),
        ...doneList.map((d: any) => ({ kind: 'done' as const, ...d })),
      ]
      setList(merged)
      return merged
    } catch { return [] } finally { setLoading(false) }
  }

  useEffect(() => { load(undefined, keyword) }, [tab, keyword])

  const onSearch = () => { load(tab, keyword.trim()) }

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
        quantity: Math.round(selected.quantity || 0),
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
    load(tab)
  }

  if (step === 2 && selected) {
    return (
      <div className="mobile-page" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 60 }}>{result === '合格' ? '✅' : '⚠️'}</div>
        <div style={{ fontSize: 18, fontWeight: 600, margin: '16px 0 8px' }}>
          过程检验{result}
        </div>
        {successNo && (
          <div style={{ fontSize: 13, color: 'var(--m-text-2)', marginBottom: 4 }}>
            单号：{successNo}
          </div>
        )}
        <div style={{ fontSize: 13, color: 'var(--m-text-3)', marginBottom: 24 }}>
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
    step === 0 ? (
      <div className="mobile-page-fixed-header">
        <div className="mobile-sticky-header">
          <SearchBar
            placeholder="扫工单号 / 手输"
            value={keyword}
            onChange={setKeyword}
            onSearch={onSearch}
          />
          {/* 状态 Tab */}
          <div style={{
            background: 'var(--m-surface)', borderRadius: 12, padding: '4px 10px', marginTop: 8,
            boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
          }}>
            <Tabs activeKey={tab} onChange={(k) => setTab(k as StatusTab)}>
              {PROCESS_TABS.map((t) => (
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
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--m-text-3)' }}>加载中...</div>
          ) : list.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--m-text-3)' }}>
              暂无数据<br />
              <span style={{ fontSize: 12 }}>{tab === '已完成' ? '还没有已完成的过程检验记录' : '请先在 PC 端下发生产订单并开工报工'}</span>
            </div>
          ) : (
            <PullToRefresh onRefresh={async () => { await load(tab, keyword.trim()) }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 2px' }}>
                {list.map((r) => {
                  const isDone = r.kind === 'done'
                  const stColor = isDone ? PROCESS_TABS[2].color : PROCESS_TABS[1].color
                  const stText  = isDone ? '已完成' : '待检'
                  const title = isDone ? (r.inspection_no || r.work_order_no) : r.work_order_no
                  return (
                    <div
                      key={isDone ? (r.inspection_no || r.id) : r.report_order_id}
                      onClick={() => { setSelected(r); setStep(1) }}
                      style={{
                        background: 'var(--m-surface)', borderRadius: 14, padding: '14px 14px 12px 18px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.02)',
                        borderLeft: `3px solid ${stColor}`,
                      }}
                    >
                      {/* 第一行 — 工单号/检验单号 + 状态 */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--m-text)', flexShrink: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {title}
                        </div>
                        <span style={{
                          fontSize: 11, padding: '3px 10px', borderRadius: 12, flexShrink: 0,
                          background: stColor + '15', color: stColor,
                          fontWeight: 600, border: `1px solid ${stColor}44`, letterSpacing: 0.5,
                        }}>
                          {stText}
                        </span>
                      </div>
                      {/* 第二行 — 工序/产品（左） + 检验按钮（右） */}
                      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0, lineHeight: 1.4, fontSize: 13, color: 'var(--m-text-2)' }}>
                          <span style={{ color: 'var(--brand-color)' }}>{r.process_name}</span>
                          <div style={{ fontSize: 11, color: 'var(--m-text-3)', marginTop: 2 }}>
                            {r.product_name || '—'} · 计划 {Math.round(r.quantity ?? 0)} 件
                          </div>
                        </div>
                        {!isDone && (
                          <Button
                            size="mini"
                            color="primary"
                            onClick={(e) => { e.stopPropagation(); setSelected(r); setStep(1) }}
                          >
                            检验
                          </Button>
                        )}
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
            <div style={{ fontSize: 15, fontWeight: 600 }}>{selected.work_order_no} · {selected.process_name}</div>
            <div style={{ fontSize: 12, color: 'var(--m-text-3)', marginTop: 4 }}>
              {selected.product_name} · 计划 {selected.quantity ?? '—'}
            </div>
          </div>

          <div style={{ background: 'var(--m-surface)', borderRadius: 10, padding: 14, border: '1px solid var(--m-border)', marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--m-text-2)', marginBottom: 8 }}>过程参数（快速填写）</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Input placeholder="温度 (°C)" type="number" value={temperature} onChange={setTemperature} />
              <Input placeholder="湿度 (%)" type="number" value={humidity} onChange={setHumidity} />
              <Input placeholder="pH 值" value={ph} onChange={setPh} />
            </div>
          </div>

          <div style={{ background: 'var(--m-surface)', borderRadius: 10, padding: 14, border: '1px solid var(--m-border)', marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--m-text-2)', marginBottom: 10 }}>判定</div>
            <div style={{ display: 'flex', gap: 20 }}>
<Radio.Group value={result} onChange={(v) => setResult(v as any)}>

              <Radio value="合格">合格</Radio>
              <Radio value="不合格">不合格</Radio>
            </Radio.Group>            </div>

            <textarea
              value={remarks} onChange={(e) => setRemarks(e.target.value)}
              placeholder="说明（可选）" rows={2}
              style={{ width: '100%', marginTop: 12, padding: 8, borderRadius: 8, border: '1px solid var(--m-border)', fontSize: 14 }}
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
  )
}
