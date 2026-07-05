import React, { useState, useMemo, useEffect } from 'react'
import { Table, Tag, Select, Row, Col, message } from 'antd'
import { ProfileOutlined } from '@ant-design/icons'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import api from '../../utils/api'

const woStatusColor = { '开立': 'default', '开工': 'processing', '关闭': 'warning', '完工': 'success' }

export default function ProductionReportByOrder() {
  const [orders, setOrders] = useState([])
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [loading, setLoading] = useState(false)

  // 获取订单列表
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const res = await api.get('/production/orders', { params: { page: 1, pageSize: 1000 } })
        if (cancelled) return
        setOrders(res.data || [])
      } catch (err) {
        if (!cancelled) message.error(err.message || '获取订单列表失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  const orderMap = useMemo(() => {
    const map = {}
    orders.forEach(o => { map[o.order_id] = o })
    return map
  }, [orders])

  const orderOptions = useMemo(() => {
    return [...orders]
      .sort((a, b) => (b.order_no || '').localeCompare(a.order_no || ''))
      .map(o => ({
        value: o.order_id,
        label: (
          <div style={{ display: 'flex', gap: 12, fontSize: 12, alignItems: 'center' }}>
            <span style={{ width: 160, color: 'var(--text-primary)', fontWeight: 500 }}>{o.order_no}</span>
            <span style={{ width: 120, color: 'var(--text-secondary)' }}>{o.material_name || '-'}</span>
            <span style={{ width: 90, textAlign: 'right', color: 'var(--text-primary)' }}>{(o.planned_qty || 0).toLocaleString()}</span>
            <span style={{ width: 70 }}><Tag color={woStatusColor[o.status] || 'default'} style={{ margin: 0 }}>{o.status}</Tag></span>
          </div>
        ),
      }))
  }, [orders])

  const selectedOrder = orders.find(o => o.order_id === selectedOrderId)

  const finishedQty = selectedOrder?.finished_qty || 0
  const plannedQty = selectedOrder?.planned_qty || 0
  const progressRate = plannedQty > 0 ? ((finishedQty / plannedQty) * 100).toFixed(1) : '0.0'

  const stats = [
    { label: '订单总数', value: orders.length, icon: <ProfileOutlined />, color: '#2196F3' },
    { label: '已下达', value: orders.filter(o => o.status === '已下达').length, icon: <ProfileOutlined />, color: '#FF9800' },
    { label: '已关闭', value: orders.filter(o => o.status === '已关闭').length, icon: <ProfileOutlined />, color: '#4CAF50' },
    { label: '完工率', value: `${progressRate}%`, icon: <ProfileOutlined />, color: '#9C27B0' },
  ]

  // 订单概要列
  const orderColumns = [
    { title: '订单编号', dataIndex: 'order_no', key: 'order_no', width: 160 },
    { title: '料号', dataIndex: 'material_code', key: 'material_code', width: 130 },
    { title: '料品名称', dataIndex: 'material_name', key: 'material_name', width: 140 },
    { title: '计划数量', dataIndex: 'planned_qty', key: 'planned_qty', width: 100, align: 'right', render: v => (v || 0).toLocaleString() },
    { title: '完工数量', dataIndex: 'finished_qty', key: 'finished_qty', width: 100, align: 'right', render: v => (v || 0).toLocaleString() },
    {
      title: '完成率', key: 'progress', width: 100, align: 'right',
      render: (_, r) => {
        const rate = r.planned_qty > 0 ? ((r.finished_qty || 0) / r.planned_qty * 100).toFixed(1) : '0.0'
        return <span style={{ color: Number(rate) >= 100 ? 'var(--color-success)' : 'var(--text-primary)' }}>{rate}%</span>
      },
    },
    {
      title: '计划时间', key: 'plan_time', width: 200,
      render: (_, r) => (
        <span style={{ fontSize: 12 }}>
          {r.plan_start_time ? String(r.plan_start_time).substring(0, 10) : '-'} ~ {r.plan_end_time ? String(r.plan_end_time).substring(0, 10) : '-'}
        </span>
      ),
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: v => <Tag color={woStatusColor[v] || 'default'}>{v}</Tag>,
    },
  ]

  return (
    <ThreeSectionPage
      title="生产报工(工单)"
      breadcrumbs="生产管理 / 生产报工(工单)"
      stats={stats}
      table={
        <div>
          <Row gutter={[12, 8]} style={{ marginBottom: 16 }} align="middle">
            <Col flex="600px">
              <Select
                showSearch
                placeholder="输入订单编号或料品名称搜索"
                style={{ width: '100%' }}
                value={selectedOrderId}
                onChange={setSelectedOrderId}
                loading={loading}
                filterOption={(input, option) => {
                  const o = orderMap[option.value]
                  if (!o) return false
                  const search = input.toLowerCase()
                  return (o.order_no || '').toLowerCase().includes(search) ||
                    (o.material_name || '').toLowerCase().includes(search) ||
                    (o.material_code || '').toLowerCase().includes(search)
                }}
                options={orderOptions}
                popupMatchSelectWidth={600}
              />
            </Col>
          </Row>

          {!selectedOrder ? (
            <>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>订单列表</div>
              <Table
                size="small"
                columns={orderColumns}
                dataSource={orders}
                rowKey="order_id"
                loading={loading}
                pagination={{
                  pageSize: 30,
                  showSizeChanger: true,
                  showTotal: t => `共 ${t} 条`,
                }}
                scroll={{ x: 1100 }}
              />
            </>
          ) : (
            <Row gutter={16}>
              <Col span={24}>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
                  订单详情 — {selectedOrder.order_no}
                </div>
                <Table
                  size="small"
                  columns={orderColumns}
                  dataSource={[selectedOrder]}
                  rowKey="order_id"
                  pagination={false}
                  scroll={{ x: 1100 }}
                  style={{ marginBottom: 16 }}
                />
                <div style={{ padding: 16, background: 'var(--bg-card)', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>订单完成进度</div>
                  <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                    <div>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>计划数量：</span>
                      <strong>{plannedQty.toLocaleString()}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>完工数量：</span>
                      <strong style={{ color: 'var(--color-success)' }}>{finishedQty.toLocaleString()}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>完成率：</span>
                      <strong style={{ color: Number(progressRate) >= 100 ? 'var(--color-success)' : 'var(--color-primary)' }}>{progressRate}%</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>下发时间：</span>
                      <span>{selectedOrder.release_time || '-'}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>关闭时间：</span>
                      <span>{selectedOrder.close_time || '-'}</span>
                    </div>
                  </div>
                </div>
              </Col>
            </Row>
          )}
        </div>
      }
    />
  )
}
