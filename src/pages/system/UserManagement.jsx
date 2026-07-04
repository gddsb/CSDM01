import React, { useState, useEffect, useCallback } from 'react'
import { Table, Tag, Button, Modal, Form, Input, Select, Space, Popconfirm, message, Row, Col } from 'antd'
import {
  TeamOutlined, CheckCircleOutlined, StopOutlined, ApartmentOutlined,
  PlusOutlined, ReloadOutlined,
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import api from '../../utils/api'

export default function UserManagement() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [roles, setRoles] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  // 输入态（仅用于筛选项输入，不触发请求）
  const [keywordInput, setKeywordInput] = useState('')
  const [statusInput, setStatusInput] = useState(undefined)
  const [roleInput, setRoleInput] = useState(undefined)

  // 已应用的查询条件（变更会触发请求）
  const [query, setQuery] = useState({ page: 1, pageSize: 10, keyword: '', status: undefined, role_id: undefined })

  const stats = [
    { label: '总用户数', value: total, icon: <TeamOutlined />, color: '#2196F3' },
    { label: '启用用户', value: data.filter(u => u.status === '启用').length, icon: <CheckCircleOutlined />, color: '#4CAF50' },
    { label: '禁用用户', value: data.filter(u => u.status === '禁用').length, icon: <StopOutlined />, color: '#F44336' },
    { label: '部门数', value: [...new Set(data.map(u => u.department).filter(Boolean))].length, icon: <ApartmentOutlined />, color: '#FF9800' },
  ]

  const roleOptions = roles.map(r => ({ label: r.role_name, value: r.role_id }))

  // 获取用户列表（依赖 query，自动响应分页/筛选变化）
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const params = { page: query.page, pageSize: query.pageSize }
        if (query.keyword) params.keyword = query.keyword
        if (query.status !== undefined && query.status !== null) params.status = query.status
        if (query.role_id !== undefined && query.role_id !== null) params.role_id = query.role_id
        const res = await api.get('/system/users', { params })
        if (cancelled) return
        const list = res.data || []
        setData(list)
        setTotal(res.total || list.length)
      } catch (err) {
        if (!cancelled) {
          message.error(err.message || '获取用户列表失败')
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

  // 获取角色列表（作为下拉选项）
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const res = await api.get('/system/roles', { params: { pageSize: 200 } })
        if (!cancelled) setRoles(res.data || [])
      } catch (err) {
        if (!cancelled) setRoles([])
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  const refresh = useCallback(() => setQuery(q => ({ ...q })), [])

  const handleSearch = () => {
    setQuery(q => ({ ...q, page: 1, keyword: keywordInput, status: statusInput, role_id: roleInput }))
  }

  const handleReset = () => {
    setKeywordInput('')
    setStatusInput(undefined)
    setRoleInput(undefined)
    setQuery(q => ({ ...q, page: 1, keyword: '', status: undefined, role_id: undefined }))
  }

  const handleAdd = () => {
    setEditingUser(null)
    form.resetFields()
    form.setFieldsValue({ status: '启用' })
    setModalOpen(true)
  }

  const handleEdit = (record) => {
    setEditingUser(record)
    form.setFieldsValue({
      username: record.username,
      real_name: record.real_name,
      employee_no: record.employee_no,
      department: record.department,
      role_id: record.role_id,
      phone: record.phone,
      email: record.email,
      status: record.status,
      password: undefined,
    })
    setModalOpen(true)
  }

  const handleToggle = async (record) => {
    try {
      const res = await api.post(`/system/users/${record.user_id}/toggle`)
      message.success(res.message || (record.status === '启用' ? '已禁用该用户' : '已启用该用户'))
      refresh()
    } catch (err) {
      message.error(err.message || '操作失败')
    }
  }

  const handleDelete = async (record) => {
    try {
      const res = await api.delete(`/system/users/${record.user_id}`)
      message.success(res.message || '删除成功')
      refresh()
    } catch (err) {
      message.error(err.message || '删除失败')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const payload = { ...values }
      if (editingUser && !payload.password) delete payload.password
      if (editingUser) {
        const res = await api.put(`/system/users/${editingUser.user_id}`, payload)
        message.success(res.message || '用户编辑成功')
      } else {
        const res = await api.post('/system/users', payload)
        message.success(res.message || '用户新增成功')
      }
      setModalOpen(false)
      refresh()
    } catch (e) {
      if (e?.errorFields) return // 表单校验未通过
      message.error(e.message || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const filters = [
    { type: 'input', placeholder: '搜索用户名/姓名/工号', col: { span: 6 }, value: keywordInput, onChange: e => setKeywordInput(e.target.value) },
    { type: 'select', placeholder: '角色筛选', options: roleOptions, col: { span: 6 }, value: roleInput, onChange: v => setRoleInput(v) },
    {
      type: 'select', placeholder: '状态筛选', col: { span: 6 },
      options: [{ label: '启用', value: '启用' }, { label: '禁用', value: '禁用' }],
      value: statusInput, onChange: v => setStatusInput(v),
    },
  ]

  const columns = [
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { title: '真实姓名', dataIndex: 'real_name', key: 'real_name' },
    { title: '工号', dataIndex: 'employee_no', key: 'employee_no' },
    { title: '部门', dataIndex: 'department', key: 'department' },
    {
      title: '角色', key: 'role',
      render: (_, record) => record.role?.role_name || '-',
    },
    { title: '手机号', dataIndex: 'phone', key: 'phone' },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: v => v === '启用' ? <Tag color="green">启用</Tag> : <Tag color="red">禁用</Tag>,
    },
    {
      title: '最后登录时间', dataIndex: 'last_login_time', key: 'last_login_time', width: 170,
      render: v => v ? String(v).replace('T', ' ').slice(0, 19) : '-',
    },
    {
      title: '操作', key: 'action', width: 200,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm
            title={record.status === '启用' ? '确认禁用该用户？' : '确认启用该用户？'}
            onConfirm={() => handleToggle(record)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" size="small" danger={record.status === '启用'}>
              {record.status === '启用' ? '禁用' : '启用'}
            </Button>
          </Popconfirm>
          <Popconfirm
            title="确认删除该用户？"
            description="删除后不可恢复"
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

  return (
    <>
      <ThreeSectionPage
        title="用户管理"
        breadcrumbs="系统管理 / 用户管理"
        stats={stats}
        filters={filters}
        onSearch={handleSearch}
        onReset={handleReset}
        actions={
          <ActionButtons
            hasAdd={false}
            hasExport={false}
            extra={[
              <Button key="reload" icon={<ReloadOutlined />} onClick={refresh}>刷新</Button>,
              <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增用户</Button>,
            ]}
          />
        }
        table={
          <Table
            columns={columns}
            dataSource={data}
            rowKey="user_id"
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
        }
      />
      <Modal
        title={editingUser ? '编辑用户' : '新增用户'}
        open={modalOpen}
        onOk={handleSubmit}
        confirmLoading={submitting}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={640}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
                <Input placeholder="请输入用户名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="real_name" label="真实姓名" rules={[{ required: true, message: '请输入真实姓名' }]}>
                <Input placeholder="请输入真实姓名" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="password"
                label="密码"
                rules={editingUser ? [] : [{ required: true, message: '请输入密码' }]}
                extra={editingUser ? '留空则不修改密码' : undefined}
              >
                <Input.Password placeholder={editingUser ? '留空则不修改' : '请输入密码'} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="employee_no" label="工号" rules={[{ required: true, message: '请输入工号' }]}>
                <Input placeholder="请输入工号" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="department" label="部门" rules={[{ required: true, message: '请输入部门' }]}>
                <Input placeholder="请输入部门" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="role_id" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
                <Select placeholder="请选择角色" options={roleOptions} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="phone" label="手机号">
                <Input placeholder="请输入手机号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="邮箱">
                <Input placeholder="请输入邮箱" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
                <Select
                  placeholder="请选择状态"
                  options={[{ label: '启用', value: '启用' }, { label: '禁用', value: '禁用' }]}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  )
}
