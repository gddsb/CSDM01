import { createContext, useContext, useState, useEffect } from 'react'
import api from '../utils/api'
import { applyTheme } from '../themes'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [themeKey, setThemeKey] = useState('pureMilk')
  const [initialized, setInitialized] = useState(false)

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
        return { success: true }
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

  return (
    <AppContext.Provider value={{ currentUser, login, logout, updateUser, themeKey, changeTheme, initialized }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
