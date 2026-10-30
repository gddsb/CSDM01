import logger from '../utils/logger.js'
import ResizableTable from '../components/ResizableTable'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Row, Col, Tag, Typography, Space } from 'antd'
import {
  ToolOutlined, CheckCircleOutlined, BugOutlined, ClockCircleOutlined, BulbOutlined,
} from '@ant-design/icons'
import { useApp } from '../contexts/AppContext'
import api from '../utils/api'
import { nowLocalDateStr } from '../utils/localTime'

const { Title, Text } = Typography

/** 统一解析列表接口的 total（兼容 data 是数组 vs 嵌套对象） */
function extractTotal(r: any): number {
  if (!r) return 0
  if (Array.isArray(r.data)) return r.total ?? 0
  return r.data?.total ?? r.total ?? 0
}

/** 统一解析列表接口的 list */
function extractList(r: any): any[] {
  if (!r) return []
  if (Array.isArray(r.data)) return r.data
  return r.data?.list ?? r.data?.records ?? []
}

/** 构造今日+周+月 period_key（本地时区，避免 UTC 偏移） */
function buildPeriodKeys() {
  const now = new Date()
  const todayKey = nowLocalDateStr(now)
  // ISO week 计算（本地时区）
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  t.setDate(t.getDate() + 4 - (t.getDay() || 7))
  const yearStart = new Date(t.getFullYear(), 0, 1)
  const week = Math.ceil((((+t - +yearStart) / 86400000) + 1) / 7)
  const weekKey = `${t.getFullYear()}-W${String(week).padStart(2, '0')}`
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return `${todayKey},${weekKey},${monthKey}`
}

interface TodoItem { icon: string; label: string; count: number; color: string }

export default function Dashboard() {
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

  // ========== 待办事项加载（与移动端同口径，4 个 API 全真实数据） ==========
  const loadTodos = useCallback(async () => {
    const periodKeys = buildPeriodKeys()
    const apis: Promise<TodoItem>[] = [
      // 待完工订单（production/orders status=2 开工中）
      api.get('/production/orders', { params: { page: 1, pageSize: 1, status: 2 } })
        .then((r: any) => ({ icon: '🏃', label: '待完工订单', count: extractTotal(r), color: '#4CAF50' }))
        .catch(() => ({ icon: '🏃', label: '待完工订单', count: 0, color: '#4CAF50' })),
      // 待维保设备（今日+周+月，按 device_id 去重）
      api.get('/basic/device-records', { params: { page: 1, pageSize: 200, status: '待执行,执行中', period_key: periodKeys } })
        .then((r: any) => {
          const list = extractList(r)
          const cnt = new Set(list.map((x: any) => x.device_id).filter(Boolean)).size
          return { icon: '🧰', label: '待维保设备', count: cnt, color: '#FF9800' }
        })
        .catch(() => ({ icon: '🧰', label: '待维保设备', count: 0, color: '#FF9800' })),
      // 设备故障待处理
      api.get('/device-faults', { params: { page: 1, pageSize: 1, status: '待处理' } })
        .then((r: any) => ({ icon: '🚨', label: '设备故障待处理', count: extractTotal(r), color: '#F44336' }))
        .catch(() => ({ icon: '🚨', label: '设备故障待处理', count: 0, color: '#F44336' })),
      // 待检验来料
      api.get('/basic/incoming-inspections', { params: { page: 1, pageSize: 1, status: '待检验' } })
        .then((r: any) => ({ icon: '✅', label: '待检验来料', count: extractTotal(r), color: '#4CAF50' }))
        .catch(() => ({ icon: '✅', label: '待检验来料', count: 0, color: '#4CAF50' })),
    ]
    const results = await Promise.allSettled(apis)
    const items = results.filter(r => r.status === 'fulfilled').map(r => (r as any).value) as TodoItem[]
    setTodos(items.filter(i => i.count > 0))
  }, [])

  useEffect(() => { loadTodos() }, [loadTodos])

  // ========== 统计卡片配置（3 张，span=8 各占 1/3） ==========
  const statConfigs = useMemo(() => [
    { label: '开工报工单', value: activeReportOrders.length, icon: <ToolOutlined />, color: '#2196F3' },
    { label: '已完成报工', value: doneReportOrders.length, icon: <CheckCircleOutlined />, color: '#4CAF50' },
    { label: '待办事项', value: todos.reduce((s, t) => s + t.count, 0), icon: <BugOutlined />, color: '#F44336' },
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
              <BulbOutlined style={{ color: '#F44336' }} />
              <Title level={5} style={{ margin: 0 }}>待办事项</Title>
            </div>
            {todos.length === 0 ? (
              <Text type="secondary" style={{ fontSize: 13 }}>🎉 暂无待办</Text>
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size={10}>
                {todos.map((t) => (
                  <div key={t.label} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px', borderRadius: 8,
                    background: `${t.color}12`, borderLeft: `3px solid ${t.color}`,
                  }}>
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
