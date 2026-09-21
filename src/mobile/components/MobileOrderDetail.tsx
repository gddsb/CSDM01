/**
 * MobileOrderDetail — 工单详情抽屉（P-A）
 *
 * 展示内容：
 *  1. 头部：工单号 + 状态徽章
 *  2. 产品信息：料号 / 名称 / 规格 / 条码 / 膜版
 *  3. 数量进度：计划 / 已完工 / 合格，带进度条
 *  4. 排产时间：计划开始 / 计划结束
 *  5. 已开工报工单列表（report_orders 嵌入）
 *
 * 用法：
 *   const [orderId, setOrderId] = useState<number | null>(null)
 *   <MobileOrderDetail orderId={orderId} onClose={() => setOrderId(null)} />
 *   // 或传整个 order 对象（省去一次网络请求）
 *   <MobileOrderDetail order={partialOrder} onClose={...} />
 */
import { useEffect, useState } from 'react'
import { Popup, Loading, Empty } from 'antd-mobile'
import api from '../../utils/api'

export interface MobileOrderData {
  order_id: number
  order_no: string
  material_code?: string
  material_name?: string
  specification?: string
  barcode?: string
  film_version?: string
  version_no?: string
  planned_qty?: number | string
  finished_qty?: number | string
  u9_qualified?: number | string
  status?: string
  u9_status?: string
  plan_start_time?: string
  plan_end_time?: string
  created_by?: string
  release_time?: string | null
  close_time?: string | null
  report_orders?: ReportOrderBrief[]
}

export interface ReportOrderBrief {
  report_order_id: number
  report_no?: string
  order_no?: string
  line_name?: string
  report_qty?: number | string
  status?: string
  report_user_name?: string
  report_time?: string
}

interface Props {
  /** 传入 order 对象（推荐，省去详情请求） */
  order?: Partial<MobileOrderData> | null
  /** 或只传 order_id（会自动拉详情） */
  orderId?: number | null
  visible: boolean
  onClose: () => void
}

const STATUS_COLOR: Record<string, string> = {
  '开立': '#90A4AE',
  '已下发': '#1976D2',
  '开工': 'var(--brand-color-warning)',
  '完工': 'var(--brand-color-success)',
  '关闭': '#9E9E9E',
}

function fmtNum(v: number | string | undefined): string {
  if (v === undefined || v === null || v === '') return '—'
  const n = Number(v)
  return isNaN(n) ? String(v) : n.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  } catch { return iso }
}

export function MobileOrderDetail({ order, orderId, visible, onClose }: Props) {
  const [detail, setDetail] = useState<MobileOrderData | null>(order as MobileOrderData || null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!visible) return
    // 优先用传入的 order 对象
    if (order && order.order_id) {
      setDetail(order as MobileOrderData)
      // 但如果缺 report_orders，再拉一次完整详情
      if (!order.report_orders && (orderId || order.order_id)) {
        fetchDetail(orderId || order.order_id!)
      }
      return
    }
    if (orderId) {
      setDetail(null)
      fetchDetail(orderId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, orderId, order?.order_id])

  const fetchDetail = async (id: number) => {
    setLoading(true)
    try {
      const r: any = await api.get(`/production/orders/${id}`)
      if (r.success && r.data) setDetail(r.data)
    } catch {} finally { setLoading(false) }
  }

  const planned = Number(detail?.planned_qty) || 0
  const finished = Number(detail?.finished_qty) || 0
  const progress = planned > 0 ? Math.min(100, Math.round((finished / planned) * 100)) : 0
  const qualified = Number(detail?.u9_qualified) || 0
  const qualifiedRate = finished > 0 ? ((qualified / finished) * 100).toFixed(1) : '—'

  const status = detail?.status || detail?.u9_status || '—'
  const statusColor = STATUS_COLOR[status] || '#888'

  return (
    <Popup
      visible={visible}
      onMaskClick={onClose}
      position="bottom"
      bodyStyle={{
        maxHeight: '85vh',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        overflow: 'hidden',
        background: 'var(--m-surface, #fff)',
      }}
    >
      {/* 拖拽手柄 */}
      <div style={{
        width: 36, height: 4, background: '#ddd', borderRadius: 2,
        margin: '8px auto 0',
      }} />

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center' }}><Loading /></div>
      ) : !detail ? (
        <Empty description="未找到工单" />
      ) : (
        <div style={{ padding: '12px 16px 24px', overflowY: 'auto', maxHeight: 'calc(85vh - 20px)' }}>
          {/* 头 */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--m-text)' }}>
                {detail.order_no}
              </div>
              <div style={{ fontSize: 12, color: 'var(--m-text-3)', marginTop: 2 }}>
                创建人：{detail.created_by || '—'}
              </div>
            </div>
            <span style={{
              fontSize: 12, padding: '2px 10px', borderRadius: 10,
              background: statusColor + '22', color: statusColor, fontWeight: 500,
            }}>
              {status}
            </span>
          </div>

          {/* 产品卡 */}
          <SectionTitle>产品信息</SectionTitle>
          <InfoCard>
            <InfoRow label="料号" value={detail.material_code || '—'} />
            <InfoRow label="品名" value={detail.material_name || '—'} />
            <InfoRow label="规格" value={detail.specification || '—'} />
            <InfoRow label="条码" value={detail.barcode || '—'} />
            <InfoRow label="膜版" value={`${detail.film_version || '—'} / ${detail.version_no || '—'}`} last />
          </InfoCard>

          {/* 数量进度 */}
          <SectionTitle>数量进度</SectionTitle>
          <InfoCard>
            <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--m-text-3)' }}>计划</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--m-text)' }}>{fmtNum(planned)}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--m-text-3)' }}>已完工</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: progress >= 100 ? 'var(--brand-color-success)' : 'var(--m-text)' }}>{fmtNum(finished)}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--m-text-3)' }}>合格 / 良品率</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--brand-color-success)', marginTop: 2 }}>
                  {fmtNum(qualified)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--m-text-3)' }}>{qualifiedRate}%</div>
              </div>
            </div>
            {/* 进度条 */}
            <div style={{
              height: 6, background: 'var(--m-surface-2, #f0f1f4)',
              borderRadius: 3, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', width: `${progress}%`,
                background: progress >= 100 ? 'var(--brand-color-success)' : '#1976D2',
                transition: 'width .3s',
              }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--m-text-3)', marginTop: 4, textAlign: 'right' }}>
              {progress}%
            </div>
          </InfoCard>

          {/* 排产 */}
          <SectionTitle>排产时间</SectionTitle>
          <InfoCard>
            <InfoRow label="计划开始" value={fmtDate(detail.plan_start_time)} />
            <InfoRow label="计划结束" value={fmtDate(detail.plan_end_time)} last />
          </InfoCard>

          {/* 报工单 */}
          {detail.report_orders && detail.report_orders.length > 0 && (
            <>
              <SectionTitle>
                已开工报工单
                <span style={{ fontSize: 11, color: 'var(--m-text-3)', marginLeft: 6 }}>
                  ({detail.report_orders.length})
                </span>
              </SectionTitle>
              <InfoCard>
                {detail.report_orders.map((ro, i) => (
                  <div key={ro.report_order_id} style={{
                    padding: '10px 0',
                    borderBottom: i < detail.report_orders!.length - 1 ? '1px solid var(--m-border)' : 'none',
                  }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{ro.report_no || ro.order_no}</span>
                      <span style={{ fontSize: 11, color: 'var(--m-text-3)' }}>
                        {fmtDate(ro.report_time)}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--m-text-2)', marginTop: 4 }}>
                      {ro.line_name || '—'} · {fmtNum(ro.report_qty)}件 · {ro.status || '—'}
                      {ro.report_user_name ? ` · ${ro.report_user_name}` : ''}
                    </div>
                  </div>
                ))}
              </InfoCard>
            </>
          )}

          {/* 关闭按钮 */}
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 40px', borderRadius: 22,
                border: '1px solid var(--m-border)',
                background: 'transparent', color: 'var(--m-text-2)', fontSize: 14,
                cursor: 'pointer',
              }}
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </Popup>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 13, fontWeight: 600, color: 'var(--m-text-2)',
      marginTop: 16, marginBottom: 8, paddingLeft: 4,
    }}>
      {children}
    </div>
  )
}

function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--m-surface-2, #f7f8fa)',
      borderRadius: 10, padding: '6px 14px',
      border: '1px solid var(--m-border)',
    }}>
      {children}
    </div>
  )
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '9px 0', fontSize: 13,
      borderBottom: last ? 'none' : '1px dashed var(--m-border)',
    }}>
      <span style={{ color: 'var(--m-text-3)' }}>{label}</span>
      <span style={{ color: 'var(--m-text)', fontWeight: 500, textAlign: 'right', maxWidth: '65%', wordBreak: 'break-all' }}>{value}</span>
    </div>
  )
}
