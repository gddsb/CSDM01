import ResizableTable from '../../components/ResizableTable'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Table, Tag, Button, Modal, Form, Input, InputNumber, Select, TreeSelect, Row, Col, Space, Popconfirm } from 'antd'
import {
  AppstoreOutlined, DashboardOutlined, HomeOutlined, MenuOutlined,
  UserOutlined, TeamOutlined, SettingOutlined, ToolOutlined,
  ShoppingOutlined, ShoppingCartOutlined, FileOutlined, FileTextOutlined,
  DatabaseOutlined, CloudOutlined, EnvironmentOutlined, SafetyOutlined,
  ThunderboltOutlined, BellOutlined, NotificationOutlined, ExperimentOutlined,
  InboxOutlined, ReadOutlined, SearchOutlined, SolutionOutlined,
  ControlOutlined, FundOutlined, LineChartOutlined, DotChartOutlined,
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
} from '@ant-design/icons'
import {
  AppOutline, HomeOutline, BillOutline, CheckOutline, UserOutline,
  TeamOutline, SettingsOutline, ShopOutline, CarOutline, LocationOutline,
  StarOutline, LikeOutline, MessageOutline, GiftOutline, FlagOutline,
  SearchOutline, RefreshOutline, EllipsisOutline, CloseOutline, AddOutline,
  CloudOutline as MCloudOutline, ProfileOutline,
} from 'antd-mobile-icons'
import ThreeSectionPage, { ActionButtons } from '../../components/ThreeSectionPage'
import type { FilterItem, StatItem } from '../../components/ThreeSectionPage'
import type { ColumnsType } from 'antd/es/table'
import api from '../../utils/api'
import { useMessage } from '../../contexts/AppContext'

// —— PC 端常用图标预设（Ant Design Icons）——
const PC_ICON_PRESETS: { value: string; label: React.ReactNode }[] = [
  { value: 'AppstoreOutlined', label: <span><AppstoreOutlined /> 应用 (AppstoreOutlined)</span> },
  { value: 'DashboardOutlined', label: <span><DashboardOutlined /> 工作台 (DashboardOutlined)</span> },
  { value: 'HomeOutlined', label: <span><HomeOutlined /> 首页 (HomeOutlined)</span> },
  { value: 'MenuOutlined', label: <span><MenuOutlined /> 菜单 (MenuOutlined)</span> },
  { value: 'UserOutlined', label: <span><UserOutlined /> 用户 (UserOutlined)</span> },
  { value: 'TeamOutlined', label: <span><TeamOutlined /> 团队 (TeamOutlined)</span> },
  { value: 'SettingOutlined', label: <span><SettingOutlined /> 设置 (SettingOutlined)</span> },
  { value: 'ToolOutlined', label: <span><ToolOutlined /> 工具 (ToolOutlined)</span> },
  { value: 'ShoppingOutlined', label: <span><ShoppingOutlined /> 购物 (ShoppingOutlined)</span> },
  { value: 'ShoppingCartOutlined', label: <span><ShoppingCartOutlined /> 购物车 (ShoppingCartOutlined)</span> },
  { value: 'FileOutlined', label: <span><FileOutlined /> 文件 (FileOutlined)</span> },
  { value: 'FileTextOutlined', label: <span><FileTextOutlined /> 文档 (FileTextOutlined)</span> },
  { value: 'DatabaseOutlined', label: <span><DatabaseOutlined /> 数据库 (DatabaseOutlined)</span> },
  { value: 'CloudOutlined', label: <span><CloudOutlined /> 云 (CloudOutlined)</span> },
  { value: 'EnvironmentOutlined', label: <span><EnvironmentOutlined /> 环境 (EnvironmentOutlined)</span> },
  { value: 'SafetyOutlined', label: <span><SafetyOutlined /> 安全 (SafetyOutlined)</span> },
  { value: 'ThunderboltOutlined', label: <span><ThunderboltOutlined /> 闪电 (ThunderboltOutlined)</span> },
  { value: 'BellOutlined', label: <span><BellOutlined /> 铃铛 (BellOutlined)</span> },
  { value: 'NotificationOutlined', label: <span><NotificationOutlined /> 通知 (NotificationOutlined)</span> },
  { value: 'ExperimentOutlined', label: <span><ExperimentOutlined /> 实验 (ExperimentOutlined)</span> },
  { value: 'InboxOutlined', label: <span><InboxOutlined /> 收件箱 (InboxOutlined)</span> },
  { value: 'ReadOutlined', label: <span><ReadOutlined /> 阅读 (ReadOutlined)</span> },
  { value: 'SearchOutlined', label: <span><SearchOutlined /> 搜索 (SearchOutlined)</span> },
  { value: 'SolutionOutlined', label: <span><SolutionOutlined /> 解决方案 (SolutionOutlined)</span> },
  { value: 'ControlOutlined', label: <span><ControlOutlined /> 控制 (ControlOutlined)</span> },
  { value: 'FundOutlined', label: <span><FundOutlined /> 趋势 (FundOutlined)</span> },
  { value: 'LineChartOutlined', label: <span><LineChartOutlined /> 折线图 (LineChartOutlined)</span> },
  { value: 'DotChartOutlined', label: <span><DotChartOutlined /> 点图 (DotChartOutlined)</span> },
  { value: 'EyeOutlined', label: <span><EyeOutlined /> 查看 (EyeOutlined)</span> },
  { value: 'PlusOutlined', label: <span><PlusOutlined /> 新增 (PlusOutlined)</span> },
]

// —— APP 端常用图标预设（antd-mobile-icons）——
const APP_ICON_PRESETS: { value: string; label: React.ReactNode }[] = [
  { value: 'AppOutline', label: <span><AppOutline /> 应用 (AppOutline)</span> },
  { value: 'HomeOutline', label: <span><HomeOutline /> 首页 (HomeOutline)</span> },
  { value: 'BillOutline', label: <span><BillOutline /> 单据 (BillOutline)</span> },
  { value: 'CheckOutline', label: <span><CheckOutline /> 勾选 (CheckOutline)</span> },
  { value: 'UserOutline', label: <span><UserOutline /> 用户 (UserOutline)</span> },
  { value: 'TeamOutline', label: <span><TeamOutline /> 团队 (TeamOutline)</span> },
  { value: 'SettingsOutline', label: <span><SettingsOutline /> 设置 (SettingsOutline)</span> },
  { value: 'ShopOutline', label: <span><ShopOutline /> 门店 (ShopOutline)</span> },
  { value: 'CarOutline', label: <span><CarOutline /> 车辆 (CarOutline)</span> },
  { value: 'LocationOutline', label: <span><LocationOutline /> 定位 (LocationOutline)</span> },
  { value: 'StarOutline', label: <span><StarOutline /> 星标 (StarOutline)</span> },
  { value: 'LikeOutline', label: <span><LikeOutline /> 喜欢 (LikeOutline)</span> },
  { value: 'MessageOutline', label: <span><MessageOutline /> 消息 (MessageOutline)</span> },
  { value: 'GiftOutline', label: <span><GiftOutline /> 礼物 (GiftOutline)</span> },
  { value: 'FlagOutline', label: <span><FlagOutline /> 标记 (FlagOutline)</span> },
  { value: 'SearchOutline', label: <span><SearchOutline /> 搜索 (SearchOutline)</span> },
  { value: 'RefreshOutline', label: <span><RefreshOutline /> 刷新 (RefreshOutline)</span> },
  { value: 'EllipsisOutline', label: <span><EllipsisOutline /> 更多 (EllipsisOutline)</span> },
  { value: 'CloseOutline', label: <span><CloseOutline /> 关闭 (CloseOutline)</span> },
  { value: 'AddOutline', label: <span><AddOutline /> 新增 (AddOutline)</span> },
  { value: 'CloudOutline', label: <span><MCloudOutline /> 云 (CloudOutline)</span> },
  { value: 'ProfileOutline', label: <span><ProfileOutline /> 个人 (ProfileOutline)</span> },
]

/** 图标字符串 → React 组件（用于表格列渲染） */
const PC_ICON_MAP: Record<string, React.ComponentType<any>> = {
  AppstoreOutlined, DashboardOutlined, HomeOutlined, MenuOutlined,
  UserOutlined, TeamOutlined, SettingOutlined, ToolOutlined,
  ShoppingOutlined, ShoppingCartOutlined, FileOutlined, FileTextOutlined,
  DatabaseOutlined, CloudOutlined, EnvironmentOutlined, SafetyOutlined,
  ThunderboltOutlined, BellOutlined, NotificationOutlined, ExperimentOutlined,
  InboxOutlined, ReadOutlined, SearchOutlined, SolutionOutlined,
  ControlOutlined, FundOutlined, LineChartOutlined, DotChartOutlined,
  EyeOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
}
const APP_ICON_MAP: Record<string, React.ComponentType<any>> = {
  AppOutline, HomeOutline, BillOutline, CheckOutline, UserOutline,
  TeamOutline, SettingsOutline, ShopOutline, CarOutline, LocationOutline,
  StarOutline, LikeOutline, MessageOutline, GiftOutline, FlagOutline,
  SearchOutline, RefreshOutline, EllipsisOutline, CloseOutline, AddOutline,
  CloudOutline: MCloudOutline, ProfileOutline,
}

function renderIcon(iconName: string | null | undefined, side: 'pc' | 'app'): React.ReactNode {
  if (!iconName) return <span style={{ color: '#ccc' }}>—</span>
  const map = side === 'pc' ? PC_ICON_MAP : APP_ICON_MAP
  const Comp = map[iconName]
  if (Comp) return <Comp />
  return <span style={{ color: '#faad14', fontSize: 12 }}>{iconName}</span>
}

/** 合并预设选项 + 自定义已选项（DB 里已有但不在预设清单的） */
function mergeIconOptions(
  presets: { value: string; label: React.ReactNode }[],
  currentValue: string | undefined,
  side: 'pc' | 'app',
): { value: string; label: React.ReactNode }[] {
  const set = new Set(presets.map(o => o.value))
  const merged = [...presets]
  if (currentValue && !set.has(currentValue)) {
    const CustomComp = (side === 'pc' ? PC_ICON_MAP : APP_ICON_MAP)[currentValue]
    merged.unshift({
      value: currentValue,
      label: CustomComp
        ? <span style={{ color: '#1890ff' }}><CustomComp /> {currentValue} (自定义)</span>
        : <span style={{ color: '#faad14' }}>{currentValue} (自定义)</span>,
    })
  }
  return merged
}

export default function MenuManagement() {
  const message = useMessage()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  const [keywordInput, setKeywordInput] = useState('')
  const [statusInput, setStatusInput] = useState<number | undefined>(undefined)
  const [query, setQuery] = useState({ keyword: '', status: undefined as number | undefined })

  // 拉取菜单列表（只查 type=menu）
  const refresh = useCallback(async () => {
    setLoading(true)
    const params: Record<string, unknown> = { type: 'menu' }  // 硬编码只查菜单
    if (query.keyword) params.keyword = query.keyword
    if (query.status !== undefined && query.status !== null) params.status = query.status
    try {
      const res = await api.get('/system/permissions', { params })
      const list: any[] = res.data || []
      setData(list)
    } catch (err: any) {
      message.error(err?.message || '获取菜单列表失败')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [query, message])

  useEffect(() => { refresh() }, [refresh])

  const handleSearch = () => setQuery({ keyword: keywordInput, status: statusInput })
  const handleReset = () => {
    setKeywordInput('')
    setStatusInput(undefined)
    setQuery({ keyword: '', status: undefined })
  }

  const handleAdd = () => { setEditing(null); setModalVisible(true) }
  const handleAddChild = (record: any) => { setEditing({ parent_id: record.perm_id }); setModalVisible(true) }
  const handleEdit = (record: any) => { setEditing(record); setModalVisible(true) }

  const handleAfterOpenChange = (open: boolean) => {
    if (!open) return
    if (editing && editing.perm_id) {
      form.setFieldsValue({
        parent_id: editing.parent_id || 0,
        perm_name: editing.perm_name,
        mobile_perm_name: editing.mobile_perm_name || '',
        icon: editing.icon || undefined,
        mobile_icon: editing.mobile_icon || undefined,
        sort_order: editing.sort_order ?? 0,
        status: editing.status !== undefined ? Number(editing.status) : 1,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({
        parent_id: editing?.parent_id || 0,
        sort_order: 0,
        status: 1,
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
        // mobile_perm_name 为空时用 perm_name 自动加 M 前缀兜底
        mobile_perm_name: values.mobile_perm_name
          ? (values.mobile_perm_name.startsWith('M') ? values.mobile_perm_name : 'M' + values.mobile_perm_name)
          : ('M' + (values.perm_name || '')),
      }
      if (editing && editing.perm_id) {
        const res = await api.put(`/system/permissions/${editing.perm_id}`, payload)
        message.success(res.message || '菜单修改成功')
      } else {
        const res = await api.post('/system/permissions', { ...payload, type: 'menu' })
        message.success(res.message || '菜单新增成功')
      }
      setModalVisible(false)
      refresh()
      window.dispatchEvent(new Event('menu-updated'))
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.message || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (record: any) => {
    try {
      const res = await api.delete(`/system/permissions/${record.perm_id}`)
      message.success(res.message || '删除成功')
      refresh()
      window.dispatchEvent(new Event('menu-updated'))
    } catch (err: any) {
      message.error(err?.message || '删除失败')
    }
  }

  // —— 父菜单下拉树（仅 type=menu）——
  const parentOptions = useMemo(() => {
    const buildTree = (nodes: any[], depth = 0, excludeId?: number): any[] => {
      const result: any[] = []
      for (const n of nodes) {
        if (excludeId && n.perm_id === excludeId) continue
        result.push({
          value: n.perm_id,
          title: `${'— '.repeat(depth)}${renderIcon(n.icon, 'pc')} ${n.perm_name}`,
        })
        if (n.children?.length) {
          result.push(...buildTree(n.children, depth + 1, excludeId))
        }
      }
      return result
    }
    return [
      { value: 0, title: '顶级菜单' },
      ...buildTree(data, 0, editing?.perm_id),
    ]
  }, [data, editing])

  // —— 统计面板 ——
  const menuStats = useMemo(() => {
    const count = (nodes: any[]): { total: number; enabled: number; disabled: number } => {
      let total = 0, enabled = 0, disabled = 0
      for (const n of nodes) {
        if (n.type === 'menu') {
          total++
          if (Number(n.status) === 1) enabled++; else disabled++
        }
        if (n.children?.length) {
          const sub = count(n.children)
          total += sub.total; enabled += sub.enabled; disabled += sub.disabled
        }
      }
      return { total, enabled, disabled }
    }
    return count(data)
  }, [data])

  // —— 列表列（精简版）——
  const columns: ColumnsType<any> = [
    { title: '菜单名称', dataIndex: 'perm_name', key: 'perm_name', width: 200 },
    {
      title: '图标 (PC)', key: 'icon', width: 80,
      render: (_, r) => <span style={{ fontSize: 18 }}>{renderIcon(r.icon, 'pc')}</span>,
    },
    {
      title: '图标 (APP)', key: 'mobile_icon', width: 80,
      render: (_, r) => <span style={{ fontSize: 18 }}>{renderIcon(r.mobile_icon, 'app')}</span>,
    },
    {
      title: 'APP 菜单名', dataIndex: 'mobile_perm_name', key: 'mobile_perm_name', width: 180,
      render: (v) => v || <span style={{ color: '#999' }}>—</span>,
    },
    { title: '排序', dataIndex: 'sort_order', key: 'sort_order', width: 70 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: v => <Tag color={Number(v) === 1 ? 'green' : 'red'}>{Number(v) === 1 ? '启用' : '停用'}</Tag>,
    },
    {
      title: '操作', key: 'action', fixed: 'right', width: 220,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => handleAddChild(record)}>子菜单</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm
            title="确认删除该菜单？删除后下属子菜单会一起删除。"
            onConfirm={() => handleDelete(record)}
            okText="确认" cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const filters: FilterItem[] = [
    { type: 'input', placeholder: '搜索菜单名称/编码', col: { span: 12 },
      value: keywordInput, onChange: (e: any) => setKeywordInput(e.target.value) },
    { type: 'select', placeholder: '状态', col: { span: 6 },
      options: [{ label: '启用', value: 1 }, { label: '停用', value: 0 }],
      value: statusInput, onChange: v => setStatusInput((v as number | undefined)) },
  ]

  const stats: StatItem[] = [
    { label: '菜单总数', value: menuStats.total, icon: <AppstoreOutlined />, color: 'var(--color-primary)' },
    { label: '启用中', value: menuStats.enabled, icon: <CheckOutline />, color: 'var(--color-success)' },
    { label: '已停用', value: menuStats.disabled, icon: <CloseOutline />, color: 'var(--color-warning)' },
  ]

  // —— Modal 里当前选中的图标（用于合并预设 + 自定义）——
  const pcIconValue = Form.useWatch('icon', form)
  const appIconValue = Form.useWatch('mobile_icon', form)

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
          <ResizableTable
            tableKey="pages_system_MenuManagement"
            columns={columns}
            dataSource={data}
            rowKey="perm_id"
            size="small"
            loading={loading}
            scroll={{ x: 1100 }}
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
        width={880}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="compact-form" preserve={false}>
          {/* ── 第一栏：菜单配置（可编辑）── */}
          <h4 style={{ margin: '0 0 12px', borderBottom: '1px solid #f0f0f0', paddingBottom: 8 }}>
            菜单配置（可编辑）
          </h4>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="parent_id" label="父级菜单" rules={[{ required: true, message: '请选择父级菜单' }]}>
                <TreeSelect
                  placeholder="顶级菜单为 0"
                  treeData={parentOptions}
                  treeDefaultExpandAll
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="sort_order" label="排序号">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="数字越小越靠前" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="status" label="状态" rules={[{ required: true }]}>
                <Select options={[{ label: '启用', value: 1 }, { label: '停用', value: 0 }]} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="perm_name" label="PC 端菜单名称" rules={[{ required: true, message: '请输入 PC 端菜单名称' }]}>
                <Input placeholder="如：生产管理" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="mobile_perm_name" label="APP 端菜单名称">
                <Input placeholder="留空则用 PC 名自动加 M 前缀" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="icon" label="PC 端图标">
                <Select
                  placeholder="选择 PC 端图标"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={mergeIconOptions(PC_ICON_PRESETS, pcIconValue, 'pc')}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="mobile_icon" label="APP 端图标">
                <Select
                  placeholder="选择 APP 端图标"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={mergeIconOptions(APP_ICON_PRESETS, appIconValue, 'app')}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* ── 第二栏：系统元数据（只读展示）── */}
          <h4 style={{ margin: '16px 0 12px', borderBottom: '1px solid #f0f0f0', paddingBottom: 8, color: '#999' }}>
            系统元数据（只读）
          </h4>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="权限编码">
                <Input value={editing?.perm_code} disabled placeholder="系统内部唯一标识" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="路由路径 (PC)">
                <Input value={editing?.path} disabled placeholder="如 /system/users" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="组件路径">
                <Input value={editing?.component} disabled placeholder="如 pages/system/UserManagement" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="路由路径 (APP)">
                <Input value={editing?.mobile_route_path} disabled placeholder="如 /m/dashboard" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  )
}
