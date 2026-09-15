/**
 * 校准提醒（Phase 2 · Q-B）
 *
 * Tab 1: 即将到期（默认 30 天内）
 * Tab 2: 已逾期
 *
 * 后端接口：
 *   GET /api/basic/device-calibration-plans/expiring/list?days=30
 *   GET /api/basic/device-calibration-plans/overdue/list
 */
import { useEffect, useState } from 'react'
import { Tabs, List, PullToRefresh, Toast, Empty } from 'antd-mobile'
import api from '../../utils/api'

interface PlanRow {
  plan_id: number
  asset_id?: number
  asset_code?: string
  asset_name?: string
  calibration_cycle?: number
  last_calibration_date?: string
  next_calibration_date?: string
  calibration_org?: string
  status?: string | number
  remarks?: string
}

type Tab = 'expiring' | 'overdue'

function daysBetween(iso?: string): number | null {
  if (!iso) return null
  const a = new Date(iso).getTime()
  if (isNaN(a)) return null
  const b = new Date()
  b.setHours(0, 0, 0, 0)
  return Math.round((a - b.getTime()) / (1000 * 60 * 60 * 24))
}

function statusTag(s?: string | number) {
  if (!s) return null
  const text = String(s)
  const isOk = text.includes('已校准')
  const isLocked = text.includes('锁定')
  const bg = isOk ? '#E8F5E9' : isLocked ? '#EEE' : '#FFF3E0'
  const color = isOk ? '#4CAF50' : isLocked ? '#999' : '#FF9800'
  return (
    <span style={{
      fontSize: 11, padding: '1px 8px', borderRadius: 8, background: bg, color,
    }}>{text}</span>
  )
}

export default function MobileCalibrationReminder() {
  const [tab, setTab] = useState<Tab>('expiring')
  const [list, setList] = useState<PlanRow[]>([])
  const [loading, setLoading] = useState(false)
  const [daysFilter, setDaysFilter] = useState(15)
  const [expiringCount, setExpiringCount] = useState(0)
  const [overdueCount, setOverdueCount] = useState(0)

  const fetchList = async () => {
    setLoading(true)
    try {
      let endpoint = ''
      const params: Record<string, unknown> = {}
      if (tab === 'expiring') {
        endpoint = '/basic/device-calibration-plans/expiring/list'
        params.days = daysFilter
      } else {
        endpoint = '/basic/device-calibration-plans/overdue/list'
      }
      const r: any = await api.get(endpoint, { params })
      if (r.success) {
        setList(Array.isArray(r.data) ? r.data : (r.data?.rows || r.data?.list || []))
      } else {
        setList([])
      }
    } catch {
      setList([])
    } finally {
      setLoading(false)
    }
  }

  // 首次进入同时查两个计数
  const fetchCounts = async () => {
    try {
      const [e, o] = await Promise.all([
        api.get('/basic/device-calibration-plans/expiring/list', { params: { days: 30 } }).catch(() => null),
        api.get('/basic/device-calibration-plans/overdue/list').catch(() => null),
      ])
      setExpiringCount(Array.isArray(e?.data) ? e.data.length : (e?.data?.rows?.length || e?.data?.total || 0))
      setOverdueCount(Array.isArray(o?.data) ? o.data.length : (o?.data?.rows?.length || o?.data?.total || 0))
    } catch {}
  }

  useEffect(() => { fetchList() }, [tab, daysFilter])
  useEffect(() => { fetchCounts() }, [])

  const onRefresh = async () => { await fetchList(); await fetchCounts(); Toast.show({ content: '已刷新', icon: 'success', position: 'bottom', duration: 600 }) }

  return (
    <div className="mobile-page" style={{ paddingTop: 12 }}>
      <Tabs activeKey={tab} onChange={(k) => setTab(k as Tab)} style={{ marginBottom: 8 }}>
        <Tabs.Tab title={`⏰ 即将到期(${expiringCount})`} key="expiring" />
        <Tabs.Tab title={`🚨 已逾期(${overdueCount})`} key="overdue" />
      </Tabs>

      {/* 即将到期 → 可调节天数范围 */}
      {tab === 'expiring' && (
        <div style={{ display: 'flex', gap: 6, padding: '4px 0 10px', overflowX: 'auto' }}>
          {[7, 15, 30, 60].map((d) => (
            <span
              key={d}
              onClick={() => setDaysFilter(d)}
              style={{
                padding: '5px 12px', borderRadius: 14, fontSize: 12,
                background: daysFilter === d ? '#FF9800' : '#f4f5f7',
                color: daysFilter === d ? '#fff' : '#666',
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >{d}天内</span>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>加载中...</div>
      ) : list.length === 0 ? (
        <Empty description={tab === 'expiring' ? `${daysFilter}天内无到期校准计划` : '暂无逾期校准计划'} />
      ) : (
        <PullToRefresh onRefresh={onRefresh}>
          <List>
            {list.map((p) => {
              const days = daysBetween(p.next_calibration_date)
              const urgent = tab === 'overdue' || (days !== null && days <= 3)
              return (
                <List.Item
                  key={p.plan_id}
                  description={
                    <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                      上次：{p.last_calibration_date || '—'} · 周期：{p.calibration_cycle || '—'}月
                      {p.calibration_org && ` · ${p.calibration_org}`}
                    </div>
                  }
                >
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={urgent ? { color: '#F44336' } : undefined}>
                        {p.asset_code} · {p.asset_name}
                      </span>
                      {statusTag(p.status)}
                    </div>
                    <div style={{ fontSize: 12, color: urgent ? '#F44336' : '#666', marginTop: 3, fontWeight: 500 }}>
                      到期：{p.next_calibration_date || '—'}
                      {days !== null && tab === 'expiring' && (
                        <span style={{ marginLeft: 6 }}>（还有 {days} 天）</span>
                      )}
                      {days !== null && tab === 'overdue' && (
                        <span style={{ marginLeft: 6, color: '#F44336' }}>（逾期 {Math.abs(days)} 天）</span>
                      )}
                    </div>
                  </div>
                </List.Item>
              )
            })}
          </List>
        </PullToRefresh>
      )}
    </div>
  )
}
