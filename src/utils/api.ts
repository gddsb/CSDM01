import axios, { AxiosResponse, AxiosInstance } from 'axios'

const STATUS_TEXT_TO_NUM: Record<string, number> = {
  '开立': 0, '下发': 1, '开工': 1, '完工': 2, '完成': 2,
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
}

function convertStatusParams(params: Record<string, unknown>): Record<string, unknown> {
  if (!params) return params
  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(params)) {
    if (key === 'status') {
      if (Array.isArray(val)) {
        result[key] = val.map((s: string) => {
          return STATUS_TEXT_TO_NUM[s] !== undefined ? STATUS_TEXT_TO_NUM[s] : s
        }).join(',')
      } else if (typeof val === 'string') {
        if (val.includes(',')) {
          result[key] = val.split(',').map((s: string) => {
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

const axiosInstance = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

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
} as Omit<AxiosInstance, 'get' | 'post' | 'put' | 'delete' | 'patch'> & {
  get<T = any>(url: string, config?: Parameters<AxiosInstance['get']>[1]): Promise<ApiResponse<T>>
  post<T = any>(url: string, data?: any, config?: Parameters<AxiosInstance['post']>[2]): Promise<ApiResponse<T>>
  put<T = any>(url: string, data?: any, config?: Parameters<AxiosInstance['put']>[2]): Promise<ApiResponse<T>>
  delete<T = any>(url: string, config?: Parameters<AxiosInstance['delete']>[1]): Promise<ApiResponse<T>>
  patch<T = any>(url: string, data?: any, config?: Parameters<AxiosInstance['patch']>[2]): Promise<ApiResponse<T>>
}

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
    const msg = error.response?.data?.message || error.message || '请求失败'
    return Promise.reject(new Error(msg))
  }
)

export default api
