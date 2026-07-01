import React, { useState } from 'react'
import { Table, Tag, Button, Modal, Form, InputNumber, DatePicker, Input, Space, Row, Col, Select, Alert, List, message, Drawer, Descriptions } from 'antd'
import {
  ToolOutlined, ExportOutlined, SearchOutlined, ReloadOutlined,
  PlayCircleOutlined, CheckCircleOutlined, ClockCircleOutlined, StopOutlined,
  CheckCircleFilled, CloseCircleFilled, EditOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import {
  workOrders, orders, productionLines,
  manpowerRecords, processReports, exceptionRecords
} from '../../mock/data'

// 工时按0.5小时取值（四舍五入到最近的0.5）
const roundHalf = (hours) => Math.round(hours * 2) / 2

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

const lineOptions = productionLines.map(l => ({ label: l.line_name, value: l.line_id }))

// 关联生产订单可选项：仅订单状态为"已下达"的订单，显示 订单编号 + 料品名称
const orderOptions = orders
  .filter(o => o.status === '已下达')
  .map(o => ({ label: `${o.order_no} (${o.material_name})`, value: o.order_id }))

export default function WorkOrderManagement() {
  const [data, setData] = useState(workOrders)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(undefined)
  const [lineId, setLineId] = useState(undefined)
  const [finishOpen, setFinishOpen] = useState(false)
  const [finishTarget, setFinishTarget] = useState(null)
  const [finishTime, setFinishTime] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [currentWO, setCurrentWO] = useState(null)
  const [form] = Form.useForm()

  // 监听当前选择的订单，用于自动展示料品名称
  const selectedOrderId = Form.useWatch('order_id', form)
  const selectedOrder = orders.find(o => o.order_id === selectedOrderId)

  const filtered = data.filter(w => {
    const matchSearch = !search || w.work_order_no.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !status || w.status === status
    const matchLine = !lineId || w.line_id === lineId
    return matchSearch && matchStatus && matchLine
  })

  const stats = [
    { label: '总工单数', value: data.length, icon: <ToolOutlined />, color: '#2196F3' },
    { label: '开立', value: data.filter(w => w.status === '开立').length, icon: <ClockCircleOutlined />, color: '#9E9E9E' },
    { label: '开工', value: data.filter(w => w.status === '开工').length, icon: <PlayCircleOutlined />, color: '#FF9800' },
    { label: '完工', value: data.filter(w => w.status === '完工').length, icon: <CheckCircleOutlined />, color: '#4CAF50' },
  ]

  // 完工约束条件检查
  const computeChecks = (w, ft) => {
    if (!w) return []
    const start = dayjs(w.start_time)
    const now = dayjs()
    const hasManpower = manpowerRecords.some(m => m.work_order_id === w.work_order_id)
    const hasFirstReport = processReports.some(r => r.work_order_id === w.work_order_id && r.process_id === 'p1')
    const ftDayjs = ft ? dayjs(ft) : null
    const excs = exceptionRecords.filter(e => e.work_order_id === w.work_order_id)
    const maxExcEnd = excs.length ? Math.max(...excs.map(e => dayjs(e.end_time).valueOf())) : null
    return [
      { key: 'manpower', label: '人员投入必填（已登记人员投入记录）', pass: hasManpower },
      { key: 'firstReport', label: '首工序已报工（裁剪下料已报工）', pass: hasFirstReport },
      { key: 'finishRequired', label: '完工时间必填', pass: !!ftDayjs },
      { key: 'finishAfterStart', label: '完工时间 > 开工时间', pass: ftDayjs ? ftDayjs.isAfter(start) : false },
      { key: 'finishBeforeNow', label: '完工时间 ≤ 当前时间', pass: ftDayjs ? !ftDayjs.isAfter(now) : false },
      { key: 'finishAfterExc', label: '完工时间 ≥ 异常最晚结束时间', pass: ftDayjs ? (maxExcEnd ? !ftDayjs.isBefore(maxExcEnd) : true) : false },
    ]
  }

  const checks = finishTarget ? computeChecks(finishTarget, finishTime) : []
  const allPass = checks.length > 0 && checks.every(c => c.pass)

  const openFinish = (w) => {
    setFinishTarget(w)
    setFinishTime(null)
    setFinishOpen(true)
  }

  const confirmFinish = () => {
    const ft = dayjs(finishTime)
    const start = dayjs(finishTarget.start_time)
    const totalHours = roundHalf(ft.diff(start, 'hour', true))
    setData(prev => prev.map(w => w.work_order_id === finishTarget.work_order_id ? {
      ...w,
      status: '完工',
      finish_time: ft.format('YYYY-MM-DD HH:mm'),
      total_hours: totalHours,
      effective_hours: roundHalf(totalHours * 0.9),
    } : w))
    message.success(`工单 ${finishTarget.work_order_no} 已完工`)
    setFinishOpen(false)
  }

  const handleClose = (w) => {
    Modal.confirm({
      title: '确认关闭',
      content: `确认关闭工单 ${w.work_order_no}？关闭后仍可修改报工数据，之后可执行完工操作`,
      okText: '确认关闭',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        setData(prev => prev.map(x => x.work_order_id === w.work_order_id ? { ...x, status: '关闭' } : x))
        message.success('工单已关闭')
      },
    })
  }

  const handleStart = (w) => {
    Modal.confirm({
      title: '确认开工',
      content: `确认开工工单 ${w.work_order_no}？开工后不可修改和删除`,
      okText: '确认开工',
      cancelText: '取消',
      onOk: () => {
        setData(prev => prev.map(x => x.work_order_id === w.work_order_id ? { ...x, status: '开工' } : x))
        // 自动创建一条默认人员记录
        const newRecord = {
          record_id: 'mr' + Date.now(),
          work_order_id: w.work_order_id,
          work_order_no: w.work_order_no,
          order_id: w.order_id,
          order_no: w.order_no,
          skilled_workers: 0,
          general_workers: 0,
          contract_workers: 0,
          auxiliary_workers: 0,
          remarks: '开工默认',
          record_user: w.created_by,
          record_user_name: '生产管理',
          created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        }
        manpowerRecords.unshift(newRecord)
        message.success(`工单 ${w.work_order_no} 已开工，已自动创建人员记录`)
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
      onOk: () => {
        setData(prev => prev.filter(x => x.work_order_id !== w.work_order_id))
        message.success('工单已删除')
      },
    })
  }

  const handleAdd = () => {
    setEditing(null)
    form.resetFields()
    setAddOpen(true)
  }

  // 编辑：仅开立的工单可编辑目标数量与开工时间
  const handleEdit = (w) => {
    setEditing(w)
    form.setFieldsValue({
      order_id: w.order_id,
      line_id: w.line_id,
      target_qty: w.target_qty,
      start_time: dayjs(w.start_time),
    })
    setAddOpen(true)
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    if (editing) {
      setData(prev => prev.map(w => w.work_order_id === editing.work_order_id ? {
        ...w,
        target_qty: values.target_qty,
        start_time: values.start_time.format('YYYY-MM-DD HH:mm'),
      } : w))
      message.success('工单已更新')
    } else {
      const order = orders.find(o => o.order_id === values.order_id)
      const line = productionLines.find(l => l.line_id === values.line_id)
      const now = Date.now()
      const newWorkOrder = {
        work_order_id: now,
        work_order_no: 'WO' + now,
        order_id: order.order_id,
        order_no: order.order_no,
        line_id: line.line_id,
        line_name: line.line_name,
        material_id: order.material_id,
        material_name: order.material_name,
        target_qty: values.target_qty,
        start_time: values.start_time.format('YYYY-MM-DD HH:mm'),
        finish_time: null,
        total_hours: 0,
        effective_hours: 0,
        labor_hours: 0,
        status: '开立',
      }
      setData(prev => [newWorkOrder, ...prev])
      message.success('工单已创建')
    }
    setAddOpen(false)
  }

  const handleView = (w) => {
    setCurrentWO(w)
    setDetailOpen(true)
  }

  const renderActions = (w) => {
    if (w.status === '开立') {
      return (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleEdit(w)}>编辑</Button>
          <Button type="link" size="small" onClick={() => handleStart(w)}>开工</Button>
          <Button type="link" size="small" danger onClick={() => handleDelete(w)}>删除</Button>
        </Space>
      )
    }
    if (w.status === '开工') {
      return (
        <Space size="small">
          <Button type="link" size="small" danger onClick={() => handleClose(w)}>关闭</Button>
        </Space>
      )
    }
    if (w.status === '关闭') {
      return <Button type="link" size="small" onClick={() => openFinish(w)}>完工</Button>
    }
    return <Button type="link" size="small" onClick={() => handleView(w)}>查看</Button>
  }

  const columns = [
    { title: '工单编号', dataIndex: 'work_order_no', key: 'work_order_no', width: 140, fixed: 'left' },
    { title: '关联订单', dataIndex: 'order_no', key: 'order_no', width: 150 },
    { title: '产线', dataIndex: 'line_name', key: 'line_name', width: 70 },
    { title: '料品名称', dataIndex: 'material_name', key: 'material_name', width: 100 },
    { title: '目标数量', dataIndex: 'target_qty', key: 'target_qty', width: 90, render: v => v.toLocaleString() },
    {
      title: '完工数量', key: 'finished_qty', width: 90,
      render: (_, w) => {
        const reports = processReports.filter(r => r.work_order_id === w.work_order_id)
        if (reports.length === 0) return 0
        const lastReport = reports[reports.length - 1]
        return lastReport.output_qty.toLocaleString()
      },
    },
    {
      title: '人数', key: 'worker_count', width: 65,
      render: (_, w) => {
        const records = manpowerRecords.filter(m => m.work_order_id === w.work_order_id)
        return records.reduce((sum, r) => sum + (r.skilled_workers || 0) + (r.general_workers || 0) + (r.contract_workers || 0) + (r.auxiliary_workers || 0), 0)
      },
    },
    {
      title: '开工时长', key: 'duration_hours', width: 90,
      render: (_, w) => {
        if (!w.start_time) return '-'
        const start = dayjs(w.start_time)
        const end = w.finish_time ? dayjs(w.finish_time) : dayjs()
        const hours = roundHalf(end.diff(start, 'hour', true))
        return `${hours.toFixed(1)}h`
      },
    },
    {
      title: '故障时间', key: 'fault_hours', width: 90,
      render: (_, w) => {
        const excs = exceptionRecords.filter(e => e.work_order_id === w.work_order_id)
        const totalMinutes = excs.reduce((sum, e) => sum + (e.duration || 0), 0)
        return totalMinutes > 0 ? `${roundHalf(totalMinutes / 60).toFixed(1)}h` : '0h'
      },
    },
    {
      title: '人工工时', key: 'labor_hours_calc', width: 90,
      render: (_, w) => {
        const records = manpowerRecords.filter(m => m.work_order_id === w.work_order_id)
        const workerCount = records.reduce((sum, r) => sum + (r.skilled_workers || 0) + (r.general_workers || 0) + (r.contract_workers || 0) + (r.auxiliary_workers || 0), 0)
        if (!w.start_time) return '-'
        const start = dayjs(w.start_time)
        const end = w.finish_time ? dayjs(w.finish_time) : dayjs()
        const hours = end.diff(start, 'hour', true)
        return `${roundHalf(workerCount * hours).toFixed(1)}h`
      },
    },
    {
      title: '有效工时', key: 'effective_hours_calc', width: 90,
      render: (_, w) => {
        const records = manpowerRecords.filter(m => m.work_order_id === w.work_order_id)
        const workerCount = records.reduce((sum, r) => sum + (r.skilled_workers || 0) + (r.general_workers || 0) + (r.contract_workers || 0) + (r.auxiliary_workers || 0), 0)
        if (!w.start_time) return '-'
        const start = dayjs(w.start_time)
        const end = w.finish_time ? dayjs(w.finish_time) : dayjs()
        const hours = end.diff(start, 'hour', true)
        const excs = exceptionRecords.filter(e => e.work_order_id === w.work_order_id)
        const faultHours = excs.reduce((sum, e) => sum + (e.duration || 0), 0) / 60
        return `${roundHalf(workerCount * (hours - faultHours)).toFixed(1)}h`
      },
    },
    { title: '开工时间', dataIndex: 'start_time', key: 'start_time', width: 150 },
    { title: '完工时间', dataIndex: 'finish_time', key: 'finish_time', width: 150, render: v => v || '-' },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: v => <Tag color={statusColorMap[v]}>{v}</Tag> },
    { title: '操作', key: 'action', width: 150, fixed: 'right', render: (_, r) => renderActions(r) },
  ]

  return (
    <>
      <ThreeSectionPage
        title="工单管理"
        breadcrumbs="生产管理 / 工单管理"
        stats={stats}
        actions={<ActionButtons hasAdd={true} onAdd={handleAdd} addText="新增工单" />}
        table={
          <div>
            <Row gutter={[12, 8]} style={{ marginBottom: 12 }}>
              <Col span={6}>
                <Input
                  placeholder="搜索工单编号"
                  allowClear
                  prefix={<SearchOutlined />}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </Col>
              <Col span={6}>
                <Select
                  placeholder="状态筛选"
                  allowClear
                  style={{ width: '100%' }}
                  options={statusOptions}
                  value={status}
                  onChange={setStatus}
                />
              </Col>
              <Col span={6}>
                <Select
                  placeholder="产线筛选"
                  allowClear
                  style={{ width: '100%' }}
                  options={lineOptions}
                  value={lineId}
                  onChange={setLineId}
                />
              </Col>
              <Col>
                <Space>
                  <Button type="primary" icon={<SearchOutlined />}>查询</Button>
                  <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setStatus(undefined); setLineId(undefined) }}>重置</Button>
                </Space>
              </Col>
            </Row>
            <Table
              columns={columns}
              dataSource={filtered}
              rowKey="work_order_id"
              size="small"
              scroll={{ x: 1700 }}
              pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
            />
          </div>
        }
      />

      <Modal
        title={editing ? '编辑工单' : '新增工单'}
        open={addOpen}
        onOk={handleSubmit}
        onCancel={() => setAddOpen(false)}
        okText="保存"
        cancelText="取消"
        width={560}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          className="compact-form"
          preserve={false}
          onValuesChange={(changed) => {
            // 选择订单后自动带入料品名称与目标数量（默认取订单计划数量）
            if ('order_id' in changed) {
              const order = orders.find(o => o.order_id === changed.order_id)
              if (order) {
                form.setFieldValue('target_qty', order.planned_qty)
              }
            }
          }}
        >
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="关联生产订单" name="order_id" rules={[{ required: true, message: '请选择关联生产订单' }]}>
                <Select
                  placeholder="请选择关联生产订单"
                  options={orderOptions}
                  disabled={!!editing}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="料品名称">
                <Input value={selectedOrder?.material_name || '-'} disabled />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="产线" name="line_id" rules={[{ required: true, message: '请选择产线' }]}>
                <Select
                  placeholder="请选择产线"
                  options={lineOptions}
                  disabled={!!editing}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="目标数量" name="target_qty" rules={[{ required: true, message: '请输入目标数量' }]}>
                <InputNumber min={1} style={{ width: '100%' }} placeholder="请输入目标数量" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="开工时间" name="start_time" rules={[{ required: true, message: '请选择开工时间' }]}>
                <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} placeholder="请选择开工时间" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="工单完工"
        open={finishOpen}
        onOk={confirmFinish}
        onCancel={() => setFinishOpen(false)}
        okText="确认完工"
        cancelText="取消"
        width={560}
        okButtonProps={{ disabled: !allPass }}
      >
        {finishTarget && (
          <>
            <Alert
              message={`工单 ${finishTarget.work_order_no} 完工约束检查`}
              description="请确认以下6项完工约束条件全部满足，并填写完工时间后确认。"
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
            />
            <List
              size="small"
              bordered
              dataSource={checks}
              style={{ marginBottom: 16 }}
              renderItem={item => (
                <List.Item>
                  {item.pass
                    ? <CheckCircleFilled style={{ color: '#52c41a', marginRight: 8 }} />
                    : <CloseCircleFilled style={{ color: '#ff4d4f', marginRight: 8 }} />}
                  <span style={{ color: item.pass ? 'var(--text-primary)' : '#ff4d4f' }}>{item.label}</span>
                </List.Item>
              )}
            />
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: 'red', marginRight: 4 }}>*</span>完工时间
            </div>
            <DatePicker
              showTime
              format="YYYY-MM-DD HH:mm"
              style={{ width: '100%' }}
              value={finishTime}
              onChange={setFinishTime}
              placeholder="请选择完工时间"
            />
            {!allPass && (
              <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 8 }}>
                存在未满足的约束条件，请先处理后再确认完工。
              </div>
            )}
          </>
        )}
      </Modal>

      <Drawer
        title="工单详情"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={560}
      >
        {currentWO && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="工单编号">{currentWO.work_order_no}</Descriptions.Item>
            <Descriptions.Item label="关联订单">{currentWO.order_no}</Descriptions.Item>
            <Descriptions.Item label="产线">{currentWO.line_name}</Descriptions.Item>
            <Descriptions.Item label="料品名称">{currentWO.material_name}</Descriptions.Item>
            <Descriptions.Item label="目标数量">{currentWO.target_qty?.toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color={statusColorMap[currentWO.status]}>{currentWO.status}</Tag></Descriptions.Item>
            <Descriptions.Item label="开工时间">{currentWO.start_time}</Descriptions.Item>
            <Descriptions.Item label="完工时间">{currentWO.finish_time || '-'}</Descriptions.Item>
            <Descriptions.Item label="总工时">{currentWO.total_hours != null ? `${currentWO.total_hours}h` : '-'}</Descriptions.Item>
            <Descriptions.Item label="有效工时">{currentWO.effective_hours != null ? `${currentWO.effective_hours}h` : '-'}</Descriptions.Item>
            <Descriptions.Item label="人工工时">{currentWO.labor_hours != null ? `${currentWO.labor_hours}h` : '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </>
  )
}
