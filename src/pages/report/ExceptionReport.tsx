import ResizableTable from '../../components/ResizableTable'
import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { Tag, Button, Select, Input, Space, Row, Col, Progress, DatePicker, Card, Spin, message, Segmented, Alert } from 'antd'
import {
  BellOutlined, ExportOutlined, SearchOutlined, ReloadOutlined,
  ClockCircleOutlined, WarningOutlined, ToolOutlined,
  FallOutlined
} from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import type { FilterItem, StatItem } from '../../components/ThreeSectionPage'
import { formatDateTime } from '../../utils'
import api, { extractList } from '../../utils/api'

const orderStatusNumToText: Record<number, string> = { 0: '开立', 1: '下发', 2: '开工', 3: '完工', 4: '关闭' }
const reportStatusNumToText: Record<number, string> = { 0: '开工', 1: '完工' }
const { RangePicker } = DatePicker

const exceptionTypeMap: Record<string, { name: string; color: string }> = {
  '换型换线': { name: '换型换线', color: '#1890ff' },
  '停机待料': { name: '停机待料', color: '#faad14' },
  '故障维修': { name: '故障维修', color: '#ff4d4f' },
  '其它停机': { name: '其它停机', color: '#8c8c8c' },
  '物料短缺': { name: '物料短缺', color: '#fa8c16' },
  '人员短缺': { name: '人员短缺', color: '#722ed1' },
  '质量异常': { name: '质量异常', color: '#f5222d' },
  '设备故障': { name: '设备故障', color: '#eb2f96' },
  '工艺问题': { name: '工艺问题', color: '#13c2c2' },
}
const DEFAULT_TYPE_COLOR = '#8c8c8c'

const MONTH_QUICK_OPTIONS = [
  { label: '本月', value: 'this_month' },
  { label: '上月', value: 'last_month' },
  { label: '近3个月', value: 'last_3' },
  { label: '近6个月', value: 'last_6' },
  { label: '今年', value: 'this_year' },
  { label: '去年', value: 'last_year' },
]

function getMonthRange(key: string): [Dayjs, Dayjs] | null {
  const now = dayjs()
  switch (key) {
    case 'this_month': return [now.startOf('month'), now.endOf('month')]
    case 'last_month': return [now.subtract(1, 'month').startOf('month'), now.subtract(1, 'month').endOf('month')]
    case 'last_3': return [now.subtract(3, 'month').startOf('month'), now.endOf('month')]
    case 'last_6': return [now.subtract(6, 'month').startOf('month'), now.endOf('month')]
    case 'this_year': return [now.startOf('year'), now.endOf('year')]
    case 'last_year': return [now.subtract(1, 'year').startOf('year'), now.subtract(1, 'year').endOf('year')]
    default: return null
  }
}

function validateRange(range: [Dayjs, Dayjs] | null): { ok: boolean; msg?: string; warn?: boolean } {
  if (!range || !range[0] || !range[1]) return { ok: true }
  const months = range[1].endOf('month').diff(range[0].startOf('month'), 'month') + 1
  if (months > 12) return { ok: false, msg: '查询时间跨度不能超过12个月' }
  if (months > 3) return { ok: true, warn: true }
  return { ok: true }
}

type SummaryMode = 'device' | 'workorder' | 'type'

export default function ExceptionReport() {
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [exceptionRecords, setExceptionRecords] = useState<any[]>([])
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [summaryMode, setSummaryMode] = useState<SummaryMode>('type')

  const thisMonth: [Dayjs, Dayjs] = [dayjs().startOf('month'), dayjs().endOf('month')]
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(thisMonth)
  const [monthQuick, setMonthQuick] = useState<string>('this_month')
  const [rangeWarn, setRangeWarn] = useState(false)

  const loadData = useCallback(async () => {
    if (dateRange) {
      const check = validateRange(dateRange)
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
      const params: any = { pageSize: 500 }
      if (dateRange?.[0]) params.dateStart = dateRange[0].format('YYYY-MM-DD')
      if (dateRange?.[1]) params.dateEnd = dateRange[1].format('YYYY-MM-DD')

      const [excRes, woRes] = await Promise.all([
        api.get('/production/process-exceptions', { params }),
        api.get('/production/report-orders', { params: { pageSize: 200, ...(dateRange ? { dateStart: dateRange[0].format('YYYY-MM-DD'), dateEnd: dateRange[1].format('YYYY-MM-DD') } : {}) } }),
      ])
      if (excRes.success && excRes.data) {
        setExceptionRecords(extractList(excRes.data).map((e: any) => ({
          ...e,
          record_id: e.exception_id,
          work_order_id: e.report_order_id,
          work_order_no: e.report_order_no || '',
          duration: Math.floor(Number(e.duration || 0) * 60),
        })))
      }
      if (woRes.success && woRes.data) {
        setWorkOrders(extractList(woRes.data).map((item: any) => ({
          work_order_id: item.report_order_id,
          work_order_no: item.report_no,
          line_id: item.line_id,
          line_name: item.line_name,
          material_name: item.material_name,
          status: item.order?.status ?? reportStatusNumToText[item.status] ?? '开工',
        })))
      }
    } catch (err: any) {
      message.error(err.message || '加载数据失败')
    } finally {
      setLoading(false)
      setRangeWarn(false)
    }
  }, [dateRange])

  useEffect(() => { loadData() }, [loadData])

  const filtered = exceptionRecords.filter((r: any) => {
    const matchType = !typeFilter || r.exception_type === typeFilter
    const matchSearch = !search || r.work_order_no.toLowerCase().includes(search.toLowerCase()) || (r.device_name && r.device_name.includes(search))
    return matchType && matchSearch
  })

  const totalExceptions = filtered.length
  const totalDuration = Math.floor(filtered.reduce((s: number, r: any) => s + (Number(r.duration) || 0), 0))
  const avgDuration = totalExceptions > 0 ? Math.floor(totalDuration / totalExceptions) : 0

  const typeSummary = useMemo(() => {
    const types = [...new Set(filtered.map((r: any) => r.exception_type).filter(Boolean))]
    return types.map(code => {
      const items = filtered.filter((r: any) => r.exception_type === code)
      const totalDur = Math.floor(items.reduce((s: number, r: any) => s + (Number(r.duration) || 0), 0))
      const avgDur = items.length > 0 ? Math.floor(totalDur / items.length) : 0
      const info = exceptionTypeMap[code] || { name: code, color: DEFAULT_TYPE_COLOR }
      return {
        exception_type: code,
        exception_type_name: info.name,
        color: info.color,
        count: items.length,
        total_duration: totalDur,
        avg_duration: avgDur,
        percentage: totalExceptions > 0 ? ((items.length / totalExceptions) * 100).toFixed(1) : '0.0',
      }
    }).sort((a, b) => b.count - a.count)
  }, [filtered, totalExceptions])

  const workOrderSummary = useMemo(() => {
    return workOrders.map(wo => {
      const exceptions = filtered.filter((r: any) => r.work_order_id === wo.work_order_id)
      const totalDur = Math.floor(exceptions.reduce((s: number, r: any) => s + (Number(r.duration) || 0), 0))
      const types = [...new Set(exceptions.map((r: any) => r.exception_type))]
      return {
        work_order_no: wo.work_order_no,
        line_name: wo.line_name,
        material_name: wo.material_name,
        exception_count: exceptions.length,
        total_duration: totalDur,
        exception_types: types,
        status: wo.status,
      }
    }).filter(w => w.exception_count > 0)
  }, [workOrders, filtered])

  const deviceSummary = useMemo(() => {
    const map = new Map<string, { device_name: string; count: number; total_duration: number; exception_types: string[] }>()
    filtered.forEach((r: any) => {
      const dev = r.device_name || '未指定设备'
      if (!map.has(dev)) {
        map.set(dev, { device_name: dev, count: 0, total_duration: 0, exception_types: [] })
      }
      const entry = map.get(dev)!
      entry.count++
      entry.total_duration += Number(r.duration) || 0
      if (!entry.exception_types.includes(r.exception_type)) {
        entry.exception_types.push(r.exception_type)
      }
    })
    return Array.from(map.values()).map(e => ({
      ...e,
      total_duration: Math.floor(e.total_duration),
      avg_duration: e.count > 0 ? Math.floor(e.total_duration / e.count) : 0,
    })).sort((a, b) => b.count - a.count)
  }, [filtered])

  const stats: StatItem[] = [
    { label: '异常总数', value: totalExceptions, icon: <BellOutlined />, color: '#F44336' },
    { label: '总异常时长', value: `${totalDuration}分钟`, icon: <ClockCircleOutlined />, color: '#FF9800' },
    { label: '平均异常时长', value: `${avgDuration}分钟`, icon: <FallOutlined />, color: '#2196F3' },
    { label: '异常类型数', value: typeSummary.length, icon: <WarningOutlined />, color: '#9C27B0' },
    { label: '受影响工单', value: workOrderSummary.length, icon: <ToolOutlined />, color: '#00BCD4' },
  ]

  const detailColumns = [
    { title: '工单编号', dataIndex: 'work_order_no', key: 'work_order_no', width: 150, fixed: 'left' as const },
    { title: '异常类型', dataIndex: 'exception_type', key: 'exception_type', width: 100, render: (v: string) => {
      const info = exceptionTypeMap[v] || { name: v, color: '#8c8c8c' }
      return <Tag color={info.color}>{info.name}</Tag>
    }},
    { title: '设备', dataIndex: 'device_name', key: 'device_name', width: 130, render: (v: string) => v || '-' },
    { title: '开始时间', dataIndex: 'start_time', key: 'start_time', width: 150, render: (v: any) => formatDateTime(v) },
    { title: '结束时间', dataIndex: 'end_time', key: 'end_time', width: 150, render: (v: any) => formatDateTime(v) },
    {
      title: '持续时长(分钟)', dataIndex: 'duration', key: 'duration', width: 120,
      render: (v: number) => {
        const color = v >= 60 ? '#F44336' : v >= 30 ? '#FF9800' : '#4CAF50'
        return <span style={{ color, fontWeight: 600 }}>{Math.floor(v)}</span>
      }
    },
    { title: '异常描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '记录人', dataIndex: 'record_user_name', key: 'record_user_name', width: 90 },
  ]

  const typeColumns = [
    { title: '异常类型', dataIndex: 'exception_type', key: 'exception_type', width: 100, render: (v: string) => {
      const info = exceptionTypeMap[v] || { name: v, color: '#8c8c8c' }
      return <Tag color={info.color}>{info.name}</Tag>
    }},
    { title: '异常名称', dataIndex: 'exception_type_name', key: 'exception_type_name', width: 120 },
    { title: '发生次数', dataIndex: 'count', key: 'count', width: 100, render: (v: number) => <strong style={{ fontSize: 16 }}>{v}</strong> },
    { title: '总时长(分钟)', dataIndex: 'total_duration', key: 'total_duration', width: 120 },
    { title: '平均时长(分钟)', dataIndex: 'avg_duration', key: 'avg_duration', width: 120 },
    {
      title: '占比', dataIndex: 'percentage', key: 'percentage', width: 150,
      render: (v: string) => <Progress percent={parseFloat(v)} size="small" format={p => `${p}%`} />
    },
  ]

  const woColumns = [
    { title: '工单编号', dataIndex: 'work_order_no', key: 'work_order_no', width: 150 },
    { title: '产线', dataIndex: 'line_name', key: 'line_name', width: 70 },
    { title: '产品名称', dataIndex: 'material_name', key: 'material_name', width: 120 },
    { title: '异常次数', dataIndex: 'exception_count', key: 'exception_count', width: 100, render: (v: number) => <strong style={{ color: v > 2 ? '#F44336' : '#FF9800' }}>{v}</strong> },
    { title: '异常总时长(分钟)', dataIndex: 'total_duration', key: 'total_duration', width: 140 },
    { title: '异常类型', dataIndex: 'exception_types', key: 'exception_types', render: (types: string[]) => types.map((t, i) => <Tag key={i} style={{ marginBottom: 2 }}>{t}</Tag>) },
    { title: '工单状态', dataIndex: 'status', key: 'status', width: 90, render: (v: string) => <Tag>{v}</Tag> },
  ]

  const deviceColumns = [
    { title: '设备名称', dataIndex: 'device_name', key: 'device_name', width: 150 },
    { title: '异常次数', dataIndex: 'count', key: 'count', width: 100, render: (v: number) => <strong style={{ color: v > 5 ? '#F44336' : v > 2 ? '#FF9800' : '#4CAF50' }}>{v}</strong> },
    { title: '总时长(分钟)', dataIndex: 'total_duration', key: 'total_duration', width: 120 },
    { title: '平均时长(分钟)', dataIndex: 'avg_duration', key: 'avg_duration', width: 120 },
    { title: '异常类型', dataIndex: 'exception_types', key: 'exception_types', render: (types: string[]) => types.map((t, i) => <Tag key={i} style={{ marginBottom: 2 }}>{t}</Tag>) },
  ]

  const handleMonthQuick = (val: string) => {
    setMonthQuick(val)
    const range = getMonthRange(val)
    setDateRange(range)
  }

  const handleRangeChange = (val: [Dayjs, Dayjs] | null) => {
    setDateRange(val)
    setMonthQuick('')
  }

  const handleReset = () => {
    setSearch('')
    setTypeFilter(undefined)
    setMonthQuick('this_month')
    setDateRange(thisMonth)
    setRangeWarn(false)
  }

  const renderSummaryContent = () => {
    if (summaryMode === 'type') {
      return (
        <div>
          <Row gutter={12} style={{ marginBottom: 12 }}>
            {typeSummary.map((ts, i) => (
              <Col key={i} span={Math.floor(24 / typeSummary.length) || 6}>
                <Card size="small" style={{ borderRadius: 8, borderLeft: `3px solid ${ts.color}` }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{ts.exception_type_name}</div>
                  <Row gutter={4} style={{ marginTop: 8 }}>
                    <Col span={8}>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>次数</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: ts.color }}>{ts.count}</div>
                    </Col>
                    <Col span={8}>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>总时长</div>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>{ts.total_duration}'</div>
                    </Col>
                    <Col span={8}>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>占比</div>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>{ts.percentage}%</div>
                    </Col>
                  </Row>
                </Card>
              </Col>
            ))}
          </Row>
          <ResizableTable tableKey="pages_report_ExceptionReport_type"
            columns={typeColumns} dataSource={typeSummary} rowKey="exception_type"
            size="small" pagination={false}
          />
        </div>
      )
    }
    if (summaryMode === 'workorder') {
      return (
        <ResizableTable tableKey="pages_report_ExceptionReport_wo"
          columns={woColumns} dataSource={workOrderSummary} rowKey="work_order_no"
          size="small" pagination={{ pageSize: 30, showTotal: t => `共 ${t} 条` }}
        />
      )
    }
    return (
      <ResizableTable tableKey="pages_report_ExceptionReport_device"
        columns={deviceColumns} dataSource={deviceSummary} rowKey="device_name"
        size="small" pagination={{ pageSize: 30, showTotal: t => `共 ${t} 条` }}
      />
    )
  }

  return (
    <ThreeSectionPage
      title="异常分析"
      breadcrumbs="报表中心 / 异常分析"
      stats={stats}
      actions={<Button icon={<ExportOutlined />}>导出Excel</Button>}
      table={
        <Spin spinning={loading} tip="加载中...">
          <div>
            <Row gutter={[12, 8]} style={{ marginBottom: 12 }}>
              <Col span={4}>
                <Input placeholder="搜索工单号/设备名称" allowClear prefix={<SearchOutlined />}
                  value={search} onChange={e => setSearch(e.target.value)} />
              </Col>
              <Col span={4}>
                <Select placeholder="异常类型筛选" allowClear style={{ width: '100%' }}
                  value={typeFilter} onChange={setTypeFilter}
                  options={Object.entries(exceptionTypeMap).map(([code, info]) => ({
                    label: info.name, value: code,
                  }))} />
              </Col>
              <Col span={4}>
                <Select placeholder="快速选择月份" allowClear style={{ width: '100%' }}
                  value={monthQuick || undefined} onChange={handleMonthQuick}
                  options={MONTH_QUICK_OPTIONS} />
              </Col>
              <Col span={6}>
                <RangePicker style={{ width: '100%' }} value={dateRange} onChange={handleRangeChange} />
              </Col>
              <Col>
                <Space>
                  <Button type="primary" icon={<SearchOutlined />} onClick={loadData}>查询</Button>
                  <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
                </Space>
              </Col>
            </Row>

            {rangeWarn && (
              <Alert type="warning" showIcon style={{ marginBottom: 12 }}
                message="查询跨度时间较长，后台需要较长时间执行查询，可能造成页面假死状态" />
            )}

            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 700, marginRight: 12 }}>汇总方式</span>
              <Segmented
                value={summaryMode}
                onChange={v => setSummaryMode(v as SummaryMode)}
                options={[
                  { label: '异常类型汇总', value: 'type' },
                  { label: '按工单汇总', value: 'workorder' },
                  { label: '按设备汇总', value: 'device' },
                ]}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>汇总结果</div>
              {renderSummaryContent()}
            </div>

            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>异常明细</div>
              <ResizableTable tableKey="pages_report_ExceptionReport"
                columns={detailColumns} dataSource={filtered} rowKey="record_id"
                size="small" scroll={{ x: 1200 }}
                pagination={{ pageSize: 30, showTotal: t => `共 ${t} 条` }}
              />
            </div>
          </div>
        </Spin>
      }
    />
  )
}
