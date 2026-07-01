import React, { useState } from 'react'
import { Table, Tag, Button, Drawer, Tree, Space, Modal, Form, Input, Select, message, Typography, Row, Col } from 'antd'
import {
  SafetyCertificateOutlined, ApartmentOutlined, EyeOutlined,
  EditOutlined, PlusOutlined,
} from '@ant-design/icons'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import { roles as rolesData } from '../../mock/data'

const { Text } = Typography

const statusOptions = ['启用', '禁用'].map(s => ({ label: s, value: s }))

// 角色层级关系树（文字树形展示）
const roleTreeData = [
  {
    title: '超级管理员（SUPER_ADMIN）— 系统全部权限，用户管理、系统配置、数据库字典',
    key: 'r1',
    children: [
      { title: '系统管理员（ADMIN）— 日常系统管理（权限低于超级管理员）', key: 'r7' },
      { title: '计划员（PLANNER）— 生产计划制定、下达、调整，计划进度查看', key: 'r2' },
      {
        title: '质量管理员（QC_MANAGER）— 质量标准制定、抽检审批、不合格品处置审批',
        key: 'r3',
        children: [
          { title: '质量检验员（QC_INSPECTOR）— 质量检测执行、数据录入、异常上报', key: 'r4' },
        ],
      },
      {
        title: '生产管理（PROD_MANAGER）— 生产任务管理、调度、人员管理、报表审批、班组管理',
        key: 'r5',
        children: [
          { title: '工序操作人（OPERATOR）— 本工序生产操作、数据录入、设备点检', key: 'r6' },
        ],
      },
      { title: '设备维护员（MAINTENANCE）— 设备维修、保养记录', key: 'r8' },
      { title: '看板查看者（DASHBOARD_VIEWER）— 大屏/看板只读查看', key: 'r9' },
    ],
  },
]

export default function RoleManagement() {
  const [data, setData] = useState(rolesData)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [currentRole, setCurrentRole] = useState(null)
  const [editing, setEditing] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  const defaultCount = data.filter(r => r.type === '系统默认').length
  const optionalCount = data.filter(r => r.type === '可选').length

  const stats = [
    { label: '系统默认角色', value: defaultCount, icon: <SafetyCertificateOutlined />, color: '#2196F3' },
    { label: '可选角色', value: optionalCount, icon: <ApartmentOutlined />, color: '#FF9800' },
  ]

  const handleViewHierarchy = (record) => {
    setCurrentRole(record)
    setDrawerOpen(true)
  }

  const handleAdd = () => {
    setEditing(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (record) => {
    setEditing(record)
    form.setFieldsValue(record)
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editing) {
        setData(prev => prev.map(r => r.role_id === editing.role_id ? {
          ...r,
          role_name: values.role_name,
          role_code: values.role_code,
          description: values.description,
          status: values.status,
        } : r))
        message.success('角色编辑成功')
      } else {
        const newRole = {
          role_id: 'r' + Date.now(),
          role_name: values.role_name,
          role_code: values.role_code,
          type: '可选',
          scope: '-',
          description: values.description,
          status: values.status || '启用',
        }
        setData(prev => [newRole, ...prev])
        message.success('角色新增成功')
      }
      setModalVisible(false)
    } catch (e) {
      // 校验未通过
    }
  }

  const columns = [
    { title: '角色名称', dataIndex: 'role_name', key: 'role_name' },
    { title: '角色编码', dataIndex: 'role_code', key: 'role_code' },
    {
      title: '类型', dataIndex: 'type', key: 'type',
      render: v => v === '系统默认' ? <Tag color="blue">{v}</Tag> : <Tag color="orange">{v}</Tag>,
    },
    { title: '权限范围', dataIndex: 'scope', key: 'scope' },
    {
      title: '操作', key: 'action', width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleViewHierarchy(record)}>查看层级</Button>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
        </Space>
      ),
    },
  ]

  return (
    <>
      <ThreeSectionPage
        title="角色权限"
        breadcrumbs="系统管理 / 角色权限"
        stats={stats}
        actions={
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增角色</Button>
            <Button icon={<ApartmentOutlined />} onClick={() => { setCurrentRole(null); setDrawerOpen(true) }}>权限层级图</Button>
          </Space>
        }
        table={
          <Table
            columns={columns}
            dataSource={data}
            rowKey="role_id"
            size="small"
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
          />
        }
      />
      <Modal
        title={editing ? '编辑角色' : '新增角色'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={520}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="role_name" label="角色名称" rules={[{ required: true, message: '请输入角色名称' }]}>
                <Input placeholder="请输入角色名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="role_code" label="角色编码" rules={[{ required: true, message: '请输入角色编码' }]}>
                <Input placeholder="请输入角色编码" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
                <Select placeholder="请选择状态" options={statusOptions} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={24}>
              <Form.Item name="description" label="描述">
                <Input.TextArea placeholder="请输入描述" rows={2} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
      <Drawer
        title={currentRole ? `角色层级关系 - ${currentRole.role_name}` : '角色权限层级关系图'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={520}
      >
        {currentRole && (
          <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 6 }}>
            <div style={{ marginBottom: 4 }}><Text strong>当前角色：</Text>{currentRole.role_name}（{currentRole.role_code}）</div>
            <div><Text strong>权限范围：</Text>{currentRole.scope}</div>
          </div>
        )}
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          系统角色按照权限范围形成上下级关系，下级角色的权限范围在上级角色权限之内。
        </Text>
        <Tree
          treeData={roleTreeData}
          defaultExpandAll
          showLine
          blockNode
        />
      </Drawer>
    </>
  )
}
