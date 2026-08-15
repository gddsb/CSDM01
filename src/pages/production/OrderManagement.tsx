import ResizableTable from '../../components/ResizableTable'
import React, { useState, useEffect, useCallback } from 'react'
import { Table, Tag, Button, Modal, Form, Input, InputNumber, Select, DatePicker, Space, Row, Col, Drawer, Descriptions, Popconfirm, Checkbox, Divider, Alert } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useMessage, useApp } from '../../contexts/AppContext'
import {
  FileTextOutlined, SearchOutlined, ReloadOutlined,
  SendOutlined, ClockCircleOutlined, CheckCircleOutlined, SyncOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import api from '../../utils/api'
import { formatVersionNo, formatDateTime, formatDate } from '../../utils'
import { MONTH_QUICK_OPTIONS, getMonthRange, validateRange } from '../../utils/monthQuick'

const { RangePicker } = DatePicker

const statusColorMap = {
  '开立': 'default',
  '下发': 'processing',
  '开工': 'processing',
  '完工': 'success',
  '关闭': 'error',
}

const statusOptions = [
  { label: '开立', value: '开立' },
  { label: '下发', value: '下发' },
  { label: '开工', value: '开工' },
  { label: '完工', value: '完工' },
  { label: '关闭', value: '关闭' },
]

export default function OrderManagement() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [materials, setMaterials] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [currentOrder, setCurrentOrder] = useState(null)
  const [reportOrders, setReportOrders] = useState([])
  const [reportOrdersLoading, setReportOrdersLoading] = useState(false)
  const [reportOrderDetails, setReportOrderDetails] = useState<Record<number, any>>({})
  const [loadingDetails, setLoadingDetails] = useState<Record<number, boolean>>({})
  const [orderSummary, setOrderSummary] = useState<{ totalInput: number; totalDefect: number; totalFinished: number } | null>(null)
  const [editing, setEditing] = useState(null)
  const [selectedMaterial, setSelectedMaterial] = useState(null)
  const [form] = Form.useForm()
  const navigate = useNavigate()

  const message = useMessage()
  const { hasPermission } = useApp()

  // 筛选输入态
  const [keywordInput, setKeywordInput] = useState('')
  const [materialCodeInput, setMaterialCodeInput] = useState('')
  const [statusInput, setStatusInput] = useState(['开立', '下发', '开工', '完工'])
  const [planDateRange, setPlanDateRange] = useState<any>(null)
  const [monthQuick, setMonthQuick] = useState<string>('')
  const [rangeWarn, setRangeWarn] = useState(false)
  // 已应用的查询条件
  const [query, setQuery] = useState({ page: 1, pageSize: 30, keyword: '', materialCode: '', status: ['开立', '下发', '开工', '完工'], planDateStart: '', planDateEnd: '' })

  // 获取订单列表（生产订单业务表 production_order）
  useEffect(() => {
    // 未选择任何状态时不查询，直接显示空列表
    if (!query.status || query.status.length === 0) {
      setData([])
      setTotal(0)
      return
    }
    let cancelled = false
    const run = async () => {
      setLoading(true)
      if (planDateRange) {
        const check = validateRange(planDateRange)
        if (!check.ok) {
          message.warning(check.msg)
          setLoading(false)
          return
        }
        setRangeWarn(!!check.warn)
      } else {
        setRangeWarn(false)
      }
      try {
        const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize }
        if (query.keyword) params.keyword = query.keyword
        if (query.materialCode) params.materialCode = query.materialCode
        if (query.status && query.status.length > 0) params.status = query.status.join(',')
        if (query.planDateStart) params.planDateStart = query.planDateStart
        if (query.planDateEnd) params.planDateEnd = query.planDateEnd
        const res = await api.get('/production/orders', { params })
        if (cancelled) return
        const list = res.data || []
        setData(list)
        setTotal(res.total || list.length)
      } catch (err) {
        if (!cancelled) {
          message.error(err.message || '获取订单列表失败')
          setData([])
          setTotal(0)
        }
      } finally {
        if (!cancelled) setLoading(false)
        setRangeWarn(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [query])

  // 获取料品列表（仅C开头成品罐）
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const res = await api.get('/basic/materials', { params: { page: 1, pageSize: 500 } })
        if (cancelled) return
        setMaterials(res.data || [])
      } catch (err) {
        if (!cancelled) message.error(err.message || '获取料品列表失败')
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  const refresh = useCallback(() => setQuery(q => ({ ...q })), [])

  // 成品罐料品（不限前缀，由后端数据决定）
  const cMaterials = materials

  const pendingCount = data.filter(o => o.status === '开立').length
  const startedCount = data.filter(o => o.status === '开工').length
  const closedCount = data.filter(o => o.status === '完工').length

  const stats = [
    { label: '总订单数', value: total, icon: <FileTextOutlined />, color: '#2196F3' },
    { label: '开立', value: pendingCount, icon: <ClockCircleOutlined />, color: '#9E9E9E' },
    { label: '开工', value: startedCount, icon: <SendOutlined />, color: '#FF9800' },
    { label: '完工', value: closedCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
  ]

  const handleRelease = (r) => {
    Modal.confirm({
      title: '确认下发',
      content: '确认下发该订单？下发后将不可修改',
      okText: '确认下发',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await api.post(`/production/orders/${r.order_id}/release`)
          message.success(res.message || `订单 ${r.order_no} 已下发`)
          refresh()
        } catch (err) {
          message.error(err.message || '下发失败')
        }
      },
    })
  }

  const handleClose = (r) => {
    Modal.confirm({
      title: '确认关闭',
      content: `确认关闭订单 ${r.order_no}？关闭后将不可恢复`,
      okText: '确认关闭',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await api.post(`/production/orders/${r.order_id}/close`)
          message.success(res.message || '订单已关闭')
          refresh()
        } catch (err) {
          message.error(err.message || '关闭失败')
        }
      },
    })
  }

  const handleFinish = (r) => {
    Modal.confirm({
      title: '确认完工',
      content: `确认完工订单 ${r.order_no}？完工后将不可恢复`,
      okText: '确认完工',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await api.post(`/production/orders/${r.order_id}/finish`)
          message.success(res.message || '订单已完工')
          refresh()
        } catch (err) {
          message.error(err.message || '完工失败')
        }
      },
    })
  }

  const handleStart = (r) => {
    navigate('/production/reporting')
  }

  const handleAdd = () => {
    setEditing(null)
    form.resetFields()
    setSelectedMaterial(null)
    setAddOpen(true)
  }

  // 订单同步：触发 task_生产订单同步 采集 U9 数据 → 完成后按关联关系更新业务表 production_order
  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await api.post('/auto/sync-production-orders', {}, { timeout: 300000 })
      const d = res.data || {}
      const collected = d.collected ?? 0
      const m = d.migrated || {}
      message.success(res.message || `订单同步完成：采集 ${collected} 条，业务表新增 ${m.inserted ?? 0} 条、更新 ${m.updated ?? 0} 条`)
      setQuery(q => ({ ...q, page: 1 }))
    } catch (err) {
      message.error(err.message || '订单同步失败')
    } finally {
      setSyncing(false)
    }
  }

  const handleEdit = (r) => {
    setEditing(r)
    const m = materials.find(mat => mat.material_id === r.material_id)
    setSelectedMaterial(m || null)
    form.setFieldsValue({
      material_id: r.material_id,
      planned_qty: r.planned_qty,
      plan_start_time: r.plan_start_time ? dayjs(r.plan_start_time) : undefined,
      plan_end_time: r.plan_end_time ? dayjs(r.plan_end_time) : undefined,
    })
    setAddOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const payload = {
        material_id: values.material_id,
        planned_qty: values.planned_qty,
        plan_start_time: values.plan_start_time.format('YYYY-MM-DD'),
        plan_end_time: values.plan_end_time.format('YYYY-MM-DD'),
      }
      if (editing) {
        const res = await api.put(`/production/orders/${editing.order_id}`, payload)
        message.success(res.message || '订单已更新')
      } else {
        const res = await api.post('/production/orders', payload)
        message.success(res.message || '订单已创建')
      }
      setAddOpen(false)
      refresh()
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  // 计算单个报工单的工序统计和汇总数据
  const calcReportOrderStats = (detail: any) => {
    const processes = detail.report_processes || []
    const materials = detail.process_materials || []
    const defects = detail.process_defects || []

    // 检验报废（process_id=null）单独统计
    const scrapDefects = defects.filter((d: any) => d.process_id == null)
    const allScrapQty = scrapDefects.reduce((s: number, d: any) => s + (Number(d.quantity) || 0), 0)

    // 按工序顺序排列
    const sortedProcesses = [...processes].sort((a: any, b: any) =>
      (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0)
    )

    const processStats: any[] = []
    let prevOutputQty = 0
    let allIncomingQty = 0
    let allProcessQty = 0
    let allDefectQty = 0

    sortedProcesses.forEach((p: any, idx: number) => {
      const procMaterials = materials.filter((m: any) => m.process_id === p.process_id)
      const investQty = procMaterials
        .filter((m: any) => m.material_type === '投入')
        .reduce((sum: number, m: any) => sum + (Number(m.quantity) || 0), 0)
      const returnQty = procMaterials
        .filter((m: any) => m.material_type === '退回')
        .reduce((sum: number, m: any) => sum + (Number(m.quantity) || 0), 0)

      const procDefects = defects.filter((d: any) => d.process_id === p.process_id)
      let incomingQty = 0
      let processQty = 0
      let totalDefectQty = 0
      procDefects.forEach((d: any) => {
        const dt = d.defect_type?.defect_type || '其他'
        const qty = Number(d.quantity) || 0
        if (dt === '来料不良') incomingQty += qty
        else if (dt === '制程不良') processQty += qty
        totalDefectQty += qty
      })

      const hasReport = investQty > 0 || returnQty > 0 || totalDefectQty > 0
      let inputQty: number
      let outputQty: number

      if (idx === 0) {
        inputQty = investQty - returnQty
      } else {
        inputQty = prevOutputQty
      }

      if (!hasReport) {
        outputQty = inputQty
      } else {
        outputQty = Math.max(0, inputQty - totalDefectQty)
      }

      allIncomingQty += incomingQty
      allProcessQty += processQty
      allDefectQty += totalDefectQty

      processStats.push({
        ...p,
        inputQty,
        outputQty,
        incomingQty,
        processQty,
        totalDefectQty,
        defectRate: inputQty > 0 ? ((totalDefectQty / inputQty) * 100).toFixed(2) : '0.00',
        incomingRate: inputQty > 0 ? ((incomingQty / inputQty) * 100).toFixed(2) : '0.00',
        processRate: inputQty > 0 ? ((processQty / inputQty) * 100).toFixed(2) : '0.00',
      })

      prevOutputQty = outputQty
    })

    const allInputQty = processStats[0]?.inputQty || 0
    const allOutputQty = processStats.length > 0 ? processStats[processStats.length - 1].outputQty : 0
    const allDefectRate = allInputQty > 0 ? ((allDefectQty / allInputQty) * 100).toFixed(2) : '0.00'
    const allIncomingRate = allInputQty > 0 ? ((allIncomingQty / allInputQty) * 100).toFixed(2) : '0.00'
    const allProcessRate = allInputQty > 0 ? ((allProcessQty / allInputQty) * 100).toFixed(2) : '0.00'
    const allScrapRate = allInputQty > 0 ? ((allScrapQty / allInputQty) * 100).toFixed(2) : '0.00'

    return {
      processStats,
      allInputQty,
      allOutputQty,
      allIncomingQty,
      allProcessQty,
      allDefectQty,
      allScrapQty,
      allDefectRate,
      allIncomingRate,
      allProcessRate,
      allScrapRate,
    }
  }

  const handleView = async (r) => {
    setCurrentOrder(r)
    setDetailOpen(true)
    setReportOrders([])
    setReportOrderDetails({})
    setLoadingDetails({})
    setOrderSummary(null)
    setReportOrdersLoading(true)
    try {
      const res = await api.get('/production/report-orders', { params: { order_id: r.order_id, page: 1, pageSize: 100 } })
      const list = res.data || []
      setReportOrders(list)
      // 预加载所有报工单详情
      const detailPromises = list.map(async (ro) => {
        setLoadingDetails(prev => ({ ...prev, [ro.report_order_id]: true }))
        try {
          const detailRes = await api.get(`/production/report-orders/${ro.report_order_id}`)
          if (detailRes && detailRes.data) {
            return detailRes.data
          }
        } catch (e) {
          // ignore
        } finally {
          setLoadingDetails(prev => ({ ...prev, [ro.report_order_id]: false }))
        }
        return null
      })
      const allDetails = await Promise.all(detailPromises)
      // 计算订单级汇总：总投入、总不良（来料+制程+检验报废）、总产出（完工数量）
      let totalInput = 0
      let totalDefect = 0
      let totalFinished = 0
      allDetails.forEach((d: any) => {
        if (!d) return
        const stats = calcReportOrderStats(d)
        totalInput += stats.allInputQty
        totalDefect += stats.allIncomingQty + stats.allProcessQty + stats.allScrapQty
        totalFinished += stats.allOutputQty
        setReportOrderDetails(prev => ({ ...prev, [d.report_order_id]: d }))
      })
      setOrderSummary({ totalInput, totalDefect, totalFinished })
    } catch (err) {
      setReportOrders([])
    } finally {
      setReportOrdersLoading(false)
    }
  }

  const handleMonthQuick = (v: string) => {
    setMonthQuick(v)
    const range = getMonthRange(v)
    setPlanDateRange(range)
    setQuery(q => ({
      ...q,
      page: 1,
      keyword: keywordInput,
      materialCode: materialCodeInput,
      status: statusInput,
      planDateStart: range?.[0]?.format('YYYY-MM-DD') || '',
      planDateEnd: range?.[1]?.format('YYYY-MM-DD') || '',
    }))
  }
  const handleRangeChange = (v: any) => {
    setMonthQuick(undefined)
    setPlanDateRange(v)
    setQuery(q => ({
      ...q,
      page: 1,
      keyword: keywordInput,
      materialCode: materialCodeInput,
      status: statusInput,
      planDateStart: v?.[0]?.format('YYYY-MM-DD') || '',
      planDateEnd: v?.[1]?.format('YYYY-MM-DD') || '',
    }))
  }

  const handleSearch = useCallback(() => {
    setQuery(q => ({
      ...q,
      page: 1,
      keyword: keywordInput,
      materialCode: materialCodeInput,
      status: statusInput,
      planDateStart: planDateRange?.[0]?.format('YYYY-MM-DD') || '',
      planDateEnd: planDateRange?.[1]?.format('YYYY-MM-DD') || '',
    }))
  }, [keywordInput, materialCodeInput, statusInput, planDateRange])

  const handleReset = () => {
    setKeywordInput('')
    setMaterialCodeInput('')
    setStatusInput(['开立', '下发', '开工', '完工'])
    setMonthQuick('')
    setPlanDateRange(null)
    setQuery(q => ({ ...q, page: 1, keyword: '', materialCode: '', status: ['开立', '下发', '开工', '完工'], planDateStart: '', planDateEnd: '' }))
  }

  const renderActions = (r) => {
    if (r.status === '开立') {
      return (
        <Space size={0}>
          {hasPermission('production:order:release') && (
            <Button type="link" size="small" onClick={() => handleRelease(r)}>下发</Button>
          )}
          {hasPermission('production:order:update') && (
            <Button type="link" size="small" onClick={() => handleEdit(r)}>编辑</Button>
          )}
          <Button type="link" size="small" onClick={() => handleView(r)}>查看</Button>
        </Space>
      )
    }
    if (r.status === '下发') {
      return (
        <Space size={0}>
          <Button type="link" size="small" onClick={() => handleStart(r)}>开工</Button>
          {hasPermission('production:order:close') && (
            <Button type="link" size="small" danger onClick={() => handleClose(r)}>关闭</Button>
          )}
          <Button type="link" size="small" onClick={() => handleView(r)}>查看</Button>
        </Space>
      )
    }
    if (r.status === '开工') {
      return (
        <Space size={0}>
          {hasPermission('production:order:finish') && (
            <Button type="link" size="small" onClick={() => handleFinish(r)}>完工</Button>
          )}
          <Button type="link" size="small" onClick={() => handleView(r)}>查看</Button>
        </Space>
      )
    }
    if (r.status === '完工') {
      return (
        <Space size={0}>
          {hasPermission('production:order:close') && (
            <Button type="link" size="small" danger onClick={() => handleClose(r)}>关闭</Button>
          )}
          <Button type="link" size="small" onClick={() => handleView(r)}>查看</Button>
        </Space>
      )
    }
    return <Button type="link" size="small" onClick={() => handleView(r)}>查看</Button>
  }

  const columns: ColumnsType<any> = [
    { title: '订单编号', dataIndex: 'order_no', key: 'order_no', width: 160, fixed: 'left' as const },
    { title: '料号', dataIndex: 'material_code', key: 'material_code', width: 130, fixed: 'left' as const },
    { title: '料品名称', dataIndex: 'material_name', key: 'material_name', width: 200, render: (text) => <div style={{ wordBreak: 'break-word', whiteSpace: 'normal' }}>{text}</div> },
    { title: '规格', dataIndex: 'specification', key: 'specification', width: 120, ellipsis: true },
    { title: '菲林编号', dataIndex: 'film_version', key: 'film_version', width: 120 },
    { title: '版本', dataIndex: 'version_no', key: 'version_no', width: 60, render: v => formatVersionNo(v) },
    { title: '计划数量', dataIndex: 'planned_qty', key: 'planned_qty', width: 100, align: 'right', render: v => (v || 0).toLocaleString() },
    {
      title: '完工数量', dataIndex: 'finished_qty', key: 'finished_qty', width: 100, align: 'right', render: v => {
        const val = v || 0
        return <span style={{ color: val > 0 ? 'var(--color-success)' : 'var(--text-secondary)' }}>{val.toLocaleString()}</span>
      }
    },
    { title: 'U9合格数', dataIndex: 'u9_qualified', key: 'u9_qualified', width: 90, align: 'right', render: v => (v || 0).toLocaleString() },
    {
      title: '计划时间', key: 'plan_time', width: 160,
      render: (_, r) => <span style={{ fontSize: 12 }}>{formatDate(r.plan_start_time)}<br />~ {formatDate(r.plan_end_time)}</span>,
    },
    { title: 'U9状态', dataIndex: 'u9_status', key: 'u9_status', width: 80 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: v => <Tag color={statusColorMap[v]}>{v}</Tag> },
    { title: '操作', key: 'action', render: (_, r) => renderActions(r) },
  ]

  return (
    <>
      <ThreeSectionPage
        title="生产订单"
        breadcrumbs="生产管理 / 生产订单"
        stats={stats}
        actions={
          <ActionButtons
            hasAdd={false}
            hasExport={false}
            extra={[
              hasPermission('production:order:create') && (
                <Button key="sync" type="primary" icon={<SyncOutlined />} loading={syncing} onClick={handleSync}>订单同步</Button>
              ),
            ].filter(Boolean)}
          />
        }
        table={
          <div>
            <Row gutter={[12, 8]} style={{ marginBottom: 12 }} align="middle">
              <Col flex="180px">
                <Input
                  placeholder="订单号"
                  allowClear
                  prefix={<SearchOutlined />}
                  value={keywordInput}
                  onChange={e => setKeywordInput(e.target.value)}
                  onPressEnter={handleSearch}
                  onBlur={handleSearch}
                />
              </Col>
              <Col flex="150px">
                <Input
                  placeholder="料号"
                  allowClear
                  value={materialCodeInput}
                  onChange={e => setMaterialCodeInput(e.target.value)}
                  onPressEnter={handleSearch}
                  onBlur={handleSearch}
                />
              </Col>
              <Col flex="230px">
                <Checkbox.Group
                  options={statusOptions}
                  value={statusInput}
                  onChange={(v) => {
                    setStatusInput(v)
                    setQuery(q => ({
                      ...q,
                      page: 1,
                      keyword: keywordInput,
                      materialCode: materialCodeInput,
                      status: v,
                      planDateStart: planDateRange?.[0]?.format('YYYY-MM-DD') || '',
                      planDateEnd: planDateRange?.[1]?.format('YYYY-MM-DD') || '',
                    }))
                  }}
                />
              </Col>
              <Col flex="160px">
                <Select
                  placeholder="快速选择月份"
                  allowClear
                  style={{ width: '100%' }}
                  value={monthQuick || undefined}
                  onChange={handleMonthQuick}
                  options={MONTH_QUICK_OPTIONS}
                />
              </Col>
              <Col flex="260px">
                <RangePicker
                  placeholder={['计划开始', '计划结束']}
                  style={{ width: '100%' }}
                  value={planDateRange}
                  onChange={handleRangeChange}
                />
              </Col>
              <Col>
                <Space>
                  <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>查询</Button>
                  <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
                </Space>
              </Col>
            </Row>
            {rangeWarn && (
              <Alert type="warning" showIcon style={{ marginBottom: 12 }}
                message="查询跨度时间较长，后台需要较长时间执行查询，可能造成页面假死状态" />
            )}
            <ResizableTable tableKey="pages_production_OrderManagement"               columns={columns}
              dataSource={data}
              rowKey="order_id"
              size="small"
              loading={loading}
              scroll={{ x: 1400 }}
              pagination={{
                current: query.page,
                pageSize: query.pageSize,
                total,
                showSizeChanger: true,
                showTotal: t => `共 ${t} 条`,
                onChange: (p, ps) => setQuery(q => ({ ...q, page: p, pageSize: ps })),
              }}
            />
          </div>
        }
      />

      <Modal
        title={editing ? '编辑订单' : '新增订单'}
        open={addOpen}
        onOk={handleSubmit}
        confirmLoading={submitting}
        onCancel={() => setAddOpen(false)}
        okText="保存"
        cancelText="取消"
        width={560}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          <Form.Item label="订单编号">
            <Input value={editing ? editing.order_no : '创建时由系统生成'} disabled />
          </Form.Item>
          <Row gutter={12}>
            <Col span={24}>
              <Form.Item label="料号" name="material_id" rules={[{ required: true, message: '请选择料号' }]}>
                <Select
                  placeholder="请输入或选择料号"
                  disabled={!!editing}
                  showSearch
                  allowClear
                  filterOption={(input, option) => {
                    const m = cMaterials.find(mat => mat.material_id === option.value)
                    if (!m) return false
                    return m.material_code.toLowerCase().includes(input.toLowerCase()) ||
                      (m.material_name || '').includes(input)
                  }}
                  onChange={v => {
                    const m = cMaterials.find(mat => mat.material_id === v)
                    setSelectedMaterial(m || null)
                  }}
                  options={cMaterials.map(m => ({ label: `${m.material_code} | ${m.material_name} | ${m.specification || ''}`, value: m.material_id }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="料品名称">
                <Input value={selectedMaterial?.material_name || '-'} disabled />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="规格">
                <Input value={selectedMaterial?.specification || '-'} disabled />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="菲林编号">
                <Input value={selectedMaterial?.film_no || '-'} disabled />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="版本号">
                <Input value={formatVersionNo(selectedMaterial?.version_no)} disabled />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="计划数量" name="planned_qty" rules={[{ required: true, message: '请输入计划数量' }]}>
                <InputNumber min={1} style={{ width: '100%' }} placeholder="请输入计划数量" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="计划开始日期" name="plan_start_time" rules={[{ required: true, message: '请选择计划开始日期' }]}>
                <DatePicker
                  format="YYYY-MM-DD"
                  style={{ width: '100%' }}
                  disabledDate={current => current && current < dayjs().startOf('day')}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="计划完成日期" name="plan_end_time" rules={[{ required: true, message: '请选择计划完成日期' }]}>
                <DatePicker
                  format="YYYY-MM-DD"
                  style={{ width: '100%' }}
                  disabledDate={current => {
                    const startVal = form.getFieldValue('plan_start_time')
                    return startVal && current && current < dayjs(startVal).startOf('day')
                  }}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Drawer
        title="订单详情"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width="45%"
      >
        {currentOrder && (
          <>
            <Descriptions column={4} bordered size="small" style={{ marginBottom: 20 }}>
              <Descriptions.Item label="订单编号">{currentOrder.order_no}</Descriptions.Item>
              <Descriptions.Item label="下发时间">{formatDateTime(currentOrder.release_time)}</Descriptions.Item>
              <Descriptions.Item label="工单状态"><Tag color={statusColorMap[currentOrder.status]}>{currentOrder.status}</Tag></Descriptions.Item>
              <Descriptions.Item label="规格">{currentOrder.specification || '-'}</Descriptions.Item>
              <Descriptions.Item label="产品料号" span={1}>{currentOrder.material_code}</Descriptions.Item>
              <Descriptions.Item label="产品名称" span={3}>{currentOrder.material_name}</Descriptions.Item>
              <Descriptions.Item label="计划数量">{(currentOrder.planned_qty || 0).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="完工数量">
                <span style={{ color: '#52c41a' }}>
                  {(orderSummary ? orderSummary.totalFinished : (currentOrder.finished_qty || 0)).toLocaleString()}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="不良总数">
                <span style={{ color: '#ff4d4f' }}>
                  {orderSummary
                    ? orderSummary.totalDefect.toLocaleString()
                    : Math.max(0, (currentOrder.planned_qty || 0) - (currentOrder.finished_qty || 0)).toLocaleString()}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="合格率">
                <span style={{ color: '#52c41a' }}>
                  {orderSummary
                    ? (orderSummary.totalInput > 0
                        ? Math.min(100, ((orderSummary.totalFinished / orderSummary.totalInput) * 100)).toFixed(2)
                        : '0.00')
                    : ((currentOrder.planned_qty || 0) > 0
                        ? Math.min(100, (((currentOrder.finished_qty || 0) / (currentOrder.planned_qty || 0)) * 100)).toFixed(2)
                        : '0.00')}%
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="计划开始">{formatDate(currentOrder.plan_start_time)}</Descriptions.Item>
              <Descriptions.Item label="计划完成">{formatDate(currentOrder.plan_end_time)}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{formatDateTime(currentOrder.created_at)}</Descriptions.Item>
              <Descriptions.Item label="创建人">{currentOrder.created_by || '-'}</Descriptions.Item>
            </Descriptions>

            <Divider orientation="left" style={{ margin: '8px 0 16px' }}>
              <span style={{ fontWeight: 600 }}>报工单信息 ({reportOrders.length})</span>
            </Divider>

            <Table
              size="small"
              loading={reportOrdersLoading}
              dataSource={reportOrders}
              rowKey="report_order_id"
              pagination={false}
              scroll={{ x: 700 }}
              expandable={{
                expandedRowRender: (record) => {
                  const detail = reportOrderDetails[record.report_order_id]
                  const isLoading = loadingDetails[record.report_order_id]
                  if (isLoading) return <div style={{ padding: 16, textAlign: 'center', color: '#999' }}>加载中...</div>
                  if (!detail) return <div style={{ padding: 16, textAlign: 'center', color: '#999' }}>暂无数据</div>

                  const stats = calcReportOrderStats(detail)
                  const {
                    processStats,
                    allInputQty,
                    allOutputQty,
                    allIncomingQty,
                    allProcessQty,
                    allDefectQty,
                    allScrapQty,
                    allDefectRate,
                    allIncomingRate,
                    allProcessRate,
                    allScrapRate,
                  } = stats

                  const exceptions = detail.process_exceptions || []
                  const manpowerRecords = detail.manpower_records || []
                  const totalExceptionHours = exceptions.reduce((s: number, e: any) => s + Number(e.duration || 0), 0)
                  const totalManHours = manpowerRecords.reduce((s: number, m: any) => s + Number(m.man_hours || 0), 0)
                  const totalPeople = manpowerRecords.reduce((s: number, m: any) => s + Number(m.total_people || 0), 0)

                  return (
                    <div style={{ padding: '8px 12px' }}>
                      <Row style={{ marginBottom: 8, display: 'flex', flexWrap: 'nowrap', gap: 4 }}>
                        <div style={{ flex: 1, minWidth: 0, padding: '4px 6px', background: '#fafafa', borderRadius: 4 }}>
                          <span style={{ fontSize: 11, color: '#999', marginRight: 4 }}>总投入</span>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{allInputQty.toLocaleString()}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0, padding: '4px 6px', background: '#fafafa', borderRadius: 4 }}>
                          <span style={{ fontSize: 11, color: '#999', marginRight: 4 }}>总产出</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#52c41a' }}>{allOutputQty.toLocaleString()}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0, padding: '4px 6px', background: '#fafafa', borderRadius: 4 }}>
                          <span style={{ fontSize: 11, color: '#999', marginRight: 4 }}>总不良</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#ff4d4f' }}>{allDefectQty.toLocaleString()}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0, padding: '4px 6px', background: '#fafafa', borderRadius: 4 }}>
                          <span style={{ fontSize: 11, color: '#999', marginRight: 4 }}>不良率</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: allDefectQty > 0 ? '#ff4d4f' : 'inherit' }}>{allDefectRate}%</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0, padding: '4px 6px', background: '#fafafa', borderRadius: 4 }}>
                          <span style={{ fontSize: 11, color: '#999', marginRight: 4 }}>来料不良</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: allIncomingQty > 0 ? '#ff4d4f' : 'inherit' }}>
                            {allIncomingQty.toLocaleString()}<span style={{ fontSize: 10, color: '#999' }}>({allIncomingRate}%)</span>
                          </span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0, padding: '4px 6px', background: '#fafafa', borderRadius: 4 }}>
                          <span style={{ fontSize: 11, color: '#999', marginRight: 4 }}>制程不良</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: allProcessQty > 0 ? '#ff4d4f' : 'inherit' }}>
                            {allProcessQty.toLocaleString()}<span style={{ fontSize: 10, color: '#999' }}>({allProcessRate}%)</span>
                          </span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0, padding: '4px 6px', background: '#fafafa', borderRadius: 4 }}>
                          <span style={{ fontSize: 11, color: '#999', marginRight: 4 }}>检验报废</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: allScrapQty > 0 ? '#ff4d4f' : 'inherit' }}>
                            {allScrapQty.toLocaleString()}<span style={{ fontSize: 10, color: '#999' }}>({allScrapRate}%)</span>
                          </span>
                        </div>
                      </Row>
                      <Row style={{ marginBottom: 8, display: 'flex', flexWrap: 'nowrap', gap: 4 }}>
                        <div style={{ flex: 1, minWidth: 0, padding: '4px 6px', background: '#f0f5ff', borderRadius: 4 }}>
                          <span style={{ fontSize: 11, color: '#999', marginRight: 4 }}>异常工时</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: totalExceptionHours > 0 ? '#faad14' : 'inherit' }}>
                            {totalExceptionHours.toFixed(2)}<span style={{ fontSize: 10, color: '#999' }}>h</span>
                          </span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0, padding: '4px 6px', background: '#f0f5ff', borderRadius: 4 }}>
                          <span style={{ fontSize: 11, color: '#999', marginRight: 4 }}>总人时</span>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>
                            {totalManHours.toFixed(2)}<span style={{ fontSize: 10, color: '#999' }}>h</span>
                          </span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0, padding: '4px 6px', background: '#f0f5ff', borderRadius: 4 }}>
                          <span style={{ fontSize: 11, color: '#999', marginRight: 4 }}>投入人次</span>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{totalPeople}</span>
                        </div>
                      </Row>
                      <Table
                        size="small"
                        dataSource={processStats}
                        rowKey="process_id"
                        pagination={false}
                        scroll={{ x: 820 }}
                        columns={[
                          { title: '工序编码', dataIndex: 'process_code', key: 'process_code', width: 60, fixed: 'left' as const },
                          { title: '工序名称', dataIndex: 'process_name', key: 'process_name', width: 70, fixed: 'left' as const },
                          { title: '投入数量', dataIndex: 'inputQty', key: 'inputQty', width: 50, align: 'right', render: (v: any) => (v || 0).toLocaleString() },
                          { title: '产出数量', dataIndex: 'outputQty', key: 'outputQty', width: 50, align: 'right', render: (v: any) => (v || 0).toLocaleString() },
                          { title: '来料不良', dataIndex: 'incomingQty', key: 'incomingQty', width: 55, align: 'right', render: (v: any) => <span style={{ color: v > 0 ? '#ff4d4f' : 'inherit' }}>{(v || 0).toLocaleString()}</span> },
                          { title: '来料不良率', dataIndex: 'incomingRate', key: 'incomingRate', width: 60, align: 'right', render: (v: any) => <span>{v}%</span> },
                          { title: '制程不良', dataIndex: 'processQty', key: 'processQty', width: 55, align: 'right', render: (v: any) => <span style={{ color: v > 0 ? '#ff4d4f' : 'inherit' }}>{(v || 0).toLocaleString()}</span> },
                          { title: '制程不良率', dataIndex: 'processRate', key: 'processRate', width: 60, align: 'right', render: (v: any) => <span>{v}%</span> },
                          { title: '工序不良', dataIndex: 'totalDefectQty', key: 'totalDefectQty', width: 55, align: 'right', render: (v: any) => <span style={{ color: v > 0 ? '#ff4d4f' : 'inherit' }}>{(v || 0).toLocaleString()}</span> },
                          { title: '不良率', dataIndex: 'defectRate', key: 'defectRate', width: 55, align: 'right', render: (v: any) => <span>{v}%</span> },
                        ]}
                      />
                      {exceptions.length > 0 && (
                        <>
                          <div style={{ fontSize: 12, fontWeight: 600, margin: '12px 0 6px', color: '#666' }}>
                            异常工时记录 ({exceptions.length})
                          </div>
                          <Table
                            size="small"
                            dataSource={exceptions}
                            rowKey="exception_id"
                            pagination={false}
                            scroll={{ x: 700 }}
                            columns={[
                              { title: '异常类型', dataIndex: 'exception_type', key: 'exception_type', width: 100 },
                              { title: '停机类型', dataIndex: 'stop_type', key: 'stop_type', width: 100 },
                              { title: '设备', dataIndex: 'device_name', key: 'device_name', width: 100, render: v => v || '-' },
                              { title: '开始时间', dataIndex: 'start_time', key: 'start_time', width: 150, render: formatDateTime },
                              { title: '恢复时间', dataIndex: 'end_time', key: 'end_time', width: 150, render: v => v ? formatDateTime(v) : '-' },
                              { title: '持续时长', dataIndex: 'duration', key: 'duration', width: 80, align: 'right', render: (v: any) => <span style={{ color: '#faad14', fontWeight: 600 }}>{Number(v || 0).toFixed(2)}h</span> },
                              { title: '确认人', dataIndex: 'confirm_user_name', key: 'confirm_user_name', width: 80, render: v => v || '-' },
                              { title: '异常描述', dataIndex: 'description', key: 'description', render: v => v || '-' },
                            ]}
                          />
                        </>
                      )}
                      {manpowerRecords.length > 0 && (
                        <>
                          <div style={{ fontSize: 12, fontWeight: 600, margin: '12px 0 6px', color: '#666' }}>
                            人员工时记录 ({manpowerRecords.length})
                          </div>
                          <Table
                            size="small"
                            dataSource={manpowerRecords}
                            rowKey="record_id"
                            pagination={false}
                            scroll={{ x: 700 }}
                            columns={[
                              { title: '记录日期', dataIndex: 'record_date', key: 'record_date', width: 100 },
                              { title: '班次', dataIndex: 'shift', key: 'shift', width: 70 },
                              { title: '开始时间', dataIndex: 'start_time', key: 'start_time', width: 150, render: formatDateTime },
                              { title: '结束时间', dataIndex: 'end_time', key: 'end_time', width: 150, render: v => v ? formatDateTime(v) : '-' },
                              { title: '工时', dataIndex: 'hours', key: 'hours', width: 70, align: 'right', render: (v: any) => `${Number(v || 0).toFixed(2)}h` },
                              { title: '熟手', dataIndex: 'skilled_count', key: 'skilled_count', width: 60, align: 'right', render: (v: any) => v || 0 },
                              { title: '普工', dataIndex: 'general_count', key: 'general_count', width: 60, align: 'right', render: (v: any) => v || 0 },
                              { title: '劳务', dataIndex: 'labor_count', key: 'labor_count', width: 60, align: 'right', render: (v: any) => v || 0 },
                              { title: '总人数', dataIndex: 'total_people', key: 'total_people', width: 70, align: 'right', render: (v: any) => <strong>{v || 0}</strong> },
                              { title: '人时', dataIndex: 'man_hours', key: 'man_hours', width: 80, align: 'right', render: (v: any) => <span style={{ color: '#1890ff', fontWeight: 600 }}>{Number(v || 0).toFixed(2)}h</span> },
                              { title: '记录人', dataIndex: 'record_user_name', key: 'record_user_name', width: 80, render: v => v || '-' },
                              { title: '备注', dataIndex: 'remarks', key: 'remarks', render: v => v || '-' },
                            ]}
                          />
                        </>
                      )}
                    </div>
                  )
                },
              }}
              columns={[
                { title: '报工单号', dataIndex: 'report_no', key: 'report_no', width: 160 },
                { title: '产线', dataIndex: 'line_name', key: 'line_name', width: 100 },
                {
                  title: '状态', dataIndex: 'status', key: 'status', width: 70,
                  render: (v: string) => <Tag color={v === '完工' ? 'success' : 'processing'}>{v}</Tag>
                },
                {
                  title: '报工数量', dataIndex: 'report_qty', key: 'report_qty', width: 90, align: 'right',
                  render: (v: any) => (v || 0).toLocaleString()
                },
                { title: '报工时间', dataIndex: 'report_time', key: 'report_time', width: 150, render: formatDateTime },
                { title: '完工时间', dataIndex: 'finish_time', key: 'finish_time', width: 150, render: (v: any) => v ? formatDateTime(v) : '-' },
                { title: '报工人', dataIndex: 'report_user_name', key: 'report_user_name', width: 80 },
              ]}
            />
          </>
        )}
      </Drawer>
    </>
  )
}
