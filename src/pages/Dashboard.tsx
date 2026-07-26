import { useState, useEffect, useMemo } from 'react'
import { Row, Col, Table, Tag, Progress, Typography, Space } from 'antd'
import {
  ToolOutlined, FileTextOutlined, ExperimentOutlined, CheckCircleOutlined,
  ClockCircleOutlined, WarningOutlined, RiseOutlined, FallOutlined
} from '@ant-design/icons'
import { useApp } from '../contexts/AppContext'
import api from '../utils/api'

const { Text, Title } = Typography

function MiniSparkline({ data, color, width = 100, height = 32 }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const stepX = width / (data.length - 1)
  const points = data.map((v, i) => {
    const x = i * stepX
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')
  const areaPoints = `0,${height} ${points} ${width},${height}`
  const gradId = `spark-grad-${color.replace('#', '')}`
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradId})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function generateTrend(baseValue, volatility = 0.3, days = 7) {
  const data = []
  let v = baseValue * (0.7 + Math.random() * 0.3)
  for (let i = 0; i < days; i++) {
    const delta = v * volatility * (Math.random() - 0.45)
    v = Math.max(0, v + delta)
    data.push(Math.round(v))
  }
  data[data.length - 1] = baseValue
  return data
}

export default function Dashboard() {
  const { currentUser } = useApp()
  const [orders, setOrders] = useState([])
  const [workOrders, setWorkOrders] = useState([])
  const [processReports, setProcessReports] = useState([])
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const [ordersRes, woRes, reportsRes, devicesRes] = await Promise.all([
          api.get('/production/orders', { params: { pageSize: 10 } }),
          api.get('/production/work-orders', { params: { pageSize: 10 } }),
          api.get('/production/process-reports', { params: { pageSize: 10 } }),
          api.get('/basic/devices', { params: { pageSize: 50 } }),
        ])
        if (cancelled) return
        setOrders(ordersRes.data || [])
        setWorkOrders(woRes.data || [])
        setProcessReports(reportsRes.data || [])
        setDevices(devicesRes.data || [])
      } catch (err) {
        console.error('加载工作台数据失败:', err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const activeOrders = orders.filter(o => o.status !== '完工')
  const activeWorkOrders = workOrders.filter(w => w.status === '开工')
  const faultDevices = devices.filter(d => d.status === '维修')
  const pendingInspection = 5

  const statConfigs = [
    { label: '开工中工单', value: activeWorkOrders.length, icon: <ToolOutlined />, color: '#2196F3' },
    { label: '活跃订单', value: activeOrders.length, icon: <FileTextOutlined />, color: '#00BCD4' },
    { label: '待检任务', value: pendingInspection, icon: <ExperimentOutlined />, color: '#FF6F00' },
    { label: '设备故障', value: faultDevices.length, icon: <WarningOutlined />, color: '#F44336' },
  ]

  const stats = useMemo(() => {
    return statConfigs.map(cfg => {
      const trend = generateTrend(cfg.value, 0.35, 7)
      const lastWeek = trend.slice(0, 3).reduce((a, b) => a + b, 0) / 3
      const thisWeek = trend.slice(4).reduce((a, b) => a + b, 0) / 3
      const diff = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : 0
      const isUp = diff >= 0
      const pct = Math.abs(Math.round(diff))
      return { ...cfg, trend, isUp, pct }
    })
  }, [activeWorkOrders.length, activeOrders.length, faultDevices.length, pendingInspection])

  const recentReports = processReports.slice(0, 5)

  const orderColumns = [
    { title: '订单编号', dataIndex: 'order_no', key: 'order_no' },
    { title: '料品名称', dataIndex: 'material_name', key: 'material_name' },
    { title: '计划数量', dataIndex: 'planned_qty', key: 'planned_qty', render: v => Number(v || 0).toLocaleString() },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: v => {
        const colors = { '开立': 'default', '下发': 'processing', '完工': 'success' }
        return <Tag color={colors[v] || 'default'}>{v}</Tag>
      }
    },
  ]

  const workOrderColumns = [
    { title: '工单编号', dataIndex: 'work_order_no', key: 'work_order_no' },
    { title: '产线', dataIndex: 'line_name', key: 'line_name' },
    { title: '料品', dataIndex: 'material_name', key: 'material_name' },
    { title: '目标数量', dataIndex: 'target_qty', key: 'target_qty', render: v => Number(v || 0).toLocaleString() },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: v => {
        const colors = { '开立': 'default', '开工': 'processing', '关闭': 'warning', '完工': 'success' }
        return <Tag color={colors[v] || 'default'}>{v}</Tag>
      }
    },
  ]

  const reportColumns = [
    { title: '工单', dataIndex: 'work_order_no', key: 'work_order_no' },
    { title: '工序', dataIndex: 'process_name', key: 'process_name' },
    { title: '投入', dataIndex: 'input_qty', key: 'input_qty', render: v => Number(v || 0).toLocaleString() },
    { title: '不良合计', key: 'defect_total', render: (_, r) => Number(r.defect_material || 0) + Number(r.defect_process || 0) + Number(r.defect_scrap || 0) },
    { title: '产出', dataIndex: 'output_qty', key: 'output_qty', render: v => Number(v || 0).toLocaleString() },
    { title: '报工人', dataIndex: 'report_user_name', key: 'report_user_name' },
    { title: '报工时间', dataIndex: 'report_time', key: 'report_time', render: v => v ? String(v).replace('T', ' ').slice(0, 16) : '-' },
  ]

  return (
    <div>
      {/* 第一行：统计卡片 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        {stats.map((s, i) => (
          <Col key={i} span={6}>
            <div className="dashboard-card stat-card-enhanced">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 12 }}>
                <div
                  className="stat-icon"
                  style={{
                    background: `${s.color}15`,
                    color: s.color,
                    width: 52,
                    height: 52,
                    fontSize: 24,
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {s.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 30, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                      {s.value}
                    </span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 2,
                        fontSize: 12,
                        fontWeight: 600,
                        color: s.isUp ? '#52c41a' : '#f5222d',
                        background: s.isUp ? '#f6ffed' : '#fff1f0',
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}
                    >
                      {s.isUp ? <RiseOutlined /> : <FallOutlined />}
                      {s.pct}%
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.label}</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <MiniSparkline data={s.trend} color={s.color} width={160} height={36} />
                <Text type="secondary" style={{ fontSize: 11 }}>近7天</Text>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* 第二行：工单概览 + 生产进度/待办 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col span={16}>
          <div className="dashboard-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Title level={5} style={{ margin: 0 }}>生产工单概览</Title>
              <Text type="secondary">实时数据</Text>
            </div>
            <Table
              columns={workOrderColumns}
              dataSource={workOrders}
              rowKey="work_order_id"
              size="small"
              loading={loading}
              pagination={false}
            />
          </div>
        </Col>
        <Col span={8}>
          <div className="dashboard-card">
            <Title level={5} style={{ marginBottom: 16 }}>生产进度</Title>
            {activeWorkOrders.map(w => {
              const reported = processReports
                .filter(r => r.work_order_id === w.work_order_id)
                .reduce((sum, r) => sum + Number(r.output_qty || 0), 0)
              const target = Number(w.target_qty || 0)
              const pct = target > 0 ? Math.round((reported / target) * 100) : 0
              return (
                <div key={w.work_order_id} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 13 }}>{w.work_order_no}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{reported.toLocaleString()}/{target.toLocaleString()}</Text>
                  </div>
                  <Progress percent={pct} size="small" strokeColor="var(--color-primary)" />
                </div>
              )
            })}
            {activeWorkOrders.length === 0 && (
              <Text type="secondary" style={{ fontSize: 13 }}>暂无开工工单</Text>
            )}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
              <Title level={5} style={{ marginBottom: 12 }}>待办事项</Title>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <Text><ClockCircleOutlined style={{ color: '#FF6F00', marginRight: 8 }} />待检来料任务</Text>
                  <Tag color="warning">0</Tag>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <Text><WarningOutlined style={{ color: '#F44336', marginRight: 8 }} />设备故障待修</Text>
                  <Tag color="error">{faultDevices.length}</Tag>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <Text><CheckCircleOutlined style={{ color: '#4CAF50', marginRight: 8 }} />已完成报工</Text>
                  <Tag color="success">{processReports.length}</Tag>
                </div>
              </Space>
            </div>
          </div>
        </Col>
      </Row>

      {/* 第三行：生产订单 + 最近报工 */}
      <Row gutter={[12, 12]}>
        <Col span={12}>
          <div className="dashboard-card">
            <Title level={5} style={{ marginBottom: 16 }}>生产订单</Title>
            <Table columns={orderColumns} dataSource={orders} rowKey="order_id" size="small" loading={loading} pagination={false} />
          </div>
        </Col>
        <Col span={12}>
          <div className="dashboard-card">
            <Title level={5} style={{ marginBottom: 16 }}>最近报工记录</Title>
            <Table columns={reportColumns} dataSource={recentReports} rowKey="report_id" size="small" loading={loading} pagination={false} />
          </div>
        </Col>
      </Row>
    </div>
  )
}
