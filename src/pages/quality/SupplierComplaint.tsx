import ResizableTable from '../../components/ResizableTable'
import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { Table, Tag, Button, Typography, Alert, Steps, Select, DatePicker, Input, message } from 'antd'
import {
  WarningOutlined, SendOutlined, MessageOutlined, CheckCircleOutlined,
  FilePdfOutlined, SearchOutlined
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import type { FilterItem, StatItem } from '../../components/ThreeSectionPage'
import { supplierComplaints, incomingInspections } from '../../mock/data'
import { MONTH_QUICK_OPTIONS, getMonthRange, validateRange, getThisMonth } from '../../utils/monthQuick'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker
const { Text } = Typography

const statusColor: Record<string, string> = { '已创建': 'default', '已发出': 'processing', '已回复': 'warning', '已关闭': 'success' }
const statusOrder = ['已创建', '已发出', '已回复', '已关闭']

export default function SupplierComplaint() {
  const [complaintNo, setComplaintNo] = useState<any>(undefined)
  const [supplierFilter, setSupplierFilter] = useState<any>(undefined)
  const [statusFilter, setStatusFilter] = useState<any>(undefined)
  const [dateRange, setDateRange] = useState<any>(getThisMonth())
  const [monthQuick, setMonthQuick] = useState<string>('this_month')
  const [rangeWarn, setRangeWarn] = useState(false)

  const fetchData = useCallback(() => {
    if (dateRange) {
      const check = validateRange(dateRange)
      if (!check.ok) {
        message.warning(check.msg)
        return
      }
      setRangeWarn(check.warn || false)
    } else {
      setRangeWarn(false)
    }
  }, [dateRange])

  useEffect(() => { fetchData() }, [fetchData])

  const filteredData = useMemo(() => {
    return supplierComplaints.filter((r: any) => {
      if (complaintNo && !r.complaint_no?.includes(complaintNo)) return false
      if (supplierFilter && !r.supplier_name?.includes(supplierFilter)) return false
      if (statusFilter && r.status !== statusFilter) return false
      if (dateRange && dateRange[0] && dateRange[1] && r.complaint_date) {
        const t = dayjs(r.complaint_date)
        if (!t.isAfter(dateRange[0].subtract(1, 'day')) || !t.isBefore(dateRange[1].add(1, 'day'))) {
          return false
        }
      }
      return true
    })
  }, [complaintNo, supplierFilter, statusFilter, dateRange])

  const sentCount = filteredData.filter((s: any) => s.status === '已发出').length
  const repliedCount = filteredData.filter((s: any) => s.status === '已回复').length
  const closedCount = filteredData.filter((s: any) => s.status === '已关闭').length

  const stats: StatItem[] = [
    { label: '总投诉数', value: filteredData.length, icon: <WarningOutlined />, color: '#2196F3' },
    { label: '已发出', value: sentCount, icon: <SendOutlined />, color: '#FF9800' },
    { label: '已回复', value: repliedCount, icon: <MessageOutlined />, color: '#00BCD4' },
    { label: '已关闭', value: closedCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
  ]

  const handleMonthQuick = (v: string) => {
    setMonthQuick(v)
    const range = getMonthRange(v)
    setDateRange(range)
  }
  const handleRangeChange = (v: any) => {
    setMonthQuick(undefined)
    setDateRange(v)
  }

  const handleReset = () => {
    setComplaintNo(undefined)
    setSupplierFilter(undefined)
    setStatusFilter(undefined)
    setMonthQuick('this_month')
    setDateRange(getThisMonth())
  }

  const getRelatedInspectionNo = (record: any) => {
    if (!record.related_inspection_id) return '-'
    const inc = incomingInspections.find((i: any) => i.inspection_id === record.related_inspection_id)
    return inc ? inc.inspection_no : '-'
  }

  const getCurrentStep = (status: string) => {
    const idx = statusOrder.indexOf(status)
    return idx === -1 ? 0 : idx
  }

  const columns = [
    { title: '投诉编号', dataIndex: 'complaint_no', key: 'complaint_no', width: 140, fixed: 'left' as const },
    { title: '供应商', dataIndex: 'supplier_name', key: 'supplier_name', width: 120 },
    { title: '投诉类型', dataIndex: 'complaint_type', key: 'complaint_type', width: 110 },
    { title: '投诉原因', dataIndex: 'complaint_reason', key: 'complaint_reason', width: 260 },
    {
      title: '关联来料检验', key: 'related_inspection', width: 150,
      render: (_: any, record: any) => getRelatedInspectionNo(record)
    },
    { title: '投诉日期', dataIndex: 'complaint_date', key: 'complaint_date', width: 110 },
    {
      title: 'PDF路径', dataIndex: 'pdf_path', key: 'pdf_path', width: 180,
      render: (v: string) => v ? (
        <Button type="link" size="small" icon={<FilePdfOutlined />} href={v} target="_blank">{v}</Button>
      ) : <Text type="secondary">-</Text>
    },
    {
      title: '回复内容', dataIndex: 'reply_content', key: 'reply_content', width: 220,
      render: (v: string) => v ? v : <Text type="secondary">暂无回复</Text>
    },
    {
      title: '回复日期', dataIndex: 'reply_date', key: 'reply_date', width: 110,
      render: (v: string) => v || <Text type="secondary">-</Text>
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (v: string) => <Tag color={statusColor[v] || 'default'}>{v}</Tag>
    },
  ]

  const filters = useMemo(() => [
    {
      type: 'input' as const,
      placeholder: '投诉编号',
      icon: <SearchOutlined />,
      value: complaintNo,
      onChange: (e: any) => setComplaintNo(e?.target?.value !== undefined ? e.target.value : e),
      col: { span: 4 },
    },
    {
      type: 'input' as const,
      placeholder: '供应商名称',
      value: supplierFilter,
      onChange: (e: any) => setSupplierFilter(e?.target?.value !== undefined ? e.target.value : e),
      col: { span: 4 },
    },
    {
      type: 'select' as const,
      placeholder: '状态',
      options: [
        { label: '已创建', value: '已创建' },
        { label: '已发出', value: '已发出' },
        { label: '已回复', value: '已回复' },
        { label: '已关闭', value: '已关闭' },
      ],
      value: statusFilter,
      onChange: setStatusFilter,
      col: { span: 3 },
    },
    {
      type: 'select' as const,
      placeholder: '快速选择月份',
      options: MONTH_QUICK_OPTIONS,
      value: monthQuick || undefined,
      onChange: handleMonthQuick,
      col: { span: 4 },
    },
    {
      type: 'rangepicker' as const,
      value: dateRange,
      onChange: handleRangeChange,
      col: { span: 5 },
    },
  ], [complaintNo, supplierFilter, statusFilter, dateRange, monthQuick])

  return (
    <ThreeSectionPage
      title="供应商投诉"
      breadcrumbs="质量管理 / 供应商投诉"
      stats={stats}
      filters={filters}
      onSearch={fetchData}
      onReset={handleReset}
      actions={<ActionButtons />}
      table={
        <>
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
            message="状态流转：已创建 → 已发出 → 已回复 → 已关闭"
          />
          <ResizableTable tableKey="pages_quality_SupplierComplaint"
            columns={columns}
            dataSource={filteredData}
            rowKey="complaint_id"
            size="small"
            scroll={{ x: 1500 }}
            pagination={{ pageSize: 30, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` }}
            expandable={{
              expandedRowRender: (record: any) => (
                <div style={{ padding: '8px 0' }}>
                  <Steps
                    size="small"
                    current={getCurrentStep(record.status)}
                    items={[
                      { title: '已创建', description: `登记人：${record.created_by_name}` },
                      { title: '已发出', description: `投诉日期：${record.complaint_date}` },
                      { title: '已回复', description: record.reply_date ? `回复日期：${record.reply_date}` : '等待供应商回复' },
                      { title: '已关闭', description: '投诉处理完成' },
                    ]}
                  />
                  {record.reply_content && (
                    <div style={{ marginTop: 12 }}>
                      <Text strong>供应商回复：</Text>
                      <div style={{ marginTop: 4, color: 'var(--text-secondary)' }}>{record.reply_content}</div>
                    </div>
                  )}
                </div>
              ),
            }}
          />
        </>
      }
    />
  )
}
