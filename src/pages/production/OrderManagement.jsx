import React, { useState, useEffect, useCallback } from 'react'
import { Table, Tag, Button, Modal, Form, Input, InputNumber, Select, DatePicker, Space, Row, Col, message, Drawer, Descriptions, Popconfirm, Checkbox } from 'antd'
import {
  FileTextOutlined, PlusOutlined, SearchOutlined, ReloadOutlined,
  SendOutlined, ClockCircleOutlined, CheckCircleOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import api from '../../utils/api'
import { formatVersionNo } from '../../utils'

const { RangePicker } = DatePicker

const statusColorMap = {
  '开立': 'default',
  '下发': 'processing',
  '完工': 'success',
}

const statusOptions = [
  { label: '开立', value: '开立' },
  { label: '下发', value: '下发' },
  { label: '完工', value: '完工' },
]

export default function OrderManagement() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [materials, setMaterials] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [currentOrder, setCurrentOrder] = useState(null)
  const [editing, setEditing] = useState(null)
  const [selectedMaterial, setSelectedMaterial] = useState(null)
  const [form] = Form.useForm()

  // 筛选输入态
  const [keywordInput, setKeywordInput] = useState('')
  const [materialCodeInput, setMaterialCodeInput] = useState('')
  const [statusInput, setStatusInput] = useState(['开立', '下发'])
  const [planDateRange, setPlanDateRange] = useState(null)
  // 已应用的查询条件
  const [query, setQuery] = useState({ page: 1, pageSize: 30, keyword: '', materialCode: '', status: ['开立', '下发'], planDateStart: '', planDateEnd: '' })

  // 获取订单列表
  useEffect(() => {
    // 未选择任何状态时不查询，直接显示空列表
    if (!query.status || query.status.length === 0) {
      setData([])
      setTotal(0)
      return
    }
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const params = { page: query.page, pageSize: query.pageSize }
        if (query.keyword) params.keyword = query.keyword
        if (query.materialCode) params.materialCode = query.materialCode
        if (query.status && query.status.length > 0) params.status = query.status.join(',')
        if (query.planDateStart) params.planDateStart = query.planDateStart
        if (query.planDateEnd) params.planDateEnd = query.planDateEnd
        const res = await api.get('/production/orders', { params })
        if (cancelled) return
        const list = res.data || []
        setData(list)
        setTotal(res.total || list.length)
      } catch (err) {
        if (!cancelled) {
          message.error(err.message || '获取订单列表失败')
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

  // 获取料品列表（仅C开头成品罐）
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const res = await api.get('/basic/materials', { params: { page: 1, pageSize: 500 } })
        if (cancelled) return
        setMaterials(res.data || [])
      } catch (err) {
        if (!cancelled) message.error(err.message || '获取料品列表失败')
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  const refresh = useCallback(() => setQuery(q => ({ ...q })), [])

  // C开头的成品罐料品
  const cMaterials = materials.filter(m => m.material_code?.toUpperCase().startsWith('C'))

  const pendingCount = data.filter(o => o.status === '开立').length
  const releasedCount = data.filter(o => o.status === '下发').length
  const closedCount = data.filter(o => o.status === '完工').length

  const stats = [
    { label: '总订单数', value: total, icon: <FileTextOutlined />, color: '#2196F3' },
    { label: '开立', value: pendingCount, icon: <ClockCircleOutlined />, color: '#9E9E9E' },
    { label: '下发', value: releasedCount, icon: <SendOutlined />, color: '#FF9800' },
    { label: '完工', value: closedCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
  ]

  const handleRelease = (r) => {
    Modal.confirm({
      title: '确认下发',
      content: '确认下发该订单？下发后将不可修改和删除',
      okText: '确认下发',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await api.post(`/production/orders/${r.order_id}/release`)
          message.success(res.message || `订单 ${r.order_no} 已下发`)
          refresh()
        } catch (err) {
          message.error(err.message || '下发失败')
        }
      },
    })
  }

  const handleClose = (r) => {
    Modal.confirm({
      title: '确认完工',
      content: `确认完工订单 ${r.order_no}？完工后将不可恢复`,
      okText: '确认完工',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await api.post(`/production/orders/${r.order_id}/close`)
          message.success(res.message || '订单已完工')
          refresh()
        } catch (err) {
          message.error(err.message || '完工失败')
        }
      },
    })
  }

  const handleDelete = (r) => {
    Modal.confirm({
      title: '确认删除',
      content: `确认删除订单 ${r.order_no}？此操作不可恢复`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await api.delete(`/production/orders/${r.order_id}`)
          message.success(res.message || '订单已删除')
          refresh()
        } catch (err) {
          message.error(err.message || '删除失败')
        }
      },
    })
  }

  const handleAdd = () => {
    setEditing(null)
    form.resetFields()
    setSelectedMaterial(null)
    setAddOpen(true)
  }

  const handleEdit = (r) => {
    setEditing(r)
    const m = materials.find(mat => mat.material_id === r.material_id)
    setSelectedMaterial(m || null)
    form.setFieldsValue({
      material_id: r.material_id,
      planned_qty: r.planned_qty,
      plan_start_time: r.plan_start_time ? dayjs(r.plan_start_time) : undefined,
      plan_end_time: r.plan_end_time ? dayjs(r.plan_end_time) : undefined,
    })
    setAddOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const payload = {
        material_id: values.material_id,
        planned_qty: values.planned_qty,
        plan_start_time: values.plan_start_time.format('YYYY-MM-DD'),
        plan_end_time: values.plan_end_time.format('YYYY-MM-DD'),
      }
      if (editing) {
        const res = await api.put(`/production/orders/${editing.order_id}`, payload)
        message.success(res.message || '订单已更新')
      } else {
        const res = await api.post('/production/orders', payload)
        message.success(res.message || '订单已创建')
      }
      setAddOpen(false)
      refresh()
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleView = (r) => {
    setCurrentOrder(r)
    setDetailOpen(true)
  }

  const handleSearch = useCallback(() => {
    setQuery(q => ({
      ...q,
      page: 1,
      keyword: keywordInput,
      materialCode: materialCodeInput,
      status: statusInput,
      planDateStart: planDateRange?.[0]?.format('YYYY-MM-DD') || '',
      planDateEnd: planDateRange?.[1]?.format('YYYY-MM-DD') || '',
    }))
  }, [keywordInput, materialCodeInput, statusInput, planDateRange])

  const handleReset = () => {
    setKeywordInput('')
    setMaterialCodeInput('')
    setStatusInput(['开立', '下发'])
    setPlanDateRange(null)
    setQuery(q => ({ ...q, page: 1, keyword: '', materialCode: '', status: ['开立', '下发'], planDateStart: '', planDateEnd: '' }))
  }

  const renderActions = (r) => {
    if (r.status === '开立') {
      return (
        <Space size={0}>
          <Button type="link" size="small" onClick={() => handleRelease(r)}>下发</Button>
          <Button type="link" size="small" onClick={() => handleEdit(r)}>编辑</Button>
          <Popconfirm
            title={`确认删除订单 ${r.order_no}？`}
            onConfirm={() => handleDelete(r)}
            okText="删除"
            cancelText="取消"
          >
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
    if (r.status === '下发') {
      return (
        <Space size={0}>
          <Button type="link" size="small" onClick={() => handleView(r)}>查看</Button>
          <Button type="link" size="small" danger onClick={() => handleClose(r)}>完工</Button>
        </Space>
      )
    }
    return <Button type="link" size="small" onClick={() => handleView(r)}>查看</Button>
  }

  const columns = [
    { title: '订单编号', dataIndex: 'order_no', key: 'order_no', width: 160, fixed: 'left' },
    { title: '料号', dataIndex: 'material_code', key: 'material_code', width: 130, fixed: 'left' },
    { title: '料品名称', dataIndex: 'material_name', key: 'material_name', width: 200, render: (text) => <div style={{ wordBreak: 'break-word', whiteSpace: 'normal' }}>{text}</div> },
    { title: '规格', dataIndex: 'specification', key: 'specification', width: 120, ellipsis: true },
    { title: '菲林版本', dataIndex: 'film_version', key: 'film_version', width: 120 },
    { title: '版本', dataIndex: 'version_no', key: 'version_no', width: 60, render: v => formatVersionNo(v) },
    { title: '计划数量', dataIndex: 'planned_qty', key: 'planned_qty', width: 100, align: 'right', render: v => (v || 0).toLocaleString() },
    {
      title: '完工数量', dataIndex: 'finished_qty', key: 'finished_qty', width: 100, align: 'right', render: v => {
        const val = v || 0
        return <span style={{ color: val > 0 ? 'var(--color-success)' : 'var(--text-secondary)' }}>{val.toLocaleString()}</span>
      }
    },
    {
      title: '计划时间', key: 'plan_time', width: 160,
      render: (_, r) => <span style={{ fontSize: 12 }}>{r.plan_start_time ? String(r.plan_start_time).substring(0, 10) : '-'}<br />~ {r.plan_end_time ? String(r.plan_end_time).substring(0, 10) : '-'}</span>,
    },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: v => <Tag color={statusColorMap[v]}>{v}</Tag> },
    { title: '操作', key: 'action', width: 180, render: (_, r) => renderActions(r) },
  ]

  return (
    <>
      <ThreeSectionPage
        title="生产订单"
        breadcrumbs="生产管理 / 生产订单"
        stats={stats}
        actions={
          <ActionButtons
            hasAdd={false}
            hasExport={false}
            extra={[
              <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增订单</Button>,
            ]}
          />
        }
        table={
          <div>
            <Row gutter={[12, 8]} style={{ marginBottom: 12 }} align="middle">
              <Col flex="180px">
                <Input
                  placeholder="订单号"
                  allowClear
                  prefix={<SearchOutlined />}
                  value={keywordInput}
                  onChange={e => setKeywordInput(e.target.value)}
                  onPressEnter={handleSearch}
                  onBlur={handleSearch}
                />
              </Col>
              <Col flex="150px">
                <Input
                  placeholder="料号"
                  allowClear
                  value={materialCodeInput}
                  onChange={e => setMaterialCodeInput(e.target.value)}
                  onPressEnter={handleSearch}
                  onBlur={handleSearch}
                />
              </Col>
              <Col flex="230px">
                <Checkbox.Group
                  options={statusOptions}
                  value={statusInput}
                  onChange={(v) => {
                    setStatusInput(v)
                    setQuery(q => ({
                      ...q,
                      page: 1,
                      keyword: keywordInput,
                      materialCode: materialCodeInput,
                      status: v,
                      planDateStart: planDateRange?.[0]?.format('YYYY-MM-DD') || '',
                      planDateEnd: planDateRange?.[1]?.format('YYYY-MM-DD') || '',
                    }))
                  }}
                />
              </Col>
              <Col flex="260px">
                <RangePicker
                  placeholder={['计划开始', '计划结束']}
                  style={{ width: '100%' }}
                  value={planDateRange}
                  onChange={(v) => {
                    setPlanDateRange(v)
                    setQuery(q => ({
                      ...q,
                      page: 1,
                      keyword: keywordInput,
                      materialCode: materialCodeInput,
                      status: statusInput,
                      planDateStart: v?.[0]?.format('YYYY-MM-DD') || '',
                      planDateEnd: v?.[1]?.format('YYYY-MM-DD') || '',
                    }))
                  }}
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
              rowKey="order_id"
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
        title={editing ? '编辑订单' : '新增订单'}
        open={addOpen}
        onOk={handleSubmit}
        confirmLoading={submitting}
        onCancel={() => setAddOpen(false)}
        okText="保存"
        cancelText="取消"
        width={560}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          <Form.Item label="订单编号">
            <Input value={editing ? editing.order_no : '创建时由系统生成'} disabled />
          </Form.Item>
          <Row gutter={12}>
            <Col span={24}>
              <Form.Item label="料号" name="material_id" rules={[{ required: true, message: '请选择料号' }]}>
                <Select
                  placeholder="请输入或选择料号"
                  disabled={!!editing}
                  showSearch
                  allowClear
                  filterOption={(input, option) => {
                    const m = cMaterials.find(mat => mat.material_id === option.value)
                    if (!m) return false
                    return m.material_code.toLowerCase().includes(input.toLowerCase()) ||
                      (m.material_name || '').includes(input)
                  }}
                  onChange={v => {
                    const m = cMaterials.find(mat => mat.material_id === v)
                    setSelectedMaterial(m || null)
                  }}
                  options={cMaterials.map(m => ({ label: `${m.material_code} | ${m.material_name} | ${m.specification || ''}`, value: m.material_id }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="料品名称">
                <Input value={selectedMaterial?.material_name || '-'} disabled />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="规格">
                <Input value={selectedMaterial?.specification || '-'} disabled />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="菲林版本">
                <Input value={selectedMaterial?.film_no || '-'} disabled />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="版本号">
                <Input value={formatVersionNo(selectedMaterial?.version_no)} disabled />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="计划数量" name="planned_qty" rules={[{ required: true, message: '请输入计划数量' }]}>
                <InputNumber min={1} style={{ width: '100%' }} placeholder="请输入计划数量" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="计划开始日期" name="plan_start_time" rules={[{ required: true, message: '请选择计划开始日期' }]}>
                <DatePicker
                  format="YYYY-MM-DD"
                  style={{ width: '100%' }}
                  disabledDate={current => current && current < dayjs().startOf('day')}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="计划完成日期" name="plan_end_time" rules={[{ required: true, message: '请选择计划完成日期' }]}>
                <DatePicker
                  format="YYYY-MM-DD"
                  style={{ width: '100%' }}
                  disabledDate={current => {
                    const startVal = form.getFieldValue('plan_start_time')
                    return startVal && current && current < dayjs(startVal).startOf('day')
                  }}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Drawer
        title="订单详情"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width="40%"
      >
        {currentOrder && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="订单编号">{currentOrder.order_no}</Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color={statusColorMap[currentOrder.status]}>{currentOrder.status}</Tag></Descriptions.Item>
            <Descriptions.Item label="料号">{currentOrder.material_code}</Descriptions.Item>
            <Descriptions.Item label="品名">{currentOrder.material_name}</Descriptions.Item>
            <Descriptions.Item label="规格">{currentOrder.specification}</Descriptions.Item>
            <Descriptions.Item label="菲林版本">{currentOrder.film_version}</Descriptions.Item>
            <Descriptions.Item label="版本号">{formatVersionNo(currentOrder.version_no)}</Descriptions.Item>
            <Descriptions.Item label="计划数量">{(currentOrder.planned_qty || 0).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="完工数量">{(currentOrder.finished_qty || 0).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="计划开始">{currentOrder.plan_start_time || '-'}</Descriptions.Item>
            <Descriptions.Item label="计划完成">{currentOrder.plan_end_time || '-'}</Descriptions.Item>
            <Descriptions.Item label="下发时间">{currentOrder.release_time || '-'}</Descriptions.Item>
            <Descriptions.Item label="关闭时间">{currentOrder.close_time || '-'}</Descriptions.Item>
            <Descriptions.Item label="创建人">{currentOrder.created_by || '-'}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{currentOrder.created_at || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </>
  )
}
