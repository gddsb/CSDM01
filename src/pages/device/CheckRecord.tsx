import ResizableTable from '../../components/ResizableTable'
import React, { useState, useMemo, useEffect, useCallback } from 'react'
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

// 点检结果标签颜色映射
const resultColorMap = { '正常': 'green', '异常': 'red' }

export default function CheckRecord() {
  const message = useMessage()
  const [data, setData] = useState<any[]>([])
  const [deviceList, setDeviceList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [deviceFilter, setDeviceFilter] = useState(undefined)
  const [resultFilter, setResultFilter] = useState(undefined)
  const [dateRange, setDateRange] = useState<any>(getThisMonth())
  const [monthQuick, setMonthQuick] = useState<string>('this_month')
  const [rangeWarn, setRangeWarn] = useState(false)

  // 加载设备列表
  const loadDevices = useCallback(async () => {
    try {
      const res = await api.get('/basic/devices', { params: { page: 1, page_size: 500 } })
      if (res.success !== false) {
        const list = res.data?.list || res.data || []
        setDeviceList(Array.isArray(list) ? list : [])
      }
    } catch { /* ignore */ }
  }, [])

  // 加载点检记录
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { page: 1, page_size: 500 }
      if (dateRange && dateRange[0]) params.start_date = dateRange[0].format('YYYY-MM-DD')
      if (dateRange && dateRange[1]) params.end_date = dateRange[1].format('YYYY-MM-DD')
      const res = await api.get('/basic/device-inspection-plans', { params })
      if (res.success !== false) {
        const list = res.data?.list || res.data || []
        // 映射 API 字段到页面期望的字段名
        const mapped = (Array.isArray(list) ? list : []).map((r: any) => ({
          ...r,
          check_no: r.plan_no || r.check_no,
          check_date: r.plan_date || r.check_date,
          check_item: r.inspection_items || r.check_item || '点检',
          inspector: r.inspector_name || r.inspector || r.responsible_person || '-',
          remarks: r.remark || r.remarks || '',
          result: r.status === '已检' ? '正常' : r.status === '异常' ? '异常' : (r.result || '-'),
        }))
        setData(mapped)
      } else {
        setData([])
      }
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => { loadDevices() }, [loadDevices])
  useEffect(() => { loadData() }, [loadData])

  const deviceOptions = deviceList.map(d => ({ label: d.device_name, value: d.device_name }))
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

  // 过滤后的数据
  const filteredData = useMemo(() => {
    if (dateRange) {
      const check = validateRange(dateRange)
      if (!check.ok) {
        message.warning(check.msg)
      }
      setRangeWarn(check.warn || false)
    } else {
      setRangeWarn(false)
    }
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
  // 待点检设备数：设备总数 - 已点检设备数
  const checkedDevices = new Set(data.filter(r => r.result === '正常' || r.result === '异常').map(r => r.device_name))
  const pendingDevices = deviceList.filter(d => !checkedDevices.has(d.device_name)).length

  const stats: StatItem[] = [
    { label: '总点检次数', value: total, icon: <FileSearchOutlined />, color: '#2196F3' },
    { label: '正常次数', value: normalCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
    { label: '异常次数', value: abnormalCount, icon: <WarningOutlined />, color: '#F44336' },
    { label: '待点检设备数', value: pendingDevices, icon: <ClockCircleOutlined />, color: '#FF9800' },
  ]

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
    message.success(`已导出 ${filteredData.length} 条点检记录`)
  }

  const handleRefresh = () => {
    loadData()
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
      actions={<ActionButtons hasAdd={false} extra={[<Button key="export" icon={<ExportOutlined />} onClick={handleExport}>导出</Button>]} />}
      table={
        <div>
          {rangeWarn && (
            <Alert type="warning" showIcon style={{ marginBottom: 12 }}
              message="查询跨度时间较长，后台需要较长时间执行查询，可能造成页面假死状态" />
          )}
          <ResizableTable tableKey="pages_device_CheckRecord"           columns={columns}
            dataSource={filteredData}
            rowKey="check_id"
            size="small"
            pagination={{ pageSize: 30, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
          />
        </div>
      }
    />
  )
}
