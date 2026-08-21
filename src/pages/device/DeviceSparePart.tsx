import ResizableTable from '../../components/ResizableTable'
import React, { useState, useEffect, useCallback } from 'react'
import {
  Tag, Button, Drawer, Space, Modal, Form, Input, InputNumber, Select, Popconfirm,
  Descriptions, Row, Col, Tooltip, Dropdown,
} from 'antd'
import {
  ToolOutlined, WarningOutlined, ArrowDownOutlined, ArrowUpOutlined,
  PlusOutlined, ImportOutlined, ExportOutlined, SwapOutlined,
  HistoryOutlined, DownOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import type { FilterItem, StatItem } from '../../components/ThreeSectionPage'
import api from '../../utils/api'
import { useMessage, useApp } from '../../contexts/AppContext'

const statusOptions = [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }]
const categoryOptions = ['机械', '电气', '液压', '气动', '电子', '其他'].map(c => ({ label: c, value: c }))
const logTypeColorMap: Record<string, string> = { in: 'green', out: 'orange', adjust: 'blue' }
const logTypeTextMap: Record<string, string> = { in: '入库', out: '出库', adjust: '调整' }

const fmtMoney = (v: any): string => {
  const n = Number(v)
  if (!Number.isFinite(n)) return '0.00'
  return n.toFixed(2)
}

export default function DeviceSparePart() {
  const message = useMessage()
  const { hasPermission } = useApp()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)

  // 统计
  const [lowStockCount, setLowStockCount] = useState(0)
  const [monthInAmount, setMonthInAmount] = useState(0)
  const [monthOutAmount, setMonthOutAmount] = useState(0)

  // 编辑/新增
  const [editing, setEditing] = useState<any>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  // 入库
  const [stockInPart, setStockInPart] = useState<any>(null)
  const [stockInVisible, setStockInVisible] = useState(false)
  const [stockInForm] = Form.useForm()

  // 出库
  const [stockOutPart, setStockOutPart] = useState<any>(null)
  const [stockOutVisible, setStockOutVisible] = useState(false)
  const [stockOutForm] = Form.useForm()

  // 调整
  const [adjustPart, setAdjustPart] = useState<any>(null)
  const [adjustVisible, setAdjustVisible] = useState(false)
  const [adjustForm] = Form.useForm()

  // 流水 Drawer
  const [logDrawerOpen, setLogDrawerOpen] = useState(false)
  const [logData, setLogData] = useState<any[]>([])
  const [logLoading, setLogLoading] = useState(false)
  const [logTotal, setLogTotal] = useState(0)
  const [logPartIdInput, setLogPartIdInput] = useState<any>(undefined)
  const [logTypeInput, setLogTypeInput] = useState<any>(undefined)
  const [logQuery, setLogQuery] = useState({ page: 1, pageSize: 20, part_id: undefined, log_type: undefined })

  // 筛选输入态
  const [keywordInput, setKeywordInput] = useState('')
  const [categoryInput, setCategoryInput] = useState(undefined)
  const [statusInput, setStatusInput] = useState([1, 0])
  // 已应用的查询条件
  const [query, setQuery] = useState({ page: 1, pageSize: 30, keyword: '', category: undefined, status: [1, 0] })

  const stats: StatItem[] = [
    { label: '备件总数', value: total, icon: <ToolOutlined />, color: '#2196F3' },
    { label: '低库存预警', value: lowStockCount, icon: <WarningOutlined />, color: '#F44336' },
    { label: '本月入库金额(元)', value: fmtMoney(monthInAmount), icon: <ArrowDownOutlined />, color: '#4CAF50' },
    { label: '本月出库金额(元)', value: fmtMoney(monthOutAmount), icon: <ArrowUpOutlined />, color: '#FF9800' },
  ]

  const categoryFilterOptions = [...new Set(data.map(d => d.category).filter(Boolean))].map(c => ({ label: c, value: c }))

  // 统计刷新触发器（库存变动后重新拉取预警数与本月金额）
  const [statsTick, setStatsTick] = useState(0)

  // 获取备件列表
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize }
        if (query.keyword) params.keyword = query.keyword
        if (query.category) params.category = query.category
        if (query.status && query.status.length > 0) params.status = query.status.join(',')
        const res = await api.get('/basic/device-spare-parts', { params })
        if (cancelled) return
        const list = res.data || []
        setData(list)
        setTotal(res.total || list.length)
      } catch (err: any) {
        if (!cancelled) {
          message.error(err.message || '获取备件列表失败')
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

  // 获取低库存预警数与本月出入库金额
  useEffect(() => {
    let cancelled = false
    const monthStart = dayjs().startOf('month').format('YYYY-MM-DD')
    const today = dayjs().format('YYYY-MM-DD')
    const run = async () => {
      try {
        const [lowRes, inRes, outRes] = await Promise.all([
          api.get('/basic/device-spare-parts/low-stock/list', { params: { page: 1, pageSize: 1 } }),
          api.get('/basic/device-spare-part-logs', { params: { log_type: 'in', start_date: monthStart, end_date: today, page: 1, pageSize: 200 } }),
          api.get('/basic/device-spare-part-logs', { params: { log_type: 'out', start_date: monthStart, end_date: today, page: 1, pageSize: 200 } }),
        ])
        if (cancelled) return
        setLowStockCount(lowRes.total || 0)
        const inSum = (inRes.data || []).reduce((s: number, r: any) => s + Number(r.total_price || 0), 0)
        const outSum = (outRes.data || []).reduce((s: number, r: any) => s + Number(r.total_price || 0), 0)
        setMonthInAmount(inSum)
        setMonthOutAmount(outSum)
      } catch {
        if (!cancelled) {
          setLowStockCount(0)
          setMonthInAmount(0)
          setMonthOutAmount(0)
        }
      }
    }
    run()
    return () => { cancelled = true }
  }, [statsTick])

  const refresh = useCallback(() => {
    setQuery(q => ({ ...q }))
    setStatsTick(t => t + 1)
  }, [])

  const handleSearch = () => {
    setQuery(q => ({ ...q, page: 1, keyword: keywordInput, category: categoryInput, status: statusInput }))
  }

  const handleReset = () => {
    setKeywordInput('')
    setCategoryInput(undefined)
    setStatusInput([1, 0])
    setQuery(q => ({ ...q, page: 1, keyword: '', category: undefined, status: [1, 0] }))
  }

  // 新增/编辑
  const handleAdd = () => {
    setEditing(null)
    setModalVisible(true)
  }
  const handleEdit = (record: any) => {
    setEditing(record)
    setModalVisible(true)
  }
  const handleAfterOpenChange = (open: boolean) => {
    if (!open) return
    if (editing) {
      form.setFieldsValue({
        part_code: editing.part_code,
        part_name: editing.part_name,
        specification: editing.specification,
        unit: editing.unit || '个',
        category: editing.category,
        safety_stock_min: editing.safety_stock_min ?? 0,
        safety_stock_max: editing.safety_stock_max ?? 0,
        current_stock: editing.current_stock ?? 0,
        warehouse: editing.warehouse,
        shelf: editing.shelf,
        layer: editing.layer,
        status: editing.status ?? 1,
        remarks: editing.remarks,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({ unit: '个', safety_stock_min: 0, safety_stock_max: 0, current_stock: 0, status: 1 })
    }
  }
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      if (editing) {
        const res = await api.put(`/basic/device-spare-parts/${editing.part_id}`, values)
        message.success(res.message || '备件编辑成功')
      } else {
        const res = await api.post('/basic/device-spare-parts', values)
        message.success(res.message || '备件新增成功')
      }
      setModalVisible(false)
      refresh()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e.message || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (record: any) => {
    try {
      const res = await api.delete(`/basic/device-spare-parts/${record.part_id}`)
      message.success(res.message || '删除成功')
      refresh()
    } catch (err: any) {
      message.error(err.message || '删除失败')
    }
  }

  // 入库
  const handleStockIn = (record: any) => {
    setStockInPart(record)
    setStockInVisible(true)
  }
  const handleStockInAfterOpen = (open: boolean) => {
    if (!open) return
    stockInForm.resetFields()
    stockInForm.setFieldsValue({ quantity: 1 })
  }
  const submitStockIn = async () => {
    try {
      const values = await stockInForm.validateFields()
      setSubmitting(true)
      const res = await api.post(`/basic/device-spare-parts/${stockInPart.part_id}/stock-in`, values)
      message.success(res.message || '入库成功')
      setStockInVisible(false)
      refresh()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e.message || '入库失败')
    } finally {
      setSubmitting(false)
    }
  }

  // 出库
  const handleStockOut = (record: any) => {
    setStockOutPart(record)
    setStockOutVisible(true)
  }
  const handleStockOutAfterOpen = (open: boolean) => {
    if (!open) return
    stockOutForm.resetFields()
    stockOutForm.setFieldsValue({ quantity: 1 })
  }
  const submitStockOut = async () => {
    try {
      const values = await stockOutForm.validateFields()
      setSubmitting(true)
      const res = await api.post(`/basic/device-spare-parts/${stockOutPart.part_id}/stock-out`, values)
      message.success(res.message || '出库成功')
      setStockOutVisible(false)
      refresh()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e.message || '出库失败')
    } finally {
      setSubmitting(false)
    }
  }

  // 调整
  const handleAdjust = (record: any) => {
    setAdjustPart(record)
    setAdjustVisible(true)
  }
  const handleAdjustAfterOpen = (open: boolean) => {
    if (!open) return
    adjustForm.resetFields()
    adjustForm.setFieldsValue({ actual_stock: adjustPart?.current_stock ?? 0 })
  }
  const submitAdjust = async () => {
    try {
      const values = await adjustForm.validateFields()
      setSubmitting(true)
      const res = await api.post(`/basic/device-spare-parts/${adjustPart.part_id}/adjust`, values)
      message.success(res.message || '调整成功')
      setAdjustVisible(false)
      refresh()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e.message || '调整失败')
    } finally {
      setSubmitting(false)
    }
  }

  // 流水查询
  const openLogDrawer = (record?: any) => {
    if (record) {
      setLogPartIdInput(record.part_id)
      setLogQuery({ page: 1, pageSize: 20, part_id: record.part_id, log_type: undefined })
    } else {
      setLogPartIdInput(undefined)
      setLogTypeInput(undefined)
      setLogQuery({ page: 1, pageSize: 20, part_id: undefined, log_type: undefined })
    }
    setLogDrawerOpen(true)
  }
  const loadLogs = useCallback(async (cancelled: boolean) => {
    setLogLoading(true)
    try {
      const params: Record<string, unknown> = { page: logQuery.page, pageSize: logQuery.pageSize }
      if (logQuery.part_id) params.part_id = logQuery.part_id
      if (logQuery.log_type) params.log_type = logQuery.log_type
      const res = await api.get('/basic/device-spare-part-logs', { params })
      if (cancelled) return
      setLogData(res.data || [])
      setLogTotal(res.total || 0)
    } catch (err: any) {
      if (!cancelled) {
        message.error(err.message || '获取流水失败')
        setLogData([])
        setLogTotal(0)
      }
    } finally {
      if (!cancelled) setLogLoading(false)
    }
  }, [logQuery, message])
  useEffect(() => {
    if (!logDrawerOpen) return
    let cancelled = false
    const run = async () => { await loadLogs(cancelled) }
    run()
    return () => { cancelled = true }
  }, [logDrawerOpen, loadLogs])
  const handleLogSearch = () => {
    setLogQuery(q => ({ ...q, page: 1, part_id: logPartIdInput, log_type: logTypeInput }))
  }
  const handleLogReset = () => {
    setLogPartIdInput(undefined)
    setLogTypeInput(undefined)
    setLogQuery(q => ({ ...q, page: 1, part_id: undefined, log_type: undefined }))
  }

  const isLowStock = (record: any) => Number(record.current_stock ?? 0) < Number(record.safety_stock_min ?? 0)

  const columns = [
    { title: '备件编号', dataIndex: 'part_code', key: 'part_code', width: 130 },
    { title: '备件名称', dataIndex: 'part_name', key: 'part_name', width: 180 },
    { title: '规格型号', dataIndex: 'specification', key: 'specification', width: 140 },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 70 },
    { title: '分类', dataIndex: 'category', key: 'category', width: 90, render: (v: string) => v ? <Tag>{v}</Tag> : '-' },
    {
      title: '当前库存', dataIndex: 'current_stock', key: 'current_stock', width: 100,
      render: (v: number, record: any) => {
        const low = isLowStock(record)
        return (
          <span style={{ color: low ? '#f5222d' : undefined, fontWeight: low ? 600 : 400 }}>
            {v}
            {low && <Tooltip title={`低于安全下限 ${record.safety_stock_min}`}><WarningOutlined style={{ marginLeft: 4, color: '#f5222d' }} /></Tooltip>}
          </span>
        )
      },
    },
    { title: '安全下限', dataIndex: 'safety_stock_min', key: 'safety_stock_min', width: 90 },
    { title: '安全上限', dataIndex: 'safety_stock_max', key: 'safety_stock_max', width: 90 },
    {
      title: '库位', key: 'location', width: 160,
      render: (_: any, record: any) => {
        const parts = [record.warehouse, record.shelf, record.layer].filter(Boolean)
        return parts.length ? parts.join(' / ') : '-'
      },
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (v: number) => v === 1 ? <Tag color="green">启用</Tag> : <Tag color="red">禁用</Tag>,
    },
    {
      title: '操作', key: 'action', width: 200, fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space size="small" wrap>
          <Button type="link" size="small" onClick={() => openLogDrawer(record)} icon={<HistoryOutlined />}>流水</Button>
          {hasPermission('device:spare-part:stock') && (
            <Dropdown
              menu={{
                items: [
                  { key: 'in', label: '采购入库', icon: <ImportOutlined /> },
                  { key: 'out', label: '领用出库', icon: <ExportOutlined /> },
                  { key: 'adjust', label: '库存调整', icon: <SwapOutlined /> },
                ],
                onClick: ({ key }) => {
                  if (key === 'in') handleStockIn(record)
                  else if (key === 'out') handleStockOut(record)
                  else if (key === 'adjust') handleAdjust(record)
                },
              }}
            >
              <Button type="link" size="small">库存<DownOutlined /></Button>
            </Dropdown>
          )}
          {hasPermission('device:spare-part:update') && (
            <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
          )}
          {hasPermission('device:spare-part:delete') && (
            <Popconfirm title="确定删除该备件吗？" onConfirm={() => handleDelete(record)}>
              <Button type="link" size="small" danger>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const filters: FilterItem[] = [
    { type: 'input', placeholder: '搜索编号/名称/规格', field: 'keyword', col: { flex: '200px' }, value: keywordInput, onChange: (e) => setKeywordInput((e as React.ChangeEvent<HTMLInputElement>).target.value) },
    { type: 'select', placeholder: '分类', field: 'category', options: categoryFilterOptions, col: { flex: '130px' }, value: categoryInput, onChange: (v) => setCategoryInput(v as number | string | undefined) },
    {
      type: 'checkbox-group', field: 'status', col: { flex: '160px' },
      options: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }],
      value: statusInput, onChange: (v) => setStatusInput(v as number[]),
    },
  ]

  return (
    <>
      <ThreeSectionPage
        title="设备备件管理"
        breadcrumbs="设备管理 / 备件管理"
        stats={stats}
        filters={filters}
        onSearch={handleSearch}
        onReset={handleReset}
        actions={
          <ActionButtons
            hasAdd={false}
            hasExport={false}
            extra={[
              <Button key="logs" icon={<HistoryOutlined />} onClick={() => openLogDrawer()}>出入库流水</Button>,
              hasPermission('device:spare-part:create') && (
                <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增备件</Button>
              ),
            ]}
          />
        }
        table={
          <ResizableTable
            tableKey="pages_device_DeviceSparePart"
            columns={columns}
            dataSource={data}
            rowKey="part_id"
            size="small"
            loading={loading}
            scroll={{ x: 1500 }}
            rowClassName={(record: any) => isLowStock(record) ? 'low-stock-row' : ''}
            pagination={{
              current: query.page,
              pageSize: query.pageSize,
              total,
              showSizeChanger: true,
              showTotal: t => `共 ${t} 条`,
              onChange: (p, ps) => setQuery(q => ({ ...q, page: p, pageSize: ps })),
            }}
          />
        }
      />
      <style>{`
        .low-stock-row > td { background: #fff1f0 !important; }
        .low-stock-row:hover > td { background: #ffe7e5 !important; }
      `}</style>

      {/* 新增/编辑备件 */}
      <Modal
        title={editing ? '编辑备件' : '新增备件'}
        open={modalVisible}
        onOk={handleSubmit}
        confirmLoading={submitting}
        onCancel={() => setModalVisible(false)}
        afterOpenChange={handleAfterOpenChange}
        okText="保存"
        cancelText="取消"
        width={720}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="part_name" label="备件名称" rules={[{ required: true, message: '请输入备件名称' }]}>
                <Input placeholder="请输入备件名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="part_code" label="备件编号">
                <Input placeholder="留空则系统不强制，重复将报错" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="specification" label="规格型号">
                <Input placeholder="请输入规格型号" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="unit" label="单位">
                <Input placeholder="如：个/件/米" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="category" label="分类">
                <Select placeholder="请选择分类" showSearch allowClear options={categoryOptions} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="current_stock" label="当前库存" rules={[{ required: true, message: '请输入当前库存' }]}>
                <InputNumber min={0} precision={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="safety_stock_min" label="安全库存下限">
                <InputNumber min={0} precision={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="safety_stock_max" label="安全库存上限">
                <InputNumber min={0} precision={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="warehouse" label="仓库">
                <Input placeholder="请输入仓库" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="shelf" label="货架">
                <Input placeholder="请输入货架" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="layer" label="层位">
                <Input placeholder="请输入层位" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
                <Select options={statusOptions} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 采购入库 */}
      <Modal
        title={`采购入库 - ${stockInPart?.part_name || ''}`}
        open={stockInVisible}
        onOk={submitStockIn}
        confirmLoading={submitting}
        onCancel={() => setStockInVisible(false)}
        afterOpenChange={handleStockInAfterOpen}
        okText="确认入库"
        cancelText="取消"
        width={520}
        destroyOnHidden
      >
        <Form form={stockInForm} layout="vertical" preserve={false}>
          {stockInPart && (
            <Descriptions size="small" column={2} style={{ marginBottom: 12 }}>
              <Descriptions.Item label="备件编号">{stockInPart.part_code || '-'}</Descriptions.Item>
              <Descriptions.Item label="当前库存">{stockInPart.current_stock} {stockInPart.unit}</Descriptions.Item>
            </Descriptions>
          )}
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="quantity" label="入库数量" rules={[{ required: true, message: '请输入入库数量' }]}>
                <InputNumber min={1} precision={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="unit_price" label="单价（元）">
                <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="请输入单价" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="purchase_no" label="采购单号">
                <Input placeholder="请输入采购单号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="supplier" label="供应商">
                <Input placeholder="请输入供应商" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="related_order" label="关联工单号">
            <Input placeholder="可选，关联维护/维修工单" />
          </Form.Item>
          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 领用出库 */}
      <Modal
        title={`领用出库 - ${stockOutPart?.part_name || ''}`}
        open={stockOutVisible}
        onOk={submitStockOut}
        confirmLoading={submitting}
        onCancel={() => setStockOutVisible(false)}
        afterOpenChange={handleStockOutAfterOpen}
        okText="确认出库"
        cancelText="取消"
        width={520}
        destroyOnHidden
      >
        <Form form={stockOutForm} layout="vertical" preserve={false}>
          {stockOutPart && (
            <Descriptions size="small" column={2} style={{ marginBottom: 12 }}>
              <Descriptions.Item label="备件编号">{stockOutPart.part_code || '-'}</Descriptions.Item>
              <Descriptions.Item label="当前库存">{stockOutPart.current_stock} {stockOutPart.unit}</Descriptions.Item>
            </Descriptions>
          )}
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="quantity" label="出库数量" rules={[{ required: true, message: '请输入出库数量' }]}>
                <InputNumber min={1} precision={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="unit_price" label="成本单价（元）">
                <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="用于核算出库金额" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="related_order" label="关联工单号">
            <Input placeholder="请输入关联工单号（维护/维修）" />
          </Form.Item>
          <Form.Item name="remarks" label="用途/备注" rules={[{ required: true, message: '请输入用途' }]}>
            <Input.TextArea rows={2} placeholder="请输入用途或备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 库存调整 */}
      <Modal
        title={`库存盘点调整 - ${adjustPart?.part_name || ''}`}
        open={adjustVisible}
        onOk={submitAdjust}
        confirmLoading={submitting}
        onCancel={() => setAdjustVisible(false)}
        afterOpenChange={handleAdjustAfterOpen}
        okText="确认调整"
        cancelText="取消"
        width={480}
        destroyOnHidden
      >
        <Form form={adjustForm} layout="vertical" preserve={false}>
          {adjustPart && (
            <Descriptions size="small" column={2} style={{ marginBottom: 12 }}>
              <Descriptions.Item label="备件编号">{adjustPart.part_code || '-'}</Descriptions.Item>
              <Descriptions.Item label="当前库存">{adjustPart.current_stock} {adjustPart.unit}</Descriptions.Item>
            </Descriptions>
          )}
          <Form.Item name="actual_stock" label="盘点实际数量" rules={[{ required: true, message: '请输入盘点数量' }]}>
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="remarks" label="调整原因">
            <Input.TextArea rows={2} placeholder="请输入盘点调整原因" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 出入库流水 Drawer */}
      <Drawer
        title="出入库流水查询"
        open={logDrawerOpen}
        onClose={() => setLogDrawerOpen(false)}
        width={920}
      >
        <Row gutter={8} style={{ marginBottom: 12 }}>
          <Col flex="160px">
            <Select
              placeholder="按备件ID筛选"
              allowClear
              showSearch
              style={{ width: '100%' }}
              options={data.map(d => ({ label: `${d.part_code || ''} ${d.part_name}`, value: d.part_id }))}
              value={logPartIdInput}
              onChange={(v) => setLogPartIdInput(v)}
            />
          </Col>
          <Col flex="120px">
            <Select
              placeholder="类型"
              allowClear
              style={{ width: '100%' }}
              options={[{ label: '入库', value: 'in' }, { label: '出库', value: 'out' }, { label: '调整', value: 'adjust' }]}
              value={logTypeInput}
              onChange={(v) => setLogTypeInput(v)}
            />
          </Col>
          <Col>
            <Space>
              <Button type="primary" onClick={handleLogSearch}>查询</Button>
              <Button onClick={handleLogReset}>重置</Button>
            </Space>
          </Col>
        </Row>
        <ResizableTable
          tableKey="pages_device_DeviceSparePart_logs"
          columns={[
            { title: '流水号', dataIndex: 'log_id', key: 'log_id', width: 80 },
            { title: '备件编号', dataIndex: 'part_code', key: 'part_code', width: 120 },
            { title: '备件名称', dataIndex: 'part_name', key: 'part_name', width: 160 },
            {
              title: '类型', dataIndex: 'log_type', key: 'log_type', width: 80,
              render: (v: string) => <Tag color={logTypeColorMap[v]}>{logTypeTextMap[v] || v}</Tag>,
            },
            { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 80 },
            { title: '单价', dataIndex: 'unit_price', key: 'unit_price', width: 90, render: (v: any) => v != null ? fmtMoney(v) : '-' },
            { title: '金额', dataIndex: 'total_price', key: 'total_price', width: 100, render: (v: any) => v != null ? fmtMoney(v) : '-' },
            { title: '供应商', dataIndex: 'supplier', key: 'supplier', width: 120 },
            { title: '采购单号', dataIndex: 'purchase_no', key: 'purchase_no', width: 120 },
            { title: '关联工单', dataIndex: 'related_order', key: 'related_order', width: 120 },
            { title: '操作人', dataIndex: 'operator_name', key: 'operator_name', width: 90 },
            {
              title: '时间', dataIndex: 'created_at', key: 'created_at', width: 160,
              render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-',
            },
            { title: '备注', dataIndex: 'remarks', key: 'remarks', width: 180 },
          ]}
          dataSource={logData}
          rowKey="log_id"
          size="small"
          loading={logLoading}
          scroll={{ x: 1500 }}
          pagination={{
            current: logQuery.page,
            pageSize: logQuery.pageSize,
            total: logTotal,
            showSizeChanger: true,
            showTotal: t => `共 ${t} 条`,
            onChange: (p, ps) => setLogQuery(q => ({ ...q, page: p, pageSize: ps })),
          }}
        />
      </Drawer>
    </>
  )
}
