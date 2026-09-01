import ResizableTable from '../../components/ResizableTable'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Tag, Button, Select, DatePicker, Space, Input, Drawer, Form, Descriptions,
  Typography, Alert, message, Modal, Popconfirm, Upload, Image, InputNumber,
  Empty, Spin, Radio, Table, Divider, Checkbox,
} from 'antd'
import type { UploadFile } from 'antd'
import {
  ToolOutlined, ClockCircleOutlined, CheckCircleOutlined, ScheduleOutlined,
  SearchOutlined, ReloadOutlined, PlusOutlined, SettingOutlined, ThunderboltOutlined,
  EditOutlined, EyeOutlined, UploadOutlined, DeleteOutlined, DashboardOutlined,
} from '@ant-design/icons'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import type { StatItem } from '../../components/ThreeSectionPage'
import { formatDateTime, formatDate } from '../../utils'
import { MONTH_QUICK_OPTIONS, getMonthRange, validateRange, getThisMonth } from '../../utils/monthQuick'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import api from '../../utils/api'

const { RangePicker } = DatePicker
const { TextArea } = Input
const { Title, Text } = Typography

// 状态与触发方式颜色映射
const statusColor: Record<string, string> = {
  '待执行': 'default',
  '执行中': 'processing',
  '已完成': 'success',
  '已挂起': 'error',
}
const triggerColor: Record<string, string> = { '周期': 'blue', '运行时长': 'orange' }

const STATUS_OPTIONS = [
  { label: '待执行', value: '待执行' },
  { label: '执行中', value: '执行中' },
  { label: '已完成', value: '已完成' },
  { label: '已挂起', value: '已挂起' },
]

const TRIGGER_OPTIONS = [
  { label: '周期', value: '周期' },
  { label: '运行时长', value: '运行时长' },
]

const CYCLE_UNIT_OPTIONS = [
  { label: '天', value: '天' },
  { label: '周', value: '周' },
  { label: '月', value: '月' },
  { label: '季', value: '季' },
]

const RESULT_OPTIONS = [
  { label: '正常', value: '正常' },
  { label: '异常', value: '异常' },
]

const uid = () => Math.random().toString(36).slice(2, 10)

// 周期型：根据上次维护日期 + 周期值/单位计算下次维护日期
function computeNextDate(baseDate: string | null, cycleValue: number, cycleUnit: string): string {
  const base = baseDate ? dayjs(baseDate) : dayjs()
  const cv = Number(cycleValue) || 0
  switch (cycleUnit) {
    case '天': return base.add(cv, 'day').format('YYYY-MM-DD')
    case '周': return base.add(cv, 'week').format('YYYY-MM-DD')
    case '月': return base.add(cv, 'month').format('YYYY-MM-DD')
    case '季': return base.add(cv * 3, 'month').format('YYYY-MM-DD')
    default: return base.add(cv, 'day').format('YYYY-MM-DD')
  }
}

// 备件行
interface SparePartRow {
  key: string
  name: string
  quantity: number
  unit_price: number
}

// 维护标准行
interface StdRow {
  key: string
  standard_id?: number
  standard_name: string
  device_id?: number
  device_type?: string
  item_name: string
  trigger_type: string
  cycle_value?: number
  cycle_unit?: string
  runtime_threshold?: number
  standard_requirement?: string
  last_maintenance_date?: string
  last_maintenance_runtime?: number
  next_maintenance_date?: string
  status: number
  remarks?: string
}

interface ImageRow {
  image_id?: number
  file_path?: string
  file_name?: string
}

export default function DeviceMaintenancePlan() {
  // ============ 列表数据 ============
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })

  // ============ 筛选条件 ============
  const [recordNo, setRecordNo] = useState<string | undefined>(undefined)
  const [deviceName, setDeviceName] = useState<string | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState<string[]>(['待执行', '执行中', '已挂起'])
  const [triggerFilter, setTriggerFilter] = useState<string | undefined>(undefined)
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(getThisMonth())
  const [monthQuick, setMonthQuick] = useState<string | undefined>('this_month')
  const [rangeWarn, setRangeWarn] = useState(false)

  // ============ 详情 Drawer ============
  const [detailOpen, setDetailOpen] = useState(false)
  const [currentDetail, setCurrentDetail] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailImages, setDetailImages] = useState<ImageRow[]>([])

  // ============ 维护执行 Modal ============
  const [execOpen, setExecOpen] = useState(false)
  const [execLoading, setExecLoading] = useState(false)
  const [execRecord, setExecRecord] = useState<any>(null)
  const [execContent, setExecContent] = useState<string>('')
  const [execResult, setExecResult] = useState<string | undefined>(undefined)
  const [execAbnormalDesc, setExecAbnormalDesc] = useState<string>('')
  const [execHours, setExecHours] = useState<number | undefined>(undefined)
  const [execRemarks, setExecRemarks] = useState<string>('')
  const [execSpareParts, setExecSpareParts] = useState<SparePartRow[]>([])
  const [execFileList, setExecFileList] = useState<UploadFile[]>([])

  // ============ 维护标准管理 Drawer ============
  const [stdOpen, setStdOpen] = useState(false)
  const [stdItems, setStdItems] = useState<StdRow[]>([])
  const [stdLoading, setStdLoading] = useState(false)
  const [stdSaving, setStdSaving] = useState(false)

  // ============ 运行时长录入 Modal ============
  const [runtimeOpen, setRuntimeOpen] = useState(false)
  const [runtimeDeviceId, setRuntimeDeviceId] = useState<number | undefined>(undefined)
  const [runtimeHours, setRuntimeHours] = useState<number | undefined>(undefined)
  const [runtimePrev, setRuntimePrev] = useState<number | null>(null)
  const [runtimeRemarks, setRuntimeRemarks] = useState<string>('')
  const [runtimeLoading, setRuntimeLoading] = useState(false)
  const [runtimePrevLoading, setRuntimePrevLoading] = useState(false)

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
      if (recordNo) params.record_no = recordNo
      if (deviceName) params.device_name = deviceName
      if (statusFilter && statusFilter.length > 0) params.status = statusFilter.join(',')
      if (triggerFilter) params.trigger_type = triggerFilter
      if (dateRange && dateRange[0]) params.start_date = dateRange[0].format('YYYY-MM-DD')
      if (dateRange && dateRange[1]) params.end_date = dateRange[1].format('YYYY-MM-DD')

      const res = await api.get('/basic/device-maintenance-records', { params })
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
  }, [pagination.current, pagination.pageSize, recordNo, deviceName, statusFilter, triggerFilter, dateRange])

  useEffect(() => { fetchData() }, [fetchData])

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
      label: d.device_name || d.device_code || String(d.device_id ?? d.id),
      value: d.device_id ?? d.id,
      raw: d,
    })), [devices])

  // ============ 统计 ============
  const stats: StatItem[] = useMemo(() => {
    const today = dayjs()
    const monthStart = today.startOf('month').format('YYYY-MM-DD')
    const pending = data.filter(d => d.status === '待执行').length
    const executing = data.filter(d => d.status === '执行中').length
    const monthCompleted = data.filter(d => d.status === '已完成' && (d.plan_date || '') >= monthStart).length
    // 即将到期：未完成且计划日期在未来7天内
    const todayStr = today.format('YYYY-MM-DD')
    const upcoming = today.add(7, 'day').format('YYYY-MM-DD')
    const expiring = data.filter(d => {
      if (d.status === '已完成') return false
      const pd = d.plan_date || ''
      return pd >= todayStr && pd <= upcoming
    }).length
    return [
      { label: '待执行', value: pending, icon: <ClockCircleOutlined />, color: '#FF9800' },
      { label: '执行中', value: executing, icon: <ToolOutlined />, color: '#00BCD4' },
      { label: '本月已完成', value: monthCompleted, icon: <CheckCircleOutlined />, color: '#4CAF50' },
      { label: '即将到期', value: expiring, icon: <ScheduleOutlined />, color: '#9C27B0' },
      { label: '总工单数', value: pagination.total, icon: <DashboardOutlined />, color: '#2196F3' },
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
    setRecordNo(undefined)
    setDeviceName(undefined)
    setStatusFilter(['待执行', '执行中', '已挂起'])
    setTriggerFilter(undefined)
    setMonthQuick('this_month')
    setDateRange(getThisMonth())
    setPagination(p => ({ ...p, current: 1 }))
  }

  // ============ 生成维护工单 ============
  const handleGenerate = async () => {
    Modal.confirm({
      title: '生成维护工单',
      content: '将根据已启用的维护标准自动生成到期维护工单，已存在未完成工单的标准将跳过。是否继续？',
      okText: '生成',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await api.post('/basic/device-maintenance-records/generate', {})
          if (res.success !== false) {
            message.success(res.message || `生成完成，新增 ${res.data?.created ?? 0} 条工单`)
            setPagination(p => ({ ...p, current: 1 }))
            fetchData()
          } else {
            message.error(res.message || '生成失败')
          }
        } catch (e: any) {
          message.error(e?.message || '生成失败')
        }
      },
    })
  }

  // ============ 详情 ============
  const showDetail = async (record: any) => {
    setCurrentDetail(record)
    setDetailImages([])
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const res = await api.get(`/basic/device-maintenance-records/${record.record_id}`)
      if (res.success !== false && res.data) {
        setCurrentDetail(res.data)
        const imgs = res.data.maintenance_images || []
        setDetailImages(Array.isArray(imgs) ? imgs : [])
      }
    } catch (e: any) {
      message.error(e?.message || '加载详情失败')
    } finally {
      setDetailLoading(false)
    }
  }

  // ============ 开始维护 ============
  const handleStart = async (record: any) => {
    try {
      const res = await api.put(`/basic/device-maintenance-records/${record.record_id}/start`, {})
      if (res.success !== false) {
        message.success('已开始维护')
        fetchData()
      } else {
        message.error(res.message || '操作失败')
      }
    } catch (e: any) {
      message.error(e?.message || '操作失败')
    }
  }

  // ============ 维护执行 Modal ============
  const openExec = (record: any) => {
    setExecRecord(record)
    setExecContent('')
    setExecResult(undefined)
    setExecAbnormalDesc('')
    setExecHours(undefined)
    setExecRemarks('')
    setExecSpareParts([])
    setExecFileList([])
    setExecOpen(true)
  }

  const addSparePart = () => {
    setExecSpareParts(prev => [...prev, { key: uid(), name: '', quantity: 1, unit_price: 0 }])
  }
  const removeSparePart = (key: string) => {
    setExecSpareParts(prev => prev.filter(p => p.key !== key))
  }
  const updateSparePart = (key: string, patch: Partial<SparePartRow>) => {
    setExecSpareParts(prev => prev.map(p => p.key === key ? { ...p, ...patch } : p))
  }

  const partsCost = useMemo(() =>
    execSpareParts.reduce((sum, p) => sum + (Number(p.quantity) || 0) * (Number(p.unit_price) || 0), 0),
    [execSpareParts])

  const handleSubmitExec = async () => {
    if (!execRecord) return
    if (!execResult) {
      message.warning('请选择维护结果')
      return
    }
    setExecLoading(true)
    try {
      const payload: any = {
        maintenance_content: execContent,
        spare_parts_used: execSpareParts.map(p => ({
          name: p.name,
          quantity: Number(p.quantity) || 0,
          unit_price: Number(p.unit_price) || 0,
          subtotal: (Number(p.quantity) || 0) * (Number(p.unit_price) || 0),
        })),
        maintenance_hours: execHours !== undefined ? Number(execHours) : null,
        maintenance_result: execResult,
        abnormal_desc: execResult === '异常' ? execAbnormalDesc : '',
        remarks: execRemarks,
      }
      const res = await api.put(`/basic/device-maintenance-records/${execRecord.record_id}/submit`, payload)
      if (res.success !== false) {
        // 上传维护后照片
        const validFiles = execFileList.filter(f => f.originFileObj)
        if (validFiles.length > 0) {
          try {
            const formData = new FormData()
            validFiles.forEach(f => formData.append('images', f.originFileObj as File))
            await api.post(`/basic/device-maintenance-records/${execRecord.record_id}/images`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            })
          } catch (e: any) {
            message.warning(e?.message || '照片上传失败，但维护已提交')
          }
        }
        message.success(res.message || '提交维护成功')
        setExecOpen(false)
        setExecFileList([])
        fetchData()
      } else {
        message.error(res.message || '提交失败')
      }
    } catch (e: any) {
      message.error(e?.message || '提交失败')
    } finally {
      setExecLoading(false)
    }
  }

  // ============ 删除维护工单 ============
  const handleDelete = async (record: any) => {
    try {
      const res = await api.delete(`/basic/device-maintenance-records/${record.record_id}`)
      if (res.success !== false) {
        message.success('删除成功')
        fetchData()
      } else {
        message.error(res.message || '删除失败')
      }
    } catch (e: any) {
      message.error(e?.message || '删除失败')
    }
  }

  // ============ 维护标准管理 ============
  const openStdDrawer = () => {
    setStdItems([])
    setStdOpen(true)
    loadStandards()
  }

  const loadStandards = useCallback(async () => {
    setStdLoading(true)
    try {
      const res = await api.get('/basic/device-maintenance-standards', { params: {} })
      if (res.success !== false) {
        const list: any[] = res.data?.list || res.data || []
        setStdItems(list.map((s: any) => ({
          key: uid(),
          standard_id: s.standard_id,
          standard_name: s.standard_name || '',
          device_id: s.device_id,
          device_type: s.device_type,
          item_name: s.item_name || '',
          trigger_type: s.trigger_type || '周期',
          cycle_value: s.cycle_value !== undefined && s.cycle_value !== null ? Number(s.cycle_value) : undefined,
          cycle_unit: s.cycle_unit || '天',
          runtime_threshold: s.runtime_threshold !== undefined && s.runtime_threshold !== null ? Number(s.runtime_threshold) : undefined,
          standard_requirement: s.standard_requirement || '',
          last_maintenance_date: s.last_maintenance_date || undefined,
          last_maintenance_runtime: s.last_maintenance_runtime !== undefined && s.last_maintenance_runtime !== null ? Number(s.last_maintenance_runtime) : undefined,
          next_maintenance_date: s.next_maintenance_date || undefined,
          status: s.status !== undefined ? Number(s.status) : 1,
          remarks: s.remarks || '',
        })))
      } else {
        setStdItems([])
      }
    } catch (e: any) {
      message.error(e?.message || '加载维护标准失败')
      setStdItems([])
    } finally {
      setStdLoading(false)
    }
  }, [])

  const addStdItem = () => {
    setStdItems(prev => [...prev, {
      key: uid(),
      standard_name: '',
      item_name: '',
      trigger_type: '周期',
      cycle_value: 30,
      cycle_unit: '天',
      status: 1,
    }])
  }
  const removeStdItem = async (row: StdRow) => {
    if (row.standard_id) {
      try {
        const res = await api.delete(`/basic/device-maintenance-standards/${row.standard_id}`)
        if (res.success === false) {
          message.error(res.message || '删除失败')
          return
        }
      } catch (e: any) {
        message.error(e?.message || '删除失败')
        return
      }
    }
    setStdItems(prev => prev.filter(it => it.key !== row.key))
  }
  const updateStdItem = (key: string, patch: Partial<StdRow>) => {
    setStdItems(prev => prev.map(it => it.key === key ? { ...it, ...patch } : it))
  }
  const saveStdItem = async (row: StdRow) => {
    if (!row.standard_name) {
      message.warning('请填写维护标准名称')
      return
    }
    if (!row.item_name) {
      message.warning('请填写维护项目名称')
      return
    }
    if (row.trigger_type === '周期' && (!row.cycle_value || Number(row.cycle_value) <= 0)) {
      message.warning('周期型标准必须填写有效的周期值')
      return
    }
    if (row.trigger_type === '运行时长' && (!row.runtime_threshold || Number(row.runtime_threshold) <= 0)) {
      message.warning('运行时长型标准必须填写有效的运行时长阈值')
      return
    }
    setStdSaving(true)
    try {
      const device = row.device_id ? devices.find((d: any) => (d.device_id ?? d.id) === row.device_id) : undefined
      const payload: any = {
        standard_name: row.standard_name,
        device_type: row.device_type || null,
        device_id: row.device_id || null,
        device_code: device?.device_code,
        device_name: device?.device_name,
        item_name: row.item_name,
        trigger_type: row.trigger_type,
        cycle_value: row.cycle_value !== undefined ? Number(row.cycle_value) : null,
        cycle_unit: row.cycle_unit || '天',
        runtime_threshold: row.runtime_threshold !== undefined ? Number(row.runtime_threshold) : null,
        standard_requirement: row.standard_requirement || '',
        last_maintenance_date: row.last_maintenance_date || null,
        last_maintenance_runtime: row.last_maintenance_runtime !== undefined ? row.last_maintenance_runtime : null,
        status: row.status,
        remarks: row.remarks || '',
      }
      let res: any
      if (row.standard_id) {
        res = await api.put(`/basic/device-maintenance-standards/${row.standard_id}`, payload)
        if (res.success !== false && res.data?.next_maintenance_date !== undefined) {
          updateStdItem(row.key, { next_maintenance_date: res.data.next_maintenance_date || undefined })
        }
      } else {
        res = await api.post('/basic/device-maintenance-standards', payload)
        if (res.success !== false && res.data?.standard_id) {
          const patch: Partial<StdRow> = { standard_id: res.data.standard_id }
          if (res.data.next_maintenance_date !== undefined) patch.next_maintenance_date = res.data.next_maintenance_date
          updateStdItem(row.key, patch)
        }
      }
      if (res.success !== false) {
        message.success(row.standard_id ? '保存成功' : '创建成功')
      } else {
        message.error(res.message || '保存失败')
      }
    } catch (e: any) {
      message.error(e?.message || '保存失败')
    } finally {
      setStdSaving(false)
    }
  }
  const toggleStdStatus = async (row: StdRow) => {
    const next = row.status === 1 ? 0 : 1
    if (row.standard_id) {
      try {
        const res = await api.put(`/basic/device-maintenance-standards/${row.standard_id}`, { status: next })
        if (res.success === false) {
          message.error(res.message || '切换失败')
          return
        }
      } catch (e: any) {
        message.error(e?.message || '切换失败')
        return
      }
    }
    updateStdItem(row.key, { status: next })
  }

  // ============ 运行时长录入 Modal ============
  const openRuntimeModal = () => {
    setRuntimeDeviceId(undefined)
    setRuntimeHours(undefined)
    setRuntimePrev(null)
    setRuntimeRemarks('')
    setRuntimeOpen(true)
  }

  const handleRuntimeDeviceChange = async (val: number | undefined) => {
    setRuntimeDeviceId(val)
    setRuntimePrev(null)
    if (!val) return
    setRuntimePrevLoading(true)
    try {
      const res = await api.get('/basic/device-runtime-logs', {
        params: { device_id: val, page: 1, page_size: 1 },
      })
      if (res.success !== false) {
        const list: any[] = res.data?.list || res.data || []
        if (list.length > 0) {
          setRuntimePrev(Number(list[0].runtime_hours) || 0)
        } else {
          setRuntimePrev(0)
        }
      }
    } catch {
      setRuntimePrev(null)
    } finally {
      setRuntimePrevLoading(false)
    }
  }

  const handleSubmitRuntime = async () => {
    if (!runtimeDeviceId) {
      message.warning('请选择设备')
      return
    }
    if (runtimeHours === undefined || runtimeHours === null) {
      message.warning('请输入累计运行小时数')
      return
    }
    setRuntimeLoading(true)
    try {
      const device = devices.find((d: any) => (d.device_id ?? d.id) === runtimeDeviceId)
      const res = await api.post('/basic/device-runtime-logs', {
        device_id: runtimeDeviceId,
        device_code: device?.device_code,
        device_name: device?.device_name,
        runtime_hours: Number(runtimeHours),
        remarks: runtimeRemarks,
      })
      if (res.success !== false) {
        message.success(res.message || '录入成功')
        setRuntimeOpen(false)
        fetchData()
      } else {
        message.error(res.message || '录入失败')
      }
    } catch (e: any) {
      message.error(e?.message || '录入失败')
    } finally {
      setRuntimeLoading(false)
    }
  }

  const runtimeDelta = useMemo(() => {
    if (runtimeHours === undefined || runtimeHours === null || runtimePrev === null) return null
    const diff = Number(runtimeHours) - Number(runtimePrev)
    return diff > 0 ? Number(diff.toFixed(2)) : 0
  }, [runtimeHours, runtimePrev])

  // ============ 图片上传辅助 ============
  const uploadButton = (
    <div>
      <UploadOutlined />
      <div style={{ marginTop: 4 }}>上传照片</div>
    </div>
  )

  const renderImageGroup = (images: ImageRow[], emptyText: string) => {
    if (!images || images.length === 0) {
      return <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />
    }
    return (
      <Image.PreviewGroup>
        <Space wrap size={8}>
          {images.map((img) => (
            <Image
              key={img.image_id ?? img.file_path}
              src={img.file_path}
              alt={img.file_name || '维护图片'}
              width={120}
              height={120}
              style={{ objectFit: 'cover', borderRadius: 4 }}
            />
          ))}
        </Space>
      </Image.PreviewGroup>
    )
  }

  // ============ 表格列 ============
  const columns = [
    { title: '工单编号', dataIndex: 'record_no', key: 'record_no', width: 150, fixed: 'left' as const },
    { title: '设备编号', dataIndex: 'device_code', key: 'device_code', width: 120 },
    { title: '设备名称', dataIndex: 'device_name', key: 'device_name', width: 150, ellipsis: true },
    { title: '维护类型', dataIndex: 'maintenance_type', key: 'maintenance_type', width: 120, ellipsis: true },
    {
      title: '触发方式', dataIndex: 'trigger_type', key: 'trigger_type', width: 100,
      render: (v: string) => v ? <Tag color={triggerColor[v] || 'default'}>{v}</Tag> : '-',
    },
    { title: '计划日期', dataIndex: 'plan_date', key: 'plan_date', width: 120 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (v: string) => <Tag color={statusColor[v] || 'default'}>{v || '-'}</Tag>,
    },
    { title: '维护人', dataIndex: 'maintainer_name', key: 'maintainer_name', width: 100 },
    {
      title: '维护结果', dataIndex: 'maintenance_result', key: 'maintenance_result', width: 90,
      render: (v: string, r: any) => {
        if (r.status !== '已完成') return <Text type="secondary">-</Text>
        return v ? <Tag color={v === '正常' ? 'success' : 'error'}>{v}</Tag> : '-'
      },
    },
    {
      title: '操作', key: 'action', fixed: 'right' as const, width: 220,
      render: (_: any, record: any) => {
        const status = record.status
        return (
          <Space size="small" wrap>
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => showDetail(record)}>查看</Button>
            {status === '待执行' && (
              <Button type="link" size="small" onClick={() => handleStart(record)}>开始</Button>
            )}
            {(status === '待执行' || status === '执行中') && (
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openExec(record)}>维护执行</Button>
            )}
            {status !== '已完成' && (
              <Popconfirm
                title="确认删除该维护工单？"
                onConfirm={() => handleDelete(record)}
                okText="删除" cancelText="取消"
              >
                <Button type="link" size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
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
        placeholder="工单编号"
        allowClear
        prefix={<SearchOutlined />}
        style={{ width: 160 }}
        value={recordNo}
        onChange={(e) => setRecordNo(e.target.value || undefined)}
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
        placeholder="触发方式"
        allowClear
        style={{ width: 120 }}
        options={TRIGGER_OPTIONS}
        value={triggerFilter}
        onChange={setTriggerFilter}
      />
      <div style={{ display: 'inline-flex', alignItems: 'center' }}>
        <span style={{ color: '#888', fontSize: 13, marginRight: 6, whiteSpace: 'nowrap' }}>状态：</span>
        <Checkbox.Group
          value={statusFilter}
          onChange={v => setStatusFilter(v as string[])}
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
      <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleGenerate}>生成维护工单</Button>
      <Button icon={<DashboardOutlined />} onClick={openRuntimeModal}>运行时长录入</Button>
      <Button icon={<SettingOutlined />} onClick={openStdDrawer}>维护标准</Button>
      <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
    </Space>
  )

  // ============ 维护标准列 ============
  // 注意：所有列必须显式声明 dataIndex，否则 Antd Table 的 render(value, record, index) 第二个参数
  //       会退化为 index（而非 record），导致 r.xxx 读取到 undefined；
  //       同时某些列缺少 dataIndex 时 value 可能是整行对象，被直接渲染到 JSX 会抛 React error #31
  const stdColumns = [
    {
      title: '标准名称', key: 'standard_name', dataIndex: 'standard_name', width: 160,
      render: (_: any, r: StdRow) => (
        <Input
          placeholder="维护标准名称"
          value={r.standard_name}
          onChange={(e) => updateStdItem(r.key, { standard_name: e.target.value })}
        />
      ),
    },
    {
      title: '设备', key: 'device_id', dataIndex: 'device_id', width: 200,
      render: (_: any, r: StdRow) => (
        <Select
          showSearch
          placeholder="选择设备（可空）"
          style={{ width: '100%' }}
          value={r.device_id}
          onChange={(v) => updateStdItem(r.key, { device_id: v })}
          options={deviceOptions}
          allowClear
          filterOption={(input, option) =>
            (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
          }
        />
      ),
    },
    {
      title: '维护项目', key: 'item_name', dataIndex: 'item_name', width: 140,
      render: (_: any, r: StdRow) => (
        <Input
          placeholder="维护项目名称"
          value={r.item_name}
          onChange={(e) => updateStdItem(r.key, { item_name: e.target.value })}
        />
      ),
    },
    {
      title: '触发方式', key: 'trigger_type', dataIndex: 'trigger_type', width: 110,
      render: (_: any, r: StdRow) => (
        <Select
          style={{ width: '100%' }}
          value={r.trigger_type}
          options={TRIGGER_OPTIONS}
          onChange={(v) => updateStdItem(r.key, { trigger_type: v })}
        />
      ),
    },
    {
      title: '周期/阈值', key: 'cycle', dataIndex: 'cycle_value', width: 220,
      render: (_: any, r: StdRow) => {
        if (r.trigger_type === '运行时长') {
          return (
            <Space>
              <InputNumber
                placeholder="阈值"
                min={0}
                style={{ width: 110 }}
                value={r.runtime_threshold}
                onChange={(v) => updateStdItem(r.key, { runtime_threshold: v ?? undefined })}
              />
              <Text type="secondary">小时</Text>
            </Space>
          )
        }
        return (
          <Space>
            <InputNumber
              placeholder="周期值"
              min={1}
              style={{ width: 90 }}
              value={r.cycle_value}
              onChange={(v) => updateStdItem(r.key, { cycle_value: v ?? undefined })}
            />
            <Select
              style={{ width: 80 }}
              value={r.cycle_unit}
              options={CYCLE_UNIT_OPTIONS}
              onChange={(v) => updateStdItem(r.key, { cycle_unit: v })}
            />
          </Space>
        )
      },
    },
    {
      title: '标准要求', key: 'standard_requirement', dataIndex: 'standard_requirement', width: 200,
      render: (_: any, r: StdRow) => (
        <Input
          placeholder="维护说明/标准要求"
          value={r.standard_requirement}
          onChange={(e) => updateStdItem(r.key, { standard_requirement: e.target.value })}
        />
      ),
    },
    {
      title: '上次维护', key: 'last_maintenance', dataIndex: 'last_maintenance_date', width: 160,
      render: (_: any, r: StdRow) => {
        if (r.trigger_type === '运行时长') {
          return r.last_maintenance_runtime !== undefined ? `${r.last_maintenance_runtime} h` : <Text type="secondary">-</Text>
        }
        return r.last_maintenance_date || <Text type="secondary">-</Text>
      },
    },
    {
      title: '下次维护', key: 'next_maintenance_date', dataIndex: 'next_maintenance_date', width: 120,
      render: (v: string, r: StdRow) => {
        if (r.trigger_type === '运行时长') return <Text type="secondary">-</Text>
        // 周期型未保存时按上次维护日期 + 周期本地预览
        if (!v && r.cycle_value && r.cycle_unit) {
          const preview = computeNextDate(r.last_maintenance_date || null, r.cycle_value, r.cycle_unit)
          return <Tag color="blue">{preview}</Tag>
        }
        return v ? <Tag color="blue">{v}</Tag> : <Text type="secondary">-</Text>
      },
    },
    {
      title: '状态', key: 'status', dataIndex: 'status', width: 80,
      render: (_: any, r: StdRow) => (
        <Tag
          color={r.status === 1 ? 'success' : 'default'}
          style={{ cursor: 'pointer' }}
          onClick={() => toggleStdStatus(r)}
        >
          {r.status === 1 ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '操作', key: 'action', dataIndex: 'standard_id', width: 160, fixed: 'right' as const,
      render: (_: any, r: StdRow) => (
        <Space size="small">
          <Button type="link" size="small" loading={stdSaving} onClick={() => saveStdItem(r)}>
            {r.standard_id ? '保存' : '创建'}
          </Button>
          <Popconfirm
            title="确认删除该维护标准？"
            onConfirm={() => removeStdItem(r)}
            okText="删除" cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
      <ThreeSectionPage
        title="设备维护"
        breadcrumbs="设备管理 / 设备维护"
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
            <ResizableTable
              tableKey="pages_device_DeviceMaintenancePlan"
              columns={columns}
              dataSource={data}
              rowKey="record_id"
              size="small"
              loading={loading}
              scroll={{ x: 1400 }}
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

      {/* ============ 维护详情 Drawer ============ */}
      <Drawer
        title="维护工单详情"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={900}
        destroyOnHidden
      >
        <Spin spinning={detailLoading}>
          {currentDetail && (
            <div style={{ height: 'calc(100vh - 120px)', overflow: 'auto', paddingRight: 8 }}>
              <Title level={5}>基本信息</Title>
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="工单编号">{currentDetail.record_no || '-'}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={statusColor[currentDetail.status] || 'default'}>{currentDetail.status || '-'}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="设备编号">{currentDetail.device_code || '-'}</Descriptions.Item>
                <Descriptions.Item label="设备名称">{currentDetail.device_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="维护类型">{currentDetail.maintenance_type || '-'}</Descriptions.Item>
                <Descriptions.Item label="触发方式">
                  {currentDetail.trigger_type ? <Tag color={triggerColor[currentDetail.trigger_type] || 'default'}>{currentDetail.trigger_type}</Tag> : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="计划日期">{currentDetail.plan_date || '-'}</Descriptions.Item>
                <Descriptions.Item label="维护人">{currentDetail.maintainer_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="开始时间">{formatDateTime(currentDetail.start_time)}</Descriptions.Item>
                <Descriptions.Item label="结束时间">{formatDateTime(currentDetail.end_time)}</Descriptions.Item>
                <Descriptions.Item label="维护结果">
                  {currentDetail.maintenance_result ? <Tag color={currentDetail.maintenance_result === '正常' ? 'success' : 'error'}>{currentDetail.maintenance_result}</Tag> : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="维护耗时">
                  {currentDetail.maintenance_hours != null ? `${currentDetail.maintenance_hours} 小时` : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="备注" span={2}>{currentDetail.remarks || '-'}</Descriptions.Item>
              </Descriptions>

              {currentDetail.standard && (
                <>
                  <Title level={5} style={{ marginTop: 16 }}>维护标准</Title>
                  <Descriptions column={2} size="small" bordered>
                    <Descriptions.Item label="标准名称">{currentDetail.standard.standard_name || '-'}</Descriptions.Item>
                    <Descriptions.Item label="维护项目">{currentDetail.standard.item_name || '-'}</Descriptions.Item>
                    <Descriptions.Item label="触发方式">
                      {currentDetail.standard.trigger_type ? <Tag color={triggerColor[currentDetail.standard.trigger_type] || 'default'}>{currentDetail.standard.trigger_type}</Tag> : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="标准要求" span={2}>{currentDetail.standard.standard_requirement || '-'}</Descriptions.Item>
                  </Descriptions>
                </>
              )}

              <Title level={5} style={{ marginTop: 16 }}>维护记录</Title>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="维护内容">{currentDetail.maintenance_content || '-'}</Descriptions.Item>
                <Descriptions.Item label="异常描述">{currentDetail.abnormal_desc || '-'}</Descriptions.Item>
              </Descriptions>

              {Array.isArray(currentDetail.spare_parts_used) && currentDetail.spare_parts_used.length > 0 && (
                <Table
                  size="small"
                  style={{ marginTop: 12 }}
                  rowKey={(_r: any, i?: number) => String(i)}
                  dataSource={currentDetail.spare_parts_used}
                  columns={[
                    { title: '备件名称', dataIndex: 'name', key: 'name', width: 200 },
                    { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 100 },
                    {
                      title: '单价', dataIndex: 'unit_price', key: 'unit_price', width: 120,
                      render: (v: number) => v != null ? `¥${v}` : '-',
                    },
                    {
                      title: '小计', key: 'subtotal', width: 120,
                      render: (_: any, r: any) => `¥${((Number(r.quantity) || 0) * (Number(r.unit_price) || 0)).toFixed(2)}`,
                    },
                  ]}
                  pagination={false}
                />
              )}

              <Title level={5} style={{ marginTop: 16 }}>维护后照片</Title>
              {renderImageGroup(detailImages, '暂无维护后照片')}
            </div>
          )}
        </Spin>
      </Drawer>

      {/* ============ 维护执行 Modal ============ */}
      <Modal
        title="维护执行"
        open={execOpen}
        onCancel={() => setExecOpen(false)}
        onOk={handleSubmitExec}
        confirmLoading={execLoading}
        okText="提交"
        cancelText="取消"
        width={820}
        destroyOnHidden
      >
        {execRecord && (
          <>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="工单编号">{execRecord.record_no || '-'}</Descriptions.Item>
              <Descriptions.Item label="设备名称">{execRecord.device_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="维护类型">{execRecord.maintenance_type || '-'}</Descriptions.Item>
              <Descriptions.Item label="触发方式">
                {execRecord.trigger_type ? <Tag color={triggerColor[execRecord.trigger_type] || 'default'}>{execRecord.trigger_type}</Tag> : '-'}
              </Descriptions.Item>
            </Descriptions>

            <Form layout="vertical">
              <Form.Item label="维护内容记录" required>
                <TextArea
                  rows={4}
                  placeholder="请记录维护过程与内容"
                  value={execContent}
                  onChange={(e) => setExecContent(e.target.value)}
                />
              </Form.Item>

              <Divider orientation="left" plain>备件使用</Divider>
              {execSpareParts.length === 0 && <Text type="secondary">暂无备件，点击下方按钮添加</Text>}
              {execSpareParts.map((p) => (
                <Space key={p.key} style={{ display: 'flex', marginBottom: 8 }} align="center">
                  <Input
                    placeholder="备件名称"
                    style={{ width: 220 }}
                    value={p.name}
                    onChange={(e) => updateSparePart(p.key, { name: e.target.value })}
                  />
                  <InputNumber
                    placeholder="数量"
                    min={0}
                    style={{ width: 100 }}
                    value={p.quantity}
                    onChange={(v) => updateSparePart(p.key, { quantity: Number(v) || 0 })}
                  />
                  <InputNumber
                    placeholder="单价"
                    min={0}
                    prefix="¥"
                    style={{ width: 120 }}
                    value={p.unit_price}
                    onChange={(v) => updateSparePart(p.key, { unit_price: Number(v) || 0 })}
                  />
                  <Text>小计：¥{((Number(p.quantity) || 0) * (Number(p.unit_price) || 0)).toFixed(2)}</Text>
                  <Button type="link" danger icon={<DeleteOutlined />} onClick={() => removeSparePart(p.key)} />
                </Space>
              ))}
              <div style={{ marginBottom: 12 }}>
                <Button type="dashed" icon={<PlusOutlined />} onClick={addSparePart}>添加备件</Button>
                <Text type="secondary" style={{ marginLeft: 16 }}>备件合计：¥{partsCost.toFixed(2)}</Text>
              </div>

              <Divider orientation="left" plain>结果与耗时</Divider>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Form.Item label="维护耗时（小时）" required>
                  <InputNumber
                    min={0}
                    step={0.5}
                    precision={2}
                    style={{ width: '100%' }}
                    placeholder="请输入维护耗时"
                    value={execHours}
                    onChange={(v) => setExecHours(v ?? undefined)}
                  />
                </Form.Item>
                <Form.Item label="维护结果" required>
                  <Select
                    placeholder="请选择维护结果"
                    options={RESULT_OPTIONS}
                    value={execResult}
                    onChange={setExecResult}
                  />
                </Form.Item>
              </div>

              {execResult === '异常' && (
                <Form.Item label="异常描述" required>
                  <TextArea
                    rows={3}
                    placeholder="请描述异常情况"
                    value={execAbnormalDesc}
                    onChange={(e) => setExecAbnormalDesc(e.target.value)}
                  />
                </Form.Item>
              )}

              <Form.Item label="维护后照片">
                <Upload
                  listType="picture-card"
                  fileList={execFileList}
                  multiple
                  accept="image/*"
                  beforeUpload={() => false}
                  onChange={({ fileList: fl }) => setExecFileList(fl)}
                >
                  {execFileList.length >= 9 ? null : uploadButton}
                </Upload>
                <div style={{ color: '#999', fontSize: 12 }}>支持多图上传，最多 9 张，提交后自动上传至服务器</div>
              </Form.Item>

              <Form.Item label="备注">
                <TextArea
                  rows={2}
                  placeholder="可填写维护备注"
                  value={execRemarks}
                  onChange={(e) => setExecRemarks(e.target.value)}
                />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      {/* ============ 维护标准管理 Drawer ============ */}
      <Drawer
        title="维护标准管理"
        open={stdOpen}
        onClose={() => setStdOpen(false)}
        width={1300}
        destroyOnHidden
        footer={
          <Space>
            <Button onClick={() => setStdOpen(false)}>关闭</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={addStdItem}>添加标准</Button>
          </Space>
        }
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="周期型标准将按 上次维护日期 + 周期 自动计算下次维护日期；运行时长型标准会在设备运行时长达到阈值时自动触发维护工单生成。"
        />
        <Spin spinning={stdLoading}>
          <Table
            size="small"
            rowKey="key"
            dataSource={stdItems}
            columns={stdColumns}
            pagination={false}
            scroll={{ x: 1300, y: 520 }}
            locale={{ emptyText: '暂无维护标准，点击「添加标准」新建' }}
          />
        </Spin>
      </Drawer>

      {/* ============ 运行时长录入 Modal ============ */}
      <Modal
        title="运行时长录入"
        open={runtimeOpen}
        onCancel={() => setRuntimeOpen(false)}
        onOk={handleSubmitRuntime}
        confirmLoading={runtimeLoading}
        okText="提交"
        cancelText="取消"
        destroyOnHidden
      >
        <Form layout="vertical">
          <Form.Item label="选择设备" required>
            <Select
              showSearch
              placeholder="请选择设备"
              options={deviceOptions}
              value={runtimeDeviceId}
              onChange={handleRuntimeDeviceChange}
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item label="上次记录值（小时）">
              <Spin spinning={runtimePrevLoading}>
                <Input
                  disabled
                  value={runtimePrev === null ? '请先选择设备' : `${runtimePrev} h`}
                />
              </Spin>
            </Form.Item>
            <Form.Item label="本次增量（小时）">
              <Input disabled value={runtimeDelta === null ? '-' : `${runtimeDelta} h`} />
            </Form.Item>
          </div>
          <Form.Item label="当前累计运行小时数（从设备面板读取）" required>
            <InputNumber
              min={0}
              precision={2}
              style={{ width: '100%' }}
              placeholder="请输入累计运行小时数"
              value={runtimeHours}
              onChange={(v) => setRuntimeHours(v ?? undefined)}
            />
          </Form.Item>
          <Form.Item label="备注">
            <TextArea
              rows={2}
              placeholder="可填写录入备注"
              value={runtimeRemarks}
              onChange={(e) => setRuntimeRemarks(e.target.value)}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
