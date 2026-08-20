import ResizableTable from '../../components/ResizableTable'
import React, { useState, useMemo, useCallback, useEffect } from 'react'
import {
  Tag, Button, Typography, Alert, Steps, Select, DatePicker, Input,
  Modal, Form, Space, Drawer, Descriptions, message
} from 'antd'
import {
  WarningOutlined, SendOutlined, MessageOutlined, CheckCircleOutlined,
  FilePdfOutlined, SearchOutlined, PlusOutlined, EyeOutlined,
  CloseCircleOutlined
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import type { FilterItem, StatItem } from '../../components/ThreeSectionPage'
import { MONTH_QUICK_OPTIONS, getMonthRange, validateRange, getThisMonth } from '../../utils/monthQuick'
import dayjs from 'dayjs'
import api from '../../utils/api'
import { useMessage } from '../../contexts/AppContext'

const { Text } = Typography

const statusColor: Record<string, string> = { '已创建': 'default', '已发出': 'processing', '已回复': 'warning', '已关闭': 'success' }
const statusOrder = ['已创建', '已发出', '已回复', '已关闭']

const COMPLAINT_TYPE_OPTIONS = [
  { label: '质量问题', value: '质量问题' },
  { label: '交付问题', value: '交付问题' },
  { label: '服务问题', value: '服务问题' },
  { label: '数量不符', value: '数量不符' },
  { label: '单据问题', value: '单据问题' },
]

export default function SupplierComplaint() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 30, total: 0 })

  const [complaintNo, setComplaintNo] = useState<any>(undefined)
  const [supplierFilter, setSupplierFilter] = useState<any>(undefined)
  const [statusFilter, setStatusFilter] = useState<any>(undefined)
  const [dateRange, setDateRange] = useState<any>(getThisMonth())
  const [monthQuick, setMonthQuick] = useState<string>('this_month')
  const [rangeWarn, setRangeWarn] = useState(false)

  const [detailOpen, setDetailOpen] = useState(false)
  const [current, setCurrent] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [createVisible, setCreateVisible] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createForm] = Form.useForm()
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [incomingInspections, setIncomingInspections] = useState<any[]>([])

  const [replyModalOpen, setReplyModalOpen] = useState(false)
  const [replyLoading, setReplyLoading] = useState(false)
  const [replyForm] = Form.useForm()

  const [closeModalOpen, setCloseModalOpen] = useState(false)
  const [closeLoading, setCloseLoading] = useState(false)
  const [closeForm] = Form.useForm()

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
      if (supplierFilter) params.supplier_name = supplierFilter
      if (statusFilter) params.status = statusFilter
      if (dateRange && dateRange[0]) params.start_date = dateRange[0].format('YYYY-MM-DD')
      if (dateRange && dateRange[1]) params.end_date = dateRange[1].format('YYYY-MM-DD')

      const res = await api.get('/basic/supplier-complaints', { params })
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
  }, [complaintNo, supplierFilter, statusFilter, dateRange, pagination.current, pagination.pageSize, messageApi])

  useEffect(() => { fetchData() }, [fetchData])

  const loadSelectOptions = useCallback(async () => {
    try {
      const [sRes, iRes] = await Promise.all([
        api.get('/basic/suppliers', { params: { page: 1, page_size: 500 } }),
        api.get('/basic/incoming-inspections', { params: { page: 1, page_size: 500, result: '不合格' } }),
      ])
      if (sRes.success !== false) {
        const list = sRes.data?.list || sRes.data || []
        setSuppliers(Array.isArray(list) ? list : [])
      }
      if (iRes.success !== false) {
        const list = iRes.data?.list || iRes.data || []
        setIncomingInspections(Array.isArray(list) ? list : [])
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    loadSelectOptions()
  }, [loadSelectOptions])

  const sentCount = data.filter((s: any) => s.status === '已发出').length
  const repliedCount = data.filter((s: any) => s.status === '已回复').length
  const closedCount = data.filter((s: any) => s.status === '已关闭').length

  const stats: StatItem[] = [
    { label: '总投诉数', value: pagination.total, icon: <WarningOutlined />, color: '#2196F3' },
    { label: '已发出', value: sentCount, icon: <SendOutlined />, color: '#FF9800' },
    { label: '已回复', value: repliedCount, icon: <MessageOutlined />, color: '#00BCD4' },
    { label: '已关闭', value: closedCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
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
    setSupplierFilter(undefined)
    setStatusFilter(undefined)
    setMonthQuick('this_month')
    setDateRange(getThisMonth())
    setPagination(p => ({ ...p, current: 1 }))
  }

  const showDetail = async (record: any) => {
    setCurrent(record)
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const res = await api.get(`/basic/supplier-complaints/${record.complaint_id}`)
      if (res.success !== false && res.data) {
        setCurrent(res.data)
      }
    } catch (e: any) {
      messageApi.error(e?.message || '加载详情失败')
    } finally {
      setDetailLoading(false)
    }
  }

  const getCurrentStep = (status: string) => {
    const idx = statusOrder.indexOf(status)
    return idx === -1 ? 0 : idx
  }

  // ========= 新建投诉 =========
  const openCreateModal = () => {
    createForm.resetFields()
    createForm.setFieldsValue({
      complaint_type: '质量问题',
      complaint_date: dayjs(),
    })
    setCreateVisible(true)
  }

  const handleCreateSubmit = async () => {
    try {
      const values = await createForm.validateFields()
      setCreateLoading(true)
      const payload: any = {
        supplier_id: values.supplier,
        supplier_name: values.supplier_name || undefined,
        complaint_type: values.complaint_type,
        complaint_reason: values.complaint_reason,
        related_inspection_id: values.related_inspection || null,
        complaint_date: values.complaint_date?.format?.('YYYY-MM-DD') || undefined,
        remarks: values.remarks,
      }
      const res = await api.post('/basic/supplier-complaints', payload)
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

  // ========= 状态流转 =========
  const handleIssue = async (record: any) => {
    Modal.confirm({
      title: '发出投诉',
      content: `确认向供应商 ${record.supplier_name} 发出投诉 ${record.complaint_no}？`,
      okText: '确认发出',
      okType: 'primary',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await api.put(`/basic/supplier-complaints/${record.complaint_id}/issue`)
          if (res.success !== false) {
            messageApi.success(res.message || '发出成功')
            if (current && current.complaint_id === record.complaint_id) {
              setCurrent(res.data)
            }
            fetchData()
          } else {
            messageApi.error(res.message || '发出失败')
          }
        } catch (e: any) {
          messageApi.error(e?.message || '发出失败')
        }
      },
    })
  }

  const openReplyModal = (record: any) => {
    setCurrent(record)
    replyForm.resetFields()
    setReplyModalOpen(true)
  }

  const handleReplySubmit = async () => {
    if (!current) return
    try {
      const values = await replyForm.validateFields()
      setReplyLoading(true)
      const res = await api.put(`/basic/supplier-complaints/${current.complaint_id}/reply`, {
        reply_content: values.reply_content,
      })
      if (res.success !== false) {
        messageApi.success(res.message || '回复成功')
        setReplyModalOpen(false)
        if (detailOpen) {
          setCurrent(res.data)
        }
        fetchData()
      } else {
        messageApi.error(res.message || '回复失败')
      }
    } catch (e: any) {
      if (e?.errorFields) return
      messageApi.error(e?.message || '回复失败')
    } finally {
      setReplyLoading(false)
    }
  }

  const openCloseModal = (record: any) => {
    setCurrent(record)
    closeForm.resetFields()
    setCloseModalOpen(true)
  }

  const handleCloseSubmit = async () => {
    if (!current) return
    try {
      const values = await closeForm.validateFields()
      setCloseLoading(true)
      const res = await api.put(`/basic/supplier-complaints/${current.complaint_id}/close`, {
        remarks: values.remarks,
      })
      if (res.success !== false) {
        messageApi.success(res.message || '关闭成功')
        setCloseModalOpen(false)
        if (detailOpen) {
          setCurrent(res.data)
        }
        fetchData()
      } else {
        messageApi.error(res.message || '关闭失败')
      }
    } catch (e: any) {
      if (e?.errorFields) return
      messageApi.error(e?.message || '关闭失败')
    } finally {
      setCloseLoading(false)
    }
  }

  // ========= PDF 生成 =========
  const handleGeneratePdf = async (record: any) => {
    try {
      const res = await api.get(`/basic/supplier-complaints/${record.complaint_id}/pdf`)
      if (res.success !== false) {
        const url = res.data?.download_url || res.data?.pdf_path
        if (url) {
          // 拼接后端 base 路径
          const fullUrl = url.startsWith('http') ? url : `${(import.meta as any).env?.VITE_API_BASE_URL || '/api'}${url}`
          window.open(fullUrl, '_blank')
          messageApi.success('PDF 生成成功')
        } else {
          messageApi.error('生成失败：未返回下载地址')
        }
      } else {
        messageApi.error(res.message || '生成失败')
      }
    } catch (e: any) {
      messageApi.error(e?.message || '生成失败')
    }
  }

  const supplierOptions = useMemo(() => {
    return (suppliers || []).map((s: any) => ({
      label: s.supplier_name || s.name || String(s.supplier_id ?? s.id),
      value: s.supplier_id ?? s.id,
      raw: s,
    }))
  }, [suppliers])

  const inspectionOptions = useMemo(() => {
    return (incomingInspections || []).map((i: any) => ({
      label: `${i.inspection_no} - ${i.supplier_name || ''}`,
      value: i.inspection_id ?? i.id,
      raw: i,
    }))
  }, [incomingInspections])

  const columns = [
    { title: '投诉编号', dataIndex: 'complaint_no', key: 'complaint_no', width: 140, fixed: 'left' as const },
    { title: '供应商', dataIndex: 'supplier_name', key: 'supplier_name', width: 160 },
    { title: '投诉类型', dataIndex: 'complaint_type', key: 'complaint_type', width: 110 },
    {
      title: '投诉原因', dataIndex: 'complaint_reason', key: 'complaint_reason', width: 260,
      ellipsis: true,
    },
    {
      title: '关联来料检验', key: 'related_inspection', width: 150,
      render: (_: any, record: any) => record.related_inspection_no || <Text type="secondary">-</Text>
    },
    { title: '投诉日期', dataIndex: 'complaint_date', key: 'complaint_date', width: 110 },
    {
      title: '回复内容', dataIndex: 'reply_content', key: 'reply_content', width: 220,
      ellipsis: true,
      render: (v: string) => v || <Text type="secondary">暂无回复</Text>
    },
    {
      title: '回复日期', dataIndex: 'reply_date', key: 'reply_date', width: 110,
      render: (v: string) => v || <Text type="secondary">-</Text>
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (v: string) => <Tag color={statusColor[v] || 'default'}>{v}</Tag>
    },
    {
      title: '操作', key: 'action', fixed: 'right' as const, width: 280,
      render: (_: any, record: any) => {
        const status = record.status
        return (
          <Space size="small">
            <Button type="link" size="small" onClick={() => showDetail(record)} icon={<EyeOutlined />}>详情</Button>
            {status === '已创建' && (
              <Button type="link" size="small" onClick={() => handleIssue(record)} icon={<SendOutlined />}>发出投诉</Button>
            )}
            {status === '已发出' && (
              <Button type="link" size="small" onClick={() => openReplyModal(record)} icon={<MessageOutlined />}>录入回复</Button>
            )}
            {status === '已回复' && (
              <Button type="link" size="small" onClick={() => openCloseModal(record)} danger icon={<CloseCircleOutlined />}>关闭投诉</Button>
            )}
            <Button type="link" size="small" onClick={() => handleGeneratePdf(record)} icon={<FilePdfOutlined />}>生成PDF</Button>
          </Space>
        )
      }
    },
  ]

  const filters = useMemo(() => [
    {
      type: 'input' as const,
      placeholder: '投诉编号',
      icon: <SearchOutlined />,
      value: complaintNo,
      onChange: (e: any) => setComplaintNo(e?.target?.value !== undefined ? e.target.value : e),
      col: { span: 4 },
    },
    {
      type: 'input' as const,
      placeholder: '供应商名称',
      value: supplierFilter,
      onChange: (e: any) => setSupplierFilter(e?.target?.value !== undefined ? e.target.value : e),
      col: { span: 4 },
    },
    {
      type: 'select' as const,
      placeholder: '状态',
      options: [
        { label: '已创建', value: '已创建' },
        { label: '已发出', value: '已发出' },
        { label: '已回复', value: '已回复' },
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
  ], [complaintNo, supplierFilter, statusFilter, dateRange, monthQuick])

  return (
    <>
      <ThreeSectionPage
        title="供应商投诉"
        breadcrumbs="质量管理 / 供应商投诉"
        stats={stats}
        filters={filters}
        onSearch={fetchData}
        onReset={handleReset}
        actions={<ActionButtons onAdd={openCreateModal} addText="新建投诉" />}
        table={
          <>
            {rangeWarn && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message="查询跨度时间较长，后台需要较长时间执行查询，可能造成页面假死状态"
              />
            )}
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message="状态流转：已创建 → 已发出 → 已回复 → 已关闭"
            />
            <ResizableTable
              tableKey="pages_quality_SupplierComplaint"
              columns={columns}
              dataSource={data}
              rowKey="complaint_id"
              size="small"
              loading={loading}
              scroll={{ x: 1600 }}
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
              expandable={{
                expandedRowRender: (record: any) => (
                  <div style={{ padding: '8px 0' }}>
                    <Steps
                      size="small"
                      current={getCurrentStep(record.status)}
                      items={[
                        { title: '已创建', description: `登记人：${record.created_by_name || '-'}` },
                        { title: '已发出', description: `投诉日期：${record.complaint_date || '-'}` },
                        {
                          title: '已回复',
                          description: record.reply_date ? `回复日期：${record.reply_date}` : '等待供应商回复'
                        },
                        { title: '已关闭', description: record.closed_time ? `关闭时间：${record.closed_time}` : '投诉处理完成' },
                      ]}
                    />
                    {record.reply_content && (
                      <div style={{ marginTop: 12 }}>
                        <Text strong>供应商回复：</Text>
                        <div style={{ marginTop: 4, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{record.reply_content}</div>
                      </div>
                    )}
                  </div>
                ),
              }}
            />
          </>
        }
      />

      {/* 新建投诉 Modal */}
      <Modal
        title="新建供应商投诉"
        open={createVisible}
        onCancel={() => setCreateVisible(false)}
        onOk={handleCreateSubmit}
        confirmLoading={createLoading}
        okText="保存"
        cancelText="取消"
        width={720}
        destroyOnHidden
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="complaint_no" label="投诉编号（自动生成）">
            <Input disabled placeholder="保存后自动生成" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="supplier" label="供应商" rules={[{ required: true, message: '请选择供应商' }]}>
              <Select
                showSearch
                placeholder="选择供应商"
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                }
                onChange={(val) => {
                  const opt = supplierOptions.find(o => o.value === val)
                  if (opt?.raw) {
                    createForm.setFieldsValue({
                      supplier_name: opt.raw.supplier_name || opt.raw.name || '',
                    })
                  }
                }}
                options={supplierOptions}
              />
            </Form.Item>
            <Form.Item name="supplier_name" label="供应商名称">
              <Input disabled placeholder="选择供应商后自动填充" />
            </Form.Item>
            <Form.Item name="complaint_type" label="投诉类型" rules={[{ required: true, message: '请选择投诉类型' }]}>
              <Select options={COMPLAINT_TYPE_OPTIONS} placeholder="请选择投诉类型" />
            </Form.Item>
            <Form.Item name="complaint_date" label="投诉日期" rules={[{ required: true, message: '请选择投诉日期' }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="related_inspection" label="关联来料检验（仅不合格）">
              <Select
                allowClear
                showSearch
                placeholder="选择来料检验记录"
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                }
                onChange={(val) => {
                  if (val) {
                    const opt = inspectionOptions.find(o => o.value === val)
                    if (opt?.raw) {
                      // 自动填充供应商信息（如果未手动选供应商）
                      const currentSupplier = createForm.getFieldValue('supplier')
                      if (!currentSupplier && opt.raw.supplier_id) {
                        createForm.setFieldsValue({
                          supplier: opt.raw.supplier_id,
                          supplier_name: opt.raw.supplier_name || '',
                        })
                      }
                    }
                  }
                }}
                options={inspectionOptions}
              />
            </Form.Item>
            <Form.Item name="complaint_reason" label="投诉原因" rules={[{ required: true, message: '请填写投诉原因' }]}>
              <Input.TextArea rows={4} placeholder="请描述投诉原因" />
            </Form.Item>
            <Form.Item name="remarks" label="备注">
              <Input.TextArea rows={2} placeholder="可选备注" />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* 录入回复 Modal */}
      <Modal
        title="录入供应商回复"
        open={replyModalOpen}
        onCancel={() => setReplyModalOpen(false)}
        onOk={handleReplySubmit}
        confirmLoading={replyLoading}
        okText="提交回复"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={replyForm} layout="vertical">
          <Form.Item name="reply_content" label="回复内容" rules={[{ required: true, message: '请填写回复内容' }]}>
            <Input.TextArea rows={5} placeholder="请输入供应商回复内容" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 关闭投诉 Modal */}
      <Modal
        title="关闭投诉"
        open={closeModalOpen}
        onCancel={() => setCloseModalOpen(false)}
        onOk={handleCloseSubmit}
        confirmLoading={closeLoading}
        okText="确认关闭"
        okType="danger"
        cancelText="取消"
        destroyOnHidden
      >
        {current && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message={`即将关闭投诉 ${current.complaint_no}（${current.supplier_name}）`}
          />
        )}
        <Form form={closeForm} layout="vertical">
          <Form.Item name="remarks" label="关闭备注">
            <Input.TextArea rows={3} placeholder="可选，填写关闭原因或备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情抽屉 */}
      <Drawer
        title="供应商投诉详情"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={720}
        destroyOnHidden
        extra={
          current && (
            <Space>
              {current.status === '已创建' && (
                <Button type="primary" icon={<SendOutlined />} onClick={() => handleIssue(current)}>发出投诉</Button>
              )}
              {current.status === '已发出' && (
                <Button type="primary" icon={<MessageOutlined />} onClick={() => openReplyModal(current)}>录入回复</Button>
              )}
              {current.status === '已回复' && (
                <Button danger icon={<CloseCircleOutlined />} onClick={() => openCloseModal(current)}>关闭投诉</Button>
              )}
              <Button icon={<FilePdfOutlined />} onClick={() => handleGeneratePdf(current)}>生成PDF</Button>
            </Space>
          )
        }
      >
        {current && (
          <>
            <Steps
              size="small"
              current={getCurrentStep(current.status)}
              style={{ marginBottom: 24 }}
              items={[
                { title: '已创建', description: `登记人：${current.created_by_name || '-'}` },
                { title: '已发出', description: `投诉日期：${current.complaint_date || '-'}` },
                {
                  title: '已回复',
                  description: current.reply_date ? `回复日期：${current.reply_date}` : '等待供应商回复'
                },
                { title: '已关闭', description: current.closed_time ? `关闭时间：${current.closed_time}` : '-' },
              ]}
            />
            {detailLoading ? (
              <Text type="secondary">加载中...</Text>
            ) : (
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="投诉编号">{current.complaint_no}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={statusColor[current.status] || 'default'}>{current.status}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="供应商">{current.supplier_name}</Descriptions.Item>
                <Descriptions.Item label="投诉类型">{current.complaint_type}</Descriptions.Item>
                <Descriptions.Item label="投诉日期">{current.complaint_date}</Descriptions.Item>
                <Descriptions.Item label="登记人">{current.created_by_name}</Descriptions.Item>
                <Descriptions.Item label="关联来料检验">{current.related_inspection_no || '-'}</Descriptions.Item>
                <Descriptions.Item label="投诉原因" span={2}>{current.complaint_reason}</Descriptions.Item>
                <Descriptions.Item label="供应商回复" span={2}>
                  {current.reply_content || <Text type="secondary">暂无回复</Text>}
                </Descriptions.Item>
                {current.reply_content && (
                  <Descriptions.Item label="回复日期">{current.reply_date || '-'}</Descriptions.Item>
                )}
                {current.closed_by_name && (
                  <Descriptions.Item label="关闭人">{current.closed_by_name}</Descriptions.Item>
                )}
                {current.closed_time && (
                  <Descriptions.Item label="关闭时间">{current.closed_time}</Descriptions.Item>
                )}
                {current.remarks && (
                  <Descriptions.Item label="备注" span={2}>{current.remarks}</Descriptions.Item>
                )}
              </Descriptions>
            )}
          </>
        )}
      </Drawer>
    </>
  )
}
