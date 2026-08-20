import axios, { AxiosResponse, AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios'

// ========== CapacitorHttp 适配器 ==========
// 安卓/iOS 原生 App 中，WebView 会拦截明文 HTTP 请求并触发 "Network Error"。
// CapacitorHttp 在原生层发起请求，绕过 WebView 级别的所有网络限制（CORS / 明文 / 混合内容）。
// 非原生平台自动回退到 axios 默认 xhr 适配器。

async function capacitorHttpAdapter(config: AxiosRequestConfig): Promise<AxiosResponse> {
  // 动态 import，避免在浏览器端加载 Capacitor 原生代码
  const { CapacitorHttp } = await import('@capacitor/core')

  const method = (config.method || 'get').toUpperCase()
  const url = (config.baseURL || '') + (config.url || '')

  // 组装 headers
  const headers: Record<string, string> = {}
  if (config.headers) {
    for (const [k, v] of Object.entries(config.headers)) {
      if (v != null && k !== 'common') headers[k] = String(v)
    }
  }

  // 组装 body
  let body: string | null = null
  if (config.data != null) {
    if (typeof config.data === 'string') {
      body = config.data
    } else {
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json'
      body = JSON.stringify(config.data)
    }
  }

  // 组装 query string
  let fullUrl = url
  if (config.params && Object.keys(config.params).length > 0) {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(config.params)) {
      if (Array.isArray(v)) {
        for (const item of v) qs.append(k, String(item))
      } else if (v != null) {
        qs.append(k, String(v))
      }
    }
    fullUrl += (url.includes('?') ? '&' : '?') + qs.toString()
  }

  try {
    const resp = await CapacitorHttp.request({
      url: fullUrl,
      method: method as any,
      headers,
      data: body,
    })

    // 解析响应
    let responseData: any = resp.data
    if (typeof resp.data === 'string') {
      try { responseData = JSON.parse(resp.data) } catch { responseData = resp.data }
    }

    const axiosResponse: AxiosResponse = {
      data: responseData,
      status: resp.statusCode || resp.status,
      statusText: resp.status >= 200 && resp.status < 300 ? 'OK' : 'Error',
      headers: resp.headers,
      config,
    }

    if (axiosResponse.status < 200 || axiosResponse.status >= 300) {
      const err = new Error(`Request failed with status code ${axiosResponse.status}`) as AxiosError
      err.response = axiosResponse
      err.config = config
      err.code = 'ERR_BAD_RESPONSE'
      throw err
    }

    return axiosResponse
  } catch (err: any) {
    if (err.response) throw err
    const axiosErr = new AxiosError(err?.message || 'Network Error', 'ERR_NETWORK', config)
    throw axiosErr
  }
}

// 统一适配器：原生走 CapacitorHttp，浏览器走默认 xhr
async function smartAdapter(config: AxiosRequestConfig): Promise<AxiosResponse> {
  // 延迟检测（首次请求时 Capacitor 可能已初始化）
  const win = window as any
  const isNative = !!(win.Capacitor && (win.Capacitor.getPlatform?.() === 'android' || win.Capacitor.getPlatform?.() === 'ios'))

  if (isNative) {
    try {
      return await capacitorHttpAdapter(config)
    } catch (e) {
      // CapacitorHttp 失败时回退（极少数情况）
      console.warn('[API] CapacitorHttp 失败，尝试 xhr 回退', e)
    }
  }

  // 回退到 axios 默认 xhr / http 适配器
  const defaultAdapter = axios.defaults.adapter
  if (!defaultAdapter) throw new AxiosError('No adapter available', 'ERR_CONFIG_MISSING', config)
  return defaultAdapter(config)
}

// ========== 类型映射 ==========
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

// ========== API 实例 ==========
// 原生 App 用 VITE_API_BASE_URL 构建时注入绝对地址；浏览器回退到 /api
const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api'

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  adapter: smartAdapter,
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

// ========== 拦截器 ==========
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
    const isNetwork = error.code === 'ERR_NETWORK'
    if (isNetwork) {
      return Promise.reject(new Error('网络连接失败，请检查设备网络设置'))
    }
    const respData = error.response?.data || {}
    const msg = respData.message || error.message || '请求失败'
    const err: any = new Error(msg)
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

// ========== 工具 ==========
export function extractList(data: any): any[] {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.list)) return data.list
  return []
}

export default api
