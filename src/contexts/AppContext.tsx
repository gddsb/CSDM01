import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { MessageInstance } from 'antd/es/message/interface'
import type { ModalStaticFunctions } from 'antd/es/modal/confirm'
import type { NotificationInstance } from 'antd/es/notification/interface'
import api from '../utils/api'
import { applyTheme } from '../themes'

export interface User {
  user_id: number
  username: string
  real_name: string
  avatar_url?: string
  phone?: string
  email?: string
  department?: string
  role?: { role_name: string; role_code: string }
  perm_codes?: string[]
  position?: string
  employee_no?: string
}

interface SystemConfig {
  system_name: string
  company_name: string
  system_version?: string
}

interface AppContextType {
  currentUser: User | null
  login: (username: string, password: string) => Promise<{ success: boolean; isViewer?: boolean; message?: string }>
  logout: () => void
  updateUser: (updates: Partial<User>) => void
  hasPermission: (permCode: string) => boolean
  themeKey: string
  changeTheme: (key: string) => void
  cycleTheme: () => string
  initialized: boolean
  systemConfig: SystemConfig
  loadSystemConfig: () => Promise<void>
  updateSystemConfig: (updates: Partial<SystemConfig>) => void
  messageApi: MessageInstance | null
  modalApi: Omit<ModalStaticFunctions, 'warn'> | null
  notificationApi: NotificationInstance | null
  setMessageApi: (api: MessageInstance) => void
  setModalApi: (api: Omit<ModalStaticFunctions, 'warn'>) => void
  setNotificationApi: (api: NotificationInstance) => void
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [themeKey, setThemeKey] = useState('pureMilk')
  const [initialized, setInitialized] = useState(false)
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({ system_name: '', company_name: '' })
  const [messageApi, setMessageApiState] = useState<MessageInstance | null>(null)
  const [modalApi, setModalApiState] = useState<Omit<ModalStaticFunctions, 'warn'> | null>(null)
  const [notificationApi, setNotificationApiState] = useState<NotificationInstance | null>(null)

  useEffect(() => {
    const savedUser = localStorage.getItem('mes_user')
    const savedToken = localStorage.getItem('mes_token')
    if (savedUser && savedToken) {
      setCurrentUser(JSON.parse(savedUser))
    }
    const savedTheme = localStorage.getItem('mes_theme') || 'pureMilk'
    setThemeKey(savedTheme)
    applyTheme(savedTheme)
    setInitialized(true)
  }, [])

  const login = async (username: string, password: string) => {
    try {
      const res = await api.post('/auth/login', { username, password })
      if (res.success) {
        const user = res.data.user
        const token = res.data.token
        localStorage.setItem('mes_token', token)
        localStorage.setItem('mes_user', JSON.stringify(user))
        setCurrentUser(user)
        // 看板查看者判定：无 device/production/quality/basic/auto/system 六大模块入口权限
        const codes: string[] = user.perm_codes || []
        const hasAnyModule = ['device', 'production', 'quality', 'basic', 'auto', 'system'].some((m: string) => codes.includes(m))
        const isViewer = !hasAnyModule
        return { success: true, isViewer }
      }
      return { success: false, message: res.message || '登录失败' }
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : '登录失败' }
    }
  }

  const logout = () => {
    setCurrentUser(null)
    localStorage.removeItem('mes_token')
    localStorage.removeItem('mes_user')
    // 登录时勾选了"记住我"则保留账号密码，否则也清掉
    const rememberMe = localStorage.getItem('mes_remember') === 'true'
    if (!rememberMe) {
      localStorage.removeItem('mes_remember_username')
      localStorage.removeItem('mes_remember_password')
    }
  }

  const updateUser = (updates: Partial<User>) => {
    const updated = { ...currentUser, ...updates }
    setCurrentUser(updated)
    localStorage.setItem('mes_user', JSON.stringify(updated))
  }

  const changeTheme = (key: string) => {
    setThemeKey(key)
    applyTheme(key)
    localStorage.setItem('mes_theme', key)
  }

  const loadSystemConfig = useCallback(async () => {
    try {
      const res = await api.get('/system/config')
      const cfg = res.data || res
      if (cfg && typeof cfg === 'object') {
        setSystemConfig({
          system_name: cfg.system_name || '',
          company_name: cfg.company_name || '',
          system_version: cfg.system_version || '',
        })
      }
    } catch {
    }
  }, [])

  const updateSystemConfig = (updates: Partial<SystemConfig>) => {
    setSystemConfig(prev => ({ ...prev, ...updates }))
  }

  const cycleTheme = (): string => {
    const order = ['pureMilk', 'darkFactory', 'blueSky', 'metal', 'greenOasis', 'warmAmber']
    const idx = order.indexOf(themeKey)
    const nextKey = order[(idx + 1) % order.length]
    changeTheme(nextKey)
    return nextKey
  }

  const setMessageApi = (api: MessageInstance) => { setMessageApiState(api) }
  const setModalApi = (api: Omit<ModalStaticFunctions, 'warn'>) => { setModalApiState(api) }
  const setNotificationApi = (api: NotificationInstance) => { setNotificationApiState(api) }

  const hasPermission = (permCode: string, platform?: 'pc' | 'mobile' | 'all'): boolean => {
    if (!currentUser) return false
    const permCodes: string[] = currentUser.perm_codes || []
    if (permCodes.includes('*')) return true

    // 候选码：按优先级 platform:permCode → all:permCode → 纯 permCode
    const candidates: string[] = []
    if (platform && platform !== 'all') {
      candidates.push(`${platform}:${permCode}`)
      candidates.push(`all:${permCode}`)
    } else if (platform === 'all') {
      candidates.push(`all:${permCode}`)
    }
    candidates.push(permCode)

    // 精确匹配
    for (const c of candidates) if (permCodes.includes(c)) return true

    // 子→父继承：codes 里的某个码如果比 required 更细，自动通过（例：有 device:fault:create → 有 device:fault 入口）
    for (const code of permCodes) {
      for (const c of candidates) {
        if (code.startsWith(c + ':')) return true
      }
    }

    return false
  }

  return (
    <AppContext.Provider value={{ currentUser, login, logout, updateUser, hasPermission, themeKey, changeTheme, cycleTheme, initialized, systemConfig, loadSystemConfig, updateSystemConfig, messageApi, modalApi, notificationApi, setMessageApi, setModalApi, setNotificationApi }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext)
  return ctx || {
    currentUser: null,
    login: async () => ({ success: false }),
    logout: () => {},
    updateUser: () => {},
    hasPermission: () => false,
    themeKey: 'pureMilk',
    changeTheme: () => {},
    cycleTheme: () => 'pureMilk',
    initialized: false,
    systemConfig: { system_name: '', company_name: '' },
    loadSystemConfig: async () => {},
    updateSystemConfig: () => {},
    messageApi: null,
    modalApi: null,
    notificationApi: null,
    setMessageApi: () => {},
    setModalApi: () => {},
    setNotificationApi: () => {},
  }
}

const noopMessage = {
  success: () => {},
  error: () => {},
  info: () => {},
  warning: () => {},
  warn: () => {},
  loading: () => {},
  open: () => {},
  config: () => {},
  destroy: () => {},
}

const noopModal = {
  info: () => {},
  success: () => {},
  error: () => {},
  warning: () => {},
  warn: () => {},
  confirm: () => {},
}

const noopNotification = {
  success: () => {},
  error: () => {},
  info: () => {},
  warning: () => {},
  warn: () => {},
  open: () => {},
  close: () => {},
  destroy: () => {},
}

export function useMessage() {
  const ctx = useContext(AppContext)
  return ctx?.messageApi || noopMessage
}

export function useModal() {
  const ctx = useContext(AppContext)
  return ctx?.modalApi || noopModal
}

export function useNotification() {
  const ctx = useContext(AppContext)
  return ctx?.notificationApi || noopNotification
}
