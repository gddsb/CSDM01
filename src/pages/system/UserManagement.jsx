import React, { useState } from 'react'
import { Table, Tag, Button, Modal, Form, Input, Select, Space, Popconfirm, message, Row, Col } from 'antd'
import {
  TeamOutlined, CheckCircleOutlined, StopOutlined, ApartmentOutlined,
  EditOutlined, PlusOutlined,
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import { users as usersData, roles } from '../../mock/data'

export default function UserManagement() {
  const [data, setData] = useState(usersData)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [form] = Form.useForm()

  const enabledCount = data.filter(u => u.status === 1).length
  const disabledCount = data.filter(u => u.status !== 1).length
  const deptCount = [...new Set(data.map(u => u.department))].length

  const stats = [
    { label: '总用户数', value: data.length, icon: <TeamOutlined />, color: '#2196F3' },
    { label: '启用用户', value: enabledCount, icon: <CheckCircleOutlined />, color: '#4CAF50' },
    { label: '禁用用户', value: disabledCount, icon: <StopOutlined />, color: '#F44336' },
    { label: '部门数', value: deptCount, icon: <ApartmentOutlined />, color: '#FF9800' },
  ]

  const roleOptions = roles.map(r => ({ label: r.role_name, value: r.role_name }))

  const filters = [
    { type: 'input', placeholder: '搜索用户名', col: { span: 6 } },
    { type: 'select', placeholder: '角色筛选', options: roleOptions, col: { span: 6 } },
    {
      type: 'select', placeholder: '状态筛选', col: { span: 6 },
      options: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }],
    },
  ]

  const handleAdd = () => {
    setEditingUser(null)
    form.resetFields()
    setModalOpen(true)
  }

  const handleEdit = (record) => {
    setEditingUser(record)
    form.setFieldsValue({
      username: record.username,
      real_name: record.real_name,
      employee_no: record.employee_no,
      department: record.department,
      role_name: record.role_name,
      phone: record.phone,
      email: record.email,
      status: record.status === 1 ? '启用' : '禁用',
    })
    setModalOpen(true)
  }

  const handleToggle = (record) => {
    setData(prev => prev.map(u => u.user_id === record.user_id
      ? { ...u, status: u.status === 1 ? 0 : 1 } : u))
    message.success(record.status === 1 ? '已禁用该用户' : '已启用该用户')
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const statusVal = values.status === '启用' ? 1 : 0
      if (editingUser) {
        setData(prev => prev.map(u => u.user_id === editingUser.user_id
          ? { ...u, ...values, status: statusVal } : u))
        message.success('用户编辑成功')
      } else {
        const newUser = {
          user_id: 'u' + (data.length + 1),
          last_login_time: '-',
          ...values,
          status: statusVal,
        }
        setData(prev => [...prev, newUser])
        message.success('用户新增成功')
      }
      setModalOpen(false)
    } catch (e) {
      // 校验未通过
    }
  }

  const columns = [
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { title: '真实姓名', dataIndex: 'real_name', key: 'real_name' },
    { title: '工号', dataIndex: 'employee_no', key: 'employee_no' },
    { title: '部门', dataIndex: 'department', key: 'department' },
    { title: '角色', dataIndex: 'role_name', key: 'role_name' },
    { title: '手机号', dataIndex: 'phone', key: 'phone' },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: v => v === 1 ? <Tag color="green">启用</Tag> : <Tag color="red">禁用</Tag>,
    },
    { title: '最后登录时间', dataIndex: 'last_login_time', key: 'last_login_time' },
    {
      title: '操作', key: 'action', width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm
            title={record.status === 1 ? '确认禁用该用户？' : '确认启用该用户？'}
            onConfirm={() => handleToggle(record)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" size="small" danger={record.status === 1}>
              {record.status === 1 ? '禁用' : '启用'}
            </Button>
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
        actions={
          <ActionButtons
            hasAdd={false}
            extra={[<Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增用户</Button>]}
          />
        }
        table={
          <Table
            columns={columns}
            dataSource={data}
            rowKey="user_id"
            size="small"
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
          />
        }
      />
      <Modal
        title={editingUser ? '编辑用户' : '新增用户'}
        open={modalOpen}
        onOk={handleSubmit}
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
              <Form.Item name="employee_no" label="工号" rules={[{ required: true, message: '请输入工号' }]}>
                <Input placeholder="请输入工号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="department" label="部门" rules={[{ required: true, message: '请输入部门' }]}>
                <Input placeholder="请输入部门" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="role_name" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
                <Select placeholder="请选择角色" options={roleOptions} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="手机号">
                <Input placeholder="请输入手机号" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="email" label="邮箱">
                <Input placeholder="请输入邮箱" />
              </Form.Item>
            </Col>
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
