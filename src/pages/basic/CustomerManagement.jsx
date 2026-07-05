import React, { useState, useEffect, useCallback } from 'react'
import { Table, Tag, Button, Modal, Form, Input, Select, message, Row, Col, Drawer, Descriptions, Space, Popconfirm } from 'antd'
import {
  TeamOutlined, CheckCircleOutlined, CloseCircleOutlined,
  PlusOutlined, EyeOutlined, ReloadOutlined,
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import api from '../../utils/api'

export default function CustomerManagement() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [editing, setEditing] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [viewRecord, setViewRecord] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  // 筛选输入态
  const [keywordInput, setKeywordInput] = useState('')
  const [statusInput, setStatusInput] = useState(undefined)
  // 已应用的查询条件
  const [query, setQuery] = useState({ page: 1, pageSize: 30, keyword: '', status: undefined })

  // 拉取列表
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const params = { page: query.page, pageSize: query.pageSize }
        if (query.keyword) params.keyword = query.keyword
        if (query.status !== undefined && query.status !== null) params.status = query.status
        const res = await api.get('/basic/customers', { params })
        if (cancelled) return
        const list = res.data || []
        setData(list)
        setTotal(res.total || list.length)
      } catch (err) {
        if (!cancelled) {
          message.error(err.message || '获取客户档案列表失败')
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

  const handleAdd = () => {
    setEditing(null)
    setModalVisible(true)
  }

  const handleEdit = (record) => {
    setEditing(record)
    setModalVisible(true)
  }

  const handleAfterOpenChange = (open) => {
    if (!open) return
    if (editing) {
      form.setFieldsValue({
        customer_code: editing.customer_code,
        customer_name: editing.customer_name,
        short_name: editing.short_name,
        contact_person: editing.contact_person,
        phone: editing.phone,
        email: editing.email,
        address: editing.address,
        status: editing.status === 1 ? '启用' : '停用',
        sort_order: editing.sort_order,
        remark: editing.remark,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({
        status: '启用',
        sort_order: total + 1,
      })
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const payload = {
        customer_code: values.customer_code,
        customer_name: values.customer_name,
        short_name: values.short_name,
        contact_person: values.contact_person,
        phone: values.phone,
        email: values.email,
        address: values.address,
        status: values.status,
        sort_order: values.sort_order,
        remark: values.remark || '',
      }
      if (editing) {
        const res = await api.put(`/basic/customers/${editing.customer_id}`, payload)
        message.success(res.message || '客户编辑成功')
      } else {
        const res = await api.post('/basic/customers', payload)
        message.success(res.message || '客户新增成功')
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
      const res = await api.delete(`/basic/customers/${record.customer_id}`)
      message.success(res.message || '删除成功')
      refresh()
    } catch (err) {
      message.error(err.message || '删除失败')
    }
  }

  const columns = [
    { title: '客户编号', dataIndex: 'customer_code', key: 'customer_code', width: 110, fixed: 'left' },
    { title: '排序号', dataIndex: 'sort_order', key: 'sort_order', width: 70 },
    { title: '客户名称', dataIndex: 'customer_name', key: 'customer_name', width: 200 },
    { title: '简称', dataIndex: 'short_name', key: 'short_name', width: 110 },
    { title: '联系人', dataIndex: 'contact_person', key: 'contact_person', width: 90 },
    { title: '联系电话', dataIndex: 'phone', key: 'phone', width: 130 },
    { title: '邮箱', dataIndex: 'email', key: 'email', width: 180 },
    { title: '联系地址', dataIndex: 'address', key: 'address', width: 240 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90, fixed: 'right',
      render: (v, record) => {
        const enabled = (record.status === 1 || record.status === '启用' || v === 1 || v === '启用')
        return <Tag color={enabled ? 'green' : 'red'}>{enabled ? '启用' : '停用'}</Tag>
      },
    },
    {
      title: '操作', key: 'action', width: 170, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setViewRecord(record)}>查看</Button>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm
            title="确认删除该客户？"
            onConfirm={() => handleDelete(record)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const filters = [
    { type: 'input', placeholder: '搜索编号/名称/简称', col: { span: 8 }, value: keywordInput, onChange: e => setKeywordInput(e.target.value) },
    {
      type: 'select', placeholder: '状态筛选', col: { span: 6 },
      options: [{ label: '启用', value: 1 }, { label: '停用', value: 0 }],
      value: statusInput, onChange: v => setStatusInput(v),
    },
  ]

  // 统计数据
  const activeCount = data.filter(d => d.status === 1 || d.status === '启用').length
  const inactiveCount = data.filter(d => d.status === 0 || d.status === '停用').length

  const stats = [
    { label: '客户总数', value: total, icon: <TeamOutlined />, color: '#2196F3' },
    { label: '启用客户', value: activeCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
    { label: '停用客户', value: inactiveCount, icon: <CloseCircleOutlined />, color: '#F44336' },
  ]

  return (
    <>
      <ThreeSectionPage
        title="客户档案"
        breadcrumbs="基础数据 / 客户档案"
        stats={stats}
        filters={filters}
        onSearch={handleSearch}
        onReset={handleReset}
        actions={
          <ActionButtons
            hasAdd={false}
            hasExport={false}
            extra={[
              <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增客户</Button>,
            ]}
          />
        }
        table={
          <Table
            columns={columns}
            dataSource={data}
            rowKey="customer_id"
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
        }
      />
      <Modal
        title={editing ? '编辑客户' : '新增客户'}
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
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="customer_code" label="客户编号" rules={[{ required: true, message: '请输入客户编号' }]}>
                <Input placeholder="如：C001" disabled={!!editing} />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="customer_name" label="客户名称" rules={[{ required: true, message: '请输入客户名称' }]}>
                <Input placeholder="请输入客户全称" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="short_name" label="简称">
                <Input placeholder="请输入简称" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="contact_person" label="联系人">
                <Input placeholder="请输入联系人" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="phone" label="联系电话">
                <Input placeholder="请输入联系电话" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="email" label="邮箱">
                <Input placeholder="请输入邮箱" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={16}>
              <Form.Item name="address" label="联系地址">
                <Input placeholder="请输入联系地址" />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="sort_order" label="排序号">
                <Input placeholder="数字" />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
                <Select placeholder="状态" options={[{ label: '启用', value: '启用' }, { label: '停用', value: '停用' }]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remark" label="备注">
            <Input.TextArea placeholder="请输入备注" rows={3} />
          </Form.Item>
        </Form>
      </Modal>
      <Drawer
        title="查看客户"
        open={!!viewRecord}
        onClose={() => setViewRecord(null)}
        width={520}
      >
        {viewRecord && (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="客户编号">{viewRecord.customer_code}</Descriptions.Item>
            <Descriptions.Item label="客户名称">{viewRecord.customer_name}</Descriptions.Item>
            <Descriptions.Item label="简称">{viewRecord.short_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="排序号">{viewRecord.sort_order}</Descriptions.Item>
            <Descriptions.Item label="联系人">{viewRecord.contact_person || '-'}</Descriptions.Item>
            <Descriptions.Item label="联系电话">{viewRecord.phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="邮箱" span={2}>{viewRecord.email || '-'}</Descriptions.Item>
            <Descriptions.Item label="联系地址" span={2}>{viewRecord.address || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态" span={2}>
              <Tag color={(viewRecord.status === 1 || viewRecord.status === '启用') ? 'green' : 'red'}>
                {(viewRecord.status === 1 || viewRecord.status === '启用') ? '启用' : '停用'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="备注" span={2}>
              <div style={{ lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{viewRecord.remark || '-'}</div>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </>
  )
}
