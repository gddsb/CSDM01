import ResizableTable from '../../components/ResizableTable'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Tag, Button, Select, DatePicker, Space, Input, Drawer, Descriptions, Typography, Alert, message, Checkbox } from 'antd'
import {
  ExperimentOutlined, SafetyCertificateOutlined, WarningOutlined,
  CheckCircleOutlined, SearchOutlined, ReloadOutlined
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import { formatDateTime } from '../../utils'
import api from '../../utils/api'
import { MONTH_QUICK_OPTIONS, getMonthRange, validateRange } from '../../utils/monthQuick'

const { RangePicker } = DatePicker
const { Title } = Typography

const resultColor = { '合格': 'success', '不合格': 'error' } as Record<string, string>
const typeColor = { '正常': 'success', '加严': 'warning', '复检': 'processing' } as Record<string, string>
const objectColor = { '成品检验': 'blue', '来料检验': 'cyan' } as Record<string, string>
const statusColor = { '待检': 'default', '检验中': 'processing', '审核中': 'warning', '已完成': 'success', '已关闭': 'default' } as Record<string, string>
const handleColor = { '入库': 'green', '判退': 'red', '报废': 'red', '让步接收': 'orange' } as Record<string, string>

const STATUS_MAP: Record<number, string> = { 0: '待检', 1: '检验中', 2: '审核中', 3: '已完成', 4: '已关闭' }

const INSPECTION_TYPES = [
  { label: '正常', value: '正常' },
  { label: '加严', value: '加严' },
  { label: '复检', value: '复检' },
]

const OBJECT_TYPES = [
  { label: '成品检验', value: '成品检验' },
  { label: '来料检验', value: '来料检验' },
]

const RESULT_OPTIONS = [
  { label: '合格', value: '合格' },
  { label: '不合格', value: '不合格' },
]

const STATUS_OPTIONS = [
  { label: '待检', value: '待检' },
  { label: '检验中', value: '检验中' },
  { label: '审核中', value: '审核中' },
  { label: '已完成', value: '已完成' },
  { label: '已关闭', value: '已关闭' },
]
const DEFAULT_STATUS = ['待检', '检验中', '审核中']

export default function MicrobeInspection() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [current, setCurrent] = useState<any>(null)
  const [detailItems, setDetailItems] = useState<any[]>([])

  const [inspectionNo, setInspectionNo] = useState<any>(undefined)
  const [inspectionType, setInspectionType] = useState<any>(undefined)
  const [objectType, setObjectType] = useState<any>(undefined)
  const [resultFilter, setResultFilter] = useState<any>(undefined)
  const [statusFilter, setStatusFilter] = useState<string[]>([...DEFAULT_STATUS])
  const [dateRange, setDateRange] = useState<any>(null)
  const [monthQuick, setMonthQuick] = useState<string>('')
  const [rangeWarn, setRangeWarn] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    if (dateRange) {
      const check = validateRange(dateRange)
      if (!check.ok) {
        message.warning(check.msg)
        setLoading(false)
        return
      }
      setRangeWarn(!!check.warn)
    } else {
      setRangeWarn(false)
    }
    try {
      const params: any = { page: pagination.current, page_size: pagination.pageSize }
      if (inspectionNo) params.inspection_no = inspectionNo
      if (inspectionType) params.inspection_type = inspectionType
      if (objectType) params.object_type = objectType
      if (resultFilter) params.result = resultFilter
      if (statusFilter && statusFilter.length > 0) params.status = statusFilter.join(',')
      if (dateRange && dateRange[0]) params.start_date = dateRange[0].format('YYYY-MM-DD')
      if (dateRange && dateRange[1]) params.end_date = dateRange[1].format('YYYY-MM-DD')

      const res = await api.get('/basic/microbe-inspections', { params })
      if (res.success !== false) {
        setData(res.data?.list || res.data || [])
        setPagination(p => ({ ...p, total: res.data?.total || res.total || 0 }))
      } else {
        setData([])
        setPagination(p => ({ ...p, total: 0 }))
      }
    } catch (e) {
      setData([])
      setPagination(p => ({ ...p, total: 0 }))
    } finally {
      setLoading(false)
      setRangeWarn(false)
    }
  }, [pagination.current, pagination.pageSize, inspectionNo, inspectionType, objectType, resultFilter, statusFilter, dateRange])

  useEffect(() => { fetchData() }, [fetchData])

  const stats = useMemo(() => {
    return [
      { label: '总检验数', value: data.length, icon: <ExperimentOutlined />, color: '#2196F3' },
      { label: '成品检验', value: data.filter(i => i.object_type === '成品检验').length, icon: <SafetyCertificateOutlined />, color: '#4CAF50' },
      { label: '来料检验', value: data.filter(i => i.object_type === '来料检验').length, icon: <WarningOutlined />, color: '#FF9800' },
      { label: '合格率', value: data.length > 0 ? `${Math.round((data.filter(i => i.result === '合格').length / data.length) * 100)}%` : '0%', icon: <CheckCircleOutlined />, color: '#00BCD4' },
    ]
  }, [data])

  const getStatusText = (s: any) => {
    if (typeof s === 'number') return STATUS_MAP[s] || String(s)
    return s
  }

  const getRelatedNo = (record: any) => {
    if (record.report_order_no) return record.report_order_no
    if (record.incoming_no) return record.incoming_no
    return record.order_no || '-'
  }

  const showDetail = async (record: any) => {
    setCurrent(record)
    setDetailItems([])
    setDrawerOpen(true)
    try {
      const res = await api.get(`/basic/microbe-inspections/${record.inspection_id}`)
      if (res.success !== false && res.data) {
        setCurrent(res.data)
        const items = res.data.items || []
        setDetailItems(items.map((it: any) => {
          const r = it.result
          let judge = '待检'
          if (r === 1 || r === '1' || r === '合格') judge = '合格'
          else if (r === 0 || r === '0' || r === '不合格') judge = '不合格'
          return { ...it, judge }
        }))
      }
    } catch (e) {
      // ignore
    }
  }

  const handleReset = () => {
    setInspectionNo(undefined)
    setInspectionType(undefined)
    setObjectType(undefined)
    setResultFilter(undefined)
    setStatusFilter([...DEFAULT_STATUS])
    setMonthQuick(''); setDateRange(null)
  }

  const handleMonthQuick = (v: string) => {
    setMonthQuick(v)
    const range = getMonthRange(v)
    setDateRange(range)
  }
  const handleRangeChange = (v: any) => {
    setMonthQuick(undefined)
    setDateRange(v)
  }

  const columns = [
    { title: '检验编号', dataIndex: 'inspection_no', key: 'inspection_no', width: 150, fixed: 'left' as const },
    {
      title: '检验类型', dataIndex: 'inspection_type', key: 'inspection_type', width: 90,
      render: (v: string) => <Tag color={typeColor[v] || 'default'}>{v}</Tag>
    },
    {
      title: '检验对象', dataIndex: 'object_type', key: 'object_type', width: 100,
      render: (v: string) => <Tag color={objectColor[v] || 'default'}>{v}</Tag>
    },
    {
      title: '关联单号', key: 'related_no', width: 170,
      render: (_: any, record: any) => getRelatedNo(record)
    },
    { title: '料品名称', dataIndex: 'material_name', key: 'material_name', width: 160, ellipsis: true },
    {
      title: '检验结果', dataIndex: 'result', key: 'result', width: 90,
      render: (v: string) => v ? <Tag color={resultColor[v]}>{v}</Tag> : <Tag>待检</Tag>
    },
    { title: '检验人', dataIndex: 'inspector_name', key: 'inspector_name', width: 100 },
    { title: '检验时间', dataIndex: 'inspection_time', key: 'inspection_time', width: 160, render: formatDateTime },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (v: any) => <Tag color={statusColor[getStatusText(v)] || 'default'}>{getStatusText(v)}</Tag>
    },
    {
      title: '操作', key: 'action', fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Button type="link" size="small" onClick={() => showDetail(record)}>查看详情</Button>
      )
    },
  ]

  const detailColumns = [
    { title: '检验项目', dataIndex: 'item_name', key: 'item_name' },
    { title: '标准要求', dataIndex: 'standard_value', key: 'standard_value' },
    { title: '实测值', dataIndex: 'actual_value', key: 'actual_value' },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 80 },
    {
      title: '判定', dataIndex: 'judge', key: 'judge', width: 90,
      render: (v: string) => <Tag color={v === '合格' ? 'success' : v === '不合格' ? 'error' : 'default'}>{v}</Tag>
    },
  ]

  const filterNode = (
    <Space wrap style={{ width: '100%' }} size={[8, 8]} align="center">
      <Input
        placeholder="检验编号"
        allowClear
        prefix={<SearchOutlined />}
        style={{ width: 150 }}
        value={inspectionNo}
        onChange={(e) => setInspectionNo(e.target.value || undefined)}
      />
      <Select
        placeholder="检验类型"
        allowClear
        style={{ width: 110 }}
        options={INSPECTION_TYPES}
        value={inspectionType}
        onChange={setInspectionType}
      />
      <Select
        placeholder="检验对象"
        allowClear
        style={{ width: 110 }}
        options={OBJECT_TYPES}
        value={objectType}
        onChange={setObjectType}
      />
      <Select
        placeholder="检验结果"
        allowClear
        style={{ width: 110 }}
        options={RESULT_OPTIONS}
        value={resultFilter}
        onChange={setResultFilter}
      />
      <div style={{ display: 'inline-flex', alignItems: 'center' }}>
        <span style={{ color: '#888', fontSize: 13, marginRight: 6, whiteSpace: 'nowrap' }}>状态：</span>
        <Checkbox.Group
          value={statusFilter}
          onChange={v => setStatusFilter(v as string[])}
          style={{ display: 'inline-flex', gap: 8, whiteSpace: 'nowrap' }}
          options={STATUS_OPTIONS.map(o => o.value)}
        />
      </div>
      <Select
        placeholder="快速时间"
        allowClear
        style={{ width: 130 }}
        value={monthQuick || undefined}
        onChange={handleMonthQuick}
        options={MONTH_QUICK_OPTIONS}
      />
      <RangePicker
        style={{ width: 240 }}
        value={dateRange}
        onChange={handleRangeChange}
      />
      <Button type="primary" icon={<SearchOutlined />} onClick={fetchData}>查询</Button>
      <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
    </Space>
  )

  return (
    <>
      <ThreeSectionPage
        title="微生物检验"
        breadcrumbs="质量管理 / 微生物检验"
        stats={stats}
        filter={filterNode}
        actions={<ActionButtons />}
        table={
          <div>
            {rangeWarn && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message="查询跨度时间较长，后台需要较长时间执行查询，可能造成页面假死状态"
              />
            )}
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message="不合格处理流程：正常检验 → 不合格 → 加严检验(样本翻倍) → 仍不合格 → 判退/报废"
            />
            <ResizableTable tableKey="pages_quality_MicrobeInspection"
              columns={columns}
              dataSource={data}
              rowKey="inspection_id"
              loading={loading}
              size="small"
              scroll={{ x: 1300 }}
              pagination={{
                current: pagination.current,
                pageSize: pagination.pageSize,
                total: pagination.total,
                showSizeChanger: true,
                showTotal: (t: number) => `共 ${t} 条`,
                onChange: (page: number, pageSize: number) => setPagination(p => ({ ...p, current: page, pageSize })),
              }}
            />
          </div>
        }
      />
      <Drawer
        title="微生物检验详情"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={820}
        destroyOnHidden
      >
        {current && (
          <>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="检验编号">{current.inspection_no}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColor[getStatusText(current.status)] || 'default'}>{getStatusText(current.status)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="检验类型">
                <Tag color={typeColor[current.inspection_type] || 'default'}>{current.inspection_type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="检验对象">
                <Tag color={objectColor[current.object_type] || 'default'}>{current.object_type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="关联单号" span={2}>{getRelatedNo(current)}</Descriptions.Item>
              <Descriptions.Item label="料品名称">{current.material_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="规格型号">{current.specification || '-'}</Descriptions.Item>
              <Descriptions.Item label="检验人">{current.inspector_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="检验时间">{formatDateTime(current.inspection_time)}</Descriptions.Item>
              <Descriptions.Item label="检验结果">
                {current.result ? <Tag color={resultColor[current.result]}>{current.result}</Tag> : <Tag>待检</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="处理方式">
                {current.handle_type ? <Tag color={handleColor[current.handle_type] || 'default'}>{current.handle_type}</Tag> : '-'}
              </Descriptions.Item>
            </Descriptions>
            <Title level={5}>检验结果明细</Title>
            <ResizableTable tableKey="pages_quality_MicrobeInspection_detail"
              columns={detailColumns}
              dataSource={detailItems}
              rowKey={(r: any, i: number) => r.item_id || i}
              size="small"
              pagination={false}
            />
          </>
        )}
      </Drawer>
    </>
  )
}
