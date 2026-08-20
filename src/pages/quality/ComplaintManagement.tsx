import ResizableTable from '../../components/ResizableTable'
import React, { useState, useMemo, useCallback, useEffect } from 'react'
import {
  Tag, Button, Drawer, Descriptions, Typography, Timeline,
  Select, DatePicker, Input, Alert, Modal, Form, Space, message
} from 'antd'
import {
  MessageOutlined, ClockCircleOutlined, CheckCircleOutlined,
  MailOutlined, EyeOutlined, SearchOutlined, PlusOutlined,
  CloseCircleOutlined, FileAddOutlined
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import type { FilterItem, StatItem } from '../../components/ThreeSectionPage'
import { MONTH_QUICK_OPTIONS, getMonthRange, validateRange, getThisMonth } from '../../utils/monthQuick'
import dayjs from 'dayjs'
import api from '../../utils/api'
import { useMessage } from '../../contexts/AppContext'

const { RangePicker } = DatePicker
const { Text, Title } = Typography
const { TextArea } = Input

const stageColor: Record<string, string> = { '调查': 'blue', '处理': 'orange', '原因分析': 'purple', '回复客户': 'cyan', '客户反馈': 'green', '关闭': 'default' }
const statusColor: Record<string, string> = { '已关闭': 'success', '处理中': 'processing' }
const SOURCE_OPTIONS = [
  { label: '客户投诉', value: '客户投诉' },
  { label: '监管抽查', value: '监管抽查' },
  { label: '内部发现', value: '内部发现' },
]
const COMPLAINT_TYPE_OPTIONS = [
  { label: '质量问题', value: '质量问题' },
  { label: '服务问题', value: '服务问题' },
  { label: '交付问题', value: '交付问题' },
]
const COMPLAINT_METHOD_OPTIONS = [
  { label: '电话', value: '电话' },
  { label: '邮件', value: '邮件' },
  { label: '传真', value: '传真' },
  { label: '现场', value: '现场' },
]
const STAGE_OPTIONS = ['调查', '处理', '原因分析', '回复客户', '客户反馈', '关闭']

export default function ComplaintManagement() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 30, total: 0 })

  const [complaintNo, setComplaintNo] = useState<any>(undefined)
  const [customerFilter, setCustomerFilter] = useState<any>(undefined)
  const [statusFilter, setStatusFilter] = useState<any>(undefined)
  const [dateRange, setDateRange] = useState<any>(getThisMonth())
  const [monthQuick, setMonthQuick] = useState<string>('this_month')
  const [rangeWarn, setRangeWarn] = useState(false)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [current, setCurrent] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [createVisible, setCreateVisible] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createForm] = Form.useForm()
  const [customers, setCustomers] = useState<any[]>([])
  const [materials, setMaterials] = useState<any[]>([])

  const [recordModalOpen, setRecordModalOpen] = useState(false)
  const [recordLoading, setRecordLoading] = useState(false)
  const [recordForm] = Form.useForm()

  const messageApi = useMessage()

  const fetchData = useCallback(async () => {
    if (dateRange) {
      const check = validateRange(dateRange)
      if (!check.ok) {
        message.warning(check.msg)
        return
      }
      setRangeWarn(check.warn || false)
    } else {
      setRangeWarn(false)
    }

    setLoading(true)
    try {
      const params: any = { page: pagination.current, page_size: pagination.pageSize }
      if (complaintNo) params.complaint_no = complaintNo
      if (customerFilter) params.customer_name = customerFilter
      if (statusFilter) params.status = statusFilter
      if (dateRange && dateRange[0]) params.start_date = dateRange[0].format('YYYY-MM-DD')
      if (dateRange && dateRange[1]) params.end_date = dateRange[1].format('YYYY-MM-DD')

      const res = await api.get('/basic/complaints', { params })
      if (res.success !== false) {
        setData(res.data?.list || res.data || [])
        setPagination(p => ({ ...p, total: res.data?.total || 0 }))
      } else {
        setData([])
        setPagination(p => ({ ...p, total: 0 }))
        messageApi.error(res.message || '查询失败')
      }
    } catch (e: any) {
      setData([])
      setPagination(p => ({ ...p, total: 0 }))
      if (e?.message && !/timeout|network/i.test(e.message)) {
        messageApi.error(e.message)
      }
    } finally {
      setLoading(false)
    }
  }, [complaintNo, customerFilter, statusFilter, dateRange, pagination.current, pagination.pageSize, messageApi])

  useEffect(() => { fetchData() }, [fetchData])

  const loadSelectOptions = useCallback(async () => {
    try {
      const [cRes, mRes] = await Promise.all([
        api.get('/basic/customers', { params: { page: 1, page_size: 500 } }),
        api.get('/basic/materials', { params: { page: 1, page_size: 500 } }),
      ])
      if (cRes.success !== false) {
        const list = cRes.data?.list || cRes.data || []
        setCustomers(Array.isArray(list) ? list : [])
      }
      if (mRes.success !== false) {
        const list = mRes.data?.list || mRes.data || []
        setMaterials(Array.isArray(list) ? list : [])
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    loadSelectOptions()
  }, [loadSelectOptions])

  const processingCount = data.filter((c: any) => c.status === '处理中').length
  const closedCount = data.filter((c: any) => c.status === '已关闭').length
  const replyCount = data.filter((c: any) => c.require_reply === 1 || c.require_reply === '1').length

  const stats: StatItem[] = [
    { label: '总客诉数', value: pagination.total, icon: <MessageOutlined />, color: '#2196F3' },
    { label: '处理中', value: processingCount, icon: <ClockCircleOutlined />, color: '#FF9800' },
    { label: '已关闭', value: closedCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
    { label: '要求回复数', value: replyCount, icon: <MailOutlined />, color: '#00BCD4' },
  ]

  const handleMonthQuick = (v: string) => {
    setMonthQuick(v)
    const range = getMonthRange(v)
    setDateRange(range)
  }
  const handleRangeChange = (v: any) => {
    setMonthQuick(undefined)
    setDateRange(v)
  }

  const handleReset = () => {
    setComplaintNo(undefined)
    setCustomerFilter(undefined)
    setStatusFilter(undefined)
    setMonthQuick('this_month')
    setDateRange(getThisMonth())
    setPagination(p => ({ ...p, current: 1 }))
  }

  const showDetail = async (record: any) => {
    setCurrent(record)
    setDrawerOpen(true)
    setDetailLoading(true)
    try {
      const res = await api.get(`/basic/complaints/${record.complaint_id}`)
      if (res.success !== false && res.data) {
        setCurrent(res.data)
      }
    } catch (e: any) {
      messageApi.error(e?.message || '加载详情失败')
    } finally {
      setDetailLoading(false)
    }
  }

  // ========= 新建客诉 =========
  const openCreateModal = () => {
    createForm.resetFields()
    createForm.setFieldsValue({
      source: '客户投诉',
      complaint_type: '质量问题',
      complaint_method: '电话',
      require_reply: 0,
      complaint_time: dayjs(),
    })
    setCreateVisible(true)
  }

  const handleCreateSubmit = async () => {
    try {
      const values = await createForm.validateFields()
      setCreateLoading(true)
      const payload: any = {
        source: values.source,
        customer_id: values.customer,
        customer_name: values.customer_name || undefined,
        contact_person: values.contact_person,
        contact_phone: values.contact_phone,
        material_id: values.material,
        material_name: values.material_name || undefined,
        batch_no: values.batch_no,
        complaint_type: values.complaint_type,
        complaint_desc: values.complaint_desc,
        complaint_method: values.complaint_method,
        complaint_time: values.complaint_time?.toDate?.() || values.complaint_time,
        require_reply: values.require_reply ? 1 : 0,
        reply_deadline: values.reply_deadline?.format?.('YYYY-MM-DD') || undefined,
        handle_direction: values.handle_direction,
      }
      const res = await api.post('/basic/complaints', payload)
      if (res.success !== false) {
        messageApi.success(res.message || '创建成功')
        setCreateVisible(false)
        fetchData()
      } else {
        messageApi.error(res.message || '创建失败')
      }
    } catch (e: any) {
      if (e?.errorFields) return
      messageApi.error(e?.message || '创建失败')
    } finally {
      setCreateLoading(false)
    }
  }

  // ========= 添加处理记录 =========
  const openRecordModal = () => {
    recordForm.resetFields()
    recordForm.setFieldsValue({ stage: '调查' })
    setRecordModalOpen(true)
  }

  const handleAddRecord = async () => {
    if (!current) return
    try {
      const values = await recordForm.validateFields()
      setRecordLoading(true)
      const payload: any = {
        stage: values.stage,
        content: values.content,
        attachment_url: values.attachment_url || '',
      }
      const res = await api.post(`/basic/complaints/${current.complaint_id}/records`, payload)
      if (res.success !== false) {
        messageApi.success(res.message || '添加成功')
        setRecordModalOpen(false)
        setCurrent(res.data)
        fetchData()
      } else {
        messageApi.error(res.message || '添加失败')
      }
    } catch (e: any) {
      if (e?.errorFields) return
      messageApi.error(e?.message || '添加失败')
    } finally {
      setRecordLoading(false)
    }
  }

  // ========= 关闭客诉 =========
  const handleClose = (record: any) => {
    Modal.confirm({
      title: '关闭客诉',
      content: `确认关闭客诉 ${record.complaint_no}？关闭后不可重新打开。`,
      okText: '确认关闭',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await api.put(`/basic/complaints/${record.complaint_id}/close`, { content: '客诉关闭' })
          if (res.success !== false) {
            messageApi.success(res.message || '关闭成功')
            if (current && current.complaint_id === record.complaint_id) {
              setCurrent(res.data)
            }
            fetchData()
          } else {
            messageApi.error(res.message || '关闭失败')
          }
        } catch (e: any) {
          messageApi.error(e?.message || '关闭失败')
        }
      },
    })
  }

  const columns = [
    { title: '客诉编号', dataIndex: 'complaint_no', key: 'complaint_no', width: 130, fixed: 'left' as const },
    { title: '来源', dataIndex: 'source', key: 'source', width: 100 },
    { title: '客户名称', dataIndex: 'customer_name', key: 'customer_name', width: 160 },
    { title: '料品名称', dataIndex: 'material_name', key: 'material_name', width: 160 },
    { title: '批号/工单', dataIndex: 'batch_no', key: 'batch_no', width: 150 },
    { title: '投诉问题分类', dataIndex: 'complaint_type', key: 'complaint_type', width: 120 },
    { title: '投诉时间', dataIndex: 'complaint_time', key: 'complaint_time', width: 160 },
    { title: '投诉方式', dataIndex: 'complaint_method', key: 'complaint_method', width: 90 },
    {
      title: '要求回复', dataIndex: 'require_reply', key: 'require_reply', width: 90,
      render: (v: any) => (v === 1 || v === '1') ? <Tag color="orange">是</Tag> : <Tag>否</Tag>
    },
    { title: '回复截止', dataIndex: 'reply_deadline', key: 'reply_deadline', width: 110 },
    { title: '处理方向', dataIndex: 'handle_direction', key: 'handle_direction', width: 120 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (v: string) => <Tag color={statusColor[v] || 'default'}>{v}</Tag>
    },
    {
      title: '操作', key: 'action', fixed: 'right' as const, width: 220,
      render: (_: any, record: any) => {
        const isProcessing = record.status === '处理中'
        const isClosed = record.status === '已关闭'
        return (
          <Space size="small">
            <Button type="link" size="small" onClick={() => showDetail(record)} icon={<EyeOutlined />}>查看</Button>
            {isProcessing && (
              <Button type="link" size="small" onClick={() => { setCurrent(record); setDrawerOpen(true) }} icon={<FileAddOutlined />}>添加记录</Button>
            )}
            {isProcessing && !isClosed && (
              <Button type="link" size="small" danger onClick={() => handleClose(record)} icon={<CloseCircleOutlined />}>关闭</Button>
            )}
          </Space>
        )
      }
    },
  ]

  const filters = useMemo(() => [
    {
      type: 'input' as const,
      placeholder: '客诉编号',
      icon: <SearchOutlined />,
      value: complaintNo,
      onChange: (e: any) => setComplaintNo(e?.target?.value !== undefined ? e.target.value : e),
      col: { span: 4 },
    },
    {
      type: 'input' as const,
      placeholder: '客户名称',
      value: customerFilter,
      onChange: (e: any) => setCustomerFilter(e?.target?.value !== undefined ? e.target.value : e),
      col: { span: 4 },
    },
    {
      type: 'select' as const,
      placeholder: '状态',
      options: [
        { label: '处理中', value: '处理中' },
        { label: '已关闭', value: '已关闭' },
      ],
      value: statusFilter,
      onChange: setStatusFilter,
      col: { span: 3 },
    },
    {
      type: 'select' as const,
      placeholder: '快速选择月份',
      options: MONTH_QUICK_OPTIONS,
      value: monthQuick || undefined,
      onChange: handleMonthQuick,
      col: { span: 4 },
    },
    {
      type: 'rangepicker' as const,
      value: dateRange,
      onChange: handleRangeChange,
      col: { span: 5 },
    },
  ], [complaintNo, customerFilter, statusFilter, dateRange, monthQuick])

  const customerOptions = useMemo(() => {
    return (customers || []).map((c: any) => ({
      label: c.customer_name || c.name || c.supplier_name || String(c.customer_id ?? c.id),
      value: c.customer_id ?? c.id,
      // 扩展属性：通过 onSelect 拿到完整对象
      raw: c,
    }))
  }, [customers])

  const materialOptions = useMemo(() => {
    return (materials || []).map((m: any) => ({
      label: m.material_name || m.name || String(m.material_id ?? m.id),
      value: m.material_id ?? m.id,
      raw: m,
    }))
  }, [materials])

  // 客诉详情里时间线的渲染（使用后端 records）
  const renderTimeline = () => {
    const records: any[] = current?.records || []
    if (!records.length) {
      return <Text type="secondary">暂无处理记录</Text>
    }
    return (
      <Timeline
        mode="left"
        items={records.map((item: any) => ({
          color: stageColor[item.stage] || 'gray',
          label: item.created_at || item.createdTime || item.time || '',
          children: (
            <div>
              <div>
                <Tag color={stageColor[item.stage] || 'default'}>{item.stage}</Tag>
                <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                  {item.handler_name || item.handlerName || '-'}
                </Text>
              </div>
              <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{item.content}</div>
            </div>
          ),
        }))}
      />
    )
  }

  return (
    <>
      <ThreeSectionPage
        title="客诉管理"
        breadcrumbs="质量管理 / 客诉管理"
        stats={stats}
        filters={filters}
        onSearch={fetchData}
        onReset={handleReset}
        actions={<ActionButtons onAdd={openCreateModal} addText="新建客诉" />}
        table={
          <div>
            {rangeWarn && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message="查询跨度时间较长，后台需要较长时间执行查询，可能造成页面假死状态"
              />
            )}
            <ResizableTable
              tableKey="pages_quality_ComplaintManagement"
              columns={columns}
              dataSource={data}
              rowKey="complaint_id"
              size="small"
              loading={loading}
              scroll={{ x: 1700 }}
              pagination={{
                current: pagination.current,
                pageSize: pagination.pageSize,
                total: pagination.total,
                showSizeChanger: true,
                showTotal: (t: number) => `共 ${t} 条`,
                onChange: (page, pageSize) => {
                  setPagination(p => ({ ...p, current: page, pageSize }))
                },
              }}
            />
          </div>
        }
      />

      {/* 新建客诉 Modal */}
      <Modal
        title="新建客诉"
        open={createVisible}
        onCancel={() => setCreateVisible(false)}
        onOk={handleCreateSubmit}
        confirmLoading={createLoading}
        okText="保存"
        cancelText="取消"
        width={760}
        destroyOnHidden
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="complaint_no" label="客诉编号（自动生成）">
            <Input disabled placeholder="保存后自动生成" />
          </Form.Item>
          <Space style={{ width: '100%' }} size="middle" split={<span style={{ color: '#e8e8e8' }}>·</span>} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="source" label="来源" rules={[{ required: true, message: '请选择来源' }]}>
              <Select options={SOURCE_OPTIONS} placeholder="请选择来源" />
            </Form.Item>
            <Form.Item name="customer" label="客户" rules={[{ required: true, message: '请选择客户' }]}
              extra={
                createForm.getFieldValue('customer') ? (
                  <Text type="secondary">{createForm.getFieldValue('customer_name')}</Text>
                ) : undefined
              }
            >
              <Select
                showSearch
                placeholder="选择客户"
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                }
                onChange={(val) => {
                  const opt = customerOptions.find(o => o.value === val)
                  if (opt?.raw) {
                    createForm.setFieldsValue({
                      customer_name: opt.raw.customer_name || opt.raw.name || '',
                      contact_person: opt.raw.contact_person || opt.raw.contactPerson || '',
                      contact_phone: opt.raw.phone || opt.raw.contact_phone || '',
                    })
                  }
                }}
                options={customerOptions}
              />
            </Form.Item>
            <Form.Item name="contact_person" label="联系人">
              <Input placeholder="请输入联系人" />
            </Form.Item>
            <Form.Item name="contact_phone" label="电话">
              <Input placeholder="请输入联系电话" />
            </Form.Item>
            <Form.Item name="material" label="料品"
              extra={
                createForm.getFieldValue('material') ? (
                  <Text type="secondary">{createForm.getFieldValue('material_name')}</Text>
                ) : undefined
              }
            >
              <Select
                showSearch
                allowClear
                placeholder="选择料品"
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                }
                onChange={(val) => {
                  const opt = materialOptions.find(o => o.value === val)
                  if (opt?.raw) {
                    createForm.setFieldsValue({
                      material_name: opt.raw.material_name || opt.raw.name || '',
                    })
                  }
                }}
                options={materialOptions}
              />
            </Form.Item>
            <Form.Item name="batch_no" label="批号/工单号">
              <Input placeholder="请输入批号/工单号" />
            </Form.Item>
            <Form.Item name="complaint_type" label="投诉类型" rules={[{ required: true, message: '请选择投诉类型' }]}>
              <Select options={COMPLAINT_TYPE_OPTIONS} placeholder="请选择投诉类型" />
            </Form.Item>
            <Form.Item name="complaint_method" label="投诉方式" rules={[{ required: true, message: '请选择投诉方式' }]}>
              <Select options={COMPLAINT_METHOD_OPTIONS} placeholder="请选择投诉方式" />
            </Form.Item>
            <Form.Item name="complaint_time" label="投诉时间" rules={[{ required: true, message: '请选择投诉时间' }]}>
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="require_reply" label="是否要求回复" valuePropName="checked">
              <Select
                options={[
                  { label: '是', value: 1 },
                  { label: '否', value: 0 },
                ]}
              />
            </Form.Item>
            <Form.Item name="reply_deadline" label="回复截止日期">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="handle_direction" label="处理方向">
              <Input placeholder="请输入处理方向" />
            </Form.Item>
            <Form.Item name="complaint_desc" label="投诉描述" rules={[{ required: true, message: '请输入投诉描述' }]}>
              <TextArea rows={3} placeholder="请输入投诉描述" />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* 添加处理记录 Modal */}
      <Modal
        title="添加处理记录"
        open={recordModalOpen}
        onCancel={() => setRecordModalOpen(false)}
        onOk={handleAddRecord}
        confirmLoading={recordLoading}
        okText="提交"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={recordForm} layout="vertical">
          <Form.Item name="stage" label="阶段" rules={[{ required: true, message: '请选择阶段' }]}>
            <Select
              options={STAGE_OPTIONS.map(s => ({ label: s, value: s }))}
              placeholder="请选择阶段"
            />
          </Form.Item>
          <Form.Item name="content" label="处理内容" rules={[{ required: true, message: '请输入处理内容' }]}>
            <TextArea rows={4} placeholder="请输入处理内容" />
          </Form.Item>
          <Form.Item name="attachment_url" label="附件地址（可选）">
            <Input placeholder="如已上传附件，请填写附件 URL" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情抽屉 */}
      <Drawer
        title="客诉详情"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={760}
        destroyOnHidden
        extra={
          current && (
            <Space>
              {current.status === '处理中' && (
                <Button type="primary" icon={<FileAddOutlined />} onClick={openRecordModal}>添加处理记录</Button>
              )}
              {current.status === '处理中' && (
                <Button danger icon={<CloseCircleOutlined />} onClick={() => handleClose(current)}>关闭客诉</Button>
              )}
            </Space>
          )
        }
      >
        {current && (
          <>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="客诉编号">{current.complaint_no}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColor[current.status] || 'default'}>{current.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="来源">{current.source}</Descriptions.Item>
              <Descriptions.Item label="投诉方式">{current.complaint_method}</Descriptions.Item>
              <Descriptions.Item label="客户名称">{current.customer_name}</Descriptions.Item>
              <Descriptions.Item label="联系人">{current.contact_person}</Descriptions.Item>
              <Descriptions.Item label="联系电话">{current.contact_phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="料品名称">{current.material_name}</Descriptions.Item>
              <Descriptions.Item label="批号/工单">{current.batch_no}</Descriptions.Item>
              <Descriptions.Item label="投诉问题分类">{current.complaint_type}</Descriptions.Item>
              <Descriptions.Item label="要求回复">
                {(current.require_reply === 1 || current.require_reply === '1') ? <Tag color="orange">是</Tag> : <Tag>否</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="投诉时间">{current.complaint_time}</Descriptions.Item>
              <Descriptions.Item label="回复截止">{current.reply_deadline || '-'}</Descriptions.Item>
              <Descriptions.Item label="处理方向">{current.handle_direction || '-'}</Descriptions.Item>
              <Descriptions.Item label="投诉描述" span={2}>{current.complaint_desc}</Descriptions.Item>
              <Descriptions.Item label="登记人">{current.registered_by_name}</Descriptions.Item>
            </Descriptions>
            <Title level={5}>处理记录时间线</Title>
            {detailLoading ? (
              <Text type="secondary">加载中...</Text>
            ) : (
              renderTimeline()
            )}
          </>
        )}
      </Drawer>
    </>
  )
}
