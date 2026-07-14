import { createContext, useContext, useState, useEffect, useRef } from 'react'
import api from '../utils/api'
import { applyTheme } from '../themes'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [themeKey, setThemeKey] = useState('pureMilk')
  const [initialized, setInitialized] = useState(false)
  const [systemConfig, setSystemConfig] = useState({ system_name: '', company_name: '' })
  const [messageApi, setMessageApiState] = useState(null)
  const [modalApi, setModalApiState] = useState(null)
  const [notificationApi, setNotificationApiState] = useState(null)

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

  const login = async (username, password) => {
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
      return { success: false, message: err.message || '登录失败' }
    }
  }

  const logout = () => {
    setCurrentUser(null)
    localStorage.removeItem('mes_token')
    localStorage.removeItem('mes_user')
  }

  const updateUser = (updates) => {
    const updated = { ...currentUser, ...updates }
    setCurrentUser(updated)
    localStorage.setItem('mes_user', JSON.stringify(updated))
  }

  const changeTheme = (key) => {
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
    } catch (err) {
      // 静默失败
    }
  }

  const updateSystemConfig = (updates) => {
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

  const setMessageApi = (api) => { setMessageApiState(api) }
  const setModalApi = (api) => { setModalApiState(api) }
  const setNotificationApi = (api) => { setNotificationApiState(api) }

  return (
    <AppContext.Provider value={{ currentUser, login, logout, updateUser, themeKey, changeTheme, cycleTheme, initialized, systemConfig, loadSystemConfig, updateSystemConfig, messageApi, modalApi, notificationApi, setMessageApi, setModalApi, setNotificationApi }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
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
