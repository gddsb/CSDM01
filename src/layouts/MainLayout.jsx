import { useState, useEffect } from 'react'
import { Layout, Menu, Dropdown, Avatar, Space, Typography, Badge, Button, Modal, Form, Input, message } from 'antd'
import {
  DashboardOutlined, TeamOutlined, DatabaseOutlined, SettingOutlined,
  ProfileOutlined, DeploymentUnitOutlined, SafetyCertificateOutlined,
  ExperimentOutlined, ToolOutlined, BarChartOutlined, FileTextOutlined,
  LogoutOutlined, UserOutlined, BellOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  PieChartOutlined, FileSearchOutlined, FundProjectionScreenOutlined,
  ControlOutlined, DesktopOutlined, LineChartOutlined, CalendarOutlined,
  RiseOutlined, AlertOutlined, ContainerOutlined,
  LockOutlined, KeyOutlined
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { themeList } from '../themes'
import api from '../utils/api'
import logoSquare from '../assets/logo-square.png'

const { Sider, Header, Content } = Layout
const { Text } = Typography

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '工作台' },
  {
    key: 'system', icon: <SettingOutlined />, label: '系统管理',
    children: [
      { key: '/system/users', icon: <TeamOutlined />, label: '用户管理' },
      { key: '/system/roles', icon: <SafetyCertificateOutlined />, label: '角色权限' },
      { key: '/system/dictionary', icon: <DatabaseOutlined />, label: '数据库字典' },
      { key: '/system/config', icon: <ControlOutlined />, label: '系统配置' },
      { key: '/system/logs', icon: <FileTextOutlined />, label: '操作日志' },
    ]
  },
  {
    key: 'basic', icon: <ProfileOutlined />, label: '基础数据',
    children: [
      { key: '/basic/materials', icon: <ProfileOutlined />, label: '料品档案' },
      { key: '/basic/lines', icon: <DeploymentUnitOutlined />, label: '产线管理' },
      { key: '/basic/processes', icon: <DeploymentUnitOutlined />, label: '工序管理' },
      { key: '/basic/defects', icon: <AlertOutlined />, label: '制程不良分类' },
    ]
  },
  {
    key: 'production', icon: <ToolOutlined />, label: '生产管理',
    children: [
      { key: '/production/orders', icon: <FileTextOutlined />, label: '生产订单' },
      { key: '/production/workorders', icon: <ToolOutlined />, label: '工单列表' },
      { key: '/production/reporting', icon: <ProfileOutlined />, label: '生产报工' },
      { key: '/production/reporting-by-order', icon: <ProfileOutlined />, label: '生产报工(工单)' },
      { key: '/production/manpower', icon: <TeamOutlined />, label: '人员记录' },
      { key: '/production/exceptions', icon: <BellOutlined />, label: '异常记录' },
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
    key: 'bigscreen', icon: <DesktopOutlined />, label: '数据大屏',
    children: [
      { key: '/bigscreen/production', icon: <BarChartOutlined />, label: '生产实时看板' },
      { key: '/bigscreen/quality', icon: <ExperimentOutlined />, label: '质量分析看板' },
      { key: '/bigscreen/management', icon: <PieChartOutlined />, label: '管理驾驶舱' },
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
]

export default function MainLayout() {
  const { currentUser, logout, updateUser, themeKey, changeTheme } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [pwdOpen, setPwdOpen] = useState(false)
  const [profileForm] = Form.useForm()
  const [pwdForm] = Form.useForm()
  const [systemConfig, setSystemConfig] = useState({ system_name: '', company_name: '' })

  // 获取系统配置
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const res = await api.get('/system/config')
        if (cancelled) return
        // 后端可能返回 { data: {...} } 或直接对象
        const cfg = res.data || res
        if (cfg && typeof cfg === 'object') {
          setSystemConfig({
            system_name: cfg.system_name || '',
            company_name: cfg.company_name || '',
          })
        }
      } catch (err) {
        // 静默失败，保留默认空值
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  const systemName = systemConfig.system_name || '奶粉罐生产系统'
  const companyName = systemConfig.company_name || ''

  const getOpenKeys = () => {
    const path = location.pathname
    for (const item of menuItems) {
      if (item.children) {
        for (const child of item.children) {
          if (child.key === path) return [item.key]
          if (child.children) {
            for (const grandchild of child.children) {
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
    for (const item of menuItems) {
      if (item.key === path) return [path]
      if (item.children) {
        for (const child of item.children) {
          if (child.key === path) return [child.key]
          if (child.children) {
            for (const grandchild of child.children) {
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
    updateUser({
      real_name: values.real_name,
      phone: values.phone,
      email: values.email,
    })
    message.success('个人信息已更新')
    setProfileOpen(false)
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

  const userMenu = {
    items: [
      { key: 'info', label: `${currentUser?.real_name} (${currentUser?.role_name})`, disabled: true },
      { key: 'dept', label: `部门：${currentUser?.department}`, disabled: true },
      { type: 'divider' },
      { key: 'profile', label: '用户设置', icon: <UserOutlined /> },
      { key: 'password', label: '修改密码', icon: <KeyOutlined /> },
      { type: 'divider' },
      { key: 'logout', label: '退出登录', icon: <LogoutOutlined />, danger: true },
    ],
    onClick: ({ key }) => {
      if (key === 'logout') logout()
      if (key === 'profile') openProfile()
      if (key === 'password') { pwdForm.resetFields(); setPwdOpen(true) }
    }
  }

  return (
    <Layout className="app-layout">
      <Sider
        className="app-sider"
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={220}
        style={{ background: 'var(--nav-bg)' }}
      >
        <div className="logo" style={{ color: 'var(--nav-text)' }}>
          <img src={logoSquare} alt="logo" className="logo-img" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
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
            <div className="theme-switcher">
              {themeList.map(t => (
                <div
                  key={t.key}
                  className={`theme-dot ${themeKey === t.key ? 'active' : ''}`}
                  style={{ background: t.colors['--color-primary'] }}
                  onClick={() => changeTheme(t.key)}
                  title={t.name}
                >
                  {t.icon}
                </div>
              ))}
            </div>
            <Dropdown menu={userMenu} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar size="small" icon={<UserOutlined />} style={{ background: 'var(--color-primary)' }} />
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
          <Avatar size={64} icon={<UserOutlined />} style={{ background: 'var(--color-primary)' }} />
          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
            {currentUser?.username} · {currentUser?.role_name}
          </div>
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
