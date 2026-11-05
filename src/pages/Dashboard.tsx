import logger from '../utils/logger.js'
import ResizableTable from '../components/ResizableTable'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Row, Col, Tag, Typography, Space, Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import {
  ToolOutlined, CheckCircleOutlined, BugOutlined, ClockCircleOutlined, BulbOutlined,
} from '@ant-design/icons'
import { useApp } from '../contexts/AppContext'
import api from '../utils/api'

const { Title, Text } = Typography

/** 统一解析列表接口的 list */
function extractList(r: any): any[] {
  if (!r) return []
  if (Array.isArray(r.data)) return r.data
  return r.data?.list ?? r.data?.records ?? []
}

interface TodoItem { icon: string; label: string; count: number; color: string; path: string }

export default function Dashboard() {
  const navigate = useNavigate()
  const { currentUser } = useApp()
  const [activeReportOrders, setActiveReportOrders] = useState<any[]>([])
  const [doneReportOrders, setDoneReportOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [todos, setTodos] = useState<TodoItem[]>([])

  // ========== 主数据加载（开工报工单 + 已完成报工） ==========
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const results = await Promise.allSettled([
          api.get('/production/report-orders', { params: { pageSize: 10, status: 0 } }),
          api.get('/production/report-orders', { params: { pageSize: 10, status: 1 } }),
        ])
        if (cancelled) return
        const [activeRes, doneRes] = results
        if (activeRes.status === 'fulfilled') setActiveReportOrders(extractList(activeRes.value))
        if (doneRes.status === 'fulfilled') setDoneReportOrders(extractList(doneRes.value))
      } catch (err) {
        logger.error('加载工作台数据失败:', err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // ========== 待办事项加载（统一接口 /auto/dashboard/todos，口径与移动端一致） ==========
  const loadTodos = useCallback(async () => {
    try {
      const r: any = await api.get('/auto/dashboard/todos')
      const d = r.data || {}
      const items: TodoItem[] = [
        { icon: '🏃', label: '待完工订单', count: d.pendingOrders ?? 0, color: 'var(--color-success)', path: '/production/orders?tab=开工' },
        { icon: '🧰', label: '待维保设备', count: d.pendingMaintenanceDevices ?? 0, color: 'var(--color-warning)', path: '/device/maintenance' },
        { icon: '⚙️', label: '每日待点检', count: d.dailyInspection ?? 0, color: 'var(--color-primary)', path: '/device/maintenance' },
        { icon: '📅', label: '定期待保养项', count: d.periodicMaintenance ?? 0, color: 'var(--color-warning)', path: '/device/maintenance' },
        { icon: '🚨', label: '设备故障待处理', count: d.pendingFaults ?? 0, color: 'var(--color-error)', path: '/device/fault' },
        { icon: '✅', label: '待检验来料', count: d.pendingIncoming ?? 0, color: 'var(--color-success)', path: '/quality/incoming' },
      ]
      setTodos(items.filter(i => i.count > 0))
    } catch (err: any) {
      logger.error('加载待办事项失败:', err?.message || err)
    }
  }, [])

  useEffect(() => { loadTodos() }, [loadTodos])

  // ========== 统计卡片配置（3 张，span=8 各占 1/3） ==========
  const statConfigs = useMemo(() => [
    { label: '开工报工单', value: activeReportOrders.length, icon: <ToolOutlined />, color: 'var(--color-primary)' },
    { label: '已完成报工', value: doneReportOrders.length, icon: <CheckCircleOutlined />, color: 'var(--color-success)' },
    { label: '待办事项', value: todos.reduce((s, t) => s + t.count, 0), icon: <BugOutlined />, color: 'var(--color-error)' },
  ], [activeReportOrders, doneReportOrders, todos])

  // ========== 表格列定义 ==========
  const reportOrderColumns = [
    { title: '报工单号', dataIndex: 'report_no', key: 'report_no' },
    { title: '料品名称', dataIndex: 'material_name', key: 'material_name', ellipsis: true },
    { title: '计划数量', dataIndex: 'planned_qty', key: 'planned_qty', render: (v: any) => Number(v || 0).toLocaleString() },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (v: any) => {
        const colors: Record<string, string> = { 0: 'processing', 1: 'success', 2: 'default' }
        const labels: Record<string, string> = { 0: '开工中', 1: '已完工', 2: '已关闭' }
        return <Tag color={colors[String(v)] || 'default'}>{labels[String(v)] || v}</Tag>
      },
    },
    {
      title: '操作', key: 'action', width: 80,
      render: () => <Button type="link" size="small" onClick={() => navigate('/production/reporting')}>报工</Button>,
    },
  ]

  return (
    <div>
      {/* 第一行：统计卡片（3 张，span=8） */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        {statConfigs.map((s, i) => (
          <Col key={i} span={8}>
            <div className="dashboard-card" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    background: `${s.color}15`, color: s.color,
                    width: 48, height: 48, borderRadius: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                    flexShrink: 0,
                  }}
                >
                  {s.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                    {s.value}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{s.label}</div>
                </div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* 第二行：开工报工单 + 待办事项 */}
      <Row gutter={[12, 12]}>
        <Col span={16}>
          <div className="dashboard-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Title level={5} style={{ margin: 0 }}>开工中的报工单</Title>
              <Text type="secondary">实时数据</Text>
            </div>
            <ResizableTable
              tableKey="pages_Dashboard"
              columns={reportOrderColumns}
              dataSource={activeReportOrders}
              rowKey="report_order_id"
              size="small"
              loading={loading}
              pagination={false}
            />
          </div>
        </Col>
        <Col span={8}>
          <div className="dashboard-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <BulbOutlined style={{ color: 'var(--color-error)' }} />
              <Title level={5} style={{ margin: 0 }}>待办事项</Title>
            </div>
            {todos.length === 0 ? (
              <Text type="secondary" style={{ fontSize: 13 }}>🎉 暂无待办</Text>
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size={10}>
                {todos.map((t) => (
                  <div
                    key={t.label}
                    onClick={() => navigate(t.path)}
                    style={{
                      cursor: 'pointer',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 12px', borderRadius: 8,
                      background: `${t.color}12`, borderLeft: `3px solid ${t.color}`,
                      transition: 'transform .15s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateX(2px)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateX(0)' }}
                  >
                    <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                      {t.icon} {t.label}
                    </span>
                    <Tag color="default" style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
                      {t.count}
                    </Tag>
                  </div>
                ))}
              </Space>
            )}
          </div>
        </Col>
      </Row>
    </div>
  )
}
