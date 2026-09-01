import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Tag, Button, Space, Input, Select, Modal, Form, InputNumber,
  Popconfirm, Empty, Spin, Tooltip, message,
} from 'antd'
import {
  SearchOutlined, ReloadOutlined, PlusOutlined, EditOutlined,
  DeleteOutlined, CheckCircleOutlined, PauseCircleOutlined, PlayCircleOutlined,
  ToolOutlined, FileTextOutlined, AppstoreOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import type { StatItem } from '../../components/ThreeSectionPage'
import type { ColumnsType } from 'antd/es/table'
import api from '../../utils/api'
import { useMessage } from '../../contexts/AppContext'

// ===== 状态映射 =====
const STATUS_COLOR: Record<string, string> = {
  '编制': 'default',
  '生效': 'success',
  '停用': 'warning',
}
const STATUS_OPTIONS = [
  { label: '全部状态', value: '' },
  { label: '编制', value: '编制' },
  { label: '生效', value: '生效' },
  { label: '停用', value: '停用' },
]
const MODE_LABEL: Record<string, string> = {
  daily: '日点检',
  weekly: '周保养',
  monthly: '月保养',
  runtime: '运行时长',
}

interface ProfileRow {
  profile_id: number
  device_id: number
  device_code: string
  device_name: string
  status: '编制' | '生效' | '停用'
  version: number
  effective_date: string | null
  remarks?: string
  updated_at: string
  created_at: string
  std_count: number
  std_by_mode: { daily: number; weekly: number; monthly: number; runtime: number }
}

export default function DeviceMaintenanceStandardList() {
  const message = useMessage()
  const navigate = useNavigate()
  const [data, setData] = useState<ProfileRow[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [filters, setFilters] = useState({ keyword: '', status: '' })

  // 新增档案 Modal
  const [addOpen, setAddOpen] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [availableDevices, setAvailableDevices] = useState<any[]>([])
  const [addForm] = Form.useForm()

  // ===== 加载档案列表 =====
  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { page, page_size: pageSize }
      if (filters.keyword) params.keyword = filters.keyword
      if (filters.status) params.status = filters.status
      const res: any = await api.get('/basic/device-maintenance-profiles', { params })
      const raw = res?.data
      const list = Array.isArray(raw) ? raw : (raw?.list || [])
      setData(list)
      setTotal(res?.total || raw?.total || list.length)
    } catch (err: any) {
      message.error(err?.message || '加载档案列表失败')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, filters])

  useEffect(() => { loadList() }, [loadList])

  // ===== 加载可用设备（新增档案选择） =====
  const loadAvailableDevices = useCallback(async (keyword = '') => {
    try {
      const res: any = await api.get('/basic/device-maintenance-profiles/available-devices', {
        params: keyword ? { keyword } : {},
      })
      setAvailableDevices(res?.data || [])
    } catch { /* silent */ }
  }, [])

  const openAddModal = () => {
    addForm.resetFields()
    loadAvailableDevices()
    setAddOpen(true)
  }

  // ===== 创建档案 =====
  const handleCreate = async () => {
    const values = await addForm.validateFields()
    setAddLoading(true)
    try {
      const res: any = await api.post('/basic/device-maintenance-profiles', values)
      message.success('档案创建成功，请配置保养标准项')
      setAddOpen(false)
      // 跳转详情页配置标准项
      const deviceId = res?.data?.device_id || values.device_id
      navigate(`/device/maintenance-standard/${deviceId}`)
    } catch (err: any) {
      message.error(err?.message || '创建失败')
    } finally {
      setAddLoading(false)
    }
  }

  // ===== 切换档案状态 =====
  const handleSwitchStatus = async (row: ProfileRow, target: '编制' | '生效' | '停用') => {
    try {
      await api.put(`/basic/device-maintenance-profiles/${row.device_id}/status`, { status: target })
      message.success(`已切换为「${target}」`)
      loadList()
    } catch (err: any) {
      message.error(err?.message || '状态切换失败')
    }
  }

  // ===== 删除档案 =====
  const handleDelete = async (row: ProfileRow) => {
    try {
      await api.delete(`/basic/device-maintenance-profiles/${row.device_id}`)
      message.success('删除成功')
      loadList()
    } catch (err: any) {
      message.error(err?.message || '删除失败')
    }
  }

  // ===== 统计 =====
  const statItems: StatItem[] = [
    { label: '编制中', value: data.filter(r => r.status === '编制').length, color: '#8c8c8c', icon: <FileTextOutlined /> },
    { label: '生效中', value: data.filter(r => r.status === '生效').length, color: '#52c41a', icon: <CheckCircleOutlined /> },
    { label: '已停用', value: data.filter(r => r.status === '停用').length, color: '#faad14', icon: <PauseCircleOutlined /> },
    { label: '设备总数', value: total, color: '#1890ff', icon: <AppstoreOutlined /> },
  ]

  // ===== 列定义 =====
  const columns: ColumnsType<ProfileRow> = [
    {
      title: '设备', width: 200,
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.device_name || '-'}</div>
          <span style={{ fontSize: 12, color: '#999' }}>{r.device_code || '-'}</span>
        </div>
      ),
    },
    {
      title: '标准项数', width: 220,
      render: (_, r) => {
        if (r.std_count === 0) return <span style={{ color: '#999' }}>暂无</span>
        const parts: React.ReactNode[] = []
        ;(['daily', 'weekly', 'monthly', 'runtime'] as const).forEach(m => {
          const n = r.std_by_mode?.[m] || 0
          if (n > 0) parts.push(<Tag key={m} color="blue">{MODE_LABEL[m]} {n}</Tag>)
        })
        return <Space size={4} wrap>{parts}</Space>
      },
    },
    {
      title: '状态', width: 100,
      render: (_, r) => <Tag color={STATUS_COLOR[r.status]}>{r.status}</Tag>,
    },
    { title: '版本', dataIndex: 'version', width: 80, render: (v) => `v${v || 1}` },
    {
      title: '生效日期', dataIndex: 'effective_date', width: 120,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD') : '-',
    },
    {
      title: '操作', width: 240, fixed: 'right',
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" type="link" icon={<EditOutlined />}
            onClick={() => navigate(`/device/maintenance-standard/${r.device_id}`)}>编辑</Button>
          {r.status === '编制' && (
            <Popconfirm title="确认生效？生效后将按计划生成执行记录"
              onConfirm={() => handleSwitchStatus(r, '生效')}>
              <Button size="small" type="link" icon={<CheckCircleOutlined />}>生效</Button>
            </Popconfirm>
          )}
          {r.status === '生效' && (
            <Popconfirm title="确认停用？停用后不再生成新执行记录"
              onConfirm={() => handleSwitchStatus(r, '停用')}>
              <Button size="small" type="link" icon={<PauseCircleOutlined />}>停用</Button>
            </Popconfirm>
          )}
          {r.status === '停用' && (
            <Popconfirm title="确认重新生效？"
              onConfirm={() => handleSwitchStatus(r, '生效')}>
              <Button size="small" type="link" icon={<PlayCircleOutlined />}>生效</Button>
            </Popconfirm>
          )}
          <Popconfirm title="确认删除？将同时清除该设备所有标准项" onConfirm={() => handleDelete(r)}>
            <Button size="small" type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
    <ThreeSectionPage
      title="保养标准"
      breadcrumbs="设备管理 / 保养标准"
      stats={statItems}
      filter={
        <Space wrap>
          <Input
            placeholder="设备编号/名称搜索" allowClear prefix={<SearchOutlined />}
            style={{ width: 220 }}
            value={filters.keyword}
            onChange={(e) => setFilters(f => ({ ...f, keyword: e.target.value }))}
            onPressEnter={() => { setPage(1); loadList() }}
          />
          <Select
            style={{ width: 140 }}
            value={filters.status}
            onChange={(v) => { setFilters(f => ({ ...f, status: v })); setPage(1) }}
            options={STATUS_OPTIONS}
          />
          <Button icon={<ReloadOutlined />} onClick={() => { setPage(1); loadList() }}>刷新</Button>
        </Space>
      }
      actions={
        <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>新增设备标准</Button>
      }
      table={
        <Spin spinning={loading}>
          <Table
            rowKey="profile_id"
            columns={columns}
            dataSource={data}
            scroll={{ x: 1100 }}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (t) => `共 ${t} 台设备`,
              onChange: (p, ps) => { setPage(p); setPageSize(ps) },
            }}
            locale={{ emptyText: <Empty description="暂无保养标准档案，点击右上角「新增设备标准」创建" /> }}
          />
        </Spin>
      }
    />

    {/* ===== 新增档案 Modal ===== */}
    <Modal
      title="新增设备维护标准档案"
      open={addOpen}
      confirmLoading={addLoading}
      onOk={handleCreate}
      onCancel={() => setAddOpen(false)}
      okText="创建并配置"
      cancelText="取消"
      width={520}
    >
      <Form form={addForm} layout="vertical">
        <Form.Item name="device_id" label="选择设备" rules={[{ required: true, message: '请选择设备' }]}>
          <Select
            showSearch
            placeholder="选择尚未配置标准的设备"
            filterOption={false}
            onSearch={loadAvailableDevices}
            notFoundContent={availableDevices.length === 0 ? '暂无可用设备（所有设备均已配置）' : null}
            options={availableDevices.map(d => ({
              label: `${d.device_code} ${d.device_name}`,
              value: d.device_id,
            }))}
          />
        </Form.Item>
        <Form.Item name="remarks" label="备注">
          <Input.TextArea rows={2} placeholder="可选" />
        </Form.Item>
        <div style={{ color: '#999', fontSize: 12 }}>
          创建后档案状态为「编制」，配置保养标准项后可「生效」，生效后按计划生成执行记录。
        </div>
      </Form>
    </Modal>
    </>
  )
}
