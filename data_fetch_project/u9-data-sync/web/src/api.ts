import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

export const api: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 60_000,
});

api.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  return cfg;
});

api.interceptors.response.use(
  (resp) => resp,
  (err) => {
    console.error('[API ERROR]', err?.response?.status, err?.message);
    return Promise.reject(err);
  }
);

export interface ApiResp<T> {
  success: boolean;
  message?: string;
  code?: string;
  data?: T;
}

export async function callApi<T = any>(fn: Promise<any>): Promise<ApiResp<T>> {
  try {
    const r = await fn;
    return r.data as ApiResp<T>;
  } catch (e: any) {
    if (e?.response?.data) return e.response.data as ApiResp<T>;
    return { success: false, message: e?.message || '网络错误' };
  }
}

/* ============== 任务相关类型 ============== */
export type TaskType = 'items' | 'customers' | 'env_monitor' | 'weather';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'duplicate_rejected';
export interface TaskProgressStep {
  time: string;
  message: string;
  percent: number;
}
export interface TaskDTO {
  id: number;
  taskId: string;
  type: TaskType;
  status: TaskStatus;
  progress: number;
  currentStep: string;
  steps: TaskProgressStep[];
  totalRecords?: number;
  errorMsg?: string;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/* ============== 档案查询类型 ============== */
export interface ArchiveSchemaColumn {
  field: string;
  type: string;
  label: string;
}

export interface ArchiveSchemaDTO {
  type: string;
  tableName: string;
  totalRecords: number;
  columns: ArchiveSchemaColumn[];
}

export interface ArchivePagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ArchiveListDTO {
  list: any[];
  pagination: ArchivePagination;
}

/* ============== 任务设置类型 ============== */
export interface TaskSettingDTO {
  id: number;
  taskType: TaskType;
  name: string;
  description: string;
  sourceUrl?: string;
  fieldCount?: number;
  isActive: boolean;
  params?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

/* ============== 计划任务类型 ============== */
export type ExecMode = 'periodic' | 'scheduled' | 'once';

export interface ScheduleConfig {
  interval?: number;
  intervalUnit?: 'minute' | 'hour' | 'day';
  fixedTime?: string;
  fixedDays?: number[];
  onceAt?: string;
}

export interface ScheduledTaskDTO {
  id: number;
  scheduleId: string;
  name: string;
  type: TaskType;
  execMode: ExecMode;
  config: ScheduleConfig;
  nextRunAt?: string;
  lastRunAt?: string;
  lastRunResult?: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type { InternalAxiosRequestConfig };
