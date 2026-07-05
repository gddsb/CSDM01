import React, { useState, useMemo } from 'react'
import { Table, Tag, Button, Space, message } from 'antd'
import {
  FileSearchOutlined, CheckCircleOutlined, WarningOutlined, ClockCircleOutlined,
  ExportOutlined, ReloadOutlined,
} from '@ant-design/icons'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import { devices } from '../../mock/data'

// 基于设备档案生成的点检记录 Mock 数据
const checkRecordsData = [
  { check_id: 'cr1', check_no: 'CR20260630001', device_id: 'd1', device_name: '自动焊接机1号', check_date: '2026-06-30', check_item: '焊接头温度检查', result: '正常', inspector: '工序操作人', remarks: '焊接温度稳定，无异常' },
  { check_id: 'cr2', check_no: 'CR20260630002', device_id: 'd2', device_name: '正压测漏机1号', check_date: '2026-06-30', check_item: '密封性能检查', result: '正常', inspector: '设备维护员', remarks: '密封性良好，保压正常' },
  { check_id: 'cr3', check_no: 'CR20260630003', device_id: 'd3', device_name: '自动码垛机1号', check_date: '2026-06-30', check_item: '机械臂运行检查', result: '异常', inspector: '工序操作人', remarks: '机械臂运行有异响，已上报维修' },
  { check_id: 'cr4', check_no: 'CR20260629001', device_id: 'd1', device_name: '自动焊接机1号', check_date: '2026-06-29', check_item: '冷却系统检查', result: '正常', inspector: '设备维护员', remarks: '冷却液位正常，循环畅通' },
  { check_id: 'cr5', check_no: 'CR20260629002', device_id: 'd4', device_name: '自动焊接机2号', check_date: '2026-06-29', check_item: '焊接头温度检查', result: '异常', inspector: '工序操作人', remarks: '焊接头过热，停机冷却30分钟' },
  { check_id: 'cr6', check_no: 'CR20260628001', device_id: 'd2', device_name: '正压测漏机1号', check_date: '2026-06-28', check_item: '压力表校验', result: '正常', inspector: '设备维护员', remarks: '压力表读数准确，在有效期内' },
  { check_id: 'cr7', check_no: 'CR20260628002', device_id: 'd3', device_name: '自动码垛机1号', check_date: '2026-06-28', check_item: '传动带张力检查', result: '正常', inspector: '工序操作人', remarks: '传动带张力适中，无松动' },
  { check_id: 'cr8', check_no: 'CR20260627001', device_id: 'd1', device_name: '自动焊接机1号', check_date: '2026-06-27', check_item: '电极磨损检查', result: '正常', inspector: '设备维护员', remarks: '电极磨损在允许范围内' },
  { check_id: 'cr9', check_no: 'CR20260627002', device_id: 'd4', device_name: '自动焊接机2号', check_date: '2026-06-27', check_item: '气压系统检查', result: '正常', inspector: '工序操作人', remarks: '气压稳定，管路无泄漏' },
]

// 点检结果标签颜色映射
const resultColorMap = { '正常': 'green', '异常': 'red' }

// 最近点检日（用于统计待点检设备数）
const LATEST_CHECK_DATE = '2026-06-30'

export default function CheckRecord() {
  const [data] = useState(checkRecordsData)
  const [deviceFilter, setDeviceFilter] = useState(undefined)
  const [resultFilter, setResultFilter] = useState(undefined)
  const [dateRange, setDateRange] = useState(undefined)

  const deviceOptions = devices.map(d => ({ label: d.device_name, value: d.device_name }))
  const resultOptions = [
    { label: '全部', value: '全部' },
    { label: '正常', value: '正常' },
    { label: '异常', value: '异常' },
  ]

  // 过滤后的数据
  const filteredData = useMemo(() => {
    return data.filter(r => {
      if (deviceFilter && r.device_name !== deviceFilter) return false
      if (resultFilter && resultFilter !== '全部' && r.result !== resultFilter) return false
      if (dateRange && dateRange.length === 2) {
        const start = dateRange[0].format('YYYY-MM-DD')
        const end = dateRange[1].format('YYYY-MM-DD')
        if (r.check_date < start || r.check_date > end) return false
      }
      return true
    })
  }, [data, deviceFilter, resultFilter, dateRange])

  // 统计数据
  const total = data.length
  const normalCount = data.filter(r => r.result === '正常').length
  const abnormalCount = data.filter(r => r.result === '异常').length
  // 待点检设备数：最近点检日未点检的设备
  const checkedToday = new Set(data.filter(r => r.check_date === LATEST_CHECK_DATE).map(r => r.device_name))
  const pendingDevices = devices.filter(d => !checkedToday.has(d.device_name)).length

  const stats = [
    { label: '总点检次数', value: total, icon: <FileSearchOutlined />, color: '#2196F3' },
    { label: '正常次数', value: normalCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
    { label: '异常次数', value: abnormalCount, icon: <WarningOutlined />, color: '#F44336' },
    { label: '待点检设备数', value: pendingDevices, icon: <ClockCircleOutlined />, color: '#FF9800' },
  ]

  const filters = [
    { type: 'select', placeholder: '选择设备', options: deviceOptions, value: deviceFilter, onChange: setDeviceFilter, col: { span: 6 } },
    { type: 'select', placeholder: '点检结果', options: resultOptions, value: resultFilter, onChange: setResultFilter, col: { span: 6 } },
    { type: 'rangepicker', value: dateRange, onChange: setDateRange, col: { span: 8 } },
  ]

  const handleReset = () => {
    setDeviceFilter(undefined)
    setResultFilter(undefined)
    setDateRange(undefined)
  }

  const handleExport = () => {
    message.success(`已导出 ${filteredData.length} 条点检记录`)
  }

  const handleRefresh = () => {
    message.success('数据已刷新')
  }

  const columns = [
    { title: '点检编号', dataIndex: 'check_no', key: 'check_no', width: 150 },
    { title: '设备名称', dataIndex: 'device_name', key: 'device_name', width: 140 },
    { title: '点检日期', dataIndex: 'check_date', key: 'check_date', width: 120 },
    { title: '点检项目', dataIndex: 'check_item', key: 'check_item', width: 150 },
    {
      title: '点检结果', dataIndex: 'result', key: 'result', width: 100,
      render: v => <Tag color={resultColorMap[v]}>{v}</Tag>,
    },
    { title: '检查人', dataIndex: 'inspector', key: 'inspector', width: 110 },
    { title: '备注', dataIndex: 'remarks', key: 'remarks', ellipsis: true },
  ]

  return (
    <ThreeSectionPage
      title="点检记录"
      breadcrumbs="设备管理 / 点检记录"
      stats={stats}
      filters={filters}
      onReset={handleReset}
      actions={
        <Space>
          <Button icon={<ExportOutlined />} onClick={handleExport}>导出</Button>
        </Space>
      }
      table={
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="check_id"
          size="small"
          pagination={{ pageSize: 30, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
        />
      }
    />
  )
}
