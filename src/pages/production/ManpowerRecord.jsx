import React, { useState, useEffect, useCallback } from 'react'
import { Table, Button, Modal, Form, Input, InputNumber, Select, DatePicker, Space, Row, Col, message, Drawer, Descriptions } from 'antd'
import {
  TeamOutlined, PlusOutlined, SearchOutlined, ReloadOutlined, EyeOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import api from '../../utils/api'

const shiftOptions = [
  { label: '白班', value: '白班' },
  { label: '夜班', value: '夜班' },
]

export default function ManpowerRecord() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [workOrders, setWorkOrders] = useState([])
  const [lines, setLines] = useState([])
  const [processes, setProcesses] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [currentRecord, setCurrentRecord] = useState(null)
  const [form] = Form.useForm()

  // 筛选输入态
  const [keywordInput, setKeywordInput] = useState('')
  const [workOrderInput, setWorkOrderInput] = useState(undefined)
  const [shiftInput, setShiftInput] = useState(undefined)
  // 已应用的查询条件
  const [query, setQuery] = useState({ page: 1, pageSize: 10, keyword: '', work_order_id: undefined, shift: undefined })

  // 获取人员记录列表
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const params = { page: query.page, pageSize: query.pageSize }
        if (query.keyword) params.keyword = query.keyword
        if (query.work_order_id) params.work_order_id = query.work_order_id
        if (query.shift) params.shift = query.shift
        const res = await api.get('/production/manpower-records', { params })
        if (cancelled) return
        const list = res.data || []
        setData(list)
        setTotal(res.total || list.length)
      } catch (err) {
        if (!cancelled) {
          message.error(err.message || '获取人员记录失败')
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

  // 获取工单、产线、工序
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const [woRes, linesRes, procRes] = await Promise.all([
          api.get('/production/work-orders', { params: { page: 1, pageSize: 1000 } }),
          api.get('/basic/production-lines', { params: { page: 1, pageSize: 1000 } }),
          api.get('/basic/processes', { params: { page: 1, pageSize: 1000 } }),
        ])
        if (cancelled) return
        setWorkOrders(woRes.data || [])
        setLines(linesRes.data || [])
        setProcesses(procRes.data || [])
      } catch (err) {
        if (!cancelled) message.error(err.message || '获取关联数据失败')
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  const refresh = useCallback(() => setQuery(q => ({ ...q })), [])

  const totalHours = data.reduce((s, r) => s + (Number(r.work_hours) || 0), 0)
  const totalQty = data.reduce((s, r) => s + (Number(r.qty) || 0), 0)

  const stats = [
    { label: '总记录数', value: total, icon: <TeamOutlined />, color: '#2196F3' },
    { label: '累计工时', value: totalHours.toLocaleString(), icon: <TeamOutlined />, color: '#FF9800' },
    { label: '累计产量', value: totalQty.toLocaleString(), icon: <TeamOutlined />, color: '#00BCD4' },
    { label: '当前页人数', value: data.length, icon: <TeamOutlined />, color: '#9C27B0' },
  ]

  const handleAdd = () => {
    form.resetFields()
    form.setFieldsValue({ shift: '白班', work_hours: 8, qty: 0, date: dayjs() })
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
      const line = lines.find(l => l.line_id === values.line_id)
      const process = processes.find(p => p.process_id === values.process_id)
      const payload = {
        work_order_id: values.work_order_id,
        work_order_no: workOrder?.work_order_no,
        line_id: values.line_id,
        line_name: line?.line_name,
        employee_no: values.employee_no,
        employee_name: values.employee_name,
        process_id: values.process_id,
        process_name: process?.process_name,
        shift: values.shift,
        work_hours: values.work_hours,
        qty: values.qty || 0,
        date: values.date ? values.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        remarks: values.remarks,
      }
      const res = await api.post('/production/manpower-records', payload)
      message.success(res.message || '人员投入记录已新增')
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
    setQuery(q => ({ ...q, page: 1, keyword: keywordInput, work_order_id: workOrderInput, shift: shiftInput }))
  }

  const handleReset = () => {
    setKeywordInput('')
    setWorkOrderInput(undefined)
    setShiftInput(undefined)
    setQuery(q => ({ ...q, page: 1, keyword: '', work_order_id: undefined, shift: undefined }))
  }

  const columns = [
    { title: '工单编号', dataIndex: 'work_order_no', key: 'work_order_no', width: 160, fixed: 'left' },
    { title: '员工工号', dataIndex: 'employee_no', key: 'employee_no', width: 100 },
    { title: '员工姓名', dataIndex: 'employee_name', key: 'employee_name', width: 100 },
    { title: '产线', dataIndex: 'line_name', key: 'line_name', width: 80 },
    { title: '工序', dataIndex: 'process_name', key: 'process_name', width: 100, render: v => v || '-' },
    { title: '班次', dataIndex: 'shift', key: 'shift', width: 80 },
    { title: '工时(小时)', dataIndex: 'work_hours', key: 'work_hours', width: 100, align: 'right', render: v => v || 0 },
    { title: '产量', dataIndex: 'qty', key: 'qty', width: 90, align: 'right', render: v => (v || 0).toLocaleString() },
    { title: '日期', dataIndex: 'date', key: 'date', width: 110, render: v => v ? String(v).substring(0, 10) : '-' },
    { title: '备注', dataIndex: 'remarks', key: 'remarks', width: 160, render: v => v || '-' },
    {
      title: '操作', key: 'action', width: 100, fixed: 'right',
      render: (_, r) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(r)}>查看</Button>
      ),
    },
  ]

  return (
    <>
      <ThreeSectionPage
        title="人员投入记录"
        breadcrumbs="生产管理 / 人员投入"
        stats={stats}
        actions={
          <ActionButtons
            hasAdd={false}
            hasExport={false}
            extra={[
              <Button key="reload" icon={<ReloadOutlined />} onClick={refresh}>刷新</Button>,
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
              <Col flex="140px">
                <Select
                  placeholder="班次筛选"
                  allowClear
                  style={{ width: '100%' }}
                  options={shiftOptions}
                  value={shiftInput}
                  onChange={setShiftInput}
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
        title="新增人员投入"
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
              <Form.Item label="产线" name="line_id" rules={[{ required: true, message: '请选择产线' }]}>
                <Select
                  placeholder="请选择产线"
                  options={lines.map(l => ({ label: l.line_name, value: l.line_id }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="员工工号" name="employee_no" rules={[{ required: true, message: '请输入员工工号' }]}>
                <Input placeholder="请输入员工工号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="员工姓名" name="employee_name" rules={[{ required: true, message: '请输入员工姓名' }]}>
                <Input placeholder="请输入员工姓名" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="工序" name="process_id">
                <Select
                  placeholder="请选择工序"
                  allowClear
                  options={processes.map(p => ({ label: `${p.process_code || ''} ${p.process_name || ''}`.trim(), value: p.process_id }))}
                />
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
              <Form.Item label="工时(小时)" name="work_hours" rules={[{ required: true, message: '请输入工时' }]}>
                <InputNumber min={0} step={0.5} style={{ width: '100%' }} placeholder="请输入工时" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="产量" name="qty">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入产量" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="日期" name="date" rules={[{ required: true, message: '请选择日期' }]}>
                <DatePicker format="YYYY-MM-DD" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="备注" name="remarks">
            <Input.TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="人员记录详情"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={480}
      >
        {currentRecord && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="工单编号">{currentRecord.work_order_no}</Descriptions.Item>
            <Descriptions.Item label="员工工号">{currentRecord.employee_no}</Descriptions.Item>
            <Descriptions.Item label="员工姓名">{currentRecord.employee_name}</Descriptions.Item>
            <Descriptions.Item label="产线">{currentRecord.line_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="工序">{currentRecord.process_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="班次">{currentRecord.shift || '-'}</Descriptions.Item>
            <Descriptions.Item label="工时(小时)">{currentRecord.work_hours || 0}</Descriptions.Item>
            <Descriptions.Item label="产量">{(currentRecord.qty || 0).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="日期">{currentRecord.date ? String(currentRecord.date).substring(0, 10) : '-'}</Descriptions.Item>
            <Descriptions.Item label="备注">{currentRecord.remarks || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </>
  )
}
