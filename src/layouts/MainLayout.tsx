import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Layout, Menu, Dropdown, Avatar, Space, Typography, Badge, Button, Modal, Form, Input, Tooltip, Upload, Spin } from 'antd'
import type { MenuProps } from 'antd'
import {
  DashboardOutlined, FundProjectionScreenOutlined,
  UserOutlined, KeyOutlined, LogoutOutlined,
  MenuUnfoldOutlined, MenuFoldOutlined, BellOutlined,
  SkinOutlined, LockOutlined,
} from '@ant-design/icons'
import * as AntIcons from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useApp, useMessage, User } from '../contexts/AppContext'
import { themeList, themes } from '../themes'
import { useTodoStats } from '../hooks/useTodoStats'
import api from '../utils/api'

// 20 个预设头像（本地 SVG，离线可用）
const presetAvatars = [
  '/assets/avatars/avatar-01.svg',
  '/assets/avatars/avatar-02.svg',
  '/assets/avatars/avatar-03.svg',
  '/assets/avatars/avatar-04.svg',
  '/assets/avatars/avatar-05.svg',
  '/assets/avatars/avatar-06.svg',
  '/assets/avatars/avatar-07.svg',
  '/assets/avatars/avatar-08.svg',
  '/assets/avatars/avatar-09.svg',
  '/assets/avatars/avatar-10.svg',
  '/assets/avatars/avatar-11.svg',
  '/assets/avatars/avatar-12.svg',
  '/assets/avatars/avatar-13.svg',
  '/assets/avatars/avatar-14.svg',
  '/assets/avatars/avatar-15.svg',
  '/assets/avatars/avatar-16.svg',
  '/assets/avatars/avatar-17.svg',
  '/assets/avatars/avatar-18.svg',
  '/assets/avatars/avatar-19.svg',
  '/assets/avatars/avatar-20.svg',
]

const { Sider, Header, Content } = Layout
const { Text } = Typography

// 动态图标解析：从 @ant-design/icons 命名空间按名称查找组件
// 支持后端配置任意图标名（如 FileTextOutlined、SettingOutlined 等），无需前端维护映射
function resolveIcon(name?: string): React.ReactNode {
  if (!name) return undefined
  const Comp = (AntIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name]
  return Comp ? <Comp /> : undefined
}

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

  // 动态菜单：严格从数据库读取（通过 /system/permissions/menu 接口），带 localStorage 缓存
  const MENU_CACHE_KEY = 'daman_mes_menu_cache_v1'
  const MENU_CACHE_TTL = 5 * 60 * 1000 // 5 分钟本地缓存
  const [dynamicMenu, setDynamicMenu] = useState<any[]>(() => {
    // 初始化时优先读本地缓存，避免首次进入白屏/转圈
    try {
      const raw = localStorage.getItem(MENU_CACHE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && Array.isArray(parsed.tree) && parsed.expireAt > Date.now()) {
          return parsed.tree
        }
      }
    } catch { /* ignore */ }
    return []
  })
  const hasInitCacheRef = useRef<boolean>((() => {
    try {
      const raw = localStorage.getItem(MENU_CACHE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        return !!(parsed && Array.isArray(parsed.tree) && parsed.expireAt > Date.now())
      }
    } catch { /* ignore */ }
    return false
  })())
  const [menuLoading, setMenuLoading] = useState<boolean>(!hasInitCacheRef.current)
  const [menuError, setMenuError] = useState<string | null>(null)

  // 当前主题对象（用于显示图标和提示）
  const currentTheme = themes[themeKey] || themes.pureMilk

  // 待办统计（通知徽章）
  const { stats } = useTodoStats()

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

  // 获取动态菜单（按当前用户角色权限）—— 优先本地缓存，后台静默刷新
  const fetchMenu = useCallback(async (forceLoading: boolean = false) => {
    if (forceLoading) setMenuLoading(true)
    setMenuError(null)
    try {
      const res = await api.get('/system/permissions/menu')
      const tree = res.data || []
      if (Array.isArray(tree)) {
        setDynamicMenu(tree)
        // 写入 localStorage 缓存
        try {
          localStorage.setItem(MENU_CACHE_KEY, JSON.stringify({
            tree,
            expireAt: Date.now() + MENU_CACHE_TTL,
          }))
        } catch { /* ignore: 隐私模式等可能写入失败 */ }
      } else {
        setDynamicMenu([])
      }
    } catch (err: any) {
      console.error('[MainLayout] 加载菜单失败:', err?.message)
      // 已有缓存数据时不弹错误，继续用旧缓存
      const hasCache = (() => {
        try {
          const raw = localStorage.getItem(MENU_CACHE_KEY)
          if (raw) {
            const parsed = JSON.parse(raw)
            return !!(parsed && Array.isArray(parsed.tree) && parsed.tree.length > 0)
          }
        } catch { /* ignore */ }
        return false
      })()
      if (!hasCache) {
        setMenuError(err?.message || '菜单加载失败')
      }
    } finally {
      setMenuLoading(false)
    }
  }, [MENU_CACHE_KEY, MENU_CACHE_TTL])

  useEffect(() => {
    // 首次加载：有缓存则静默刷新，无缓存才显示 loading
    fetchMenu(!hasInitCacheRef.current)
    // 监听菜单更新事件（菜单管理页面修改后触发）—— 强制刷新 + 清缓存
    const handleMenuUpdate = () => {
      try { localStorage.removeItem(MENU_CACHE_KEY) } catch { /* ignore */ }
      fetchMenu(true)
    }
    window.addEventListener('menu-updated', handleMenuUpdate)
    return () => {
      window.removeEventListener('menu-updated', handleMenuUpdate)
    }
  }, [fetchMenu, MENU_CACHE_KEY])

  const systemName = systemConfig.system_name || '长沙大满MES'
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

  // useMemo: 菜单项仅在 dynamicMenu 变化时重算
  const builtMenuItems = useMemo<MenuProps['items']>(() => {
    // 需要过滤掉的菜单名称关键字
    const EXCLUDED_LABELS = ['移动端模拟器']
    // 图标默认映射（菜单名 → 图标组件名）
    const DEFAULT_ICON_MAP: Record<string, string> = {
      '系统日志': 'FileTextOutlined',
    }

    const buildMenuItems = (nodes: MenuNode[]): MenuProps['items'] => {
      return nodes
        .filter(n => n.type === 'menu' || n.type === 'page')
        .filter(n => !EXCLUDED_LABELS.some(keyword => n.perm_name?.includes(keyword)))
        .map(n => {
          // 优先使用后端配置的图标，没有则检查是否有默认图标映射
          let iconName = n.icon
          if (!iconName && n.perm_name && DEFAULT_ICON_MAP[n.perm_name]) {
            iconName = DEFAULT_ICON_MAP[n.perm_name]
          }
          const item: MenuProps['items'][number] = {
            key: n.path || n.perm_code || '',
            icon: resolveIcon(iconName),
            label: n.perm_name,
          } as MenuProps['items'][number]
          if (n.children && n.children.length > 0) {
            (item as { children?: MenuProps['items'] }).children = buildMenuItems(n.children)
          }
          return item
        })
    }
    return buildMenuItems(dynamicMenu)
  }, [dynamicMenu])

  // useMemo: 注入展示看板 + 工作台入口
  const menuItems: MenuProps['items'] = useMemo(() => {
    const items: MenuProps['items'] = [
      { key: '/dashboard', icon: <DashboardOutlined />, label: '工作台' },
      ...builtMenuItems,
    ]
    const displayItem: MenuProps['items'][number] = {
      key: '/bigscreen/display',
      icon: <FundProjectionScreenOutlined />,
      label: '展示看板',
    }
    let found = false
    const result = items.map(item => {
      if (!item || typeof item !== 'object') return item
      const label = (item as { label?: React.ReactNode }).label
      if (typeof label === 'string' && (label === '数据大屏' || label.includes('大屏'))) {
        found = true
        const cur = item as { children?: MenuProps['items'] }
        const children = cur.children ? [...cur.children] : []
        if (!children.some(c => c && typeof c === 'object' && (c as { key?: string }).key === '/bigscreen/display')) {
          children.push(displayItem)
        }
        return { ...item, children }
      }
      return item
    })
    if (!found) {
      result.push({
        key: '/bigscreen',
        icon: <FundProjectionScreenOutlined />,
        label: '数据大屏',
        children: [displayItem],
      })
    }
    return result
  }, [builtMenuItems])

  // useMemo: openKeys 只随 location.pathname + menuItems 变化
  const openKeys = useMemo<string[]>(() => {
    const path = location.pathname
    for (const item of menuItems) {
      if ('children' in item && item.children) {
        for (const child of item.children) {
          if (!('key' in child)) continue
          if (child.key === path) return [item.key as string]
          if ('children' in child && child.children) {
            for (const grandchild of child.children) {
              if (!('key' in grandchild)) continue
              if (path.startsWith(grandchild.key as string)) return [item.key as string, child.key as string]
            }
          }
          if (typeof child.key === 'string' && child.key.startsWith('/') && path.startsWith(child.key)) return [item.key as string]
        }
      }
    }
    return []
  }, [location.pathname, menuItems])

  // useMemo: selectedKeys 只随 location.pathname + menuItems 变化
  const selectedKeys = useMemo<string[]>(() => {
    const path = location.pathname
    for (const item of menuItems) {
      if (!('key' in item)) continue
      if (item.key === path) return [path]
      if ('children' in item && item.children) {
        for (const child of item.children) {
          if (!('key' in child)) continue
          if (child.key === path) return [child.key as string]
          if ('children' in child && child.children) {
            for (const grandchild of child.children) {
              if (!('key' in grandchild)) continue
              if (path.startsWith(grandchild.key as string)) return [grandchild.key as string]
            }
          }
          if (typeof child.key === 'string' && child.key.startsWith('/') && path.startsWith(child.key)) return [child.key as string]
        }
      }
    }
    return [path]
  }, [location.pathname, menuItems])

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
    try {
      const res = await api.post('/auth/change-password', {
        old_password: values.old_password,
        new_password: values.new_password,
      })
      if (res.success) {
        message.success('密码修改成功，请重新登录')
        setPwdOpen(false)
        pwdForm.resetFields()
        setTimeout(() => logout(), 1000)
      } else {
        message.error(res.message || '密码修改失败')
      }
    } catch (err: any) {
      message.error(err?.message || '密码修改失败')
    }
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
    },
  }

  const siderContent = (
    <>
      <div className="logo" style={{ color: 'var(--nav-text)' }}>
        <div className="daman-logo">
          <span className="daman-en">daman</span>
          <span className="daman-cn">大满</span>
        </div>
        {!collapsed && <span>{systemName}</span>}
      </div>
      {menuLoading ? (
        <div style={{ textAlign: 'center', paddingTop: 60 }}>
          <Spin tip="加载菜单中..." />
        </div>
      ) : menuError ? (
        <div style={{ textAlign: 'center', padding: 20, fontSize: 12, color: '#f5222d' }}>
          <div>菜单加载失败</div>
          <div style={{ marginTop: 8, color: 'var(--nav-text)', opacity: 0.7 }}>{menuError}</div>
          <Button size="small" type="link" onClick={() => fetchMenu(true)} style={{ marginTop: 12, padding: 0 }}>
            点击重试
          </Button>
        </div>
      ) : (
        <Menu
          mode="inline"
          selectedKeys={selectedKeys}
          defaultOpenKeys={openKeys}
          items={menuItems}
          onClick={handleMenuClick}
          style={{
            background: 'transparent',
            color: 'var(--nav-text)',
            borderRight: 'none',
          }}
        />
      )}
    </>
  )

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
        {siderContent}
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
            <Badge count={stats.total} size="small" offset={[2, 2]}>
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
