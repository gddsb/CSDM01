import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Table, Button, Modal, Form, Input, InputNumber, Select, DatePicker, TimePicker, Space, Row, Col, message, Drawer, Descriptions, Popconfirm, Card } from 'antd'
import {
  TeamOutlined, PlusOutlined, SearchOutlined, ReloadOutlined, EyeOutlined, EditOutlined, DeleteOutlined,
  ClockCircleOutlined, UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import api from '../../utils/api'

const shiftOptions = [
  { label: '白班', value: '白班' },
  { label: '夜班', value: '夜班' },
  { label: '早班', value: '早班' },
  { label: '中班', value: '中班' },
]

export default function ManpowerRecord() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [workOrders, setWorkOrders] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [editing, setEditing] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [currentRecord, setCurrentRecord] = useState(null)
  const [form] = Form.useForm()

  const [keywordInput, setKeywordInput] = useState('')
  const [workOrderInput, setWorkOrderInput] = useState(undefined)
  const [dateRangeInput, setDateRangeInput] = useState(null)
  const [query, setQuery] = useState({ page: 1, pageSize: 30, keyword: '', work_order_id: undefined, dateStart: '', dateEnd: '' })

  const totalManHours = useMemo(
    () => data.reduce((s, r) => s + (Number(r.man_hours) || 0), 0),
    [data]
  )
  const totalPeopleDays = useMemo(
    () => data.reduce((s, r) => s + (Number(r.total_people) || 0), 0),
    [data]
  )

  const stats = [
    { label: '记录条数', value: total, icon: <TeamOutlined />, color: '#2196F3' },
    { label: '累计人工工时', value: totalManHours.toFixed(2), icon: <ClockCircleOutlined />, color: '#FF9800' },
    { label: '累计人天', value: totalPeopleDays, icon: <UserOutlined />, color: '#4CAF50' },
  ]

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const params = { page: query.page, pageSize: query.pageSize }
        if (query.work_order_id) params.work_order_id = query.work_order_id
        if (query.dateStart) params.dateStart = query.dateStart
        if (query.dateEnd) params.dateEnd = query.dateEnd
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

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const woRes = await api.get('/production/work-orders', { params: { page: 1, pageSize: 500 } })
        if (cancelled) return
        setWorkOrders(woRes.data || [])
      } catch (err) {
        if (!cancelled) console.error('获取工单失败:', err)
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  const refresh = useCallback(() => setQuery(q => ({ ...q })), [])

  const handleSearch = () => {
    setQuery(q => ({
      ...q,
      page: 1,
      work_order_id: workOrderInput,
      dateStart: dateRangeInput?.[0] ? dateRangeInput[0].format('YYYY-MM-DD') : '',
      dateEnd: dateRangeInput?.[1] ? dateRangeInput[1].format('YYYY-MM-DD') : '',
    }))
  }

  const handleReset = () => {
    setKeywordInput('')
    setWorkOrderInput(undefined)
    setDateRangeInput(null)
    setQuery(q => ({ page: 1, pageSize: 30, work_order_id: undefined, dateStart: '', dateEnd: '' }))
  }

  const handleAdd = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      record_date: dayjs(),
      shift: '白班',
      start_time: dayjs().hour(8).minute(0).second(0),
      end_time: dayjs().hour(17).minute(0).second(0),
      skilled_count: 0,
      general_count: 0,
      labor_count: 0,
      other_count: 0,
    })
    setModalVisible(true)
  }

  const handleEdit = (record) => {
    setEditing(record)
    form.setFieldsValue({
      work_order_id: record.work_order_id,
      record_date: record.record_date ? dayjs(record.record_date) : null,
      shift: record.shift,
      start_time: record.start_time ? dayjs(record.start_time) : null,
      end_time: record.end_time ? dayjs(record.end_time) : null,
      skilled_count: record.skilled_count || 0,
      general_count: record.general_count || 0,
      labor_count: record.labor_count || 0,
      other_count: record.other_count || 0,
      remarks: record.remarks,
    })
    setModalVisible(true)
  }

  const handleView = (r) => {
    setCurrentRecord(r)
    setDetailOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const payload = {
        work_order_id: values.work_order_id,
        record_date: values.record_date ? values.record_date.format('YYYY-MM-DD') : null,
        shift: values.shift,
        start_time: values.start_time ? values.start_time.format('YYYY-MM-DD HH:mm:ss') : null,
        end_time: values.end_time ? values.end_time.format('YYYY-MM-DD HH:mm:ss') : null,
        skilled_count: values.skilled_count || 0,
        general_count: values.general_count || 0,
        labor_count: values.labor_count || 0,
        other_count: values.other_count || 0,
        remarks: values.remarks,
      }
      if (editing) {
        const res = await api.put(`/production/manpower-records/${editing.record_id}`, payload)
        message.success(res.message || '修改成功')
      } else {
        const res = await api.post('/production/manpower-records', payload)
        message.success(res.message || '新增成功')
      }
      setModalVisible(false)
      refresh()
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (record) => {
    try {
      const res = await api.delete(`/production/manpower-records/${record.record_id}`)
      message.success(res.message || '删除成功')
      refresh()
    } catch (err) {
      message.error(err.message || '删除失败')
    }
  }

  const columns = [
    { title: '记录日期', dataIndex: 'record_date', key: 'record_date', width: 120, fixed: 'left' },
    { title: '工单编号', dataIndex: 'work_order_no', key: 'work_order_no', width: 160 },
    { title: '班次', dataIndex: 'shift', key: 'shift', width: 80 },
    {
      title: '开始时间', dataIndex: 'start_time', key: 'start_time', width: 140,
      render: v => v ? String(v).substring(0, 16) : '-',
    },
    {
      title: '结束时间', dataIndex: 'end_time', key: 'end_time', width: 140,
      render: v => v ? String(v).substring(0, 16) : '-',
    },
    { title: '工时(h)', dataIndex: 'hours', key: 'hours', width: 80, align: 'right', render: v => Number(v || 0).toFixed(2) },
    { title: '技工', dataIndex: 'skilled_count', key: 'skilled_count', width: 70, align: 'right', render: v => v || 0 },
    { title: '普通', dataIndex: 'general_count', key: 'general_count', width: 70, align: 'right', render: v => v || 0 },
    { title: '劳务', dataIndex: 'labor_count', key: 'labor_count', width: 70, align: 'right', render: v => v || 0 },
    { title: '其他', dataIndex: 'other_count', key: 'other_count', width: 70, align: 'right', render: v => v || 0 },
    { title: '总人数', dataIndex: 'total_people', key: 'total_people', width: 80, align: 'right', render: v => v || 0 },
    { title: '人工工时(h)', dataIndex: 'man_hours', key: 'man_hours', width: 110, align: 'right', render: v => Number(v || 0).toFixed(2) },
    { title: '备注', dataIndex: 'remarks', key: 'remarks', width: 150, render: v => v || '-' },
    {
      title: '操作', key: 'action', width: 160, fixed: 'right',
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(r)}>查看</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>编辑</Button>
          <Popconfirm title="确定删除该条记录？" onConfirm={() => handleDelete(r)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const filters = [
    { type: 'input', placeholder: '搜索工单号', col: { span: 5 }, value: keywordInput, onChange: e => setKeywordInput(e.target.value) },
    {
      type: 'select', placeholder: '工单筛选', col: { span: 5 },
      options: workOrders.map(w => ({ label: w.work_order_no, value: w.work_order_id })),
      value: workOrderInput, onChange: setWorkOrderInput,
    },
  ]

  return (
    <>
      <ThreeSectionPage
        title="人员记录"
        breadcrumbs="生产管理 / 人员记录"
        stats={stats}
        filters={filters}
        onSearch={handleSearch}
        onReset={handleReset}
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
              <Col flex="240px">
                <DatePicker.RangePicker
                  style={{ width: '100%' }}
                  value={dateRangeInput}
                  onChange={setDateRangeInput}
                  placeholder={['开始日期', '结束日期']}
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
        title={editing ? '编辑人员记录' : '新增人员记录'}
        open={modalVisible}
        onOk={handleSubmit}
        confirmLoading={submitting}
        onCancel={() => setModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={680}
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
              <Form.Item label="记录日期" name="record_date" rules={[{ required: true, message: '请选择日期' }]}>
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="班次" name="shift" rules={[{ required: true, message: '请选择班次' }]}>
                <Select options={shiftOptions} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="开始时间" name="start_time" rules={[{ required: true, message: '请选择开始时间' }]}>
                <TimePicker style={{ width: '100%' }} format="HH:mm" minuteStep={5} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="结束时间" name="end_time" rules={[{ required: true, message: '请选择结束时间' }]}>
                <TimePicker style={{ width: '100%' }} format="HH:mm" minuteStep={5} />
              </Form.Item>
            </Col>
          </Row>

          <Card size="small" title="人员数量" style={{ marginBottom: 12 }}>
            <Row gutter={12}>
              <Col span={6}>
                <Form.Item label="技工(人)" name="skilled_count">
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="普通(人)" name="general_count">
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="劳务(人)" name="labor_count">
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="其他(人)" name="other_count">
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <div style={{ color: '#666', fontSize: 12, marginTop: -4 }}>
              💡 工时 = 结束时间 - 开始时间；人工工时 = 工时 × 总人数（由系统自动计算）
            </div>
          </Card>

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
            <Descriptions.Item label="记录日期">{currentRecord.record_date || '-'}</Descriptions.Item>
            <Descriptions.Item label="工单编号">{currentRecord.work_order_no}</Descriptions.Item>
            <Descriptions.Item label="班次">{currentRecord.shift || '-'}</Descriptions.Item>
            <Descriptions.Item label="开始时间">{currentRecord.start_time ? String(currentRecord.start_time).substring(0, 16) : '-'}</Descriptions.Item>
            <Descriptions.Item label="结束时间">{currentRecord.end_time ? String(currentRecord.end_time).substring(0, 16) : '-'}</Descriptions.Item>
            <Descriptions.Item label="单班工时(h)">{Number(currentRecord.hours || 0).toFixed(2)}</Descriptions.Item>
            <Descriptions.Item label="技工(人)">{currentRecord.skilled_count || 0}</Descriptions.Item>
            <Descriptions.Item label="普通(人)">{currentRecord.general_count || 0}</Descriptions.Item>
            <Descriptions.Item label="劳务(人)">{currentRecord.labor_count || 0}</Descriptions.Item>
            <Descriptions.Item label="其他(人)">{currentRecord.other_count || 0}</Descriptions.Item>
            <Descriptions.Item label="总人数(人)">{currentRecord.total_people || 0}</Descriptions.Item>
            <Descriptions.Item label="人工工时(h)"><b>{Number(currentRecord.man_hours || 0).toFixed(2)}</b></Descriptions.Item>
            <Descriptions.Item label="记录人">{currentRecord.record_user_name || currentRecord.record_user || '-'}</Descriptions.Item>
            <Descriptions.Item label="备注">{currentRecord.remarks || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </>
  )
}
