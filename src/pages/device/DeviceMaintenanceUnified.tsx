import React, { useState, useEffect, useCallback } from 'react'
import {
  Tag, Button, Select, DatePicker, Space, Input, Drawer, Form, Descriptions,
  Typography, message, Modal, Popconfirm, Empty, Spin, Radio, Table, Checkbox, InputNumber,
} from 'antd'
import {
  ToolOutlined, ClockCircleOutlined, CheckCircleOutlined, SearchOutlined,
  ReloadOutlined, PlusOutlined, SettingOutlined, EditOutlined, EyeOutlined,
  DeleteOutlined, ThunderboltOutlined, DashboardOutlined, PrinterOutlined, AppstoreOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import type { StatItem } from '../../components/ThreeSectionPage'
import dayjs from 'dayjs'
import api from '../../utils/api'

const { RangePicker } = DatePicker
const { TextArea } = Input
const { Title, Text } = Typography

// ===== 状态映射 =====
const STATUS_COLOR: Record<string, string> = {
  '待执行': 'default',
  '执行中': 'processing',
  '已完成': 'success',
  '跳过': 'warning',
}
const MODE_LABEL: Record<string, string> = {
  daily: '每日',
  weekly: '每周',
  monthly: '每月',
  runtime: '运行时长',
}
const MODE_COLOR: Record<string, string> = {
  daily: 'green',
  weekly: 'blue',
  monthly: 'purple',
  runtime: 'orange',
}
const RESULT_COLOR: Record<string, string> = {
  '正常': 'success',
  '异常': 'error',
}

const STATUS_OPTIONS = [
  { label: '待执行', value: '待执行' },
  { label: '执行中', value: '执行中' },
  { label: '已完成', value: '已完成' },
  { label: '跳过', value: '跳过' },
]
const MODE_OPTIONS = [
  { label: '每日点检', value: 'daily' },
  { label: '每周保养', value: 'weekly' },
  { label: '每月保养', value: 'monthly' },
  { label: '运行时长', value: 'runtime' },
]
const JUDGE_OPTIONS = [
  { label: '定性（正常/异常）', value: '定性' },
  { label: '定量（数值范围）', value: '定量' },
]

interface DeviceOption { device_id: number; device_code: string; device_name: string }

export default function DeviceMaintenanceUnified() {
  const navigate = useNavigate()
  // ============ 执行记录列表 ============
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const [filters, setFilters] = useState({
    device_id: undefined as number | undefined,
    trigger_mode: undefined as string | undefined,
    status: undefined as string | undefined,
    start_date: undefined as string | undefined,
    end_date: undefined as string | undefined,
    keyword: '',
  })

  // ============ 标准管理 Drawer ============
  const [stdDrawerOpen, setStdDrawerOpen] = useState(false)
  const [stdForm] = Form.useForm()
  const [standards, setStandards] = useState<any[]>([])
  const [stdDevices, setStdDevices] = useState<DeviceOption[]>([])
  const [editingStd, setEditingStd] = useState<any>(null)

  // ============ 详情 Drawer ============
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailData, setDetailData] = useState<any>(null)

  // ============ 设备下拉 ============
  const [devices, setDevices] = useState<DeviceOption[]>([])

  // ============ 生成弹窗 ============
  const [genOpen, setGenOpen] = useState(false)
  const [genLoading, setGenLoading] = useState(false)
  const [genModes, setGenModes] = useState<string[]>(['daily', 'weekly', 'monthly', 'runtime'])
  const [genDeviceId, setGenDeviceId] = useState<number | undefined>(undefined)
  const [genDate, setGenDate] = useState<string>(dayjs().format('YYYY-MM-DD'))

  // ===== 加载设备列表 =====
  useEffect(() => {
    api.get('/basic/devices', { params: { page_size: 999 } }).then((res: any) => {
      const raw = res?.data
      const list = Array.isArray(raw) ? raw : (raw?.rows || raw?.list || [])
      const opts = list.map((d: any) => ({
        device_id: d.device_id,
        device_code: d.device_code,
        device_name: d.device_name,
      }))
      setDevices(opts)
      setStdDevices(opts)
    }).catch(() => { /* silent */ })
  }, [])

  // ===== 加载执行记录 =====
  const loadRecords = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { page, page_size: pageSize, ...filters }
      if (!filters.start_date) delete params.start_date
      if (!filters.end_date) delete params.end_date
      if (!filters.device_id) delete params.device_id
      if (!filters.trigger_mode) delete params.trigger_mode
      if (!filters.status) delete params.status
      const res = await api.get('/basic/device-records', { params })
      const raw = res?.data
      const list = Array.isArray(raw) ? raw : (raw?.rows || raw?.list || [])
      setRecords(list)
      setTotal(res?.total || raw?.total || list.length)
    } catch (err: any) {
      message.error('加载执行记录失败')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, filters])

  useEffect(() => { loadRecords() }, [loadRecords])

  // ===== 加载标准 =====
  const loadStandards = useCallback(async (deviceId?: number) => {
    try {
      const res = await api.get('/basic/device-standards', {
        params: deviceId ? { device_id: deviceId } : {},
      })
      // 后端返回 { success, data: { list, total } }，兼容数组/对象两种格式
      const raw = res?.data
      const list = Array.isArray(raw) ? raw : (raw?.list || raw?.rows || [])
      setStandards(list)
    } catch { /* silent */ }
  }, [])

  // ===== 生成执行记录 =====
  const handleGenerate = async () => {
    setGenLoading(true)
    try {
      const payload: any = { mode: genModes, target_date: genDate }
      if (genDeviceId) payload.device_id = genDeviceId
      const res = await api.post('/basic/device-records/generate', payload)
      message.success(res?.message || `成功生成 ${res?.data?.created || 0} 条`)
      setGenOpen(false)
      loadRecords()
    } catch (err: any) {
      message.error(err?.message || '生成失败')
    } finally {
      setGenLoading(false)
    }
  }

  // ===== 开始执行 =====
  const handleStart = async (id: number) => {
    try {
      const res = await api.put(`/basic/device-records/${id}/start`, {})
      message.success(res?.message || '已开始执行')
      loadRecords()
    } catch (err: any) {
      message.error(err?.message || '操作失败')
    }
  }

  // ===== 跳过 =====
  const handleSkip = async (id: number) => {
    try {
      const res = await api.put(`/basic/device-records/${id}/skip`, {})
      message.success(res?.message || '已标记为跳过')
      loadRecords()
    } catch (err: any) {
      message.error(err?.message || '操作失败')
    }
  }

  // ===== 详情 =====
  const handleDetail = async (id: number) => {
    try {
      const res = await api.get(`/basic/device-records/${id}`)
      setDetailData(res?.data || res)
      setDetailOpen(true)
    } catch {
      message.error('加载详情失败')
    }
  }

  // ===== 删除 =====
  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/basic/device-records/${id}`)
      message.success('删除成功')
      loadRecords()
    } catch (err: any) {
      message.error(err?.message || '删除失败')
    }
  }

  // ===== 标准管理 =====
  const openStdDrawer = () => {
    loadStandards()
    setEditingStd(null)
    stdForm.resetFields()
    setStdDrawerOpen(true)
  }
  const handleSaveStd = async () => {
    const values = await stdForm.validateFields()
    try {
      const payload = { ...values }
      // monthly_plan: Checkbox.Group 返回被选中索引数组，后端需要 12 位布尔数组
      if (values.trigger_mode === 'monthly') {
        const mp = Array(12).fill(false)
        if (Array.isArray(values.monthly_plan)) {
          values.monthly_plan.forEach((idx: number) => {
            if (typeof idx === 'number' && idx >= 0 && idx < 12) mp[idx] = true
          })
        }
        payload.monthly_plan = mp
      } else {
        payload.monthly_plan = null
      }
      // runtime: 默认空
      if (values.trigger_mode !== 'runtime') payload.runtime_threshold = null

      if (editingStd) {
        await api.put(`/basic/device-standards/${editingStd.standard_id}`, payload)
        message.success('更新成功')
      } else {
        await api.post('/basic/device-standards', payload)
        message.success('创建成功')
      }
      setEditingStd(null)
      stdForm.resetFields()
      loadStandards()
    } catch (err: any) {
      if (err?.message) message.error(err.message)
    }
  }
  const handleEditStd = (row: any) => {
    setEditingStd(row)
    // monthly_plan 后端存储为 12 位布尔数组，Checkbox.Group 需要被选中索引数组
    const mpRaw = Array.isArray(row.monthly_plan) ? row.monthly_plan : []
    const mpIndices = mpRaw.map((v: boolean, i: number) => v ? i : -1).filter((v: number) => v >= 0)
    stdForm.setFieldsValue({
      device_id: row.device_id,
      item_name: row.item_name,
      mechanism: row.mechanism,
      component: row.component,
      location: row.location,
      maintenance_method: row.maintenance_method,
      maintenance_content: row.maintenance_content,
      judge_type: row.judge_type || '定性',
      standard_value: row.standard_value,
      unit: row.unit,
      point_count: row.point_count || 1,
      time_per_point: row.time_per_point || 0,
      trigger_mode: row.trigger_mode || 'daily',
      monthly_plan: mpIndices,
      runtime_threshold: row.runtime_threshold || null,
      sort_order: row.sort_order || 0,
      status: row.status,
      remarks: row.remarks,
    })
  }
  const handleDeleteStd = async (id: number) => {
    try {
      await api.delete(`/basic/device-standards/${id}`)
      message.success('删除成功')
      loadStandards()
    } catch (err: any) {
      message.error(err?.message || '删除失败')
    }
  }

  // ===== 统计 =====
  const statItems: StatItem[] = [
    { label: '待执行', value: records.filter(r => r.status === '待执行').length, color: '#faad14', icon: <ClockCircleOutlined /> },
    { label: '执行中', value: records.filter(r => r.status === '执行中').length, color: '#1890ff', icon: <ToolOutlined /> },
    { label: '已完成', value: records.filter(r => r.status === '已完成').length, color: '#52c41a', icon: <CheckCircleOutlined /> },
    { label: '异常项', value: records.filter(r => r.result === '异常').length, color: '#f5222d', icon: <ThunderboltOutlined /> },
    { label: '总记录数', value: total, color: '#722ed1', icon: <DashboardOutlined /> },
  ]

  // ===== 列定义 =====
  const columns = [
    { title: '记录编号', dataIndex: 'record_no', width: 160 },
    {
      title: '设备', width: 180, render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.device_name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.device_code}</Text>
        </div>
      ),
    },
    {
      title: '保养项', width: 200, render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.standard?.item_name || '-'}</div>
          {r.standard?.mechanism && <Text type="secondary" style={{ fontSize: 12 }}>{r.standard.mechanism}</Text>}
        </div>
      ),
    },
    {
      title: '频率', width: 90, render: (_: any, r: any) => (
        <Tag color={MODE_COLOR[r.trigger_mode]}>{MODE_LABEL[r.trigger_mode] || r.trigger_mode}</Tag>
      ),
    },
    { title: '周期', dataIndex: 'period_key', width: 120 },
    {
      title: '状态', width: 90, render: (_: any, r: any) => (
        <Tag color={STATUS_COLOR[r.status]}>{r.status}</Tag>
      ),
    },
    {
      title: '结果', width: 90, render: (_: any, r: any) => r.result
        ? <Tag color={RESULT_COLOR[r.result]}>{r.result}</Tag>
        : <Text type="secondary">-</Text>,
    },
    { title: '执行人', dataIndex: 'executor_name', width: 100, render: (v: string) => v || '-' },
    {
      title: '创建时间', dataIndex: 'created_at', width: 160,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作', width: 220, fixed: 'right' as const, render: (_: any, r: any) => (
        <Space size={4}>
          <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => handleDetail(r.record_id)}>详情</Button>
          {r.status === '待执行' && (
            <Button size="small" type="link" icon={<ToolOutlined />} onClick={() => handleStart(r.record_id)}>开始</Button>
          )}
          {r.status !== '已完成' && r.status !== '跳过' && (
            <Button size="small" type="link" onClick={() => handleSkip(r.record_id)}>跳过</Button>
          )}
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.record_id)}>
            <Button size="small" type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // ===== 标准列 =====
  const stdCols = [
    { title: '设备', width: 150, render: (_: any, r: any) => (
      <div>
        <div>{r.device_name || '-'}</div>
        <Text type="secondary" style={{ fontSize: 12 }}>{r.device_code || '-'}</Text>
      </div>
    )},
    { title: '频率', width: 90, render: (_: any, r: any) => (
      <Tag color={MODE_COLOR[r.trigger_mode]}>{MODE_LABEL[r.trigger_mode] || r.trigger_mode}</Tag>
    )},
    { title: '保养项', dataIndex: 'item_name', width: 180 },
    { title: '机构', dataIndex: 'mechanism', width: 120, render: (v: string) => v || '-' },
    { title: '部件', dataIndex: 'component', width: 120, render: (v: string) => v || '-' },
    { title: '部位', dataIndex: 'location', width: 120, render: (v: string) => v || '-' },
    { title: '保养方法', dataIndex: 'maintenance_method', width: 120, render: (v: string) => v || '-' },
    { title: '判定方式', dataIndex: 'judge_type', width: 90 },
    { title: '判定基准', dataIndex: 'standard_value', width: 160, ellipsis: true, render: (v: string) => v || '-' },
    {
      title: '周期配置', width: 200, render: (_: any, r: any) => {
        if (r.trigger_mode === 'monthly') {
          const mp: boolean[] = r.monthly_plan || []
          const activeMonths = mp.map((v, i) => v ? i + 1 : 0).filter(v => v > 0)
          return activeMonths.length > 0 ? activeMonths.join('月 ') + '月' : '-'
        }
        if (r.trigger_mode === 'runtime') return `${r.runtime_threshold}h`
        return r.trigger_mode === 'daily' ? '每天' : r.trigger_mode === 'weekly' ? '每周' : '-'
      },
    },
    { title: '状态', width: 80, render: (_: any, r: any) => (
      <Tag color={r.status === 1 ? 'success' : 'default'}>{r.status === 1 ? '启用' : '禁用'}</Tag>
    )},
    {
      title: '操作', width: 150, fixed: 'right' as const, render: (_: any, r: any) => (
        <Space>
          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => handleEditStd(r)}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDeleteStd(r.standard_id)}>
            <Button size="small" type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
    <ThreeSectionPage
      title="设备保养（点检+维护）"
      breadcrumbs="设备管理 / 设备保养"
      stats={statItems}
      filter={
        <Space wrap>
          <Select
            placeholder="全部设备" allowClear
            style={{ width: 200 }}
            value={filters.device_id}
            onChange={(v) => setFilters(f => ({ ...f, device_id: v, page: 1 }))}
            options={[{ label: '全部设备', value: undefined, disabled: true }, ...devices.map(d => ({
              label: `${d.device_code} ${d.device_name}`,
              value: d.device_id,
            }))]}
          />
          <Select
            placeholder="全部频率" allowClear
            style={{ width: 140 }}
            value={filters.trigger_mode}
            onChange={(v) => setFilters(f => ({ ...f, trigger_mode: v, page: 1 }))}
            options={MODE_OPTIONS}
          />
          <Select
            placeholder="全部状态" allowClear
            style={{ width: 120 }}
            value={filters.status}
            onChange={(v) => setFilters(f => ({ ...f, status: v, page: 1 }))}
            options={STATUS_OPTIONS}
          />
          <RangePicker
            style={{ width: 240 }}
            onChange={(ds) => {
              setFilters(f => ({
                ...f,
                start_date: ds?.[0]?.format('YYYY-MM-DD'),
                end_date: ds?.[1]?.format('YYYY-MM-DD'),
                page: 1,
              }))
            }}
          />
          <Input
            placeholder="编号/设备名搜索" allowClear prefix={<SearchOutlined />}
            style={{ width: 200 }}
            value={filters.keyword}
            onChange={(e) => setFilters(f => ({ ...f, keyword: e.target.value }))}
          />
        </Space>
      }
      actions={
        <Space>
          <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => {
            setGenModes(['daily', 'weekly', 'monthly', 'runtime'])
            setGenDeviceId(filters.device_id)
            setGenDate(dayjs().format('YYYY-MM-DD'))
            setGenOpen(true)
          }}>生成执行记录</Button>
          <Button icon={<SettingOutlined />} onClick={openStdDrawer}>保养标准管理</Button>
          <Button
            icon={<AppstoreOutlined />}
            disabled={!filters.device_id}
            onClick={() => navigate(
              `/device/maintenance/matrix?device_id=${filters.device_id}&year_month=${dayjs().format('YYYY-MM')}`
            )}
          >矩阵视图</Button>
          <Button
            icon={<PrinterOutlined />}
            disabled={!filters.device_id}
            onClick={() => window.open(
              `/device/maintenance/print?device_id=${filters.device_id}&year_month=${dayjs().format('YYYY-MM')}`,
              '_blank', 'width=1280,height=800'
            )}
          >打印</Button>
          <Button icon={<ReloadOutlined />} onClick={() => { setPage(1); loadRecords() }}>刷新</Button>
        </Space>
      }
      table={
        <Spin spinning={loading}>
          <Table
            rowKey="record_id"
            columns={columns}
            dataSource={records}
            scroll={{ x: 1400 }}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (t) => `共 ${t} 条`,
              onChange: (p, ps) => { setPage(p); setPageSize(ps) },
            }}
            locale={{ emptyText: <Empty description="暂无执行记录" /> }}
          />
        </Spin>
      }
    />

    {/* ===== 生成执行记录弹窗 ===== */}
      <Modal
        title="生成保养执行记录"
        open={genOpen}
        confirmLoading={genLoading}
        onOk={handleGenerate}
        onCancel={() => setGenOpen(false)}
        okText="生成"
        cancelText="取消"
      >
        <div style={{ marginBottom: 12 }}>
          <Text>触发频率：</Text>
          <Checkbox.Group
            value={genModes}
            onChange={(v) => setGenModes(v as string[])}
            options={MODE_OPTIONS}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <Text>目标日期：</Text>
          <DatePicker
            value={dayjs(genDate)}
            onChange={(d) => setGenDate(d?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'))}
            format="YYYY-MM-DD"
          />
        </div>
        <div>
          <Text>限定设备（可选，不选则为全部设备）：</Text>
          <Select
            placeholder="全部设备" allowClear
            style={{ width: 280 }}
            value={genDeviceId}
            onChange={setGenDeviceId}
            options={[{ label: '全部设备', value: undefined, disabled: true }, ...stdDevices.map(d => ({
              label: `${d.device_code} ${d.device_name}`,
              value: d.device_id,
            }))]}
          />
        </div>
      </Modal>

      {/* ===== 标准管理 Drawer ===== */}
      <Drawer
        title={editingStd ? '编辑保养标准' : '保养标准管理'}
        open={stdDrawerOpen}
        width={editingStd ? 720 : 1200}
        onClose={() => { setStdDrawerOpen(false); setEditingStd(null); stdForm.resetFields() }}
      >
        {!editingStd ? (
          <div>
            <Space style={{ marginBottom: 12 }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                stdForm.resetFields()
                stdForm.setFieldsValue({
                  judge_type: '定性',
                  trigger_mode: 'daily',
                  status: 1,
                  point_count: 1,
                  time_per_point: 0,
                  monthly_plan: Array(12).fill(false),
                })
                setEditingStd({})
              }}>新增保养标准</Button>
            </Space>
            <Table
              rowKey="standard_id"
              columns={stdCols}
              dataSource={standards}
              scroll={{ x: 1600 }}
              pagination={{ pageSize: 15, showSizeChanger: true }}
              size="small"
              locale={{ emptyText: '暂无保养标准' }}
            />
          </div>
        ) : (
          <Form
            form={stdForm}
            layout="vertical"
            initialValues={{
              judge_type: '定性',
              trigger_mode: 'daily',
              status: 1,
              point_count: 1,
              time_per_point: 0,
              monthly_plan: Array(12).fill(false),
            }}
          >
            <Title level={5}>基础信息</Title>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item name="device_id" label="设备" rules={[{ required: true, message: '请选择设备' }]}>
                <Select
                  placeholder="请选择设备"
                  options={stdDevices.map(d => ({
                    label: `${d.device_code} ${d.device_name}`,
                    value: d.device_id,
                  }))}
                />
              </Form.Item>
              <Form.Item name="sort_order" label="排序">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </div>

            <Title level={5}>模板左列字段</Title>
            <Form.Item name="item_name" label="保养项名称" rules={[{ required: true, message: '请填写' }]}>
              <Input placeholder="如：清理冷凝器两侧绒毛飞絮" />
            </Form.Item>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item name="mechanism" label="机构">
                <Input placeholder="如：压缩机冷热机" />
              </Form.Item>
              <Form.Item name="component" label="部件">
                <Input placeholder="如：交换管" />
              </Form.Item>
              <Form.Item name="location" label="部位">
                <Input placeholder="如：排风扇" />
              </Form.Item>
              <Form.Item name="maintenance_method" label="保养方法">
                <Input placeholder="如：定期点检 / 定期清理" />
              </Form.Item>
            </div>
            <Form.Item name="maintenance_content" label="保养内容">
              <TextArea rows={2} placeholder="具体保养动作描述" />
            </Form.Item>

            <Title level={5}>参数</Title>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item name="judge_type" label="判定方式">
                <Radio.Group options={JUDGE_OPTIONS} />
              </Form.Item>
              <Form.Item name="unit" label="单位">
                <Input placeholder="如：℃ / hPa" />
              </Form.Item>
            </div>
            <Form.Item name="standard_value" label="判定基准">
              <Input placeholder="如：冷凝器两侧干净无绒毛飞絮、≤60℃" />
            </Form.Item>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item name="point_count" label="保养点位件数">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="time_per_point" label="单件保养时间(分钟)">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </div>

            <Title level={5}>触发频率（四种互斥）</Title>
            <Form.Item name="trigger_mode" rules={[{ required: true, message: '请选择触发频率' }]}>
              <Radio.Group>
                <Radio value="daily">每日点检</Radio>
                <Radio value="weekly">每周保养</Radio>
                <Radio value="monthly">每月保养</Radio>
                <Radio value="runtime">运行时长</Radio>
              </Radio.Group>
            </Form.Item>
            <Form.Item shouldUpdate={(prev, cur) => prev.trigger_mode !== cur.trigger_mode}>
              {({ getFieldValue }) => {
                const mode = getFieldValue('trigger_mode')
                if (mode === 'monthly') {
                  return (
                    <Form.Item name="monthly_plan" label="月度计划（勾选哪些月份执行）">
                      <Checkbox.Group
                        style={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: '4px 8px' }}
                        options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => ({ label: `${m}月`, value: m - 1 }))}
                      />
                    </Form.Item>
                  )
                }
                if (mode === 'runtime') {
                  return (
                    <Form.Item name="runtime_threshold" label="运行时长阈值（小时）" rules={[{ required: true, message: '请填写运行时长阈值' }]}>
                      <InputNumber min={1} step={100} style={{ width: '100%' }} placeholder="如：500" />
                    </Form.Item>
                  )
                }
                return <Text type="secondary">{mode === 'daily' ? '每天自动生成一条执行记录' : '每周一自动生成一条执行记录'}</Text>
              }}
            </Form.Item>

            <Title level={5}>其他</Title>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item name="status" label="状态">
                <Radio.Group>
                  <Radio value={1}>启用</Radio>
                  <Radio value={0}>禁用</Radio>
                </Radio.Group>
              </Form.Item>
            </div>
            <Form.Item name="remarks" label="备注">
              <TextArea rows={2} />
            </Form.Item>

            <Space>
              <Button type="primary" onClick={handleSaveStd}>保存</Button>
              <Button onClick={() => { setEditingStd(null); stdForm.resetFields() }}>返回列表</Button>
            </Space>
          </Form>
        )}
      </Drawer>

      {/* ===== 详情 Drawer ===== */}
      <Drawer
        title={`执行记录详情 ${detailData?.record_no || ''}`}
        open={detailOpen}
        width={640}
        onClose={() => setDetailOpen(false)}
      >
        {detailData && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="记录编号">{detailData.record_no}</Descriptions.Item>
            <Descriptions.Item label="设备">{detailData.device_name} ({detailData.device_code})</Descriptions.Item>
            <Descriptions.Item label="保养项">{detailData.standard?.item_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="频率">
              <Tag color={MODE_COLOR[detailData.trigger_mode]}>{MODE_LABEL[detailData.trigger_mode]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="周期">{detailData.period_key}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={STATUS_COLOR[detailData.status]}>{detailData.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="结果">
              {detailData.result ? <Tag color={RESULT_COLOR[detailData.result]}>{detailData.result}</Tag> : '-'}
            </Descriptions.Item>
            {detailData.actual_value && <Descriptions.Item label="实测值">{detailData.actual_value}</Descriptions.Item>}
            {detailData.abnormal_desc && <Descriptions.Item label="异常描述">{detailData.abnormal_desc}</Descriptions.Item>}
            <Descriptions.Item label="执行人">{detailData.executor_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="开始时间">{detailData.start_time ? dayjs(detailData.start_time).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
            <Descriptions.Item label="结束时间">{detailData.end_time ? dayjs(detailData.end_time).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
            {detailData.duration_min && <Descriptions.Item label="耗时">{detailData.duration_min} 分钟</Descriptions.Item>}
            {detailData.remarks && <Descriptions.Item label="备注">{detailData.remarks}</Descriptions.Item>}
          </Descriptions>
        )}
      </Drawer>
    </>
  )
}
