import { createContext, useContext, useState, useEffect } from 'react'
import { users, roles } from '../mock/data'
import { applyTheme } from '../themes'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [themeKey, setThemeKey] = useState('pureMilk')
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    const savedUser = localStorage.getItem('mes_user')
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser))
    }
    const savedTheme = localStorage.getItem('mes_theme') || 'pureMilk'
    setThemeKey(savedTheme)
    applyTheme(savedTheme)
    setInitialized(true)
  }, [])

  const login = (username, password) => {
    const user = users.find(u => u.username === username)
    if (!user) return { success: false, message: '用户名不存在' }
    if (password !== '123456') return { success: false, message: '密码错误' }
    if (user.status !== 1) return { success: false, message: '账号已禁用' }
    const userWithRole = { ...user, role: roles.find(r => r.role_id === user.role_id) }
    setCurrentUser(userWithRole)
    localStorage.setItem('mes_user', JSON.stringify(userWithRole))
    return { success: true }
  }

  const logout = () => {
    setCurrentUser(null)
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
