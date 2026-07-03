import React, { useState } from 'react'
import { Table, Tag, Button, Modal, Form, InputNumber, DatePicker, Input, Space, Row, Col, Select, Alert, List, message, Drawer, Descriptions, Empty } from 'antd'
import {
  ToolOutlined, ExportOutlined, SearchOutlined, ReloadOutlined,
  PlayCircleOutlined, CheckCircleOutlined, ClockCircleOutlined,
  CheckCircleFilled, CloseCircleFilled, DownOutlined, UpOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import {
  workOrders, orders, productionLines, materials,
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

// 获取工单关联的料号和规格
const getMaterialInfo = (w) => {
  if (w.material_code && w.specification) return { material_code: w.material_code, specification: w.specification }
  const order = orders.find(o => o.order_id === w.order_id)
  if (order) return { material_code: order.material_code, specification: order.specification }
  const mat = materials.find(m => m.material_id === w.material_id)
  if (mat) return { material_code: mat.material_code, specification: mat.specification }
  return { material_code: '-', specification: '-' }
}

export default function WorkOrderManagement() {
  const [data, setData] = useState(workOrders)
  const [searchWO, setSearchWO] = useState('')
  const [searchMaterial, setSearchMaterial] = useState('')
  const [status, setStatus] = useState(undefined)
  const [lineId, setLineId] = useState(undefined)
  const [dateRange, setDateRange] = useState([])
  const [showAdvanced, setShowAdvanced] = useState(false)
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
    const matchWO = !searchWO || w.work_order_no.toLowerCase().includes(searchWO.toLowerCase())
    const matInfo = getMaterialInfo(w)
    const matchMaterial = !searchMaterial ||
      matInfo.material_code.toLowerCase().includes(searchMaterial.toLowerCase()) ||
      w.material_name?.toLowerCase().includes(searchMaterial.toLowerCase())
    const matchStatus = !status || w.status === status
    const matchLine = !lineId || w.line_id === lineId
    let matchDate = true
    if (dateRange && dateRange.length === 2) {
      const woDate = dayjs(w.start_time)
      matchDate = woDate.isAfter(dateRange[0].startOf('day')) && woDate.isBefore(dateRange[1].endOf('day'))
    }
    return matchWO && matchMaterial && matchStatus && matchLine && matchDate
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
        material_code: order.material_code,
        material_name: order.material_name,
        specification: order.specification,
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

  const handleReset = () => {
    setSearchWO('')
    setSearchMaterial('')
    setStatus(undefined)
    setLineId(undefined)
    setDateRange([])
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
          <Button type="link" size="small" onClick={() => handleView(w)}>查看</Button>
        </Space>
      )
    }
    if (w.status === '关闭') {
      return (
        <Space size="small">
          <Button type="link" size="small" onClick={() => openFinish(w)}>完工</Button>
          <Button type="link" size="small" onClick={() => handleView(w)}>查看</Button>
        </Space>
      )
    }
    return <Button type="link" size="small" onClick={() => handleView(w)}>查看</Button>
  }

  const columns = [
    { title: '工单编号', dataIndex: 'work_order_no', key: 'work_order_no', width: 100, fixed: 'left', sorter: (a, b) => a.work_order_no.localeCompare(b.work_order_no), defaultSortOrder: 'descend' },
    {
      title: '料号', key: 'material_code', width: 80, fixed: 'left',
      sorter: (a, b) => getMaterialInfo(a).material_code.localeCompare(getMaterialInfo(b).material_code),
      defaultSortOrder: 'ascend',
      render: (_, w) => getMaterialInfo(w).material_code,
    },
    {
      title: '料品名称', dataIndex: 'material_name', key: 'material_name', width: 110, fixed: 'left',
      render: v => v || '-',
    },
    {
      title: '规格', key: 'specification', width: 60,
      render: (_, w) => getMaterialInfo(w).specification,
    },
    { title: '目标数量', dataIndex: 'target_qty', key: 'target_qty', width: 60, align: 'right', render: v => v.toLocaleString() },
    {
      title: '完工数量', key: 'finished_qty', width: 60, align: 'right',
      render: (_, w) => {
        const reports = processReports.filter(r => r.work_order_id === w.work_order_id)
        if (reports.length === 0) return 0
        const lastReport = reports[reports.length - 1]
        return lastReport.output_qty.toLocaleString()
      },
    },
    {
      title: '不良数量', key: 'defect_qty', width: 60, align: 'right',
      render: (_, w) => {
        const reports = processReports.filter(r => r.work_order_id === w.work_order_id)
        const total = reports.reduce((sum, r) => sum + (r.defect_material || 0) + (r.defect_process || 0) + (r.defect_scrap || 0), 0)
        return total > 0 ? total.toLocaleString() : 0
      },
    },
    { title: '产线', dataIndex: 'line_name', key: 'line_name', width: 40 },
    {
      title: '生产人数', key: 'worker_count', width: 60, align: 'right',
      render: (_, w) => {
        const records = manpowerRecords.filter(m => m.work_order_id === w.work_order_id)
        return records.reduce((sum, r) => sum + (r.skilled_workers || 0) + (r.general_workers || 0) + (r.contract_workers || 0) + (r.auxiliary_workers || 0), 0)
      },
    },
    {
      title: '生产工时', key: 'labor_hours_calc', width: 60, align: 'right',
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
      title: '停机时间', key: 'fault_hours', width: 60, align: 'right',
      render: (_, w) => {
        const excs = exceptionRecords.filter(e => e.work_order_id === w.work_order_id)
        const totalMinutes = excs.reduce((sum, e) => sum + (e.duration || 0), 0)
        return totalMinutes > 0 ? `${roundHalf(totalMinutes / 60).toFixed(1)}h` : '0h'
      },
    },
    {
      title: '工单时间', key: 'wo_time', width: 120,
      render: (_, w) => (
        <div style={{ lineHeight: 1.6, fontSize: 12 }}>
          <div>开工：{w.start_time || '-'}</div>
          <div>完工：{w.finish_time || '-'}</div>
        </div>
      ),
    },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, align: 'center', render: v => <Tag color={statusColorMap[v]}>{v}</Tag> },
    { title: '操作', key: 'action', width: 100, fixed: 'right', render: (_, r) => renderActions(r) },
  ]

  // 工单详情：关联数据
  const getRelatedManpower = (wo) => manpowerRecords.filter(m => m.work_order_id === wo?.work_order_id)
  const getRelatedExceptions = (wo) => exceptionRecords.filter(e => e.work_order_id === wo?.work_order_id)
  const getRelatedDefects = (wo) => processReports.filter(r => r.work_order_id === wo?.work_order_id && (r.defect_material + r.defect_process + r.defect_scrap) > 0)

  return (
    <>
      <ThreeSectionPage
        title="工单管理"
        breadcrumbs="生产管理 / 工单管理"
        stats={stats}
        actions={<ActionButtons hasAdd={true} onAdd={handleAdd} addText="新增工单" />}
        table={
          <div>
            <Row gutter={[12, 8]} style={{ marginBottom: 12 }} align="middle">
              <Col flex="160px">
                <Input
                  placeholder="工单号"
                  allowClear
                  prefix={<SearchOutlined />}
                  value={searchWO}
                  onChange={e => setSearchWO(e.target.value)}
                />
              </Col>
              <Col flex="200px">
                <Input
                  placeholder="料号 / 料品名称"
                  allowClear
                  value={searchMaterial}
                  onChange={e => setSearchMaterial(e.target.value)}
                />
              </Col>
              <Col flex="100px">
                <Select
                  placeholder="状态"
                  allowClear
                  style={{ width: '100%' }}
                  options={statusOptions}
                  value={status}
                  onChange={setStatus}
                />
              </Col>
              <Col flex="100px">
                <Select
                  placeholder="产线"
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
                  <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
                  <Button type="link" size="small" onClick={() => setShowAdvanced(!showAdvanced)}>
                    {showAdvanced ? '收起' : '展开'} {showAdvanced ? <UpOutlined /> : <DownOutlined />}
                  </Button>
                </Space>
              </Col>
            </Row>
            {showAdvanced && (
              <Row gutter={[12, 8]} style={{ marginBottom: 12 }}>
                <Col>
                  <DatePicker.RangePicker
                    value={dateRange}
                    onChange={setDateRange}
                    format="YYYY-MM-DD"
                  />
                </Col>
              </Row>
            )}
            <Table
              columns={columns}
              dataSource={filtered}
              rowKey="work_order_id"
              size="small"
              scroll={{ x: 1060 }}
              pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
              onChange={(pagination, filters, sorter) => {}}
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
                form.setFieldValue('target_qty', order.planned_qty)
              }
            }
          }}
        >
          {/* 第一行：关联订单 */}
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
          {/* 第二行：料号、产品名称 */}
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
          {/* 第三行：菲林编号、版本号 */}
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
          {/* 第四行：目标数量、产线 */}
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="目标数量" name="target_qty" rules={[{ required: true, message: '请输入目标数量' }]}>
                <InputNumber min={1} style={{ width: '100%' }} placeholder="请输入目标数量" />
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
          {/* 第五行：计划开工时间 */}
          <Row gutter={12}>
            <Col span={24}>
              <Form.Item label="计划开工时间" name="start_time" rules={[{ required: true, message: '请选择计划开工时间' }]}>
                <DatePicker
                  showTime={{ minuteStep: 10 }}
                  format="YYYY-MM-DD HH:mm"
                  style={{ width: '100%' }}
                  placeholder="请选择计划开工时间"
                  disabledDate={current => current && current < dayjs().startOf('day')}
                  disabledTime={date => {
                    if (!date) return {}
                    const now = dayjs()
                    const minTime = now
                    const maxTime = now.add(48, 'hour')
                    if (date.isSame(now, 'day')) {
                      return {
                        disabledHours: () => Array.from({ length: 24 }, (_, i) => i).filter(h => h < now.hour()),
                        disabledMinutes: () => {
                          if (date.hour() === now.hour()) {
                            return Array.from({ length: 60 }, (_, i) => i).filter(m => m < now.minute())
                          }
                          return []
                        },
                      }
                    }
                    if (date.isSame(maxTime, 'day')) {
                      return {
                        disabledHours: () => Array.from({ length: 24 }, (_, i) => i).filter(h => h > maxTime.hour()),
                        disabledMinutes: () => {
                          if (date.hour() === maxTime.hour()) {
                            return Array.from({ length: 60 }, (_, i) => i).filter(m => m > maxTime.minute())
                          }
                          return []
                        },
                      }
                    }
                    return {}
                  }}
                />
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
        width="40%"
      >
        {currentWO && (() => {
          const matInfo = getMaterialInfo(currentWO)
          const relatedManpower = getRelatedManpower(currentWO)
          const relatedExc = getRelatedExceptions(currentWO)
          const relatedDefects = getRelatedDefects(currentWO)
          return (
            <>
              <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
                <Descriptions.Item label="工单编号">{currentWO.work_order_no}</Descriptions.Item>
                <Descriptions.Item label="关联订单">{currentWO.order_no}</Descriptions.Item>
                <Descriptions.Item label="料号">{matInfo.material_code}</Descriptions.Item>
                <Descriptions.Item label="料品名称">{currentWO.material_name}</Descriptions.Item>
                <Descriptions.Item label="规格">{matInfo.specification}</Descriptions.Item>
                <Descriptions.Item label="产线">{currentWO.line_name}</Descriptions.Item>
                <Descriptions.Item label="目标数量">{currentWO.target_qty?.toLocaleString()}</Descriptions.Item>
                <Descriptions.Item label="状态"><Tag color={statusColorMap[currentWO.status]}>{currentWO.status}</Tag></Descriptions.Item>
                <Descriptions.Item label="开工时间">{currentWO.start_time}</Descriptions.Item>
                <Descriptions.Item label="完工时间">{currentWO.finish_time || '-'}</Descriptions.Item>
              </Descriptions>

              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>人员记录</div>
              {relatedManpower.length > 0 ? (
                <Table
                  size="small"
                  rowKey="record_id"
                  dataSource={relatedManpower}
                  pagination={false}
                  style={{ marginBottom: 16 }}
                  columns={[
                    { title: '技工人数', dataIndex: 'skilled_workers', key: 'skilled_workers', width: 90, render: v => v || 0 },
                    { title: '普工人数', dataIndex: 'general_workers', key: 'general_workers', width: 90, render: v => v || 0 },
                    { title: '劳务工人数', dataIndex: 'contract_workers', key: 'contract_workers', width: 100, render: v => v || 0 },
                    { title: '其他辅助', dataIndex: 'auxiliary_workers', key: 'auxiliary_workers', width: 90, render: v => v || 0 },
                    {
                      title: '合计人数', key: 'total', width: 90,
                      render: (_, r) => (r.skilled_workers || 0) + (r.general_workers || 0) + (r.contract_workers || 0) + (r.auxiliary_workers || 0),
                    },
                    {
                      title: '总工时(小时)', key: 'total_hours', width: 110,
                      render: (_, r) => {
                        const totalWorkers = (r.skilled_workers || 0) + (r.general_workers || 0) + (r.contract_workers || 0) + (r.auxiliary_workers || 0)
                        const wo = workOrders.find(w => w.work_order_id === r.work_order_id)
                        if (!wo || !wo.start_time) return '-'
                        const start = dayjs(wo.start_time)
                        const end = wo.finish_time ? dayjs(wo.finish_time) : dayjs()
                        const hours = end.diff(start, 'hour', true)
                        return (totalWorkers * hours).toFixed(1)
                      },
                    },
                    { title: '备注', dataIndex: 'remarks', key: 'remarks', width: 120, render: v => v || '-' },
                    { title: '记录人', dataIndex: 'record_user_name', key: 'record_user_name', width: 100 },
                    { title: '记录时间', dataIndex: 'created_at', key: 'created_at', width: 160 },
                  ]}
                />
              ) : <Empty description="暂无人员记录" style={{ marginBottom: 16 }} />}

              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>停机记录</div>
              {relatedExc.length > 0 ? (
                <Table
                  size="small"
                  rowKey="record_id"
                  dataSource={relatedExc}
                  pagination={false}
                  style={{ marginBottom: 16 }}
                  columns={[
                    { title: '异常类型', dataIndex: 'exception_type_name', key: 'exception_type_name', width: 80 },
                    { title: '设备', dataIndex: 'device_name', key: 'device_name', width: 100 },
                    { title: '开始', dataIndex: 'start_time', key: 'start_time', width: 130 },
                    { title: '结束', dataIndex: 'end_time', key: 'end_time', width: 130 },
                    { title: '时长(分)', dataIndex: 'duration', key: 'duration', width: 70 },
                    { title: '原因', dataIndex: 'reason', key: 'reason', width: 150 },
                  ]}
                />
              ) : <Empty description="暂无停机记录" style={{ marginBottom: 16 }} />}

              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>不良记录</div>
              {relatedDefects.length > 0 ? (
                <Table
                  size="small"
                  rowKey="report_id"
                  dataSource={relatedDefects}
                  pagination={false}
                  columns={[
                    { title: '工序', dataIndex: 'process_name', key: 'process_name', width: 80 },
                    { title: '来料不良', dataIndex: 'defect_material', key: 'defect_material', width: 70 },
                    { title: '制程不良', dataIndex: 'defect_process', key: 'defect_process', width: 70 },
                    { title: '检验报废', dataIndex: 'defect_scrap', key: 'defect_scrap', width: 70 },
                    { title: '设备', dataIndex: 'device_name', key: 'device_name', width: 100 },
                  ]}
                />
              ) : <Empty description="暂无不良记录" />}
            </>
          )
        })()}
      </Drawer>
    </>
  )
}
