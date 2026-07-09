import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Tag, Button, Modal, Form, Input, Select, DatePicker, Space, Row, Col, message, Drawer, Descriptions
} from 'antd'
import {
  BellOutlined, ToolOutlined, SyncOutlined, ClockCircleOutlined,
  PlusOutlined, SearchOutlined, ReloadOutlined, EyeOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import api from '../../utils/api'

// 状态类型定义
const exceptionTypes = [
  { code: 'E01', name: '换型换线' },
  { code: 'E02', name: '停机待料' },
  { code: 'E03', name: '设备调整' },
  { code: 'E04', name: '故障维修' },
]
const exceptionTypeColorMap = {
  'E01': 'warning',
  'E02': 'default',
  'E03': 'processing',
  'E04': 'error',
}
const exceptionTypeOptions = exceptionTypes.map(e => ({ label: `${e.code} ${e.name}`, value: e.code }))

export default function ExceptionRecord() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [workOrders, setWorkOrders] = useState([])
  const [devices, setDevices] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [currentRecord, setCurrentRecord] = useState(null)
  const [form] = Form.useForm()

  // 筛选输入态
  const [keywordInput, setKeywordInput] = useState('')
  const [excTypeInput, setExcTypeInput] = useState(undefined)
  // 已应用的查询条件
  const [query, setQuery] = useState({ page: 1, pageSize: 30, keyword: '', exception_type: undefined })

  // 获取工时记录列表
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const params = { page: query.page, pageSize: query.pageSize }
        if (query.keyword) params.keyword = query.keyword
        if (query.exception_type) params.exception_type = query.exception_type
        const res = await api.get('/production/exceptions', { params })
        if (cancelled) return
        const list = res.data || []
        setData(list)
        setTotal(res.total || list.length)
      } catch (err) {
        if (!cancelled) {
          message.error(err.message || '获取工时记录失败')
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

  // 获取工单和设备
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const [woRes, devRes] = await Promise.all([
          api.get('/production/work-orders', { params: { page: 1, pageSize: 1000 } }),
          api.get('/basic/devices', { params: { page: 1, pageSize: 1000 } }),
        ])
        if (cancelled) return
        setWorkOrders(woRes.data || [])
        setDevices(devRes.data || [])
      } catch (err) {
        if (!cancelled) message.error(err.message || '获取关联数据失败')
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  const refresh = useCallback(() => setQuery(q => ({ ...q })), [])

  const faultRepairCount = data.filter(r => r.exception_type === 'E04').length
  const changeoverCount = data.filter(r => r.exception_type === 'E01').length

  const stats = [
    { label: '总工时记录', value: total, icon: <BellOutlined />, color: '#2196F3' },
    { label: '故障维修数', value: faultRepairCount, icon: <ToolOutlined />, color: '#F44336' },
    { label: '换型换线数', value: changeoverCount, icon: <SyncOutlined />, color: '#FF9800' },
    { label: '停机待料数', value: data.filter(r => r.exception_type === 'E02').length, icon: <ClockCircleOutlined />, color: '#00BCD4' },
  ]

  const handleAdd = () => {
    form.resetFields()
    form.setFieldsValue({ exception_type: 'E01' })
    setAddOpen(true)
  }

  const handleView = (r) => {
    setCurrentRecord(r)
    setDetailOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const workOrder = workOrders.find(w => w.work_order_id === values.work_order_id)
      const excTypeObj = exceptionTypes.find(e => e.code === values.exception_type)
      const payload = {
        work_order_id: values.work_order_id,
        exception_type: values.exception_type,
        exception_type_name: excTypeObj?.name,
        device_id: values.exception_type === 'E04' ? values.device_id : undefined,
        start_time: values.start_time ? values.start_time.format('YYYY-MM-DD HH:mm') : undefined,
        end_time: values.end_time ? values.end_time.format('YYYY-MM-DD HH:mm') : undefined,
        reason: values.reason,
        handle_result: values.handle_result,
        record_user_name: values.record_user_name,
      }
      const res = await api.post('/production/exceptions', payload)
      message.success(res.message || '工时记录已新增')
      setAddOpen(false)
      refresh()
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSearch = () => {
    setQuery(q => ({ ...q, page: 1, keyword: keywordInput, exception_type: excTypeInput }))
  }

  const handleReset = () => {
    setKeywordInput('')
    setExcTypeInput(undefined)
    setQuery(q => ({ ...q, page: 1, keyword: '', exception_type: undefined }))
  }

  const columns = [
    { title: '工单编号', dataIndex: 'work_order_no', key: 'work_order_no', width: 140, fixed: 'left' },
    { title: '产线', dataIndex: 'line_name', key: 'line_name', width: 80, render: v => v || '-' },
    {
      title: '状态类型', key: 'exc_type', width: 120,
      render: (_, r) => {
        const t = exceptionTypes.find(e => e.code === r.exception_type)
        return <Tag color={exceptionTypeColorMap[r.exception_type]}>{t?.name || r.exception_type || '-'}</Tag>
      },
    },
    {
      title: '设备编号', key: 'device', width: 140,
      render: (_, r) => r.exception_type === 'E04' ? (r.device_name || '-') : <span style={{ color: '#ccc' }}>-</span>,
    },
    {
      title: '开始时间', dataIndex: 'start_time', key: 'start_time', width: 140,
      render: v => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-',
    },
    { title: '状态描述', dataIndex: 'reason', key: 'reason', width: 200, ellipsis: true, render: v => v || '-' },
    {
      title: '恢复时间', dataIndex: 'end_time', key: 'end_time', width: 140,
      render: v => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-',
    },
    { title: '过程简介', dataIndex: 'handle_result', key: 'handle_result', width: 200, ellipsis: true, render: v => v || '-' },
    { title: '处置人', dataIndex: 'record_user_name', key: 'record_user_name', width: 90, render: v => v || '-' },
    {
      title: '操作', key: 'action', width: 80, fixed: 'right',
      render: (_, r) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(r)}>查看</Button>
      ),
    },
  ]

  const selectedExcType = Form.useWatch('exception_type', form)
  const selectedWoId = Form.useWatch('work_order_id', form)
  const selectedWo = workOrders.find(w => w.work_order_id === selectedWoId)

  return (
    <>
      <ThreeSectionPage
        title="工时记录"
        breadcrumbs="生产管理 / 工时记录"
        stats={stats}
        actions={
          <ActionButtons
            hasAdd={false}
            hasExport={false}
            extra={[
              <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增记录</Button>,
            ]}
          />
        }
        table={
          <div>
            <Row gutter={[12, 8]} style={{ marginBottom: 12 }}>
              <Col flex="200px">
                <Input
                  placeholder="搜索工单编号"
                  allowClear
                  prefix={<SearchOutlined />}
                  value={keywordInput}
                  onChange={e => setKeywordInput(e.target.value)}
                  onPressEnter={handleSearch}
                />
              </Col>
              <Col flex="160px">
                <Select
                  placeholder="状态类型筛选"
                  allowClear
                  style={{ width: '100%' }}
                  options={exceptionTypeOptions}
                  value={excTypeInput}
                  onChange={setExcTypeInput}
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
              rowKey="record_id"
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
        title="新增工时记录"
        open={addOpen}
        onOk={handleSubmit}
        confirmLoading={submitting}
        onCancel={() => setAddOpen(false)}
        okText="保存"
        cancelText="取消"
        width={640}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="工单" name="work_order_id" rules={[{ required: true, message: '请选择工单' }]}>
                <Select
                  placeholder="请选择工单"
                  showSearch
                  optionFilterProp="label"
                  options={workOrders.map(w => ({ label: w.work_order_no, value: w.work_order_id }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="产线">
                <Input value={selectedWo?.line_name || '-'} disabled placeholder="选择工单后自动填充" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="状态类型" name="exception_type" rules={[{ required: true, message: '请选择状态类型' }]}>
                <Select placeholder="请选择状态类型" options={exceptionTypeOptions} />
              </Form.Item>
            </Col>
            <Col span={12}>
              {selectedExcType === 'E04' && (
                <Form.Item label="设备编号" name="device_id" rules={[{ required: true, message: '请选择设备' }]}>
                  <Select
                    placeholder="请选择设备"
                    showSearch
                    optionFilterProp="label"
                    options={devices.map(d => ({ label: `${d.device_code || ''} ${d.device_name || ''}`.trim(), value: d.device_id }))}
                  />
                </Form.Item>
              )}
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="开始时间" name="start_time" rules={[{ required: true, message: '请选择开始时间' }]}>
                <DatePicker
                  showTime={{ format: 'HH:mm', minuteStep: 5 }}
                  format="YYYY-MM-DD HH:mm"
                  style={{ width: '100%' }}
                  placeholder="请选择开始时间"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="恢复时间" name="end_time">
                <DatePicker
                  showTime={{ format: 'HH:mm', minuteStep: 5 }}
                  format="YYYY-MM-DD HH:mm"
                  style={{ width: '100%' }}
                  placeholder="请选择恢复时间"
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="状态描述" name="reason" rules={[{ required: true, message: '请输入状态描述' }]}>
            <Input.TextArea rows={3} placeholder="请输入状态描述" />
          </Form.Item>
          <Form.Item label="过程简介" name="handle_result">
            <Input.TextArea rows={2} placeholder="请输入过程简介" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="处置人" name="record_user_name">
                <Input placeholder="请输入处置人姓名" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Drawer
        title="工时记录详情"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={520}
      >
        {currentRecord && (() => {
          const t = exceptionTypes.find(e => e.code === currentRecord.exception_type)
          return (
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="工单编号">{currentRecord.work_order_no}</Descriptions.Item>
              <Descriptions.Item label="产线">{currentRecord.line_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="状态类型">{t?.name || currentRecord.exception_type || '-'}</Descriptions.Item>
              <Descriptions.Item label="设备编号">{currentRecord.exception_type === 'E04' ? (currentRecord.device_name || '-') : '-'}</Descriptions.Item>
              <Descriptions.Item label="开始时间">{currentRecord.start_time ? dayjs(currentRecord.start_time).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
              <Descriptions.Item label="恢复时间">{currentRecord.end_time ? dayjs(currentRecord.end_time).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
              <Descriptions.Item label="状态描述">{currentRecord.reason || '-'}</Descriptions.Item>
              <Descriptions.Item label="过程简介">{currentRecord.handle_result || '-'}</Descriptions.Item>
              <Descriptions.Item label="处置人">{currentRecord.record_user_name || '-'}</Descriptions.Item>
            </Descriptions>
          )
        })()}
      </Drawer>
    </>
  )
}
