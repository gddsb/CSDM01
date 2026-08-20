import ResizableTable from '../../components/ResizableTable'
import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { Table, Tag, Button, Drawer, Descriptions, Typography, Select, DatePicker, Space, Row, Col, Input, Form, Modal, Alert, message, Popconfirm } from 'antd'
import {
  EnvironmentOutlined, CheckCircleOutlined, CloseCircleOutlined,
  PlusOutlined, SearchOutlined, ReloadOutlined, SettingOutlined, EditOutlined, DeleteOutlined
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import type { StatItem } from '../../components/ThreeSectionPage'
import { MONTH_QUICK_OPTIONS, getMonthRange, validateRange, getThisMonth } from '../../utils/monthQuick'
import dayjs from 'dayjs'
import api from '../../utils/api'

const { RangePicker } = DatePicker
const { Title, Text } = Typography

const resultColor: Record<string, string> = { '合格': 'success', '不合格': 'error' }
const triggerColor: Record<string, string> = { '自动': 'blue', '手工': 'purple' }
const statusColor: Record<string, string> = { '待检': 'default', '检验中': 'processing', '已完成': 'success', '已关闭': 'default', '不合格': 'error' }

const STATUS_MAP: Record<number, string> = { 0: '待检', 1: '检验中', 2: '已完成', 3: '已关闭' }
const STATUS_REVERSE: Record<string, number> = { '待检': 0, '检验中': 1, '已完成': 2, '已关闭': 3 }

const RESULT_OPTIONS = [
  { label: '合格', value: '合格' },
  { label: '不合格', value: '不合格' },
]

const TRIGGER_OPTIONS = [
  { label: '手工', value: '手工' },
  { label: '自动', value: '自动' },
]

type DrawerMode = 'create' | 'edit' | null
type ManagerDrawer = 'area' | 'template' | null

export default function EnvironmentInspection() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any[]>([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 30, total: 0 })

  const [inspectionNo, setInspectionNo] = useState<any>(undefined)
  const [areaFilter, setAreaFilter] = useState<any>(undefined)
  const [resultFilter, setResultFilter] = useState<any>(undefined)
  const [statusFilter, setStatusFilter] = useState<any>(undefined)
  const [dateRange, setDateRange] = useState<any>(getThisMonth())
  const [monthQuick, setMonthQuick] = useState<string>('this_month')
  const [rangeWarn, setRangeWarn] = useState(false)

  // 区域与模板数据源
  const [areas, setAreas] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])

  // 详情
  const [detailOpen, setDetailOpen] = useState(false)
  const [current, setCurrent] = useState<any>(null)
  const [currentItems, setCurrentItems] = useState<any[]>([])

  // 新建/编辑
  const [formVisible, setFormVisible] = useState(false)
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [formRecord, setFormRecord] = useState<any>(null)
  const [formItems, setFormItems] = useState<any[]>([])
  const [selectedAreaId, setSelectedAreaId] = useState<any>(undefined)
  const [form] = Form.useForm()

  // 不合格处理
  const [handleOpen, setHandleOpen] = useState(false)
  const [handleRecord, setHandleRecord] = useState<any>(null)
  const [correctAction, setCorrectAction] = useState('')
  const [recheckDate, setRecheckDate] = useState<any>(null)
  const [recheckResult, setRecheckResult] = useState<string | undefined>(undefined)

  // 管理 Drawer（区域/模板）
  const [managerOpen, setManagerOpen] = useState(false)
  const [managerType, setManagerType] = useState<ManagerDrawer>(null)
  const [managerEditRecord, setManagerEditRecord] = useState<any>(null)
  const [managerForm] = Form.useForm()

  // 加载区域
  const loadAreas = useCallback(async () => {
    try {
      const res = await api.get('/basic/env-areas')
      const list = res.data || []
      setAreas(Array.isArray(list) ? list : [])
    } catch (e) {
      // ignore
    }
  }, [])

  // 加载模板
  const loadTemplates = useCallback(async () => {
    try {
      const res = await api.get('/basic/env-templates', { params: { page: 1, page_size: 500 } })
      const list = res.data?.list || res.data || []
      setTemplates(Array.isArray(list) ? list : [])
    } catch (e) {
      // ignore
    }
  }, [])

  useEffect(() => {
    loadAreas()
    loadTemplates()
  }, [loadAreas, loadTemplates])

  const fetchData = useCallback(async () => {
    setLoading(true)
    if (dateRange) {
      const check = validateRange(dateRange)
      if (!check.ok) {
        message.warning(check.msg)
        setLoading(false)
        return
      }
      setRangeWarn(check.warn || false)
    } else {
      setRangeWarn(false)
    }
    try {
      const params: any = { page: pagination.current, page_size: pagination.pageSize }
      if (inspectionNo) params.inspection_no = inspectionNo
      if (areaFilter) params.area_id = areaFilter
      if (resultFilter) params.result = resultFilter
      if (statusFilter) params.status = statusFilter
      if (dateRange && dateRange[0]) params.start_date = dateRange[0].format('YYYY-MM-DD')
      if (dateRange && dateRange[1]) params.end_date = dateRange[1].format('YYYY-MM-DD')

      const res = await api.get('/basic/env-inspections', { params })
      if (res.success !== false) {
        const list = res.data?.list || res.data || []
        setData(Array.isArray(list) ? list : [])
        setPagination(p => ({ ...p, total: res.data?.total || 0 }))
      } else {
        setData([])
        setPagination(p => ({ ...p, total: 0 }))
      }
    } catch (e: any) {
      message.error(e?.message || '查询失败')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [pagination.current, pagination.pageSize, inspectionNo, areaFilter, resultFilter, statusFilter, dateRange])

  useEffect(() => { fetchData() }, [fetchData])

  const passCount = data.filter(i => i.result === '合格').length
  const failCount = data.filter(i => i.result === '不合格').length
  const passRate = data.length > 0 ? Math.round((passCount / data.length) * 100) : 0

  const stats: StatItem[] = [
    { label: '总检验数', value: data.length, icon: <EnvironmentOutlined />, color: '#2196F3' },
    { label: '合格', value: passCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
    { label: '不合格', value: failCount, icon: <CloseCircleOutlined />, color: '#F44336' },
    { label: '合格率', value: `${passRate}%`, icon: <CheckCircleOutlined />, color: '#00BCD4' },
  ]

  const areaOptions = useMemo(() => {
    return areas.map(a => ({ label: a.area_name, value: a.area_id }))
  }, [areas])

  const handleMonthQuick = (v: string) => {
    setMonthQuick(v)
    const range = getMonthRange(v)
    setDateRange(range)
  }
  const handleRangeChange = (v: any) => {
    setMonthQuick(undefined)
    setDateRange(v)
  }

  const handleReset = () => {
    setInspectionNo(undefined)
    setAreaFilter(undefined)
    setResultFilter(undefined)
    setStatusFilter(undefined)
    setMonthQuick('this_month')
    setDateRange(getThisMonth())
  }

  // ============ 详情 ============
  const showDetail = async (record: any) => {
    try {
      const res = await api.get(`/basic/env-inspections/${record.inspection_id}`)
      const detail = res.data || record
      setCurrent(detail)
      setCurrentItems(detail.items || [])
    } catch (e) {
      setCurrent(record)
      setCurrentItems(record.items || [])
    }
    setDetailOpen(true)
  }

  // ============ 新建/编辑 ============
  const loadTemplatesOfArea = async (areaId: number) => {
    try {
      const res = await api.get(`/basic/env-templates/area/${areaId}`)
      const list = res.data || []
      const arr: any[] = Array.isArray(list) ? list : []
      return arr.map((t: any) => ({
        template_id: t.template_id,
        item_name: t.item_name,
        standard_value: t.standard_value || '',
        unit: t.unit || '',
        test_method: t.test_method || '',
        actual_value: '',
        judge: '',
      }))
    } catch (e) {
      return []
    }
  }

  const handleCreate = () => {
    setDrawerMode('create')
    setFormRecord(null)
    setFormItems([])
    setSelectedAreaId(undefined)
    form.resetFields()
    setFormVisible(true)
  }

  const handleEdit = async (record: any) => {
    try {
      const res = await api.get(`/basic/env-inspections/${record.inspection_id}`)
      const detail = res.data || record
      setFormRecord(detail)
      setDrawerMode('edit')
      setSelectedAreaId(detail.area_id)
      setFormItems((detail.items || []).map((it: any) => ({
        ...it,
        actual_value: it.actual_value || '',
        judge: it.judge || '',
      })))
      form.setFieldsValue({
        area_id: detail.area_id,
        trigger_type: detail.trigger_type || '手工',
        inspection_date: detail.inspection_date ? dayjs(detail.inspection_date) : null,
        inspector_name: detail.inspector_name || '',
        remarks: detail.remarks || '',
      })
      setFormVisible(true)
    } catch (e: any) {
      message.error(e?.message || '加载详情失败')
    }
  }

  const handleAreaChange = async (areaId: number) => {
    setSelectedAreaId(areaId)
    if (drawerMode === 'create') {
      const items = await loadTemplatesOfArea(areaId)
      setFormItems(items)
    }
  }

  // 自动判定
  const autoJudge = (standard: string, actual: string): '合格' | '不合格' | '' => {
    if (!actual) return ''
    if (standard.includes('≤')) {
      const num = parseFloat(standard.replace(/[^0-9.]/g, ''))
      if (isNaN(num)) return ''
      const av = parseFloat(actual.replace(/[^0-9.]/g, ''))
      if (isNaN(av)) return ''
      return av <= num ? '合格' : '不合格'
    }
    if (standard.includes('-')) {
      const range = standard.match(/([\d.]+)-([\d.]+)/)
      if (!range) return ''
      const min = parseFloat(range[1])
      const max = parseFloat(range[2])
      const av = parseFloat(actual.replace(/[^0-9.]/g, ''))
      if (isNaN(av)) return ''
      return av >= min && av <= max ? '合格' : '不合格'
    }
    if (standard.includes('≥')) {
      const num = parseFloat(standard.replace(/[^0-9.]/g, ''))
      if (isNaN(num)) return ''
      const av = parseFloat(actual.replace(/[^0-9.]/g, ''))
      if (isNaN(av)) return ''
      return av >= num ? '合格' : '不合格'
    }
    return ''
  }

  const updateItemValue = (idx: number, key: string, value: any) => {
    setFormItems(prev => {
      const next = [...prev]
      const item = { ...next[idx], [key]: value }
      if (key === 'actual_value') {
        const judge = autoJudge(item.standard_value || '', value)
        item.judge = judge
      }
      next[idx] = item
      return next
    })
  }

  const handleFormSave = async () => {
    try {
      const values = await form.validateFields()
      // 汇总总结果
      const judges = formItems.map(it => it.judge).filter(Boolean)
      const allJudged = formItems.length > 0 && judges.length === formItems.filter(it => it.judge).length
      const hasFail = judges.some(j => j === '不合格')
      const result = allJudged ? (hasFail ? '不合格' : '合格') : ''

      const area = areas.find(a => String(a.area_id) === String(values.area_id))
      const payload: any = {
        area_id: values.area_id,
        area_name: area?.area_name || '',
        trigger_type: values.trigger_type || '手工',
        inspector_name: values.inspector_name || '',
        inspection_date: values.inspection_date ? values.inspection_date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        remarks: values.remarks || '',
        result,
        items: formItems.map(it => ({
          template_id: it.template_id || null,
          item_name: it.item_name,
          standard_value: it.standard_value || '',
          actual_value: it.actual_value || '',
          unit: it.unit || '',
          judge: it.judge || '',
          remark: it.remark || '',
        })),
      }

      setFormLoading(true)
      if (drawerMode === 'create') {
        const res = await api.post('/basic/env-inspections', payload)
        if (res.success !== false) {
          message.success('创建成功')
          setFormVisible(false)
          fetchData()
        } else {
          message.error(res.message || '创建失败')
        }
      } else if (drawerMode === 'edit' && formRecord) {
        const res = await api.put(`/basic/env-inspections/${formRecord.inspection_id}`, payload)
        if (res.success !== false) {
          message.success('保存成功')
          setFormVisible(false)
          fetchData()
        } else {
          message.error(res.message || '保存失败')
        }
      }
    } catch (e: any) {
      if (e?.message?.includes('validate')) return
      message.error(e?.message || '保存失败，请重试')
    } finally {
      setFormLoading(false)
    }
  }

  // ============ 状态流转 ============
  const handleStart = async (record: any) => {
    try {
      const res = await api.put(`/basic/env-inspections/${record.inspection_id}`, { status: STATUS_REVERSE['检验中'] })
      if (res.success !== false) {
        message.success('已开始检验')
        fetchData()
      } else {
        message.error(res.message || '操作失败')
      }
    } catch (e: any) {
      message.error(e?.message || '操作失败')
    }
  }

  // 提交结果：将 items 与 result 回写，并置为已完成
  const handleSubmitResult = async (record: any) => {
    try {
      const detailRes = await api.get(`/basic/env-inspections/${record.inspection_id}`)
      const detail = detailRes.data || record
      const items = detail.items || record.items || []
      const judges = items.map((it: any) => it.judge).filter(Boolean)
      const allJudged = items.length > 0 && judges.length === items.filter((it: any) => it.judge).length
      const hasFail = judges.some((j: string) => j === '不合格')
      const result = allJudged ? (hasFail ? '不合格' : '合格') : ''
      const finalStatus = allJudged ? STATUS_REVERSE['已完成'] : STATUS_REVERSE['检验中']
      const res = await api.put(`/basic/env-inspections/${record.inspection_id}`, {
        result,
        status: finalStatus,
        items,
      })
      if (res.success !== false) {
        message.success('已提交结果')
        fetchData()
      } else {
        message.error(res.message || '操作失败')
      }
    } catch (e: any) {
      message.error(e?.message || '操作失败')
    }
  }

  // 关闭
  const handleClose = async (record: any) => {
    try {
      const res = await api.put(`/basic/env-inspections/${record.inspection_id}`, { status: STATUS_REVERSE['已关闭'] })
      if (res.success !== false) {
        message.success('已关闭')
        fetchData()
      } else {
        message.error(res.message || '操作失败')
      }
    } catch (e: any) {
      message.error(e?.message || '操作失败')
    }
  }

  // 打开不合格处理
  const openHandle = (record: any) => {
    setHandleRecord(record)
    setCorrectAction(record.correction_action || '')
    setRecheckDate(record.recheck_date ? dayjs(record.recheck_date) : null)
    setRecheckResult(record.recheck_result || undefined)
    setHandleOpen(true)
  }

  const handleHandleConfirm = async () => {
    if (!handleRecord) return
    try {
      const payload: any = {
        correction_action: correctAction,
        recheck_date: recheckDate ? recheckDate.format('YYYY-MM-DD') : '',
        recheck_result: recheckResult || '',
      }
      // 若复查结果已合格，状态转为已完成
      if (recheckResult === '合格') {
        payload.result = '合格'
        payload.status = STATUS_REVERSE['已完成']
      }
      const res = await api.put(`/basic/env-inspections/${handleRecord.inspection_id}`, payload)
      if (res.success !== false) {
        message.success('处理成功')
        setHandleOpen(false)
        fetchData()
      } else {
        message.error(res.message || '处理失败')
      }
    } catch (e: any) {
      message.error(e?.message || '处理失败')
    }
  }

  // ============ 区域/模板管理 ============
  const openManager = (type: ManagerDrawer, record?: any) => {
    setManagerType(type)
    setManagerEditRecord(record || null)
    managerForm.resetFields()
    if (type === 'area') {
      managerForm.setFieldsValue({
        area_code: record?.area_code || '',
        area_name: record?.area_name || '',
        area_type: record?.area_type || '',
        parent_id: record?.parent_id || undefined,
        sort_order: record?.sort_order || 0,
        status: record?.status ?? 1,
        remarks: record?.remarks || '',
      })
    } else if (type === 'template') {
      managerForm.setFieldsValue({
        template_name: record?.template_name || '',
        area_id: record?.area_id || undefined,
        item_name: record?.item_name || '',
        standard_value: record?.standard_value || '',
        unit: record?.unit || '',
        test_method: record?.test_method || '',
        sort_order: record?.sort_order || 0,
        status: record?.status ?? 1,
      })
    }
    setManagerOpen(true)
  }

  const handleManagerSave = async () => {
    if (!managerType) return
    try {
      const values = await managerForm.validateFields()
      if (managerType === 'area') {
        const payload = { ...values, parent_id: values.parent_id || null }
        if (managerEditRecord) {
          const res = await api.put(`/basic/env-areas/${managerEditRecord.area_id}`, payload)
          if (res.success !== false) { message.success('更新成功'); setManagerOpen(false); loadAreas(); fetchData() }
          else message.error(res.message || '更新失败')
        } else {
          const res = await api.post('/basic/env-areas', payload)
          if (res.success !== false) { message.success('创建成功'); setManagerOpen(false); loadAreas(); fetchData() }
          else message.error(res.message || '创建失败')
        }
      } else if (managerType === 'template') {
        const payload = { ...values }
        if (managerEditRecord) {
          const res = await api.put(`/basic/env-templates/${managerEditRecord.template_id}`, payload)
          if (res.success !== false) { message.success('更新成功'); setManagerOpen(false); loadTemplates() }
          else message.error(res.message || '更新失败')
        } else {
          const res = await api.post('/basic/env-templates', payload)
          if (res.success !== false) { message.success('创建成功'); setManagerOpen(false); loadTemplates() }
          else message.error(res.message || '创建失败')
        }
      }
    } catch (e: any) {
      if (e?.message?.includes('validate')) return
      message.error(e?.message || '保存失败')
    }
  }

  const handleManagerDelete = async (type: 'area' | 'template', record: any) => {
    try {
      if (type === 'area') {
        const res = await api.delete(`/basic/env-areas/${record.area_id}`)
        if (res.success !== false) { message.success('删除成功'); loadAreas() }
        else message.error(res.message || '删除失败')
      } else {
        const res = await api.delete(`/basic/env-templates/${record.template_id}`)
        if (res.success !== false) { message.success('删除成功'); loadTemplates() }
        else message.error(res.message || '删除失败')
      }
    } catch (e: any) {
      message.error(e?.message || '删除失败')
    }
  }

  // 状态文本
  const getStatusText = (s: any) => (typeof s === 'number' ? STATUS_MAP[s] || String(s) : s)

  const columns = [
    { title: '检验编号', dataIndex: 'inspection_no', key: 'inspection_no', width: 160, fixed: 'left' as const },
    {
      title: '检验区域', dataIndex: 'area_name', key: 'area_name', width: 120,
      render: (v: string) => v || <Text type="secondary">-</Text>
    },
    {
      title: '触发方式', dataIndex: 'trigger_type', key: 'trigger_type', width: 100,
      render: (v: string) => <Tag color={triggerColor[v] || 'default'}>{v || '-'}</Tag>
    },
    {
      title: '检验结果', dataIndex: 'result', key: 'result', width: 90,
      render: (v: string) => v ? <Tag color={resultColor[v]}>{v}</Tag> : <Tag>待检</Tag>
    },
    {
      title: '纠正措施', dataIndex: 'correction_action', key: 'correction_action', width: 220,
      render: (v: string) => v ? v : <Text type="secondary">-</Text>
    },
    {
      title: '复查日期', dataIndex: 'recheck_date', key: 'recheck_date', width: 110,
      render: (v: string) => v || <Text type="secondary">-</Text>
    },
    {
      title: '复查结果', dataIndex: 'recheck_result', key: 'recheck_result', width: 100,
      render: (v: string) => v ? <Tag color={resultColor[v] || 'default'}>{v}</Tag> : <Text type="secondary">-</Text>
    },
    { title: '检验人', dataIndex: 'inspector_name', key: 'inspector_name', width: 100, render: (v: string) => v || '-' },
    { title: '检验日期', dataIndex: 'inspection_date', key: 'inspection_date', width: 110, render: (v: string) => v || '-' },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (v: any) => <Tag color={statusColor[getStatusText(v)] || 'default'}>{getStatusText(v)}</Tag>
    },
    {
      title: '操作', key: 'action', fixed: 'right' as const, width: 280,
      render: (_: any, record: any) => {
        const status = getStatusText(record.status)
        const result = record.result
        return (
          <Space size={2} wrap>
            <Button type="link" size="small" onClick={() => showDetail(record)}>查看</Button>
            {(status === '待检' || status === '检验中') && (
              <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
            )}
            {status === '待检' && (
              <Button type="link" size="small" onClick={() => handleStart(record)}>开始检验</Button>
            )}
            {status === '检验中' && (
              <Button type="link" size="small" onClick={() => handleSubmitResult(record)}>提交结果</Button>
            )}
            {result === '不合格' && status === '已完成' && (
              <Button type="link" size="small" onClick={() => openHandle(record)}>处理</Button>
            )}
            {status === '已完成' && (result !== '不合格') && (
              <Button type="link" size="small" onClick={() => handleClose(record)}>关闭</Button>
            )}
          </Space>
        )
      }
    },
  ]

  const filters = useMemo(() => [
    {
      type: 'input' as const,
      placeholder: '检验编号',
      icon: <SearchOutlined />,
      value: inspectionNo,
      onChange: (e: any) => setInspectionNo(e?.target?.value !== undefined ? e.target.value : e),
      col: { span: 4 },
    },
    {
      type: 'select' as const,
      placeholder: '检验区域',
      options: areaOptions,
      value: areaFilter,
      onChange: setAreaFilter,
      col: { span: 3 },
    },
    {
      type: 'select' as const,
      placeholder: '检验结果',
      options: RESULT_OPTIONS,
      value: resultFilter,
      onChange: setResultFilter,
      col: { span: 3 },
    },
    {
      type: 'select' as const,
      placeholder: '状态',
      options: [
        { label: '待检', value: '待检' },
        { label: '检验中', value: '检验中' },
        { label: '已完成', value: '已完成' },
        { label: '已关闭', value: '已关闭' },
      ],
      value: statusFilter,
      onChange: setStatusFilter,
      col: { span: 3 },
    },
    {
      type: 'select' as const,
      placeholder: '快速选择月份',
      options: MONTH_QUICK_OPTIONS,
      value: monthQuick || undefined,
      onChange: handleMonthQuick,
      col: { span: 4 },
    },
    {
      type: 'rangepicker' as const,
      value: dateRange,
      onChange: handleRangeChange,
      col: { span: 5 },
    },
  ], [inspectionNo, areaFilter, resultFilter, statusFilter, dateRange, monthQuick, areaOptions])

  const actions = (
    <Space>
      <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建检验</Button>
      <Button icon={<SettingOutlined />} onClick={() => openManager('area')}>区域管理</Button>
      <Button icon={<SettingOutlined />} onClick={() => openManager('template')}>模板管理</Button>
      <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
    </Space>
  )

  // 表单子项列
  const formItemColumns = [
    {
      title: '检验项目', dataIndex: 'item_name', key: 'item_name', width: 140,
      render: (v: string) => <Text strong>{v}</Text>
    },
    { title: '标准要求', dataIndex: 'standard_value', key: 'standard_value', width: 160 },
    {
      title: '实测值', dataIndex: 'actual_value', key: 'actual_value', width: 200,
      render: (_: any, record: any, idx: number) => (
        <Input
          value={record.actual_value}
          onChange={(e) => updateItemValue(idx, 'actual_value', e.target.value)}
          placeholder="请输入实测值"
        />
      )
    },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 80 },
    {
      title: '判定', dataIndex: 'judge', key: 'judge', width: 90,
      render: (v: string) => v ? <Tag color={v === '合格' ? 'success' : v === '不合格' ? 'error' : 'default'}>{v}</Tag> : <Tag>待判定</Tag>
    },
    {
      title: '备注', key: 'remark', width: 180,
      render: (_: any, record: any, idx: number) => (
        <Input
          value={record.remark || ''}
          onChange={(e) => updateItemValue(idx, 'remark', e.target.value)}
          placeholder="备注"
        />
      )
    },
  ]

  // 管理：区域列表列
  const areaColumns = [
    { title: '区域编码', dataIndex: 'area_code', key: 'area_code', width: 120 },
    { title: '区域名称', dataIndex: 'area_name', key: 'area_name', width: 140 },
    { title: '区域类型', dataIndex: 'area_type', key: 'area_type', width: 100 },
    { title: '排序', dataIndex: 'sort_order', key: 'sort_order', width: 80 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (v: number) => <Tag color={v === 1 ? 'success' : 'default'}>{v === 1 ? '启用' : '停用'}</Tag>
    },
    {
      title: '操作', key: 'action', width: 140,
      render: (_: any, r: any) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openManager('area', r)}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleManagerDelete('area', r)} okText="确认" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    },
  ]

  // 管理：模板列表列
  const templateColumns = [
    { title: '模板名称', dataIndex: 'template_name', key: 'template_name', width: 140 },
    {
      title: '所属区域', dataIndex: 'area_name', key: 'area_name', width: 140,
      render: (v: string) => v || '-'
    },
    { title: '检验项目', dataIndex: 'item_name', key: 'item_name', width: 140 },
    { title: '标准要求', dataIndex: 'standard_value', key: 'standard_value', width: 140 },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 80 },
    { title: '检测方法', dataIndex: 'test_method', key: 'test_method', width: 120, render: (v: string) => v || '-' },
    {
      title: '操作', key: 'action', width: 140,
      render: (_: any, r: any) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openManager('template', r)}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleManagerDelete('template', r)} okText="确认" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    },
  ]

  return (
    <>
      <ThreeSectionPage
        title="环境检验"
        breadcrumbs="质量管理 / 环境检验"
        stats={stats}
        filters={filters}
        onSearch={fetchData}
        onReset={handleReset}
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
            <ResizableTable tableKey="pages_quality_EnvironmentInspection"
              columns={columns}
              dataSource={data}
              rowKey="inspection_id"
              loading={loading}
              size="small"
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

      {/* 详情 Drawer */}
      <Drawer
        title="环境检验详情"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={820}
        destroyOnHidden
      >
        {current && (
          <>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="检验编号">{current.inspection_no}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColor[getStatusText(current.status)] || 'default'}>{getStatusText(current.status)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="检验区域">{current.area_name}</Descriptions.Item>
              <Descriptions.Item label="触发方式">
                <Tag color={triggerColor[current.trigger_type] || 'default'}>{current.trigger_type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="检验人">{current.inspector_name}</Descriptions.Item>
              <Descriptions.Item label="检验日期">{current.inspection_date}</Descriptions.Item>
              <Descriptions.Item label="检验结果">
                {current.result ? <Tag color={resultColor[current.result]}>{current.result}</Tag> : <Tag>待检</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="复查日期">{current.recheck_date || '-'}</Descriptions.Item>
              <Descriptions.Item label="复查结果">
                {current.recheck_result ? <Tag color={resultColor[current.recheck_result] || 'default'}>{current.recheck_result}</Tag> : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="纠正措施" span={2}>
                {current.correction_action || '-'}
              </Descriptions.Item>
            </Descriptions>
            <Title level={5}>检验结果明细</Title>
            <ResizableTable tableKey="pages_quality_EnvironmentInspection_detail"
              columns={[
                { title: '检验项目', dataIndex: 'item_name', key: 'item_name' },
                { title: '标准要求', dataIndex: 'standard_value', key: 'standard_value' },
                { title: '实测值', dataIndex: 'actual_value', key: 'actual_value' },
                { title: '单位', dataIndex: 'unit', key: 'unit', width: 80 },
                {
                  title: '判定', dataIndex: 'judge', key: 'judge', width: 90,
                  render: (v: string) => <Tag color={v === '合格' ? 'success' : v === '不合格' ? 'error' : 'default'}>{v || '待判定'}</Tag>
                },
              ]}
              dataSource={currentItems}
              rowKey={(r: any, i: number) => i}
              size="small"
              pagination={false}
            />
          </>
        )}
      </Drawer>

      {/* 新建/编辑 Drawer */}
      <Drawer
        title={drawerMode === 'edit' ? '编辑环境检验' : '新建环境检验'}
        open={formVisible}
        onClose={() => setFormVisible(false)}
        width={1100}
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
        <Form form={form} layout="vertical" initialValues={{ trigger_type: '手工' }}>
          <Title level={5} style={{ marginBottom: 12 }}>基本信息</Title>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item
                label="检验区域"
                name="area_id"
                rules={[{ required: true, message: '请选择检验区域' }]}
              >
                <Select
                  placeholder="请选择检验区域"
                  options={areaOptions}
                  onChange={(v) => handleAreaChange(v as number)}
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="触发方式" name="trigger_type">
                <Select options={TRIGGER_OPTIONS} placeholder="请选择触发方式" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="检验日期" name="inspection_date">
                <DatePicker style={{ width: '100%' }} placeholder="选择日期" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="检验人" name="inspector_name">
                <Input placeholder="请输入检验人" />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item label="备注" name="remarks">
                <Input.TextArea rows={1} placeholder="可填写备注" />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        <Title level={5} style={{ margin: '16px 0 12px' }}>
          检验项目 {selectedAreaId && <Text type="secondary">（已加载所选区域的检验模板）</Text>}
        </Title>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="请填写每项检验项目的实测值，系统将根据标准自动判定合格/不合格"
        />
        <ResizableTable
          tableKey="pages_quality_EnvironmentInspection_form"
          columns={formItemColumns}
          dataSource={formItems}
          rowKey={(r: any, i: number) => i}
          size="small"
          pagination={false}
          locale={{ emptyText: selectedAreaId ? '该区域暂无检验模板，请先在"模板管理"中配置' : '请先选择检验区域加载模板'}}
        />
      </Drawer>

      {/* 不合格处理 Modal */}
      <Modal
        title="不合格处理"
        open={handleOpen}
        onCancel={() => setHandleOpen(false)}
        onOk={handleHandleConfirm}
      >
        {handleRecord && (
          <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="检验编号">{handleRecord.inspection_no}</Descriptions.Item>
            <Descriptions.Item label="检验区域">{handleRecord.area_name}</Descriptions.Item>
            <Descriptions.Item label="检验结果">
              <Tag color={resultColor[handleRecord.result]}>{handleRecord.result}</Tag>
            </Descriptions.Item>
          </Descriptions>
        )}
        <Form layout="vertical">
          <Form.Item label="纠正措施" required>
            <Input.TextArea
              rows={3}
              value={correctAction}
              onChange={(e) => setCorrectAction(e.target.value)}
              placeholder="请填写已采取的纠正措施"
            />
          </Form.Item>
          <Form.Item label="复查日期">
            <DatePicker
              style={{ width: '100%' }}
              value={recheckDate}
              onChange={setRecheckDate}
              placeholder="选择复查日期"
            />
          </Form.Item>
          <Form.Item label="复查结果">
            <Select
              options={[
                { label: '合格', value: '合格' },
                { label: '不合格', value: '不合格' },
              ]}
              value={recheckResult}
              onChange={setRecheckResult}
              placeholder="请选择复查结果"
              allowClear
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 管理 Drawer */}
      <Drawer
        title={managerType === 'template' ? '模板管理' : '区域管理'}
        open={managerOpen}
        onClose={() => setManagerOpen(false)}
        width={managerType === 'template' ? 1100 : 700}
        destroyOnHidden
        extra={
          <Space>
            <Button onClick={() => { setManagerEditRecord(null); managerForm.resetFields() }}>新建</Button>
          </Space>
        }
      >
        {managerType === 'area' && (
          <>
            <Title level={5} style={{ marginBottom: 12 }}>{managerEditRecord ? '编辑区域' : '新建区域'}</Title>
            <Form form={managerForm} layout="vertical">
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item label="区域编码" name="area_code">
                    <Input placeholder="请输入区域编码" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="区域名称" name="area_name" rules={[{ required: true, message: '请输入区域名称' }]}>
                    <Input placeholder="请输入区域名称" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="区域类型" name="area_type">
                    <Input placeholder="如：生产车间/库房" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="父级区域" name="parent_id">
                    <Select
                      placeholder="请选择父级区域"
                      allowClear
                      options={areas
                        .filter(a => !managerEditRecord || a.area_id !== managerEditRecord.area_id)
                        .map(a => ({ label: a.area_name, value: a.area_id }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="排序" name="sort_order">
                    <Input type="number" placeholder="排序" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="状态" name="status">
                    <Select options={[{ label: '启用', value: 1 }, { label: '停用', value: 0 }]} />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item label="备注" name="remarks">
                    <Input.TextArea rows={2} placeholder="备注" />
                  </Form.Item>
                </Col>
              </Row>
              <Space>
                <Button type="primary" onClick={handleManagerSave}>保存</Button>
                <Button onClick={() => { setManagerEditRecord(null); managerForm.resetFields() }}>重置</Button>
              </Space>
            </Form>
            <Title level={5} style={{ margin: '20px 0 12px' }}>区域列表</Title>
            <ResizableTable
              tableKey="pages_quality_EnvironmentInspection_areas"
              columns={areaColumns}
              dataSource={areas}
              rowKey="area_id"
              size="small"
              pagination={false}
            />
          </>
        )}

        {managerType === 'template' && (
          <>
            <Title level={5} style={{ marginBottom: 12 }}>{managerEditRecord ? '编辑模板' : '新建模板'}</Title>
            <Form form={managerForm} layout="vertical">
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item label="模板名称" name="template_name" rules={[{ required: true, message: '请输入模板名称' }]}>
                    <Input placeholder="如：一号车间日常检测" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="所属区域" name="area_id">
                    <Select
                      placeholder="请选择所属区域"
                      allowClear
                      options={areaOptions}
                      showSearch
                      optionFilterProp="label"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="检验项目" name="item_name" rules={[{ required: true, message: '请输入检验项目' }]}>
                    <Input placeholder="如：沉降菌" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="标准要求" name="standard_value">
                    <Input placeholder="如：≤10 CFU/皿" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="单位" name="unit">
                    <Input placeholder="如：CFU/皿" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="检测方法" name="test_method">
                    <Input placeholder="如：GB/T 18866" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="排序" name="sort_order">
                    <Input type="number" placeholder="排序" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="状态" name="status">
                    <Select options={[{ label: '启用', value: 1 }, { label: '停用', value: 0 }]} />
                  </Form.Item>
                </Col>
              </Row>
              <Space>
                <Button type="primary" onClick={handleManagerSave}>保存</Button>
                <Button onClick={() => { setManagerEditRecord(null); managerForm.resetFields() }}>重置</Button>
              </Space>
            </Form>
            <Title level={5} style={{ margin: '20px 0 12px' }}>模板列表</Title>
            <ResizableTable
              tableKey="pages_quality_EnvironmentInspection_templates"
              columns={templateColumns}
              dataSource={templates}
              rowKey="template_id"
              size="small"
              pagination={false}
            />
          </>
        )}
      </Drawer>
    </>
  )
}
