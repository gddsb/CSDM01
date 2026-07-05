import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Tag, Button, Modal, Form, Input, InputNumber, Select, Space, Row, Col,
  message, Drawer, Descriptions, DatePicker
} from 'antd'
import {
  ProfileOutlined, ClockCircleOutlined, PlusOutlined, SearchOutlined, ReloadOutlined, EyeOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import api from '../../utils/api'

const shiftOptions = [
  { label: '白班', value: '白班' },
  { label: '夜班', value: '夜班' },
]

export default function ProcessReporting() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [workOrders, setWorkOrders] = useState([])
  const [processes, setProcesses] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [viewRecord, setViewRecord] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [form] = Form.useForm()

  // 筛选输入态
  const [keywordInput, setKeywordInput] = useState('')
  const [processInput, setProcessInput] = useState(undefined)
  const [workOrderInput, setWorkOrderInput] = useState(undefined)
  // 已应用的查询条件
  const [query, setQuery] = useState({ page: 1, pageSize: 10, keyword: '', process_id: undefined, work_order_id: undefined })

  // 获取报工列表
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const params = { page: query.page, pageSize: query.pageSize }
        if (query.keyword) params.keyword = query.keyword
        if (query.process_id) params.process_id = query.process_id
        if (query.work_order_id) params.work_order_id = query.work_order_id
        const res = await api.get('/production/process-reports', { params })
        if (cancelled) return
        const list = res.data || []
        setData(list)
        setTotal(res.total || list.length)
      } catch (err) {
        if (!cancelled) {
          message.error(err.message || '获取报工列表失败')
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

  // 获取工单与工序
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const [woRes, procRes] = await Promise.all([
          api.get('/production/work-orders', { params: { page: 1, pageSize: 1000 } }),
          api.get('/basic/processes', { params: { page: 1, pageSize: 1000 } }),
        ])
        if (cancelled) return
        setWorkOrders(woRes.data || [])
        setProcesses(procRes.data || [])
      } catch (err) {
        if (!cancelled) message.error(err.message || '获取关联数据失败')
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  const refresh = useCallback(() => setQuery(q => ({ ...q })), [])

  const today = dayjs().format('YYYY-MM-DD')
  const todayCount = data.filter(r => r.report_time && String(r.report_time).startsWith(today)).length
  const totalQty = data.reduce((s, r) => s + (Number(r.qty) || 0), 0)
  const totalDefect = data.reduce((s, r) => s + (Number(r.defect_qty) || 0), 0)

  const stats = [
    { label: '总报工记录', value: total, icon: <ProfileOutlined />, color: '#2196F3' },
    { label: '今日报工', value: todayCount, icon: <ClockCircleOutlined />, color: '#00BCD4' },
    { label: '累计产量', value: totalQty.toLocaleString(), icon: <ProfileOutlined />, color: '#FF9800' },
    { label: '累计不良', value: totalDefect.toLocaleString(), icon: <ProfileOutlined />, color: '#F44336' },
  ]

  const handleAdd = () => {
    form.resetFields()
    form.setFieldsValue({ shift: '白班', qty: 0, defect_qty: 0 })
    setAddOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const workOrder = workOrders.find(w => w.work_order_id === values.work_order_id)
      const process = processes.find(p => p.process_id === values.process_id)
      const payload = {
        work_order_id: values.work_order_id,
        work_order_no: workOrder?.work_order_no,
        process_id: values.process_id,
        process_name: process?.process_name,
        operator: values.operator,
        shift: values.shift,
        qty: values.qty,
        defect_qty: values.defect_qty || 0,
        defect_details: values.defect_details,
        report_time: values.report_time ? values.report_time.format('YYYY-MM-DD HH:mm:ss') : dayjs().format('YYYY-MM-DD HH:mm:ss'),
        remarks: values.remarks,
      }
      const res = await api.post('/production/process-reports', payload)
      message.success(res.message || '报工记录已新增')
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
    setQuery(q => ({ ...q, page: 1, keyword: keywordInput, process_id: processInput, work_order_id: workOrderInput }))
  }

  const handleReset = () => {
    setKeywordInput('')
    setProcessInput(undefined)
    setWorkOrderInput(undefined)
    setQuery(q => ({ ...q, page: 1, keyword: '', process_id: undefined, work_order_id: undefined }))
  }

  const columns = [
    { title: '工单编号', dataIndex: 'work_order_no', key: 'work_order_no', width: 160 },
    { title: '工序', dataIndex: 'process_name', key: 'process_name', width: 120 },
    { title: '操作人', dataIndex: 'operator', key: 'operator', width: 100 },
    { title: '班次', dataIndex: 'shift', key: 'shift', width: 80, render: v => v || '-' },
    { title: '产量', dataIndex: 'qty', key: 'qty', width: 90, align: 'right', render: v => (v || 0).toLocaleString() },
    {
      title: '不良数量', dataIndex: 'defect_qty', key: 'defect_qty', width: 90, align: 'right',
      render: v => {
        const val = v || 0
        return <Tag color={val > 0 ? 'error' : 'default'}>{val}</Tag>
      }
    },
    { title: '不良明细', dataIndex: 'defect_details', key: 'defect_details', width: 200, render: v => v || '-' },
    { title: '报工时间', dataIndex: 'report_time', key: 'report_time', width: 160 },
    { title: '备注', dataIndex: 'remarks', key: 'remarks', width: 160, render: v => v || '-' },
    {
      title: '操作', key: 'action', width: 100,
      render: (_, r) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setViewRecord(r)}>查看</Button>
      ),
    },
  ]

  return (
    <>
      <ThreeSectionPage
        title="工序报工"
        breadcrumbs="生产管理 / 工序报工"
        stats={stats}
        actions={
          <ActionButtons
            hasAdd={false}
            hasExport={false}
            extra={[
              <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增报工</Button>,
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
              <Col flex="180px">
                <Select
                  placeholder="工单筛选"
                  allowClear
                  style={{ width: '100%' }}
                  options={workOrders.map(w => ({ label: w.work_order_no, value: w.work_order_id }))}
                  value={workOrderInput}
                  onChange={setWorkOrderInput}
                />
              </Col>
              <Col flex="180px">
                <Select
                  placeholder="工序筛选"
                  allowClear
                  style={{ width: '100%' }}
                  options={processes.map(p => ({ label: `${p.process_code || ''} ${p.process_name || ''}`.trim(), value: p.process_id }))}
                  value={processInput}
                  onChange={setProcessInput}
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
              rowKey="report_id"
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
        title="新增报工"
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
                  options={workOrders.map(w => ({ label: `${w.work_order_no} (订单: ${w.order_no || '-'})`, value: w.work_order_id }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="工序" name="process_id" rules={[{ required: true, message: '请选择工序' }]}>
                <Select
                  placeholder="请选择工序"
                  showSearch
                  optionFilterProp="label"
                  options={processes.map(p => ({ label: `${p.process_code || ''} ${p.process_name || ''}`.trim(), value: p.process_id }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="操作人" name="operator" rules={[{ required: true, message: '请输入操作人' }]}>
                <Input placeholder="请输入操作人姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="班次" name="shift" rules={[{ required: true, message: '请选择班次' }]}>
                <Select placeholder="请选择班次" options={shiftOptions} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="产量" name="qty" rules={[{ required: true, message: '请输入产量' }]}>
                <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入产量" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="不良数量" name="defect_qty">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入不良数量" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="不良明细" name="defect_details">
            <Input.TextArea rows={2} placeholder="请输入不良明细描述" />
          </Form.Item>
          <Form.Item label="报工时间" name="report_time">
            <DatePicker
              showTime
              format="YYYY-MM-DD HH:mm:ss"
              style={{ width: '100%' }}
              placeholder="默认为当前时间"
            />
          </Form.Item>
          <Form.Item label="备注" name="remarks">
            <Input.TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="报工详情"
        open={!!viewRecord}
        onClose={() => setViewRecord(null)}
        width={560}
      >
        {viewRecord && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="工单编号">{viewRecord.work_order_no}</Descriptions.Item>
            <Descriptions.Item label="工序">{viewRecord.process_name}</Descriptions.Item>
            <Descriptions.Item label="操作人">{viewRecord.operator}</Descriptions.Item>
            <Descriptions.Item label="班次">{viewRecord.shift || '-'}</Descriptions.Item>
            <Descriptions.Item label="产量">{(viewRecord.qty || 0).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="不良数量">{viewRecord.defect_qty || 0}</Descriptions.Item>
            <Descriptions.Item label="不良明细">{viewRecord.defect_details || '-'}</Descriptions.Item>
            <Descriptions.Item label="报工时间">{viewRecord.report_time || '-'}</Descriptions.Item>
            <Descriptions.Item label="备注">{viewRecord.remarks || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </>
  )
}
