import ResizableTable from '../../components/ResizableTable'
import React, { useState, useEffect, useCallback } from 'react'
import { Table, Tag, Button, Modal, Form, Input, InputNumber, Select, TreeSelect, Row, Col, Space, Popconfirm } from 'antd'
import {
  AppstoreOutlined, CheckCircleOutlined, CloseCircleOutlined,
  PlusOutlined, EyeOutlined,
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import type { FilterItem, StatItem } from '../../components/ThreeSectionPage'
import type { ColumnsType } from 'antd/es/table'
import api from '../../utils/api'
import { useMessage } from '../../contexts/AppContext'

const typeOptions = [
  { label: '菜单', value: 'menu' },
  { label: '页面', value: 'page' },
  { label: '按钮', value: 'button' },
  { label: '接口', value: 'api' },
]

const typeColorMap = { menu: 'blue', page: 'cyan', button: 'orange', api: 'purple' }

export default function MenuManagement() {
  const message = useMessage()
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  // 父菜单下拉数据
  const [parentOptions, setParentOptions] = useState([])

  // 筛选输入态
  const [keywordInput, setKeywordInput] = useState('')
  const [statusInput, setStatusInput] = useState(undefined)
  const [typeInput, setTypeInput] = useState(undefined)
  // 已应用的查询条件
  const [query, setQuery] = useState({ keyword: '', status: undefined, type: undefined })

  // 拉取列表
  const refresh = useCallback(() => {
    setLoading(true)
    const params: Record<string, unknown> = {}
    if (query.keyword) params.keyword = query.keyword
    if (query.status !== undefined && query.status !== null) params.status = query.status
    if (query.type) params.type = query.type
    api.get('/system/permissions', { params })
      .then(res => {
        const list = res.data || []
        setData(list)
        setTotal(res.total || list.length)
        // 构建父菜单下拉（仅 type=menu，且排除当前编辑节点的子树）
        const buildSelectTree = (nodes, depth = 0) => {
          const result = []
          nodes.forEach(n => {
            if (n.type !== 'menu') return
            result.push({
              value: n.perm_id,
              title: `${'— '.repeat(depth)}${n.perm_name} (${n.perm_code})`,
            })
            if (n.children && n.children.length > 0) {
              result.push(...buildSelectTree(n.children, depth + 1))
            }
          })
          return result
        }
        setParentOptions([
          { value: 0, title: '顶级菜单' },
          ...buildSelectTree(list),
        ])
      })
      .catch(err => {
        message.error(err.message || '获取菜单列表失败')
        setData([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
  }, [query])

  useEffect(() => { refresh() }, [refresh])

  const handleSearch = () => {
    setQuery({ keyword: keywordInput, status: statusInput, type: typeInput })
  }

  const handleReset = () => {
    setKeywordInput('')
    setStatusInput(undefined)
    setTypeInput(undefined)
    setQuery({ keyword: '', status: undefined, type: undefined })
  }

  const handleAdd = () => {
    setEditing(null)
    setModalVisible(true)
  }

  const handleEdit = (record) => {
    setEditing(record)
    setModalVisible(true)
  }

  const handleAddChild = (record) => {
    setEditing({ parent_id: record.perm_id })
    setModalVisible(true)
  }

  const handleAfterOpenChange = (open) => {
    if (!open) return
    if (editing && editing.perm_id) {
      form.setFieldsValue({
        parent_id: editing.parent_id || 0,
        perm_name: editing.perm_name,
        perm_code: editing.perm_code,
        type: editing.type,
        icon: editing.icon,
        path: editing.path,
        component: editing.component,
        sort_order: editing.sort_order,
        status: editing.status,
        // —— 移动端专用字段 ——
        mobile_tab_group: editing.mobile_tab_group ?? null,
        mobile_route_path: editing.mobile_route_path ?? '',
        mobile_icon: editing.mobile_icon ?? '',
        mobile_sort_order: editing.mobile_sort_order ?? editing.sort_order ?? 0,
        mobile_visible: editing.mobile_visible ?? 1,
        mobile_parent_id: editing.mobile_parent_id ?? null,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({
        parent_id: editing?.parent_id || 0,
        type: 'menu',
        sort_order: 0,
        status: 1,
        // —— 移动端专用字段默认值 ——
        mobile_visible: 1,
        mobile_tab_group: null,
      })
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const payload = {
        ...values,
        parent_id: values.parent_id || 0,
        status: values.status !== undefined ? Number(values.status) : 1,
        // —— 移动端字段：没填时传 null 让后端保留数据库原值 ——
        mobile_tab_group: values.mobile_tab_group || null,
        mobile_route_path: values.mobile_route_path || null,
        mobile_icon: values.mobile_icon || null,
        mobile_sort_order: values.mobile_sort_order !== undefined ? Number(values.mobile_sort_order) : null,
        mobile_visible: values.mobile_visible !== undefined ? Number(values.mobile_visible) : null,
        mobile_parent_id: values.mobile_parent_id || null,
      }
      if (editing && editing.perm_id) {
        const res = await api.put(`/system/permissions/${editing.perm_id}`, payload)
        message.success(res.message || '菜单修改成功')
      } else {
        const res = await api.post('/system/permissions', payload)
        message.success(res.message || '菜单新增成功')
      }
      setModalVisible(false)
      refresh()
      // 通知侧边栏刷新菜单
      window.dispatchEvent(new Event('menu-updated'))
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (record) => {
    try {
      const res = await api.delete(`/system/permissions/${record.perm_id}`)
      message.success(res.message || '删除成功')
      refresh()
      // 通知侧边栏刷新菜单
      window.dispatchEvent(new Event('menu-updated'))
    } catch (err) {
      message.error(err.message || '删除失败')
    }
  }

  const columns: ColumnsType<any> = [
    { title: '菜单名称', dataIndex: 'perm_name', key: 'perm_name', width: 180 },
    { title: '权限编码', dataIndex: 'perm_code', key: 'perm_code', width: 160 },
    {
      title: '类型', dataIndex: 'type', key: 'type', width: 70,
      render: v => v ? <Tag color={typeColorMap[v] || 'default'}>{typeOptions.find(t => t.value === v)?.label || v}</Tag> : '-',
    },
    { title: '图标', dataIndex: 'icon', key: 'icon', width: 120 },
    { title: 'PC 路由', dataIndex: 'path', key: 'path', width: 160, render: v => v || '-' },
    {
      title: '📱 移动端', key: 'mobile', width: 140,
      render: (_, record) => {
        const group = record.mobile_tab_group
        const route = record.mobile_route_path
        if (!group && !route) return <span style={{ color: '#bbb' }}>—</span>
        const groupMap: Record<string, string> = { production: '生产', inspection: '检验', device: '设备' }
        return (
          <span>
            {group && <Tag color="cyan">{groupMap[group] || group}</Tag>}
            {route && <code style={{ fontSize: 11, color: '#666' }}>{route}</code>}
          </span>
        )
      },
    },
    { title: '排序', dataIndex: 'sort_order', key: 'sort_order', width: 60 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 70,
      render: v => <Tag color={v === 1 ? 'green' : 'red'}>{v === 1 ? '启用' : '停用'}</Tag>,
    },
    {
      title: '操作', key: 'action', fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleAddChild(record)}>新增子项</Button>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm
            title="确认删除该菜单？"
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

  const filters: FilterItem[] = [
    { type: 'input', placeholder: '搜索菜单名称/编码/路径', col: { span: 8 }, value: keywordInput, onChange: (e) => setKeywordInput((e as React.ChangeEvent<HTMLInputElement>).target.value) },
    {
      type: 'select', placeholder: '类型', col: { span: 6 },
      options: typeOptions, value: typeInput, onChange: v => setTypeInput(v),
    },
    {
      type: 'select', placeholder: '状态', col: { span: 6 },
      options: [{ label: '启用', value: 1 }, { label: '停用', value: 0 }],
      value: statusInput, onChange: v => setStatusInput(v),
    },
  ]

  // 统计数据
  const menuCount = countByType(data, 'menu')
  const pageCount = countByType(data, 'page')
  const buttonCount = countByType(data, 'button')

  const stats: StatItem[] = [
    { label: '菜单总数', value: total, icon: <AppstoreOutlined />, color: 'var(--color-primary)' },
    { label: '菜单项', value: menuCount, icon: <CheckCircleOutlined />, color: 'var(--color-success)' },
    { label: '页面/按钮', value: pageCount + buttonCount, icon: <CloseCircleOutlined />, color: 'var(--color-warning)' },
  ]

  return (
    <>
      <ThreeSectionPage
        title="菜单管理"
        breadcrumbs="系统管理 / 菜单管理"
        stats={stats}
        filters={filters}
        onSearch={handleSearch}
        onReset={handleReset}
        actions={
          <ActionButtons
            hasAdd={false}
            hasExport={false}
            extra={[
              <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增菜单</Button>,
            ]}
          />
        }
        table={
          <ResizableTable tableKey="pages_system_MenuManagement"             columns={columns}
            dataSource={data}
            rowKey="perm_id"
            size="small"
            loading={loading}
            scroll={{ x: 1400 }}
            pagination={false}
          />
        }
      />
      <Modal
        title={editing && editing.perm_id ? '编辑菜单' : '新增菜单'}
        open={modalVisible}
        onOk={handleSubmit}
        confirmLoading={submitting}
        onCancel={() => setModalVisible(false)}
        afterOpenChange={handleAfterOpenChange}
        okText="保存"
        cancelText="取消"
        width={820}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="parent_id" label="父级菜单" rules={[{ required: true, message: '请选择父级菜单' }]}>
                <TreeSelect
                  placeholder="请选择父级菜单"
                  treeData={parentOptions}
                  treeDefaultExpandAll
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
                <Select placeholder="请选择类型" options={typeOptions} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="sort_order" label="排序号">
                <InputNumber placeholder="数字" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="perm_name" label="菜单名称" rules={[{ required: true, message: '请输入菜单名称' }]}>
                <Input placeholder="请输入菜单名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="perm_code" label="权限编码" rules={[{ required: true, message: '请输入权限编码' }]}>
                <Input placeholder="如 system:user" disabled={!!(editing && editing.perm_id)} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="icon" label="图标">
                <Input placeholder="如 TeamOutlined" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="path" label="路由路径">
                <Input placeholder="如 /system/users" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
                <Select placeholder="状态" options={[{ label: '启用', value: 1 }, { label: '停用', value: 0 }]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="component" label="组件路径">
            <Input placeholder="如 pages/system/UserManagement（可选）" />
          </Form.Item>
          {/* —— 移动端专用字段 —— */}
          <div style={{ margin: '16px 0 8px', padding: '8px 12px', background: 'var(--color-bg-secondary,#f5f5f5)', borderRadius: 4, fontSize: 13, fontWeight: 500, borderLeft: '3px solid var(--color-primary,#1677ff)' }}>
            📱 移动端配置（留空表示不在移动端显示，或继承 PC 端值）
          </div>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="mobile_tab_group" label="移动端 Tab 分组">
                <Select
                  placeholder="选择后显示在移动端 TabBar"
                  allowClear
                  options={[
                    { label: '生产', value: 'production' },
                    { label: '检验', value: 'inspection' },
                    { label: '设备', value: 'device' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="mobile_route_path" label="移动端路由路径">
                <Input placeholder="如 /m/device-maintenance" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="mobile_icon" label="移动端图标">
                <Input placeholder="如 settings-o（留空继承 PC 端）" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={6}>
              <Form.Item name="mobile_sort_order" label="移动端排序">
                <InputNumber placeholder="数字" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="mobile_visible" label="移动端可见">
                <Select placeholder="移动端可见" options={[{ label: '可见', value: 1 }, { label: '隐藏', value: 0 }]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="mobile_parent_id" label="移动端独立父级" extra="选填，用于移动端层级与 PC 端不同的场景">
                <TreeSelect
                  placeholder="留空表示与 PC 端同层级"
                  treeData={[
                    { value: 0, title: '顶级菜单' },
                    ...parentOptions.filter(o => o.value !== 0),
                  ]}
                  treeDefaultExpandAll
                  allowClear
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  )
}

// 递归统计指定类型数量
function countByType(nodes, type) {
  let count = 0
  nodes.forEach(n => {
    if (n.type === type) count++
    if (n.children && n.children.length > 0) count += countByType(n.children, type)
  })
  return count
}
