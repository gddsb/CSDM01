import ResizableTable from '../../components/ResizableTable'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Tag, Button, Select, DatePicker, Space, Input, Drawer, Form, Descriptions,
  Typography, Alert, Modal, Popconfirm, Upload, Image, Timeline,
  InputNumber, Divider, Empty, Spin, message,
} from 'antd'
import type { UploadFile } from 'antd'
import {
  ToolOutlined, ClockCircleOutlined, FileTextOutlined, FireOutlined,
  SearchOutlined, ReloadOutlined, PlusOutlined, EyeOutlined, UploadOutlined,
  DeleteOutlined, DollarOutlined, CloseCircleOutlined,
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import type { StatItem } from '../../components/ThreeSectionPage'
import { formatDateTime } from '../../utils'
import { MONTH_QUICK_OPTIONS, getMonthRange, validateRange } from '../../utils/monthQuick'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import api from '../../utils/api'
import { useMessage } from '../../contexts/AppContext'

const { RangePicker } = DatePicker
const { TextArea } = Input
const { Title, Text } = Typography

// 状态和等级颜色映射
const statusColor: Record<string, string> = {
  '待派工': 'default',
  '维修中': 'processing',
  '待审批': 'warning',
  '已关闭': 'success',
  '已挂起': 'error',
}
const levelColor: Record<string, string> = { '一般': 'blue', '严重': 'orange', '紧急': 'red' }

const STATUS_OPTIONS = [
  { label: '待派工', value: '待派工' },
  { label: '维修中', value: '维修中' },
  { label: '待审批', value: '待审批' },
  { label: '已关闭', value: '已关闭' },
  { label: '已挂起', value: '已挂起' },
]

const LEVEL_OPTIONS = [
  { label: '一般', value: '一般' },
  { label: '严重', value: '严重' },
  { label: '紧急', value: '紧急' },
]

const DEFAULT_HOURLY_RATE = 80

interface SparePartRow {
  key: string
  material_id?: number | string
  material_name?: string
  quantity: number
  unit_price: number
}

interface FaultImage {
  image_id?: number
  image_url: string
  thumbnail_url?: string
  image_name?: string
  image_type?: string
  upload_time?: string
  upload_person_name?: string
}

interface DeviceFault {
  fault_id: number
  fault_no: string
  device_id: number
  device_code?: string
  device_name?: string
  fault_level: string
  fault_desc?: string
  fault_time: string
  impact_desc?: string
  reporter_name?: string
  repair_person_name?: string
  status: string
  fault_cause?: string
  repair_solution?: string
  repair_process?: string
  repair_hours?: number
  hourly_rate?: number
  outsource_cost?: number
  parts_cost?: number
  labor_cost?: number
  total_cost?: number
  spare_parts?: SparePartRow[]
  assign_time?: string
  repair_deadline?: string
  assign_remark?: string
  repair_time?: string
  approve_time?: string
  approve_result?: string
  approve_opinion?: string
  close_time?: string
  close_remark?: string
  created_at?: string
}

const uid = () => Math.random().toString(36).slice(2, 10)

export default function DeviceFault() {
  const message = useMessage()

  // ============ 列表数据 ============
  const [data, setData] = useState<DeviceFault[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })

  // ============ 筛选条件 ============
  const [faultNo, setFaultNo] = useState<string | undefined>(undefined)
  const [deviceName, setDeviceName] = useState<string | undefined>(undefined)
  const [levelFilter, setLevelFilter] = useState<string | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [monthQuick, setMonthQuick] = useState<string | undefined>(undefined)
  const [rangeWarn, setRangeWarn] = useState(false)

  // ============ 详情 Drawer ============
  const [detailOpen, setDetailOpen] = useState(false)
  const [current, setCurrent] = useState<DeviceFault | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [faultImages, setFaultImages] = useState<FaultImage[]>([])
  const [repairImages, setRepairImages] = useState<FaultImage[]>([])

  // ============ 新建 Drawer ============
  const [createOpen, setCreateOpen] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createForm] = Form.useForm()
  const [devices, setDevices] = useState<any[]>([])
  const [createFileList, setCreateFileList] = useState<UploadFile[]>([])

  // ============ 派工 Modal ============
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignLoading, setAssignLoading] = useState(false)
  const [assignForm] = Form.useForm()
  const [users, setUsers] = useState<any[]>([])
  const [assignTarget, setAssignTarget] = useState<DeviceFault | null>(null)

  // ============ 维修记录 Modal ============
  const [repairOpen, setRepairOpen] = useState(false)
  const [repairLoading, setRepairLoading] = useState(false)
  const [repairForm] = Form.useForm()
  const [repairTarget, setRepairTarget] = useState<DeviceFault | null>(null)
  const [spareParts, setSpareParts] = useState<SparePartRow[]>([])
  const [repairFileList, setRepairFileList] = useState<UploadFile[]>([])

  // ============ 审批 Modal ============
  const [approveOpen, setApproveOpen] = useState(false)
  const [approveLoading, setApproveLoading] = useState(false)
  const [approveForm] = Form.useForm()
  const [approveTarget, setApproveTarget] = useState<DeviceFault | null>(null)

  // ============ 获取列表 ============
  const fetchData = useCallback(async () => {
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
    setLoading(true)
    try {
      const params: any = { page: pagination.current, page_size: pagination.pageSize }
      if (faultNo) params.fault_no = faultNo
      if (deviceName) params.device_name = deviceName
      if (levelFilter) params.fault_level = levelFilter
      if (statusFilter) params.status = statusFilter
      if (dateRange && dateRange[0]) params.start_date = dateRange[0].format('YYYY-MM-DD')
      if (dateRange && dateRange[1]) params.end_date = dateRange[1].format('YYYY-MM-DD')
      const res = await api.get('/basic/device-faults', { params })
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
  }, [pagination.current, pagination.pageSize, faultNo, deviceName, levelFilter, statusFilter, dateRange, message])

  useEffect(() => { fetchData() }, [fetchData])

  // ============ 加载下拉数据（设备、维修人员） ============
  const loadSelectData = useCallback(async () => {
    try {
      const [dRes, uRes] = await Promise.all([
        api.get('/basic/devices', { params: { page: 1, page_size: 500 } }),
        api.get('/system/users', { params: { page: 1, page_size: 500 } }),
      ])
      if (dRes.success !== false) {
        const list = dRes.data?.list || dRes.data || []
        setDevices(Array.isArray(list) ? list : [])
      }
      if (uRes.success !== false) {
        const list = uRes.data?.list || uRes.data || []
        setUsers(Array.isArray(list) ? list : [])
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => { loadSelectData() }, [loadSelectData])

  // ============ 统计 ============
  const stats: StatItem[] = useMemo(() => {
    const pending = data.filter(d => d.status === '待派工').length
    const repairing = data.filter(d => d.status === '维修中').length
    const approving = data.filter(d => d.status === '待审批').length
    const urgent = data.filter(d => d.fault_level === '紧急').length
    return [
      { label: '总故障数', value: pagination.total, icon: <ToolOutlined />, color: '#2196F3' },
      { label: '待派工', value: pending, icon: <ClockCircleOutlined />, color: '#FF9800' },
      { label: '维修中', value: repairing, icon: <ToolOutlined />, color: '#00BCD4' },
      { label: '待审批', value: approving, icon: <FileTextOutlined />, color: '#9C27B0' },
      { label: '紧急故障', value: urgent, icon: <FireOutlined />, color: '#F44336' },
    ]
  }, [data, pagination.total])

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
    setFaultNo(undefined)
    setDeviceName(undefined)
    setLevelFilter(undefined)
    setStatusFilter(undefined)
    setMonthQuick(undefined)
    setDateRange(null)
    setPagination(p => ({ ...p, current: 1 }))
  }

  const deviceOptions = useMemo(() =>
    devices.map((d: any) => ({
      label: d.device_name || d.device_code || String(d.device_id ?? d.id),
      value: d.device_id ?? d.id,
      raw: d,
    })), [devices])

  const userOptions = useMemo(() =>
    users.map((u: any) => ({
      label: u.real_name || u.username || String(u.user_id ?? u.id),
      value: u.user_id ?? u.id,
      raw: u,
    })), [users])

  // ============ 图片上传辅助 ============
  const uploadImages = async (faultId: number, files: UploadFile[], imageType: string) => {
    const valid = files.filter(f => f.originFileObj)
    if (valid.length === 0) return
    try {
      const formData = new FormData()
      valid.forEach(f => formData.append('images', f.originFileObj as File))
      formData.append('image_type', imageType)
      await api.post(`/basic/device-faults/${faultId}/images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    } catch (e: any) {
      message.error(e?.message || '图片上传失败')
    }
  }

  const loadImages = async (faultId: number) => {
    setFaultImages([])
    setRepairImages([])
    try {
      const res = await api.get(`/basic/device-faults/${faultId}/images`)
      if (res.success !== false) {
        const list: FaultImage[] = res.data?.list || res.data || []
        setFaultImages(list.filter(i => !i.image_type || i.image_type === 'fault'))
        setRepairImages(list.filter(i => i.image_type === 'repair'))
      }
    } catch (e: any) {
      // 图片加载失败不阻断详情查看
    }
  }

  // ============ 详情 ============
  const showDetail = async (record: DeviceFault) => {
    setCurrent(record)
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const res = await api.get(`/basic/device-faults/${record.fault_id}`)
      if (res.success !== false && res.data) {
        setCurrent(res.data)
      }
      await loadImages(record.fault_id)
    } catch (e: any) {
      message.error(e?.message || '加载详情失败')
    } finally {
      setDetailLoading(false)
    }
  }

  // ============ 新建 ============
  const openCreate = () => {
    createForm.resetFields()
    createForm.setFieldsValue({
      fault_level: '一般',
      fault_time: dayjs(),
    })
    setCreateFileList([])
    setCreateOpen(true)
  }

  const handleCreateSubmit = async () => {
    try {
      const values = await createForm.validateFields()
      setCreateLoading(true)
      const device = devices.find((d: any) => (d.device_id ?? d.id) === values.device_id)
      const payload: any = {
        device_id: values.device_id,
        device_name: device?.device_name,
        device_code: device?.device_code,
        fault_level: values.fault_level,
        fault_desc: values.fault_desc,
        fault_time: values.fault_time?.format?.('YYYY-MM-DD HH:mm:ss') || values.fault_time,
        impact_desc: values.impact_desc || '',
      }
      const res = await api.post('/basic/device-faults', payload)
      if (res.success !== false) {
        const newId = res.data?.fault_id
        if (newId && createFileList.length > 0) {
          await uploadImages(newId, createFileList, 'fault')
        }
        message.success(res.message || '故障上报成功')
        setCreateOpen(false)
        setCreateFileList([])
        fetchData()
      } else {
        message.error(res.message || '上报失败')
      }
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.message || '上报失败')
    } finally {
      setCreateLoading(false)
    }
  }

  // ============ 派工 / 重新派工 ============
  const openAssign = (record: DeviceFault) => {
    setAssignTarget(record)
    assignForm.resetFields()
    assignForm.setFieldsValue({ repair_deadline: undefined, remark: '' })
    setAssignOpen(true)
  }

  const handleAssignSubmit = async () => {
    if (!assignTarget) return
    try {
      const values = await assignForm.validateFields()
      setAssignLoading(true)
      const user = users.find((u: any) => (u.user_id ?? u.id) === values.repair_person_id)
      const payload: any = {
        repair_person_id: values.repair_person_id,
        repair_person_name: user?.real_name || user?.username,
        repair_deadline: values.repair_deadline?.format?.('YYYY-MM-DD HH:mm:ss') || values.repair_deadline,
        remark: values.remark || '',
      }
      const res = await api.put(`/basic/device-faults/${assignTarget.fault_id}/assign`, payload)
      if (res.success !== false) {
        message.success(res.message || '派工成功')
        setAssignOpen(false)
        fetchData()
      } else {
        message.error(res.message || '派工失败')
      }
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.message || '派工失败')
    } finally {
      setAssignLoading(false)
    }
  }

  // ============ 维修记录提交 ============
  const openRepair = (record: DeviceFault) => {
    setRepairTarget(record)
    repairForm.resetFields()
    repairForm.setFieldsValue({
      repair_hours: 0,
      hourly_rate: DEFAULT_HOURLY_RATE,
      outsource_cost: 0,
    })
    setSpareParts([])
    setRepairFileList([])
    setRepairOpen(true)
  }

  const addSparePart = () => {
    setSpareParts(prev => [...prev, { key: uid(), quantity: 1, unit_price: 0 }])
  }
  const removeSparePart = (key: string) => {
    setSpareParts(prev => prev.filter(p => p.key !== key))
  }
  const updateSparePart = (key: string, field: keyof SparePartRow, value: any) => {
    setSpareParts(prev => prev.map(p => p.key === key ? { ...p, [field]: value } : p))
  }

  const partsCost = useMemo(() =>
    spareParts.reduce((sum, p) => sum + (Number(p.quantity) || 0) * (Number(p.unit_price) || 0), 0),
    [spareParts])

  const repairHours = Form.useWatch('repair_hours', repairForm) as number | undefined
  const hourlyRate = Form.useWatch('hourly_rate', repairForm) as number | undefined
  const outsourceCost = Form.useWatch('outsource_cost', repairForm) as number | undefined
  const laborCost = useMemo(() => (Number(repairHours) || 0) * (Number(hourlyRate) || 0), [repairHours, hourlyRate])
  const totalCost = useMemo(() =>
    partsCost + laborCost + (Number(outsourceCost) || 0), [partsCost, laborCost, outsourceCost])

  const handleRepairSubmit = async () => {
    if (!repairTarget) return
    try {
      const values = await repairForm.validateFields()
      setRepairLoading(true)
      const payload: any = {
        fault_cause: values.fault_cause,
        repair_solution: values.repair_solution,
        repair_process: values.repair_process || '',
        repair_hours: Number(values.repair_hours) || 0,
        hourly_rate: Number(values.hourly_rate) || 0,
        outsource_cost: Number(values.outsource_cost) || 0,
        parts_cost: partsCost,
        labor_cost: laborCost,
        total_cost: totalCost,
        spare_parts: spareParts.map(p => ({
          material_id: p.material_id,
          material_name: p.material_name,
          quantity: Number(p.quantity) || 0,
          unit_price: Number(p.unit_price) || 0,
          subtotal: (Number(p.quantity) || 0) * (Number(p.unit_price) || 0),
        })),
      }
      const res = await api.put(`/basic/device-faults/${repairTarget.fault_id}/repair`, payload)
      if (res.success !== false) {
        if (repairFileList.length > 0) {
          await uploadImages(repairTarget.fault_id, repairFileList, 'repair')
        }
        message.success(res.message || '维修记录提交成功')
        setRepairOpen(false)
        setRepairFileList([])
        fetchData()
      } else {
        message.error(res.message || '提交失败')
      }
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.message || '提交失败')
    } finally {
      setRepairLoading(false)
    }
  }

  // ============ 审批 ============
  const openApprove = (record: DeviceFault) => {
    setApproveTarget(record)
    approveForm.resetFields()
    approveForm.setFieldsValue({ result: '通过', opinion: '' })
    setApproveOpen(true)
  }

  const handleApproveSubmit = async () => {
    if (!approveTarget) return
    try {
      const values = await approveForm.validateFields()
      setApproveLoading(true)
      const payload: any = {
        approve_result: values.result,
        approve_opinion: values.opinion || '',
      }
      const res = await api.put(`/basic/device-faults/${approveTarget.fault_id}/approve`, payload)
      if (res.success !== false) {
        message.success(res.message || (values.result === '通过' ? '审批通过' : '已驳回'))
        setApproveOpen(false)
        fetchData()
      } else {
        message.error(res.message || '审批失败')
      }
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.message || '审批失败')
    } finally {
      setApproveLoading(false)
    }
  }

  // ============ 关闭故障 ============
  const handleClose = (record: DeviceFault) => {
    Modal.confirm({
      title: '关闭故障',
      content: `确认关闭故障 ${record.fault_no}？关闭后故障流程结束。`,
      okText: '确认关闭',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await api.put(`/basic/device-faults/${record.fault_id}/close`, { close_remark: '故障关闭' })
          if (res.success !== false) {
            message.success(res.message || '关闭成功')
            fetchData()
          } else {
            message.error(res.message || '关闭失败')
          }
        } catch (e: any) {
          message.error(e?.message || '关闭失败')
        }
      },
    })
  }

  // ============ 表格列 ============
  const columns = [
    { title: '故障编号', dataIndex: 'fault_no', key: 'fault_no', width: 150, fixed: 'left' as const },
    { title: '设备编号', dataIndex: 'device_code', key: 'device_code', width: 120 },
    { title: '设备名称', dataIndex: 'device_name', key: 'device_name', width: 150, ellipsis: true },
    {
      title: '故障等级', dataIndex: 'fault_level', key: 'fault_level', width: 90,
      render: (v: string) => <Tag color={levelColor[v] || 'default'}>{v || '-'}</Tag>,
    },
    { title: '故障现象', dataIndex: 'fault_desc', key: 'fault_desc', width: 200, ellipsis: true },
    { title: '上报人', dataIndex: 'reporter_name', key: 'reporter_name', width: 100 },
    { title: '维修人', dataIndex: 'repair_person_name', key: 'repair_person_name', width: 100 },
    { title: '故障时间', dataIndex: 'fault_time', key: 'fault_time', width: 160, render: formatDateTime },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (v: string) => <Tag color={statusColor[v] || 'default'}>{v}</Tag>,
    },
    {
      title: '操作', key: 'action', fixed: 'right' as const, width: 220,
      render: (_: any, record: DeviceFault) => {
        const status = record.status
        return (
          <Space size="small" wrap>
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => showDetail(record)}>查看详情</Button>
            {status === '待派工' && (
              <>
                <Button type="link" size="small" onClick={() => openAssign(record)}>派工</Button>
                <Button type="link" size="small" danger onClick={() => handleClose(record)}>关闭</Button>
              </>
            )}
            {status === '维修中' && (
              <Button type="link" size="small" onClick={() => openRepair(record)}>提交维修</Button>
            )}
            {status === '待审批' && (
              <Button type="link" size="small" onClick={() => openApprove(record)}>审批</Button>
            )}
            {status === '已挂起' && (
              <Button type="link" size="small" onClick={() => openAssign(record)}>重新派工</Button>
            )}
          </Space>
        )
      },
    },
  ]

  // ============ 筛选区 ============
  const filterNode = (
    <Space wrap style={{ width: '100%' }} size={[8, 8]} align="center">
      <Input
        placeholder="故障编号"
        allowClear
        prefix={<SearchOutlined />}
        style={{ width: 160 }}
        value={faultNo}
        onChange={(e) => setFaultNo(e.target.value || undefined)}
        onPressEnter={() => { setPagination(p => ({ ...p, current: 1 })); fetchData() }}
      />
      <Input
        placeholder="设备名称"
        allowClear
        style={{ width: 150 }}
        value={deviceName}
        onChange={(e) => setDeviceName(e.target.value || undefined)}
        onPressEnter={() => { setPagination(p => ({ ...p, current: 1 })); fetchData() }}
      />
      <Select
        placeholder="故障等级"
        allowClear
        style={{ width: 120 }}
        options={LEVEL_OPTIONS}
        value={levelFilter}
        onChange={setLevelFilter}
      />
      <Select
        placeholder="状态"
        allowClear
        style={{ width: 120 }}
        options={STATUS_OPTIONS}
        value={statusFilter}
        onChange={setStatusFilter}
      />
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

  // ============ 上传组件配置 ============
  const uploadButton = (
    <div>
      <UploadOutlined />
      <div style={{ marginTop: 4 }}>上传图片</div>
    </div>
  )

  // ============ 处理时间线 ============
  const renderTimeline = () => {
    if (!current) return null
    const items: any[] = []
    if (current.fault_time || current.created_at) {
      items.push({
        color: 'blue',
        label: formatDateTime(current.fault_time || current.created_at),
        children: <div><Tag color="blue">上报</Tag><Text type="secondary" style={{ marginLeft: 8 }}>{current.reporter_name || '-'}</Text></div>,
      })
    }
    if (current.assign_time) {
      items.push({
        color: 'orange',
        label: formatDateTime(current.assign_time),
        children: <div><Tag color="orange">派工</Tag><Text type="secondary" style={{ marginLeft: 8 }}>维修人：{current.repair_person_name || '-'}</Text></div>,
      })
    }
    if (current.repair_time) {
      items.push({
        color: 'processing',
        label: formatDateTime(current.repair_time),
        children: <div><Tag color="processing">维修</Tag><Text type="secondary" style={{ marginLeft: 8 }}>{current.repair_person_name || '-'}</Text></div>,
      })
    }
    if (current.approve_time) {
      items.push({
        color: current.approve_result === '通过' ? 'green' : 'red',
        label: formatDateTime(current.approve_time),
        children: <div><Tag color={current.approve_result === '通过' ? 'success' : 'error'}>审批{current.approve_result || ''}</Tag></div>,
      })
    }
    if (current.close_time) {
      items.push({
        color: 'green',
        label: formatDateTime(current.close_time),
        children: <div><Tag color="success">关闭</Tag></div>,
      })
    }
    if (items.length === 0) return <Text type="secondary">暂无处理记录</Text>
    return <Timeline mode="left" items={items} />
  }

  const renderImageGroup = (images: FaultImage[], emptyText: string) => {
    if (!images || images.length === 0) {
      return <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />
    }
    return (
      <Image.PreviewGroup>
        <Space wrap size={8}>
          {images.map((img) => (
            <Image
              key={img.image_id ?? img.image_url}
              src={img.image_url}
              alt={img.image_name || '故障图片'}
              width={120}
              height={120}
              style={{ objectFit: 'cover', borderRadius: 4 }}
            />
          ))}
        </Space>
      </Image.PreviewGroup>
    )
  }

  return (
    <>
      <ThreeSectionPage
        title="设备故障管理"
        breadcrumbs="设备管理 / 设备故障"
        stats={stats}
        filter={filterNode}
        actions={
          <ActionButtons
            hasAdd={false}
            hasExport={false}
            extra={[
              <Button key="add" type="primary" icon={<PlusOutlined />} onClick={openCreate}>故障上报</Button>,
              <Button key="refresh" icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>,
            ]}
          />
        }
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
            <ResizableTable
              tableKey="pages_device_DeviceFault"
              columns={columns}
              dataSource={data}
              rowKey="fault_id"
              size="small"
              loading={loading}
              scroll={{ x: 1500 }}
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

      {/* ============ 故障详情 Drawer ============ */}
      <Drawer
        title="故障详情"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={820}
        destroyOnHidden
      >
        <Spin spinning={detailLoading}>
          {current && (
            <div style={{ height: 'calc(100vh - 120px)', overflow: 'auto', paddingRight: 8 }}>
              <Title level={5}>基本信息</Title>
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="故障编号">{current.fault_no}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={statusColor[current.status] || 'default'}>{current.status}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="设备编号">{current.device_code || '-'}</Descriptions.Item>
                <Descriptions.Item label="设备名称">{current.device_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="故障等级">
                  <Tag color={levelColor[current.fault_level] || 'default'}>{current.fault_level}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="故障时间">{formatDateTime(current.fault_time)}</Descriptions.Item>
                <Descriptions.Item label="上报人">{current.reporter_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="维修人">{current.repair_person_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="故障现象" span={2}>{current.fault_desc || '-'}</Descriptions.Item>
                <Descriptions.Item label="影响描述" span={2}>{current.impact_desc || '-'}</Descriptions.Item>
              </Descriptions>

              {(current.repair_person_name || current.fault_cause) && (
                <>
                  <Title level={5} style={{ marginTop: 16 }}>维修信息</Title>
                  <Descriptions column={2} size="small" bordered>
                    <Descriptions.Item label="维修人">{current.repair_person_name || '-'}</Descriptions.Item>
                    <Descriptions.Item label="维修截止">{formatDateTime(current.repair_deadline)}</Descriptions.Item>
                    <Descriptions.Item label="故障原因" span={2}>{current.fault_cause || '-'}</Descriptions.Item>
                    <Descriptions.Item label="维修方案" span={2}>{current.repair_solution || '-'}</Descriptions.Item>
                    <Descriptions.Item label="维修过程" span={2}>{current.repair_process || '-'}</Descriptions.Item>
                    <Descriptions.Item label="维修工时">{current.repair_hours != null ? `${current.repair_hours} 小时` : '-'}</Descriptions.Item>
                    <Descriptions.Item label="人工时薪">{current.hourly_rate != null ? `¥${current.hourly_rate}` : '-'}</Descriptions.Item>
                    <Descriptions.Item label="备件费用">{current.parts_cost != null ? `¥${current.parts_cost}` : '-'}</Descriptions.Item>
                    <Descriptions.Item label="人工成本">{current.labor_cost != null ? `¥${current.labor_cost}` : '-'}</Descriptions.Item>
                    <Descriptions.Item label="外协费用">{current.outsource_cost != null ? `¥${current.outsource_cost}` : '-'}</Descriptions.Item>
                    <Descriptions.Item label="总成本">{current.total_cost != null ? `¥${current.total_cost}` : '-'}</Descriptions.Item>
                  </Descriptions>
                  {current.spare_parts && current.spare_parts.length > 0 && (
                    <Descriptions column={1} size="small" bordered style={{ marginTop: 8 }}>
                      <Descriptions.Item label="备件使用明细">
                        {current.spare_parts.map((p, i) => (
                          <div key={i}>
                            {p.material_name || `备件${i + 1}`} × {p.quantity} × ¥{p.unit_price} = ¥{(p.quantity || 0) * (p.unit_price || 0)}
                          </div>
                        ))}
                      </Descriptions.Item>
                    </Descriptions>
                  )}
                </>
              )}

              {(current.approve_result || current.approve_opinion) && (
                <>
                  <Title level={5} style={{ marginTop: 16 }}>审批信息</Title>
                  <Descriptions column={1} size="small" bordered>
                    <Descriptions.Item label="审批结果">
                      {current.approve_result ? <Tag color={current.approve_result === '通过' ? 'success' : 'error'}>{current.approve_result}</Tag> : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="审批意见">{current.approve_opinion || '-'}</Descriptions.Item>
                    <Descriptions.Item label="审批时间">{formatDateTime(current.approve_time)}</Descriptions.Item>
                  </Descriptions>
                </>
              )}

              <Title level={5} style={{ marginTop: 16 }}>故障照片</Title>
              {renderImageGroup(faultImages, '暂无故障照片')}

              <Title level={5} style={{ marginTop: 16 }}>维修后照片</Title>
              {renderImageGroup(repairImages, '暂无维修后照片')}

              <Title level={5} style={{ marginTop: 16 }}>处理时间线</Title>
              {renderTimeline()}
            </div>
          )}
        </Spin>
      </Drawer>

      {/* ============ 故障上报（新建） Drawer ============ */}
      <Drawer
        title="故障上报"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        width={680}
        destroyOnHidden
        footer={
          <Space>
            <Button onClick={() => setCreateOpen(false)}>取消</Button>
            <Button type="primary" loading={createLoading} onClick={handleCreateSubmit}>上报</Button>
          </Space>
        }
      >
        <Form form={createForm} layout="vertical" initialValues={{ fault_level: '一般', fault_time: dayjs() }}>
          <Form.Item label="选择设备" name="device_id" rules={[{ required: true, message: '请选择设备' }]}>
            <Select
              showSearch
              placeholder="请选择设备"
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
              options={deviceOptions}
              onChange={(val) => {
                const opt = deviceOptions.find(o => o.value === val)
                if (opt?.raw) {
                  createForm.setFieldsValue({
                    device_name: opt.raw.device_name,
                    device_code: opt.raw.device_code,
                  })
                }
              }}
            />
          </Form.Item>
          <Form.Item label="故障等级" name="fault_level" rules={[{ required: true, message: '请选择故障等级' }]}>
            <Select
              options={LEVEL_OPTIONS}
              placeholder="请选择故障等级"
              optionRender={(option) => (
                <span style={{ color: option.value === '紧急' ? '#ff4d4f' : undefined, fontWeight: option.value === '紧急' ? 600 : 400 }}>
                  {option.label}
                </span>
              )}
            />
          </Form.Item>
          <Form.Item label="故障现象描述" name="fault_desc" rules={[{ required: true, message: '请输入故障现象描述' }]}>
            <TextArea rows={3} placeholder="请描述故障现象" />
          </Form.Item>
          <Form.Item label="故障发生时间" name="fault_time" rules={[{ required: true, message: '请选择故障发生时间' }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="影响描述" name="impact_desc">
            <TextArea rows={2} placeholder="请描述故障对生产的影响" />
          </Form.Item>
          <Form.Item label="故障照片">
            <Upload
              listType="picture-card"
              fileList={createFileList}
              multiple
              accept="image/*"
              beforeUpload={() => false}
              onChange={({ fileList: fl }) => setCreateFileList(fl)}
              onPreview={(file) => {
                window.open(file.url || (file.originFileObj ? URL.createObjectURL(file.originFileObj as File) : undefined))
              }}
            >
              {createFileList.length >= 9 ? null : uploadButton}
            </Upload>
            <div style={{ color: '#999', fontSize: 12 }}>支持多图上传，最多 9 张，保存后自动上传至服务器</div>
          </Form.Item>
        </Form>
      </Drawer>

      {/* ============ 派工 Modal ============ */}
      <Modal
        title="派工"
        open={assignOpen}
        onCancel={() => setAssignOpen(false)}
        onOk={handleAssignSubmit}
        confirmLoading={assignLoading}
        okText="确认派工"
        cancelText="取消"
        destroyOnHidden
      >
        {assignTarget && (
          <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="故障编号">{assignTarget.fault_no}</Descriptions.Item>
            <Descriptions.Item label="设备名称">{assignTarget.device_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="故障等级">
              <Tag color={levelColor[assignTarget.fault_level] || 'default'}>{assignTarget.fault_level}</Tag>
            </Descriptions.Item>
          </Descriptions>
        )}
        <Form form={assignForm} layout="vertical">
          <Form.Item label="维修人员" name="repair_person_id" rules={[{ required: true, message: '请选择维修人员' }]}>
            <Select
              showSearch
              placeholder="请选择维修人员"
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
              options={userOptions}
            />
          </Form.Item>
          <Form.Item label="维修截止时间" name="repair_deadline" rules={[{ required: true, message: '请选择维修截止时间' }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <TextArea rows={3} placeholder="可填写派工备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ============ 维修记录提交 Modal ============ */}
      <Modal
        title="维修记录提交"
        open={repairOpen}
        onCancel={() => setRepairOpen(false)}
        onOk={handleRepairSubmit}
        confirmLoading={repairLoading}
        okText="提交"
        cancelText="取消"
        width={780}
        destroyOnHidden
      >
        {repairTarget && (
          <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="故障编号">{repairTarget.fault_no}</Descriptions.Item>
            <Descriptions.Item label="设备名称">{repairTarget.device_name || '-'}</Descriptions.Item>
          </Descriptions>
        )}
        <Form form={repairForm} layout="vertical">
          <Form.Item label="故障原因分析" name="fault_cause" rules={[{ required: true, message: '请输入故障原因分析' }]}>
            <TextArea rows={3} placeholder="请输入故障原因分析" />
          </Form.Item>
          <Form.Item label="维修方案" name="repair_solution" rules={[{ required: true, message: '请输入维修方案' }]}>
            <TextArea rows={3} placeholder="请输入维修方案" />
          </Form.Item>
          <Form.Item label="维修过程记录" name="repair_process">
            <TextArea rows={3} placeholder="请输入维修过程记录" />
          </Form.Item>

          <Divider orientation="left" plain>备件使用</Divider>
          {spareParts.length === 0 && <Text type="secondary">暂无备件，点击下方按钮添加</Text>}
          {spareParts.map((p) => (
            <Space key={p.key} style={{ display: 'flex', marginBottom: 8 }} align="center">
              <Input
                placeholder="备件名称"
                style={{ width: 180 }}
                value={p.material_name}
                onChange={(e) => updateSparePart(p.key, 'material_name', e.target.value)}
              />
              <InputNumber
                placeholder="数量"
                min={0}
                style={{ width: 100 }}
                value={p.quantity}
                onChange={(v) => updateSparePart(p.key, 'quantity', v ?? 0)}
              />
              <InputNumber
                placeholder="单价"
                min={0}
                prefix="¥"
                style={{ width: 120 }}
                value={p.unit_price}
                onChange={(v) => updateSparePart(p.key, 'unit_price', v ?? 0)}
              />
              <Text>小计：¥{((Number(p.quantity) || 0) * (Number(p.unit_price) || 0)).toFixed(2)}</Text>
              <Button type="link" danger icon={<DeleteOutlined />} onClick={() => removeSparePart(p.key)} />
            </Space>
          ))}
          <Button type="dashed" icon={<PlusOutlined />} onClick={addSparePart} style={{ marginBottom: 12 }}>添加备件</Button>

          <Divider orientation="left" plain>成本明细</Divider>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item label="维修工时（小时）" name="repair_hours" rules={[{ required: true, message: '请输入维修工时' }]}>
              <InputNumber min={0} style={{ width: '100%' }} precision={1} />
            </Form.Item>
            <Form.Item label="人工时薪（元/小时）" name="hourly_rate" rules={[{ required: true, message: '请输入人工时薪' }]}>
              <InputNumber min={0} style={{ width: '100%' }} prefix="¥" />
            </Form.Item>
            <Form.Item label="外协费用" name="outsource_cost">
              <InputNumber min={0} style={{ width: '100%' }} prefix="¥" />
            </Form.Item>
          </div>
          <Descriptions column={3} size="small" bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="备件费用合计">¥{partsCost.toFixed(2)}</Descriptions.Item>
            <Descriptions.Item label="人工成本">¥{laborCost.toFixed(2)}</Descriptions.Item>
            <Descriptions.Item label="总成本"><Text strong style={{ color: '#f50' }}>¥{totalCost.toFixed(2)}</Text></Descriptions.Item>
          </Descriptions>

          <Form.Item label="维修后照片">
            <Upload
              listType="picture-card"
              fileList={repairFileList}
              multiple
              accept="image/*"
              beforeUpload={() => false}
              onChange={({ fileList: fl }) => setRepairFileList(fl)}
            >
              {repairFileList.length >= 9 ? null : uploadButton}
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      {/* ============ 审批 Modal ============ */}
      <Modal
        title="审批"
        open={approveOpen}
        onCancel={() => setApproveOpen(false)}
        onOk={handleApproveSubmit}
        confirmLoading={approveLoading}
        okText="提交审批"
        cancelText="取消"
        destroyOnHidden
      >
        {approveTarget && (
          <>
            <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="故障编号">{approveTarget.fault_no}</Descriptions.Item>
              <Descriptions.Item label="设备名称">{approveTarget.device_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="维修人">{approveTarget.repair_person_name || '-'}</Descriptions.Item>
            </Descriptions>
            <Title level={5}>维修成本摘要</Title>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="维修工时">{approveTarget.repair_hours != null ? `${approveTarget.repair_hours} 小时` : '-'}</Descriptions.Item>
              <Descriptions.Item label="备件费用">{approveTarget.parts_cost != null ? `¥${approveTarget.parts_cost}` : '-'}</Descriptions.Item>
              <Descriptions.Item label="人工成本">{approveTarget.labor_cost != null ? `¥${approveTarget.labor_cost}` : '-'}</Descriptions.Item>
              <Descriptions.Item label="外协费用">{approveTarget.outsource_cost != null ? `¥${approveTarget.outsource_cost}` : '-'}</Descriptions.Item>
              <Descriptions.Item label="总成本" span={2}>
                <Text strong style={{ color: '#f50' }}>{approveTarget.total_cost != null ? `¥${approveTarget.total_cost}` : '-'}</Text>
              </Descriptions.Item>
            </Descriptions>
            <Form form={approveForm} layout="vertical">
              <Form.Item label="审批结果" name="result" rules={[{ required: true, message: '请选择审批结果' }]}>
                <Select
                  options={[
                    { label: '通过', value: '通过' },
                    { label: '驳回', value: '驳回' },
                  ]}
                />
              </Form.Item>
              <Form.Item label="审批意见" name="opinion" rules={[{ required: true, message: '请输入审批意见' }]}>
                <TextArea rows={3} placeholder="请输入审批意见" />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </>
  )
}
