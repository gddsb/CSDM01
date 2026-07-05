import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Tag, Button, Modal, Form, Input, Select, message,
  Row, Col, Drawer, Descriptions, Space, Popconfirm, Tooltip, Statistic, Card,
} from 'antd'
import {
  KeyOutlined, PlusOutlined, EyeOutlined,
  LockOutlined, UnlockOutlined, PauseCircleOutlined,
  PlayCircleOutlined, ThunderboltOutlined,
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import api from '../../utils/api'

const dateFormatOptions = [
  { label: '不包含日期（none）', value: 'none' },
  { label: 'YYMMDD（如 260705）', value: 'YYMMDD' },
  { label: 'YYYYMMDD（如 20260705）', value: 'YYYYMMDD' },
  { label: 'YYYY（如 2026）', value: 'YYYY' },
]

const resetByOptions = [
  { label: '每日重置（daily）', value: 'daily' },
  { label: '每年重置（yearly）', value: 'yearly' },
  { label: '从不重置（never）', value: 'never' },
]

const seqWidthOptions = [
  { label: '3 位（001-999）', value: 3 },
  { label: '4 位（0001-9999）', value: 4 },
  { label: '5 位（00001-99999）', value: 5 },
  { label: '6 位（000001-999999）', value: 6 },
]

// 关联表单字段预设（系统中需要使用编号规则的表单）
const targetFieldPresets = [
  { label: '生产订单编号（production_order.order_no）', value: 'production_order|order_no|生产订单编号' },
  { label: '工单编号（work_order.work_order_no）', value: 'work_order|work_order_no|工单编号' },
  { label: '来料检验编号（quality_incoming.inspection_no）', value: 'quality_incoming|inspection_no|来料检验编号' },
  { label: '过程检验编号（quality_process.inspection_no）', value: 'quality_process|inspection_no|过程检验编号' },
  { label: '成品检验编号（quality_finished.inspection_no）', value: 'quality_finished|inspection_no|成品检验编号' },
  { label: '微生物检验编号（quality_microbe.inspection_no）', value: 'quality_microbe|inspection_no|微生物检验编号' },
  { label: '环境检验编号（quality_environment.inspection_no）', value: 'quality_environment|inspection_no|环境检验编号' },
  { label: '检测仪器编号（quality_instrument.instrument_no）', value: 'quality_instrument|instrument_no|检测仪器编号' },
  { label: '客诉编号（quality_complaint.complaint_no）', value: 'quality_complaint|complaint_no|客诉编号' },
  { label: '供应商投诉编号（quality_supplier_complaint.complaint_no）', value: 'quality_supplier_complaint|complaint_no|供应商投诉编号' },
  { label: '检验标准编号（quality_standard.standard_no）', value: 'quality_standard|standard_no|检验标准编号' },
  { label: '不合格品处理单编号（quality_ncr.ncr_no）', value: 'quality_ncr|ncr_no|不合格品处理单编号' },
]

export default function NumberRuleManagement() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [editing, setEditing] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [viewRecord, setViewRecord] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [previewNo, setPreviewNo] = useState(null)
  const [form] = Form.useForm()

  const [keywordInput, setKeywordInput] = useState('')
  const [statusInput, setStatusInput] = useState(undefined)
  const [query, setQuery] = useState({ page: 1, pageSize: 30, keyword: '', status: undefined })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page: query.page, pageSize: query.pageSize }
      if (query.keyword) params.keyword = query.keyword
      if (query.status !== undefined && query.status !== null) params.status = query.status
      const res = await api.get('/basic/number-rules', { params })
      setData(res.data || [])
      setTotal(res.total || (res.data || []).length)
    } catch (err) {
      message.error(err.message || '获取编号规则列表失败')
      setData([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const refresh = useCallback(() => setQuery(q => ({ ...q })), [])

  const handleSearch = () => {
    setQuery(q => ({ ...q, page: 1, keyword: keywordInput, status: statusInput }))
  }

  const handleReset = () => {
    setKeywordInput('')
    setStatusInput(undefined)
    setQuery(q => ({ ...q, page: 1, keyword: '', status: undefined }))
  }

  const handleAdd = () => {
    setEditing(null)
    setPreviewNo(null)
    setModalVisible(true)
  }

  const handleEdit = (record) => {
    setEditing(record)
    setPreviewNo(null)
    setModalVisible(true)
  }

  const handleAfterOpenChange = (open) => {
    if (!open) return
    if (editing) {
      form.setFieldsValue({
        rule_name: editing.rule_name,
        rule_code: editing.rule_code,
        prefix: editing.prefix,
        date_format: editing.date_format,
        separator: editing.separator,
        seq_width: editing.seq_width,
        reset_by: editing.reset_by,
        target_preset: editing.target_table && editing.target_field
          ? `${editing.target_table}|${editing.target_field}|${editing.target_label || ''}`
          : undefined,
        target_table: editing.target_table,
        target_field: editing.target_field,
        target_label: editing.target_label,
        description: editing.description,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({
        date_format: 'YYMMDD',
        separator: '',
        seq_width: 3,
        reset_by: 'daily',
      })
    }
  }

  // 表单值实时预览编号
  const handleFormChange = async () => {
    try {
      const values = await form.validateFields(['prefix', 'date_format', 'separator', 'seq_width'], { validateOnly: true })
      const now = new Date()
      const yy = String(now.getFullYear()).slice(2)
      const yyyy = String(now.getFullYear())
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const dd = String(now.getDate()).padStart(2, '0')
      let datePart = ''
      if (values.date_format === 'YYMMDD') datePart = `${yy}${mm}${dd}`
      else if (values.date_format === 'YYYYMMDD') datePart = `${yyyy}${mm}${dd}`
      else if (values.date_format === 'YYYY') datePart = yyyy
      const sep = values.separator || ''
      const seqStr = String(1).padStart(values.seq_width || 3, '0')
      setPreviewNo(`${values.prefix || ''}${sep}${datePart}${sep}${seqStr}`)
    } catch (e) {
      // 校验失败时清空预览
      setPreviewNo(null)
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const preset = values.target_preset
      let target_table = values.target_table
      let target_field = values.target_field
      let target_label = values.target_label
      if (preset) {
        const parts = preset.split('|')
        target_table = parts[0]
        target_field = parts[1]
        target_label = parts[2]
      }
      const payload = {
        rule_name: values.rule_name,
        rule_code: values.rule_code,
        prefix: values.prefix,
        date_format: values.date_format,
        separator: values.separator || '',
        seq_width: values.seq_width,
        reset_by: values.reset_by,
        target_table,
        target_field,
        target_label,
        description: values.description || '',
      }
      if (editing) {
        const res = await api.put(`/basic/number-rules/${editing.rule_id}`, payload)
        message.success(res.message || '编号规则修改成功')
      } else {
        const res = await api.post('/basic/number-rules', payload)
        message.success(res.message || '编号规则创建成功')
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
      const res = await api.delete(`/basic/number-rules/${record.rule_id}`)
      message.success(res.message || '删除成功')
      refresh()
    } catch (err) {
      message.error(err.message || '删除失败')
    }
  }

  const handleToggle = async (record) => {
    try {
      const res = await api.post(`/basic/number-rules/${record.rule_id}/toggle`)
      message.success(res.message || '状态切换成功')
      refresh()
    } catch (err) {
      message.error(err.message || '状态切换失败')
    }
  }

  const handlePreview = async (record) => {
    try {
      const res = await api.get(`/basic/number-rules/${record.rule_id}/preview`)
      Modal.info({
        title: '编号预览',
        content: (
          <div style={{ fontSize: 14, padding: '12px 0' }}>
            <div>下一个编号：<b style={{ fontSize: 18, color: '#2196F3' }}>{res.data.preview_no}</b></div>
            <div style={{ marginTop: 8, color: '#666' }}>下一个序号值：{res.data.next_seq}</div>
            <div style={{ marginTop: 4, color: '#666' }}>当前已使用：{record.used_count || 0} 条</div>
          </div>
        ),
        okText: '知道了',
      })
    } catch (err) {
      message.error(err.message || '预览失败')
    }
  }

  const columns = [
    { title: '规则名称', dataIndex: 'rule_name', key: 'rule_name', width: 140, fixed: 'left' },
    { title: '规则编码', dataIndex: 'rule_code', key: 'rule_code', width: 130 },
    { title: '前缀', dataIndex: 'prefix', key: 'prefix', width: 80 },
    {
      title: '日期格式', dataIndex: 'date_format', key: 'date_format', width: 110,
      render: v => v === 'none' ? <Tag>无</Tag> : <Tag color="blue">{v}</Tag>,
    },
    { title: '分隔符', dataIndex: 'separator', key: 'separator', width: 70, render: v => v || <Tag>无</Tag> },
    { title: '序号位数', dataIndex: 'seq_width', key: 'seq_width', width: 80 },
    {
      title: '重置周期', dataIndex: 'reset_by', key: 'reset_by', width: 90,
      render: v => {
        const map = { daily: '每日', yearly: '每年', never: '从不' }
        return map[v] || v
      },
    },
    {
      title: '关联表单字段', key: 'target', width: 200,
      render: (_, r) => r.target_table
        ? <Tooltip title={`${r.target_table}.${r.target_field}`}><span>{r.target_label || r.target_field}</span></Tooltip>
        : <Tag>未关联</Tag>,
    },
    {
      title: '已使用', dataIndex: 'used_count', key: 'used_count', width: 80,
      render: v => <Tag color="orange">{v || 0}</Tag>,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: v => <Tag color={v === 1 ? 'green' : 'default'}>{v === 1 ? '启用' : '停用'}</Tag>,
    },
    {
      title: '操作', key: 'action', width: 200, fixed: 'right',
      render: (_, record) => (
        <Space size="small" wrap>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setViewRecord(record)}>查看</Button>
          <Button type="link" size="small" icon={<ThunderboltOutlined />} onClick={() => handlePreview(record)}>预览</Button>
          {record.is_locked !== 1 && (
            <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
          )}
          <Button
            type="link" size="small"
            icon={record.status === 1 ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            onClick={() => handleToggle(record)}
          >
            {record.status === 1 ? '停用' : '启用'}
          </Button>
          {record.is_locked !== 1 && (
            <Popconfirm
              title="确认删除该编号规则？"
              onConfirm={() => handleDelete(record)}
              okText="确认"
              cancelText="取消"
            >
              <Button type="link" size="small" danger>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const filters = [
    { type: 'input', placeholder: '搜索规则名称/编码', col: { span: 8 }, value: keywordInput, onChange: e => setKeywordInput(e.target.value) },
    {
      type: 'select', placeholder: '状态筛选', col: { span: 6 },
      options: [{ label: '启用', value: 1 }, { label: '停用', value: 0 }],
      value: statusInput, onChange: v => setStatusInput(v),
    },
  ]

  const stats = [
    { label: '规则总数', value: total, icon: <KeyOutlined />, color: '#2196F3' },
    { label: '已审核', value: data.filter(d => d.is_locked === 1).length, icon: <LockOutlined />, color: '#4CAF50' },
    { label: '启用中', value: data.filter(d => d.status === 1).length, icon: <PlayCircleOutlined />, color: '#FF9800' },
    { label: '累计生成', value: data.reduce((s, d) => s + (d.used_count || 0), 0), icon: <ThunderboltOutlined />, color: '#9C27B0' },
  ]

  return (
    <>
      <ThreeSectionPage
        title="编码管理"
        breadcrumbs="基础数据 / 编码管理"
        stats={stats}
        filters={filters}
        onSearch={handleSearch}
        onReset={handleReset}
        actions={
          <ActionButtons
            hasAdd={false}
            hasExport={false}
            extra={[
              <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增规则</Button>,
            ]}
          />
        }
        table={
          <Table
            columns={columns}
            dataSource={data}
            rowKey="rule_id"
            size="small"
            loading={loading}
            scroll={{ x: 1450 }}
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
      <Modal
        title={editing ? '编辑编号规则' : '新增编号规则'}
        open={modalVisible}
        onOk={handleSubmit}
        confirmLoading={submitting}
        onCancel={() => setModalVisible(false)}
        afterOpenChange={handleAfterOpenChange}
        okText="保存"
        cancelText="取消"
        width={780}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          className="compact-form"
          preserve={false}
          onValuesChange={handleFormChange}
        >
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="rule_name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
                <Input placeholder="如：生产订单号" disabled={!!editing && editing.is_locked === 1} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="rule_code" label="规则编码" rules={[{ required: true, message: '请输入规则编码' }]}>
                <Input placeholder="如：ORDER（大写字母+下划线）" disabled={!!editing} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={6}>
              <Form.Item name="prefix" label="前缀" rules={[{ required: true, message: '请输入前缀' }]}>
                <Input placeholder="如：MO-16" disabled={!!editing && editing.is_locked === 1} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="date_format" label="日期格式" rules={[{ required: true }]}>
                <Select options={dateFormatOptions} disabled={!!editing && editing.is_locked === 1} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="separator" label="分隔符">
                <Input placeholder="如：- 或留空" disabled={!!editing && editing.is_locked === 1} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="seq_width" label="序号位数" rules={[{ required: true }]}>
                <Select options={seqWidthOptions} disabled={!!editing && editing.is_locked === 1} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="reset_by" label="重置周期" rules={[{ required: true }]}>
                <Select options={resetByOptions} disabled={!!editing && editing.is_locked === 1} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="target_preset" label="关联表单字段">
                <Select
                  placeholder="请选择需要使用此编号规则的表单字段"
                  options={targetFieldPresets}
                  allowClear
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="规则说明">
            <Input.TextArea placeholder="请输入规则说明" rows={2} />
          </Form.Item>
          {previewNo && (
            <Card size="small" style={{ marginBottom: 12, background: 'var(--bg-secondary, #fafafa)' }}>
              <Statistic
                title="编号预览（按当前时间 + 序号 1 生成）"
                value={previewNo}
                valueStyle={{ fontFamily: 'monospace', color: '#2196F3', fontSize: 20 }}
              />
            </Card>
          )}
          {editing && editing.is_locked === 1 && (
            <div style={{ color: '#faad14', fontSize: 12 }}>
              <LockOutlined /> 该规则已启用审核，核心配置（前缀、日期格式、分隔符、序号位数、重置周期）不允许修改，
              但可以修改关联表单字段和规则说明，以及停用/启用。
            </div>
          )}
        </Form>
      </Modal>
      <Drawer
        title="查看编号规则"
        open={!!viewRecord}
        onClose={() => setViewRecord(null)}
        width={560}
      >
        {viewRecord && (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="规则名称">{viewRecord.rule_name}</Descriptions.Item>
            <Descriptions.Item label="规则编码"><code>{viewRecord.rule_code}</code></Descriptions.Item>
            <Descriptions.Item label="前缀">{viewRecord.prefix}</Descriptions.Item>
            <Descriptions.Item label="日期格式">{viewRecord.date_format}</Descriptions.Item>
            <Descriptions.Item label="分隔符">{viewRecord.separator || '无'}</Descriptions.Item>
            <Descriptions.Item label="序号位数">{viewRecord.seq_width} 位</Descriptions.Item>
            <Descriptions.Item label="重置周期">
              {viewRecord.reset_by === 'daily' ? '每日重置' : viewRecord.reset_by === 'yearly' ? '每年重置' : '从不重置'}
            </Descriptions.Item>
            <Descriptions.Item label="关联表单字段">
              {viewRecord.target_table
                ? `${viewRecord.target_label || ''}（${viewRecord.target_table}.${viewRecord.target_field}）`
                : '未关联'}
            </Descriptions.Item>
            <Descriptions.Item label="当前最新编号">
              {viewRecord.current_no
                ? <span style={{ fontFamily: 'monospace', color: '#2196F3' }}>{viewRecord.current_no}</span>
                : '尚未生成'}
            </Descriptions.Item>
            <Descriptions.Item label="已使用记录数">
              <Tag color="orange">{viewRecord.used_count || 0} 条</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="审核状态">
              {viewRecord.is_locked === 1
                ? <Tag color="green" icon={<LockOutlined />}>已审核使用</Tag>
                : <Tag icon={<UnlockOutlined />}>未审核</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="启用状态">
              <Tag color={viewRecord.status === 1 ? 'green' : 'default'}>{viewRecord.status === 1 ? '启用' : '停用'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="规则说明">{viewRecord.description || '-'}</Descriptions.Item>
            <Descriptions.Item label="创建人">{viewRecord.created_by || '-'}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{viewRecord.created_at || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </>
  )
}
