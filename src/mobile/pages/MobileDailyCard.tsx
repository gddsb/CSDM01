/**
 * 日报卡 / 移动端数据看板（Phase 3 · R-A）
 *
 * 三合一 Tab：生产 / 质量 / 管理
 * 后端：GET /api/auto/dashboard/{production,quality,management}
 *
 * 设计原则：
 *  - 移动端只展示"关键指标"和"近7/30天趋势"，不做大表格
 *  - 全部使用后端 DashboardService 已有接口，不造新 API
 */
import { useCallback, useEffect, useState } from 'react'
import { Tabs, PullToRefresh, Empty } from 'antd-mobile'
import api from '../../utils/api'

type Tab = 'production' | 'quality' | 'management'

function fmtNum(n: any): string {
  const v = Number(n)
  if (isNaN(v)) return '—'
  if (Math.abs(v) >= 10000) return (v / 10000).toFixed(1) + '万'
  return v.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

function fmtPct(n: any): string {
  const v = Number(n)
  if (isNaN(v)) return '—'
  return v.toFixed(1) + '%'
}

export default function MobileDailyCard() {
  const [tab, setTab] = useState<Tab>('production')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async (t: Tab) => {
    setLoading(true)
    try {
      const r: any = await api.get(`/auto/dashboard/${t}`)
      if (r.success) setData(r.data)
      else setData(null)
    } catch {
      setData(null)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData(tab) }, [tab, fetchData])

  const onRefresh = async () => { await fetchData(tab) }

  return (
    <div className="mobile-page-fixed-header">
      <div className="mobile-sticky-header">
        <Tabs activeKey={tab} onChange={(k) => setTab(k as Tab)}>
          <Tabs.Tab title="🏭 生产" key="production" />
          <Tabs.Tab title="🔬 质量" key="quality" />
          <Tabs.Tab title="📊 管理" key="management" />
        </Tabs>
      </div>
      <div className="mobile-page-scroll-list">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--m-text-3)' }}>加载中...</div>
        ) : !data ? (
          <Empty description="暂无数据" />
        ) : (
          <PullToRefresh onRefresh={onRefresh}>
            {tab === 'production' && <ProductionPanel data={data} />}
            {tab === 'quality' && <QualityPanel data={data} />}
            {tab === 'management' && <ManagementPanel data={data} />}
          </PullToRefresh>
        )}
      </div>
    </div>
  )
}

// ====================== 生产看板 ======================

function ProductionPanel({ data }: { data: any }) {
  const dailyTrend: any[] = data.dailyTrend || []
  const last3 = dailyTrend.slice(-3)
  const latest = dailyTrend[dailyTrend.length - 1] || {}
  const defectList: any[] = data.processDefectList || []

  // 今日产出（最新一天所有产线之和）
  const todayOutput = Object.values(latest).reduce((acc: number, v: any) => {
    if (typeof v === 'number') return acc + v
    return acc
  }, 0)

  const lines: string[] = data.productionLines?.map((l: any) => l.line_name).filter(Boolean) || []

  return (
    <div>
      {/* KPI 横卡 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <KpiCard label="今日产出" value={fmtNum(todayOutput)} color="#2196F3" unit="件" />
        <KpiCard label="活跃产线" value={String(lines.length)} color="#4CAF50" unit="条" />
      </div>

      {/* 近3天产量简表 */}
      <SectionTitle>近3天产量</SectionTitle>
      <Card>
        {last3.length === 0 ? <EmptyHint text="暂无趋势数据" /> : (
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--m-text-3)', borderBottom: '1px solid var(--m-border)' }}>
                <th style={{ textAlign: 'left', padding: '6px 0' }}>日期</th>
                {lines.slice(0, 3).map((ln) => (
                  <th key={ln} style={{ textAlign: 'right', padding: '6px 0' }}>{ln.slice(0, 6)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {last3.map((d) => (
                <tr key={d.date} style={{ borderBottom: '1px dashed #f0f0f0' }}>
                  <td style={{ padding: '8px 0', color: 'var(--m-text-2)' }}>{String(d.date).slice(5)}</td>
                  {lines.slice(0, 3).map((ln) => (
                    <td key={ln} style={{ textAlign: 'right', padding: '8px 0', fontWeight: 500 }}>
                      {fmtNum(d[ln] || 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* 工序不良 TOP */}
      {defectList.length > 0 && (
        <>
          <SectionTitle>工序不良 TOP 5</SectionTitle>
          <Card>
            {defectList.slice(0, 5).map((p, i) => (
              <div key={p.name} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 0', borderBottom: i < defectList.slice(0, 5).length - 1 ? '1px solid #f0f0f0' : 'none',
              }}>
                <span style={{ fontSize: 13 }}>{i + 1}. {p.name}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-color-danger)' }}>{fmtNum(p.total)}</span>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  )
}

// ====================== 质量看板 ======================

function QualityPanel({ data }: { data: any }) {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

  // 后端没有直接给"今日合格数"的聚合，但有 inspection 数组
  const incoming: any[] = data.incomingInspections || []
  const product: any[] = data.productInspections || []
  const microbe: any[] = data.microbeInspections || []

  const todayFilter = (arr: any[]) => arr.filter((i) => {
    if (!i.created_at) return false
    const d = new Date(i.created_at)
    return d >= todayStart
  })

  const todayIncoming = todayFilter(incoming)
  const todayProduct = todayFilter(product)
  const todayMicrobe = todayFilter(microbe)

  const okRate = (arr: any[]) => {
    if (arr.length === 0) return null
    const ok = arr.filter((i) => String(i.result) === '合格').length
    return { ok, total: arr.length, rate: (ok / arr.length) * 100 }
  }

  const inRate = okRate(todayIncoming)
  const prodRate = okRate(todayProduct)
  const microRate = okRate(todayMicrobe)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <KpiCard label="来料送检" value={String(todayIncoming.length)} color="#4CAF50" unit="单" />
        <KpiCard label="成品送检" value={String(todayProduct.length)} color="#FF9800" unit="单" />
      </div>

      <SectionTitle>今日合格率</SectionTitle>
      <Card>
        <RateRow label="来料检验" rate={inRate} color="#4CAF50" />
        <RateRow label="成品/制程" rate={prodRate} color="#FF9800" />
        <RateRow label="微生物" rate={microRate} color="#9C27B0" />
      </Card>

      {data.instruments && data.instruments.length > 0 && (
        <>
          <SectionTitle>仪器校准状态</SectionTitle>
          <Card>
            {data.instruments.slice(0, 8).map((it: any, i: number) => (
              <div key={it.instrument_id || i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 0', borderBottom: i < data.instruments.length - 1 ? '1px solid #f0f0f0' : 'none',
              }}>
                <span style={{ fontSize: 13 }}>{it.instrument_name || it.name}</span>
                <span style={{
                  fontSize: 11, padding: '1px 8px', borderRadius: 8,
                  background: it.status === '已校准' ? '#E8F5E9' : '#FFEBEE',
                  color: it.status === '已校准' ? 'var(--brand-color-success)' : 'var(--brand-color-danger)',
                }}>{it.status || '—'}</span>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  )
}

// ====================== 管理看板 ======================

function ManagementPanel({ data }: { data: any }) {
  // managementDashboard 返回的字段不完全确定，用"存在则展示"方式
  const cards = [
    { label: '生产订单', value: data.orders?.length ?? data.orderCount ?? null },
    { label: '报工单', value: data.workOrders?.length ?? data.reportOrderCount ?? null },
    { label: '设备数', value: data.devices?.length ?? data.deviceCount ?? null },
    { label: '工序数', value: data.processes?.length ?? data.processCount ?? null },
    { label: '在线人员', value: data.activePersonnel ?? null },
    { label: '待处理异常', value: data.pendingExceptions ?? null },
  ]

  const valid = cards.filter((c) => c.value !== null && c.value !== undefined)

  return (
    <div>
      {valid.length === 0 ? (
        <EmptyHint text="管理看板数据结构待接入" sub="后端 managementDashboard 返回值字段未完全解析" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          {valid.map((c) => (
            <KpiCard key={c.label} label={c.label} value={fmtNum(c.value)} color="#3F51B5" />
          ))}
        </div>
      )}

      {data.workOrders && data.workOrders.length > 0 && (
        <>
          <SectionTitle>最新报工单</SectionTitle>
          <Card>
            {data.workOrders.slice(0, 5).map((wo: any, i: number) => (
              <div key={wo.report_order_id || i} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '8px 0', borderBottom: i < Math.min(data.workOrders.length, 5) - 1 ? '1px solid #f0f0f0' : 'none',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{wo.report_no || wo.work_order_no || wo.order_no}</div>
                  <div style={{ fontSize: 11, color: 'var(--m-text-3)', marginTop: 2 }}>{wo.line_name || '—'} · {wo.material_name || ''}</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 12 }}>
                  <div>{fmtNum(wo.report_qty || wo.planned_qty)} 件</div>
                  <div style={{ color: 'var(--m-text-3)', marginTop: 2 }}>{wo.status || ''}</div>
                </div>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  )
}

// ====================== 公共组件 ======================

function KpiCard({ label, value, color, unit }: { label: string; value: string; color: string; unit?: string }) {
  return (
    <div style={{
      flex: 1, background: 'var(--m-surface)', borderRadius: 10, padding: 14,
      border: '1px solid var(--m-border)',
    }}>
      <div style={{ fontSize: 12, color: 'var(--m-text-3)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>
        {value}
        {unit && <span style={{ fontSize: 12, color: 'var(--m-text-3)', fontWeight: 400, marginLeft: 4 }}>{unit}</span>}
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--m-text-2)', marginTop: 16, marginBottom: 8, paddingLeft: 4 }}>
      {children}
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--m-surface)', borderRadius: 10, padding: '6px 14px',
      border: '1px solid var(--m-border)',
    }}>
      {children}
    </div>
  )
}

function RateRow({ label, rate, color }: { label: string; rate: { ok: number; total: number; rate: number } | null; color: string }) {
  if (!rate) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 13, borderBottom: '1px dashed #f0f0f0' }}>
        <span style={{ color: 'var(--m-text-2)' }}>{label}</span>
        <span style={{ color: 'var(--m-text-3)' }}>今日暂无数据</span>
      </div>
    )
  }
  return (
    <div style={{ padding: '10px 0', borderBottom: '1px dashed #f0f0f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
        <span style={{ color: 'var(--m-text-2)' }}>{label}</span>
        <span style={{ fontWeight: 600, color }}>{fmtPct(rate.rate)} <span style={{ color: 'var(--m-text-3)', fontWeight: 400 }}>({rate.ok}/{rate.total})</span></span>
      </div>
      <div style={{ height: 4, background: 'var(--m-border-2)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${rate.rate}%`, background: color, transition: 'width .3s' }} />
      </div>
    </div>
  )
}

function EmptyHint({ text, sub }: { text: string; sub?: string }) {
  return <div style={{ textAlign: 'center', padding: 40, color: 'var(--m-text-3)' }}>{text}{sub && <div style={{ fontSize: 12, marginTop: 6 }}>{sub}</div>}</div>
}
