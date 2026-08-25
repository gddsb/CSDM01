import ResizableTable from '../../components/ResizableTable'
import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { Table, Tag, Button, Space, Alert, message } from 'antd'
import {
  ScheduleOutlined, ClockCircleOutlined, ToolOutlined, DollarOutlined,
  ExportOutlined, ReloadOutlined,
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import type { FilterItem, StatItem } from '../../components/ThreeSectionPage'
import api from '../../utils/api'
import { useMessage } from '../../contexts/AppContext'
import { MONTH_QUICK_OPTIONS, getMonthRange, validateRange, getThisMonth } from '../../utils/monthQuick'

// 维护类型与状态标签颜色映射
const typeColorMap = { '日常保养': 'blue', '定期保养': 'cyan', '故障维修': 'red' }
const statusColorMap = { '计划中': 'default', '执行中': 'processing', '已完成': 'success' }

const isMaintenance = (t) => t === '日常保养' || t === '定期保养'

export default function Maintenance() {
  const message = useMessage()
  const [data, setData] = useState<any[]>([])
  const [deviceList, setDeviceList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [deviceFilter, setDeviceFilter] = useState(undefined)
  const [typeFilter, setTypeFilter] = useState(undefined)
  const [statusFilter, setStatusFilter] = useState(undefined)
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

  // 加载维修保养记录
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { page: 1, page_size: 500 }
      if (dateRange && dateRange[0]) params.start_date = dateRange[0].format('YYYY-MM-DD')
      if (dateRange && dateRange[1]) params.end_date = dateRange[1].format('YYYY-MM-DD')
      const res = await api.get('/basic/device-maintenance-records', { params })
      if (res.success !== false) {
        const list = res.data?.list || res.data || []
        // 映射 API 字段到页面期望的字段名
        const mapped = (Array.isArray(list) ? list : []).map((r: any) => ({
          ...r,
          mt_no: r.record_no || r.mt_no,
          mt_type: r.maintenance_type || r.mt_type,
          responsible: r.responsible_person || r.responsible,
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

  const handleMonthQuick = (v: string) => {
    setMonthQuick(v)
    const range = getMonthRange(v)
    setDateRange(range)
  }
  const handleRangeChange = (v: any) => {
    setMonthQuick(undefined)
    setDateRange(v)
  }

  const deviceOptions = deviceList.map(d => ({ label: d.device_name, value: d.device_name }))
  const typeOptions = [
    { label: '全部', value: '全部' },
    { label: '日常保养', value: '日常保养' },
    { label: '定期保养', value: '定期保养' },
    { label: '故障维修', value: '故障维修' },
  ]
  const statusOptions = [
    { label: '全部', value: '全部' },
    { label: '计划中', value: '计划中' },
    { label: '执行中', value: '执行中' },
    { label: '已完成', value: '已完成' },
  ]

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
      if (typeFilter && typeFilter !== '全部' && r.mt_type !== typeFilter) return false
      if (statusFilter && statusFilter !== '全部' && r.status !== statusFilter) return false
      if (dateRange && dateRange.length === 2 && r.plan_date) {
        const start = dateRange[0].format('YYYY-MM-DD')
        const end = dateRange[1].format('YYYY-MM-DD')
        if (r.plan_date < start || r.plan_date > end) return false
      }
      return true
    })
  }, [data, deviceFilter, typeFilter, statusFilter, dateRange])

  // 统计数据
  const maintainCount = data.filter(r => isMaintenance(r.mt_type)).length
  const pendingDevices = new Set(
    data.filter(r => r.status === '计划中' && isMaintenance(r.mt_type)).map(r => r.device_name)
  ).size
  const repairingCount = data.filter(r => r.mt_type === '故障维修' && r.status !== '已完成').length
  const repairCost = data.filter(r => r.mt_type === '故障维修').reduce((s, r) => s + (r.cost || 0), 0)

  const stats: StatItem[] = [
    { label: '本月保养次数', value: maintainCount, icon: <ScheduleOutlined />, color: '#2196F3' },
    { label: '待保养设备', value: pendingDevices, icon: <ClockCircleOutlined />, color: '#FF9800' },
    { label: '维修中', value: repairingCount, icon: <ToolOutlined />, color: '#F44336' },
    { label: '本月维修费用', value: `¥${repairCost.toLocaleString()}`, icon: <DollarOutlined />, color: '#4CAF50' },
  ]

  const filters: FilterItem[] = [
    { type: 'select', placeholder: '选择设备', options: deviceOptions, value: deviceFilter, onChange: setDeviceFilter, col: { span: 3 } },
    { type: 'select', placeholder: '维护类型', options: typeOptions, value: typeFilter, onChange: setTypeFilter, col: { span: 3 } },
    { type: 'select', placeholder: '状态', options: statusOptions, value: statusFilter, onChange: setStatusFilter, col: { span: 3 } },
    { type: 'select', placeholder: '快速选择月份', options: MONTH_QUICK_OPTIONS, value: monthQuick || undefined, onChange: handleMonthQuick, col: { span: 4 } },
    { type: 'rangepicker', value: dateRange, onChange: handleRangeChange, col: { span: 6 } },
  ]

  const handleReset = () => {
    setDeviceFilter(undefined)
    setTypeFilter(undefined)
    setStatusFilter(undefined)
    setMonthQuick('this_month')
    setDateRange(getThisMonth())
  }

  const handleExport = () => {
    message.success(`已导出 ${filteredData.length} 条维修保养记录`)
  }

  const handleRefresh = () => {
    loadData()
  }

  const columns = [
    { title: '维护编号', dataIndex: 'mt_no', key: 'mt_no', width: 150 },
    { title: '设备名称', dataIndex: 'device_name', key: 'device_name', width: 140 },
    {
      title: '维护类型', dataIndex: 'mt_type', key: 'mt_type', width: 100,
      render: v => <Tag color={typeColorMap[v]}>{v}</Tag>,
    },
    { title: '计划日期', dataIndex: 'plan_date', key: 'plan_date', width: 120 },
    {
      title: '完成日期', dataIndex: 'finish_date', key: 'finish_date', width: 120,
      render: v => v || <span style={{ color: 'var(--text-secondary)' }}>-</span>,
    },
    {
      title: '费用', dataIndex: 'cost', key: 'cost', width: 110,
      render: v => v != null ? `¥${v.toLocaleString()}` : <span style={{ color: 'var(--text-secondary)' }}>-</span>,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: v => <Tag color={statusColorMap[v]}>{v}</Tag>,
    },
    { title: '负责人', dataIndex: 'responsible', key: 'responsible', width: 110 },
    { title: '备注', dataIndex: 'remarks', key: 'remarks', ellipsis: true },
  ]

  return (
    <ThreeSectionPage
      title="维修保养"
      breadcrumbs="设备管理 / 维修保养"
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
          <ResizableTable tableKey="pages_device_Maintenance"           columns={columns}
            dataSource={filteredData}
            rowKey="mt_id"
            size="small"
            pagination={{ pageSize: 30, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
          />
        </div>
      }
    />
  )
}
