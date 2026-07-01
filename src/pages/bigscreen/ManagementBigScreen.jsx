import React, { useState, useEffect } from 'react'
import { Row, Col, Table, Tag, Button } from 'antd'
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import {
  workOrders, orders, incomingInspections, finishedInspections,
  microbeInspections, envInspections, complaints, instruments,
  processReports, devices, productionLines, materials
} from '../../mock/data'
import logoRect from '../../assets/logo-rect.png'
import '../../styles/bigscreen.css'

export default function ManagementBigScreen() {
  const navigate = useNavigate()
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (d) => {
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  // 生产指标
  const activeOrders = orders.filter(o => o.status !== '已关闭').length
  const closedOrders = orders.filter(o => o.status === '已关闭').length
  const activeWorkOrders = workOrders.filter(w => w.status === '开工').length
  const completedWorkOrders = workOrders.filter(w => w.status === '完工').length

  // 质量指标
  const incomingPass = incomingInspections.filter(i => i.result === '合格').length
  const incomingFail = incomingInspections.filter(i => i.result === '不合格').length
  const incomingPending = incomingInspections.filter(i => i.status === '检验中').length
  const finishedPass = finishedInspections.filter(i => i.result === '合格').length
  const finishedTotal = finishedInspections.length
  const microbePass = microbeInspections.filter(i => i.result === '合格').length
  const envPass = envInspections.filter(i => i.result === '合格').length
  const envTotal = envInspections.length
  const activeComplaints = complaints.filter(c => c.status !== '已关闭').length

  // 设备指标
  const runningDevices = devices.filter(d => d.status === '运行').length
  const faultDevices = devices.filter(d => d.status === '故障').length
  const standbyDevices = devices.filter(d => d.status === '待机').length
  const deviceUtilization = devices.length > 0 ? (runningDevices / devices.length * 100).toFixed(1) : 0

  // 仪器指标
  const normalInstruments = instruments.filter(i => i.status === '正常').length
  const expiringInstruments = instruments.filter(i => i.status === '即将到期').length
  const expiredInstruments = instruments.filter(i => i.status === '已超期').length

  // 生产数据
  const totalInput = processReports.filter(r => r.process_name === '裁剪下料').reduce((s, r) => s + r.input_qty, 0)
  const totalDefect = processReports.reduce((s, r) => s + r.defect_material + r.defect_process + r.defect_scrap, 0)
  const totalOutput = processReports.reduce((s, r) => s + r.output_qty, 0)
  const yieldRate = totalInput > 0 ? ((totalInput - totalDefect) / totalInput * 100).toFixed(1) : 0

  // KPI数据
  const kpiData = [
    { label: '活跃订单', value: activeOrders, unit: '', color: '#58A6FF', icon: '📋' },
    { label: '生效工单', value: activeWorkOrders, unit: '', color: '#3FB950', icon: '🔧' },
    { label: '生产良率', value: yieldRate, unit: '%', color: '#3FB950', icon: '✓' },
    { label: '来料合格率', value: incomingPass + incomingFail > 0 ? (incomingPass / (incomingPass + incomingFail) * 100).toFixed(1) : 0, unit: '%', color: '#58A6FF', icon: '🔬' },
    { label: '设备利用率', value: deviceUtilization, unit: '%', color: '#F0883E', icon: '⚙' },
    { label: '活跃客诉', value: activeComplaints, unit: '', color: '#F85149', icon: '⚠' },
  ]

  // 质量检验汇总
  const qualitySummary = [
    { category: '来料检验', total: incomingInspections.length, pass: incomingPass, fail: incomingFail, pending: incomingPending },
    { category: '成品检验', total: finishedTotal, pass: finishedPass, fail: finishedTotal - finishedPass, pending: 0 },
    { category: '微生物检验', total: microbeInspections.length, pass: microbePass, fail: microbeInspections.length - microbePass, pending: 0 },
    { category: '环境检验', total: envTotal, pass: envPass, fail: envTotal - envPass, pending: 0 },
  ]

  const qualityColumns = [
    { title: '检验类别', dataIndex: 'category', key: 'category', render: v => <span style={{ color: '#58A6FF', fontWeight: 600 }}>{v}</span> },
    { title: '总数', dataIndex: 'total', key: 'total', align: 'center' },
    { title: '合格', dataIndex: 'pass', key: 'pass', align: 'center', render: v => <span style={{ color: '#3FB950' }}>{v}</span> },
    { title: '不合格', dataIndex: 'fail', key: 'fail', align: 'center', render: v => v > 0 ? <span style={{ color: '#F85149' }}>{v}</span> : '-' },
    { title: '待检', dataIndex: 'pending', key: 'pending', align: 'center', render: v => v > 0 ? <span style={{ color: '#D29922' }}>{v}</span> : '-' },
    {
      title: '合格率', key: 'rate', align: 'center',
      render: (_, r) => r.total > 0 ? <span style={{ color: '#3FB950' }}>{(r.pass / r.total * 100).toFixed(0)}%</span> : '-'
    },
  ]

  // 客诉列表
  const complaintColumns = [
    { title: '客诉编号', dataIndex: 'complaint_no', key: 'complaint_no', width: 120 },
    { title: '客户', dataIndex: 'customer_name', key: 'customer_name', width: 100 },
    { title: '问题分类', dataIndex: 'complaint_type', key: 'complaint_type', width: 90 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: v => <Tag color={v === '已关闭' ? 'success' : 'processing'} style={{ fontSize: 11 }}>{v}</Tag> },
  ]

  return (
    <div className="bigscreen-container">
      {/* 顶部标题栏 */}
      <div className="bs-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/dashboard')}
            style={{ color: '#8B949E' }}
          />
          <div className="bs-screen-tabs">
            <div className="bs-screen-tab" onClick={() => navigate('/bigscreen/production')}>生产大屏</div>
            <div className="bs-screen-tab active">管理大屏</div>
          </div>
        </div>
        <div className="bs-title">
          <img src={logoRect} alt="logo" style={{ height: 40, width: 'auto', marginRight: 12, verticalAlign: 'middle' }} />
          奶粉罐生产管理综合大屏
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <ReloadOutlined style={{ color: '#3FB950' }} className="bs-blink" />
          <div className="bs-time">{formatTime(currentTime)}</div>
        </div>
      </div>

      {/* KPI指标行 */}
      <Row gutter={[10, 10]} style={{ marginBottom: 10 }}>
        {kpiData.map((kpi, i) => (
          <Col key={i} span={4}>
            <div className="bs-panel">
              <div className="bs-kpi-card">
                <div className="bs-kpi-value bs-number-glow" style={{ color: kpi.color }}>
                  {kpi.icon} {kpi.value}<span style={{ fontSize: 16, marginLeft: 2 }}>{kpi.unit}</span>
                </div>
                <div className="bs-kpi-label">{kpi.label}</div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* 主体内容 */}
      <Row gutter={[10, 10]} className="bs-main-row">
        {/* 左侧：生产概况 + 订单 */}
        <Col span={6}>
          <div className="bs-panel">
            <div className="bs-panel-title">生产概况</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ textAlign: 'center', padding: 12, background: 'rgba(88,166,255,0.06)', borderRadius: 6 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#58A6FF' }}>{activeOrders}</div>
                <div style={{ fontSize: 12, color: '#8B949E' }}>活跃订单</div>
              </div>
              <div style={{ textAlign: 'center', padding: 12, background: 'rgba(63,185,80,0.06)', borderRadius: 6 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#3FB950' }}>{activeWorkOrders}</div>
                <div style={{ fontSize: 12, color: '#8B949E' }}>生效工单</div>
              </div>
              <div style={{ textAlign: 'center', padding: 12, background: 'rgba(240,136,62,0.06)', borderRadius: 6 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#F0883E' }}>{totalOutput.toLocaleString()}</div>
                <div style={{ fontSize: 12, color: '#8B949E' }}>累计产出</div>
              </div>
              <div style={{ textAlign: 'center', padding: 12, background: 'rgba(248,81,73,0.06)', borderRadius: 6 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#F85149' }}>{totalDefect}</div>
                <div style={{ fontSize: 12, color: '#8B949E' }}>不良总数</div>
              </div>
            </div>
          </div>

          <div className="bs-panel">
            <div className="bs-panel-title">产线利用率</div>
            {productionLines.map(line => {
              const lineDevices = devices.filter(d => d.location.includes(line.line_name))
              const running = lineDevices.filter(d => d.status === '运行').length
              const utilization = lineDevices.length > 0 ? (running / lineDevices.length * 100) : 0
              return (
                <div key={line.line_id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                    <span style={{ color: '#C9D1D9' }}>{line.line_name}</span>
                    <span style={{ color: '#8B949E' }}>{utilization.toFixed(0)}%</span>
                  </div>
                  <div className="bs-progress-bar">
                    <div className="bs-progress-fill" style={{
                      width: `${utilization}%`,
                      background: utilization >= 75 ? '#3FB950' : utilization >= 50 ? '#58A6FF' : '#D29922'
                    }} />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="bs-panel">
            <div className="bs-panel-title">料品库存预警</div>
            {materials.map(m => (
              <div key={m.material_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(88,166,255,0.06)', fontSize: 12 }}>
                <span style={{ color: '#C9D1D9' }}>{m.material_name}</span>
                <Tag color={m.status === '启用' ? 'success' : m.status === '试产' ? 'warning' : 'default'} style={{ fontSize: 11 }}>{m.status}</Tag>
              </div>
            ))}
          </div>
        </Col>

        {/* 中间：质量检验汇总 + 良率趋势 */}
        <Col span={12}>
          <div className="bs-panel">
            <div className="bs-panel-title">质量检验综合汇总</div>
            <Table
              className="bs-table"
              columns={qualityColumns}
              dataSource={qualitySummary}
              rowKey="category"
              size="small"
              pagination={false}
            />
          </div>

          <div className="bs-panel">
            <div className="bs-panel-title">各检验类别合格率对比</div>
            <Row gutter={[12, 12]}>
              {qualitySummary.map((q, i) => {
                const rate = q.total > 0 ? (q.pass / q.total * 100) : 0
                const color = rate >= 90 ? '#3FB950' : rate >= 70 ? '#D29922' : '#F85149'
                return (
                  <Col key={i} span={6}>
                    <div style={{ textAlign: 'center', padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                      <div style={{ fontSize: 32, fontWeight: 700, color }} className="bs-number-glow">{rate.toFixed(0)}%</div>
                      <div style={{ fontSize: 12, color: '#8B949E', marginTop: 4 }}>{q.category}</div>
                      <div style={{ fontSize: 11, color: '#8B949E' }}>合格{q.pass}/总计{q.total}</div>
                    </div>
                  </Col>
                )
              })}
            </Row>
          </div>

          <div className="bs-panel">
            <div className="bs-panel-title">客诉处理跟踪</div>
            <Table
              className="bs-table"
              columns={complaintColumns}
              dataSource={complaints}
              rowKey="complaint_id"
              size="small"
              pagination={false}
              scroll={{ y: 'calc(100% - 40px)' }}
            />
          </div>
        </Col>

        {/* 右侧：设备 + 仪器 */}
        <Col span={6}>
          <div className="bs-panel">
            <div className="bs-panel-title">设备运行状态</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div style={{ textAlign: 'center', padding: 10, background: 'rgba(63,185,80,0.08)', borderRadius: 6 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#3FB950' }}>{runningDevices}</div>
                <div style={{ fontSize: 11, color: '#8B949E' }}>运行</div>
              </div>
              <div style={{ textAlign: 'center', padding: 10, background: 'rgba(139,148,158,0.08)', borderRadius: 6 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#8B949E' }}>{standbyDevices}</div>
                <div style={{ fontSize: 11, color: '#8B949E' }}>待机</div>
              </div>
              <div style={{ textAlign: 'center', padding: 10, background: 'rgba(248,81,73,0.08)', borderRadius: 6 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#F85149' }} className="bs-blink">{faultDevices}</div>
                <div style={{ fontSize: 11, color: '#8B949E' }}>故障</div>
              </div>
            </div>
            <div style={{ padding: 10, background: 'rgba(88,166,255,0.06)', borderRadius: 6, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#58A6FF' }} className="bs-number-glow">{deviceUtilization}%</div>
              <div style={{ fontSize: 12, color: '#8B949E' }}>设备综合利用率</div>
            </div>
          </div>

          <div className="bs-panel">
            <div className="bs-panel-title">检测仪器校准状态</div>
            {instruments.map(inst => (
              <div key={inst.instrument_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(88,166,255,0.06)', fontSize: 12 }}>
                <div>
                  <div style={{ color: '#C9D1D9' }}>{inst.instrument_name}</div>
                  <div style={{ color: '#8B949E', fontSize: 11 }}>下次校准: {inst.next_calibration_date}</div>
                </div>
                <Tag color={inst.status === '正常' ? 'success' : inst.status === '即将到期' ? 'warning' : 'error'} style={{ fontSize: 11 }}>{inst.status}</Tag>
              </div>
            ))}
          </div>

          <div className="bs-panel">
            <div className="bs-panel-title">订单完成情况</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ textAlign: 'center', padding: 12, background: 'rgba(88,166,255,0.06)', borderRadius: 6 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#58A6FF' }}>{activeOrders}</div>
                <div style={{ fontSize: 12, color: '#8B949E' }}>进行中</div>
              </div>
              <div style={{ textAlign: 'center', padding: 12, background: 'rgba(63,185,80,0.06)', borderRadius: 6 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#3FB950' }}>{closedOrders}</div>
                <div style={{ fontSize: 12, color: '#8B949E' }}>已关闭</div>
              </div>
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: '#8B949E', textAlign: 'center' }}>
              本月已完成工单 <span style={{ color: '#3FB950', fontWeight: 600, fontSize: 16 }}>{completedWorkOrders}</span> 个
            </div>
          </div>
        </Col>
      </Row>
    </div>
  )
}
