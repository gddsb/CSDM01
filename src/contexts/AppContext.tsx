import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import api from '../utils/api'
import { applyTheme } from '../themes'

interface CurrentUser {
  user_id?: string
  username?: string
  real_name?: string
  phone?: string
  email?: string
  department?: string
  avatar_url?: string
  role?: {
    role_name?: string
    role_code?: string
    [key: string]: any
  }
  [key: string]: any
}

interface SystemConfig {
  system_name: string
  company_name: string
}

interface LoginResult {
  success: boolean
  isViewer?: boolean
  message?: string
}

interface MessageApi {
  success: (...args: any[]) => void
  error: (...args: any[]) => void
  info: (...args: any[]) => void
  warning: (...args: any[]) => void
  warn: (...args: any[]) => void
  loading: (...args: any[]) => void
  open: (...args: any[]) => void
  config: (...args: any[]) => void
  destroy: (...args: any[]) => void
  [key: string]: any
}

interface ModalApi {
  info: (...args: any[]) => void
  success: (...args: any[]) => void
  error: (...args: any[]) => void
  warning: (...args: any[]) => void
  warn: (...args: any[]) => void
  confirm: (...args: any[]) => void
  [key: string]: any
}

interface NotificationApi {
  success: (...args: any[]) => void
  error: (...args: any[]) => void
  info: (...args: any[]) => void
  warning: (...args: any[]) => void
  warn: (...args: any[]) => void
  open: (...args: any[]) => void
  close: (...args: any[]) => void
  destroy: (...args: any[]) => void
  [key: string]: any
}

interface AppContextValue {
  currentUser: CurrentUser | null
  login: (username: string, password: string) => Promise<LoginResult>
  logout: () => void
  updateUser: (updates: any) => void
  themeKey: string
  changeTheme: (key: string) => void
  cycleTheme: () => string
  initialized: boolean
  systemConfig: SystemConfig
  loadSystemConfig: () => Promise<void>
  updateSystemConfig: (updates: any) => void
  messageApi: MessageApi | null
  modalApi: ModalApi | null
  notificationApi: NotificationApi | null
  setMessageApi: (api: any) => void
  setModalApi: (api: any) => void
  setNotificationApi: (api: any) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [themeKey, setThemeKey] = useState<string>('pureMilk')
  const [initialized, setInitialized] = useState<boolean>(false)
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({ system_name: '', company_name: '' })
  const [messageApi, setMessageApiState] = useState<MessageApi | null>(null)
  const [modalApi, setModalApiState] = useState<ModalApi | null>(null)
  const [notificationApi, setNotificationApiState] = useState<NotificationApi | null>(null)

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

  const login = async (username: string, password: string): Promise<LoginResult> => {
    try {
      const res: any = await api.post('/auth/login', { username, password })
      if (res.success) {
        const user = res.data.user
        const token = res.data.token
        localStorage.setItem('mes_token', token)
        localStorage.setItem('mes_user', JSON.stringify(user))
        setCurrentUser(user)
        const isViewer = user.role?.role_name === '看板查看者' || user.role?.role_code === 'viewer'
        return { success: true, isViewer }
      }
      return { success: false, message: res.message || '登录失败' }
    } catch (err: any) {
      return { success: false, message: err.message || '登录失败' }
    }
  }

  const logout = () => {
    setCurrentUser(null)
    localStorage.removeItem('mes_token')
    localStorage.removeItem('mes_user')
  }

  const updateUser = (updates: any) => {
    const updated = { ...currentUser, ...updates }
    setCurrentUser(updated)
    localStorage.setItem('mes_user', JSON.stringify(updated))
  }

  const changeTheme = (key: string) => {
    setThemeKey(key)
    applyTheme(key)
    localStorage.setItem('mes_theme', key)
  }

  const loadSystemConfig = async () => {
    try {
      const res: any = await api.get('/system/config')
      const cfg = res.data || res
      if (cfg && typeof cfg === 'object') {
        setSystemConfig({
          system_name: cfg.system_name || '',
          company_name: cfg.company_name || '',
        })
      }
    } catch (err) {
      // 静默失败
    }
  }

  const updateSystemConfig = (updates: any) => {
    setSystemConfig(prev => ({ ...prev, ...updates }))
  }

  // 切换到下一个主题（按主题顺序：纯净奶源→暗夜工厂→蓝天牧场→金属质感→自然绿洲→暖阳琥珀）
  const cycleTheme = () => {
    const order = ['pureMilk', 'darkFactory', 'blueSky', 'metal', 'greenOasis', 'warmAmber']
    const idx = order.indexOf(themeKey)
    const nextKey = order[(idx + 1) % order.length]
    changeTheme(nextKey)
    return nextKey
  }

  const setMessageApi = (api: any) => { setMessageApiState(api) }
  const setModalApi = (api: any) => { setModalApiState(api) }
  const setNotificationApi = (api: any) => { setNotificationApiState(api) }

  return (
    <AppContext.Provider value={{ currentUser, login, logout, updateUser, themeKey, changeTheme, cycleTheme, initialized, systemConfig, loadSystemConfig, updateSystemConfig, messageApi, modalApi, notificationApi, setMessageApi, setModalApi, setNotificationApi }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  return ctx as AppContextValue
}

const noopMessage: MessageApi = {
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

const noopModal: ModalApi = {
  info: () => {},
  success: () => {},
  error: () => {},
  warning: () => {},
  warn: () => {},
  confirm: () => {},
}

const noopNotification: NotificationApi = {
  success: () => {},
  error: () => {},
  info: () => {},
  warning: () => {},
  warn: () => {},
  open: () => {},
  close: () => {},
  destroy: () => {},
}

export function useMessage(): MessageApi {
  const ctx = useContext(AppContext)
  return ctx?.messageApi || noopMessage
}

export function useModal(): ModalApi {
  const ctx = useContext(AppContext)
  return ctx?.modalApi || noopModal
}

export function useNotification(): NotificationApi {
  const ctx = useContext(AppContext)
  return ctx?.notificationApi || noopNotification
}
