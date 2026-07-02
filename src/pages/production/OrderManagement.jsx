import React, { useState } from 'react'
import { Table, Tag, Button, Modal, Form, Input, InputNumber, Select, DatePicker, Space, Row, Col, message, Drawer, Descriptions, Empty } from 'antd'
import {
  FileTextOutlined, PlusOutlined, ExportOutlined, SearchOutlined, ReloadOutlined,
  SendOutlined, ClockCircleOutlined, CheckCircleOutlined, EyeOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import { orders, materials, workOrders, manpowerRecords, exceptionRecords, processReports } from '../../mock/data'

const statusColorMap = {
  '待下达': 'default',
  '已下达': 'processing',
  '已关闭': 'success',
}

const woStatusColor = { '开立': 'default', '开工': 'processing', '关闭': 'warning', '完工': 'success' }

const statusOptions = [
  { label: '待下达', value: '待下达' },
  { label: '已下达', value: '已下达' },
  { label: '已关闭', value: '已关闭' },
]

export default function OrderManagement() {
  const [data, setData] = useState(orders)
  const [search, setSearch] = useState('')
  const [searchMaterial, setSearchMaterial] = useState('')
  const [status, setStatus] = useState(undefined)
  const [dateRange, setDateRange] = useState([])
  const [addOpen, setAddOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [currentOrder, setCurrentOrder] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()

  // 生成订单编号：MO-16 + YYMMDD + 3位序号
  const genOrderNo = () => {
    const dateStr = dayjs().format('YYMMDD')
    const seq = String(data.length + 1).padStart(3, '0')
    return `MO-16${dateStr}${seq}`
  }

  const filtered = data.filter(o => {
    const matchSearch = !search || o.order_no.toLowerCase().includes(search.toLowerCase())
    const matchMaterial = !searchMaterial ||
      o.material_code?.toLowerCase().includes(searchMaterial.toLowerCase()) ||
      o.material_name?.toLowerCase().includes(searchMaterial.toLowerCase())
    const matchStatus = !status || o.status === status
    let matchDate = true
    if (dateRange && dateRange.length === 2) {
      const od = dayjs(o.plan_start_time)
      matchDate = od.isAfter(dateRange[0].startOf('day')) && od.isBefore(dateRange[1].endOf('day'))
    }
    return matchSearch && matchMaterial && matchStatus && matchDate
  })

  const stats = [
    { label: '总订单数', value: data.length, icon: <FileTextOutlined />, color: '#2196F3' },
    { label: '待下达', value: data.filter(o => o.status === '待下达').length, icon: <ClockCircleOutlined />, color: '#9E9E9E' },
    { label: '已下达', value: data.filter(o => o.status === '已下达').length, icon: <SendOutlined />, color: '#FF9800' },
    { label: '已关闭', value: data.filter(o => o.status === '已关闭').length, icon: <CheckCircleOutlined />, color: '#4CAF50' },
  ]

  const handleRelease = (r) => {
    Modal.confirm({
      title: '确认下发',
      content: '确认下发该订单？下发后将不可修改和删除',
      okText: '确认下发',
      cancelText: '取消',
      onOk: () => {
        setData(prev => prev.map(o => o.order_id === r.order_id
          ? { ...o, status: '已下达', release_time: dayjs().format('YYYY-MM-DD HH:mm') }
          : o))
        message.success(`订单 ${r.order_no} 已下发`)
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
      onOk: () => {
        setData(prev => prev.map(o => o.order_id === r.order_id
          ? { ...o, status: '已关闭', close_time: dayjs().format('YYYY-MM-DD HH:mm') }
          : o))
        message.success('订单已关闭')
      },
    })
  }

  const handleDelete = (r) => {
    Modal.confirm({
      title: '确认删除',
      content: `确认删除订单 ${r.order_no}？此操作不可恢复`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        setData(prev => prev.filter(o => o.order_id !== r.order_id))
        message.success('订单已删除')
      },
    })
  }

  const handleAdd = () => {
    setEditing(null)
    form.resetFields()
    setAddOpen(true)
  }

  const handleEdit = (r) => {
    setEditing(r)
    form.setFieldsValue({
      material_id: r.material_id,
      planned_qty: r.planned_qty,
      plan_start_time: dayjs(r.plan_start_time),
      plan_end_time: dayjs(r.plan_end_time),
    })
    setAddOpen(true)
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    const material = materials.find(m => m.material_id === values.material_id)
    if (editing) {
      setData(prev => prev.map(o => o.order_id === editing.order_id ? {
        ...o,
        planned_qty: values.planned_qty,
      } : o))
      message.success('订单已更新')
    } else {
      const newOrder = {
        order_id: 'o' + Date.now(),
        order_no: genOrderNo(),
        material_id: material.material_id,
        material_code: material.material_code,
        material_name: material.material_name,
        specification: material.specification,
        film_version: material.film_version,
        version_no: material.version_no,
        planned_qty: values.planned_qty,
        finished_qty: 0,
        plan_start_time: values.plan_start_time.format('YYYY-MM-DD HH:mm'),
        plan_end_time: values.plan_end_time.format('YYYY-MM-DD HH:mm'),
        status: '待下达',
        release_time: null,
        created_by: 'u3',
        created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      }
      setData(prev => [newOrder, ...prev])
      message.success('订单已创建')
    }
    setAddOpen(false)
  }

  const handleView = (r) => {
    setCurrentOrder(r)
    setDetailOpen(true)
  }

  const renderActions = (r) => {
    if (r.status === '待下达') {
      return (
        <Space size={0}>
          <Button type="link" size="small" onClick={() => handleRelease(r)}>下发</Button>
          <Button type="link" size="small" onClick={() => handleEdit(r)}>编辑</Button>
          <Button type="link" size="small" danger onClick={() => handleDelete(r)}>删除</Button>
        </Space>
      )
    }
    if (r.status === '已下达') {
      return (
        <Button type="link" size="small" danger onClick={() => handleClose(r)}>关闭</Button>
      )
    }
    return <Button type="link" size="small" onClick={() => handleView(r)}>查看</Button>
  }

  const columns = [
    { title: '订单编号', dataIndex: 'order_no', key: 'order_no', width: 100, fixed: 'left' },
    { title: '料号', dataIndex: 'material_code', key: 'material_code', width: 80, fixed: 'left' },
    { title: '料品名称', dataIndex: 'material_name', key: 'material_name', width: 120, fixed: 'left' },
    { title: '规格', dataIndex: 'specification', key: 'specification', width: 60 },
    { title: '菲林编号', dataIndex: 'film_version', key: 'film_version', width: 80 },
    { title: '版本', dataIndex: 'version_no', key: 'version_no', width: 40 },
    { title: '计划数量', dataIndex: 'planned_qty', key: 'planned_qty', width: 80, align: 'right', render: v => v.toLocaleString() },
    { title: '完工数量', dataIndex: 'finished_qty', key: 'finished_qty', width: 80, align: 'right', render: v => {
      const val = v || 0
      return <span style={{ color: val > 0 ? 'var(--color-success)' : 'var(--text-secondary)' }}>{val.toLocaleString()}</span>
    }},
    {
      title: '合格品', key: 'qualified_qty', width: 80, align: 'right',
      render: (_, r) => {
        const relatedWOs = workOrders.filter(w => w.order_id === r.order_id)
        const reports = processReports.filter(rp => relatedWOs.some(w => w.work_order_id === rp.work_order_id))
        const lastReport = reports.length > 0 ? reports[reports.length - 1] : null
        const qualified = lastReport ? lastReport.output_qty : 0
        return <span style={{ color: qualified > 0 ? 'var(--color-success)' : 'var(--text-secondary)' }}>{qualified.toLocaleString()}</span>
      },
    },
    {
      title: '计划时间', key: 'plan_time', width: 100,
      render: (_, r) => <span style={{ fontSize: 12 }}>{r.plan_start_time?.substring(0, 10)}<br />~ {r.plan_end_time?.substring(0, 10)}</span>,
    },
    { title: '状态', dataIndex: 'status', key: 'status', width: 40, render: v => <Tag color={statusColorMap[v]}>{v}</Tag> },
    { title: '操作', key: 'action', width: 100, render: (_, r) => renderActions(r) },
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
            extra={<Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增订单</Button>}
          />
        }
        table={
          <div>
            <Row gutter={[12, 8]} style={{ marginBottom: 12 }} align="middle">
              <Col flex="200px">
                <Input
                  placeholder="订单号"
                  allowClear
                  prefix={<SearchOutlined />}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </Col>
              <Col flex="200px">
                <Input
                  placeholder="料号 / 品名"
                  allowClear
                  value={searchMaterial}
                  onChange={e => setSearchMaterial(e.target.value)}
                />
              </Col>
              <Col flex="120px">
                <Select
                  placeholder="状态"
                  allowClear
                  style={{ width: '100%' }}
                  options={statusOptions}
                  value={status}
                  onChange={setStatus}
                />
              </Col>
              <Col>
                <DatePicker.RangePicker
                  value={dateRange}
                  onChange={setDateRange}
                  format="YYYY-MM-DD"
                />
              </Col>
              <Col>
                <Space>
                  <Button type="primary" icon={<SearchOutlined />}>查询</Button>
                  <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setSearchMaterial(''); setStatus(undefined); setDateRange([]) }}>重置</Button>
                </Space>
              </Col>
            </Row>
            <Table
              columns={columns}
              dataSource={filtered}
              rowKey="order_id"
              size="small"
              scroll={{ x: 980 }}
              pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
            />
          </div>
        }
      />

      <Modal
        title={editing ? '编辑订单' : '新增订单'}
        open={addOpen}
        onOk={handleSubmit}
        onCancel={() => setAddOpen(false)}
        okText="保存"
        cancelText="取消"
        width={560}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          <Form.Item label="订单编号">
            <Input value={editing ? editing.order_no : genOrderNo()} disabled />
          </Form.Item>
          <Form.Item label="料品" name="material_id" rules={[{ required: true, message: '请选择料品' }]}>
            <Select
              placeholder="请选择料品"
              disabled={!!editing}
              options={materials.map(m => ({ label: `${m.material_code} | ${m.material_name} | ${m.specification}`, value: m.material_id }))}
            />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="计划数量" name="planned_qty" rules={[{ required: true, message: '请输入计划数量' }]}>
                <InputNumber min={1} style={{ width: '100%' }} placeholder="请输入计划数量" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="计划开始时间" name="plan_start_time" rules={[{ required: true, message: '请选择计划开始时间' }]}>
                <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} disabled={!!editing} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="计划完成时间" name="plan_end_time" rules={[{ required: true, message: '请选择计划完成时间' }]}>
                <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} disabled={!!editing} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Drawer
        title="订单详情"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width="40%"
      >
        {currentOrder && (
          <>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="订单编号">{currentOrder.order_no}</Descriptions.Item>
              <Descriptions.Item label="状态"><Tag color={statusColorMap[currentOrder.status]}>{currentOrder.status}</Tag></Descriptions.Item>
              <Descriptions.Item label="料号">{currentOrder.material_code}</Descriptions.Item>
              <Descriptions.Item label="品名">{currentOrder.material_name}</Descriptions.Item>
              <Descriptions.Item label="规格">{currentOrder.specification}</Descriptions.Item>
              <Descriptions.Item label="菲林编号">{currentOrder.film_version}</Descriptions.Item>
              <Descriptions.Item label="菲林版本">{currentOrder.version_no}</Descriptions.Item>
              <Descriptions.Item label="计划数量">{currentOrder.planned_qty?.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="完工数量">{(currentOrder.finished_qty || 0).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="计划开始">{currentOrder.plan_start_time}</Descriptions.Item>
              <Descriptions.Item label="计划完成">{currentOrder.plan_end_time}</Descriptions.Item>
              <Descriptions.Item label="下发时间">{currentOrder.release_time || '-'}</Descriptions.Item>
              <Descriptions.Item label="关闭时间">{currentOrder.close_time || '-'}</Descriptions.Item>
            </Descriptions>

            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>关联工单</div>
            {workOrders.filter(w => w.order_id === currentOrder.order_id).length > 0 ? (
              <Table
                size="small"
                rowKey="work_order_id"
                dataSource={workOrders.filter(w => w.order_id === currentOrder.order_id)}
                pagination={false}
                style={{ marginBottom: 16 }}
                columns={[
                  { title: '工单编号', dataIndex: 'work_order_no', key: 'work_order_no', width: 150 },
                  { title: '产线', dataIndex: 'line_name', key: 'line_name', width: 80 },
                  { title: '料品名称', dataIndex: 'material_name', key: 'material_name', width: 120 },
                  { title: '目标数量', dataIndex: 'target_qty', key: 'target_qty', width: 100, render: v => v.toLocaleString() },
                  { title: '开工时间', dataIndex: 'start_time', key: 'start_time', width: 150 },
                  { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: v => <Tag color={woStatusColor[v]}>{v}</Tag> },
                ]}
              />
            ) : <Empty description="暂无关联工单" style={{ marginBottom: 16 }} />}

            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>人员记录</div>
            {(() => {
              const relatedWOs = workOrders.filter(w => w.order_id === currentOrder.order_id)
              const relatedMR = manpowerRecords.filter(m => relatedWOs.some(w => w.work_order_id === m.work_order_id))
              return relatedMR.length > 0 ? (
                <Table
                  size="small"
                  rowKey="record_id"
                  dataSource={relatedMR}
                  pagination={false}
                  style={{ marginBottom: 16 }}
                  columns={[
                    { title: '工单编号', dataIndex: 'work_order_no', key: 'work_order_no', width: 150 },
                    { title: '技工', dataIndex: 'skilled_workers', key: 'skilled_workers', width: 60 },
                    { title: '普工', dataIndex: 'general_workers', key: 'general_workers', width: 60 },
                    { title: '劳务', dataIndex: 'contract_workers', key: 'contract_workers', width: 60 },
                    { title: '辅助', dataIndex: 'auxiliary_workers', key: 'auxiliary_workers', width: 60 },
                    { title: '备注', dataIndex: 'remarks', key: 'remarks', width: 100 },
                  ]}
                />
              ) : <Empty description="暂无人员记录" style={{ marginBottom: 16 }} />
            })()}

            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>异常记录</div>
            {(() => {
              const relatedER = exceptionRecords.filter(e => e.order_id === currentOrder.order_id)
              return relatedER.length > 0 ? (
                <Table
                  size="small"
                  rowKey="record_id"
                  dataSource={relatedER}
                  pagination={false}
                  columns={[
                    { title: '工单编号', dataIndex: 'work_order_no', key: 'work_order_no', width: 150 },
                    { title: '异常类型', dataIndex: 'exception_type_name', key: 'exception_type_name', width: 100 },
                    { title: '设备', dataIndex: 'device_name', key: 'device_name', width: 120 },
                    { title: '开始时间', dataIndex: 'start_time', key: 'start_time', width: 150 },
                    { title: '结束时间', dataIndex: 'end_time', key: 'end_time', width: 150 },
                    { title: '时长(分)', dataIndex: 'duration', key: 'duration', width: 80 },
                    { title: '原因', dataIndex: 'reason', key: 'reason', width: 200 },
                  ]}
                />
              ) : <Empty description="暂无异常记录" />
            })()}
          </>
        )}
      </Drawer>
    </>
  )
}
