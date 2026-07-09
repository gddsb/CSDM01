import axios from 'axios'

const STATUS_TEXT_TO_NUM = {
  '开立': 0, '下发': 1, '开工': 1, '完工': 2, '完成': 2,
  '启用': 1, '禁用': 0, '停用': 0,
  '运行': 1, '维修': 2,
  '运行中': 1, '停机': 0,
}

function convertStatusParams(params) {
  if (!params) return params
  const result = {}
  for (const [key, val] of Object.entries(params)) {
    if (key === 'status') {
      if (Array.isArray(val)) {
        result[key] = val.map(s => {
          return STATUS_TEXT_TO_NUM[s] !== undefined ? STATUS_TEXT_TO_NUM[s] : s
        }).join(',')
      } else if (typeof val === 'string') {
        if (val.includes(',')) {
          result[key] = val.split(',').map(s => {
            const t = s.trim()
            return STATUS_TEXT_TO_NUM[t] !== undefined ? STATUS_TEXT_TO_NUM[t] : s
          }).join(',')
        } else {
          result[key] = STATUS_TEXT_TO_NUM[val] !== undefined ? STATUS_TEXT_TO_NUM[val] : val
        }
      } else {
        result[key] = val
      }
    } else {
      result[key] = val
    }
  }
  return result
}

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

// 请求拦截器：添加 token，中文 status 转数字（规避 Vite 代理中文 URL 参数异常）
api.interceptors.request.use(config => {
  const token = localStorage.getItem('mes_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  if (config.params) {
    config.params = convertStatusParams(config.params)
  }
  return config
})

// 响应拦截器：统一处理错误
api.interceptors.response.use(
  response => response.data,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('mes_token')
      localStorage.removeItem('mes_user')
      window.location.href = '/login'
      return Promise.reject(new Error('登录已过期，请重新登录'))
    }
    const msg = error.response?.data?.message || error.message || '请求失败'
    return Promise.reject(new Error(msg))
  }
)

export default api
