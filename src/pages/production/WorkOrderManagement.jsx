import React, { useState, useEffect, useCallback } from 'react'
import { Table, Tag, Button, Modal, Form, InputNumber, DatePicker, Input, Space, Row, Col, Select, message, Drawer, Descriptions, Popconfirm } from 'antd'
import {
  ToolOutlined, SearchOutlined, ReloadOutlined,
  PlayCircleOutlined, CheckCircleOutlined, ClockCircleOutlined,
  PlusOutlined, EyeOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ThreeSectionPage, { ActionButtons, getQuickFilterRange } from '../../components/ThreeSectionPage'
import api from '../../utils/api'

const statusColorMap = {
  '开立': 'default',
  '开工': 'processing',
  '关闭': 'warning',
  '完工': 'success',
}

const statusOptions = [
  { label: '开立', value: '开立' },
  { label: '开工', value: '开工' },
  { label: '关闭', value: '关闭' },
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
  const [query, setQuery] = useState(() => {
    const { dateStart, dateEnd } = getQuickFilterRange('month')
    return { page: 1, pageSize: 30, keyword: '', status: undefined, line_id: undefined, dateStart, dateEnd }
  })

  // 快速筛选变化时，更新日期范围并重置分页
  const handleQuickFilterChange = (val) => {
    const { dateStart, dateEnd } = getQuickFilterRange(val)
    setQuery(q => ({ ...q, page: 1, dateStart, dateEnd }))
  }

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
        if (query.dateStart) params.dateStart = query.dateStart
        if (query.dateEnd) params.dateEnd = query.dateEnd
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
  // 仅已下达订单可被关联到新工单
  const orderOptions = orders
    .filter(o => o.status === '已下达')
    .map(o => ({ label: `${o.order_no} (${o.material_name || '-'})`, value: o.order_id }))

  // 监听当前选择的订单
  const selectedOrderId = Form.useWatch('order_id', form)
  const selectedOrder = orders.find(o => o.order_id === selectedOrderId)

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

  const handleClose = (w) => {
    Modal.confirm({
      title: '确认关闭',
      content: `确认关闭工单 ${w.work_order_no}？关闭后仍可执行完工操作`,
      okText: '确认关闭',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await api.post(`/production/work-orders/${w.work_order_id}/close`)
          message.success(res.message || '工单已关闭')
          refresh()
        } catch (err) {
          message.error(err.message || '关闭失败')
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
      plan_start_time: w.plan_start_time ? dayjs(w.plan_start_time) : undefined,
      plan_end_time: w.plan_end_time ? dayjs(w.plan_end_time) : undefined,
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
        plan_start_time: values.plan_start_time ? values.plan_start_time.format('YYYY-MM-DD HH:mm') : undefined,
        plan_end_time: values.plan_end_time ? values.plan_end_time.format('YYYY-MM-DD HH:mm') : undefined,
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
        </Space>
      )
    }
    if (w.status === '开工') {
      return (
        <Space size="small">
          <Button type="link" size="small" danger onClick={() => handleClose(w)}>关闭</Button>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(w)}>查看</Button>
        </Space>
      )
    }
    if (w.status === '关闭') {
      return (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleFinish(w)}>完工</Button>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(w)}>查看</Button>
        </Space>
      )
    }
    return <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(w)}>查看</Button>
  }

  const columns = [
    { title: '工单编号', dataIndex: 'work_order_no', key: 'work_order_no', width: 150, fixed: 'left' },
    { title: '关联订单', dataIndex: 'order_no', key: 'order_no', width: 150, fixed: 'left' },
    { title: '工序', dataIndex: 'process_name', key: 'process_name', width: 100, render: v => v || '-' },
    { title: '产线', dataIndex: 'line_name', key: 'line_name', width: 80 },
    { title: '计划数量', dataIndex: 'planned_qty', key: 'planned_qty', width: 100, align: 'right', render: v => (v || 0).toLocaleString() },
    { title: '完工数量', dataIndex: 'finished_qty', key: 'finished_qty', width: 100, align: 'right', render: v => (v || 0).toLocaleString() },
    {
      title: '计划时间', key: 'plan_time', width: 200,
      render: (_, w) => (
        <div style={{ lineHeight: 1.6, fontSize: 12 }}>
          <div>开始：{w.plan_start_time || '-'}</div>
          <div>结束：{w.plan_end_time || '-'}</div>
        </div>
      ),
    },
    { title: '班组长', dataIndex: 'team_leader', key: 'team_leader', width: 100, render: v => v || '-' },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, align: 'center', render: v => <Tag color={statusColorMap[v]}>{v}</Tag> },
    { title: '操作', key: 'action', width: 180, fixed: 'right', render: (_, r) => renderActions(r) },
  ]

  return (
    <>
      <ThreeSectionPage
        title="工单管理"
        breadcrumbs="生产管理 / 工单管理"
        stats={stats}
        onQuickFilterChange={handleQuickFilterChange}
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
              scroll={{ x: 1300 }}
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
                  placeholder="请选择关联生产订单"
                  options={orderOptions}
                  disabled={!!editing}
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
              <Form.Item label="计划数量" name="planned_qty" rules={[{ required: true, message: '请输入计划数量' }]}>
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
            <Col span={12}>
              <Form.Item label="计划开始时间" name="plan_start_time" rules={[{ required: true, message: '请选择计划开始时间' }]}>
                <DatePicker
                  showTime={{ minuteStep: 10 }}
                  format="YYYY-MM-DD HH:mm"
                  style={{ width: '100%' }}
                  placeholder="请选择计划开始时间"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="计划结束时间" name="plan_end_time" rules={[{ required: true, message: '请选择计划结束时间' }]}>
                <DatePicker
                  showTime={{ minuteStep: 10 }}
                  format="YYYY-MM-DD HH:mm"
                  style={{ width: '100%' }}
                  placeholder="请选择计划结束时间"
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={24}>
              <Form.Item label="班组长" name="team_leader">
                <Input placeholder="请输入班组长姓名" />
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
            <Descriptions.Item label="工序">{currentWO.process_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="产线">{currentWO.line_name}</Descriptions.Item>
            <Descriptions.Item label="计划数量">{(currentWO.planned_qty || 0).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="完工数量">{(currentWO.finished_qty || 0).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color={statusColorMap[currentWO.status]}>{currentWO.status}</Tag></Descriptions.Item>
            <Descriptions.Item label="班组长">{currentWO.team_leader || '-'}</Descriptions.Item>
            <Descriptions.Item label="计划开始">{currentWO.plan_start_time || '-'}</Descriptions.Item>
            <Descriptions.Item label="计划结束">{currentWO.plan_end_time || '-'}</Descriptions.Item>
            <Descriptions.Item label="备注" span={2}>{currentWO.remarks || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </>
  )
}
