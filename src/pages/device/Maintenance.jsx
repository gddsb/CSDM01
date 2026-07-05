import React, { useState, useMemo } from 'react'
import { Table, Tag, Button, Space, message } from 'antd'
import {
  ScheduleOutlined, ClockCircleOutlined, ToolOutlined, DollarOutlined,
  ExportOutlined, ReloadOutlined,
} from '@ant-design/icons'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import { devices } from '../../mock/data'

// 基于设备档案生成的维修保养记录 Mock 数据
const maintenanceData = [
  { mt_id: 'mt1', mt_no: 'MT20260615001', device_id: 'd1', device_name: '自动焊接机1号', mt_type: '定期保养', plan_date: '2026-06-15', finish_date: '2026-06-15', cost: 1200, status: '已完成', responsible: '设备维护员', remarks: '更换电极，全面润滑' },
  { mt_id: 'mt2', mt_no: 'MT20260618001', device_id: 'd4', device_name: '自动焊接机2号', mt_type: '日常保养', plan_date: '2026-06-18', finish_date: '2026-06-18', cost: 250, status: '已完成', responsible: '工序操作人', remarks: '日常清洁，检查气路' },
  { mt_id: 'mt3', mt_no: 'MT20260620001', device_id: 'd2', device_name: '正压测漏机1号', mt_type: '日常保养', plan_date: '2026-06-20', finish_date: '2026-06-20', cost: 300, status: '已完成', responsible: '设备维护员', remarks: '清洁传感器，校准压力' },
  { mt_id: 'mt4', mt_no: 'MT20260625001', device_id: 'd3', device_name: '自动码垛机1号', mt_type: '定期保养', plan_date: '2026-06-25', finish_date: '2026-06-25', cost: 800, status: '已完成', responsible: '设备维护员', remarks: '传动带调整，润滑保养' },
  { mt_id: 'mt5', mt_no: 'MT20260629001', device_id: 'd4', device_name: '自动焊接机2号', mt_type: '故障维修', plan_date: '2026-06-29', finish_date: '2026-06-30', cost: 3500, status: '已完成', responsible: '设备维护员', remarks: '焊接头过热故障维修，更换冷却泵' },
  { mt_id: 'mt6', mt_no: 'MT20260702001', device_id: 'd3', device_name: '自动码垛机1号', mt_type: '故障维修', plan_date: '2026-07-02', finish_date: null, cost: 1500, status: '执行中', responsible: '设备维护员', remarks: '机械臂异响排查维修中' },
  { mt_id: 'mt7', mt_no: 'MT20260705001', device_id: 'd1', device_name: '自动焊接机1号', mt_type: '日常保养', plan_date: '2026-07-05', finish_date: null, cost: null, status: '计划中', responsible: '设备维护员', remarks: '计划日常清洁保养' },
  { mt_id: 'mt8', mt_no: 'MT20260710001', device_id: 'd2', device_name: '正压测漏机1号', mt_type: '定期保养', plan_date: '2026-07-10', finish_date: null, cost: null, status: '计划中', responsible: '设备维护员', remarks: '季度定期保养' },
]

// 维护类型与状态标签颜色映射
const typeColorMap = { '日常保养': 'blue', '定期保养': 'cyan', '故障维修': 'red' }
const statusColorMap = { '计划中': 'default', '执行中': 'processing', '已完成': 'success' }

const isMaintenance = (t) => t === '日常保养' || t === '定期保养'

export default function Maintenance() {
  const [data] = useState(maintenanceData)
  const [deviceFilter, setDeviceFilter] = useState(undefined)
  const [typeFilter, setTypeFilter] = useState(undefined)
  const [statusFilter, setStatusFilter] = useState(undefined)

  const deviceOptions = devices.map(d => ({ label: d.device_name, value: d.device_name }))
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
    return data.filter(r => {
      if (deviceFilter && r.device_name !== deviceFilter) return false
      if (typeFilter && typeFilter !== '全部' && r.mt_type !== typeFilter) return false
      if (statusFilter && statusFilter !== '全部' && r.status !== statusFilter) return false
      return true
    })
  }, [data, deviceFilter, typeFilter, statusFilter])

  // 统计数据
  const maintainCount = data.filter(r => isMaintenance(r.mt_type)).length
  const pendingDevices = new Set(
    data.filter(r => r.status === '计划中' && isMaintenance(r.mt_type)).map(r => r.device_name)
  ).size
  const repairingCount = data.filter(r => r.mt_type === '故障维修' && r.status !== '已完成').length
  const repairCost = data.filter(r => r.mt_type === '故障维修').reduce((s, r) => s + (r.cost || 0), 0)

  const stats = [
    { label: '本月保养次数', value: maintainCount, icon: <ScheduleOutlined />, color: '#2196F3' },
    { label: '待保养设备', value: pendingDevices, icon: <ClockCircleOutlined />, color: '#FF9800' },
    { label: '维修中', value: repairingCount, icon: <ToolOutlined />, color: '#F44336' },
    { label: '本月维修费用', value: `¥${repairCost.toLocaleString()}`, icon: <DollarOutlined />, color: '#4CAF50' },
  ]

  const filters = [
    { type: 'select', placeholder: '选择设备', options: deviceOptions, value: deviceFilter, onChange: setDeviceFilter, col: { span: 6 } },
    { type: 'select', placeholder: '维护类型', options: typeOptions, value: typeFilter, onChange: setTypeFilter, col: { span: 6 } },
    { type: 'select', placeholder: '状态', options: statusOptions, value: statusFilter, onChange: setStatusFilter, col: { span: 6 } },
  ]

  const handleReset = () => {
    setDeviceFilter(undefined)
    setTypeFilter(undefined)
    setStatusFilter(undefined)
  }

  const handleExport = () => {
    message.success(`已导出 ${filteredData.length} 条维修保养记录`)
  }

  const handleRefresh = () => {
    message.success('数据已刷新')
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
      actions={
        <Space>
          <Button icon={<ExportOutlined />} onClick={handleExport}>导出</Button>
        </Space>
      }
      table={
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="mt_id"
          size="small"
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
        />
      }
    />
  )
}
