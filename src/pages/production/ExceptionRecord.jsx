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

// 异常类型定义
const exceptionTypes = [
  { code: 'E01', name: '换型调机' },
  { code: 'E02', name: '清场' },
  { code: 'E03', name: '停机待料' },
  { code: 'E04', name: '设备故障' },
]
const exceptionTypeColorMap = {
  'E01': 'warning',
  'E02': 'default',
  'E03': 'processing',
  'E04': 'error',
}
const exceptionTypeOptions = exceptionTypes.map(e => ({ label: `${e.code} ${e.name}`, value: e.code }))

const statusColorMap = {
  '待处理': 'default',
  '处理中': 'processing',
  '已处理': 'success',
}

export default function ExceptionRecord() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [workOrders, setWorkOrders] = useState([])
  const [lines, setLines] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [currentRecord, setCurrentRecord] = useState(null)
  const [form] = Form.useForm()

  // 筛选输入态
  const [keywordInput, setKeywordInput] = useState('')
  const [excTypeInput, setExcTypeInput] = useState(undefined)
  const [statusInput, setStatusInput] = useState(undefined)
  // 已应用的查询条件
  const [query, setQuery] = useState({ page: 1, pageSize: 10, keyword: '', exception_type: undefined, status: undefined })

  // 获取异常列表
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const params = { page: query.page, pageSize: query.pageSize }
        if (query.keyword) params.keyword = query.keyword
        if (query.exception_type) params.exception_type = query.exception_type
        if (query.status) params.status = query.status
        const res = await api.get('/production/exceptions', { params })
        if (cancelled) return
        const list = res.data || []
        setData(list)
        setTotal(res.total || list.length)
      } catch (err) {
        if (!cancelled) {
          message.error(err.message || '获取异常记录失败')
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

  // 获取工单和产线
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const [woRes, linesRes] = await Promise.all([
          api.get('/production/work-orders', { params: { page: 1, pageSize: 1000 } }),
          api.get('/basic/production-lines', { params: { page: 1, pageSize: 1000 } }),
        ])
        if (cancelled) return
        setWorkOrders(woRes.data || [])
        setLines(linesRes.data || [])
      } catch (err) {
        if (!cancelled) message.error(err.message || '获取关联数据失败')
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  const refresh = useCallback(() => setQuery(q => ({ ...q })), [])

  const deviceFaultCount = data.filter(r => r.exception_type === 'E04').length
  const changeoverCount = data.filter(r => r.exception_type === 'E01').length

  const stats = [
    { label: '总异常记录', value: total, icon: <BellOutlined />, color: '#2196F3' },
    { label: '设备故障数', value: deviceFaultCount, icon: <ToolOutlined />, color: '#F44336' },
    { label: '换型调机数', value: changeoverCount, icon: <SyncOutlined />, color: '#FF9800' },
    { label: '待处理数', value: data.filter(r => r.status === '待处理').length, icon: <ClockCircleOutlined />, color: '#00BCD4' },
  ]

  const handleAdd = () => {
    form.resetFields()
    form.setFieldsValue({ exception_type: 'E01', handle_time: dayjs() })
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
      const excTypeObj = exceptionTypes.find(e => e.code === values.exception_type)
      const payload = {
        work_order_id: values.work_order_id,
        work_order_no: workOrder?.work_order_no,
        line_id: values.line_id,
        line_name: line?.line_name,
        exception_type: values.exception_type,
        exception_desc: values.exception_desc,
        handler: values.handler,
        handle_time: values.handle_time ? values.handle_time.format('YYYY-MM-DD HH:mm') : dayjs().format('YYYY-MM-DD HH:mm'),
        handle_result: values.handle_result,
        remarks: values.remarks,
      }
      const res = await api.post('/production/exceptions', payload)
      message.success(res.message || '异常记录已新增')
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
    setQuery(q => ({ ...q, page: 1, keyword: keywordInput, exception_type: excTypeInput, status: statusInput }))
  }

  const handleReset = () => {
    setKeywordInput('')
    setExcTypeInput(undefined)
    setStatusInput(undefined)
    setQuery(q => ({ ...q, page: 1, keyword: '', exception_type: undefined, status: undefined }))
  }

  const columns = [
    { title: '工单编号', dataIndex: 'work_order_no', key: 'work_order_no', width: 150, fixed: 'left' },
    { title: '产线', dataIndex: 'line_name', key: 'line_name', width: 80, render: v => v || '-' },
    {
      title: '异常类型', key: 'exc_type', width: 140,
      render: (_, r) => {
        const t = exceptionTypes.find(e => e.code === r.exception_type)
        return <Tag color={exceptionTypeColorMap[r.exception_type]}>{r.exception_type} {t?.name || ''}</Tag>
      },
    },
    { title: '异常描述', dataIndex: 'exception_desc', key: 'exception_desc', width: 220, render: v => v || '-' },
    { title: '处理人', dataIndex: 'handler', key: 'handler', width: 100, render: v => v || '-' },
    { title: '处理时间', dataIndex: 'handle_time', key: 'handle_time', width: 150, render: v => v || '-' },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: v => v ? <Tag color={statusColorMap[v] || 'default'}>{v}</Tag> : '-'
    },
    { title: '处理结果', dataIndex: 'handle_result', key: 'handle_result', width: 200, render: v => v || '-' },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 160, render: v => v || '-' },
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
        title="异常工时记录"
        breadcrumbs="生产管理 / 异常工时"
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
              <Col flex="160px">
                <Select
                  placeholder="异常类型筛选"
                  allowClear
                  style={{ width: '100%' }}
                  options={exceptionTypeOptions}
                  value={excTypeInput}
                  onChange={setExcTypeInput}
                />
              </Col>
              <Col flex="140px">
                <Select
                  placeholder="状态筛选"
                  allowClear
                  style={{ width: '100%' }}
                  options={[
                    { label: '待处理', value: '待处理' },
                    { label: '处理中', value: '处理中' },
                    { label: '已处理', value: '已处理' },
                  ]}
                  value={statusInput}
                  onChange={setStatusInput}
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
              rowKey="exception_id"
              size="small"
              loading={loading}
              scroll={{ x: 1400 }}
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
        title="新增异常工时"
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
              <Form.Item label="异常类型" name="exception_type" rules={[{ required: true, message: '请选择异常类型' }]}>
                <Select placeholder="请选择异常类型" options={exceptionTypeOptions} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="处理人" name="handler">
                <Input placeholder="请输入处理人姓名" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="异常描述" name="exception_desc" rules={[{ required: true, message: '请输入异常描述' }]}>
            <Input.TextArea rows={3} placeholder="请输入异常描述" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="处理时间" name="handle_time">
                <DatePicker
                  showTime
                  format="YYYY-MM-DD HH:mm"
                  style={{ width: '100%' }}
                  placeholder="请选择处理时间"
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="处理结果" name="handle_result">
            <Input.TextArea rows={2} placeholder="请输入处理结果" />
          </Form.Item>
          <Form.Item label="备注" name="remarks">
            <Input.TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="异常记录详情"
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
              <Descriptions.Item label="异常类型">{currentRecord.exception_type} {t?.name || ''}</Descriptions.Item>
              <Descriptions.Item label="异常描述">{currentRecord.exception_desc || '-'}</Descriptions.Item>
              <Descriptions.Item label="处理人">{currentRecord.handler || '-'}</Descriptions.Item>
              <Descriptions.Item label="处理时间">{currentRecord.handle_time || '-'}</Descriptions.Item>
              <Descriptions.Item label="状态">{currentRecord.status ? <Tag color={statusColorMap[currentRecord.status] || 'default'}>{currentRecord.status}</Tag> : '-'}</Descriptions.Item>
              <Descriptions.Item label="处理结果">{currentRecord.handle_result || '-'}</Descriptions.Item>
              <Descriptions.Item label="备注">{currentRecord.remarks || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{currentRecord.created_at || '-'}</Descriptions.Item>
            </Descriptions>
          )
        })()}
      </Drawer>
    </>
  )
}
