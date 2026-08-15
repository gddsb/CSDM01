import { QueryClient } from '@tanstack/react-query'

/**
 * 全局 React Query 客户端
 * - 统一配置 staleTime、retry、错误处理
 * - 与现有 api 拦截器（401 自动跳登录、message 提示）配合
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30 * 1000, // 30 秒内不重复请求
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})
