import ResizableTable from '../../components/ResizableTable'
import React, { useState, useMemo, useEffect } from 'react'
import { Table, Tag, Button, Select, Input, Space, Row, Col, Progress, DatePicker, Card, Statistic, Spin, message } from 'antd'
import {
  FileTextOutlined, ExportOutlined, SearchOutlined, ReloadOutlined,
  CheckCircleOutlined, ClockCircleOutlined, WarningOutlined,
  RiseOutlined, FallOutlined
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import { formatDateTime } from '../../utils'
import api, { extractList } from '../../utils/api'
import { processReports as mockProcessReports } from '../../mock/data'

// 订单状态映射：0=开立, 1=下发, 2=开工, 3=完工, 4=关闭
const orderStatusNumToText: Record<number, string> = { 0: '开立', 1: '下发', 2: '开工', 3: '完工', 4: '关闭' }
// 工单状态映射：0=开工, 1=完工, 2=关闭
const woStatusNumToText: Record<number, string> = { 0: '开工', 1: '完工', 2: '关闭' }

const { RangePicker } = DatePicker

const statusColorMap = {
  '开立': 'default',
  '开工': 'processing',
  '关闭': 'warning',
  '完工': 'success',
}

export default function ProductionReport() {
  const [lineFilter, setLineFilter] = useState<number | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [productionLines, setProductionLines] = useState<any[]>([])
  const [processDefects, setProcessDefects] = useState<any[]>([])

  const loadData = async () => {
    setLoading(true)
    try {
      const [woRes, lineRes, defectRes] = await Promise.all([
        api.get('/production/report-orders', { params: { pageSize: 100 } }),
        api.get('/basic/production-lines'),
        api.get('/production/process-defects', { params: { pageSize: 500 } }),
      ])
      if (woRes.success && woRes.data) {
        setWorkOrders(extractList(woRes.data).map((item: any) => ({
          work_order_id: item.report_order_id,
          work_order_no: item.report_no,
          order_id: item.order_id,
          order_no: item.order_no,
          line_id: item.line_id,
          line_name: item.line_name,
          material_id: item.material_id,
          material_name: item.material_name,
          target_qty: Number(item.order?.planned_qty || item.report_qty || 0),
          actual_output_qty: Number(item.report_qty || 0),
          start_time: item.report_time,
          finish_time: item.finish_time,
          status: woStatusNumToText[item.status] ?? '开工',
          created_by: item.report_user_id,
          created_at: item.report_time,
        })))
      }
      if (lineRes.success && lineRes.data) {
        setProductionLines(extractList(lineRes.data))
      }
      if (defectRes.success && defectRes.data) {
        setProcessDefects(extractList(defectRes.data))
      }
    } catch (err: any) {
      message.error(err.message || '加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // 将工序不良记录转换为报表所需的 processReports 格式
  const processReports = useMemo(() => {
    if (processDefects.length === 0) return mockProcessReports
    const grouped: Record<string, any> = {}
    processDefects.forEach((d: any) => {
      const key = `${d.report_order_id}_${d.process_id}`
      if (!grouped[key]) {
        grouped[key] = {
          report_id: `rp_${d.report_order_id}_${d.process_id}`,
          work_order_id: d.report_order_id,
          work_order_no: d.report_order_no || '',
          process_id: d.process_id,
          process_name: d.process_name || '',
          input_qty: 0,
          defect_material: 0,
          defect_process: 0,
          defect_scrap: 0,
          output_qty: 0,
          device_id: d.device_id,
          device_name: d.device_name || '-',
          report_user: d.report_user,
          report_user_name: d.report_user_name || '',
          report_time: d.created_at || new Date().toISOString(),
        }
      }
      const defectType = d.defect_type?.defect_type || d.category_name || ''
      const qty = Number(d.quantity) || 0
      if (defectType === '来料不良') {
        grouped[key].defect_material += qty
      } else if (defectType === '制程不良') {
        grouped[key].defect_process += qty
      } else if (defectType === '检验报废') {
        grouped[key].defect_scrap += qty
      } else {
        grouped[key].defect_process += qty
      }
    })
    return Object.values(grouped)
  }, [processDefects])

  // 按工单汇总生产数据
  const reportData = useMemo(() => {
    return workOrders.map(wo => {
      const reports = processReports.filter((r: any) => r.work_order_id === wo.work_order_id)
      const totalDefectMaterial = reports.reduce((sum: number, r: any) => sum + r.defect_material, 0)
      const totalDefectProcess = reports.reduce((sum: number, r: any) => sum + r.defect_process, 0)
      const totalDefectScrap = reports.reduce((sum: number, r: any) => sum + r.defect_scrap, 0)
      const totalDefect = totalDefectMaterial + totalDefectProcess + totalDefectScrap
      const totalOutput = Number(wo.actual_output_qty || 0)
      const totalInput = totalOutput + totalDefect
      const yieldRate = totalInput > 0 ? ((totalOutput / totalInput) * 100).toFixed(1) : '0.0'
      const completionRate = wo.target_qty > 0 ? ((totalOutput / wo.target_qty) * 100).toFixed(1) : '0.0'
      return {
        ...wo,
        process_count: reports.length,
        total_input: totalInput,
        total_output: totalOutput,
        defect_material: totalDefectMaterial,
        defect_process: totalDefectProcess,
        defect_scrap: totalDefectScrap,
        total_defect: totalDefect,
        yield_rate: parseFloat(yieldRate),
        completion_rate: parseFloat(completionRate),
      }
    })
  }, [workOrders, processReports])

  const filtered = reportData.filter((r: any) => {
    const matchLine = !lineFilter || r.line_id === lineFilter
    const matchStatus = !statusFilter || r.status === statusFilter
    const matchSearch = !search || r.work_order_no.toLowerCase().includes(search.toLowerCase()) || r.material_name.includes(search)
    return matchLine && matchStatus && matchSearch
  })

  // 统计汇总
  const totalTarget = filtered.reduce((s, r) => s + r.target_qty, 0)
  const totalOutput = filtered.reduce((s, r) => s + r.total_output, 0)
  const totalDefect = filtered.reduce((s, r) => s + r.total_defect, 0)
  const avgYield = filtered.length > 0 ? (filtered.reduce((s, r) => s + r.yield_rate, 0) / filtered.length).toFixed(1) : '0.0'

  const stats = [
    { label: '工单总数', value: filtered.length, icon: <FileTextOutlined />, color: '#2196F3' },
    { label: '目标产量', value: totalTarget.toLocaleString(), icon: <RiseOutlined />, color: '#4CAF50' },
    { label: '实际产出', value: totalOutput.toLocaleString(), icon: <CheckCircleOutlined />, color: '#00BCD4' },
    { label: '不良总数', value: totalDefect.toLocaleString(), icon: <WarningOutlined />, color: '#FF9800' },
    { label: '平均良率', value: `${avgYield}%`, icon: <FallOutlined />, color: '#9C27B0' },
  ]

  const columns = [
    { title: '工单编号', dataIndex: 'work_order_no', key: 'work_order_no', width: 150, fixed: 'left' },
    { title: '订单编号', dataIndex: 'order_no', key: 'order_no', width: 150 },
    { title: '产线', dataIndex: 'line_name', key: 'line_name', width: 70 },
    { title: '产品名称', dataIndex: 'material_name', key: 'material_name', width: 120 },
    { title: '目标数量', dataIndex: 'target_qty', key: 'target_qty', width: 100, render: v => v.toLocaleString() },
    { title: '投入数量', dataIndex: 'total_input', key: 'total_input', width: 100, render: v => v.toLocaleString() },
    { title: '产出数量', dataIndex: 'total_output', key: 'total_output', width: 100, render: v => v.toLocaleString() },
    { title: '来料不良', dataIndex: 'defect_material', key: 'defect_material', width: 90, render: v => v > 0 ? <span style={{ color: '#FF9800' }}>{v}</span> : '-' },
    { title: '制程不良', dataIndex: 'defect_process', key: 'defect_process', width: 90, render: v => v > 0 ? <span style={{ color: '#F44336' }}>{v}</span> : '-' },
    { title: '报废数', dataIndex: 'defect_scrap', key: 'defect_scrap', width: 80, render: v => v > 0 ? <span style={{ color: '#9E9E9E' }}>{v}</span> : '-' },
    { title: '不良合计', dataIndex: 'total_defect', key: 'total_defect', width: 90, render: v => <strong style={{ color: v > 0 ? '#F44336' : 'var(--text-secondary)' }}>{v}</strong> },
    {
      title: '良率', dataIndex: 'yield_rate', key: 'yield_rate', width: 120,
      render: v => <Progress percent={v} size="small" strokeColor={v >= 95 ? '#52c41a' : v >= 90 ? '#faad14' : '#ff4d4f'} format={p => `${p}%`} />
    },
    {
      title: '完成率', dataIndex: 'completion_rate', key: 'completion_rate', width: 120,
      render: v => <Progress percent={v} size="small" strokeColor={v >= 100 ? '#52c41a' : v >= 50 ? '#2196F3' : '#faad14'} format={p => `${p}%`} />
    },
    { title: '报工工序数', dataIndex: 'process_count', key: 'process_count', width: 90 },
    { title: '工单状态', dataIndex: 'status', key: 'status', width: 90, render: v => <Tag color={statusColorMap[v]}>{v}</Tag> },
    { title: '开工时间', dataIndex: 'start_time', key: 'start_time', width: 150, render: v => formatDateTime(v) },
    { title: '完工时间', dataIndex: 'finish_time', key: 'finish_time', width: 150, render: v => formatDateTime(v) },
  ]

  return (
    <ThreeSectionPage
      title="生产报表"
      breadcrumbs="报表中心 / 生产报表"
      stats={stats}
      actions={<Button icon={<ExportOutlined />}>导出Excel</Button>}
      filters={[
        { type: 'input', placeholder: '搜索工单号/产品名称', col: { span: 6 } },
        { type: 'select', placeholder: '产线筛选', col: { span: 5 }, options: productionLines.map(l => ({ label: l.line_name, value: l.line_id })) },
        { type: 'select', placeholder: '工单状态', col: { span: 5 }, options: [
          { label: '开立', value: '开立' },
          { label: '开工', value: '开工' },
          { label: '关闭', value: '关闭' },
          { label: '完工', value: '完工' },
        ]},
        { type: 'rangepicker', col: { span: 6 } },
      ]}
      table={
        <Spin spinning={loading} tip="加载中...">
          <div>
            <Row gutter={[12, 8]} style={{ marginBottom: 12 }}>
              <Col span={6}>
                <Input
                  placeholder="搜索工单号/产品名称"
                  allowClear
                  prefix={<SearchOutlined />}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </Col>
              <Col span={5}>
                <Select
                  placeholder="产线筛选"
                  allowClear
                  style={{ width: '100%' }}
                  options={productionLines.map(l => ({ label: l.line_name, value: l.line_id }))}
                  value={lineFilter}
                  onChange={setLineFilter}
                />
              </Col>
              <Col span={5}>
                <Select
                  placeholder="工单状态"
                  allowClear
                  style={{ width: '100%' }}
                  options={[
                    { label: '开立', value: '开立' },
                    { label: '开工', value: '开工' },
                    { label: '关闭', value: '关闭' },
                    { label: '完工', value: '完工' },
                  ]}
                  value={statusFilter}
                  onChange={setStatusFilter}
                />
              </Col>
              <Col span={6}>
                <RangePicker style={{ width: '100%' }} />
              </Col>
              <Col>
                <Space>
                  <Button type="primary" icon={<SearchOutlined />} onClick={loadData}>查询</Button>
                  <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setLineFilter(undefined); setStatusFilter(undefined); loadData() }}>重置</Button>
                </Space>
              </Col>
            </Row>
            <ResizableTable tableKey="pages_report_ProductionReport"             columns={columns}
              dataSource={filtered}
              rowKey="work_order_id"
              size="small"
              scroll={{ x: 1900 }}
              pagination={{ pageSize: 30, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row style={{ background: 'var(--bg-card)', fontWeight: 700 }}>
                    <Table.Summary.Cell index={0} colSpan={4}>合计</Table.Summary.Cell>
                    <Table.Summary.Cell index={4}>{totalTarget.toLocaleString()}</Table.Summary.Cell>
                    <Table.Summary.Cell index={5}>{filtered.reduce((s, r) => s + r.total_input, 0).toLocaleString()}</Table.Summary.Cell>
                    <Table.Summary.Cell index={6}>{totalOutput.toLocaleString()}</Table.Summary.Cell>
                    <Table.Summary.Cell index={7}>{filtered.reduce((s, r) => s + r.defect_material, 0)}</Table.Summary.Cell>
                    <Table.Summary.Cell index={8}>{filtered.reduce((s, r) => s + r.defect_process, 0)}</Table.Summary.Cell>
                    <Table.Summary.Cell index={9}>{filtered.reduce((s, r) => s + r.defect_scrap, 0)}</Table.Summary.Cell>
                    <Table.Summary.Cell index={10}>{totalDefect}</Table.Summary.Cell>
                    <Table.Summary.Cell index={11} colSpan={6}>
                      <span style={{ color: 'var(--text-secondary)' }}>平均良率：{avgYield}%</span>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
          </div>
        </Spin>
      }
    />
  )
}
