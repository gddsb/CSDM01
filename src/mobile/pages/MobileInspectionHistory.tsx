/**
 * 检验历史查询（Phase 2 · Q-C）
 *
 * 三合一页面：来料 / 过程 / 成品 三类检验记录 Tab 切换
 *
 * 后端接口（均支持 keyword + start_date / end_date）：
 *   GET /api/basic/incoming-inspections?keyword=xxx&start_date=&end_date=
 *   GET /api/basic/process-inspections?keyword=xxx&start_date=&end_date=
 *   GET /api/basic/product-inspections?keyword=xxx&start_date=&end_date=
 */
import { useCallback, useEffect, useState } from 'react'
import { Tabs, SearchBar, List, Toast, PullToRefresh, InfiniteScroll } from 'antd-mobile'
import api from '../../utils/api'

type InspectType = 'incoming' | 'process' | 'product'

interface HistoryRow {
  id: number
  no: string
  materialCode?: string
  materialName?: string
  result?: string
  status?: string
  lineName?: string
  processName?: string
  supplierName?: string
  createdAt?: string
}

interface FetchResult {
  list: HistoryRow[]
  total: number
}

const TYPE_META: Record<InspectType, { label: string; endpoint: string; buildRow: (r: any) => HistoryRow }> = {
  incoming: {
    label: '来料检验',
    endpoint: '/basic/incoming-inspections',
    buildRow: (r) => ({
      id: r.inspection_id,
      no: r.inspection_no,
      materialCode: r.material_code,
      materialName: r.material_name,
      supplierName: r.supplier_name,
      result: r.result,
      status: r.status,
      createdAt: r.created_at,
    }),
  },
  process: {
    label: '过程检验',
    endpoint: '/basic/process-inspections',
    buildRow: (r) => ({
      id: r.inspection_id ?? r.record_id,
      no: r.inspection_no ?? (r.report_order_no ? `报工单 ${r.report_order_no}` : ''),
      materialCode: r.material_code,
      materialName: r.product_name || r.material_name,
      processName: r.process_name,
      lineName: r.line_name,
      result: r.result,
      status: r.status,
      createdAt: r.created_at || r.report_time,
    }),
  },
  product: {
    label: '成品检验',
    endpoint: '/basic/product-inspections',
    buildRow: (r) => ({
      id: r.inspection_id,
      no: r.inspection_no,
      materialCode: r.material_code,
      materialName: r.material_name,
      result: r.result,
      status: r.status,
      createdAt: r.created_at,
    }),
  },
}

function resultTag(r?: string) {
  if (!r) return null
  const isOk = r.includes('合格') && !r.includes('不')
  return (
    <span style={{
      fontSize: 11, padding: '1px 8px', borderRadius: 8,
      background: isOk ? '#E8F5E9' : '#FFEBEE',
      color: isOk ? '#4CAF50' : '#F44336',
      marginLeft: 6,
    }}>{r}</span>
  )
}

function fmtTime(iso?: string) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso.slice(0, 16).replace('T', ' ')
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch { return iso }
}

export default function MobileInspectionHistory() {
  const [type, setType] = useState<InspectType>('incoming')
  const [list, setList] = useState<HistoryRow[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [dateRange, setDateRange] = useState<'7d' | '30d' | 'all'>('7d')

  const fetchPage = useCallback(async (typeKey: InspectType, pg: number, append: boolean, kw?: string, range?: string): Promise<FetchResult> => {
    setLoading(true)
    try {
      const meta = TYPE_META[typeKey]
      const params: Record<string, unknown> = { page: pg, page_size: 20 }
      if (kw) params.keyword = kw
      const today = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      if (range && range !== 'all') {
        const days = range === '7d' ? 7 : 30
        const start = new Date(); start.setDate(start.getDate() - days)
        params.start_date = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`
        params.end_date = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
      }
      const r: any = await api.get(meta.endpoint, { params })
      if (!r.success) return { list: [], total: 0 }
      const rawList: any[] = r.data?.list || r.data?.rows || r.data || []
      const mapped = rawList.map(meta.buildRow)
      const total = r.data?.total || 0
      if (append) setList((prev) => [...prev, ...mapped])
      else setList(mapped)
      setHasMore(pg * 20 < total && mapped.length > 0)
      setPage(pg)
      return { list: mapped, total }
    } catch {
      if (!append) { setList([]); setHasMore(false) }
      return { list: [], total: 0 }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchPage(type, 1, false, keyword.trim(), dateRange)
  }, [type, dateRange, fetchPage])

  const onSearch = async () => { await fetchPage(type, 1, false, keyword.trim(), dateRange) }
  const onRefresh = async () => { await fetchPage(type, 1, false, keyword.trim() || undefined, dateRange) }
  const onLoadMore = async () => {
    if (!hasMore || loading) return
    await fetchPage(type, page + 1, true, keyword.trim() || undefined, dateRange)
  }

  const meta = TYPE_META[type]

  return (
    <div className="mobile-page-fixed-header">
      <div className="mobile-sticky-header">
        {/* Tab 切换 */}
        <Tabs activeKey={type} onChange={(k) => setType(k as InspectType)}>
          <Tabs.Tab title={`📥 来料(${TYPE_META.incoming.label})`} key="incoming" />
          <Tabs.Tab title={`🔧 过程(${TYPE_META.process.label})`} key="process" />
          <Tabs.Tab title={`📦 成品(${TYPE_META.product.label})`} key="product" />
        </Tabs>

        {/* 搜索 + 日期范围 */}
        <SearchBar
          placeholder={`搜${meta.label}单号 / 料号`}
          value={keyword}
          onChange={setKeyword}
          onSearch={onSearch}
          style={{ marginBottom: 8 }}
        />

        {/* 日期快捷过滤 */}
        <div style={{ display: 'flex', gap: 6, padding: '4px 0 10px', overflowX: 'auto' }}>
          {[
            { k: '7d', t: '近7天' },
            { k: '30d', t: '近30天' },
            { k: 'all', t: '全部' },
          ].map((o) => (
            <span
              key={o.k}
              onClick={() => setDateRange(o.k as any)}
              style={{
                padding: '5px 12px', borderRadius: 14, fontSize: 12,
                background: dateRange === o.k ? '#2196F3' : '#f4f5f7',
                color: dateRange === o.k ? '#fff' : '#666',
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >{o.t}</span>
          ))}
        </div>
      </div>

      <div className="mobile-page-scroll-list">
        {/* 列表 */}
        {loading && page === 1 ? (
          <EmptyHint text="加载中..." />
        ) : list.length === 0 ? (
          <EmptyHint text={`暂无${meta.label}记录`} sub="试试扩大日期范围或换关键词" />
        ) : (
          <PullToRefresh onRefresh={onRefresh}>
            <List>
              {list.map((r) => (
                <List.Item key={`${type}-${r.id}-${r.no}`}
                  description={
                    <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                      {r.materialCode} {r.materialName?.slice(0, 20) || ''}
                      {r.processName && ` · ${r.processName}`}
                      {r.lineName && ` · ${r.lineName}`}
                      {r.supplierName && ` · ${r.supplierName}`}
                    </div>
                  }
                >
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>
                      {r.no || '(无单号)'}
                      {resultTag(r.result)}
                    </div>
                    <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>
                      {fmtTime(r.createdAt)} · {r.status || ''}
                    </div>
                  </div>
                </List.Item>
              ))}
              <InfiniteScroll loadMore={onLoadMore} hasMore={hasMore} />
            </List>
          </PullToRefresh>
        )}
      </div>
    </div>
  )
}

function EmptyHint({ text, sub }: { text: string; sub?: string }) {
  return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>{text}{sub && <div style={{ fontSize: 12, marginTop: 6 }}>{sub}</div>}</div>
}
