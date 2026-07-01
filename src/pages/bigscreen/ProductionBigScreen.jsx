import React, { useState, useEffect } from 'react'
import { Row, Col, Table, Tag, Progress, Button, Tooltip } from 'antd'
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { workOrders, processReports, productionLines, devices, defectTypes, orders } from '../../mock/data'
import logoRect from '../../assets/logo-rect.png'
import '../../styles/bigscreen.css'

export default function ProductionBigScreen() {
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

  // 计算统计数据
  const activeWorkOrders = workOrders.filter(w => w.status === '开工')
  const totalTarget = activeWorkOrders.reduce((s, w) => s + w.target_qty, 0)
  const totalOutput = processReports
    .filter(r => activeWorkOrders.some(w => w.work_order_id === r.work_order_id))
    .reduce((s, r) => s + r.output_qty, 0)
  const totalDefect = processReports.reduce((s, r) => s + r.defect_material + r.defect_process + r.defect_scrap, 0)
  const totalInput = processReports.filter(r => r.process_name === '裁剪下料').reduce((s, r) => s + r.input_qty, 0)
  const yieldRate = totalInput > 0 ? ((totalInput - totalDefect) / totalInput * 100).toFixed(1) : '0.0'
  const runningLines = productionLines.filter(l => l.status === '运行中')
  const faultDevices = devices.filter(d => d.status === '故障')

  const kpiData = [
    { label: '生效工单', value: activeWorkOrders.length, unit: '个', color: '#58A6FF' },
    { label: '今日产出', value: totalOutput, unit: '件', color: '#3FB950' },
    { label: '今日投入', value: totalInput, unit: '件', color: '#F0883E' },
    { label: '不良总数', value: totalDefect, unit: '件', color: '#F85149' },
    { label: '良率', value: yieldRate, unit: '%', color: '#3FB950' },
    { label: '运行产线', value: runningLines.length, unit: '条', color: '#58A6FF' },
  ]

  // 工单进度数据
  const workOrderProgress = activeWorkOrders.map(w => {
    const reported = processReports
      .filter(r => r.work_order_id === w.work_order_id)
      .reduce((s, r) => s + r.output_qty, 0)
    const pct = w.target_qty > 0 ? Math.round(reported / w.target_qty * 100) : 0
    return { ...w, reported, pct }
  })

  // 工序产出统计
  const processStats = {}
  processReports.forEach(r => {
    if (!processStats[r.process_name]) {
      processStats[r.process_name] = { name: r.process_name, input: 0, output: 0, defect: 0 }
    }
    processStats[r.process_name].input += r.input_qty
    processStats[r.process_name].output += r.output_qty
    processStats[r.process_name].defect += r.defect_material + r.defect_process + r.defect_scrap
  })

  const processColumns = [
    { title: '工序', dataIndex: 'name', key: 'name', width: 90 },
    { title: '投入', dataIndex: 'input', key: 'input', render: v => v.toLocaleString() },
    { title: '产出', dataIndex: 'output', key: 'output', render: v => <span style={{ color: '#3FB950' }}>{v.toLocaleString()}</span> },
    { title: '不良', dataIndex: 'defect', key: 'defect', render: v => v > 0 ? <span style={{ color: '#F85149' }}>{v}</span> : '-' },
    {
      title: '良率', key: 'yield', width: 70,
      render: (_, r) => r.input > 0 ? <span style={{ color: '#3FB950' }}>{((r.input - r.defect) / r.input * 100).toFixed(1)}%</span> : '-'
    },
  ]

  // 不良分布
  const defectDistribution = {}
  processReports.forEach(r => {
    defectDistribution['来料不良'] = (defectDistribution['来料不良'] || 0) + r.defect_material
    defectDistribution['制程不良'] = (defectDistribution['制程不良'] || 0) + r.defect_process
    defectDistribution['检验报废'] = (defectDistribution['检验报废'] || 0) + r.defect_scrap
  })

  const defectColors = { '来料不良': '#F0883E', '制程不良': '#F85149', '检验报废': '#D29922' }
  const totalDefectAll = Object.values(defectDistribution).reduce((s, v) => s + v, 0)

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
            <div className="bs-screen-tab active">生产大屏</div>
            <div className="bs-screen-tab" onClick={() => navigate('/bigscreen/management')}>管理大屏</div>
          </div>
        </div>
        <div className="bs-title">
          <img src={logoRect} alt="logo" style={{ height: 40, width: 'auto', marginRight: 12, verticalAlign: 'middle' }} />
          奶粉罐生产实时监控大屏
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
                  {kpi.value}<span style={{ fontSize: 16, marginLeft: 2 }}>{kpi.unit}</span>
                </div>
                <div className="bs-kpi-label">{kpi.label}</div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* 主体内容 */}
      <Row gutter={[10, 10]} className="bs-main-row">
        {/* 左侧：产线状态 */}
        <Col span={6}>
          <div className="bs-panel">
            <div className="bs-panel-title">产线运行状态</div>
            {productionLines.map(line => (
              <div key={line.line_id} className="bs-line-status" style={{
                borderLeftColor: line.status === '运行中' ? '#3FB950' : line.status === '维护中' ? '#D29922' : '#F85149'
              }}>
                <div className="bs-line-dot" style={{
                  background: line.status === '运行中' ? '#3FB950' : line.status === '维护中' ? '#D29922' : '#F85149'
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#E6EDF3' }}>{line.line_name} · {line.workshop}</div>
                  <div style={{ fontSize: 12, color: '#8B949E' }}>
                    状态：<Tag color={line.status === '运行中' ? 'success' : 'warning'} style={{ fontSize: 11 }}>{line.status}</Tag>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bs-panel">
            <div className="bs-panel-title">设备状态概览</div>
            {devices.map(d => (
              <div key={d.device_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(88,166,255,0.06)', fontSize: 12 }}>
                <span style={{ color: '#C9D1D9' }}>{d.device_name}</span>
                <Tag color={d.status === '运行' ? 'success' : d.status === '故障' ? 'error' : 'default'} style={{ fontSize: 11 }}>{d.status}</Tag>
              </div>
            ))}
            {faultDevices.length > 0 && (
              <div style={{ marginTop: 8, padding: 8, background: 'rgba(248,81,73,0.1)', borderRadius: 6, fontSize: 12, color: '#F85149' }}>
                ⚠ 当前 {faultDevices.length} 台设备故障，请及时处理
              </div>
            )}
          </div>
        </Col>

        {/* 中间：工单进度 + 工序产出 */}
        <Col span={12}>
          <div className="bs-panel">
            <div className="bs-panel-title">生产工单实时进度</div>
            {workOrderProgress.length > 0 ? workOrderProgress.map(w => (
              <div key={w.work_order_id} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                  <span style={{ color: '#E6EDF3' }}>{w.work_order_no} · {w.line_name} · {w.material_name}</span>
                  <span style={{ color: '#8B949E' }}>{w.reported.toLocaleString()} / {w.target_qty.toLocaleString()} ({w.pct}%)</span>
                </div>
                <div className="bs-progress-bar">
                  <div className="bs-progress-fill" style={{
                    width: `${w.pct}%`,
                    background: w.pct >= 80 ? 'linear-gradient(90deg, #3FB950, #58A6FF)' : w.pct >= 50 ? 'linear-gradient(90deg, #58A6FF, #3FB950)' : 'linear-gradient(90deg, #F0883E, #D29922)'
                  }} />
                </div>
              </div>
            )) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#8B949E' }}>暂无开工中工单</div>
            )}
          </div>

          <div className="bs-panel">
            <div className="bs-panel-title">各工序产出统计</div>
            <Table
              className="bs-table"
              columns={processColumns}
              dataSource={Object.values(processStats)}
              rowKey="name"
              size="small"
              pagination={false}
              scroll={{ y: 'calc(100% - 40px)' }}
            />
          </div>
        </Col>

        {/* 右侧：不良分析 + 订单 */}
        <Col span={6}>
          <div className="bs-panel">
            <div className="bs-panel-title">不良分布分析</div>
            {Object.entries(defectDistribution).map(([type, count]) => {
              const pct = totalDefectAll > 0 ? (count / totalDefectAll * 100).toFixed(1) : 0
              return (
                <div key={type} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                    <span style={{ color: '#C9D1D9' }}>{type}</span>
                    <span style={{ color: defectColors[type] }}>{count} 件 ({pct}%)</span>
                  </div>
                  <div className="bs-progress-bar">
                    <div className="bs-progress-fill" style={{ width: `${pct}%`, background: defectColors[type] }} />
                  </div>
                </div>
              )
            })}
            <div style={{ marginTop: 12, padding: 10, background: 'rgba(248,81,73,0.08)', borderRadius: 6, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#F85149' }} className="bs-number-glow">{totalDefectAll}</div>
              <div style={{ fontSize: 12, color: '#8B949E' }}>不良总数(件)</div>
            </div>
          </div>

          <div className="bs-panel">
            <div className="bs-panel-title">生产订单概览</div>
            {orders.map(o => (
              <div key={o.order_id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(88,166,255,0.06)', fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: '#E6EDF3', fontWeight: 600 }}>{o.order_no}</span>
                  <Tag color={o.status === '已下达' ? 'processing' : o.status === '已关闭' ? 'success' : 'default'} style={{ fontSize: 11 }}>{o.status}</Tag>
                </div>
                <div style={{ color: '#8B949E' }}>{o.material_name} · {o.planned_qty.toLocaleString()}件</div>
              </div>
            ))}
          </div>
        </Col>
      </Row>
    </div>
  )
}
