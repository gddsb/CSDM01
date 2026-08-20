import ResizableTable from '../../components/ResizableTable'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Tag, Button, Select, DatePicker, Space, Input, Drawer, Form, Descriptions, Typography, Alert, Checkbox, message, Modal, Popconfirm } from 'antd'
import InspectionItemEditor from '../../components/InspectionItemEditor'
import type { InspectionItemRow } from '../../components/InspectionItemEditor'
import {
  ExperimentOutlined, SafetyCertificateOutlined, WarningOutlined,
  CheckCircleOutlined, SearchOutlined, ReloadOutlined, PlusOutlined
} from '@ant-design/icons'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import { formatDateTime } from '../../utils'
import api from '../../utils/api'
import { MONTH_QUICK_OPTIONS, getMonthRange, validateRange } from '../../utils/monthQuick'

const { RangePicker } = DatePicker
const { Title } = Typography

const resultColor: Record<string, string> = { '合格': 'success', '不合格': 'error' }
const typeColor: Record<string, string> = { '正常': 'success', '加严': 'warning', '复检': 'processing' }
const objectColor: Record<string, string> = { '成品检验': 'blue', '来料检验': 'cyan' }
const statusColor: Record<string, string> = { '待检': 'default', '检验中': 'processing', '审核中': 'warning', '已完成': 'success', '已关闭': 'default' }
const handleColor: Record<string, string> = { '入库': 'green', '判退': 'red', '报废': 'red', '让步接收': 'orange' }

const STATUS_MAP: Record<number, string> = { 0: '待检', 1: '检验中', 2: '审核中', 3: '已完成', 4: '已关闭' }

const STATUS_REVERSE: Record<string, number> = { '待检': 0, '检验中': 1, '审核中': 2, '已完成': 3, '已关闭': 4 }

const INSPECTION_TYPES = [
  { label: '正常', value: '正常' },
  { label: '加严', value: '加严' },
  { label: '复检', value: '复检' },
]

const OBJECT_TYPES = [
  { label: '成品检验', value: '成品检验' },
  { label: '来料检验', value: '来料检验' },
]

const RESULT_OPTIONS = [
  { label: '合格', value: '合格' },
  { label: '不合格', value: '不合格' },
]

const STATUS_OPTIONS = [
  { label: '待检', value: '待检' },
  { label: '检验中', value: '检验中' },
  { label: '审核中', value: '审核中' },
  { label: '已完成', value: '已完成' },
  { label: '已关闭', value: '已关闭' },
]
const DEFAULT_STATUS = ['待检', '检验中', '审核中']

const HANDLE_OPTIONS = [
  { label: '入库', value: '入库' },
  { label: '判退', value: '判退' },
  { label: '报废', value: '报废' },
  { label: '让步接收', value: '让步接收' },
]

type DrawerMode = 'create' | 'edit' | null

export default function MicrobeInspection() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [current, setCurrent] = useState<any>(null)
  const [detailItems, setDetailItems] = useState<InspectionItemRow[]>([])

  const [inspectionNo, setInspectionNo] = useState<any>(undefined)
  const [inspectionType, setInspectionType] = useState<any>(undefined)
  const [objectType, setObjectType] = useState<any>(undefined)
  const [resultFilter, setResultFilter] = useState<any>(undefined)
  const [statusFilter, setStatusFilter] = useState<string[]>([...DEFAULT_STATUS])
  const [dateRange, setDateRange] = useState<any>(null)
  const [monthQuick, setMonthQuick] = useState<string>('')
  const [rangeWarn, setRangeWarn] = useState(false)

  // 新建/编辑 表单 Drawer
  const [formVisible, setFormVisible] = useState(false)
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [editRecord, setEditRecord] = useState<any>(null)
  const [editItems, setEditItems] = useState<InspectionItemRow[]>([])
  const [handleOpen, setHandleOpen] = useState(false)
  const [handleRecord, setHandleRecord] = useState<any>(null)
  const [handleType, setHandleType] = useState<string | undefined>(undefined)
  const [handleRemark, setHandleRemark] = useState<string>('')
  const [form] = Form.useForm()

  const fetchData = useCallback(async () => {
    setLoading(true)
    if (dateRange) {
      const check = validateRange(dateRange)
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
      const params: any = { page: pagination.current, page_size: pagination.pageSize }
      if (inspectionNo) params.inspection_no = inspectionNo
      if (inspectionType) params.inspection_type = inspectionType
      if (objectType) params.object_type = objectType
      if (resultFilter) params.result = resultFilter
      if (statusFilter && statusFilter.length > 0) params.status = statusFilter.join(',')
      if (dateRange && dateRange[0]) params.start_date = dateRange[0].format('YYYY-MM-DD')
      if (dateRange && dateRange[1]) params.end_date = dateRange[1].format('YYYY-MM-DD')

      const res = await api.get('/basic/microbe-inspections', { params })
      if (res.success !== false) {
        setData(res.data?.list || res.data || [])
        setPagination(p => ({ ...p, total: res.data?.total || res.total || 0 }))
      } else {
        setData([])
        setPagination(p => ({ ...p, total: 0 }))
      }
    } catch (e: any) {
      message.error(e?.message || '查询失败')
      setData([])
      setPagination(p => ({ ...p, total: 0 }))
    } finally {
      setLoading(false)
      setRangeWarn(false)
    }
  }, [pagination.current, pagination.pageSize, inspectionNo, inspectionType, objectType, resultFilter, statusFilter, dateRange])

  useEffect(() => { fetchData() }, [fetchData])

  const stats = useMemo(() => {
    return [
      { label: '总检验数', value: data.length, icon: <ExperimentOutlined />, color: '#2196F3' },
      { label: '成品检验', value: data.filter(i => i.object_type === '成品检验').length, icon: <SafetyCertificateOutlined />, color: '#4CAF50' },
      { label: '来料检验', value: data.filter(i => i.object_type === '来料检验').length, icon: <WarningOutlined />, color: '#FF9800' },
      { label: '合格率', value: data.length > 0 ? `${Math.round((data.filter(i => i.result === '合格').length / data.length) * 100)}%` : '0%', icon: <CheckCircleOutlined />, color: '#00BCD4' },
    ]
  }, [data])

  const getStatusText = (s: any) => {
    if (typeof s === 'number') return STATUS_MAP[s] || String(s)
    return s
  }

  const getRelatedNo = (record: any) => {
    if (record.report_order_no) return record.report_order_no
    if (record.incoming_no) return record.incoming_no
    return record.order_no || '-'
  }

  const showDetail = async (record: any) => {
    setCurrent(record)
    setDetailItems([])
    setDrawerOpen(true)
    try {
      const res = await api.get(`/basic/microbe-inspections/${record.inspection_id}`)
      if (res.success !== false && res.data) {
        setCurrent(res.data)
        const items: InspectionItemRow[] = (res.data.items || []).map((it: any, idx: number) => {
          const r = it.result
          let judge: '合格' | '不合格' | string | null = null
          if (r === 1 || r === '1' || r === '合格') judge = '合格'
          else if (r === 0 || r === '0' || r === '不合格') judge = '不合格'
          return { ...it, result: judge, sort_order: it.sort_order !== undefined ? it.sort_order : idx } as InspectionItemRow
        })
        setDetailItems(items)
      }
    } catch (e: any) {
      message.error(e?.message || '加载详情失败')
    }
  }

  const handleReset = () => {
    setInspectionNo(undefined)
    setInspectionType(undefined)
    setObjectType(undefined)
    setResultFilter(undefined)
    setStatusFilter([...DEFAULT_STATUS])
    setMonthQuick(''); setDateRange(null)
  }

  const handleMonthQuick = (v: string) => {
    setMonthQuick(v)
    const range = getMonthRange(v)
    setDateRange(range)
  }
  const handleRangeChange = (v: any) => {
    setMonthQuick(undefined)
    setDateRange(v)
  }

  // ============ 新建 ============
  const handleCreate = () => {
    setDrawerMode('create')
    setEditRecord(null)
    setEditItems([])
    form.resetFields()
    form.setFieldsValue({
      inspection_type: '正常',
      object_type: '成品检验',
      trigger_type: '手工',
    })
    setFormVisible(true)
  }

  // ============ 编辑 ============
  const handleEdit = async (record: any) => {
    try {
      const res = await api.get(`/basic/microbe-inspections/${record.inspection_id}`)
      const detail = res.data || record
      setEditRecord(detail)
      setDrawerMode('edit')
      const items: InspectionItemRow[] = (detail.items || []).map((it: any, idx: number) => {
        const r = it.result
        let judge: '合格' | '不合格' | string | null = null
        if (r === 1 || r === '1' || r === '合格') judge = '合格'
        else if (r === 0 || r === '0' || r === '不合格') judge = '不合格'
        return { ...it, result: judge, sort_order: it.sort_order !== undefined ? it.sort_order : idx } as InspectionItemRow
      })
      setEditItems(items)
      form.setFieldsValue({
        inspection_type: detail.inspection_type || '正常',
        object_type: detail.object_type || '成品检验',
        trigger_type: detail.trigger_type || '手工',
        report_order_no: detail.report_order_no || '',
        incoming_no: detail.incoming_no || '',
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
      const payload: any = {
        inspection_type: values.inspection_type,
        object_type: values.object_type,
        trigger_type: values.trigger_type || '手工',
        remarks: values.remarks || '',
        items: editItems,
      }
      // 根据 object_type 填入关联单号
      if (values.object_type === '成品检验') {
        payload.report_order_no = values.report_order_no || ''
        // 若后端接收 report_order_id，这里保留空值由后端关联
      } else if (values.object_type === '来料检验') {
        payload.incoming_no = values.incoming_no || ''
      }

      setFormLoading(true)
      if (drawerMode === 'create') {
        const res = await api.post('/basic/microbe-inspections', payload)
        if (res.success !== false) {
          message.success('创建成功')
          setFormVisible(false)
          fetchData()
        } else {
          message.error(res.message || '创建失败')
        }
      } else if (drawerMode === 'edit' && editRecord) {
        const res = await api.put(`/basic/microbe-inspections/${editRecord.inspection_id}`, payload)
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
  // 开始检验：待检 -> 检验中
  const handleStart = async (record: any) => {
    try {
      const res = await api.put(`/basic/microbe-inspections/${record.inspection_id}`, { status: STATUS_REVERSE['检验中'] })
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

  // 提交：检验中 -> 审核中（同时回填 items 与 result）
  const handleSubmit = async (record: any) => {
    try {
      // 先取详情以便带入 items 与 result 回写
      const detailRes = await api.get(`/basic/microbe-inspections/${record.inspection_id}`)
      const detail = detailRes.data || record
      const payload: any = {
        status: STATUS_REVERSE['审核中'],
        result: detail.result || record.result || '',
        items: detail.items || record.items || [],
      }
      const res = await api.put(`/basic/microbe-inspections/${record.inspection_id}`, payload)
      if (res.success !== false) {
        message.success('已提交审核')
        fetchData()
      } else {
        message.error(res.message || '操作失败')
      }
    } catch (e: any) {
      message.error(e?.message || '操作失败')
    }
  }

  // 审核通过：审核中 -> 已完成
  const handleApprove = async (record: any) => {
    try {
      const res = await api.put(`/basic/microbe-inspections/${record.inspection_id}`, { status: STATUS_REVERSE['已完成'] })
      if (res.success !== false) {
        message.success('审核通过')
        fetchData()
      } else {
        message.error(res.message || '操作失败')
      }
    } catch (e: any) {
      message.error(e?.message || '操作失败')
    }
  }

  // 驳回：审核中 -> 待检（默认触发加严检验由后端处理）
  const handleReject = async (record: any) => {
    try {
      const res = await api.put(`/basic/microbe-inspections/${record.inspection_id}`, {
        status: STATUS_REVERSE['待检'],
        inspection_type: '加严',
      })
      if (res.success !== false) {
        message.success('已驳回，已转为加严检验')
        fetchData()
      } else {
        message.error(res.message || '操作失败')
      }
    } catch (e: any) {
      message.error(e?.message || '操作失败')
    }
  }

  // 已完成 -> 处理（入库/判退/报废/让步接收）
  const handleOpenHandle = (record: any) => {
    setHandleRecord(record)
    setHandleType(undefined)
    setHandleRemark('')
    setHandleOpen(true)
  }

  const handleConfirm = async () => {
    if (!handleRecord) return
    if (!handleType) {
      message.warning('请选择处理方式')
      return
    }
    try {
      const res = await api.put(`/basic/microbe-inspections/${handleRecord.inspection_id}`, {
        handle_type: handleType,
        handle_remark: handleRemark,
        status: STATUS_REVERSE['已关闭'],
      })
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

  const columns = [
    { title: '检验编号', dataIndex: 'inspection_no', key: 'inspection_no', width: 150, fixed: 'left' as const },
    {
      title: '检验类型', dataIndex: 'inspection_type', key: 'inspection_type', width: 90,
      render: (v: string) => <Tag color={typeColor[v] || 'default'}>{v}</Tag>
    },
    {
      title: '检验对象', dataIndex: 'object_type', key: 'object_type', width: 100,
      render: (v: string) => <Tag color={objectColor[v] || 'default'}>{v}</Tag>
    },
    {
      title: '关联单号', key: 'related_no', width: 170,
      render: (_: any, record: any) => getRelatedNo(record)
    },
    { title: '料品名称', dataIndex: 'material_name', key: 'material_name', width: 160, ellipsis: true },
    {
      title: '检验结果', dataIndex: 'result', key: 'result', width: 90,
      render: (v: string) => v ? <Tag color={resultColor[v]}>{v}</Tag> : <Tag>待检</Tag>
    },
    { title: '检验人', dataIndex: 'inspector_name', key: 'inspector_name', width: 100 },
    { title: '检验时间', dataIndex: 'inspection_time', key: 'inspection_time', width: 160, render: formatDateTime },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (v: any) => <Tag color={statusColor[getStatusText(v)] || 'default'}>{getStatusText(v)}</Tag>
    },
    {
      title: '处理方式', dataIndex: 'handle_type', key: 'handle_type', width: 100,
      render: (v: string) => v ? <Tag color={handleColor[v] || 'default'}>{v}</Tag> : '-'
    },
    {
      title: '操作', key: 'action', fixed: 'right' as const, width: 260,
      render: (_: any, record: any) => {
        const status = getStatusText(record.status)
        return (
          <Space size={2} wrap>
            <Button type="link" size="small" onClick={() => showDetail(record)}>查看</Button>
            {status === '待检' && (
              <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
            )}
            {(status === '待检' || status === '检验中') && (
              <Button type="link" size="small" onClick={() => handleStart(record)}>开始检验</Button>
            )}
            {status === '检验中' && (
              <Button type="link" size="small" onClick={() => handleSubmit(record)}>提交审核</Button>
            )}
            {status === '审核中' && (
              <>
                <Popconfirm title="确认审核通过？" onConfirm={() => handleApprove(record)} okText="确认" cancelText="取消">
                  <Button type="link" size="small" style={{ color: '#52c41a' }}>审核通过</Button>
                </Popconfirm>
                <Popconfirm title="确认驳回？驳回后将转为加严检验" onConfirm={() => handleReject(record)} okText="确认" cancelText="取消">
                  <Button type="link" size="small" danger>驳回</Button>
                </Popconfirm>
              </>
            )}
            {status === '已完成' && (
              <Button type="link" size="small" onClick={() => handleOpenHandle(record)}>处理</Button>
            )}
          </Space>
        )
      }
    },
  ]

  const filterNode = (
    <Space wrap style={{ width: '100%' }} size={[8, 8]} align="center">
      <Input
        placeholder="检验编号"
        allowClear
        prefix={<SearchOutlined />}
        style={{ width: 150 }}
        value={inspectionNo}
        onChange={(e) => setInspectionNo(e.target.value || undefined)}
      />
      <Select
        placeholder="检验类型"
        allowClear
        style={{ width: 110 }}
        options={INSPECTION_TYPES}
        value={inspectionType}
        onChange={setInspectionType}
      />
      <Select
        placeholder="检验对象"
        allowClear
        style={{ width: 110 }}
        options={OBJECT_TYPES}
        value={objectType}
        onChange={setObjectType}
      />
      <Select
        placeholder="检验结果"
        allowClear
        style={{ width: 110 }}
        options={RESULT_OPTIONS}
        value={resultFilter}
        onChange={setResultFilter}
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
      <RangePicker
        style={{ width: 240 }}
        value={dateRange}
        onChange={handleRangeChange}
      />
      <Button type="primary" icon={<SearchOutlined />} onClick={fetchData}>查询</Button>
      <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
    </Space>
  )

  const relatedNoField = (
    <Form.Item
      noStyle
      shouldUpdate={(prev, cur) => prev.object_type !== cur.object_type}
    >
      {({ getFieldValue }) => {
        const objType = getFieldValue('object_type')
        if (objType === '来料检验') {
          return (
            <Form.Item label="来料单号" name="incoming_no">
              <Input placeholder="请输入来料单号" />
            </Form.Item>
          )
        }
        return (
          <Form.Item label="生产单号" name="report_order_no">
            <Input placeholder="请输入生产单号" />
          </Form.Item>
        )
      }}
    </Form.Item>
  )

  const actions = (
    <Space>
      <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建检验</Button>
      <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
    </Space>
  )

  return (
    <>
      <ThreeSectionPage
        title="微生物检验"
        breadcrumbs="质量管理 / 微生物检验"
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
              message="不合格处理流程：正常检验 → 不合格 → 加严检验(样本翻倍) → 仍不合格 → 判退/报废"
            />
            <ResizableTable tableKey="pages_quality_MicrobeInspection"
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
        title="微生物检验详情"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={900}
        destroyOnHidden
      >
        {current && (
          <div style={{ height: 'calc(100vh - 180px)', overflow: 'auto' }}>
            <InspectionItemEditor
              items={detailItems}
              disabled={true}
              showMaterialInfo={false}
            />
          </div>
        )}
      </Drawer>

      {/* 新建/编辑 Drawer */}
      <Drawer
        title={drawerMode === 'edit' ? '编辑微生物检验' : '新建微生物检验'}
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
        <Form form={form} layout="vertical" initialValues={{ inspection_type: '正常', object_type: '成品检验', trigger_type: '手工' }}>
          <Title level={5} style={{ marginBottom: 12 }}>基本信息</Title>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <Form.Item label="检验对象" name="object_type" rules={[{ required: true, message: '请选择检验对象' }]}>
              <Select options={OBJECT_TYPES} placeholder="请选择检验对象" disabled={drawerMode === 'edit'} />
            </Form.Item>
            <Form.Item label="检验类型" name="inspection_type" rules={[{ required: true, message: '请选择检验类型' }]}>
              <Select options={INSPECTION_TYPES} placeholder="请选择检验类型" disabled={drawerMode === 'edit'} />
            </Form.Item>
            <Form.Item label="触发方式" name="trigger_type">
              <Select options={[{ label: '手工', value: '手工' }, { label: '自动', value: '自动' }]} placeholder="请选择触发方式" />
            </Form.Item>
            {relatedNoField}
            <Form.Item label="备注" name="remarks">
              <Input.TextArea rows={1} placeholder="可填写备注" />
            </Form.Item>
          </div>

          <Title level={5} style={{ margin: '16px 0 12px' }}>检验项目</Title>
          <InspectionItemEditor
            items={editItems}
            disabled={false}
            onChange={(next) => setEditItems(next)}
            showMaterialInfo={false}
          />
        </Form>
      </Drawer>

      {/* 处理方式 Modal */}
      <Modal
        title="处理方式"
        open={handleOpen}
        onCancel={() => setHandleOpen(false)}
        onOk={handleConfirm}
      >
        {handleRecord && (
          <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="检验编号">{handleRecord.inspection_no}</Descriptions.Item>
            <Descriptions.Item label="检验结果">
              {handleRecord.result ? <Tag color={resultColor[handleRecord.result]}>{handleRecord.result}</Tag> : '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
        <Form layout="vertical">
          <Form.Item label="处理方式" required>
            <Select
              placeholder="请选择处理方式"
              options={HANDLE_OPTIONS}
              value={handleType}
              onChange={setHandleType}
            />
          </Form.Item>
          <Form.Item label="处理备注">
            <Input.TextArea rows={3} value={handleRemark} onChange={(e) => setHandleRemark(e.target.value)} placeholder="可填写处理说明" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
