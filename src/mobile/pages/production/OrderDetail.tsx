import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Toast, Dialog, Button } from 'antd-mobile'
import api from '../../../utils/api'
import dayjs from 'dayjs'

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

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [lines, setLines] = useState([])
  const [selectedLineId, setSelectedLineId] = useState('')
  const [showLineSelect, setShowLineSelect] = useState(false)

  const fetchDetail = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/production/orders/${id}`)
      setOrder(res.data || null)
    } catch (err) {
      Toast.show({ icon: 'fail', content: err.message || '获取订单详情失败' })
    } finally {
      setLoading(false)
    }
  }

  const fetchLines = async () => {
    try {
      const res = await api.get('/basic/production-lines', { params: { page: 1, pageSize: 1000 } })
      setLines(res.data || [])
    } catch (err) {
      setLines([])
    }
  }

  useEffect(() => {
    fetchDetail()
    fetchLines()
  }, [id])

  // 下发（开立 → 下发）
  const handleRelease = async () => {
    if (!order) return
    const confirmed = await Dialog.confirm({
      title: '确认下发',
      content: `确认下发订单 ${order.order_no}？下发后可进行开工`,
    })
    if (!confirmed) return
    setStarting(true)
    try {
      await api.post(`/production/orders/${order.order_id}/release`)
      Toast.show({ icon: 'success', content: '订单已下发' })
      fetchDetail()
    } catch (err) {
      Toast.show({ icon: 'fail', content: err.message || '下发失败' })
    } finally {
      setStarting(false)
    }
  }

  // 开工（下发 → 开工）：选择产线并创建报工单
  const handleStart = async () => {
    if (!order) return
    if (!selectedLineId) {
      Toast.show({ icon: 'fail', content: '请选择生产产线' })
      return
    }
    const line = lines.find(l => String(l.line_id) === String(selectedLineId))
    const confirmed = await Dialog.confirm({
      title: '确认开工',
      content: `确认使用产线【${line?.line_name || ''}】开工订单 ${order.order_no}？将创建对应报工单`,
    })
    if (!confirmed) return
    setStarting(true)
    try {
      await api.post('/production/report-orders', {
        order_id: order.order_id,
        line_id: Number(selectedLineId),
        report_qty: order.planned_qty || 0,
      })
      Toast.show({ icon: 'success', content: '订单已开工' })
      setShowLineSelect(false)
      setSelectedLineId('')
      fetchDetail()
    } catch (err) {
      Toast.show({ icon: 'fail', content: err.message || '开工失败' })
    } finally {
      setStarting(false)
    }
  }

  // 完工（开工 → 完工）：调用报工单 finish 接口，联动订单完工
  const handleFinish = async () => {
    if (!order) return
    const reportOrder = order.report_orders?.[0]
    if (!reportOrder) {
      Toast.show({ icon: 'fail', content: '未找到关联报工单' })
      return
    }
    const confirmed = await Dialog.confirm({
      title: '确认完工',
      content: `确认完工订单 ${order.order_no}？完工后报工数据将变为只读`,
    })
    if (!confirmed) return
    setFinishing(true)
    try {
      await api.post(`/production/report-orders/${reportOrder.report_order_id}/finish`)
      Toast.show({ icon: 'success', content: '订单已完工' })
      fetchDetail()
    } catch (err) {
      Toast.show({ icon: 'fail', content: err.message || '完工失败' })
    } finally {
      setFinishing(false)
    }
  }

  const handleViewReport = () => {
    if (order?.report_orders?.length > 0) {
      navigate(`/mobile/reporting/${order.report_orders[0].report_order_id}`)
    } else {
      navigate('/mobile/reporting')
    }
  }

  if (loading) {
    return <div className="mobile-empty">加载中...</div>
  }

  if (!order) {
    return <div className="mobile-empty">订单不存在</div>
  }

  const status = order.status
  const statusStyle = getStatusStyle(status)
  const canRelease = status === '开立'
  const canStart = status === '下发'
  const canFinish = status === '开工' && order.report_orders?.length > 0
  const hasReport = order.report_orders?.length > 0

  return (
    <div>
      <div className="mobile-sub-header">
        <div className="mobile-sub-back" onClick={() => navigate(-1)}>‹</div>
        <div className="mobile-sub-title">订单详情</div>
      </div>

      <div className="mobile-page">
        <div className="mobile-detail-grid">
          <div className="mobile-flex-between" style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#212121' }}>{order.order_no}</div>
            <span className={`mobile-status-tag ${statusStyle.cls}`} style={{ background: statusStyle.bg, color: statusStyle.color }}>
              {status}
            </span>
          </div>

          <div className="mobile-detail-row">
            <div className="mobile-detail-label">料号</div>
            <div className="mobile-detail-value">{order.material_code || '-'}</div>
          </div>
          <div className="mobile-detail-row">
            <div className="mobile-detail-label">料品名称</div>
            <div className="mobile-detail-value">{order.material_name || '-'}</div>
          </div>
          <div className="mobile-detail-row">
            <div className="mobile-detail-label">规格</div>
            <div className="mobile-detail-value">{order.specification || '-'}</div>
          </div>
          <div className="mobile-detail-row">
            <div className="mobile-detail-label">单位</div>
            <div className="mobile-detail-value">{order.unit || '-'}</div>
          </div>
          <div className="mobile-detail-row">
            <div className="mobile-detail-label">计划数量</div>
            <div className="mobile-detail-value" style={{ fontWeight: 600, color: '#2196F3' }}>
              {order.planned_qty || 0}
            </div>
          </div>
          <div className="mobile-detail-row">
            <div className="mobile-detail-label">已报工数</div>
            <div className="mobile-detail-value">{order.reported_qty || 0}</div>
          </div>
        </div>

        <div className="mobile-section-title">计划信息</div>
        <div className="mobile-detail-grid">
          <div className="mobile-detail-row">
            <div className="mobile-detail-label">计划开始</div>
            <div className="mobile-detail-value">
              {order.plan_start_time ? dayjs(order.plan_start_time).format('YYYY-MM-DD HH:mm') : '-'}
            </div>
          </div>
          <div className="mobile-detail-row">
            <div className="mobile-detail-label">计划结束</div>
            <div className="mobile-detail-value">
              {order.plan_end_time ? dayjs(order.plan_end_time).format('YYYY-MM-DD HH:mm') : '-'}
            </div>
          </div>
          <div className="mobile-detail-row">
            <div className="mobile-detail-label">生产产线</div>
            <div className="mobile-detail-value">{order.line_name || '-'}</div>
          </div>
          <div className="mobile-detail-row">
            <div className="mobile-detail-label">客户</div>
            <div className="mobile-detail-value">{order.customer_name || '-'}</div>
          </div>
        </div>

        {hasReport && (
          <>
            <div className="mobile-section-title">关联报工单</div>
            <div className="mobile-list-item" onClick={handleViewReport}>
              <div className="mobile-flex-between">
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#212121' }}>
                    {order.report_orders[0].report_no}
                  </div>
                  <div style={{ fontSize: 12, color: '#757575', marginTop: 4 }}>
                    报工时间：{order.report_orders[0].report_time ? dayjs(order.report_orders[0].report_time).format('MM-DD HH:mm') : '-'}
                  </div>
                </div>
                <div style={{ color: '#BDBDBD', fontSize: 18 }}>›</div>
              </div>
            </div>
          </>
        )}

        {/* 产线选择（仅在"下发"状态时显示） */}
        {canStart && showLineSelect && (
          <>
            <div className="mobile-section-title">选择生产产线</div>
            <div className="mobile-detail-grid">
              <div className="mobile-form-item">
                <label className="mobile-form-label required">生产产线</label>
                <select
                  className="mobile-form-input"
                  value={selectedLineId}
                  onChange={(e) => setSelectedLineId(e.target.value)}
                >
                  <option value="">请选择产线</option>
                  {lines.map(l => (
                    <option key={l.line_id} value={l.line_id}>{l.line_name}</option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}

        {/* 操作按钮 */}
        <div style={{ marginTop: 24 }}>
          {canRelease && (
            <Button
              block
              color="primary"
              size="large"
              loading={starting}
              onClick={handleRelease}
              style={{ borderRadius: 8, height: 44 }}
            >
              下发
            </Button>
          )}

          {canStart && !showLineSelect && (
            <Button
              block
              color="primary"
              size="large"
              onClick={() => setShowLineSelect(true)}
              style={{ borderRadius: 8, height: 44 }}
            >
              开工
            </Button>
          )}

          {canStart && showLineSelect && (
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                block
                color="default"
                size="large"
                onClick={() => { setShowLineSelect(false); setSelectedLineId('') }}
                style={{ borderRadius: 8, height: 44, flex: 1 }}
              >
                取消
              </Button>
              <Button
                block
                color="primary"
                size="large"
                loading={starting}
                onClick={handleStart}
                style={{ borderRadius: 8, height: 44, flex: 2 }}
              >
                确认开工
              </Button>
            </div>
          )}

          {canFinish && (
            <Button
              block
              color="primary"
              size="large"
              loading={finishing}
              onClick={handleFinish}
              style={{ borderRadius: 8, height: 44 }}
            >
              完工
            </Button>
          )}

          {hasReport && !canFinish && !canRelease && !canStart && (
            <Button
              block
              color="primary"
              size="large"
              onClick={handleViewReport}
              style={{ borderRadius: 8, height: 44 }}
            >
              查看报工单
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
