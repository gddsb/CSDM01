import React, { useState, useEffect, useCallback } from 'react'
import { Table, Tag, Button, Space, Modal, Form, Input, InputNumber, Switch, Popconfirm, Row, Col, Tooltip, Typography } from 'antd'
import {
  OrderedListOutlined, CheckCircleOutlined,
  ArrowUpOutlined, ArrowDownOutlined, InfoCircleOutlined,
  PlusOutlined, ReloadOutlined,
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import api from '../../utils/api'
import { useMessage, useApp } from '../../contexts/AppContext'

const { Text } = Typography

export default function ProcessManagement() {
  const message = useMessage()
  const { hasPermission } = useApp()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [editing, setEditing] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  // 筛选输入态
  const [keywordInput, setKeywordInput] = useState('')
  const [statusInput, setStatusInput] = useState(undefined)
  // 已应用的查询条件
  const [query, setQuery] = useState({ page: 1, pageSize: 30, keyword: '', status: undefined })

  const enabledCount = data.filter(p => p.status === '启用').length

  const stats = [
    { label: '总工序数', value: total, icon: <OrderedListOutlined />, color: '#2196F3' },
    { label: '启用数', value: enabledCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
  ]

  // 获取列表
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const params = { page: query.page, pageSize: query.pageSize }
        if (query.keyword) params.keyword = query.keyword
        if (query.status !== undefined && query.status !== null) params.status = query.status
        const res = await api.get('/basic/processes', { params })
        if (cancelled) return
        const list = res.data || []
        setData(list)
        setTotal(res.total || list.length)
      } catch (err) {
        if (!cancelled) {
          message.error(err.message || '获取工序列表失败')
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

  const refresh = useCallback(() => setQuery(q => ({ ...q })), [])

  const handleSearch = () => {
    setQuery(q => ({ ...q, page: 1, keyword: keywordInput, status: statusInput }))
  }

  const handleReset = () => {
    setKeywordInput('')
    setStatusInput(undefined)
    setQuery(q => ({ ...q, page: 1, keyword: '', status: undefined }))
  }

  const handleAdd = async () => {
    setEditing(null)
    try {
      const res = await api.get('/basic/processes', { params: { page: 1, pageSize: 1000 } })
      const list = res.data || []
      let nextCode = 'GX001'
      if (list.length > 0) {
        const codes = list.map(p => {
          const match = p.process_code?.match(/^GX(\d+)$/)
          return match ? parseInt(match[1], 10) : 0
        })
        const maxNum = Math.max(...codes, 0)
        nextCode = `GX${String(maxNum + 1).padStart(3, '0')}`
      }
      form.setFieldsValue({ process_code: nextCode })
    } catch (e) {
      form.setFieldsValue({ process_code: 'GX001' })
    }
    setModalVisible(true)
  }

  const handleEdit = (record) => {
    setEditing(record)
    setModalVisible(true)
  }

  // Modal 打开动画结束后再设置表单值（配合 destroyOnHidden + preserve={false}）
  const handleAfterOpenChange = (open) => {
    if (!open) return
    if (editing) {
      form.setFieldsValue({
        process_code: editing.process_code,
        process_name: editing.process_name,
        sort_order: editing.sort_order,
        has_material: editing.has_material === '是' || editing.has_material === 1,
        must_report: editing.must_report === '是' || editing.must_report === 1,
        status: editing.status === '启用' ? '启用' : '停用',
      })
    } else {
      form.setFieldsValue({ status: '启用', sort_order: total + 1, has_material: false, must_report: false })
    }
  }

  const handleMoveUp = async (record, index) => {
    if (index <= 0) {
      message.warning('已是第一道工序，无法上移')
      return
    }
    const prev = data[index - 1]
    try {
      await Promise.all([
        api.put(`/basic/processes/${record.process_id}`, { sort_order: prev.sort_order }),
        api.put(`/basic/processes/${prev.process_id}`, { sort_order: record.sort_order }),
      ])
      message.success('已上移')
      refresh()
    } catch (err) {
      message.error(err.message || '上移失败')
    }
  }

  const handleMoveDown = async (record, index) => {
    if (index >= data.length - 1) {
      message.warning('已是最后一道工序，无法下移')
      return
    }
    const next = data[index + 1]
    try {
      await Promise.all([
        api.put(`/basic/processes/${record.process_id}`, { sort_order: next.sort_order }),
        api.put(`/basic/processes/${next.process_id}`, { sort_order: record.sort_order }),
      ])
      message.success('已下移')
      refresh()
    } catch (err) {
      message.error(err.message || '下移失败')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const payload = { ...values }
      payload.has_material = values.has_material ? '是' : '否'
      payload.must_report = values.must_report ? '是' : '否'
      if (editing) {
        const res = await api.put(`/basic/processes/${editing.process_id}`, payload)
        message.success(res.message || '工序编辑成功')
      } else {
        const res = await api.post('/basic/processes', payload)
        message.success(res.message || '工序新增成功')
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
      const res = await api.delete(`/basic/processes/${record.process_id}`)
      message.success(res.message || '删除成功')
      refresh()
    } catch (err) {
      message.error(err.message || '删除失败')
    }
  }

  const columns = [
    { title: '排序号', dataIndex: 'sort_order', key: 'sort_order', width: 80 },
    { title: '工序编码', dataIndex: 'process_code', key: 'process_code', width: 120 },
    { title: '工序名称', dataIndex: 'process_name', key: 'process_name' },
    {
      title: '是否引入物料', dataIndex: 'has_material', key: 'has_material', width: 110,
      render: v => <Tag color={v === '是' || v === 1 ? 'blue' : 'default'}>{v === '是' || v === 1 ? '是' : '否'}</Tag>,
    },
    {
      title: '是否必须报工', dataIndex: 'must_report', key: 'must_report', width: 110,
      render: v => <Tag color={v === '是' || v === 1 ? 'orange' : 'default'}>{v === '是' || v === 1 ? '是' : '否'}</Tag>,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: v => <Tag color={v === '启用' ? 'green' : 'red'}>{v}</Tag>,
    },
    {
      title: '操作', key: 'action', width: 180,
      render: (_, record, index) => (
        <Space size="small">
          {hasPermission('basic:process:update') && (
            <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
          )}
          <Button type="link" size="small" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => handleMoveUp(record, index)}>上移</Button>
          <Button type="link" size="small" icon={<ArrowDownOutlined />} disabled={index === data.length - 1} onClick={() => handleMoveDown(record, index)}>下移</Button>
        </Space>
      ),
    },
  ]

  const filters = [
    { type: 'input', placeholder: '搜索工序名称/编码', col: { span: 8 }, value: keywordInput, onChange: e => setKeywordInput(e.target.value) },
    {
      type: 'select', placeholder: '状态筛选', col: { span: 8 },
      options: [{ label: '启用', value: 1 }, { label: '停用', value: 0 }],
      value: statusInput, onChange: v => setStatusInput(v),
    },
  ]

  return (
    <>
      <ThreeSectionPage
        title="工序管理"
        breadcrumbs="基础数据 / 工序管理"
        stats={stats}
        filters={filters}
        onSearch={handleSearch}
        onReset={handleReset}
        actions={
          <ActionButtons
            hasAdd={false}
            hasExport={false}
            extra={[
              <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增工序</Button>,
            ]}
          />
        }
        table={
          <>
            <div style={{ marginBottom: 8 }}>
              <Tooltip title="可使用操作列的上移/下移按钮调整工序先后顺序。">
                <Text type="secondary">
                  <InfoCircleOutlined style={{ marginRight: 4 }} />
                  支持使用「上移/下移」按钮调整工序先后顺序。
                </Text>
              </Tooltip>
            </div>
            <Table
              columns={columns}
              dataSource={data}
              rowKey="process_id"
              size="small"
              loading={loading}
              pagination={{
                current: query.page,
                pageSize: query.pageSize,
                total,
                showSizeChanger: true,
                showTotal: t => `共 ${t} 条`,
                onChange: (p, ps) => setQuery(q => ({ ...q, page: p, pageSize: ps })),
              }}
            />
          </>
        }
      />
      <Modal
        title={editing ? '编辑工序' : '新增工序'}
        open={modalVisible}
        onOk={handleSubmit}
        confirmLoading={submitting}
        onCancel={() => setModalVisible(false)}
        afterOpenChange={handleAfterOpenChange}
        okText="保存"
        cancelText="取消"
        width={520}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          <Form.Item name="process_code" label="工序编码" rules={[{ required: true, message: '工序编码自动生成' }]}>
            <Input placeholder="自动生成" disabled={!editing} />
          </Form.Item>
          <Form.Item name="process_name" label="工序名称" rules={[{ required: true, message: '请输入工序名称' }]}>
            <Input placeholder="请输入工序名称" />
          </Form.Item>
          <Form.Item name="has_material" label="是否引入物料" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
          <Form.Item name="must_report" label="是否必须报工" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="sort_order" label="排序号">
                <InputNumber placeholder="数字越小越靠前" min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="工序状态" valuePropName="checked" getValueFromEvent={v => v ? '启用' : '停用'} getValueProps={v => ({ checked: v === '启用' })}>
                <Switch checkedChildren="启用" unCheckedChildren="停用" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  )
}
