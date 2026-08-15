export interface ServerInfo {
  name?: string
  status?: string
  port?: number
}

export interface TechStackItem {
  category: string
  key: string
  version: string
}

export interface TechStack {
  frontend?: { version: string; items: TechStackItem[] }
  backend?: { version: string; items: TechStackItem[] }
}

export interface EnvInfo {
  node_version: string
  env: string
  sequelize_version: string
  pid: number
  frontend_server?: ServerInfo
  backend_server?: ServerInfo
  uptime: number
  memory_rss: number
  memory_heap_used: number
  memory_heap_total: number
  cpu_count: number
  os_uptime: number
  disk_used_percent: number
  disk_free: number
  os_version?: string
  platform?: string
  os_type?: string
  os_release?: string
  os_hostname?: string
  cpu_model?: string
  disk_total: number
  disk_used: number
  disk_mount?: string
  cwd: string
  server_time: string
  tech_stack?: TechStack
}

export interface DbInfo {
  dialect: string
  connection_status: string
  host?: string
  port?: number
  database?: string
  username?: string
  password_set?: boolean
  storage?: string
  connection_error?: string
  version?: string
  size?: number
  table_count?: number
  charset?: string
}

export interface MigrationTarget {
  dialect: string
  name: string
  description: string
  default_port?: number
  default_storage?: string
  is_current: boolean
}

export interface BackupRecord {
  filename: string
  size: number
  created_at: string
}
