import ResizableTable from '../../components/ResizableTable'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Tag, Button, Select, DatePicker, Space, Input, Drawer, Form, Descriptions,
  Typography, Alert, message, Modal, Popconfirm, Upload, Image, InputNumber,
  Empty, Spin, Radio, Table, Checkbox,
} from 'antd'
import type { UploadFile } from 'antd'
import {
  FileSearchOutlined, CheckCircleOutlined, WarningOutlined, ClockCircleOutlined,
  SearchOutlined, ReloadOutlined, PlusOutlined, SettingOutlined, ThunderboltOutlined,
  EditOutlined, EyeOutlined, UploadOutlined, DeleteOutlined,
} from '@ant-design/icons'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import type { StatItem } from '../../components/ThreeSectionPage'
import { formatDateTime } from '../../utils'
import { MONTH_QUICK_OPTIONS, getMonthRange, validateRange, getThisMonth } from '../../utils/monthQuick'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import api from '../../utils/api'

const { RangePicker } = DatePicker
const { Title, Text } = Typography

// 状态颜色映射（与设备点检计划状态保持一致）
const statusColor: Record<string, string> = { '待检': 'default', '已完成': 'success', '漏检': 'error' }

const STATUS_OPTIONS = [
  { label: '待检', value: '待检' },
  { label: '已完成', value: '已完成' },
  { label: '漏检', value: '漏检' },
]

const JUDGE_TYPE_OPTIONS = [
  { label: '定性', value: '定性' },
  { label: '定量', value: '定量' },
]

const uid = () => Math.random().toString(36).slice(2, 10)

// 解析定量标准值，返回比较规则
interface StandardRule {
  op?: '<=' | '>=' | '<' | '>' | 'range' | '='
  min?: number
  max?: number
  value?: number
}
function parseStandardRule(standard: string | undefined | null): StandardRule {
  if (!standard) return {}
  const s = String(standard).trim()
  let m = s.match(/^(≤|<=)\s*(-?\d+(\.\d+)?)/)
  if (m) return { op: '<=', max: Number(m[2]) }
  m = s.match(/^(≥|>=)\s*(-?\d+(\.\d+)?)/)
  if (m) return { op: '>=', min: Number(m[2]) }
  m = s.match(/^(<)\s*(-?\d+(\.\d+)?)/)
  if (m) return { op: '<', max: Number(m[2]) }
  m = s.match(/^(>)\s*(-?\d+(\.\d+)?)/)
  if (m) return { op: '>', min: Number(m[2]) }
  m = s.match(/^(-?\d+(\.\d+)?)\s*[-~]\s*(-?\d+(\.\d+)?)/)
  if (m) return { op: 'range', min: Number(m[1]), max: Number(m[3]) }
  m = s.match(/^(=)?\s*(-?\d+(\.\d+)?)/)
  if (m) return { op: '=', value: Number(m[2]) }
  return {}
}

// 根据定量标准值与实测值自动判定
function judgeQuantitative(standard: string | undefined | null, actual: number | null | undefined): '正常' | '异常' | null {
  if (actual === null || actual === undefined || Number.isNaN(actual)) return null
  const r = parseStandardRule(standard)
  if (!r.op) return null
  switch (r.op) {
    case '<=': return r.max !== undefined && actual <= r.max ? '正常' : '异常'
    case '>=': return r.min !== undefined && actual >= r.min ? '正常' : '异常'
    case '<': return r.max !== undefined && actual < r.max ? '正常' : '异常'
    case '>': return r.min !== undefined && actual > r.min ? '正常' : '异常'
    case 'range': return r.min !== undefined && r.max !== undefined && actual >= r.min && actual <= r.max ? '正常' : '异常'
    case '=': return r.value !== undefined && actual === r.value ? '正常' : '异常'
    default: return null
  }
}

// 点检录入项（受控）
interface InspectionEntryItem {
  key: string
  standard_id?: number
  item_name: string
  standard_value?: string
  judge_type?: string
  unit?: string
  sort_order?: number
  actual_value: string
  result: '正常' | '异常' | null
  abnormal_desc?: string
}

// 点检标准项（标准管理 Drawer 中可增删）
interface StandardItemRow {
  key: string
  standard_id?: number
  item_name: string
  standard_value: string
  judge_type: string
  unit: string
  sort_order: number
  status: number
}

interface ImageRow {
  image_id?: number
  file_path?: string
  file_name?: string
}

export default function DeviceInspection() {
  // ============ 列表数据 ============
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })

  // ============ 筛选条件 ============
  const [planDate, setPlanDate] = useState<Dayjs | null>(dayjs())
  const [deviceName, setDeviceName] = useState<string | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState<string[]>(['待检', '已完成', '漏检'])
  const [inspectorName, setInspectorName] = useState<string | undefined>(undefined)
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(getThisMonth())
  const [monthQuick, setMonthQuick] = useState<string | undefined>('this_month')
  const [rangeWarn, setRangeWarn] = useState(false)

  // ============ 详情 Drawer ============
  const [detailOpen, setDetailOpen] = useState(false)
  const [currentDetail, setCurrentDetail] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailImages, setDetailImages] = useState<ImageRow[]>([])

  // ============ 点检录入 Drawer ============
  const [entryOpen, setEntryOpen] = useState(false)
  const [entryLoading, setEntryLoading] = useState(false)
  const [entryPlan, setEntryPlan] = useState<any>(null)
  const [entryItems, setEntryItems] = useState<InspectionEntryItem[]>([])
  const [entryFileList, setEntryFileList] = useState<UploadFile[]>([])
  const [entryRemarks, setEntryRemarks] = useState<string>('')

  // ============ 点检标准管理 Drawer ============
  const [stdOpen, setStdOpen] = useState(false)
  const [stdDeviceId, setStdDeviceId] = useState<number | undefined>(undefined)
  const [stdLoading, setStdLoading] = useState(false)
  const [stdSaving, setStdSaving] = useState(false)
  const [stdItems, setStdItems] = useState<StandardItemRow[]>([])

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
      if (planDate) params.plan_date = planDate.format('YYYY-MM-DD')
      if (deviceName) params.device_name = deviceName
      if (statusFilter && statusFilter.length > 0) params.status = statusFilter.join(',')
      if (inspectorName) params.inspector_id = inspectorName
      if (dateRange && dateRange[0]) params.start_date = dateRange[0].format('YYYY-MM-DD')
      if (dateRange && dateRange[1]) params.end_date = dateRange[1].format('YYYY-MM-DD')

      const res = await api.get('/basic/device-inspection-plans', { params })
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
  }, [pagination.current, pagination.pageSize, planDate, deviceName, statusFilter, inspectorName, dateRange])

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
    const todayStr = dayjs().format('YYYY-MM-DD')
    const todayList = data.filter(d => (d.plan_date || '') === todayStr)
    const pending = data.filter(d => d.status === '待检').length
    const completed = data.filter(d => d.status === '已完成').length
    const missed = data.filter(d => d.status === '漏检').length
    const abnormal = data.reduce((s, d) => s + (Number(d.abnormal_count) || 0), 0)
    return [
      { label: '今日待检', value: todayList.filter(d => d.status === '待检').length, icon: <ClockCircleOutlined />, color: '#FF9800' },
      { label: '已完成', value: completed, icon: <CheckCircleOutlined />, color: '#4CAF50' },
      { label: '漏检', value: missed, icon: <WarningOutlined />, color: '#F44336' },
      { label: '异常项数', value: abnormal, icon: <WarningOutlined />, color: '#9C27B0' },
      { label: '总计划数', value: pagination.total, icon: <FileSearchOutlined />, color: '#2196F3' },
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
    setPlanDate(null)
    setDeviceName(undefined)
    setStatusFilter(['待检', '已完成', '漏检'])
    setInspectorName(undefined)
    setMonthQuick('this_month')
    setDateRange(getThisMonth())
    setPagination(p => ({ ...p, current: 1 }))
  }

  // ============ 生成点检计划 ============
  const handleGenerate = async () => {
    Modal.confirm({
      title: '生成点检计划',
      content: '将根据已启用的点检标准生成当日点检计划，已存在的当日计划将跳过。是否继续？',
      okText: '生成',
      cancelText: '取消',
      onOk: async () => {
        try {
          const payload: any = {}
          if (planDate) payload.plan_date = planDate.format('YYYY-MM-DD')
          const res = await api.post('/basic/device-inspection-plans/generate', payload)
          if (res.success !== false) {
            message.success(res.message || `生成完成，新增 ${res.data?.created ?? 0} 条`)
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
      const res = await api.get(`/basic/device-inspection-plans/${record.plan_id}`)
      if (res.success !== false && res.data) {
        setCurrentDetail(res.data)
        const imgs = res.data.inspection_images || []
        setDetailImages(Array.isArray(imgs) ? imgs : [])
      }
    } catch (e: any) {
      message.error(e?.message || '加载详情失败')
    } finally {
      setDetailLoading(false)
    }
  }

  // ============ 点检录入 ============
  const openEntry = async (record: any) => {
    setEntryPlan(record)
    setEntryItems([])
    setEntryFileList([])
    setEntryRemarks(record.remarks || '')
    setEntryOpen(true)
    setEntryLoading(true)
    try {
      // 先取详情，看是否已有录入记录
      const detailRes = await api.get(`/basic/device-inspection-plans/${record.plan_id}`)
      const detail = detailRes.success !== false ? detailRes.data : null
      const deviceId = detail?.device_id || record.device_id
      // 已有记录优先用作录入项（再次提交场景）
      const existingRecords: any[] = detail?.records || []
      let items: InspectionEntryItem[]
      if (existingRecords.length > 0) {
        items = existingRecords.map((it: any, idx: number) => ({
          key: uid(),
          standard_id: it.standard_id,
          item_name: it.item_name || '',
          standard_value: it.standard_value || '',
          judge_type: it.judge_type || '定性',
          unit: it.unit || '',
          sort_order: it.sort_order !== undefined ? it.sort_order : idx,
          actual_value: it.actual_value || '',
          result: (it.result === '正常' || it.result === '异常') ? it.result : null,
          abnormal_desc: it.abnormal_desc || '',
        }))
      } else {
        // 否则加载该设备的点检标准作为录入项
        const stdRes = await api.get('/basic/device-inspection-standards', { params: { device_id: deviceId, status: 1 } })
        const stdList: any[] = stdRes.success !== false ? (stdRes.data?.list || stdRes.data || []) : []
        items = stdList.map((s: any, idx: number) => ({
          key: uid(),
          standard_id: s.standard_id,
          item_name: s.item_name || '',
          standard_value: s.standard_value || '',
          judge_type: s.judge_type || '定性',
          unit: s.unit || '',
          sort_order: s.sort_order !== undefined ? s.sort_order : idx,
          actual_value: '',
          result: null,
          abnormal_desc: '',
        }))
      }
      setEntryItems(items)
      if (detail) setEntryPlan(detail)
    } catch (e: any) {
      message.error(e?.message || '加载点检项目失败')
    } finally {
      setEntryLoading(false)
    }
  }

  const updateEntryItem = (key: string, patch: Partial<InspectionEntryItem>) => {
    setEntryItems(prev => prev.map(it => it.key === key ? { ...it, ...patch } : it))
  }

  // 录入项值变化时自动判定（定量型）
  const handleActualValueChange = (item: InspectionEntryItem, value: string) => {
    const patch: Partial<InspectionEntryItem> = { actual_value: value }
    if (item.judge_type === '定量') {
      const num = Number(value)
      const judged = judgeQuantitative(item.standard_value, Number.isNaN(num) ? null : num)
      if (judged) patch.result = judged
      if (judged === '正常') patch.abnormal_desc = ''
    }
    updateEntryItem(item.key, patch)
  }

  // 提交点检
  const handleSubmitEntry = async () => {
    if (!entryPlan) return
    const invalid = entryItems.find(it => !it.result)
    if (invalid) {
      message.warning(`请完成所有项目的判定：${invalid.item_name}`)
      return
    }
    setEntryLoading(true)
    try {
      const payload: any = {
        items: entryItems.map((it, idx) => ({
          standard_id: it.standard_id || null,
          item_name: it.item_name,
          standard_value: it.standard_value || '',
          actual_value: it.actual_value || '',
          judge_type: it.judge_type || '定性',
          unit: it.unit || '',
          result: it.result,
          abnormal_desc: it.result === '异常' ? (it.abnormal_desc || '') : '',
          sort_order: it.sort_order !== undefined ? it.sort_order : idx,
        })),
        remarks: entryRemarks,
      }
      const res = await api.put(`/basic/device-inspection-plans/${entryPlan.plan_id}/submit`, payload)
      if (res.success !== false) {
        // 提交成功后上传图片
        const validFiles = entryFileList.filter(f => f.originFileObj)
        if (validFiles.length > 0) {
          try {
            const formData = new FormData()
            validFiles.forEach(f => formData.append('images', f.originFileObj as File))
            await api.post(`/basic/device-inspection-plans/${entryPlan.plan_id}/images`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            })
          } catch (e: any) {
            message.warning(e?.message || '图片上传失败，但点检已提交')
          }
        }
        message.success(res.message || '提交成功')
        setEntryOpen(false)
        setEntryFileList([])
        fetchData()
      } else {
        message.error(res.message || '提交失败')
      }
    } catch (e: any) {
      message.error(e?.message || '提交失败')
    } finally {
      setEntryLoading(false)
    }
  }

  // ============ 点检标准管理 ============
  const openStandardDrawer = () => {
    setStdDeviceId(undefined)
    setStdItems([])
    setStdOpen(true)
  }

  const loadStandards = useCallback(async (deviceId: number) => {
    setStdLoading(true)
    try {
      const res = await api.get('/basic/device-inspection-standards', { params: { device_id: deviceId } })
      if (res.success !== false) {
        const list: any[] = res.data?.list || res.data || []
        setStdItems(list.map((s: any) => ({
          key: uid(),
          standard_id: s.standard_id,
          item_name: s.item_name || '',
          standard_value: s.standard_value || '',
          judge_type: s.judge_type || '定性',
          unit: s.unit || '',
          sort_order: s.sort_order || 0,
          status: s.status !== undefined ? Number(s.status) : 1,
        })))
      } else {
        setStdItems([])
      }
    } catch (e: any) {
      message.error(e?.message || '加载点检标准失败')
      setStdItems([])
    } finally {
      setStdLoading(false)
    }
  }, [])

  const handleStdDeviceChange = (val: number | undefined) => {
    setStdDeviceId(val)
    if (val) loadStandards(val)
    else setStdItems([])
  }

  const addStdItem = () => {
    setStdItems(prev => [...prev, {
      key: uid(),
      item_name: '',
      standard_value: '',
      judge_type: '定性',
      unit: '',
      sort_order: prev.length,
      status: 1,
    }])
  }
  const removeStdItem = async (row: StandardItemRow) => {
    // 已存在的标准调用 delete 接口
    if (row.standard_id) {
      try {
        const res = await api.delete(`/basic/device-inspection-standards/${row.standard_id}`)
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
  const updateStdItem = (key: string, patch: Partial<StandardItemRow>) => {
    setStdItems(prev => prev.map(it => it.key === key ? { ...it, ...patch } : it))
  }
  const saveStdItem = async (row: StandardItemRow) => {
    if (!stdDeviceId) {
      message.warning('请先选择设备')
      return
    }
    if (!row.item_name) {
      message.warning('请填写点检项目名称')
      return
    }
    setStdSaving(true)
    try {
      const device = devices.find((d: any) => (d.device_id ?? d.id) === stdDeviceId)
      const payload: any = {
        device_id: stdDeviceId,
        device_code: device?.device_code,
        device_name: device?.device_name,
        item_name: row.item_name,
        standard_value: row.standard_value || '',
        judge_type: row.judge_type || '定性',
        unit: row.unit || '',
        sort_order: row.sort_order || 0,
        status: row.status,
      }
      let res: any
      if (row.standard_id) {
        res = await api.put(`/basic/device-inspection-standards/${row.standard_id}`, payload)
      } else {
        res = await api.post('/basic/device-inspection-standards', payload)
        if (res.success !== false && res.data?.standard_id) {
          updateStdItem(row.key, { standard_id: res.data.standard_id })
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
  const toggleStdStatus = async (row: StandardItemRow) => {
    const next = row.status === 1 ? 0 : 1
    if (row.standard_id) {
      try {
        const res = await api.put(`/basic/device-inspection-standards/${row.standard_id}`, { status: next })
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

  // ============ 图片上传辅助 ============
  const uploadButton = (
    <div>
      <UploadOutlined />
      <div style={{ marginTop: 4 }}>上传图片</div>
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
              alt={img.file_name || '点检图片'}
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
    { title: '点检日期', dataIndex: 'plan_date', key: 'plan_date', width: 120, fixed: 'left' as const },
    { title: '设备编号', dataIndex: 'device_code', key: 'device_code', width: 120 },
    { title: '设备名称', dataIndex: 'device_name', key: 'device_name', width: 150, ellipsis: true },
    { title: '点检人', dataIndex: 'inspector_name', key: 'inspector_name', width: 100 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (v: string) => <Tag color={statusColor[v] || 'default'}>{v || '-'}</Tag>,
    },
    {
      title: '异常项数', dataIndex: 'abnormal_count', key: 'abnormal_count', width: 90,
      render: (v: number, record: any) => {
        const n = Number(v) || 0
        if (record.status !== '已完成') return <Text type="secondary">-</Text>
        return n > 0 ? <Tag color="error">{n}</Tag> : <Tag color="success">0</Tag>
      },
    },
    {
      title: '点检时间', dataIndex: 'inspection_time', key: 'inspection_time', width: 160,
      render: (v: any) => v ? formatDateTime(v) : <Text type="secondary">-</Text>,
    },
    { title: '备注', dataIndex: 'remarks', key: 'remarks', width: 180, ellipsis: true },
    {
      title: '操作', key: 'action', fixed: 'right' as const, width: 200,
      render: (_: any, record: any) => {
        const status = record.status
        return (
          <Space size="small" wrap>
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => showDetail(record)}>查看</Button>
            {status === '待检' && (
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEntry(record)}>点检录入</Button>
            )}
            {status === '已完成' && (
              <Button type="link" size="small" onClick={() => openEntry(record)}>重新录入</Button>
            )}
          </Space>
        )
      },
    },
  ]

  // ============ 筛选区 ============
  const filterNode = (
    <Space wrap style={{ width: '100%' }} size={[8, 8]} align="center">
      <DatePicker
        placeholder="点检日期"
        allowClear
        style={{ width: 140 }}
        value={planDate}
        onChange={(v) => setPlanDate(v as Dayjs | null)}
      />
      <Input
        placeholder="设备名称"
        allowClear
        prefix={<SearchOutlined />}
        style={{ width: 150 }}
        value={deviceName}
        onChange={(e) => setDeviceName(e.target.value || undefined)}
        onPressEnter={() => { setPagination(p => ({ ...p, current: 1 })); fetchData() }}
      />
      <Input
        placeholder="点检人"
        allowClear
        style={{ width: 130 }}
        value={inspectorName}
        onChange={(e) => setInspectorName(e.target.value || undefined)}
        onPressEnter={() => { setPagination(p => ({ ...p, current: 1 })); fetchData() }}
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
      <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleGenerate}>生成点检计划</Button>
      <Button icon={<SettingOutlined />} onClick={openStandardDrawer}>点检标准</Button>
      <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
    </Space>
  )

  // ============ 录入项列 ============
  const entryColumns = [
    {
      title: '项目名称', dataIndex: 'item_name', key: 'item_name', width: 160,
      render: (v: string) => <Text strong>{v || '-'}</Text>,
    },
    {
      title: '标准值', dataIndex: 'standard_value', key: 'standard_value', width: 140,
      render: (v: string, r: InspectionEntryItem) => v ? `${v}${r.unit ? ' ' + r.unit : ''}` : <Text type="secondary">-</Text>,
    },
    {
      title: '判定方式', dataIndex: 'judge_type', key: 'judge_type', width: 90,
      render: (v: string) => <Tag color={v === '定量' ? 'blue' : 'default'}>{v || '定性'}</Tag>,
    },
    {
      title: '实测值/结果', key: 'actual', width: 220,
      render: (_: any, r: InspectionEntryItem) => {
        if (r.judge_type === '定量') {
          return (
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Space>
                <InputNumber
                  placeholder="输入数值"
                  style={{ width: 140 }}
                  value={r.actual_value === '' ? undefined : Number(r.actual_value) || undefined}
                  onChange={(v) => handleActualValueChange(r, v === null ? '' : String(v))}
                />
                {r.unit && <Text type="secondary">{r.unit}</Text>}
              </Space>
              {r.result && <Tag color={r.result === '正常' ? 'success' : 'error'}>自动判定：{r.result}</Tag>}
            </Space>
          )
        }
        return (
          <Radio.Group
            value={r.result || undefined}
            onChange={(e) => {
              const val = e.target.value as '正常' | '异常'
              updateEntryItem(r.key, { result: val, actual_value: val, abnormal_desc: val === '正常' ? '' : (r.abnormal_desc || '') })
            }}
          >
            <Radio value="正常">正常</Radio>
            <Radio value="异常">异常</Radio>
          </Radio.Group>
        )
      },
    },
    {
      title: '异常描述', key: 'abnormal_desc', width: 200,
      render: (_: any, r: InspectionEntryItem) => (
        r.result === '异常' ? (
          <Input.TextArea
            rows={1}
            placeholder="请描述异常情况"
            value={r.abnormal_desc || ''}
            onChange={(e) => updateEntryItem(r.key, { abnormal_desc: e.target.value })}
          />
        ) : <Text type="secondary">-</Text>
      ),
    },
  ]

  // ============ 标准管理列 ============
  const stdColumns = [
    {
      title: '项目名称', key: 'item_name', width: 180,
      render: (_: any, r: StandardItemRow) => (
        <Input
          placeholder="点检项目名称"
          value={r.item_name}
          onChange={(e) => updateStdItem(r.key, { item_name: e.target.value })}
        />
      ),
    },
    {
      title: '标准值', key: 'standard_value', width: 160,
      render: (_: any, r: StandardItemRow) => (
        <Input
          placeholder="如 ≤60℃ / 60-80 / 正常"
          value={r.standard_value}
          onChange={(e) => updateStdItem(r.key, { standard_value: e.target.value })}
        />
      ),
    },
    {
      title: '判定方式', key: 'judge_type', width: 110,
      render: (_: any, r: StandardItemRow) => (
        <Select
          style={{ width: '100%' }}
          value={r.judge_type}
          options={JUDGE_TYPE_OPTIONS}
          onChange={(v) => updateStdItem(r.key, { judge_type: v })}
        />
      ),
    },
    {
      title: '单位', key: 'unit', width: 90,
      render: (_: any, r: StandardItemRow) => (
        <Input
          placeholder="如 ℃"
          value={r.unit}
          onChange={(e) => updateStdItem(r.key, { unit: e.target.value })}
        />
      ),
    },
    {
      title: '排序', key: 'sort_order', width: 80,
      render: (_: any, r: StandardItemRow) => (
        <InputNumber
          min={0}
          style={{ width: '100%' }}
          value={r.sort_order}
          onChange={(v) => updateStdItem(r.key, { sort_order: Number(v) || 0 })}
        />
      ),
    },
    {
      title: '状态', key: 'status', width: 90,
      render: (_: any, r: StandardItemRow) => (
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
      title: '操作', key: 'action', width: 160, fixed: 'right' as const,
      render: (_: any, r: StandardItemRow) => (
        <Space size="small">
          <Button type="link" size="small" loading={stdSaving} onClick={() => saveStdItem(r)}>
            {r.standard_id ? '保存' : '创建'}
          </Button>
          <Popconfirm
            title="确认删除该点检项目？"
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
        title="设备点检"
        breadcrumbs="设备管理 / 设备点检"
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
              tableKey="pages_device_DeviceInspection"
              columns={columns}
              dataSource={data}
              rowKey="plan_id"
              size="small"
              loading={loading}
              scroll={{ x: 1300 }}
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

      {/* ============ 点检详情 Drawer ============ */}
      <Drawer
        title="点检详情"
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
                <Descriptions.Item label="点检日期">{currentDetail.plan_date || '-'}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={statusColor[currentDetail.status] || 'default'}>{currentDetail.status || '-'}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="设备编号">{currentDetail.device_code || '-'}</Descriptions.Item>
                <Descriptions.Item label="设备名称">{currentDetail.device_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="点检人">{currentDetail.inspector_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="点检时间">{formatDateTime(currentDetail.inspection_time)}</Descriptions.Item>
                <Descriptions.Item label="总结果">
                  {currentDetail.result ? <Tag color={currentDetail.result === '正常' ? 'success' : 'error'}>{currentDetail.result}</Tag> : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="异常项数">{Number(currentDetail.abnormal_count) || 0}</Descriptions.Item>
                <Descriptions.Item label="备注" span={2}>{currentDetail.remarks || '-'}</Descriptions.Item>
              </Descriptions>

              <Title level={5} style={{ marginTop: 16 }}>点检结果</Title>
              <Table
                size="small"
                rowKey={(r: any) => r.record_id ?? r.key ?? r.item_name}
                dataSource={currentDetail.records || []}
                columns={[
                  { title: '项目名称', dataIndex: 'item_name', key: 'item_name', width: 160 },
                  {
                    title: '标准值', dataIndex: 'standard_value', key: 'standard_value', width: 140,
                    render: (v: string, r: any) => v ? `${v}${r.unit ? ' ' + r.unit : ''}` : '-',
                  },
                  { title: '实测值', dataIndex: 'actual_value', key: 'actual_value', width: 120 },
                  {
                    title: '判定', dataIndex: 'result', key: 'result', width: 90,
                    render: (v: string) => v ? <Tag color={v === '正常' ? 'success' : 'error'}>{v}</Tag> : '-',
                  },
                  { title: '异常描述', dataIndex: 'abnormal_desc', key: 'abnormal_desc' },
                ]}
                pagination={false}
                locale={{ emptyText: '暂无点检记录' }}
              />

              <Title level={5} style={{ marginTop: 16 }}>点检图片</Title>
              {renderImageGroup(detailImages, '暂无点检图片')}
            </div>
          )}
        </Spin>
      </Drawer>

      {/* ============ 点检录入 Drawer ============ */}
      <Drawer
        title="点检录入"
        open={entryOpen}
        onClose={() => setEntryOpen(false)}
        width={1100}
        destroyOnHidden
        footer={
          <Space>
            <Button onClick={() => setEntryOpen(false)}>取消</Button>
            <Button type="primary" loading={entryLoading} onClick={handleSubmitEntry}>提交点检</Button>
          </Space>
        }
      >
        <Spin spinning={entryLoading}>
          {entryPlan && (
            <div style={{ height: 'calc(100vh - 180px)', overflow: 'auto', paddingRight: 8 }}>
              <Descriptions column={2} size="small" bordered style={{ marginBottom: 12 }}>
                <Descriptions.Item label="点检日期">{entryPlan.plan_date || '-'}</Descriptions.Item>
                <Descriptions.Item label="设备名称">{entryPlan.device_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="设备编号">{entryPlan.device_code || '-'}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={statusColor[entryPlan.status] || 'default'}>{entryPlan.status || '-'}</Tag>
                </Descriptions.Item>
              </Descriptions>

              <Title level={5}>点检项目</Title>
              {entryItems.length === 0 ? (
                <Alert
                  type="warning"
                  showIcon
                  message="未找到该设备的点检标准，请先在「点检标准」中维护该设备的点检项目"
                />
              ) : (
                <Table
                  size="small"
                  rowKey="key"
                  dataSource={entryItems}
                  columns={entryColumns}
                  pagination={false}
                  scroll={{ y: 360 }}
                />
              )}

              <Title level={5} style={{ marginTop: 16 }}>点检图片</Title>
              <Upload
                listType="picture-card"
                fileList={entryFileList}
                multiple
                accept="image/*"
                beforeUpload={() => false}
                onChange={({ fileList: fl }) => setEntryFileList(fl)}
              >
                {entryFileList.length >= 9 ? null : uploadButton}
              </Upload>
              <div style={{ color: '#999', fontSize: 12 }}>支持多图上传，最多 9 张，提交后自动上传至服务器</div>

              <Title level={5} style={{ marginTop: 16 }}>备注</Title>
              <Input.TextArea
                rows={3}
                placeholder="可填写点检备注"
                value={entryRemarks}
                onChange={(e) => setEntryRemarks(e.target.value)}
              />
            </div>
          )}
        </Spin>
      </Drawer>

      {/* ============ 点检标准管理 Drawer ============ */}
      <Drawer
        title="点检标准管理"
        open={stdOpen}
        onClose={() => setStdOpen(false)}
        width={1100}
        destroyOnHidden
        footer={
          <Space>
            <Button onClick={() => setStdOpen(false)}>关闭</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={addStdItem} disabled={!stdDeviceId}>
              添加项目
            </Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 12 }}>
          <Text strong style={{ marginRight: 8 }}>选择设备：</Text>
          <Select
            showSearch
            placeholder="请选择设备以管理其点检标准"
            style={{ width: 360 }}
            value={stdDeviceId}
            onChange={handleStdDeviceChange}
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
            options={deviceOptions}
          />
        </div>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="点检标准用于生成点检计划，每个启用的设备标准都会在该设备生成当日点检计划时使用。"
        />
        <Spin spinning={stdLoading}>
          <Table
            size="small"
            rowKey="key"
            dataSource={stdItems}
            columns={stdColumns}
            pagination={false}
            scroll={{ x: 980 }}
            locale={{ emptyText: stdDeviceId ? '该设备暂无点检标准，点击「添加项目」新建' : '请先选择设备' }}
          />
        </Spin>
      </Drawer>
    </>
  )
}
