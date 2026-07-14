import { createContext, useContext, useState, useEffect } from 'react'
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
}

interface SystemConfig {
  system_name: string
  company_name: string
}

interface AppContextType {
  currentUser: User | null
  login: (username: string, password: string) => Promise<{ success: boolean; isViewer?: boolean; message?: string }>
  logout: () => void
  updateUser: (updates: Partial<User>) => void
  themeKey: string
  changeTheme: (key: string) => void
  cycleTheme: () => string
  initialized: boolean
  systemConfig: SystemConfig
  loadSystemConfig: () => Promise<void>
  updateSystemConfig: (updates: Partial<SystemConfig>) => void
  messageApi: unknown
  modalApi: unknown
  notificationApi: unknown
  setMessageApi: (api: unknown) => void
  setModalApi: (api: unknown) => void
  setNotificationApi: (api: unknown) => void
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [themeKey, setThemeKey] = useState('pureMilk')
  const [initialized, setInitialized] = useState(false)
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({ system_name: '', company_name: '' })
  const [messageApi, setMessageApiState] = useState<unknown>(null)
  const [modalApi, setModalApiState] = useState<unknown>(null)
  const [notificationApi, setNotificationApiState] = useState<unknown>(null)

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
        const isViewer = user.role?.role_name === '看板查看者' || user.role?.role_code === 'viewer'
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

  const loadSystemConfig = async () => {
    try {
      const res = await api.get('/system/config')
      const cfg = res.data || res
      if (cfg && typeof cfg === 'object') {
        setSystemConfig({
          system_name: cfg.system_name || '',
          company_name: cfg.company_name || '',
        })
      }
    } catch {
    }
  }

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

  const setMessageApi = (api: unknown) => { setMessageApiState(api) }
  const setModalApi = (api: unknown) => { setModalApiState(api) }
  const setNotificationApi = (api: unknown) => { setNotificationApiState(api) }

  return (
    <AppContext.Provider value={{ currentUser, login, logout, updateUser, themeKey, changeTheme, cycleTheme, initialized, systemConfig, loadSystemConfig, updateSystemConfig, messageApi, modalApi, notificationApi, setMessageApi, setModalApi, setNotificationApi }}>
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
