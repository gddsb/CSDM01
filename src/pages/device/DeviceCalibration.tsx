import ResizableTable from '../../components/ResizableTable'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Tag, Button, Select, DatePicker, Space, Input, Drawer, Form, Descriptions,
  Typography, Alert, message, Modal, Popconfirm, Upload, Image, InputNumber,
  Empty, Spin, Radio, Table, Checkbox,
} from 'antd'
import type { UploadFile } from 'antd'
import {
  ExperimentOutlined, SafetyCertificateOutlined, WarningOutlined,
  CheckCircleOutlined, SearchOutlined, ReloadOutlined, PlusOutlined,
  EditOutlined, EyeOutlined, UploadOutlined, DeleteOutlined, LockOutlined, UnlockOutlined,
} from '@ant-design/icons'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import type { StatItem } from '../../components/ThreeSectionPage'
import { MONTH_QUICK_OPTIONS, getMonthRange, validateRange } from '../../utils/monthQuick'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import api from '../../utils/api'

const { RangePicker } = DatePicker
const { Title, Text } = Typography

// 状态颜色映射
const statusColor: Record<string, string> = {
  '待校准': 'default', '已校准': 'success', '已超期': 'error', '已锁定': 'warning',
}

const STATUS_OPTIONS = [
  { label: '待校准', value: '待校准' },
  { label: '已校准', value: '已校准' },
  { label: '已超期', value: '已超期' },
  { label: '已锁定', value: '已锁定' },
]
const DEFAULT_STATUS = ['待校准', '已校准', '已超期', '已锁定']

const RESULT_OPTIONS = [
  { label: '合格', value: '合格' },
  { label: '不合格', value: '不合格' },
]

const CYCLE_OPTIONS = [
  { label: '3个月', value: 3 },
  { label: '6个月', value: 6 },
  { label: '12个月', value: 12 },
  { label: '24个月', value: 24 },
]

const resultColor: Record<string, string> = { '合格': 'success', '不合格': 'error' }

const uid = () => Math.random().toString(36).slice(2, 10)

// 校准项目行（计划维护）
interface CalibItemRow {
  key: string
  item_name: string
  standard_value: string
}

type DrawerMode = 'create' | 'edit' | null

export default function DeviceCalibration() {
  // ============ 列表数据 ============
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })

  // ============ 筛选条件 ============
  const [deviceName, setDeviceName] = useState<string | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState<string[]>([...DEFAULT_STATUS])
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [monthQuick, setMonthQuick] = useState<string | undefined>(undefined)
  const [rangeWarn, setRangeWarn] = useState(false)

  // ============ 统计 ============
  const [pendingCount, setPendingCount] = useState(0)
  const [expiringCount, setExpiringCount] = useState(0)
  const [overdueCount, setOverdueCount] = useState(0)

  // ============ 详情 Drawer ============
  const [detailOpen, setDetailOpen] = useState(false)
  const [currentDetail, setCurrentDetail] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // ============ 新建/编辑 Modal ============
  const [formVisible, setFormVisible] = useState(false)
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [editRecord, setEditRecord] = useState<any>(null)
  const [editItems, setEditItems] = useState<CalibItemRow[]>([])
  const [form] = Form.useForm()

  // ============ 提交校准 Modal ============
  const [submitOpen, setSubmitOpen] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitPlan, setSubmitPlan] = useState<any>(null)
  const [certFileList, setCertFileList] = useState<UploadFile[]>([])
  const [submitForm] = Form.useForm()

  // ============ 通用下拉数据 ============
  const [devices, setDevices] = useState<any[]>([])

  // ============ 获取列表 ============
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
      if (deviceName) params.device_name = deviceName
      if (statusFilter && statusFilter.length > 0) params.status = statusFilter.join(',')
      if (dateRange && dateRange[0]) params.start_date = dateRange[0].format('YYYY-MM-DD')
      if (dateRange && dateRange[1]) params.end_date = dateRange[1].format('YYYY-MM-DD')

      const res = await api.get('/basic/device-calibration-plans', { params })
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
  }, [pagination.current, pagination.pageSize, deviceName, statusFilter, dateRange])

  useEffect(() => { fetchData() }, [fetchData])

  // ============ 获取统计 ============
  const fetchStats = useCallback(async () => {
    try {
      const [pendingRes, expiringRes, overdueRes] = await Promise.all([
        api.get('/basic/device-calibration-plans', { params: { page: 1, page_size: 1, status: '待校准' } }),
        api.get('/basic/device-calibration-plans/expiring/list'),
        api.get('/basic/device-calibration-plans/overdue/list'),
      ])
      setPendingCount(pendingRes.success !== false ? (pendingRes.data?.total || pendingRes.total || 0) : 0)
      setExpiringCount(expiringRes.success !== false ? (expiringRes.data?.total || expiringRes.data?.list?.length || 0) : 0)
      setOverdueCount(overdueRes.success !== false ? (overdueRes.data?.total || overdueRes.data?.list?.length || 0) : 0)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  // ============ 加载设备下拉 ============
  const loadDevices = useCallback(async () => {
    try {
      const res = await api.get('/basic/devices', { params: { page: 1, page_size: 500 } })
      if (res.success !== false) {
        const list = res.data?.list || res.data || []
        setDevices(Array.isArray(list) ? list : [])
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => { loadDevices() }, [loadDevices])

  const deviceOptions = useMemo(() =>
    devices.map((d: any) => ({
      label: `${d.device_name || ''}${d.device_code ? ' (' + d.device_code + ')' : ''}`,
      value: d.device_id ?? d.id,
      raw: d,
    })), [devices])

  // ============ 统计卡片 ============
  const stats: StatItem[] = useMemo(() => [
    { label: '总计量器具数', value: pagination.total, icon: <ExperimentOutlined />, color: '#2196F3' },
    { label: '待校准', value: pendingCount, icon: <CheckCircleOutlined />, color: '#FF9800' },
    { label: '即将到期(30天内)', value: expiringCount, icon: <SafetyCertificateOutlined />, color: '#00BCD4' },
    { label: '已超期', value: overdueCount, icon: <WarningOutlined />, color: '#F44336' },
  ], [pagination.total, pendingCount, expiringCount, overdueCount])

  // ============ 工具方法 ============
  const isOverdue = useCallback((r: any) => {
    if (!r?.next_calibration_date) return false
    if (r.status === '已校准' || r.status === '已锁定') return false
    return dayjs(r.next_calibration_date).isBefore(dayjs().startOf('day'))
  }, [])

  // ============ 筛选处理 ============
  const handleMonthQuick = (v: string) => {
    setMonthQuick(v)
    setDateRange(getMonthRange(v))
  }
  const handleRangeChange = (v: any) => {
    setMonthQuick(undefined)
    setDateRange(v as [Dayjs, Dayjs] | null)
  }
  const handleReset = () => {
    setDeviceName(undefined)
    setStatusFilter([...DEFAULT_STATUS])
    setMonthQuick(undefined)
    setDateRange(null)
    setPagination(p => ({ ...p, current: 1 }))
  }

  // ============ 详情 ============
  const showDetail = async (record: any) => {
    setCurrentDetail(record)
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const res = await api.get(`/basic/device-calibration-plans/${record.plan_id}`)
      if (res.success !== false && res.data) {
        setCurrentDetail(res.data)
      }
    } catch (e: any) {
      message.error(e?.message || '加载详情失败')
    } finally {
      setDetailLoading(false)
    }
  }

  // ============ 新建 ============
  const handleCreate = () => {
    setDrawerMode('create')
    setEditRecord(null)
    setEditItems([])
    form.resetFields()
    form.setFieldsValue({ calibration_cycle: 12 })
    setFormVisible(true)
  }

  // ============ 编辑 ============
  const handleEdit = async (record: any) => {
    try {
      const res = await api.get(`/basic/device-calibration-plans/${record.plan_id}`)
      const detail = res.data || record
      setEditRecord(detail)
      setDrawerMode('edit')
      const items: CalibItemRow[] = (detail.calibration_items || []).map((it: any) => ({
        key: uid(),
        item_name: it.item_name || '',
        standard_value: it.standard_value || '',
      }))
      setEditItems(items)
      form.setFieldsValue({
        device_id: detail.device_id,
        calibration_cycle: detail.calibration_cycle,
        last_calibration_date: detail.last_calibration_date ? dayjs(detail.last_calibration_date) : undefined,
        calibration_org: detail.calibration_org || '',
        status: detail.status,
        remarks: detail.remarks || '',
      })
      setFormVisible(true)
    } catch (e: any) {
      message.error(e?.message || '加载详情失败')
    }
  }

  // ============ 保存（新建/编辑）============
  const handleFormSave = async () => {
    try {
      const values = await form.validateFields()
      const device = devices.find((d: any) => (d.device_id ?? d.id) === values.device_id)
      const payload: any = {
        device_id: values.device_id,
        device_code: device?.device_code,
        device_name: device?.device_name,
        calibration_cycle: values.calibration_cycle,
        last_calibration_date: values.last_calibration_date ? values.last_calibration_date.format('YYYY-MM-DD') : null,
        calibration_org: values.calibration_org || '',
        calibration_items: editItems.filter(it => it.item_name).map(it => ({ item_name: it.item_name, standard_value: it.standard_value })),
        remarks: values.remarks || '',
      }
      if (drawerMode === 'edit') payload.status = values.status

      setFormLoading(true)
      if (drawerMode === 'create') {
        const res = await api.post('/basic/device-calibration-plans', payload)
        if (res.success !== false) {
          message.success('创建成功')
          setFormVisible(false)
          setPagination(p => ({ ...p, current: 1 }))
          fetchData()
          fetchStats()
        } else {
          message.error(res.message || '创建失败')
        }
      } else if (drawerMode === 'edit' && editRecord) {
        const res = await api.put(`/basic/device-calibration-plans/${editRecord.plan_id}`, payload)
        if (res.success !== false) {
          message.success('保存成功')
          setFormVisible(false)
          fetchData()
          fetchStats()
        } else {
          message.error(res.message || '保存失败')
        }
      }
    } catch (e: any) {
      if (e?.message?.includes('validate') || e?.errorFields) return
      message.error(e?.message || '保存失败，请重试')
    } finally {
      setFormLoading(false)
    }
  }

  // ============ 删除 ============
  const handleDelete = async (record: any) => {
    try {
      const res = await api.delete(`/basic/device-calibration-plans/${record.plan_id}`)
      if (res.success !== false) {
        message.success('删除成功')
        fetchData()
        fetchStats()
      } else {
        message.error(res.message || '删除失败')
      }
    } catch (e: any) {
      message.error(e?.message || '删除失败')
    }
  }

  // ============ 锁定/解锁 ============
  const handleToggleLock = async (record: any) => {
    const next = record.status === '已锁定' ? '待校准' : '已锁定'
    try {
      const res = await api.put(`/basic/device-calibration-plans/${record.plan_id}`, { status: next })
      if (res.success !== false) {
        message.success(next === '已锁定' ? '已锁定' : '已解锁')
        fetchData()
        fetchStats()
      } else {
        message.error(res.message || '操作失败')
      }
    } catch (e: any) {
      message.error(e?.message || '操作失败')
    }
  }

  // ============ 提交校准 ============
  const openSubmit = (record: any) => {
    setSubmitPlan(record)
    setCertFileList([])
    submitForm.resetFields()
    submitForm.setFieldsValue({
      calibration_date: dayjs(),
      calibration_result: '合格',
      calibration_org: record.calibration_org || '',
      cost: undefined,
    })
    setSubmitOpen(true)
  }

  const handleSubmitConfirm = async () => {
    if (!submitPlan) return
    try {
      const values = await submitForm.validateFields()
      const payload: any = {
        calibration_date: values.calibration_date.format('YYYY-MM-DD'),
        calibration_result: values.calibration_result,
        calibration_org: values.calibration_org || '',
        certificate_no: values.certificate_no || '',
        cost: values.cost !== undefined && values.cost !== null ? values.cost : null,
        valid_until: values.valid_until ? values.valid_until.format('YYYY-MM-DD') : undefined,
        remarks: values.remarks || '',
      }

      setSubmitLoading(true)
      const res = await api.put(`/basic/device-calibration-plans/${submitPlan.plan_id}/submit`, payload)
      if (res.success === false) {
        message.error(res.message || '提交失败')
        return
      }

      // 提交成功后上传证书
      const validFiles = certFileList.filter(f => f.originFileObj)
      if (validFiles.length > 0) {
        try {
          const formData = new FormData()
          validFiles.forEach(f => formData.append('images', f.originFileObj as File))
          const upRes = await api.post(`/basic/device-calibration-plans/${submitPlan.plan_id}/certificate`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          if (upRes.success === false) {
            message.warning(upRes.message || '证书上传失败，但校准已提交')
          }
        } catch (e: any) {
          message.warning(e?.message || '证书上传失败，但校准已提交')
        }
      }

      message.success('校准提交成功')
      setSubmitOpen(false)
      setCertFileList([])
      fetchData()
      fetchStats()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.message || '提交失败')
    } finally {
      setSubmitLoading(false)
    }
  }

  // ============ 校准项目编辑 ============
  const addItem = () => {
    setEditItems(prev => [...prev, { key: uid(), item_name: '', standard_value: '' }])
  }
  const removeItem = (key: string) => {
    setEditItems(prev => prev.filter(it => it.key !== key))
  }
  const updateItem = (key: string, patch: Partial<CalibItemRow>) => {
    setEditItems(prev => prev.map(it => it.key === key ? { ...it, ...patch } : it))
  }

  // ============ 表格列 ============
  const columns = [
    { title: '设备编号', dataIndex: 'device_code', key: 'device_code', width: 130, fixed: 'left' as const },
    { title: '设备名称', dataIndex: 'device_name', key: 'device_name', width: 160, ellipsis: true },
    {
      title: '校准周期', dataIndex: 'calibration_cycle', key: 'calibration_cycle', width: 100,
      render: (v: number) => v ? `${v}个月` : '-',
    },
    {
      title: '上次校准日期', dataIndex: 'last_calibration_date', key: 'last_calibration_date', width: 120,
      render: (v: string) => v || <Text type="secondary">-</Text>,
    },
    {
      title: '下次校准日期', dataIndex: 'next_calibration_date', key: 'next_calibration_date', width: 130,
      render: (v: string, record: any) => {
        if (!v) return <Text type="secondary">-</Text>
        const overdue = isOverdue(record)
        return (
          <Space size={4}>
            <span style={{ color: overdue ? '#f5222d' : undefined, fontWeight: overdue ? 600 : undefined }}>{v}</span>
            {overdue && <WarningOutlined style={{ color: '#f5222d' }} />}
          </Space>
        )
      },
    },
    { title: '校准机构', dataIndex: 'calibration_org', key: 'calibration_org', width: 160, ellipsis: true },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (v: string) => <Tag color={statusColor[v] || 'default'}>{v || '-'}</Tag>,
    },
    {
      title: '操作', key: 'action', fixed: 'right' as const, width: 240,
      render: (_: any, record: any) => {
        const locked = record.status === '已锁定'
        return (
          <Space size="small" wrap>
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => showDetail(record)}>查看</Button>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
            <Button type="link" size="small" onClick={() => openSubmit(record)} disabled={locked}>提交校准</Button>
            <Button type="link" size="small" icon={locked ? <UnlockOutlined /> : <LockOutlined />} onClick={() => handleToggleLock(record)}>
              {locked ? '解锁' : '锁定'}
            </Button>
            <Popconfirm title="确认删除该校准计划？关联的校准记录将一并删除。" onConfirm={() => handleDelete(record)} okText="删除" cancelText="取消">
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        )
      },
    },
  ]

  // ============ 筛选区 ============
  const filterNode = (
    <Space wrap style={{ width: '100%' }} size={[8, 8]} align="center">
      <Input
        placeholder="设备名称"
        allowClear
        prefix={<SearchOutlined />}
        style={{ width: 160 }}
        value={deviceName}
        onChange={(e) => setDeviceName(e.target.value || undefined)}
        onPressEnter={() => { setPagination(p => ({ ...p, current: 1 })); fetchData() }}
      />
      <div style={{ display: 'inline-flex', alignItems: 'center' }}>
        <span style={{ color: '#888', fontSize: 13, marginRight: 6, whiteSpace: 'nowrap' }}>状态：</span>
        <Checkbox.Group
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v as string[]); setPagination(p => ({ ...p, current: 1 })) }}
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
      <RangePicker style={{ width: 240 }} value={dateRange} onChange={handleRangeChange} />
      <Button type="primary" icon={<SearchOutlined />} onClick={() => { setPagination(p => ({ ...p, current: 1 })); fetchData() }}>查询</Button>
      <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
    </Space>
  )

  const actions = (
    <Space>
      <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建校准计划</Button>
      <Button icon={<ReloadOutlined />} onClick={() => { fetchData(); fetchStats() }}>刷新</Button>
    </Space>
  )

  // ============ 校准项目编辑列 ============
  const itemColumns = [
    {
      title: '校准项目', key: 'item_name', width: 220,
      render: (_: any, r: CalibItemRow) => (
        <Input
          placeholder="如：温度、压力"
          value={r.item_name}
          onChange={(e) => updateItem(r.key, { item_name: e.target.value })}
        />
      ),
    },
    {
      title: '标准值', key: 'standard_value',
      render: (_: any, r: CalibItemRow) => (
        <Input
          placeholder="如：100℃"
          value={r.standard_value}
          onChange={(e) => updateItem(r.key, { standard_value: e.target.value })}
        />
      ),
    },
    {
      title: '操作', key: 'action', width: 80,
      render: (_: any, r: CalibItemRow) => (
        <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => removeItem(r.key)} />
      ),
    },
  ]

  // ============ 下次校准日期预览 ============
  const watchCycle = Form.useWatch('calibration_cycle', form)
  const watchLast = Form.useWatch('last_calibration_date', form)
  const nextPreview = useMemo(() => {
    const base = watchLast || dayjs()
    const months = Number(watchCycle) || 0
    if (months <= 0) return '-'
    return base.add(months, 'month').format('YYYY-MM-DD')
  }, [watchCycle, watchLast])

  // ============ 证书渲染 ============
  const renderCertificates = (images: any[]) => {
    if (!images || images.length === 0) {
      return <Empty description="暂无证书" image={Empty.PRESENTED_IMAGE_SIMPLE} />
    }
    const imgs = images.filter((im: any) => !/\.pdf$/i.test(im.file_path || ''))
    const pdfs = images.filter((im: any) => /\.pdf$/i.test(im.file_path || ''))
    return (
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        {imgs.length > 0 && (
          <Image.PreviewGroup>
            <Space wrap size={8}>
              {imgs.map((im: any) => (
                <Image
                  key={im.image_id ?? im.file_path}
                  src={im.file_path}
                  alt={im.file_name || '校准证书'}
                  width={120}
                  height={150}
                  style={{ objectFit: 'cover', borderRadius: 4 }}
                />
              ))}
            </Space>
          </Image.PreviewGroup>
        )}
        {pdfs.length > 0 && (
          <Space wrap size={8}>
            {pdfs.map((im: any) => (
              <Button key={im.image_id ?? im.file_path} size="small" icon={<SafetyCertificateOutlined />} href={im.file_path} target="_blank">
                {im.file_name || '查看证书'}
              </Button>
            ))}
          </Space>
        )}
      </Space>
    )
  }

  return (
    <>
      <ThreeSectionPage
        title="设备校准"
        breadcrumbs="设备管理 / 设备校准"
        stats={stats}
        filter={filterNode}
        actions={actions}
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
              message="校准管理：计量器具按周期校准，超期设备将标红提示，请及时安排校准并上传校准证书。"
            />
            <ResizableTable
              tableKey="pages_device_DeviceCalibration"
              columns={columns}
              dataSource={data}
              rowKey="plan_id"
              size="small"
              loading={loading}
              scroll={{ x: 1400 }}
              onRow={(record: any) => ({
                style: isOverdue(record) ? { background: 'rgba(245,34,45,0.06)' } : undefined,
              })}
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

      {/* ============ 详情 Drawer ============ */}
      <Drawer
        title="校准计划详情"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={960}
        destroyOnHidden
      >
        <Spin spinning={detailLoading}>
          {currentDetail && (
            <div style={{ height: 'calc(100vh - 120px)', overflow: 'auto', paddingRight: 8 }}>
              <Title level={5}>基本信息</Title>
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="设备编号">{currentDetail.device_code || '-'}</Descriptions.Item>
                <Descriptions.Item label="设备名称">{currentDetail.device_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="校准周期">{currentDetail.calibration_cycle ? `${currentDetail.calibration_cycle}个月` : '-'}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={statusColor[currentDetail.status] || 'default'}>{currentDetail.status || '-'}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="上次校准日期">{currentDetail.last_calibration_date || '-'}</Descriptions.Item>
                <Descriptions.Item label="下次校准日期">
                  <Space size={4}>
                    <span style={{ color: isOverdue(currentDetail) ? '#f5222d' : undefined, fontWeight: isOverdue(currentDetail) ? 600 : undefined }}>
                      {currentDetail.next_calibration_date || '-'}
                    </span>
                    {isOverdue(currentDetail) && <WarningOutlined style={{ color: '#f5222d' }} />}
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="校准机构" span={2}>{currentDetail.calibration_org || '-'}</Descriptions.Item>
                <Descriptions.Item label="校准项目" span={2}>
                  {Array.isArray(currentDetail.calibration_items) && currentDetail.calibration_items.length > 0 ? (
                    <Space wrap size={[4, 4]}>
                      {currentDetail.calibration_items.map((it: any, idx: number) => (
                        <Tag key={idx}>{it.item_name}{it.standard_value ? `：${it.standard_value}` : ''}</Tag>
                      ))}
                    </Space>
                  ) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="备注" span={2}>{currentDetail.remarks || '-'}</Descriptions.Item>
              </Descriptions>

              <Title level={5} style={{ marginTop: 16 }}>历史校准记录</Title>
              <Table
                size="small"
                rowKey={(r: any) => r.record_id ?? r.key}
                dataSource={currentDetail.records || []}
                pagination={false}
                scroll={{ x: 760 }}
                locale={{ emptyText: '暂无校准记录' }}
                expandable={{
                  expandedRowRender: (r: any) => (
                    <div style={{ padding: '4px 0' }}>
                      <Text type="secondary" style={{ marginRight: 8 }}>校准证书：</Text>
                      {renderCertificates(r.calibration_images || [])}
                      {r.remarks && <div style={{ marginTop: 8, color: '#888' }}>备注：{r.remarks}</div>}
                    </div>
                  ),
                  rowExpandable: (r: any) => (r.calibration_images && r.calibration_images.length > 0) || r.remarks,
                }}
                columns={[
                  { title: '校准日期', dataIndex: 'calibration_date', key: 'calibration_date', width: 120 },
                  {
                    title: '校准结果', dataIndex: 'calibration_result', key: 'calibration_result', width: 90,
                    render: (v: string) => v ? <Tag color={resultColor[v] || 'default'}>{v}</Tag> : '-',
                  },
                  { title: '校准机构', dataIndex: 'calibration_org', key: 'calibration_org', width: 150, ellipsis: true },
                  { title: '证书编号', dataIndex: 'certificate_no', key: 'certificate_no', width: 140, ellipsis: true },
                  { title: '有效期至', dataIndex: 'valid_until', key: 'valid_until', width: 120 },
                  {
                    title: '费用', dataIndex: 'cost', key: 'cost', width: 100,
                    render: (v: any) => v !== null && v !== undefined ? `¥${v}` : '-',
                  },
                  { title: '操作人', dataIndex: 'operator_name', key: 'operator_name', width: 100 },
                ]}
              />
            </div>
          )}
        </Spin>
      </Drawer>

      {/* ============ 新建/编辑 Modal ============ */}
      <Modal
        title={drawerMode === 'edit' ? '编辑校准计划' : '新建校准计划'}
        open={formVisible}
        onCancel={() => setFormVisible(false)}
        width={760}
        destroyOnHidden
        footer={
          <Space>
            <Button onClick={() => setFormVisible(false)}>取消</Button>
            <Button type="primary" loading={formLoading} onClick={handleFormSave}>
              {drawerMode === 'edit' ? '保存' : '创建'}
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={{ calibration_cycle: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <Form.Item label="计量器具" name="device_id" rules={[{ required: true, message: '请选择计量器具' }]}>
              <Select
                showSearch
                placeholder="请选择计量器具"
                options={deviceOptions}
                disabled={drawerMode === 'edit'}
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
            <Form.Item label="校准周期（月）" name="calibration_cycle" rules={[{ required: true, message: '请选择校准周期' }]}>
              <Select placeholder="请选择校准周期" options={CYCLE_OPTIONS} />
            </Form.Item>
            <Form.Item label="上次校准日期" name="last_calibration_date">
              <DatePicker style={{ width: '100%' }} placeholder="留空则从今日起算" />
            </Form.Item>
            <Form.Item label="下次校准日期（自动计算）">
              <Input value={nextPreview} readOnly disabled />
            </Form.Item>
            <Form.Item label="校准机构" name="calibration_org" style={{ gridColumn: 'span 2' }}>
              <Input placeholder="外部校准机构名称" />
            </Form.Item>
            {drawerMode === 'edit' && (
              <Form.Item label="状态" name="status">
                <Select options={STATUS_OPTIONS} placeholder="请选择状态" />
              </Form.Item>
            )}
            <Form.Item label="备注" name="remarks" style={{ gridColumn: 'span 2' }}>
              <Input.TextArea rows={2} placeholder="可填写备注" />
            </Form.Item>
          </div>

          <Title level={5} style={{ margin: '8px 0 8px' }}>校准项目</Title>
          <Table
            size="small"
            rowKey="key"
            dataSource={editItems}
            columns={itemColumns}
            pagination={false}
            locale={{ emptyText: '暂无校准项目，点击下方按钮添加' }}
          />
          <Button type="dashed" icon={<PlusOutlined />} onClick={addItem} style={{ width: '100%', marginTop: 8 }}>
            添加校准项目
          </Button>
        </Form>
      </Modal>

      {/* ============ 提交校准结果 Modal ============ */}
      <Modal
        title="提交校准结果"
        open={submitOpen}
        onCancel={() => setSubmitOpen(false)}
        width={620}
        destroyOnHidden
        footer={
          <Space>
            <Button onClick={() => setSubmitOpen(false)}>取消</Button>
            <Button type="primary" loading={submitLoading} onClick={handleSubmitConfirm}>提交</Button>
          </Space>
        }
      >
        {submitPlan && (
          <Form form={submitForm} layout="vertical">
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="设备名称">{submitPlan.device_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="设备编号">{submitPlan.device_code || '-'}</Descriptions.Item>
              <Descriptions.Item label="校准周期">{submitPlan.calibration_cycle ? `${submitPlan.calibration_cycle}个月` : '-'}</Descriptions.Item>
              <Descriptions.Item label="上次校准日期">{submitPlan.last_calibration_date || '-'}</Descriptions.Item>
            </Descriptions>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <Form.Item label="校准日期" name="calibration_date" rules={[{ required: true, message: '请选择校准日期' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="校准结果" name="calibration_result" rules={[{ required: true, message: '请选择校准结果' }]}>
                <Radio.Group options={RESULT_OPTIONS} />
              </Form.Item>
              <Form.Item label="校准机构" name="calibration_org" style={{ gridColumn: 'span 2' }}>
                <Input placeholder="校准机构" />
              </Form.Item>
              <Form.Item label="证书编号" name="certificate_no">
                <Input placeholder="校准证书编号" />
              </Form.Item>
              <Form.Item label="校准费用" name="cost">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="校准费用" prefix="¥" />
              </Form.Item>
              <Form.Item label="有效期至" name="valid_until">
                <DatePicker style={{ width: '100%' }} placeholder="留空则按周期自动计算" />
              </Form.Item>
              <Form.Item label="备注" name="remarks">
                <Input placeholder="可填写备注" />
              </Form.Item>
            </div>
            <Form.Item label="校准证书" extra="支持图片或PDF，可多选；提交校准后自动上传">
              <Upload
                listType="picture-card"
                fileList={certFileList}
                multiple
                accept="image/*,application/pdf"
                beforeUpload={() => false}
                onChange={({ fileList: fl }) => setCertFileList(fl)}
              >
                {certFileList.length >= 9 ? null : (
                  <div>
                    <UploadOutlined />
                    <div style={{ marginTop: 4 }}>上传证书</div>
                  </div>
                )}
              </Upload>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </>
  )
}
