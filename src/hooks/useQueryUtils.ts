import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';

/**
 * 通用列表查询 Hook（React Query 封装）
 * 统一处理分页、查询参数、缓存与加载态
 */
export function useListQuery<T = unknown>(
  key: string,
  url: string,
  params?: Record<string, unknown>,
  options?: { enabled?: boolean; refetchInterval?: number | false }
) {
  return useQuery<T[]>({
    queryKey: [key, params],
    queryFn: () => api.get<T[]>(url, params).then((r) => r.data || []),
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval,
    staleTime: 30 * 1000,
  });
}

/**
 * 通用创建/更新 Mutation Hook
 */
export function useSaveMutation<T = unknown>(url: string, invalidateKeys?: string[]) {
  const qc = useQueryClient();
  return useMutation<T, unknown, Record<string, unknown>>({
    mutationFn: (body) => api.post<T>(url, body).then((r) => r.data),
    onSuccess: () => {
      invalidateKeys?.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
  });
}

export { useQuery, useMutation, useQueryClient };
