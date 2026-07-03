import React, { useState } from 'react'
import {
  Table, Tag, Button, Modal, Form, Input, Select, DatePicker, Space, Row, Col, Alert, message, Drawer, Descriptions
} from 'antd'
import {
  BellOutlined, ToolOutlined, SyncOutlined, ClockCircleOutlined,
  PlusOutlined, ExportOutlined, SearchOutlined, ReloadOutlined,
  EditOutlined, DeleteOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import { exceptionRecords, workOrders, devices } from '../../mock/data'

// 异常类型定义
const exceptionTypes = [
  { code: 'E01', name: '换型调机', needDevice: false },
  { code: 'E02', name: '清场', needDevice: false },
  { code: 'E03', name: '停机待料', needDevice: false },
  { code: 'E04', name: '设备故障', needDevice: true },
]
const excTypeMap = Object.fromEntries(exceptionTypes.map(e => [e.code, e]))

const exceptionTypeColorMap = {
  'E01': 'warning',
  'E02': 'default',
  'E03': 'processing',
  'E04': 'error',
}

const exceptionTypeOptions = exceptionTypes.map(e => ({ label: `${e.code} ${e.name}`, value: e.code }))

export default function ExceptionRecord() {
  const [data, setData] = useState(exceptionRecords)
  const [search, setSearch] = useState('')
  const [excType, setExcType] = useState(undefined)
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [currentRecord, setCurrentRecord] = useState(null)
  const [form] = Form.useForm()
  const [selExcType, setSelExcType] = useState(null)
  const [startTime, setStartTime] = useState(null)
  const [endTime, setEndTime] = useState(null)

  const filtered = data.filter(r => {
    const matchSearch = !search || r.work_order_no.toLowerCase().includes(search.toLowerCase())
    const matchType = !excType || r.exception_type === excType
    return matchSearch && matchType
  })

  const stats = [
    { label: '总异常记录', value: data.length, icon: <BellOutlined />, color: '#2196F3' },
    { label: '设备故障数', value: data.filter(r => r.exception_type === 'E04').length, icon: <ToolOutlined />, color: '#F44336' },
    { label: '换型调机数', value: data.filter(r => r.exception_type === 'E01').length, icon: <SyncOutlined />, color: '#FF9800' },
    { label: '累计异常时长(分钟)', value: data.reduce((s, r) => s + (r.duration || 0), 0), icon: <ClockCircleOutlined />, color: '#00BCD4' },
  ]

  // 自动计算时长（分钟）
  const computedDuration = (startTime && endTime) ? Math.max(0, endTime.diff(startTime, 'minute')) : null

  const handleAdd = () => {
    setEditing(null)
    form.resetFields()
    setSelExcType(null)
    setStartTime(null)
    setEndTime(null)
    setAddOpen(true)
  }

  const handleView = (r) => {
    setCurrentRecord(r)
    setDetailOpen(true)
  }

  const handleEdit = (r) => {
    setEditing(r)
    form.setFieldsValue({
      work_order_id: r.work_order_id,
      exception_type: r.exception_type,
      device_id: r.device_id || undefined,
      reason: r.reason,
    })
    setSelExcType(r.exception_type)
    setStartTime(r.start_time ? dayjs(r.start_time) : null)
    setEndTime(r.end_time ? dayjs(r.end_time) : null)
    setAddOpen(true)
  }

  const handleDelete = (r) => {
    Modal.confirm({
      title: '确认删除',
      content: `确认删除工单 ${r.work_order_no} 的异常记录？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        setData(prev => prev.filter(x => x.record_id !== r.record_id))
        message.success('异常记录已删除')
      },
    })
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    if (!startTime || !endTime) {
      message.warning('请选择开始时间和结束时间')
      return
    }
    if (!endTime.isAfter(startTime)) {
      message.warning('结束时间必须晚于开始时间')
      return
    }
    const duration = Math.max(0, endTime.diff(startTime, 'minute'))
    const w = workOrders.find(w => w.work_order_id === values.work_order_id)
    const excTypeObj = excTypeMap[values.exception_type]
    const device = devices.find(d => d.device_id === values.device_id)
    const payload = {
      work_order_id: values.work_order_id,
      work_order_no: w?.work_order_no || '-',
      exception_type: values.exception_type,
      exception_type_name: excTypeObj?.name || '-',
      device_id: excTypeObj?.needDevice ? (values.device_id || null) : null,
      device_name: excTypeObj?.needDevice ? (device?.device_name || '-') : '-',
      start_time: startTime.format('YYYY-MM-DD HH:mm'),
      end_time: endTime.format('YYYY-MM-DD HH:mm'),
      duration,
      reason: values.reason || '',
      record_user: 'u6',
      record_user_name: '生产管理',
    }
    if (editing) {
      setData(prev => prev.map(r => r.record_id === editing.record_id ? { ...r, ...payload } : r))
      message.success('异常记录已更新')
    } else {
      setData(prev => [{ record_id: 'er' + Date.now(), ...payload }, ...prev])
      message.success('异常记录已新增')
    }
    setAddOpen(false)
  }

  const columns = [
    { title: '工单编号', dataIndex: 'work_order_no', key: 'work_order_no', width: 150, fixed: 'left' },
    {
      title: '异常类型', key: 'exc_type', width: 140,
      render: (_, r) => <Tag color={exceptionTypeColorMap[r.exception_type]}>{r.exception_type} {r.exception_type_name}</Tag>,
    },
    { title: '关联设备', dataIndex: 'device_name', key: 'device_name', width: 140, render: v => v || '-' },
    { title: '开始时间', dataIndex: 'start_time', key: 'start_time', width: 150 },
    { title: '结束时间', dataIndex: 'end_time', key: 'end_time', width: 150 },
    { title: '时长(分钟)', dataIndex: 'duration', key: 'duration', width: 100, render: v => v != null ? v : '-' },
    { title: '原因描述', dataIndex: 'reason', key: 'reason', width: 220, render: v => v || '-' },
    { title: '记录人', dataIndex: 'record_user_name', key: 'record_user_name', width: 100 },
    {
      title: '操作', key: 'action', width: 150, fixed: 'right',
      render: (_, r) => {
        const wo = workOrders.find(w => w.work_order_id === r.work_order_id)
        const isCompleted = wo && wo.status === '完工'
        if (isCompleted) {
          return <Button type="link" size="small" onClick={() => handleView(r)}>查看</Button>
        }
        return (
          <Space size="small">
            <Button type="link" size="small" onClick={() => handleEdit(r)}>编辑</Button>
            <Button type="link" size="small" danger onClick={() => handleDelete(r)}>删除</Button>
          </Space>
        )
      },
    },
  ]

  const needDevice = selExcType ? excTypeMap[selExcType]?.needDevice : false

  return (
    <>
      <ThreeSectionPage
        title="异常工时记录"
        breadcrumbs="生产管理 / 异常工时"
        stats={stats}
        actions={
          <ActionButtons
            hasAdd={false}
            extra={<Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增记录</Button>}
          />
        }
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
                  placeholder="异常类型筛选"
                  allowClear
                  style={{ width: '100%' }}
                  options={exceptionTypeOptions}
                  value={excType}
                  onChange={setExcType}
                />
              </Col>
              <Col>
                <Space>
                  <Button type="primary" icon={<SearchOutlined />}>查询</Button>
                  <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setExcType(undefined) }}>重置</Button>
                </Space>
              </Col>
            </Row>
            <Table
              columns={columns}
              dataSource={filtered}
              rowKey="record_id"
              size="small"
              scroll={{ x: 1400 }}
              pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
            />
          </div>
        }
      />

      <Modal
        title={editing ? '编辑异常工时' : '新增异常工时'}
        open={addOpen}
        onOk={handleSubmit}
        onCancel={() => setAddOpen(false)}
        okText="保存"
        cancelText="取消"
        width={560}
        destroyOnHidden
      >
        <Alert
          message="异常类型说明"
          description="E01 换型调机、E02 清场、E03 停机待料、E04 设备故障（需关联设备）。时长由系统根据结束时间-开始时间自动计算。"
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
        />
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="工单" name="work_order_id" rules={[{ required: true, message: '请选择工单' }]}>
                <Select
                  placeholder="请选择工单"
                  options={workOrders.map(w => ({ label: w.work_order_no, value: w.work_order_id }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="异常类型" name="exception_type" rules={[{ required: true, message: '请选择异常类型' }]}>
                <Select
                  placeholder="请选择异常类型"
                  options={exceptionTypeOptions}
                  onChange={v => setSelExcType(v)}
                />
              </Form.Item>
            </Col>
          </Row>

          {needDevice && (
            <Form.Item label="关联设备" name="device_id" rules={[{ required: true, message: '设备故障需选择关联设备' }]}>
              <Select
                placeholder="请选择关联设备"
                options={devices.map(d => ({ label: `${d.device_code} ${d.device_name}`, value: d.device_id }))}
              />
            </Form.Item>
          )}

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="开始时间" required>
                <DatePicker
                  showTime
                  format="YYYY-MM-DD HH:mm"
                  style={{ width: '100%' }}
                  value={startTime}
                  onChange={setStartTime}
                  placeholder="开始时间"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="结束时间" required>
                <DatePicker
                  showTime
                  format="YYYY-MM-DD HH:mm"
                  style={{ width: '100%' }}
                  value={endTime}
                  onChange={setEndTime}
                  placeholder="结束时间"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="时长（分钟，系统自动计算）">
            <Input value={computedDuration != null ? `${computedDuration} 分钟` : '请选择开始和结束时间'} disabled />
          </Form.Item>

          <Form.Item label="原因描述" name="reason" rules={[{ required: true, message: '请输入原因描述' }]}>
            <Input.TextArea rows={3} placeholder="请输入异常原因描述" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="异常记录详情"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={480}
      >
        {currentRecord && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="工单编号">{currentRecord.work_order_no}</Descriptions.Item>
            <Descriptions.Item label="订单编号">{currentRecord.order_no || '-'}</Descriptions.Item>
            <Descriptions.Item label="异常类型">{currentRecord.exception_type_name}</Descriptions.Item>
            <Descriptions.Item label="关联设备">{currentRecord.device_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="开始时间">{currentRecord.start_time}</Descriptions.Item>
            <Descriptions.Item label="结束时间">{currentRecord.end_time}</Descriptions.Item>
            <Descriptions.Item label="时长(分钟)">{currentRecord.duration}</Descriptions.Item>
            <Descriptions.Item label="异常原因">{currentRecord.reason}</Descriptions.Item>
            <Descriptions.Item label="记录人">{currentRecord.record_user_name}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </>
  )
}
