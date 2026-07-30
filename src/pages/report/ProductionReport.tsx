import ResizableTable from '../../components/ResizableTable'
import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { Table, Tag, Button, Select, Input, Space, Row, Col, Progress, DatePicker, Spin, message, Modal, Tabs, Alert } from 'antd'
import {
  FileTextOutlined, ExportOutlined, SearchOutlined, ReloadOutlined,
  CheckCircleOutlined, WarningOutlined,
  RiseOutlined, FallOutlined
} from '@ant-design/icons'
import * as XLSX from 'xlsx'
import dayjs, { Dayjs } from 'dayjs'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import { formatDateTime, MONTH_QUICK_OPTIONS, getMonthRange, validateDateRange } from '../../utils'
import api, { extractList } from '../../utils/api'

const woStatusNumToText: Record<number, string> = { 0: '开工', 1: '完工', 2: '关闭' }

const { RangePicker } = DatePicker

const statusColorMap = {
  '开立': 'default',
  '开工': 'processing',
  '关闭': 'warning',
  '完工': 'success',
}

const calcReportOrderStats = (detail: any) => {
  const processes = detail.report_processes || []
  const materials = detail.process_materials || []
  const defects = detail.process_defects || []

  const scrapDefects = defects.filter((d: any) => d.process_id == null)
  const allScrapQty = scrapDefects.reduce((s: number, d: any) => s + Number(d.quantity || 0), 0)

  const sortedProcesses = [...processes].sort((a: any, b: any) =>
    (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0)
  )

  const processStats: any[] = []
  let prevOutputQty = 0
  let allIncomingQty = 0
  let allProcessQty = 0
  let allDefectQty = 0

  sortedProcesses.forEach((p: any, idx: number) => {
    const procMaterials = materials.filter((m: any) => m.process_id === p.process_id)
    const investQty = procMaterials
      .filter((m: any) => m.material_type === '投入')
      .reduce((sum: number, m: any) => sum + Number(m.quantity || 0), 0)
    const returnQty = procMaterials
      .filter((m: any) => m.material_type === '退回')
      .reduce((sum: number, m: any) => sum + Number(m.quantity || 0), 0)

    const procDefects = defects.filter((d: any) => d.process_id === p.process_id)
    let incomingQty = 0
    let processQty = 0
    let totalDefectQty = 0
    procDefects.forEach((d: any) => {
      const dt = d.defect_type?.defect_type || '其他'
      const qty = Number(d.quantity) || 0
      if (dt === '来料不良') incomingQty += qty
      else if (dt === '制程不良') processQty += qty
      totalDefectQty += qty
    })

    const hasReport = investQty > 0 || returnQty > 0 || totalDefectQty > 0
    let inputQty: number
    let outputQty: number

    if (idx === 0) {
      inputQty = investQty - returnQty
    } else {
      inputQty = prevOutputQty
    }

    if (!hasReport) {
      outputQty = inputQty
    } else {
      outputQty = Math.max(0, inputQty - totalDefectQty)
    }

    allIncomingQty += incomingQty
    allProcessQty += processQty
    allDefectQty += totalDefectQty

    processStats.push({
      ...p,
      inputQty,
      outputQty,
      incomingQty,
      processQty,
      totalDefectQty,
    })

    prevOutputQty = outputQty
  })

  const allInputQty = processStats[0]?.inputQty || 0
  const allOutputQty = processStats.length > 0 ? processStats[processStats.length - 1].outputQty : 0

  return {
    processStats,
    allInputQty,
    allOutputQty,
    allIncomingQty,
    allProcessQty,
    allDefectQty,
    allScrapQty,
  }
}

export default function ProductionReport() {
  const [lineFilter, setLineFilter] = useState<number | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [detailMap, setDetailMap] = useState<Record<number, any>>({})
  const [productionLines, setProductionLines] = useState<any[]>([])

  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedDetail, setSelectedDetail] = useState<any>(null)

  const thisMonth: [Dayjs, Dayjs] = [dayjs().startOf('month'), dayjs().endOf('month')]
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(thisMonth)
  const [monthQuick, setMonthQuick] = useState<string>('this_month')
  const [rangeWarn, setRangeWarn] = useState(false)

  const loadData = useCallback(async () => {
    if (dateRange) {
      const check = validateDateRange(dateRange)
      if (!check.ok) {
        message.warning(check.msg)
        return
      }
      setRangeWarn(!!check.warn)
    } else {
      setRangeWarn(false)
    }

    setLoading(true)
    try {
      const params: any = { pageSize: 200, sort: 'report_time,desc' }
      if (dateRange?.[0]) params.dateStart = dateRange[0].format('YYYY-MM-DD')
      if (dateRange?.[1]) params.dateEnd = dateRange[1].format('YYYY-MM-DD')

      const [woRes, lineRes] = await Promise.all([
        api.get('/production/report-orders', { params }),
        api.get('/basic/production-lines'),
      ])

      if (lineRes.success && lineRes.data) {
        setProductionLines(extractList(lineRes.data))
      }

      if (woRes.success && woRes.data) {
        const list = extractList(woRes.data)
        const detailPromises = list.map(async (item: any) => {
          try {
            const res = await api.get(`/production/report-orders/${item.report_order_id}`)
            return { id: item.report_order_id, detail: res.data }
          } catch {
            return { id: item.report_order_id, detail: null }
          }
        })
        const results = await Promise.all(detailPromises)
        const newDetailMap: Record<number, any> = {}
        results.forEach((r: any) => {
          if (r.detail) newDetailMap[r.id] = r.detail
        })
        setDetailMap(newDetailMap)

        setWorkOrders(list.map((item: any) => ({
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
          report_user_name: item.report_user_name,
        })))
      }
    } catch (err: any) {
      message.error(err.message || '加载数据失败')
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => { loadData() }, [loadData])

  const reportData = useMemo(() => {
    return workOrders.map(wo => {
      const detail = detailMap[wo.work_order_id]
      let totalDefectMaterial = 0
      let totalDefectProcess = 0
      let totalDefectScrap = 0
      let totalInput = 0
      let totalOutput = Number(wo.actual_output_qty || 0)
      let processCount = 0

      if (detail) {
        const stats = calcReportOrderStats(detail)
        totalDefectMaterial = stats.allIncomingQty
        totalDefectProcess = stats.allProcessQty
        totalDefectScrap = stats.allScrapQty
        totalInput = stats.allInputQty
        totalOutput = stats.allOutputQty
        processCount = stats.processStats.length
      } else {
        totalOutput = Number(wo.actual_output_qty || 0)
      }

      const totalDefect = totalDefectMaterial + totalDefectProcess + totalDefectScrap
      if (!detail) totalInput = totalOutput + totalDefect

      const yieldRate = totalInput > 0 ? ((totalOutput / totalInput) * 100).toFixed(1) : '0.0'
      const completionRate = wo.target_qty > 0 ? ((totalOutput / wo.target_qty) * 100).toFixed(1) : '0.0'

      return {
        ...wo,
        process_count: processCount,
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
  }, [workOrders, detailMap])

  const filtered = reportData.filter((r: any) => {
    const matchLine = !lineFilter || r.line_id === lineFilter
    const matchStatus = !statusFilter || r.status === statusFilter
    const matchSearch = !search || r.work_order_no.toLowerCase().includes(search.toLowerCase()) || r.material_name.includes(search)
    return matchLine && matchStatus && matchSearch
  })

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

  const handleRowDoubleClick = (record: any) => {
    const detail = detailMap[record.work_order_id]
    if (detail) {
      setSelectedDetail(detail)
      setDetailModalOpen(true)
    } else {
      message.info('该工单暂无详细数据')
    }
  }

  const handleExport = () => {
    if (filtered.length === 0) {
      message.warning('没有可导出的数据')
      return
    }
    const exportData = filtered.map(r => ({
      '工单编号': r.work_order_no,
      '订单编号': r.order_no,
      '产线': r.line_name,
      '产品名称': r.material_name,
      '目标数量': r.target_qty,
      '投入数量': r.total_input,
      '产出数量': r.total_output,
      '来料不良': r.defect_material,
      '制程不良': r.defect_process,
      '报废数': r.defect_scrap,
      '不良合计': r.total_defect,
      '良率(%)': r.yield_rate,
      '完成率(%)': r.completion_rate,
      '报工工序数': r.process_count,
      '工单状态': r.status,
      '报工人': r.report_user_name,
      '开工时间': r.start_time ? formatDateTime(r.start_time) : '',
      '完工时间': r.finish_time ? formatDateTime(r.finish_time) : '',
    }))
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '生产报表')
    XLSX.writeFile(wb, `生产报表_${new Date().toISOString().slice(0, 10)}.xlsx`)
    message.success('导出成功')
  }

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
    { title: '报工人', dataIndex: 'report_user_name', key: 'report_user_name', width: 80 },
    { title: '开工时间', dataIndex: 'start_time', key: 'start_time', width: 150, render: v => formatDateTime(v) },
    { title: '完工时间', dataIndex: 'finish_time', key: 'finish_time', width: 150, render: v => v ? formatDateTime(v) : '-' },
  ]

  const renderDetailModal = () => {
    if (!selectedDetail) return null
    const stats = calcReportOrderStats(selectedDetail)
    const exceptions = selectedDetail.process_exceptions || []
    const manpowerRecords = selectedDetail.manpower_records || []
    const materials = selectedDetail.process_materials || []
    const defects = selectedDetail.process_defects || []

    return (
      <Tabs
        size="small"
        items={[
          {
            key: 'process',
            label: `报工工序 (${stats.processStats.length})`,
            children: (
              <Table
                size="small"
                dataSource={stats.processStats}
                rowKey="process_id"
                pagination={false}
                scroll={{ x: 800 }}
                columns={[
                  { title: '工序编码', dataIndex: 'process_code', width: 80 },
                  { title: '工序名称', dataIndex: 'process_name', width: 100 },
                  { title: '投入', dataIndex: 'inputQty', width: 70, align: 'right', render: (v: any) => (v || 0).toLocaleString() },
                  { title: '产出', dataIndex: 'outputQty', width: 70, align: 'right', render: (v: any) => (v || 0).toLocaleString() },
                  { title: '来料不良', dataIndex: 'incomingQty', width: 80, align: 'right', render: (v: any) => v > 0 ? <span style={{ color: '#ff9800' }}>{v}</span> : '-' },
                  { title: '制程不良', dataIndex: 'processQty', width: 80, align: 'right', render: (v: any) => v > 0 ? <span style={{ color: '#f44336' }}>{v}</span> : '-' },
                  { title: '不良合计', dataIndex: 'totalDefectQty', width: 80, align: 'right', render: (v: any) => v > 0 ? <strong style={{ color: '#f44336' }}>{v}</strong> : '-' },
                ]}
              />
            ),
          },
          {
            key: 'material',
            label: `物料记录 (${materials.length})`,
            children: (
              <Table
                size="small"
                dataSource={materials}
                rowKey="material_record_id"
                pagination={false}
                scroll={{ x: 800 }}
                columns={[
                  { title: '工序', dataIndex: 'process_id', width: 60, render: (v: any, r: any) => r.process_name || v || '首道' },
                  { title: '物料类型', dataIndex: 'material_type', width: 80, render: (v: any) => <Tag color={v === '投入' ? 'blue' : v === '退回' ? 'orange' : 'default'}>{v}</Tag> },
                  { title: '物料编码', dataIndex: 'material_code', width: 120 },
                  { title: '物料名称', dataIndex: 'material_name', width: 180 },
                  { title: '数量', dataIndex: 'quantity', width: 80, align: 'right', render: (v: any) => Number(v || 0).toLocaleString() },
                  { title: '单位', dataIndex: 'unit_name', width: 60 },
                  { title: '批次号', dataIndex: 'batch_no', width: 120, render: v => v || '-' },
                ]}
              />
            ),
          },
          {
            key: 'defect',
            label: `不良记录 (${defects.length})`,
            children: (
              <Table
                size="small"
                dataSource={defects}
                rowKey="defect_record_id"
                pagination={false}
                scroll={{ x: 800 }}
                columns={[
                  { title: '工序', dataIndex: 'process_id', width: 80, render: (v: any, r: any) => r.process_name || (v == null ? '检验报废' : v) },
                  { title: '不良类型', dataIndex: 'defect_type', width: 100, render: (v: any) => v?.defect_type || '-' },
                  { title: '不良名称', dataIndex: 'defect_type', width: 150, render: (v: any) => v?.defect_name || '-' },
                  { title: '数量', dataIndex: 'quantity', width: 70, align: 'right', render: (v: any) => <strong style={{ color: '#f44336' }}>{Number(v || 0)}</strong> },
                  { title: '设备', dataIndex: 'device_name', width: 100, render: v => v || '-' },
                  { title: '责任工序', dataIndex: 'responsible_process_name', width: 100, render: v => v || '-' },
                  { title: '描述', dataIndex: 'description', width: 200, render: v => v || '-' },
                ]}
              />
            ),
          },
          {
            key: 'manpower',
            label: `人员工时 (${manpowerRecords.length})`,
            children: (
              <Table
                size="small"
                dataSource={manpowerRecords}
                rowKey="record_id"
                pagination={false}
                scroll={{ x: 800 }}
                columns={[
                  { title: '记录日期', dataIndex: 'record_date', width: 100 },
                  { title: '班次', dataIndex: 'shift', width: 70 },
                  { title: '开始时间', dataIndex: 'start_time', width: 150, render: formatDateTime },
                  { title: '结束时间', dataIndex: 'end_time', width: 150, render: (v: any) => v ? formatDateTime(v) : '-' },
                  { title: '工时', dataIndex: 'hours', width: 70, align: 'right', render: (v: any) => `${Number(v || 0).toFixed(2)}h` },
                  { title: '熟手', dataIndex: 'skilled_count', width: 60, align: 'right', render: (v: any) => v || 0 },
                  { title: '普工', dataIndex: 'general_count', width: 60, align: 'right', render: (v: any) => v || 0 },
                  { title: '劳务', dataIndex: 'labor_count', width: 60, align: 'right', render: (v: any) => v || 0 },
                  { title: '总人数', dataIndex: 'total_people', width: 70, align: 'right', render: (v: any) => <strong>{v || 0}</strong> },
                  { title: '人时', dataIndex: 'man_hours', width: 80, align: 'right', render: (v: any) => <span style={{ color: '#1890ff', fontWeight: 600 }}>{Number(v || 0).toFixed(2)}h</span> },
                ]}
              />
            ),
          },
          {
            key: 'exception',
            label: `异常工时 (${exceptions.length})`,
            children: (
              <Table
                size="small"
                dataSource={exceptions}
                rowKey="exception_id"
                pagination={false}
                scroll={{ x: 800 }}
                columns={[
                  { title: '异常类型', dataIndex: 'exception_type', width: 100 },
                  { title: '停机类型', dataIndex: 'stop_type', width: 100 },
                  { title: '设备', dataIndex: 'device_name', width: 100, render: v => v || '-' },
                  { title: '开始时间', dataIndex: 'start_time', width: 150, render: formatDateTime },
                  { title: '恢复时间', dataIndex: 'end_time', width: 150, render: (v: any) => v ? formatDateTime(v) : '-' },
                  { title: '持续时长', dataIndex: 'duration', width: 90, align: 'right', render: (v: any) => <span style={{ color: '#faad14', fontWeight: 600 }}>{Number(v || 0).toFixed(2)}h</span> },
                  { title: '确认人', dataIndex: 'confirm_user_name', width: 80, render: v => v || '-' },
                  { title: '异常描述', dataIndex: 'description', width: 250, render: v => v || '-' },
                ]}
              />
            ),
          },
        ]}
      />
    )
  }

  return (
    <>
      <ThreeSectionPage
        title="生产报表"
        breadcrumbs="报表中心 / 生产报表"
        stats={stats}
        actions={<Button icon={<ExportOutlined />} onClick={handleExport}>导出Excel</Button>}
        table={
          <Spin spinning={loading} tip="加载中...">
            <div>
              <Row gutter={[12, 8]} style={{ marginBottom: 12 }}>
                <Col span={5}>
                  <Input
                    placeholder="搜索工单号/产品名称"
                    allowClear
                    prefix={<SearchOutlined />}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </Col>
                <Col span={4}>
                  <Select
                    placeholder="产线筛选"
                    allowClear
                    style={{ width: '100%' }}
                    options={productionLines.map(l => ({ label: l.line_name, value: l.line_id }))}
                    value={lineFilter}
                    onChange={setLineFilter}
                  />
                </Col>
                <Col span={4}>
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
                <Col span={4}>
                  <Select
                    placeholder="快速选择月份"
                    allowClear
                    style={{ width: '100%' }}
                    value={monthQuick || undefined}
                    onChange={val => {
                      setMonthQuick(val)
                      const range = getMonthRange(val)
                      if (range) setDateRange(range)
                    }}
                    options={MONTH_QUICK_OPTIONS}
                  />
                </Col>
                <Col span={5}>
                  <RangePicker
                    style={{ width: '100%' }}
                    value={dateRange}
                    onChange={val => { setDateRange(val as any); setMonthQuick('') }}
                  />
                </Col>
                <Col>
                  <Space>
                    <Button type="primary" icon={<SearchOutlined />} onClick={loadData}>查询</Button>
                    <Button icon={<ReloadOutlined />} onClick={() => {
                      setSearch(''); setLineFilter(undefined); setStatusFilter(undefined)
                      setMonthQuick('this_month'); setDateRange(thisMonth); setRangeWarn(false)
                    }}>重置</Button>
                  </Space>
                </Col>
              </Row>

              {rangeWarn && (
                <Alert type="warning" showIcon style={{ marginBottom: 12 }}
                  message="查询跨度时间较长，后台需要较长时间执行查询，可能造成页面假死状态" />
              )}
              <ResizableTable tableKey="pages_report_ProductionReport"
                columns={columns}
                dataSource={filtered}
                rowKey="work_order_id"
                size="small"
                scroll={{ x: 1900 }}
                pagination={{ pageSize: 20, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
                onRow={(record: any) => ({
                  onDoubleClick: () => handleRowDoubleClick(record),
                  style: { cursor: 'pointer' },
                })}
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
              <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                提示：双击任意行可查看工单详细数据
              </div>
            </div>
          </Spin>
        }
      />
      <Modal
        title={selectedDetail ? `工单详情 - ${selectedDetail.report_no}` : '工单详情'}
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>关闭</Button>,
        ]}
        width={1100}
      >
        {renderDetailModal()}
      </Modal>
    </>
  )
}
