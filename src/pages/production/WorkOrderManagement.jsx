import React, { useState, useEffect, useCallback } from 'react'
import { Table, Tag, Button, Modal, Form, InputNumber, DatePicker, Input, Space, Row, Col, Select, message, Drawer, Descriptions, Popconfirm } from 'antd'

const { RangePicker } = DatePicker
import {
  ToolOutlined, SearchOutlined, ReloadOutlined,
  PlayCircleOutlined, CheckCircleOutlined, ClockCircleOutlined,
  PlusOutlined, EyeOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import api from '../../utils/api'

const statusColorMap = {
  '开立': 'default',
  '开工': 'processing',
  '完工': 'success',
}

const statusOptions = [
  { label: '开立', value: '开立' },
  { label: '开工', value: '开工' },
  { label: '完工', value: '完工' },
]

export default function WorkOrderManagement() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [orders, setOrders] = useState([])
  const [lines, setLines] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [currentWO, setCurrentWO] = useState(null)
  const [form] = Form.useForm()

  // 筛选输入态
  const [keywordInput, setKeywordInput] = useState('')
  const [statusInput, setStatusInput] = useState(undefined)
  const [lineInput, setLineInput] = useState(undefined)
  // 已应用的查询条件
  const [query, setQuery] = useState({ page: 1, pageSize: 30, keyword: '', status: undefined, line_id: undefined })

  // 获取工单列表
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const params = { page: query.page, pageSize: query.pageSize }
        if (query.keyword) params.keyword = query.keyword
        if (query.status) params.status = query.status
        if (query.line_id) params.line_id = query.line_id
        const res = await api.get('/production/work-orders', { params })
        if (cancelled) return
        const list = res.data || []
        setData(list)
        setTotal(res.total || list.length)
      } catch (err) {
        if (!cancelled) {
          message.error(err.message || '获取工单列表失败')
          setData([])
          setTotal(0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [query])

  // 获取关联订单与产线
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const [ordersRes, linesRes] = await Promise.all([
          api.get('/production/orders', { params: { page: 1, pageSize: 1000 } }),
          api.get('/basic/production-lines', { params: { page: 1, pageSize: 1000 } }),
        ])
        if (cancelled) return
        setOrders(ordersRes.data || [])
        setLines(linesRes.data || [])
      } catch (err) {
        if (!cancelled) message.error(err.message || '获取关联数据失败')
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  const refresh = useCallback(() => setQuery(q => ({ ...q })), [])

  const lineOptions = lines.map(l => ({ label: l.line_name, value: l.line_id }))
  // 仅下发订单可被关联到新工单
  const releasedOrders = orders.filter(o => o.status === '下发' || o.status === 1)
  const orderOptions = releasedOrders
    .map(o => ({
      label: `${o.order_no} (${o.material_name || '-'})`,
      value: o.order_id,
      material_code: o.material_code || '',
      material_name: o.material_name || '',
      order_no: o.order_no || '',
    }))

  const filterOrderOption = (input, option) => {
    const search = input.toLowerCase()
    return (
      (option.material_code || '').toLowerCase().includes(search) ||
      (option.material_name || '').toLowerCase().includes(search) ||
      (option.order_no || '').toLowerCase().includes(search)
    )
  }

  // 监听当前选择的订单
  const selectedOrderId = Form.useWatch('order_id', form)
  const selectedOrder = orders.find(o => o.order_id === selectedOrderId) ||
    releasedOrders.find(o => o.order_id === selectedOrderId)

  const openCount = data.filter(w => w.status === '开立').length
  const startedCount = data.filter(w => w.status === '开工').length
  const finishedCount = data.filter(w => w.status === '完工').length

  const stats = [
    { label: '总工单数', value: total, icon: <ToolOutlined />, color: '#2196F3' },
    { label: '开立', value: openCount, icon: <ClockCircleOutlined />, color: '#9E9E9E' },
    { label: '开工', value: startedCount, icon: <PlayCircleOutlined />, color: '#FF9800' },
    { label: '完工', value: finishedCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
  ]

  const handleStart = (w) => {
    Modal.confirm({
      title: '确认开工',
      content: `确认开工工单 ${w.work_order_no}？开工后不可修改和删除`,
      okText: '确认开工',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await api.post(`/production/work-orders/${w.work_order_id}/start`)
          message.success(res.message || `工单 ${w.work_order_no} 已开工`)
          refresh()
        } catch (err) {
          message.error(err.message || '开工失败')
        }
      },
    })
  }

  const handleFinish = (w) => {
    Modal.confirm({
      title: '确认完工',
      content: `确认完工工单 ${w.work_order_no}？完工后将不可修改`,
      okText: '确认完工',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await api.post(`/production/work-orders/${w.work_order_id}/finish`)
          message.success(res.message || `工单 ${w.work_order_no} 已完工`)
          refresh()
        } catch (err) {
          message.error(err.message || '完工失败')
        }
      },
    })
  }

  const handleDelete = (w) => {
    Modal.confirm({
      title: '确认删除',
      content: `确认删除工单 ${w.work_order_no}？此操作不可恢复`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await api.delete(`/production/work-orders/${w.work_order_id}`)
          message.success(res.message || '工单已删除')
          refresh()
        } catch (err) {
          message.error(err.message || '删除失败')
        }
      },
    })
  }

  const handleAdd = () => {
    setEditing(null)
    form.resetFields()
    setAddOpen(true)
  }

  // 编辑：仅开立的工单可编辑
  const handleEdit = (w) => {
    setEditing(w)
    form.setFieldsValue({
      order_id: w.order_id,
      line_id: w.line_id,
      planned_qty: w.planned_qty,
      plan_date_range: [
        w.plan_start_time ? dayjs(w.plan_start_time) : undefined,
        w.plan_end_time ? dayjs(w.plan_end_time) : undefined,
      ],
    })
    setAddOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const payload = {
        order_id: values.order_id,
        line_id: values.line_id,
        planned_qty: values.planned_qty,
        plan_start_time: values.plan_date_range?.[0] ? values.plan_date_range[0].format('YYYY-MM-DD') : undefined,
        plan_end_time: values.plan_date_range?.[1] ? values.plan_date_range[1].format('YYYY-MM-DD') : undefined,
      }
      if (editing) {
        const res = await api.put(`/production/work-orders/${editing.work_order_id}`, payload)
        message.success(res.message || '工单已更新')
      } else {
        const res = await api.post('/production/work-orders', payload)
        message.success(res.message || '工单已创建')
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

  const handleView = (w) => {
    setCurrentWO(w)
    setDetailOpen(true)
  }

  const handleSearch = () => {
    setQuery(q => ({ ...q, page: 1, keyword: keywordInput, status: statusInput, line_id: lineInput }))
  }

  const handleReset = () => {
    setKeywordInput('')
    setStatusInput(undefined)
    setLineInput(undefined)
    setQuery(q => ({ ...q, page: 1, keyword: '', status: undefined, line_id: undefined }))
  }

  const renderActions = (w) => {
    if (w.status === '开立') {
      return (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleEdit(w)}>编辑</Button>
          <Button type="link" size="small" onClick={() => handleStart(w)}>开工</Button>
          <Popconfirm
            title={`确认删除工单 ${w.work_order_no}？`}
            onConfirm={() => handleDelete(w)}
            okText="删除"
            cancelText="取消"
          >
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(w)}>详情</Button>
        </Space>
      )
    }
    if (w.status === '开工') {
      return (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleFinish(w)}>完工</Button>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(w)}>详情</Button>
        </Space>
      )
    }
    // 完工状态仅可查看详情
    return <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(w)}>详情</Button>
  }

  const columns = [
    { title: '工单编号', dataIndex: 'work_order_no', key: 'work_order_no', width: 150, fixed: 'left' },
    { title: '关联订单', dataIndex: 'order_no', key: 'order_no', width: 150, fixed: 'left' },
    { title: '产线', dataIndex: 'line_name', key: 'line_name', width: 100 },
    { title: '计划数量', dataIndex: 'planned_qty', key: 'planned_qty', width: 100, align: 'right', render: v => Math.round(v || 0).toLocaleString() },
    { title: '开工数量', dataIndex: 'start_qty', key: 'start_qty', width: 100, align: 'right', render: v => Math.round(v || 0).toLocaleString() },
    {
      title: '合格数量', key: 'qualified_qty', width: 130, align: 'right',
      render: (_, w) => {
        const qty = Number(w.qualified_qty || 0)
        const start = Number(w.start_qty || 0)
        const rate = start > 0 ? ((qty / start) * 100).toFixed(1) + '%' : '-'
        return <div>{Math.round(qty).toLocaleString()}<span style={{ color: '#999', fontSize: 12, marginLeft: 4 }}>{rate}</span></div>
      },
    },
    {
      title: '来料不良', key: 'defect_material', width: 130, align: 'right',
      render: (_, w) => {
        const qty = Number(w.defect_material || 0)
        const start = Number(w.start_qty || 0)
        const rate = start > 0 ? ((qty / start) * 100).toFixed(1) + '%' : '-'
        return <div>{Math.round(qty).toLocaleString()}<span style={{ color: '#FA8C16', fontSize: 12, marginLeft: 4 }}>{rate}</span></div>
      },
    },
    {
      title: '制程不良', key: 'defect_process', width: 130, align: 'right',
      render: (_, w) => {
        const qty = Number(w.defect_process || 0)
        const start = Number(w.start_qty || 0)
        const rate = start > 0 ? ((qty / start) * 100).toFixed(1) + '%' : '-'
        return <div>{Math.round(qty).toLocaleString()}<span style={{ color: '#F5222D', fontSize: 12, marginLeft: 4 }}>{rate}</span></div>
      },
    },
    { title: '检验报废', dataIndex: 'defect_scrap', key: 'defect_scrap', width: 100, align: 'right', render: v => Math.round(v || 0).toLocaleString() },
    { title: '人工工时', dataIndex: 'labor_hours', key: 'labor_hours', width: 100, align: 'right', render: v => Number(v || 0).toFixed(2) },
    {
      title: '开工时间', dataIndex: 'start_time', key: 'start_time', width: 160,
      render: v => v ? String(v).substring(0, 16).replace('T', ' ') : '-',
    },
    {
      title: '完工时间', dataIndex: 'finish_time', key: 'finish_time', width: 160,
      render: v => v ? String(v).substring(0, 16).replace('T', ' ') : '-',
    },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, align: 'center', render: v => <Tag color={statusColorMap[v]}>{v}</Tag> },
    { title: '操作', key: 'action', width: 180, fixed: 'right', render: (_, r) => renderActions(r) },
  ]

  return (
    <>
      <ThreeSectionPage
        title="工单管理"
        breadcrumbs="生产管理 / 工单管理"
        stats={stats}
        actions={
          <ActionButtons
            hasAdd={false}
            hasExport={false}
            extra={[
              <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增工单</Button>,
            ]}
          />
        }
        table={
          <div>
            <Row gutter={[12, 8]} style={{ marginBottom: 12 }} align="middle">
              <Col flex="180px">
                <Input
                  placeholder="工单号搜索"
                  allowClear
                  prefix={<SearchOutlined />}
                  value={keywordInput}
                  onChange={e => setKeywordInput(e.target.value)}
                  onPressEnter={handleSearch}
                />
              </Col>
              <Col flex="140px">
                <Select
                  placeholder="状态筛选"
                  allowClear
                  style={{ width: '100%' }}
                  options={statusOptions}
                  value={statusInput}
                  onChange={setStatusInput}
                />
              </Col>
              <Col flex="140px">
                <Select
                  placeholder="产线筛选"
                  allowClear
                  style={{ width: '100%' }}
                  options={lineOptions}
                  value={lineInput}
                  onChange={setLineInput}
                />
              </Col>
              <Col>
                <Space>
                  <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>查询</Button>
                  <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
                </Space>
              </Col>
            </Row>
            <Table
              columns={columns}
              dataSource={data}
              rowKey="work_order_id"
              size="small"
              loading={loading}
              scroll={{ x: 2000 }}
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
        title={editing ? '编辑工单' : '新增工单'}
        open={addOpen}
        onOk={handleSubmit}
        confirmLoading={submitting}
        onCancel={() => setAddOpen(false)}
        okText="保存"
        cancelText="取消"
        width={560}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          className="compact-form"
          preserve={false}
          onValuesChange={(changed) => {
            if ('order_id' in changed) {
              const order = orders.find(o => o.order_id === changed.order_id)
              if (order) {
                form.setFieldValue('planned_qty', order.planned_qty)
              }
            }
          }}
        >
          <Row gutter={12}>
            <Col span={24}>
              <Form.Item label="关联生产订单" name="order_id" rules={[{ required: true, message: '请选择关联生产订单' }]}>
                <Select
                  showSearch
                  placeholder="输入订单号或料号搜索"
                  optionFilterProp="label"
                  filterOption={filterOrderOption}
                  options={orderOptions}
                  disabled={!!editing}
                  notFoundContent="暂无符合条件的下发订单"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="料号">
                <Input value={selectedOrder?.material_code || '-'} disabled />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="产品名称">
                <Input value={selectedOrder?.material_name || '-'} disabled />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="菲林编号">
                <Input value={selectedOrder?.film_version || '-'} disabled />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="版本号">
                <Input value={selectedOrder?.version_no || '-'} disabled />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                label={
                  <span>
                    计划数量
                    {selectedOrder && (
                      <span style={{ color: 'var(--color-accent)', fontSize: 12, fontWeight: 500, marginLeft: '2em' }}>
                        未生产数量：{Math.max(0, (Number(selectedOrder.planned_qty) || 0) - (Number(selectedOrder.finished_qty) || 0)).toLocaleString()}
                      </span>
                    )}
                  </span>
                }
                name="planned_qty"
                rules={[{ required: true, message: '请输入计划数量' }]}
              >
                <InputNumber min={1} style={{ width: '100%' }} placeholder="请输入计划数量" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="产线" name="line_id" rules={[{ required: true, message: '请选择产线' }]}>
                <Select
                  placeholder="请选择产线"
                  options={lineOptions}
                  disabled={!!editing}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={24}>
              <Form.Item label="计划日期区间" name="plan_date_range" rules={[{ required: true, message: '请选择计划日期区间' }]}>
                <RangePicker
                  format="YYYY-MM-DD"
                  style={{ width: '100%' }}
                  placeholder={['计划开始日期', '计划结束日期']}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={24}>
              <Form.Item label="备注" name="remarks">
                <Input.TextArea rows={2} placeholder="请输入备注" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Drawer
        title="工单详情"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width="40%"
      >
        {currentWO && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="工单编号">{currentWO.work_order_no}</Descriptions.Item>
            <Descriptions.Item label="关联订单">{currentWO.order_no}</Descriptions.Item>
            <Descriptions.Item label="产线">{currentWO.line_name}</Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color={statusColorMap[currentWO.status]}>{currentWO.status}</Tag></Descriptions.Item>
            <Descriptions.Item label="计划数量">{Math.round(currentWO.planned_qty || 0).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="开工数量">{Math.round(currentWO.start_qty || 0).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="合格数量">{Math.round(currentWO.qualified_qty || 0).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="检验报废">{Math.round(currentWO.defect_scrap || 0).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="来料不良">{Math.round(currentWO.defect_material || 0).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="制程不良">{Math.round(currentWO.defect_process || 0).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="人工工时">{Number(currentWO.labor_hours || 0).toFixed(2)} h</Descriptions.Item>
            <Descriptions.Item label="完工数量">{Math.round(currentWO.finished_qty || 0).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="开工时间">{currentWO.start_time ? String(currentWO.start_time).substring(0, 16).replace('T', ' ') : '-'}</Descriptions.Item>
            <Descriptions.Item label="完工时间">{currentWO.finish_time ? String(currentWO.finish_time).substring(0, 16).replace('T', ' ') : '-'}</Descriptions.Item>
            <Descriptions.Item label="计划开始">{currentWO.plan_start_time || '-'}</Descriptions.Item>
            <Descriptions.Item label="计划结束">{currentWO.plan_end_time || '-'}</Descriptions.Item>
            <Descriptions.Item label="备注" span={2}>{currentWO.remarks || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </>
  )
}
