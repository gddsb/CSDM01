import ResizableTable from '../../components/ResizableTable'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Table, Tag, Button, Select, DatePicker, Space, Row, Col, Modal, Form, Input, Drawer, Descriptions, Typography, Popconfirm, Table as AntTable, InputNumber } from 'antd'
import { useMessage } from '../../contexts/AppContext'
import {
  ExperimentOutlined, CheckCircleOutlined, CloseCircleOutlined, PercentageOutlined,
  PlusOutlined, ExportOutlined, ReloadOutlined, SearchOutlined, EyeOutlined,
  EditOutlined, SendOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import { formatDateTime } from '../../utils'
import api from '../../utils/api'

const { RangePicker } = DatePicker
const { Title } = Typography
const { TextArea } = Input

const INSPECTION_TYPES = [
  { label: '首件', value: '首件', color: 'blue' },
  { label: '制程', value: '制程', color: 'purple' },
  { label: '成品', value: '成品', color: 'green' },
  { label: '其它', value: '其它', color: 'default' },
]

const resultColor = { '合格': 'success', '不合格': 'error' }
const handleColor = { '入库': 'green', '退货': 'red', '让步接收': 'orange', '报废': 'red' }
const triggerColor = { '自动': 'blue', '手工': 'purple' }
const statusColor = { '待检': 'default', '检验中': 'processing', '审核中': 'warning', '已完成': 'success', '已关闭': 'default' }
const typeColorMap = Object.fromEntries(INSPECTION_TYPES.map(t => [t.value, t.color]))

const canEdit = (status: string) => status === '待检' || status === '检验中'
const canSubmit = (status: string) => status === '检验中'

export default function ProductInspection() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [reportOrders, setReportOrders] = useState<any[]>([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })

  const [inspectionType, setInspectionType] = useState<any>(undefined)
  const [reportOrderId, setReportOrderId] = useState<any>(undefined)
  const [resultFilter, setResultFilter] = useState<any>(undefined)
  const [statusFilter, setStatusFilter] = useState<any>(undefined)
  const [dateRange, setDateRange] = useState<any>(null)
  const [standards, setStandards] = useState<any[]>([])

  const [addVisible, setAddVisible] = useState(false)
  const [editVisible, setEditVisible] = useState(false)
  const [inspectDrawerOpen, setInspectDrawerOpen] = useState(false)
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [current, setCurrent] = useState<any>(null)
  const [inspectItems, setInspectItems] = useState<any[]>([])
  const [addForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const message = useMessage()

  const selectedWorkOrderId = Form.useWatch('report_order_id', addForm)
  const selectedWorkOrder = reportOrders.find(w => String(w.report_order_id) === String(selectedWorkOrderId))
  const editWorkOrderId = Form.useWatch('report_order_id', editForm)
  const editWorkOrder = reportOrders.find(w => String(w.report_order_id) === String(editWorkOrderId))

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { page: pagination.current, page_size: pagination.pageSize }
      if (inspectionType) params.inspection_type = inspectionType
      if (reportOrderId) params.report_order_id = reportOrderId
      if (resultFilter) params.result = resultFilter
      if (statusFilter) params.status = statusFilter
      if (dateRange && dateRange[0]) params.start_date = dateRange[0].format('YYYY-MM-DD')
      if (dateRange && dateRange[1]) params.end_date = dateRange[1].format('YYYY-MM-DD')

      const res = await api.get('/basic/product-inspections', { params })
      if (res.success !== false) {
        setData(res.data?.list || res.data || [])
        setPagination(p => ({ ...p, total: res.data?.total || res.total || 0 }))
      } else {
        setData([])
        setPagination(p => ({ ...p, total: 0 }))
      }
    } catch (e: any) {
      setData([])
      setPagination(p => ({ ...p, total: 0 }))
    } finally {
      setLoading(false)
    }
  }, [pagination.current, pagination.pageSize, inspectionType, reportOrderId, resultFilter, statusFilter, dateRange])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/production/report-orders', { params: { page: 1, page_size: 500 } })
        setReportOrders(res.data?.list || res.data || [])
      } catch (e) {
        // ignore
      }
    }
    load()
  }, [])

  useEffect(() => {
    const loadStandards = async () => {
      try {
        const res = await api.get('/basic/standards', { params: { page: 1, page_size: 500, status: '生效' } })
        const list = res.data?.list || res.data || []
        setStandards(list)
      } catch (e) {
        // ignore
      }
    }
    loadStandards()
  }, [])

  const totalCount = pagination.total
  const passCount = data.filter(i => i.result === '合格').length
  const failCount = data.filter(i => i.result === '不合格').length
  const passRate = totalCount > 0 ? ((passCount / totalCount) * 100).toFixed(1) : '0.0'
  const firstPieceCount = data.filter(i => i.inspection_type === '首件').length
  const processCount = data.filter(i => i.inspection_type === '制程').length
  const finishedCount = data.filter(i => i.inspection_type === '成品').length

  const stats = [
    { label: '检验总数', value: totalCount, icon: <ExperimentOutlined />, color: '#2196F3' },
    { label: '首件', value: firstPieceCount, icon: <ExperimentOutlined />, color: '#1890FF' },
    { label: '制程', value: processCount, icon: <ExperimentOutlined />, color: '#722ED1' },
    { label: '成品', value: finishedCount, icon: <ExperimentOutlined />, color: '#52C41A' },
    { label: '合格', value: passCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
    { label: '不合格', value: failCount, icon: <CloseCircleOutlined />, color: '#F44336' },
    { label: '合格率', value: `${passRate}%`, icon: <PercentageOutlined />, color: '#9C27B0' },
  ]

  const handleAdd = () => {
    addForm.resetFields()
    addForm.setFieldsValue({ inspection_type: '制程', trigger_type: '手工' })
    setAddVisible(true)
  }

  const handleAddSubmit = async () => {
    try {
      const values = await addForm.validateFields()
      const standard = standards.find(s => String(s.standard_id) === String(values.standard_id))
      const payload = {
        inspection_type: values.inspection_type,
        report_order_id: Number(values.report_order_id),
        standard_id: values.standard_id ? Number(values.standard_id) : null,
        standard_name: standard?.standard_name || '',
        trigger_type: '手工',
        remarks: values.remarks,
      }
      const res = await api.post('/basic/product-inspections', payload)
      if (res.success !== false) {
        message.success('检验记录已创建')
        setAddVisible(false)
        fetchData()
      } else {
        message.error(res.message || '创建失败')
      }
    } catch (e: any) {
      if (e?.message?.includes('validate')) return
      message.error(e?.message || '保存失败，请重试')
    }
  }

  const handleEdit = (record: any) => {
    setCurrent(record)
    editForm.setFieldsValue({
      inspection_type: record.inspection_type,
      report_order_id: record.report_order_id,
      standard_id: record.standard_id,
      remarks: record.remarks,
    })
    setEditVisible(true)
  }

  const handleEditSubmit = async () => {
    try {
      const values = await editForm.validateFields()
      const standard = standards.find(s => String(s.standard_id) === String(values.standard_id))
      const payload = {
        inspection_type: values.inspection_type,
        report_order_id: Number(values.report_order_id),
        standard_id: values.standard_id ? Number(values.standard_id) : null,
        standard_name: standard?.standard_name || '',
        remarks: values.remarks,
      }
      const res = await api.put(`/basic/product-inspections/${current.inspection_id}`, payload)
      if (res.success !== false) {
        message.success('修改成功')
        setEditVisible(false)
        fetchData()
      } else {
        message.error(res.message || '修改失败')
      }
    } catch (e: any) {
      if (e?.message?.includes('validate')) return
      message.error(e?.message || '保存失败，请重试')
    }
  }

  const openInspect = async (record: any) => {
    try {
      const res = await api.get(`/basic/product-inspections/${record.inspection_id}`)
      const detail = res.data || record
      setCurrent(detail)
      setInspectItems((detail.items || []).map((it: any, idx: number) => ({ ...it, sort_order: it.sort_order !== undefined ? it.sort_order : idx })))
      setInspectDrawerOpen(true)
    } catch (e) {
      setCurrent(record)
      setInspectDrawerOpen(true)
    }
  }

  const handleStart = async (record: any) => {
    try {
      const res = await api.put(`/basic/product-inspections/${record.inspection_id}/start`)
      if (res.success !== false) {
        message.success('已开检')
        fetchData()
      } else {
        message.error(res.message || '开检失败')
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message || '开检失败')
    }
  }

  const handleInspectSave = async () => {
    try {
      const payload = { items: inspectItems }
      await api.put(`/basic/product-inspections/${current.inspection_id}`, payload)
      message.success('检测项目已保存')
      setInspectDrawerOpen(false)
      fetchData()
    } catch (e: any) {
      // ignore
    }
  }

  const handleSubmit = async (record: any) => {
    try {
      await api.put(`/basic/product-inspections/${record.inspection_id}/submit`)
      message.success('已报审')
      fetchData()
    } catch (e: any) {
      message.error(e?.response?.data?.message || '报审失败')
    }
  }

  const handleDelete = async (record: any) => {
    try {
      const res = await api.delete(`/basic/product-inspections/${record.inspection_id}`)
      if (res.success !== false) {
        message.success('删除成功')
        fetchData()
      } else {
        message.error(res.message || '删除失败')
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message || '删除失败')
    }
  }

  const handleReview = async (result: '合格' | '不合格') => {
    try {
      const res = await api.put(`/basic/product-inspections/${current.inspection_id}/review`, { result })
      if (res.success !== false) {
        message.success(`审核${result}成功`)
        setDetailDrawerOpen(false)
        fetchData()
      } else {
        message.error(res.message || '审核失败')
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message || '审核失败')
    }
  }

  const showDetail = async (record: any) => {
    try {
      const res = await api.get(`/basic/product-inspections/${record.inspection_id}`)
      setCurrent(res.data || record)
      setDetailDrawerOpen(true)
    } catch (e) {
      setCurrent(record)
      setDetailDrawerOpen(true)
    }
  }

  const addItem = () => {
    setInspectItems(prev => [...prev, {
      item_id: 'new_' + Date.now(),
      item_name: '',
      category: '',
      standard_value: '',
      actual_value: '',
      result: null,
      inspector_name: '',
      inspection_time: null,
      sort_order: prev.length,
      _new: true,
    }])
  }

  const updateItem = useCallback((index: number, field: string, value: any) => {
    setInspectItems(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }, [])

  const removeItem = (index: number) => {
    setInspectItems(prev => prev.filter((_, i) => i !== index))
  }

  const columns = [
    { title: '检验编号', dataIndex: 'inspection_no', key: 'inspection_no', width: 60, fixed: 'left' },
    {
      title: '类型', dataIndex: 'inspection_type', key: 'inspection_type', width: 80,
      render: (v: string) => <Tag color={typeColorMap[v] || 'default'}>{v}</Tag>
    },
    { title: '工单编号', dataIndex: 'report_order_no', key: 'report_order_no', width: 160 },
    { title: '料号', dataIndex: 'material_code', key: 'material_code', width: 130 },
    { title: '产品名称', dataIndex: 'material_name', key: 'material_name', onCell: () => ({ style: { whiteSpace: 'normal', wordBreak: 'break-all', lineHeight: '22px' } }) },
    { title: '规格', dataIndex: 'specification', key: 'specification', width: 150 },
    {
      title: '结果', dataIndex: 'result', key: 'result', width: 80,
      render: (v: string) => v && v !== '-' ? <Tag color={resultColor[v as keyof typeof resultColor]}>{v}</Tag> : <Tag>待检</Tag>
    },
    {
      title: '触发方式', dataIndex: 'trigger_type', key: 'trigger_type', width: 90,
      render: (v: string) => v && v !== '-' ? <Tag color={triggerColor[v as keyof typeof triggerColor]}>{v}</Tag> : '-'
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (v: string) => <Tag color={statusColor[v as keyof typeof statusColor]}>{v}</Tag>
    },
    { title: '检验员', dataIndex: 'inspector_name', key: 'inspector_name', width: 100, render: (v: string) => v || '-' },
    { title: '检验时间', dataIndex: 'inspection_time', key: 'inspection_time', width: 160, render: formatDateTime },
    {
      title: '操作', key: 'action', fixed: 'right',
      render: (_: any, record: any) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={() => showDetail(record)}>详情</Button>
          {record.status === '待检' && (
            <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
          )}
          {record.status === '待检' && record.standard_id && (
            <Button type="link" size="small" onClick={() => handleStart(record)}>开检</Button>
          )}
          {record.status === '检验中' && (
            <Button type="link" size="small" onClick={() => openInspect(record)}>检测</Button>
          )}
          {canSubmit(record.status) && (
            <Popconfirm title="确认报审？报审后数据不可修改" onConfirm={() => handleSubmit(record)} okText="确认" cancelText="取消">
              <Button type="link" size="small">报审</Button>
            </Popconfirm>
          )}
          {record.status === '待检' && record.trigger_type === '手工' && (
            <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record)} okText="确认" cancelText="取消">
              <Button type="link" size="small" danger>删除</Button>
            </Popconfirm>
          )}
        </Space>
      )
    },
  ]

  const inspectColumns = useMemo(() => [
    { title: '序号', dataIndex: 'sort_order', key: 'sort_order', width: 50, render: (_: any, __: any, i: number) => i + 1 },
    {
      title: '项目分类', dataIndex: 'category', key: 'category', width: 80,
      render: (v: any) => v || '-',
    },
    {
      title: '检验项目', dataIndex: 'item_name', key: 'item_name', width: 140,
      render: (v: any) => v || '-',
    },
    {
      title: '标准要求', dataIndex: 'standard_value', key: 'standard_value', width: 160,
      render: (v: any) => (
        <div style={{ whiteSpace: 'normal', wordBreak: 'break-all', lineHeight: 1.5, padding: '4px 8px' }}>
          {v || '-'}
        </div>
      ),
    },
    {
      title: '检验结果', dataIndex: 'actual_value', key: 'actual_value', width: 100,
      render: (v: any, record: any, index: number) => (
        <Input
          key={`input-actual-${record.item_id || index}`}
          value={v}
          onChange={e => updateItem(index, 'actual_value', e.target.value)}
          placeholder="请输入检验结果"
        />
      ),
    },
    {
      title: '判定结论', dataIndex: 'result', key: 'result', width: 100,
      render: (v: any, record: any, index: number) => (
        <Select
          key={`select-result-${record.item_id || index}`}
          style={{ width: '100%' }}
          placeholder="请选择"
          allowClear
          value={v}
          onChange={val => updateItem(index, 'result', val)}
          options={[{ label: '合格', value: '合格' }, { label: '不合格', value: '不合格' }]}
        />
      ),
    },
  ], [updateItem])

  return (
    <>
      <ThreeSectionPage
        title="产品检测"
        breadcrumbs="质量管理 / 产品检测"
        stats={stats}
        actions={
          <>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增检验</Button>
            <Button icon={<ExportOutlined />}>导出</Button>
          </>
        }
        table={
          <div>
            <Row gutter={[12, 8]} style={{ marginBottom: 12 }}>
              <Col span={4}>
                <Select
                  placeholder="检验类型"
                  allowClear
                  style={{ width: '100%' }}
                  options={INSPECTION_TYPES}
                  value={inspectionType}
                  onChange={setInspectionType}
                />
              </Col>
              <Col span={5}>
                <Select
                  placeholder="选择报工单"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  style={{ width: '100%' }}
                  options={reportOrders.map(w => ({ label: `${w.report_no} (${w.material_name})`, value: w.report_order_id }))}
                  value={reportOrderId}
                  onChange={setReportOrderId}
                />
              </Col>
              <Col span={3}>
                <Select
                  placeholder="结果"
                  allowClear
                  style={{ width: '100%' }}
                  options={[{ label: '合格', value: '合格' }, { label: '不合格', value: '不合格' }]}
                  value={resultFilter}
                  onChange={setResultFilter}
                />
              </Col>
              <Col span={3}>
                <Select
                  placeholder="状态"
                  allowClear
                  style={{ width: '100%' }}
                  options={[
                    { label: '待检', value: '待检' },
                    { label: '检验中', value: '检验中' },
                    { label: '审核中', value: '审核中' },
                    { label: '已完成', value: '已完成' },
                  ]}
                  value={statusFilter}
                  onChange={setStatusFilter}
                />
              </Col>
              <Col span={5}>
                <RangePicker
                  style={{ width: '100%' }}
                  value={dateRange}
                  onChange={setDateRange}
                />
              </Col>
              <Col span={4}>
                <Space>
                  <Button type="primary" icon={<SearchOutlined />} onClick={fetchData}>查询</Button>
                  <Button icon={<ReloadOutlined />} onClick={() => {
                    setInspectionType(undefined); setReportOrderId(undefined)
                    setResultFilter(undefined); setStatusFilter(undefined); setDateRange(null)
                  }}>重置</Button>
                </Space>
              </Col>
            </Row>
            <ResizableTable
              tableKey="pages_quality_ProductInspection"
              columns={columns}
              dataSource={data}
              rowKey="inspection_id"
              size="small"
              loading={loading}
              scroll={{ x: 1800 }}
              pagination={{
                ...pagination,
                showSizeChanger: true,
                showTotal: t => `共 ${t} 条`,
                onChange: (p, ps) => setPagination(v => ({ ...v, current: p, pageSize: ps })),
              }}
            />
          </div>
        }
      />

      <Modal
        title="新增产品检测"
        open={addVisible}
        onOk={handleAddSubmit}
        onCancel={() => setAddVisible(false)}
        okText="保存"
        cancelText="取消"
        width={640}
        destroyOnHidden
      >
        <Form form={addForm} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="inspection_type" label="检验类型" rules={[{ required: true, message: '请选择检验类型' }]}>
                <Select placeholder="请选择检验类型" options={INSPECTION_TYPES} />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item name="report_order_id" label="关联报工单" rules={[{ required: true, message: '请选择报工单' }]}>
                <Select
                  placeholder="请选择报工单"
                  showSearch
                  optionFilterProp="label"
                  options={reportOrders.map(w => ({ label: `${w.report_no} (${w.material_name})`, value: w.report_order_id }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="料号">
                <Input value={selectedWorkOrder?.material_code || '-'} disabled />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="规格">
                <Input value={selectedWorkOrder?.specification || selectedWorkOrder?.spec || '-'} disabled />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="trigger_type" label="触发方式">
                <Select
                  disabled
                  value="手工"
                  options={[{ label: '手工', value: '手工' }]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={24}>
              <Form.Item label="产品名称">
                <Input value={selectedWorkOrder?.material_name || '-'} disabled />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={24}>
              <Form.Item name="standard_id" label="检验标准">
                <Select
                  placeholder="请选择检验标准"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={standards.map(s => ({
                    label: `${s.standard_no || ''} ${s.standard_name || ''}`.trim(),
                    value: s.standard_id,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remarks" label="备注">
            <TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑产品检测"
        open={editVisible}
        onOk={handleEditSubmit}
        onCancel={() => setEditVisible(false)}
        okText="保存"
        cancelText="取消"
        width={640}
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="inspection_type" label="检验类型" rules={[{ required: true, message: '请选择检验类型' }]}>
                <Select placeholder="请选择检验类型" options={INSPECTION_TYPES} />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item name="report_order_id" label="关联报工单" rules={[{ required: true, message: '请选择报工单' }]}>
                <Select
                  placeholder="请选择报工单"
                  showSearch
                  optionFilterProp="label"
                  options={reportOrders.map(w => ({ label: `${w.report_no} (${w.material_name})`, value: w.report_order_id }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="料号">
                <Input value={editWorkOrder?.material_code || '-'} disabled />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="规格">
                <Input value={editWorkOrder?.specification || editWorkOrder?.spec || '-'} disabled />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="触发方式">
                <Select disabled value="手工" options={[{ label: '手工', value: '手工' }]} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={24}>
              <Form.Item label="产品名称">
                <Input value={editWorkOrder?.material_name || '-'} disabled />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={24}>
              <Form.Item name="standard_id" label="检验标准">
                <Select
                  placeholder="请选择检验标准"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={standards.map(s => ({
                    label: `${s.standard_no || ''} ${s.standard_name || ''}`.trim(),
                    value: s.standard_id,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remarks" label="备注">
            <TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={current ? `产品检验 - ${current.inspection_no}` : '产品检验'}
        open={inspectDrawerOpen}
        onClose={() => setInspectDrawerOpen(false)}
        width={1100}
        destroyOnHidden
        extra={
          <Space>
            <Button onClick={() => setInspectDrawerOpen(false)}>取消</Button>
            <Button type="primary" onClick={handleInspectSave}>保存</Button>
          </Space>
        }
      >
        <AntTable
          columns={inspectColumns}
          dataSource={inspectItems}
          rowKey={(r: any, i: number) => r.item_id || `row-${i}`}
          size="small"
          pagination={false}
        />
      </Drawer>

      <Drawer
        title={current ? `检验详情 - ${current.inspection_no}` : '检验详情'}
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        width={900}
        destroyOnHidden
        extra={
          current?.status === '审核中' ? (
            <Space>
              <Popconfirm title="确认审核通过？" onConfirm={() => handleReview('合格')} okText="确认" cancelText="取消">
                <Button type="primary">审核通过</Button>
              </Popconfirm>
              <Popconfirm title="确认审核不通过？" onConfirm={() => handleReview('不合格')} okText="确认" cancelText="取消">
                <Button danger>审核不通过</Button>
              </Popconfirm>
            </Space>
          ) : null
        }
      >
        {current && (
          <>
            <Descriptions column={4} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="检验编号">{current.inspection_no}</Descriptions.Item>
              <Descriptions.Item label="检验类型">
                <Tag color={typeColorMap[current.inspection_type]}>{current.inspection_type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="触发方式">
                {current.trigger_type ? <Tag color={triggerColor[current.trigger_type as keyof typeof triggerColor]}>{current.trigger_type}</Tag> : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColor[current.status as keyof typeof statusColor]}>{current.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="报工单号">{current.report_order_no}</Descriptions.Item>
              <Descriptions.Item label="料号">{current.material_code}</Descriptions.Item>
              <Descriptions.Item label="规格">{current.specification || '-'}</Descriptions.Item>
              <Descriptions.Item label="总结果">
                {current.result && current.result !== '-' ? <Tag color={resultColor[current.result as keyof typeof resultColor]}>{current.result}</Tag> : <Tag>待检</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="产品名称" span={2}>{current.material_name}</Descriptions.Item>
              <Descriptions.Item label="检验标准" span={2}>{current.standard_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="检验员">{current.inspector_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="检验时间">{formatDateTime(current.inspection_time)}</Descriptions.Item>
              <Descriptions.Item label="审核人">{current.reviewer_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="审核时间">{formatDateTime(current.review_time)}</Descriptions.Item>
            </Descriptions>

            <Title level={5} style={{ marginTop: 8 }}>检测项目</Title>
            <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 420px)' }}>
              <AntTable
                size="small"
                dataSource={current.items || []}
                rowKey={(r: any, i: number) => r.item_id || i}
                pagination={false}
                tableLayout="auto"
                columns={[
                  { title: '序号', width: 60, render: (_: any, __: any, i: number) => i + 1 },
                  { title: '检测项目', dataIndex: 'item_name' },
                  { title: '标准要求', dataIndex: 'standard_value' },
                  { title: '检测值', dataIndex: 'actual_value' },
                  {
                    title: '判定', dataIndex: 'result', width: 100,
                    render: (v: any) => v !== null && v !== undefined ? (
                      <Tag color={v === '合格' || v === 1 ? 'success' : 'error'}>
                        {typeof v === 'number' ? (v === 1 ? '合格' : '不合格') : v}
                      </Tag>
                    ) : '-'
                  },
                ]}
              />
            </div>
          </>
        )}
      </Drawer>
    </>
  )
}
