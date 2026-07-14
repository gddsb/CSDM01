import { useState, useEffect, useCallback } from 'react'
import { Layout, Menu, Dropdown, Avatar, Space, Typography, Badge, Button, Modal, Form, Input, Tooltip, Upload } from 'antd'
import type { MenuProps } from 'antd'
import {
  DashboardOutlined, TeamOutlined, DatabaseOutlined, SettingOutlined,
  ProfileOutlined, DeploymentUnitOutlined, SafetyCertificateOutlined,
  ExperimentOutlined, ToolOutlined, BarChartOutlined, FileTextOutlined,
  LogoutOutlined, UserOutlined, BellOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  PieChartOutlined, FileSearchOutlined, FundProjectionScreenOutlined,
  ControlOutlined, DesktopOutlined, LineChartOutlined, CalendarOutlined,
  RiseOutlined, AlertOutlined, ContainerOutlined,
  LockOutlined, KeyOutlined, MenuOutlined, SkinOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useApp, useMessage, User } from '../contexts/AppContext'
import { themeList, themes } from '../themes'
import api from '../utils/api'

// 20 个预设头像（使用 DiceBear API 生成不同样式头像）
const presetAvatars = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Mimi',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Bandit',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Lily',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Leo',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Sophie',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Toto',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Coco',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Max',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Whiskers',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Bubbles',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Shadow',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Sunny',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Pepper',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Alpha',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Beta',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Gamma',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Delta',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Omega',
]

const { Sider, Header, Content } = Layout
const { Text } = Typography

// 图标名称 → 组件映射（用于动态菜单渲染）
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  DashboardOutlined, TeamOutlined, DatabaseOutlined, SettingOutlined,
  ProfileOutlined, DeploymentUnitOutlined, SafetyCertificateOutlined,
  ExperimentOutlined, ToolOutlined, BarChartOutlined, FileTextOutlined,
  LogoutOutlined, UserOutlined, BellOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  PieChartOutlined, FileSearchOutlined, FundProjectionScreenOutlined,
  ControlOutlined, DesktopOutlined, LineChartOutlined, CalendarOutlined,
  RiseOutlined, AlertOutlined, ContainerOutlined,
  LockOutlined, KeyOutlined, MenuOutlined,
}
function resolveIcon(name?: string): React.ReactNode {
  if (!name) return undefined
  const Comp = iconMap[name]
  return Comp ? <Comp /> : undefined
}

// 默认菜单（兜底，当后端菜单接口不可用时使用）
const defaultMenuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '工作台' },
  {
      key: 'production', icon: <ToolOutlined />, label: '生产管理',
      children: [
        { key: '/production/orders', icon: <FileTextOutlined />, label: '生产订单' },
        { key: '/production/workorders', icon: <ToolOutlined />, label: '工单管理' },
        { key: '/production/reporting', icon: <ProfileOutlined />, label: '生产报工' },
      ]
    },
  {
    key: 'quality', icon: <ExperimentOutlined />, label: '质量管理',
    children: [
      { key: '/quality/standards', icon: <SafetyCertificateOutlined />, label: '检验标准管理' },
      { key: '/quality/incoming', icon: <ExperimentOutlined />, label: '来料检验' },
      { key: '/quality/process', icon: <ExperimentOutlined />, label: '过程检验' },
      { key: '/quality/finished', icon: <ExperimentOutlined />, label: '成品检验' },
      { key: '/quality/microbe', icon: <ExperimentOutlined />, label: '产品微生物检验' },
      { key: '/quality/environment', icon: <ExperimentOutlined />, label: '环境检验' },
      {
        key: 'quality-complaint', icon: <BellOutlined />, label: '投诉管理',
        children: [
          { key: '/quality/complaints', icon: <BellOutlined />, label: '客诉管理' },
          { key: '/quality/supplier', icon: <TeamOutlined />, label: '供应商投诉' },
        ]
      },
      { key: '/quality/instruments', icon: <ToolOutlined />, label: '检测仪器管理' },
    ]
  },
  {
    key: 'device', icon: <ToolOutlined />, label: '设备管理',
    children: [
      { key: '/device/list', icon: <ToolOutlined />, label: '设备档案' },
      { key: '/device/check-records', icon: <FileSearchOutlined />, label: '点检记录' },
      { key: '/device/maintenance', icon: <ToolOutlined />, label: '维修保养' },
      { key: '/device/oee', icon: <LineChartOutlined />, label: '设备OEE' },
    ]
  },
  {
    key: 'basic', icon: <ProfileOutlined />, label: '基础数据',
    children: [
      { key: '/basic/materials', icon: <ProfileOutlined />, label: '料品档案' },
      { key: '/basic/customers', icon: <TeamOutlined />, label: '客户档案' },
      { key: '/basic/lines', icon: <DeploymentUnitOutlined />, label: '产线档案' },
      { key: '/basic/processes', icon: <DeploymentUnitOutlined />, label: '工序档案' },
      { key: '/basic/defects', icon: <AlertOutlined />, label: '不良分类' },
      { key: '/basic/number-rules', icon: <KeyOutlined />, label: '编码管理' },
    ]
  },
  {
    key: 'report', icon: <PieChartOutlined />, label: '报表中心',
    children: [
      { key: '/report/daily', icon: <CalendarOutlined />, label: '生产日报' },
      { key: '/report/monthly', icon: <FileTextOutlined />, label: '质量月报' },
      { key: '/report/efficiency', icon: <RiseOutlined />, label: '效率分析' },
      { key: '/report/production', icon: <FileTextOutlined />, label: '生产报表' },
      { key: '/report/quality', icon: <ExperimentOutlined />, label: '质量报表' },
      { key: '/report/exception', icon: <BellOutlined />, label: '异常分析报表' },
    ]
  },
  {
    key: 'bigscreen', icon: <DesktopOutlined />, label: '数据大屏',
    children: [
      { key: '/bigscreen/production', icon: <BarChartOutlined />, label: '生产实时看板' },
      { key: '/bigscreen/quality', icon: <ExperimentOutlined />, label: '质量分析看板' },
      { key: '/bigscreen/management', icon: <PieChartOutlined />, label: '管理驾驶舱' },
    ]
  },
  {
    key: 'system', icon: <SettingOutlined />, label: '系统管理',
    children: [
      { key: '/system/users', icon: <TeamOutlined />, label: '用户管理' },
      { key: '/system/roles', icon: <SafetyCertificateOutlined />, label: '角色权限' },
      { key: '/system/menus', icon: <MenuOutlined />, label: '菜单管理' },
      { key: '/system/dictionary', icon: <DatabaseOutlined />, label: '数据字典' },
      { key: '/system/config', icon: <ControlOutlined />, label: '系统配置' },
      { key: '/system/logs', icon: <FileTextOutlined />, label: '操作日志' },
    ]
  },
]

export default function MainLayout() {
  const message = useMessage()
  const { currentUser, logout, updateUser, themeKey, cycleTheme, systemConfig, loadSystemConfig } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [pwdOpen, setPwdOpen] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [profileForm] = Form.useForm()
  const [pwdForm] = Form.useForm()
  // 动态菜单（从后端拉取；为 null 时使用默认 menuItems 兜底）
  const [dynamicMenu, setDynamicMenu] = useState(null)

  // 当前主题对象（用于显示图标和提示）
  const currentTheme = themes[themeKey] || themes.pureMilk

  const handleCycleTheme = () => {
    const nextKey = cycleTheme()
    const next = themes[nextKey]
    message.success(`已切换主题：${next.name}`, 1)
  }

  // 头像上传（自定义头像）
  const handleAvatarUpload = async (file) => {
    if (!file) return
    // 限制 2MB
    if (file.size > 2 * 1024 * 1024) {
      message.error('头像图片不能超过 2MB')
      return false
    }
    // 仅允许图片类型
    if (!file.type.startsWith('image/')) {
      message.error('请上传图片格式的文件')
      return false
    }
    try {
      setAvatarUploading(true)
      const formData = new FormData()
      formData.append('avatar', file)
      const res = await api.post('/system/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      // 更新本地用户信息（后端返回完整 user 对象）
      if (res.data?.user) {
        updateUser(res.data.user)
      } else {
        updateUser({ avatar_url: res.data?.avatar_url })
      }
      message.success(res.message || '头像上传成功')
      setAvatarOpen(false)
    } catch (err) {
      message.error(err.message || '头像上传失败')
    } finally {
      setAvatarUploading(false)
    }
    return false  // 阻止 antd 默认上传行为
  }

  // 选择预设头像
  const handleSelectPreset = async (url) => {
    try {
      const res = await api.put('/system/users/me/avatar', { avatar_url: url })
      if (res.data?.user) {
        updateUser(res.data.user)
      } else {
        updateUser({ avatar_url: url })
      }
      message.success(res.message || '头像设置成功')
      setAvatarOpen(false)
    } catch (err) {
      message.error(err.message || '头像设置失败')
    }
  }

  // 获取系统配置
  useEffect(() => {
    loadSystemConfig()
  }, [loadSystemConfig])

  // 获取动态菜单（按当前用户角色权限）
  const fetchMenu = useCallback(async () => {
    try {
      const res = await api.get('/system/permissions/menu')
      const tree = res.data || []
      if (Array.isArray(tree) && tree.length > 0) {
        setDynamicMenu(tree)
      }
    } catch (err) {
      // 静默失败，使用默认菜单兜底
    }
  }, [])

  useEffect(() => {
    fetchMenu()
    // 监听菜单更新事件（菜单管理页面修改后触发）
    const handleMenuUpdate = () => fetchMenu()
    window.addEventListener('menu-updated', handleMenuUpdate)
    return () => {
      window.removeEventListener('menu-updated', handleMenuUpdate)
    }
  }, [fetchMenu])

  const systemName = systemConfig.system_name || '长沙大满生产制造系统'
  const companyName = systemConfig.company_name || ''

  useEffect(() => {
    document.title = systemName
  }, [systemName])

  interface MenuNode {
    type: string
    path?: string
    perm_code?: string
    icon?: string
    perm_name: string
    children?: MenuNode[]
  }

  const buildMenuItems = (nodes: MenuNode[]): MenuProps['items'] => {
    return nodes
      .filter(n => n.type === 'menu' || n.type === 'page')
      .map(n => {
        const item: MenuProps['items'][number] = {
          key: n.path || n.perm_code || '',
          icon: resolveIcon(n.icon),
          label: n.perm_name,
        } as MenuProps['items'][number]
        if (n.children && n.children.length > 0) {
          (item as { children?: MenuProps['items'] }).children = buildMenuItems(n.children)
        }
        return item
      })
  }

  // 当前生效的菜单：优先使用后端菜单，否则使用默认菜单
  // 后端菜单前置工作台入口（工作台不依赖权限分配，所有登录用户均可见）
  const menuItems = dynamicMenu
    ? [{ key: '/dashboard', icon: <DashboardOutlined />, label: '工作台' }, ...buildMenuItems(dynamicMenu)]
    : defaultMenuItems

  const getOpenKeys = () => {
    const path = location.pathname
    for (const item of menuItems as MenuProps['items']) {
      if ('children' in item && item.children) {
        for (const child of item.children) {
          if (!('key' in child)) continue
          if (child.key === path) return [item.key]
          if ('children' in child && child.children) {
            for (const grandchild of child.children) {
              if (!('key' in grandchild)) continue
              if (path.startsWith(grandchild.key)) return [item.key, child.key]
            }
          }
          if (child.key.startsWith('/') && path.startsWith(child.key)) return [item.key]
        }
      }
    }
    return []
  }

  const getSelectedKeys = () => {
    const path = location.pathname
    for (const item of menuItems as MenuProps['items']) {
      if (!('key' in item)) continue
      if (item.key === path) return [path]
      if ('children' in item && item.children) {
        for (const child of item.children) {
          if (!('key' in child)) continue
          if (child.key === path) return [child.key]
          if ('children' in child && child.children) {
            for (const grandchild of child.children) {
              if (!('key' in grandchild)) continue
              if (path.startsWith(grandchild.key)) return [grandchild.key]
            }
          }
          if (child.key.startsWith('/') && path.startsWith(child.key)) return [child.key]
        }
      }
    }
    return [path]
  }

  const handleMenuClick = ({ key }) => {
    if (key.startsWith('/')) navigate(key)
  }

  const openProfile = () => {
    profileForm.setFieldsValue({
      real_name: currentUser?.real_name,
      phone: currentUser?.phone,
      email: currentUser?.email,
    })
    setProfileOpen(true)
  }

  const handleProfileSave = async () => {
    const values = await profileForm.validateFields()
    try {
      const res = await api.put('/system/users/me/profile', {
        real_name: values.real_name,
        phone: values.phone,
        email: values.email,
      })
      updateUser(res.data || values)
      message.success('个人信息已更新')
      setProfileOpen(false)
    } catch (err) {
      message.error(err.message || '保存失败')
    }
  }

  const handlePwdSave = async () => {
    const values = await pwdForm.validateFields()
    if (values.new_password !== values.confirm_password) {
      message.error('两次输入的密码不一致')
      return
    }
    if (values.old_password !== '123456') {
      message.error('原密码错误')
      return
    }
    message.success('密码修改成功，请重新登录')
    setPwdOpen(false)
    pwdForm.resetFields()
    setTimeout(() => logout(), 1000)
  }

  const userMenu: MenuProps = {
    items: [
      { key: 'info', label: `${currentUser?.real_name} (${currentUser?.role?.role_name || '-'})`, disabled: true },
      { key: 'dept', label: `部门：${currentUser?.department}`, disabled: true },
      { type: 'divider' as const },
      { key: 'profile', label: '用户设置', icon: <UserOutlined /> },
      { key: 'password', label: '修改密码', icon: <KeyOutlined /> },
      { type: 'divider' as const },
      { key: 'logout', label: '退出登录', icon: <LogoutOutlined />, danger: true },
    ],
    onClick: ({ key }) => {
      if (key === 'logout') logout()
      if (key === 'profile') openProfile()
      if (key === 'password') { pwdForm.resetFields(); setPwdOpen(true) }
    }
  }

  return (
    <Layout className={`app-layout ${collapsed ? 'collapsed' : ''}`}>
      <Sider
        className="app-sider"
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={220}
        style={{ background: 'var(--nav-bg)' }}
      >
        <div className="logo" style={{ color: 'var(--nav-text)' }}>
          <div className="daman-logo">
            <span className="daman-en">daman</span>
            <span className="daman-cn">大满</span>
          </div>
          {!collapsed && <span>{systemName}</span>}
        </div>
        <Menu
          mode="inline"
          selectedKeys={getSelectedKeys()}
          defaultOpenKeys={getOpenKeys()}
          items={menuItems}
          onClick={handleMenuClick}
          style={{
            background: 'transparent',
            color: 'var(--nav-text)',
            borderRight: 'none',
          }}
        />
      </Sider>
      <Layout>
        <Header className="app-header">
          <Space>
            <Button
              type="text"
              onClick={() => setCollapsed(!collapsed)}
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            />
            {companyName && <Text strong style={{ color: 'var(--color-primary)' }}>{companyName}</Text>}
            <Text strong>欢迎，{currentUser?.real_name}</Text>
            <Badge count={3} size="small">
              <BellOutlined style={{ fontSize: 18, cursor: 'pointer' }} />
            </Badge>
          </Space>
          <Space size={16}>
            <Tooltip title={`主题：${currentTheme.name}（点击切换）`}>
              <Button
                type="text"
                shape="circle"
                icon={currentTheme.icon}
                onClick={handleCycleTheme}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-primary)',
                  fontSize: 18,
                }}
              />
            </Tooltip>
            <Dropdown menu={userMenu} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar
                  size="small"
                  src={currentUser?.avatar_url || undefined}
                  icon={!currentUser?.avatar_url ? <UserOutlined /> : undefined}
                  style={{ background: 'var(--color-primary)' }}
                />
                <Text>{currentUser?.username}</Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>

      {/* 用户设置弹窗 */}
      <Modal
        title="用户设置"
        open={profileOpen}
        onOk={handleProfileSave}
        onCancel={() => setProfileOpen(false)}
        okText="保存"
        cancelText="取消"
        width={480}
        destroyOnHidden
      >
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <Avatar
            size={80}
            src={currentUser?.avatar_url || undefined}
            icon={!currentUser?.avatar_url ? <UserOutlined /> : undefined}
            style={{ background: 'var(--color-primary)' }}
          />
          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
            {currentUser?.username} · {currentUser?.role?.role_name || '-'}
          </div>
          <Button
            type="link"
            size="small"
            icon={<SkinOutlined />}
            onClick={() => setAvatarOpen(true)}
          >
            更换头像
          </Button>
        </div>
        <Form form={profileForm} layout="vertical" className="compact-form" preserve={false}>
          <Form.Item label="真实姓名" name="real_name" rules={[{ required: true, message: '请输入真实姓名' }]}>
            <Input placeholder="请输入真实姓名" />
          </Form.Item>
          <Form.Item label="联系手机" name="phone">
            <Input placeholder="请输入手机号" />
          </Form.Item>
          <Form.Item label="邮箱地址" name="email">
            <Input placeholder="请输入邮箱地址" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 头像选择弹窗 */}
      <Modal
        title="更换头像"
        open={avatarOpen}
        onCancel={() => setAvatarOpen(false)}
        footer={null}
        width={520}
        destroyOnHidden
      >
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text strong>选择预设头像</Text>
          <Upload
            accept="image/*"
            showUploadList={false}
            beforeUpload={handleAvatarUpload}
            disabled={avatarUploading}
          >
            <Button icon={<UserOutlined />} loading={avatarUploading}>
              上传自定义头像
            </Button>
          </Upload>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, maxHeight: 360, overflow: 'auto' }}>
          {presetAvatars.map((url) => {
            const active = currentUser?.avatar_url === url
            return (
              <div
                key={url}
                onClick={() => handleSelectPreset(url)}
                style={{
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 8,
                  border: active ? '2px solid var(--color-primary)' : '2px solid transparent',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                }}
                title="点击设为头像"
              >
                <Avatar size={56} src={url} />
              </div>
            )
          })}
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
          共 {presetAvatars.length} 个预设头像，支持上传自定义头像（不超过 2MB）
        </div>
      </Modal>

      {/* 修改密码弹窗 */}
      <Modal
        title="修改密码"
        open={pwdOpen}
        onOk={handlePwdSave}
        onCancel={() => setPwdOpen(false)}
        okText="确认修改"
        cancelText="取消"
        width={420}
        destroyOnHidden
      >
        <Form form={pwdForm} layout="vertical" className="compact-form" preserve={false}>
          <Form.Item label="原密码" name="old_password" rules={[{ required: true, message: '请输入原密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="请输入原密码" />
          </Form.Item>
          <Form.Item label="新密码" name="new_password" rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '密码至少6位' }]}>
            <Input.Password prefix={<KeyOutlined />} placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item label="确认新密码" name="confirm_password" rules={[{ required: true, message: '请确认新密码' }]}>
            <Input.Password prefix={<KeyOutlined />} placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  )
}
