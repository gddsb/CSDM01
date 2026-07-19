import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Toast, InfiniteScroll } from 'antd-mobile'
import api from '../../../utils/api'
import dayjs from 'dayjs'

const STATUS_FILTERS = [
  { label: '全部', value: '' },
  { label: '开工', value: '开工' },
  { label: '完工', value: '完工' },
]

export default function ReportList() {
  const navigate = useNavigate()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const pageSize = 20

  const fetchList = useCallback(async (pageNum = 1, reset = false) => {
    setLoading(true)
    try {
      const params: any = { page: pageNum, pageSize }
      if (keyword.trim()) params.keyword = keyword.trim()
      if (statusFilter) {
        params.status = statusFilter === '开工' ? 0 : 1
      } else {
        params.status = 0 // 默认只显示开工状态的报工单
      }

      const res = await api.get('/production/report-orders', { params })
      const newList = res.data || []
      if (reset || pageNum === 1) {
        setList(newList)
      } else {
        setList(prev => [...prev, ...newList])
      }
      setHasMore(newList.length >= pageSize)
      setPage(pageNum)
    } catch (err) {
      Toast.show({ icon: 'fail', content: err.message || '获取报工单失败' })
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

  const renderStatusTag = (status) => {
    // 后端 status 为 0=开工 / 1=完工
    const isStart = status === 0 || status === '0' || status === '开工'
    const bg = isStart ? '#f6ffed' : '#f0f0f0'
    const color = isStart ? '#52c41a' : '#595959'
    const text = isStart ? '开工' : '完工'
    const cls = isStart ? 'started' : 'done'
    return (
      <span className={`mobile-status-tag ${cls}`} style={{ background: bg, color }}>
        {text}
      </span>
    )
  }

  return (
    <div>
      {/* 顶部搜索栏 */}
      <div className="mobile-search-bar">
        <input
          className="mobile-search-input"
          placeholder="搜索报工单号 / 订单号"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
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

      {/* 报工单列表 */}
      <div className="mobile-page" style={{ paddingTop: 8 }}>
        {list.length === 0 && !loading && (
          <div className="mobile-empty">暂无报工单数据</div>
        )}

        {list.map(ro => (
          <div
            key={ro.report_order_id}
            className="mobile-list-item"
            onClick={() => navigate(`/mobile/reporting/${ro.report_order_id}`)}
          >
            <div className="mobile-list-item-header">
              <div className="mobile-list-item-title">{ro.report_no}</div>
              {renderStatusTag(ro.status)}
            </div>
            <div className="mobile-list-item-body">
              <div className="mobile-flex-between" style={{ marginBottom: 4 }}>
                <span style={{ color: '#757575' }}>订单号</span>
                <span>{ro.order_no || '-'}</span>
              </div>
              <div className="mobile-flex-between" style={{ marginBottom: 4 }}>
                <span style={{ color: '#757575' }}>料品</span>
                <span style={{ maxWidth: '60%', textAlign: 'right' }}>
                  {ro.material_name || '-'}
                </span>
              </div>
              <div className="mobile-flex-between" style={{ marginBottom: 4 }}>
                <span style={{ color: '#757575' }}>报工数</span>
                <span style={{ fontWeight: 500, color: '#2196F3' }}>{ro.report_qty || 0}</span>
              </div>
              <div className="mobile-flex-between">
                <span style={{ color: '#757575' }}>报工时间</span>
                <span>{ro.report_time ? dayjs(ro.report_time).format('MM-DD HH:mm') : '-'}</span>
              </div>
            </div>
          </div>
        ))}

        <InfiniteScroll loadMore={loadMore} hasMore={hasMore} />
      </div>
    </div>
  )
}
