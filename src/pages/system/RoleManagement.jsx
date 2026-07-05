import React, { useState, useEffect, useMemo } from 'react'
import { Table, Tag, Button, Modal, Form, Input, Select, Space, Tree, InputNumber, Popconfirm, message, Row, Col, Typography, Spin } from 'antd'
import {
  SafetyCertificateOutlined, ApartmentOutlined,
  PlusOutlined, ReloadOutlined, SafetyOutlined,
} from '@ant-design/icons'
import ThreeSectionPage from '../../components/ThreeSectionPage'
import api from '../../utils/api'

const { Text } = Typography

const statusOptions = [{ label: '启用', value: '启用' }, { label: '禁用', value: '禁用' }]
const typeOptions = [{ label: '系统默认', value: '系统默认' }, { label: '可选', value: '可选' }]

// 根据扁平权限列表构建树形结构
function buildPermissionTree(permissions) {
  const map = new Map()
  const roots = []
  permissions.forEach(p => {
    map.set(p.perm_id, { title: p.perm_name, key: p.perm_id, children: [], _raw: p })
  })
  permissions.forEach(p => {
    const node = map.get(p.perm_id)
    if (!p.parent_id || p.parent_id === 0) {
      roots.push(node)
    } else {
      const parent = map.get(p.parent_id)
      if (parent) parent.children.push(node)
      else roots.push(node)
    }
  })
  const sortNodes = (nodes) => {
    nodes.sort((a, b) => (a._raw?.sort_order || 0) - (b._raw?.sort_order || 0))
    nodes.forEach(n => sortNodes(n.children))
    nodes.forEach(n => { delete n._raw })
    return nodes
  }
  return sortNodes(roots)
}

export default function RoleManagement() {
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

  // 权限配置
  const [permModalVisible, setPermModalVisible] = useState(false)
  const [permRole, setPermRole] = useState(null)
  const [permissions, setPermissions] = useState([])
  const [checkedKeys, setCheckedKeys] = useState([])
  const [permLoading, setPermLoading] = useState(false)
  const [permSaving, setPermSaving] = useState(false)

  const defaultCount = data.filter(r => r.type === '系统默认').length
  const optionalCount = data.filter(r => r.type === '可选').length

  const stats = [
    { label: '角色总数', value: total, icon: <SafetyCertificateOutlined />, color: '#2196F3' },
    { label: '系统默认角色', value: defaultCount, icon: <ApartmentOutlined />, color: '#FF9800' },
    { label: '可选角色', value: optionalCount, icon: <SafetyOutlined />, color: '#4CAF50' },
  ]

  const treeData = useMemo(() => buildPermissionTree(permissions), [permissions])

  // 获取角色列表
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const params = { page: query.page, pageSize: query.pageSize }
        if (query.keyword) params.keyword = query.keyword
        if (query.status !== undefined && query.status !== null) params.status = query.status
        const res = await api.get('/system/roles', { params })
        if (cancelled) return
        const list = res.data || []
        setData(list)
        setTotal(res.total || list.length)
      } catch (err) {
        if (!cancelled) {
          message.error(err.message || '获取角色列表失败')
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

  const refresh = () => setQuery(q => ({ ...q }))

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

  // Modal 打开动画结束后再设置表单值（配合 destroyOnHidden + preserve={false}）
  const handleAfterOpenChange = (open) => {
    if (!open) return
    if (editing) {
      form.setFieldsValue({
        role_name: editing.role_name,
        role_code: editing.role_code,
        type: editing.type,
        scope: editing.scope,
        sort_order: editing.sort_order,
        status: editing.status,
        description: editing.description,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({ status: '启用', type: '可选', sort_order: 0 })
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const payload = { ...values }
      if (editing) {
        const res = await api.put(`/system/roles/${editing.role_id}`, payload)
        message.success(res.message || '角色编辑成功')
      } else {
        const res = await api.post('/system/roles', payload)
        message.success(res.message || '角色新增成功')
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
      const res = await api.delete(`/system/roles/${record.role_id}`)
      message.success(res.message || '删除成功')
      refresh()
    } catch (err) {
      message.error(err.message || '删除失败')
    }
  }

  // 打开权限配置 Modal
  const handleConfigPerms = async (record) => {
    setPermRole(record)
    setPermModalVisible(true)
    setCheckedKeys([])
    setPermLoading(true)
    try {
      // 并行加载所有权限和当前角色已有权限
      const [allRes, roleRes] = await Promise.all([
        api.get('/system/permissions'),
        api.get(`/system/roles/${record.role_id}/permissions`),
      ])
      setPermissions(allRes.data || [])
      setCheckedKeys(roleRes.data || [])
    } catch (err) {
      message.error(err.message || '加载权限数据失败')
    } finally {
      setPermLoading(false)
    }
  }

  const handleSavePerms = async () => {
    if (!permRole) return
    setPermSaving(true)
    try {
      const keys = Array.isArray(checkedKeys) ? checkedKeys : checkedKeys.checked
      const res = await api.put(`/system/roles/${permRole.role_id}/permissions`, { perm_ids: keys })
      message.success(res.message || '权限分配成功')
      setPermModalVisible(false)
    } catch (err) {
      message.error(err.message || '权限保存失败')
    } finally {
      setPermSaving(false)
    }
  }

  const filters = [
    { type: 'input', placeholder: '搜索角色名称/编码', col: { span: 6 }, value: keywordInput, onChange: e => setKeywordInput(e.target.value) },
    {
      type: 'select', placeholder: '状态筛选', col: { span: 6 },
      options: statusOptions, value: statusInput, onChange: v => setStatusInput(v),
    },
  ]

  const columns = [
    { title: '角色名称', dataIndex: 'role_name', key: 'role_name' },
    { title: '角色编码', dataIndex: 'role_code', key: 'role_code' },
    {
      title: '类型', dataIndex: 'type', key: 'type', width: 100,
      render: v => v === '系统默认' ? <Tag color="blue">{v}</Tag> : <Tag color="orange">{v}</Tag>,
    },
    { title: '权限范围', dataIndex: 'scope', key: 'scope', ellipsis: true },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: v => v === '启用' ? <Tag color="green">启用</Tag> : <Tag color="red">禁用</Tag>,
    },
    { title: '排序', dataIndex: 'sort_order', key: 'sort_order', width: 60 },
    {
      title: '操作', key: 'action', width: 220,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleConfigPerms(record)}>配置权限</Button>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm
            title="确认删除该角色？"
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
        title="角色权限"
        breadcrumbs="系统管理 / 角色权限"
        stats={stats}
        filters={filters}
        onSearch={handleSearch}
        onReset={handleReset}
        actions={
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增角色</Button>
          </Space>
        }
        table={
          <Table
            columns={columns}
            dataSource={data}
            rowKey="role_id"
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
        title={editing ? '编辑角色' : '新增角色'}
        open={modalVisible}
        onOk={handleSubmit}
        confirmLoading={submitting}
        onCancel={() => setModalVisible(false)}
        afterOpenChange={handleAfterOpenChange}
        okText="保存"
        cancelText="取消"
        width={560}
        destroyOnHidden
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
                <Input placeholder="请输入角色编码" disabled={!!editing} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="type" label="类型">
                <Select placeholder="请选择类型" options={typeOptions} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
                <Select placeholder="请选择状态" options={statusOptions} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="sort_order" label="排序号">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="排序号" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={24}>
              <Form.Item name="scope" label="权限范围">
                <Input placeholder="请输入权限范围说明" />
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
      <Modal
        title={`配置权限 - ${permRole?.role_name || ''}`}
        open={permModalVisible}
        onOk={handleSavePerms}
        confirmLoading={permSaving}
        onCancel={() => setPermModalVisible(false)}
        okText="保存权限"
        cancelText="取消"
        width={560}
        destroyOnHidden
      >
        <Spin spinning={permLoading}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            勾选该角色拥有的权限，保存后立即生效。
          </Text>
          <Tree
            checkable
            defaultExpandAll
            treeData={treeData}
            checkedKeys={checkedKeys}
            onCheck={(keys) => setCheckedKeys(keys)}
            style={{ maxHeight: 480, overflow: 'auto' }}
          />
        </Spin>
      </Modal>
    </>
  )
}
