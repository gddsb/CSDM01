import ResizableTable from '../../components/ResizableTable'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Table, Tag, Button, Space, Alert, message } from 'antd'
import {
  ScheduleOutlined, ClockCircleOutlined, ToolOutlined, DollarOutlined,
  ExportOutlined, ReloadOutlined, DashboardOutlined,
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import type { FilterItem, StatItem } from '../../components/ThreeSectionPage'
import api from '../../utils/api'
import { useMessage } from '../../contexts/AppContext'
import { MONTH_QUICK_OPTIONS, getMonthRange, validateRange, getThisMonth } from '../../utils/monthQuick'

// 维护类型颜色映射（兼容旧值 日常保养/定期保养/故障维修 与后端可能返回的 润滑/更换/检查 等）
const typeColorMap: Record<string, string> = {
  // 旧值
  '日常保养': 'blue',
  '定期保养': 'cyan',
  '故障维修': 'red',
  // 后端可能返回的新值
  '润滑': 'blue',
  '更换': 'cyan',
  '检查': 'green',
  '清洁': 'blue',
  '校准': 'cyan',
  '调整': 'green',
}

// 状态颜色映射（匹配后端状态值：待执行/执行中/已完成/已挂起）
const statusColorMap: Record<string, string> = {
  '待执行': 'default',
  '执行中': 'processing',
  '已完成': 'success',
  '已挂起': 'error',
  // 兼容旧值
  '计划中': 'default',
}

// 区分保养与维修：已知的维修类型返回 false，其他（保养类）默认返回 true
const isMaintenance = (t: string) => {
  if (!t) return true
  if (t === '故障维修' || t === '维修') return false
  return true
}

export default function Maintenance() {
  const message = useMessage()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 30, total: 0 })
  const [devices, setDevices] = useState<any[]>([])
  const [refreshKey, setRefreshKey] = useState(0)

  const [deviceFilter, setDeviceFilter] = useState<number | undefined>(undefined)
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [dateRange, setDateRange] = useState<any>(getThisMonth())
  const [monthQuick, setMonthQuick] = useState<string>('this_month')
  const [rangeWarn, setRangeWarn] = useState(false)

  // ============ 加载维护工单列表 ============
  const fetchData = useCallback(async () => {
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
      const params: any = { page: pagination.current, page_size: pagination.pageSize }
      if (deviceFilter) params.device_id = deviceFilter
      if (statusFilter && statusFilter !== '全部') params.status = statusFilter
      if (dateRange && dateRange[0]) params.start_date = dateRange[0].format('YYYY-MM-DD')
      if (dateRange && dateRange[1]) params.end_date = dateRange[1].format('YYYY-MM-DD')

      const res = await api.get('/device-maintenance-records', { params })
      if (res.success !== false) {
        const list = res.data?.list || res.data || []
        setData(Array.isArray(list) ? list : [])
        setPagination(p => ({ ...p, total: res.data?.total || res.total || 0 }))
      } else {
        setData([])
        setPagination(p => ({ ...p, total: 0 }))
        message.error(res.message || '查询失败')
      }
    } catch (e: any) {
      setData([])
      setPagination(p => ({ ...p, total: 0 }))
      if (e?.message && !/timeout|network/i.test(e.message)) {
        message.error(e.message)
      }
    } finally {
      setLoading(false)
    }
  }, [pagination.current, pagination.pageSize, deviceFilter, statusFilter, dateRange])

  useEffect(() => { fetchData() }, [fetchData, refreshKey])

  // ============ 加载设备下拉 ============
  const loadDevices = useCallback(async () => {
    try {
      const res = await api.get('/devices', { params: { page: 1, page_size: 500 } })
      if (res.success !== false) {
        const list = res.data?.list || res.data || []
        setDevices(Array.isArray(list) ? list : [])
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => { loadDevices() }, [loadDevices])

  // ============ 筛选处理 ============
  const handleMonthQuick = (v: string) => {
    setMonthQuick(v)
    setDateRange(getMonthRange(v))
    setPagination(p => ({ ...p, current: 1 }))
    setRefreshKey(k => k + 1)
  }
  const handleRangeChange = (v: any) => {
    setMonthQuick(undefined)
    setDateRange(v)
    setPagination(p => ({ ...p, current: 1 }))
    setRefreshKey(k => k + 1)
  }
  const handleDeviceChange = (v: any) => {
    setDeviceFilter(v as number | undefined)
    setPagination(p => ({ ...p, current: 1 }))
    setRefreshKey(k => k + 1)
  }
  const handleStatusChange = (v: any) => {
    setStatusFilter(v as string | undefined)
    setPagination(p => ({ ...p, current: 1 }))
    setRefreshKey(k => k + 1)
  }

  const deviceOptions = useMemo(() =>
    devices.map(d => ({ label: d.device_name || d.device_code || String(d.device_id), value: d.device_id })), [devices])
  const typeOptions = [
    { label: '全部', value: '全部' },
    { label: '日常保养', value: '日常保养' },
    { label: '定期保养', value: '定期保养' },
    { label: '故障维修', value: '故障维修' },
  ]
  const statusOptions = [
    { label: '全部', value: '全部' },
    { label: '待执行', value: '待执行' },
    { label: '执行中', value: '执行中' },
    { label: '已完成', value: '已完成' },
    { label: '已挂起', value: '已挂起' },
  ]

  // 客户端按维护类型二次过滤（API 不支持 maintenance_type 查询参数）
  const filteredData = useMemo(() => {
    if (!typeFilter || typeFilter === '全部') return data
    return data.filter(r => r.maintenance_type === typeFilter)
  }, [data, typeFilter])

  // ============ 统计数据（基于已加载数据计算） ============
  const pendingCount = data.filter(r => r.status === '待执行').length
  const executingCount = data.filter(r => r.status === '执行中').length
  const completedCount = data.filter(r => r.status === '已完成').length

  const stats: StatItem[] = [
    { label: '待执行', value: pendingCount, icon: <ClockCircleOutlined />, color: '#FF9800' },
    { label: '执行中', value: executingCount, icon: <ToolOutlined />, color: '#F44336' },
    { label: '已完成', value: completedCount, icon: <ScheduleOutlined />, color: '#4CAF50' },
    { label: '总工单数', value: pagination.total, icon: <DashboardOutlined />, color: '#2196F3' },
  ]

  const filters: FilterItem[] = [
    { type: 'select', placeholder: '选择设备', options: deviceOptions, value: deviceFilter, onChange: handleDeviceChange, col: { span: 3 } },
    { type: 'select', placeholder: '维护类型', options: typeOptions, value: typeFilter, onChange: setTypeFilter, col: { span: 3 } },
    { type: 'select', placeholder: '状态', options: statusOptions, value: statusFilter, onChange: handleStatusChange, col: { span: 3 } },
    { type: 'select', placeholder: '快速选择月份', options: MONTH_QUICK_OPTIONS, value: monthQuick || undefined, onChange: handleMonthQuick, col: { span: 4 } },
    { type: 'rangepicker', value: dateRange, onChange: handleRangeChange, col: { span: 6 } },
  ]

  const handleReset = () => {
    setDeviceFilter(undefined)
    setTypeFilter(undefined)
    setStatusFilter(undefined)
    setMonthQuick('this_month')
    setDateRange(getThisMonth())
    setPagination(p => ({ ...p, current: 1 }))
    setRefreshKey(k => k + 1)
  }

  // ============ 导出（使用加载的数据导出 CSV） ============
  const handleExport = () => {
    if (filteredData.length === 0) {
      message.warning('没有可导出的数据')
      return
    }
    const headers = ['维护编号', '设备名称', '维护类型', '计划日期', '完成时间', '维护耗时', '状态', '维护人', '备注']
    const rows = filteredData.map(r => [
      r.record_no || '', r.device_name || '', r.maintenance_type || '',
      r.plan_date || '', r.end_time || '', r.maintenance_hours ?? '',
      r.status || '', r.maintainer_name || '', r.remarks || '',
    ])
    const csv = [headers, ...rows].map(row =>
      row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
    ).join('\n')
    try {
      const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `维修保养记录_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      message.success(`已导出 ${filteredData.length} 条维修保养记录`)
    } catch {
      message.success(`已导出 ${filteredData.length} 条维修保养记录`)
    }
  }

  const handleRefresh = () => {
    setPagination(p => ({ ...p, current: 1 }))
    setRefreshKey(k => k + 1)
  }

  // ============ 表格列 ============
  const columns = [
    { title: '维护编号', dataIndex: 'record_no', key: 'record_no', width: 150 },
    { title: '设备名称', dataIndex: 'device_name', key: 'device_name', width: 140 },
    {
      title: '维护类型', dataIndex: 'maintenance_type', key: 'maintenance_type', width: 100,
      render: (v: string) => <Tag color={typeColorMap[v] || (isMaintenance(v) ? 'blue' : 'red')}>{v || '-'}</Tag>,
    },
    { title: '计划日期', dataIndex: 'plan_date', key: 'plan_date', width: 120 },
    {
      title: '完成时间', dataIndex: 'end_time', key: 'end_time', width: 160,
      render: (v: string) => v || <span style={{ color: 'var(--text-secondary)' }}>-</span>,
    },
    {
      title: '维护耗时', dataIndex: 'maintenance_hours', key: 'maintenance_hours', width: 100,
      render: (v: number) => v != null ? `${v} h` : <span style={{ color: 'var(--text-secondary)' }}>-</span>,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (v: string) => <Tag color={statusColorMap[v] || 'default'}>{v || '-'}</Tag>,
    },
    { title: '维护人', dataIndex: 'maintainer_name', key: 'maintainer_name', width: 110 },
    { title: '备注', dataIndex: 'remarks', key: 'remarks', ellipsis: true },
  ]

  return (
    <ThreeSectionPage
      title="维修保养"
      breadcrumbs="设备管理 / 维修保养"
      stats={stats}
      filters={filters}
      onReset={handleReset}
      onSearch={handleRefresh}
      actions={<ActionButtons hasAdd={false} hasExport={false} extra={[
        <Button key="export" icon={<ExportOutlined />} onClick={handleExport}>导出</Button>,
        <Button key="refresh" icon={<ReloadOutlined />} onClick={handleRefresh}>刷新</Button>,
      ]} />}
      table={
        <div>
          {rangeWarn && (
            <Alert type="warning" showIcon style={{ marginBottom: 12 }}
              message="查询跨度时间较长，后台需要较长时间执行查询，可能造成页面假死状态" />
          )}
          <ResizableTable tableKey="pages_device_Maintenance"
            columns={columns}
            dataSource={filteredData}
            rowKey="record_id"
            size="small"
            loading={loading}
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
  )
}
