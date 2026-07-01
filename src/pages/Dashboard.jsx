import { Row, Col, Card, Table, Tag, Progress, Typography, Space, Statistic } from 'antd'
import {
  ToolOutlined, FileTextOutlined, ExperimentOutlined, CheckCircleOutlined,
  ClockCircleOutlined, WarningOutlined, TeamOutlined
} from '@ant-design/icons'
import { useApp } from '../contexts/AppContext'
import { orders, workOrders, incomingInspections, processReports, devices } from '../mock/data'

const { Text, Title } = Typography

export default function Dashboard() {
  const { currentUser } = useApp()

  const activeOrders = orders.filter(o => o.status !== '已关闭')
  const activeWorkOrders = workOrders.filter(w => w.status === '开工')
  const pendingInspections = incomingInspections.filter(i => i.status === '检验中')
  const faultDevices = devices.filter(d => d.status === '故障')

  const stats = [
    { label: '开工中工单', value: activeWorkOrders.length, icon: <ToolOutlined />, color: '#2196F3' },
    { label: '活跃订单', value: activeOrders.length, icon: <FileTextOutlined />, color: '#00BCD4' },
    { label: '待检任务', value: pendingInspections.length, icon: <ExperimentOutlined />, color: '#FF6F00' },
    { label: '设备故障', value: faultDevices.length, icon: <WarningOutlined />, color: '#F44336' },
  ]

  const recentReports = processReports.slice(0, 5)

  const orderColumns = [
    { title: '订单编号', dataIndex: 'order_no', key: 'order_no' },
    { title: '料品名称', dataIndex: 'material_name', key: 'material_name' },
    { title: '计划数量', dataIndex: 'planned_qty', key: 'planned_qty', render: v => `${v.toLocaleString()}` },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: v => {
        const colors = { '待下达': 'default', '已下达': 'processing', '已关闭': 'success' }
        return <Tag color={colors[v]}>{v}</Tag>
      }
    },
  ]

  const workOrderColumns = [
    { title: '工单编号', dataIndex: 'work_order_no', key: 'work_order_no' },
    { title: '产线', dataIndex: 'line_name', key: 'line_name' },
    { title: '料品', dataIndex: 'material_name', key: 'material_name' },
    { title: '目标数量', dataIndex: 'target_qty', key: 'target_qty', render: v => `${v.toLocaleString()}` },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: v => {
        const colors = { '开立': 'default', '开工': 'processing', '关闭': 'warning', '完工': 'success' }
        return <Tag color={colors[v]}>{v}</Tag>
      }
    },
  ]

  const reportColumns = [
    { title: '工单', dataIndex: 'work_order_no', key: 'work_order_no' },
    { title: '工序', dataIndex: 'process_name', key: 'process_name' },
    { title: '投入', dataIndex: 'input_qty', key: 'input_qty' },
    { title: '不良合计', key: 'defect_total', render: (_, r) => r.defect_material + r.defect_process + r.defect_scrap },
    { title: '产出', dataIndex: 'output_qty', key: 'output_qty' },
    { title: '报工人', dataIndex: 'report_user_name', key: 'report_user_name' },
    { title: '报工时间', dataIndex: 'report_time', key: 'report_time' },
  ]

  return (
    <div>
      {/* 第一行：统计卡片 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        {stats.map((s, i) => (
          <Col key={i} span={6}>
            <div className="dashboard-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div className="stat-icon" style={{ background: s.color, width: 56, height: 56, fontSize: 26, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {s.icon}
              </div>
              <div>
                <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{s.value}</div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{s.label}</div>
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
              <Text type="secondary">今日实时数据</Text>
            </div>
            <Table
              columns={workOrderColumns}
              dataSource={workOrders}
              rowKey="work_order_id"
              size="small"
              pagination={false}
            />
          </div>
        </Col>
        <Col span={8}>
          <div className="dashboard-card">
            <Title level={5} style={{ marginBottom: 16 }}>生产进度</Title>
            {workOrders.filter(w => w.status === '开工').map(w => {
              const reported = processReports
                .filter(r => r.work_order_id === w.work_order_id)
                .reduce((sum, r) => sum + r.output_qty, 0)
              const pct = Math.round((reported / w.target_qty) * 100)
              return (
                <div key={w.work_order_id} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 13 }}>{w.work_order_no}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{reported.toLocaleString()}/{w.target_qty.toLocaleString()}</Text>
                  </div>
                  <Progress percent={pct} size="small" strokeColor="var(--color-primary)" />
                </div>
              )
            })}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
              <Title level={5} style={{ marginBottom: 12 }}>待办事项</Title>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <Text><ClockCircleOutlined style={{ color: '#FF6F00', marginRight: 8 }} />待检来料任务</Text>
                  <Tag color="warning">{pendingInspections.length}</Tag>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <Text><WarningOutlined style={{ color: '#F44336', marginRight: 8 }} />设备故障待修</Text>
                  <Tag color="error">{faultDevices.length}</Tag>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <Text><CheckCircleOutlined style={{ color: '#4CAF50', marginRight: 8 }} />今日已完成报工</Text>
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
            <Table columns={orderColumns} dataSource={orders} rowKey="order_id" size="small" pagination={false} />
          </div>
        </Col>
        <Col span={12}>
          <div className="dashboard-card">
            <Title level={5} style={{ marginBottom: 16 }}>最近报工记录</Title>
            <Table columns={reportColumns} dataSource={recentReports} rowKey="report_id" size="small" pagination={false} />
          </div>
        </Col>
      </Row>
    </div>
  )
}
