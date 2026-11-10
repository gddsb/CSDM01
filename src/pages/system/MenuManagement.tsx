import ResizableTable from '../../components/ResizableTable'
import React, { useState, useEffect, useCallback } from 'react'
import { Table, Tag, Button, Modal, Form, Input, InputNumber, Select, TreeSelect, Row, Col, Space, Popconfirm, Typography, Divider } from 'antd'
import {
  AppstoreOutlined, CheckCircleOutlined, CloseCircleOutlined,
  PlusOutlined, MonitorOutlined, MobileOutlined,
} from '@ant-design/icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import type { FilterItem, StatItem } from '../../components/ThreeSectionPage'
import type { ColumnsType } from 'antd/es/table'
import api from '../../utils/api'
import { useMessage } from '../../contexts/AppContext'

const { Text } = Typography

const typeOptions = [
  { label: '菜单', value: 'menu' },
  { label: '页面', value: 'page' },
  { label: '按钮', value: 'button' },
  { label: '接口', value: 'api' },
]

const typeColorMap = { menu: 'blue', page: 'cyan', button: 'orange', api: 'purple' }

// —— PC 端图标库（@ant-design/icons 名称）——
const PC_ICON_OPTIONS = [
  { label: '菜单 MenuOutlined',                 value: 'MenuOutlined' },
  { label: '首页 HomeOutlined',                 value: 'HomeOutlined' },
  { label: '设置 SettingOutlined',              value: 'SettingOutlined' },
  { label: '用户 UserOutlined',                 value: 'UserOutlined' },
  { label: '团队 TeamOutlined',                 value: 'TeamOutlined' },
  { label: '生产 AppstoreOutlined',             value: 'AppstoreOutlined' },
  { label: '质检 SafetyOutlined',               value: 'SafetyOutlined' },
  { label: '设备 ToolOutlined',                 value: 'ToolOutlined' },
  { label: '报表 BarChartOutlined',             value: 'BarChartOutlined' },
  { label: '数据大屏 DashboardOutlined',        value: 'DashboardOutlined' },
  { label: '数据库 DatabaseOutlined',           value: 'DatabaseOutlined' },
  { label: '自动化 ThunderboltOutlined',        value: 'ThunderboltOutlined' },
  { label: '时钟 ClockCircleOutlined',          value: 'ClockCircleOutlined' },
  { label: '告警 WarningOutlined',              value: 'WarningOutlined' },
  { label: '文件 FileOutlined',                 value: 'FileOutlined' },
]

// —— APP 端图标库（antd-mobile-icons 名称）——
const APP_ICON_OPTIONS = [
  { label: '应用 AppOutline',         value: 'AppOutline' },
  { label: '设置 SettingsOutline',    value: 'SettingsOutline' },
  { label: '用户 UserOutline',         value: 'UserOutline' },
  { label: '设备 ToolOutline',         value: 'ToolOutline' },
  { label: '质检 CheckShieldOutline',  value: 'CheckShieldOutline' },
  { label: '生产 RocketOutline',       value: 'RocketOutline' },
  { label: '报表 BarChartOutline',     value: 'BarChartOutline' },
  { label: '文件 FileOutline',         value: 'FileOutline' },
  { label: '日历 CalendarOutline',     value: 'CalendarOutline' },
  { label: '搜索 SearchOutline',       value: 'SearchOutline' },
  { label: '通知 BellOutline',         value: 'BellOutline' },
  { label: '返回 LeftOutline',         value: 'LeftOutline' },
]

// —— APP 端 TabBar 分组选项 ——
// 需求 1: value 改为 PC 一级菜单 perm_code（production/quality/device）
//   inspection 已由 M037 migration 改为 quality
const TAB_GROUP_OPTIONS = [
  { label: '生产管理', value: 'production' },
  { label: '质量管理', value: 'quality' },
  { label: '设备管理', value: 'device' },
]

// —— APP 端可见状态 ——
const MOBILE_VISIBLE_OPTIONS = [
  { label: '可见', value: 1 },
  { label: '隐藏', value: 0 },
]

// —— PC 端状态 ——
const PC_STATUS_OPTIONS = [
  { label: '启用', value: 1 },
  { label: '停用', value: 0 },
]

export default function MenuManagement() {
  const message = useMessage()
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  // —— 监听 PC 端三个字段，APP 端只读展示自动同步 ——
  const pcType = Form.useWatch('type', form)
  const pcName = Form.useWatch('perm_name', form)
  const pcCode = Form.useWatch('perm_code', form)

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
        // PC 端 9 个字段
        parent_id: editing.parent_id || 0,
        type: editing.type,
        perm_name: editing.perm_name,
        perm_code: editing.perm_code,
        icon: editing.icon,
        path: editing.path,
        component: editing.component,
        status: editing.status,
        sort_order: editing.sort_order,
        // APP 端 5 个独立字段（type/perm_name/perm_code 只读，不进 Form）
        mobile_parent_id: editing.mobile_parent_id ?? null,
        mobile_icon: editing.mobile_icon || null,
        mobile_route_path: editing.mobile_route_path || null,
        mobile_tab_group: editing.mobile_tab_group ?? null,
        mobile_visible: editing.mobile_visible ?? 1,
        mobile_sort_order: editing.mobile_sort_order ?? null,
        // 需求 2+3: 移动端独立显示名（以 M 开头，显示时自动剥离）
        mobile_perm_name: editing.mobile_perm_name || null,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({
        // PC 端默认值
        parent_id: editing?.parent_id || 0,
        type: 'menu',
        status: 1,
        sort_order: 0,
        // APP 端默认值
        mobile_visible: 1,
      })
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const payload = {
        // PC 端字段
        ...values,
        parent_id: values.parent_id || 0,
        status: values.status !== undefined ? Number(values.status) : 1,
        sort_order: values.sort_order !== undefined ? Number(values.sort_order) : 0,
        // APP 端字段：null 让后端保留原值 / 继承 PC 端
        mobile_parent_id: values.mobile_parent_id || null,
        mobile_icon: values.mobile_icon || null,
        mobile_route_path: values.mobile_route_path || null,
        mobile_tab_group: values.mobile_tab_group || null,
        mobile_visible: values.mobile_visible !== undefined ? Number(values.mobile_visible) : null,
        mobile_sort_order: values.mobile_sort_order !== undefined ? Number(values.mobile_sort_order) : null,
        mobile_perm_name: values.mobile_perm_name || null,
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
      window.dispatchEvent(new Event('menu-updated'))
    } catch (err) {
      message.error(err.message || '删除失败')
    }
  }

  const columns: ColumnsType<any> = [
    { title: '菜单名称', dataIndex: 'perm_name', key: 'perm_name', width: 160 },
    {
      title: '移动端名称', key: 'mobile_name', width: 140,
      render: (_, record) => {
        const group = record.mobile_tab_group
        const route = record.mobile_route_path
        if (!group && !route) return <span style={{ color: '#bbb' }}>—</span>
        const groupMap: Record<string, string> = { production: '生产管理', quality: '质量管理', device: '设备管理' }
        const label = group && groupMap[group] ? groupMap[group] : (record.perm_name || '')
        return <span style={{ color: '#389e0d' }}>{label}</span>
      },
    },
    {
      title: '类型', dataIndex: 'type', key: 'type', width: 70,
      render: v => v ? <Tag color={typeColorMap[v] || 'default'}>{typeOptions.find(t => t.value === v)?.label || v}</Tag> : '-',
    },
    { title: '排序号', dataIndex: 'sort_order', key: 'sort_order', width: 70, align: 'center' },
    { title: '移动端排序', dataIndex: 'mobile_sort_order', key: 'mobile_sort_order', width: 90, align: 'center',
      render: v => v != null ? v : <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'PC 端状态', dataIndex: 'status', key: 'status_pc', width: 80,
      render: v => <Tag color={v === 1 ? 'green' : 'red'}>{v === 1 ? '启用' : '停用'}</Tag>,
    },
    {
      title: '移动端状态', dataIndex: 'mobile_visible', key: 'status_mobile', width: 80,
      render: (v, record) => {
        if (!record.mobile_tab_group && !record.mobile_route_path) return <span style={{ color: '#bbb' }}>—</span>
        return <Tag color={v === 1 ? 'green' : 'red'}>{v === 1 ? '可见' : '隐藏'}</Tag>
      },
    },
    {
      title: '操作', key: 'action', fixed: 'right', width: 200,
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
      options: PC_STATUS_OPTIONS, value: statusInput, onChange: v => setStatusInput(v),
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
          <ResizableTable tableKey="pages_system_MenuManagement" columns={columns}
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
        width={1080}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="horizontal"
          preserve={false}
          style={{ margin: 0 }}
          labelCol={{ span: 9 }}
          wrapperCol={{ span: 14 }}
          labelAlign="right"
        >
          <Row gutter={16}>
            {/* ========== 左列：PC 端配置 ========== */}
            <Col span={11}>
              <div style={{
                marginBottom: 12, padding: '4px 10px', background: '#e6f4ff',
                borderRadius: 4, fontSize: 13, fontWeight: 500, color: '#1677ff',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <MonitorOutlined /> PC 端配置
              </div>

              {/* 行 1 — 父级菜单 */}
              <Form.Item name="parent_id" label="父级菜单" labelCol={{ span: 8 }} wrapperCol={{ span: 15 }}>
                <TreeSelect
                  placeholder="请选择父级菜单"
                  treeData={parentOptions}
                  treeDefaultExpandAll
                  allowClear
                />
              </Form.Item>

              {/* 行 2 — 类型 */}
              <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]} labelCol={{ span: 8 }} wrapperCol={{ span: 15 }}>
                <Select placeholder="请选择类型" options={typeOptions} />
              </Form.Item>

              {/* 行 3 — 菜单名称 */}
              <Form.Item name="perm_name" label="菜单名称" rules={[{ required: true, message: '请输入菜单名称' }]} labelCol={{ span: 8 }} wrapperCol={{ span: 15 }}>
                <Input placeholder="请输入菜单名称" />
              </Form.Item>

              {/* 行 4 — 权限编码 */}
              <Form.Item name="perm_code" label="权限编码" rules={[{ required: true, message: '请输入权限编码' }]} labelCol={{ span: 8 }} wrapperCol={{ span: 15 }}>
                <Input placeholder="如 system:user" disabled={!!(editing && editing.perm_id)} />
              </Form.Item>

              {/* 行 5 — 图标（PC 端下拉） */}
              <Form.Item name="icon" label="图标" labelCol={{ span: 8 }} wrapperCol={{ span: 15 }}>
                <Select
                  placeholder="选择 PC 端图标"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={PC_ICON_OPTIONS}
                />
              </Form.Item>

              {/* 行 6 — 路由路径 */}
              <Form.Item name="path" label="路由路径" labelCol={{ span: 8 }} wrapperCol={{ span: 15 }}>
                <Input placeholder="如 /system/users" />
              </Form.Item>

              {/* 行 7 — 组件路径 */}
              <Form.Item name="component" label="组件路径" labelCol={{ span: 8 }} wrapperCol={{ span: 15 }}>
                <Input placeholder="如 pages/system/UserManagement" />
              </Form.Item>

              {/* 行 8 — 状态 */}
              <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]} labelCol={{ span: 8 }} wrapperCol={{ span: 15 }}>
                <Select placeholder="请选择状态" options={PC_STATUS_OPTIONS} />
              </Form.Item>

              {/* 行 9 — 排序号 */}
              <Form.Item name="sort_order" label="排序号" labelCol={{ span: 8 }} wrapperCol={{ span: 15 }}>
                <InputNumber placeholder="数字" style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            {/* ========== 分隔竖线 ========== */}
            <Divider type="vertical" style={{ height: 'auto', margin: 0 }} />

            {/* ========== 右列：APP 端配置 ========== */}
            <Col span={11}>
              <div style={{
                marginBottom: 12, padding: '4px 10px', background: '#f6ffed',
                borderRadius: 4, fontSize: 13, fontWeight: 500, color: '#389e0d',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <MobileOutlined /> APP 端配置
                <Text type="secondary" style={{ fontSize: 11, fontWeight: 400 }}>（灰色=跟随 PC 端自动同步）</Text>
              </div>

              {/* 行 1 — 移动端独立父级（独立字段） */}
              <Form.Item name="mobile_parent_id" label="独立父级" labelCol={{ span: 8 }} wrapperCol={{ span: 15 }}>
                <TreeSelect
                  placeholder="留空=与 PC 端同层级"
                  treeData={[
                    { value: 0, title: '顶级菜单' },
                    ...parentOptions.filter(o => o.value !== 0),
                  ]}
                  treeDefaultExpandAll
                  allowClear
                />
              </Form.Item>

              {/* 行 2 — 类型（只读，跟随 PC） */}
              <Form.Item label="类型" labelCol={{ span: 8 }} wrapperCol={{ span: 15 }}>
                <Input disabled value={pcType ? (typeOptions.find(t => t.value === pcType)?.label || pcType) : '—'} />
              </Form.Item>

              {/* 行 3 — 菜单名称（只读，跟随 PC） */}
              <Form.Item label="菜单名称" labelCol={{ span: 8 }} wrapperCol={{ span: 15 }}>
                <Input disabled value={pcName || '—'} />
              </Form.Item>

              {/* 行 3.5 — 移动端独立显示名（需求 2+3：以 M 开头，显示时自动剥离） */}
              <Form.Item name="mobile_perm_name" label="移动端名称" labelCol={{ span: 8 }} wrapperCol={{ span: 15 }}>
                <Input placeholder="以 M 开头，如 M生产订单（留空跟随 PC 端）" />
              </Form.Item>

              {/* 行 4 — 权限编码（只读，跟随 PC） */}
              <Form.Item label="权限编码" labelCol={{ span: 8 }} wrapperCol={{ span: 15 }}>
                <Input disabled value={pcCode || '—'} />
              </Form.Item>

              {/* 行 5 — 图标（APP 端下拉，独立） */}
              <Form.Item name="mobile_icon" label="图标" labelCol={{ span: 8 }} wrapperCol={{ span: 15 }}>
                <Select
                  placeholder="选择 APP 端图标（留空继承 PC）"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={APP_ICON_OPTIONS}
                />
              </Form.Item>

              {/* 行 6 — 移动端路由（独立） */}
              <Form.Item name="mobile_route_path" label="路由路径" labelCol={{ span: 8 }} wrapperCol={{ span: 15 }}>
                <Input placeholder="如 /m/device-maintenance" />
              </Form.Item>

              {/* 行 7 — TabBar 分组（独有） */}
              <Form.Item name="mobile_tab_group" label="TabBar 分组" labelCol={{ span: 8 }} wrapperCol={{ span: 15 }}>
                <Select
                  placeholder="留空=不在移动端显示"
                  allowClear
                  options={TAB_GROUP_OPTIONS}
                />
              </Form.Item>

              {/* 行 8 — 移动端可见（独立） */}
              <Form.Item name="mobile_visible" label="移动端可见" labelCol={{ span: 8 }} wrapperCol={{ span: 15 }}>
                <Select placeholder="是否在移动端显示" options={MOBILE_VISIBLE_OPTIONS} />
              </Form.Item>

              {/* 行 9 — 移动端排序（独立） */}
              <Form.Item name="mobile_sort_order" label="排序号" labelCol={{ span: 8 }} wrapperCol={{ span: 15 }}>
                <InputNumber placeholder="数字（留空继承 PC）" style={{ width: '100%' }} />
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
