import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { PullToRefresh, InfiniteScroll, Toast, Dialog, PullToRefreshRef } from 'antd-mobile'
import { AddOutline, SearchOutline } from 'antd-mobile-icons'
import api from '../../../utils/api'
import dayjs from 'dayjs'

const STATUS_FILTERS = [
  { label: '全部', value: '' },
  { label: '开立', value: '开立' },
  { label: '开工', value: '开工' },
  { label: '完工', value: '完工' },
]

// 订单状态徽章样式
const getStatusStyle = (status) => {
  switch (status) {
    case '开立': return { bg: '#e6f7ff', color: '#1890ff', cls: 'open' }
    case '下发': return { bg: '#fff7e6', color: '#fa8c16', cls: 'released' }
    case '开工': return { bg: '#f6ffed', color: '#52c41a', cls: 'started' }
    case '完工': return { bg: '#f0f0f0', color: '#595959', cls: 'done' }
    case '关闭': return { bg: '#fff1f0', color: '#cf1322', cls: 'closed' }
    default: return { bg: '#f0f0f0', color: '#595959', cls: 'done' }
  }
}

export default function OrderList() {
  const navigate = useNavigate()
  const location = useLocation()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  const pageSize = 20

  const fetchList = useCallback(async (pageNum = 1, reset = false) => {
    setLoading(true)
    try {
      const params: any = { page: pageNum, pageSize }
      if (keyword.trim()) params.keyword = keyword.trim()
      if (statusFilter) params.status = [statusFilter]
      else params.status = ['开立', '开工'] // 默认显示开立+开工

      const res = await api.get('/production/orders', { params })
      const newList = res.data || []
      setTotal(res.total || 0)
      if (reset || pageNum === 1) {
        setList(newList)
      } else {
        setList(prev => [...prev, ...newList])
      }
      setHasMore(newList.length >= pageSize)
      setPage(pageNum)
    } catch (err) {
      Toast.show({ icon: 'fail', content: err.message || '获取订单失败' })
    } finally {
      setLoading(false)
    }
  }, [keyword, statusFilter])

  useEffect(() => {
    fetchList(1, true)
  }, [fetchList])

  const loadMore = async () => {
    if (loading || !hasMore) return
    await fetchList(page + 1)
  }

  const handleStatusChange = (s) => {
    setStatusFilter(s)
    setHasMore(true)
    setTimeout(() => fetchList(1, true), 0)
  }

  const handleSearch = () => {
    setHasMore(true)
    fetchList(1, true)
  }

  const handleRelease = async (order) => {
    const confirmed = await Dialog.confirm({
      title: '确认下发',
      content: `确认下发订单 ${order.order_no}？下发后将不可修改`,
    })
    if (!confirmed) return
    try {
      const res = await api.post(`/production/orders/${order.order_id}/release`)
      Toast.show({ icon: 'success', content: res.message || '订单已下发' })
      fetchList(1, true)
    } catch (err) {
      Toast.show({ icon: 'fail', content: err.message || '下发失败' })
    }
  }

  const renderStatusTag = (status) => {
    const s = getStatusStyle(status)
    return (
      <span className={`mobile-status-tag ${s.cls}`} style={{ background: s.bg, color: s.color }}>
        {status}
      </span>
    )
  }

  return (
    <div>
      {/* 顶部搜索栏 */}
      <div className="mobile-search-bar">
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="mobile-search-input"
            placeholder="搜索订单号 / 料号"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
      </div>

      {/* 状态筛选 chip */}
      <div className="mobile-filter-chips">
        {STATUS_FILTERS.map(s => (
          <div
            key={s.value}
            className={`mobile-filter-chip ${statusFilter === s.value ? 'active' : ''}`}
            onClick={() => handleStatusChange(s.value)}
          >
            {s.label}
          </div>
        ))}
      </div>

      {/* 订单列表 */}
      <div className="mobile-page" style={{ paddingTop: 8 }}>
        {list.length === 0 && !loading && (
          <div className="mobile-empty">暂无订单数据</div>
        )}

        {list.map(order => (
          <div
            key={order.order_id}
            className="mobile-list-item"
            onClick={() => navigate(`/mobile/orders/${order.order_id}`)}
          >
            <div className="mobile-list-item-header">
              <div className="mobile-list-item-title">{order.order_no}</div>
              {renderStatusTag(order.status)}
            </div>
            <div className="mobile-list-item-body">
              <div className="mobile-flex-between" style={{ marginBottom: 4 }}>
                <span style={{ color: '#757575' }}>料号</span>
                <span>{order.material_code || '-'}</span>
              </div>
              <div className="mobile-flex-between" style={{ marginBottom: 4 }}>
                <span style={{ color: '#757575' }}>料品</span>
                <span style={{ maxWidth: '60%', textAlign: 'right' }}>
                  {order.material_name || '-'}
                </span>
              </div>
              <div className="mobile-flex-between" style={{ marginBottom: 4 }}>
                <span style={{ color: '#757575' }}>计划数</span>
                <span style={{ fontWeight: 500, color: '#212121' }}>{order.planned_qty || 0}</span>
              </div>
              <div className="mobile-flex-between">
                <span style={{ color: '#757575' }}>计划开始</span>
                <span>{order.plan_start_time ? dayjs(order.plan_start_time).format('MM-DD HH:mm') : '-'}</span>
              </div>

              {order.status === '开立' && (
                <button
                  className="mobile-action-btn mobile-action-primary"
                  style={{ marginTop: 10 }}
                  onClick={(e) => { e.stopPropagation(); handleRelease(order) }}
                >
                  下发开工
                </button>
              )}
            </div>
          </div>
        ))}

        <InfiniteScroll loadMore={loadMore} hasMore={hasMore} />
      </div>
    </div>
  )
}
