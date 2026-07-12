import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Table, Button, Modal, Form, Input, InputNumber, Select, DatePicker, TimePicker, Space, Row, Col, message, Drawer, Descriptions, Popconfirm, Card, Tag,
} from 'antd'
import {
  TeamOutlined, PlusOutlined, SearchOutlined, ReloadOutlined, EyeOutlined, EditOutlined, DeleteOutlined,
  ClockCircleOutlined, UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import api from '../../utils/api'

const woStatusColorMap = {
  '开立': 'default',
  '开工': 'processing',
  '完工': 'success',
}

const shiftOptions = [
  { label: '白班', value: '白班' },
  { label: '夜班', value: '夜班' },
  { label: '早班', value: '早班' },
  { label: '中班', value: '中班' },
]

export default function ManpowerRecord() {
  const [summaryData, setSummaryData] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)

  const [selectedWO, setSelectedWO] = useState(null)
  const [detailList, setDetailList] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)

  const [keywordInput, setKeywordInput] = useState('')
  const [statusInput, setStatusInput] = useState('')
  const [query, setQuery] = useState({ page: 1, pageSize: 20, keyword: '', status: '' })

  const [submitting, setSubmitting] = useState(false)
  const [editing, setEditing] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [currentRecord, setCurrentRecord] = useState(null)
  const [form] = Form.useForm()

  const totalManHours = useMemo(
    () => summaryData.reduce((s, r) => s + (Number(r.total_man_hours) || 0), 0),
    [summaryData]
  )
  const totalPeople = useMemo(
    () => summaryData.reduce((s, r) => s + (Number(r.total_people) || 0), 0),
    [summaryData]
  )

  const stats = [
    { label: '工单数量', value: total, icon: <TeamOutlined />, color: '#2196F3' },
    { label: '累计人工工时', value: totalManHours.toFixed(2), icon: <ClockCircleOutlined />, color: '#FF9800' },
    { label: '累计投入人数', value: totalPeople, icon: <UserOutlined />, color: '#4CAF50' },
  ]

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const params = { page: query.page, pageSize: query.pageSize }
        if (query.keyword) params.keyword = query.keyword
        if (query.status) params.status = query.status
        const res = await api.get('/production/manpower-records/summary/by-work-order', { params })
        if (cancelled) return
        setSummaryData(res.data || [])
        setTotal(res.total || 0)
      } catch (err) {
        if (!cancelled) {
          message.error(err.message || '获取人员记录失败')
          setSummaryData([])
          setTotal(0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [query])

  const fetchDetail = useCallback(async (woId) => {
    setDetailLoading(true)
    try {
      const res = await api.get('/production/manpower-records', {
        params: { work_order_id: woId, page: 1, pageSize: 1000 },
      })
      setDetailList(res.data || [])
    } catch (err) {
      message.error(err.message || '获取明细失败')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const handleViewDetail = (record) => {
    setSelectedWO(record)
    fetchDetail(record.work_order_id)
    setDetailOpen(true)
  }

  const handleSearch = () => {
    setQuery(q => ({
      ...q,
      page: 1,
      keyword: keywordInput,
      status: statusInput,
    }))
  }

  const handleReset = () => {
    setKeywordInput('')
    setStatusInput('')
    setQuery(q => ({ page: 1, pageSize: 20, keyword: '', status: '' }))
  }

  const handleAdd = () => {
    if (!selectedWO) {
      message.warning('请先选择一个工单')
      return
    }
    setEditing(null)
    form.resetFields()
    const recordDate = selectedWO.plan_start_time ? dayjs(selectedWO.plan_start_time) : dayjs()
    form.setFieldsValue({
      work_order_id: selectedWO.work_order_id,
      record_date: recordDate,
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
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const recordDate = values.record_date
      const startTime = values.start_time
        ? recordDate
            .hour(values.start_time.hour())
            .minute(values.start_time.minute())
            .second(0)
        : null
      const endTime = values.end_time
        ? recordDate
            .hour(values.end_time.hour())
            .minute(values.end_time.minute())
            .second(0)
        : null
      const payload = {
        work_order_id: values.work_order_id,
        record_date: recordDate ? recordDate.format('YYYY-MM-DD') : null,
        shift: values.shift,
        start_time: startTime ? startTime.format('YYYY-MM-DD HH:mm:ss') : null,
        end_time: endTime ? endTime.format('YYYY-MM-DD HH:mm:ss') : null,
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
      if (selectedWO) {
        fetchDetail(selectedWO.work_order_id)
      }
      setQuery(q => ({ ...q }))
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
      if (selectedWO) {
        fetchDetail(selectedWO.work_order_id)
      }
      setQuery(q => ({ ...q }))
    } catch (err) {
      message.error(err.message || '删除失败')
    }
  }

  const columns = [
    { title: '工单编号', dataIndex: 'work_order_no', key: 'work_order_no', width: 140, fixed: 'left' },
    { title: '订单编号', dataIndex: 'order_no', key: 'order_no', width: 140 },
    {
      title: '总工时(h)',
      dataIndex: 'total_hours',
      key: 'total_hours',
      width: 100,
      align: 'right',
      render: v => Number(v || 0).toFixed(2),
    },
    { title: '技工人数', dataIndex: 'skilled_count', key: 'skilled_count', width: 80, align: 'right', render: v => v || 0 },
    { title: '普工人数', dataIndex: 'general_count', key: 'general_count', width: 80, align: 'right', render: v => v || 0 },
    { title: '劳务人数', dataIndex: 'labor_count', key: 'labor_count', width: 80, align: 'right', render: v => v || 0 },
    { title: '其他人数', dataIndex: 'other_count', key: 'other_count', width: 80, align: 'right', render: v => v || 0 },
    { title: '总人数', dataIndex: 'total_people', key: 'total_people', width: 80, align: 'right', render: v => v || 0 },
    { title: '累计人工工时(h)', dataIndex: 'total_man_hours', key: 'total_man_hours', width: 120, align: 'right', render: v => Number(v || 0).toFixed(2) },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 70,
      align: 'center',
      render: v => <Tag color={woStatusColorMap[v] || 'default'}>{v}</Tag>,
    },
    {
      title: '开工时间',
      dataIndex: 'start_time',
      key: 'start_time',
      width: 140,
      render: v => v ? String(v).substring(0, 16).replace('T', ' ') : '-',
    },
    {
      title: '完工时间',
      dataIndex: 'finish_time',
      key: 'finish_time',
      width: 140,
      render: v => v ? String(v).substring(0, 16).replace('T', ' ') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(r)}>查看明细</Button>
          {r.status === '开工' && (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setSelectedWO(r); handleAdd() }}>新增记录</Button>
          )}
        </Space>
      ),
    },
  ]

  const detailColumns = [
    { title: '记录日期', dataIndex: 'record_date', key: 'record_date', width: 120 },
    { title: '班次', dataIndex: 'shift', key: 'shift', width: 80 },
    {
      title: '开始时间', dataIndex: 'start_time', key: 'start_time', width: 140,
      render: v => v ? String(v).substring(0, 16).replace('T', ' ') : '-',
    },
    {
      title: '结束时间', dataIndex: 'end_time', key: 'end_time', width: 140,
      render: v => v ? String(v).substring(0, 16).replace('T', ' ') : '-',
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
      title: '操作', key: 'action', width: 140, fixed: 'right',
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleView(r)}>查看</Button>
          {selectedWO?.status === '开工' && (
            <Button type="link" size="small" onClick={() => handleEdit(r)}>编辑</Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <>
      <ThreeSectionPage
        title="人员记录"
        breadcrumbs="生产管理 / 人员记录"
        stats={stats}
        actions={
          <ActionButtons
            hasAdd={false}
            hasExport={false}
          />
        }
        table={
          <div>
            <Row gutter={[12, 8]} style={{ marginBottom: 12 }}>
              <Col flex="240px">
                <Input
                  placeholder="搜索工单号/订单号"
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
                  value={statusInput}
                  onChange={setStatusInput}
                  options={[
                    { label: '开立', value: '开立' },
                    { label: '开工', value: '开工' },
                    { label: '完工', value: '完工' },
                  ]}
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
              dataSource={summaryData}
              rowKey="work_order_id"
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

      <Drawer
        title={
          <span>
            人员记录明细 - {selectedWO?.work_order_no || ''}
            {selectedWO?.status && (
              <Tag color={woStatusColorMap[selectedWO.status]} style={{ marginLeft: 8 }}>
                {selectedWO.status}
              </Tag>
            )}
          </span>
        }
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setSelectedWO(null) }}
        width={1200}
        extra={
          selectedWO?.status === '开工' && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              新增记录
            </Button>
          )
        }
      >
        {selectedWO && (
          <>
            <Card size="small" style={{ marginBottom: 12 }}>
              <Descriptions column={4} size="small">
                <Descriptions.Item label="工单编号">{selectedWO.work_order_no || '-'}</Descriptions.Item>
                <Descriptions.Item label="订单编号">{selectedWO.order_no || '-'}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={woStatusColorMap[selectedWO.status] || 'default'}>{selectedWO.status}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="总人数">{selectedWO.total_people || 0}</Descriptions.Item>
                <Descriptions.Item label="开工时间">{selectedWO.start_time ? String(selectedWO.start_time).substring(0, 16).replace('T', ' ') : '-'}</Descriptions.Item>
                <Descriptions.Item label="完工时间">{selectedWO.finish_time ? String(selectedWO.finish_time).substring(0, 16).replace('T', ' ') : '-'}</Descriptions.Item>
                <Descriptions.Item label="累计人工工时">
                  <b style={{ color: '#FF9800' }}>{Number(selectedWO.total_man_hours || 0).toFixed(2)} h</b>
                </Descriptions.Item>
                <Descriptions.Item label="记录条数">{selectedWO.record_count || 0}</Descriptions.Item>
              </Descriptions>
            </Card>
            <Table
              columns={detailColumns}
              dataSource={detailList}
              rowKey="record_id"
              size="small"
              loading={detailLoading}
              scroll={{ x: 1400 }}
              pagination={false}
            />
          </>
        )}
      </Drawer>

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
                <Input value={selectedWO?.work_order_no} disabled />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="记录日期" name="record_date" rules={[{ required: true, message: '请选择日期' }]}>
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" disabled />
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
                <TimePicker
                  style={{ width: '100%' }}
                  format="HH:mm"
                  minuteStep={5}
                  disabledTime={() => ({
                    disabledHours: () => [0, 1, 2, 3, 4, 5, 6],
                  })}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="结束时间" name="end_time" rules={[{ required: true, message: '请选择结束时间' }]}>
                <TimePicker
                  style={{ width: '100%' }}
                  format="HH:mm"
                  minuteStep={5}
                  disabledTime={() => ({
                    disabledHours: () => [0, 1, 2, 3, 4, 5, 6],
                  })}
                />
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
              工时 = 结束时间 - 开始时间；人工工时 = 工时 × 总人数（由系统自动计算）
            </div>
          </Card>

          <Form.Item label="备注" name="remarks">
            <Input.TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="人员记录详情"
        open={!!currentRecord}
        onClose={() => setCurrentRecord(null)}
        width={480}
      >
        {currentRecord && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="记录日期">{currentRecord.record_date || '-'}</Descriptions.Item>
            <Descriptions.Item label="工单编号">{currentRecord.work_order_no}</Descriptions.Item>
            <Descriptions.Item label="班次">{currentRecord.shift || '-'}</Descriptions.Item>
            <Descriptions.Item label="开始时间">{currentRecord.start_time ? String(currentRecord.start_time).substring(0, 16).replace('T', ' ') : '-'}</Descriptions.Item>
            <Descriptions.Item label="结束时间">{currentRecord.end_time ? String(currentRecord.end_time).substring(0, 16).replace('T', ' ') : '-'}</Descriptions.Item>
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
