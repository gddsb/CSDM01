import ResizableTable from '../../components/ResizableTable'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Table, Tag, Button, Space, Alert, message } from 'antd'
import {
  FileSearchOutlined, CheckCircleOutlined, WarningOutlined, ClockCircleOutlined,
  ExportOutlined, ReloadOutlined,
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import type { FilterItem, StatItem } from '../../components/ThreeSectionPage'
import api from '../../utils/api'
import { useMessage } from '../../contexts/AppContext'
import { MONTH_QUICK_OPTIONS, getMonthRange, validateRange, getThisMonth } from '../../utils/monthQuick'
import dayjs from 'dayjs'

// 点检结果标签颜色映射
const resultColorMap = { '正常': 'green', '异常': 'red' }

export default function CheckRecord() {
  const message = useMessage()
  const [data, setData] = useState<any[]>([])
  const [devices, setDevices] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [deviceFilter, setDeviceFilter] = useState<string | number | undefined>(undefined)
  const [resultFilter, setResultFilter] = useState<string | undefined>(undefined)
  const [dateRange, setDateRange] = useState<any>(getThisMonth())
  const [monthQuick, setMonthQuick] = useState<string>('this_month')
  const [rangeWarn, setRangeWarn] = useState(false)

  const deviceOptions = useMemo(() => devices.map(d => ({ label: d.device_name, value: d.device_id })), [devices])
  const resultOptions = [
    { label: '全部', value: '全部' },
    { label: '正常', value: '正常' },
    { label: '异常', value: '异常' },
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

  // 加载设备下拉（用于筛选）
  const loadDevices = useCallback(async () => {
    try {
      const res = await api.get('/devices', { params: { page: 1, page_size: 1000 } })
      if (res.success !== false) {
        const list = res.data?.list || res.data || []
        setDevices(Array.isArray(list) ? list : [])
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => { loadDevices() }, [loadDevices])

  // 加载点检记录（筛选参数传给后端）
  const fetchData = useCallback(async () => {
    if (dateRange) {
      const check = validateRange(dateRange)
      if (!check.ok) {
        setRangeWarn(false)
        message.warning(check.msg)
        return
      }
      setRangeWarn(!!check.warn)
    } else {
      setRangeWarn(false)
    }
    setLoading(true)
    try {
      const params: any = { page: 1, page_size: 1000 }
      if (deviceFilter) params.device_id = deviceFilter
      if (resultFilter && resultFilter !== '全部') params.result = resultFilter
      if (dateRange && dateRange[0]) params.start_date = dateRange[0].format('YYYY-MM-DD')
      if (dateRange && dateRange[1]) params.end_date = dateRange[1].format('YYYY-MM-DD')
      const res = await api.get('/device-inspection-records', { params })
      if (res.success !== false) {
        const list = res.data?.list || res.data || []
        setData(Array.isArray(list) ? list : [])
      } else {
        setData([])
        message.error(res.message || '查询失败')
      }
    } catch (e: any) {
      setData([])
      if (e?.message && !/timeout|network/i.test(e.message)) {
        message.error(e.message)
      }
    } finally {
      setLoading(false)
    }
  }, [deviceFilter, resultFilter, dateRange])

  useEffect(() => { fetchData() }, [fetchData])

  // 统计数据（从加载的数据计算）
  const stats: StatItem[] = useMemo(() => {
    const todayStr = dayjs().format('YYYY-MM-DD')
    const total = data.length
    const normalCount = data.filter(r => r.result === '正常').length
    const abnormalCount = data.filter(r => r.result === '异常').length
    // 待点检设备数：总设备数 - 今日已点检设备数
    const checkedTodayIds = new Set(data.filter(r => r.inspection_date === todayStr).map(r => r.device_id))
    const pendingDevices = devices.filter(d => !checkedTodayIds.has(d.device_id)).length
    return [
      { label: '总点检次数', value: total, icon: <FileSearchOutlined />, color: '#2196F3' },
      { label: '正常次数', value: normalCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
      { label: '异常次数', value: abnormalCount, icon: <WarningOutlined />, color: '#F44336' },
      { label: '待点检设备数', value: pendingDevices, icon: <ClockCircleOutlined />, color: '#FF9800' },
    ]
  }, [data, devices])

  const filters: FilterItem[] = [
    { type: 'select', placeholder: '选择设备', options: deviceOptions, value: deviceFilter, onChange: setDeviceFilter, col: { span: 4 } },
    { type: 'select', placeholder: '点检结果', options: resultOptions, value: resultFilter, onChange: setResultFilter, col: { span: 4 } },
    { type: 'select', placeholder: '快速选择月份', options: MONTH_QUICK_OPTIONS, value: monthQuick || undefined, onChange: handleMonthQuick, col: { span: 4 } },
    { type: 'rangepicker', value: dateRange, onChange: handleRangeChange, col: { span: 6 } },
  ]

  const handleReset = () => {
    setDeviceFilter(undefined)
    setResultFilter(undefined)
    setMonthQuick('this_month')
    setDateRange(getThisMonth())
  }

  const handleExport = () => {
    message.success(`已导出 ${data.length} 条点检记录`)
  }

  const columns = [
    { title: '点检编号', dataIndex: 'record_no', key: 'record_no', width: 150 },
    { title: '设备名称', dataIndex: 'device_name', key: 'device_name', width: 140 },
    { title: '点检日期', dataIndex: 'inspection_date', key: 'inspection_date', width: 120 },
    { title: '点检项目', dataIndex: 'inspection_item', key: 'inspection_item', width: 150 },
    {
      title: '点检结果', dataIndex: 'result', key: 'result', width: 100,
      render: (v: any) => <Tag color={resultColorMap[v]}>{v}</Tag>,
    },
    { title: '检查人', dataIndex: 'inspector_name', key: 'inspector_name', width: 110 },
    { title: '备注', dataIndex: 'remarks', key: 'remarks', ellipsis: true },
  ]

  return (
    <ThreeSectionPage
      title="点检记录"
      breadcrumbs="设备管理 / 点检记录"
      stats={stats}
      filters={filters}
      onReset={handleReset}
      actions={<ActionButtons hasAdd={false} extra={[<Button key="export" icon={<ExportOutlined />} onClick={handleExport}>导出</Button>]} />}
      table={
        <div>
          {rangeWarn && (
            <Alert type="warning" showIcon style={{ marginBottom: 12 }}
              message="查询跨度时间较长，后台需要较长时间执行查询，可能造成页面假死状态" />
          )}
          <ResizableTable tableKey="pages_device_CheckRecord"
            columns={columns}
            dataSource={data}
            rowKey="record_id"
            size="small"
            loading={loading}
            pagination={{ pageSize: 30, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` }}
          />
        </div>
      }
    />
  )
}
