import axios, { AxiosResponse, AxiosInstance } from 'axios'

const STATUS_TEXT_TO_NUM: Record<string, number> = {
  '开立': 0, '下发': 1, '开工': 2, '完工': 3, '关闭': 4,
  '启用': 1, '禁用': 0, '停用': 0,
  '运行': 1, '维修': 2,
  '运行中': 1, '停机': 0,
}

export interface ApiResponse<T = any> {
  code: number
  success: boolean
  data?: T
  message?: string
  total?: number
  [key: string]: any
}

function convertStatusParams(params: Record<string, unknown>): Record<string, unknown> {
  // 注意：状态字段的「中文 ↔ 数字」转换必须放到各后端 controller 内部处理，
  // 不同模块 status 存储格式不一致（生产订单存数字，检验标准存中文），
  // 在请求层统一转换会误杀。这里只做数组→逗号分隔字符串的标准化，保证后端收到一致格式。
  if (!params) return params
  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(params)) {
    if (key === 'status') {
      if (Array.isArray(val)) {
        result[key] = val.map(v => String(v)).join(',')
      } else if (typeof val === 'string') {
        result[key] = val
      } else {
        result[key] = val
      }
    } else {
      result[key] = val
    }
  }
  return result
}

function doubleEncodeParams(params: Record<string, unknown>): Record<string, unknown> {
  if (!params) return params
  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(params)) {
    if (typeof val === 'string' && /[\u4e00-\u9fa5]/.test(val)) {
      result[key] = encodeURIComponent(val)
    } else if (Array.isArray(val)) {
      result[key] = val.map((v: string | number | boolean) => typeof v === 'string' && /[\u4e00-\u9fa5]/.test(v) ? encodeURIComponent(v) : v)
    } else {
      result[key] = val
    }
  }
  return result
}

// Capacitor 原生 App 中 WebView origin 是 https://localhost，
// 相对路径 /api 会打到 localhost 而非生产服务器，需要用绝对 URL。
const API_BASE_URL = (() => {
  // 检测是否运行在 Capacitor 原生环境中
  const cap = (window as any).Capacitor
  if (cap?.isNativePlatform?.() === true || cap?.Platforms?.isNative === true) {
    return 'http://43.138.218.55/api'
  }
  // 浏览器环境：用相对路径，由 Nginx 反代到后端
  return '/api'
})()

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
})

export interface Api {
  get<T = any>(url: string, config?: Parameters<AxiosInstance['get']>[1]): Promise<ApiResponse<T>>
  post<T = any>(url: string, data?: any, config?: Parameters<AxiosInstance['post']>[2]): Promise<ApiResponse<T>>
  put<T = any>(url: string, data?: any, config?: Parameters<AxiosInstance['put']>[2]): Promise<ApiResponse<T>>
  delete<T = any>(url: string, config?: Parameters<AxiosInstance['delete']>[1]): Promise<ApiResponse<T>>
  patch<T = any>(url: string, data?: any, config?: Parameters<AxiosInstance['patch']>[2]): Promise<ApiResponse<T>>
  request<T = any>(config: any): Promise<ApiResponse<T>>
  head<T = any>(url: string, config?: any): Promise<ApiResponse<T>>
  options<T = any>(url: string, config?: any): Promise<ApiResponse<T>>
  defaults: AxiosInstance['defaults']
  interceptors: AxiosInstance['interceptors']
}

const api = {
  get: async <T = any>(url: string, config?: Parameters<AxiosInstance['get']>[1]): Promise<ApiResponse<T>> => {
    const response = await axiosInstance.get<ApiResponse<T>>(url, config)
    return response.data
  },
  post: async <T = any>(url: string, data?: any, config?: Parameters<AxiosInstance['post']>[2]): Promise<ApiResponse<T>> => {
    const response = await axiosInstance.post<ApiResponse<T>>(url, data, config)
    return response.data
  },
  put: async <T = any>(url: string, data?: any, config?: Parameters<AxiosInstance['put']>[2]): Promise<ApiResponse<T>> => {
    const response = await axiosInstance.put<ApiResponse<T>>(url, data, config)
    return response.data
  },
  delete: async <T = any>(url: string, config?: Parameters<AxiosInstance['delete']>[1]): Promise<ApiResponse<T>> => {
    const response = await axiosInstance.delete<ApiResponse<T>>(url, config)
    return response.data
  },
  patch: async <T = any>(url: string, data?: any, config?: Parameters<AxiosInstance['patch']>[2]): Promise<ApiResponse<T>> => {
    const response = await axiosInstance.patch<ApiResponse<T>>(url, data, config)
    return response.data
  },
  request: async <T = any>(config: any): Promise<ApiResponse<T>> => {
    const response = await axiosInstance.request<ApiResponse<T>>(config)
    return response.data
  },
  head: async <T = any>(url: string, config?: any): Promise<ApiResponse<T>> => {
    const response = await axiosInstance.head<ApiResponse<T>>(url, config)
    return response.data as unknown as ApiResponse<T>
  },
  options: async <T = any>(url: string, config?: any): Promise<ApiResponse<T>> => {
    const response = await axiosInstance.options<ApiResponse<T>>(url, config)
    return response.data as unknown as ApiResponse<T>
  },
  defaults: axiosInstance.defaults,
  interceptors: axiosInstance.interceptors,
} as Api

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('mes_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  if (config.params) {
    config.params = convertStatusParams(config.params as Record<string, unknown>)
  }
  return config
})

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('mes_token')
      localStorage.removeItem('mes_user')
      window.location.href = '/login'
      return Promise.reject(new Error('登录已过期，请重新登录'))
    }
    const isTimeout = error.code === 'ECONNABORTED' || /timeout/i.test(error.message || '')
    if (isTimeout) {
      return Promise.reject(new Error('请求超时（网络较慢或数据量较大），请稍后重试或刷新页面'))
    }
    const respData = error.response?.data || {}
    const msg = respData.message || error.message || '请求失败'
    const err: any = new Error(msg)
    // 将后端返回的额外字段（如 need_confirm）附加到错误对象
    if (respData && typeof respData === 'object') {
      Object.keys(respData).forEach(k => {
        if (!['message', 'code', 'success'].includes(k)) {
          err[k] = respData[k]
        }
      })
    }
    return Promise.reject(err)
  }
)

// 归一化列表数据：支持 data: [...] 和 data: { list: [...] } 两种格式
export function extractList(data: any): any[] {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.list)) return data.list
  return []
}

export default api
