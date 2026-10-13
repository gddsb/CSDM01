/**
 * 移动端版本号统一管理
 *
 * 单一数据源：后端 GET /api/version（公开端点，无需 auth）
 * 前端只做两件事：
 *   1. 同步读 localStorage 缓存（所有页面随时可读，离线也能显示）
 *   2. 启动时 fetch 一次 /api/version 更新缓存
 *
 * Fallback：如果 /api/version 不可达，退回 Vite define 编译时注入的 __APP_VERSION__ / __APP_BUILD__
 *
 * 为什么不直接在组件里每次 fetch？
 *   - 登录页在未登录态也要显示版本号（虽然 /api/version 是公开的，但多一次 HTTP 没必要）
 *   - 多个页面同时显示版本号 → 一次 fetch 共享
 */

const STORAGE_KEY = 'mes_app_version'

/** vite build 时注入的 API 绝对地址（rebuild_v2.sh Step 4 传 VITE_API_BASE_URL）
 *  - rebuild_v2.sh 注入的是 http://43.138.218.55/api（带 /api 前缀！）
 *  - 浏览器开发环境：VITE_API_BASE_URL 为空 → fallback 到相对路径（Vite proxy 会转）
 *
 * 所以 fetch 调 /api/version 时，要拼 `${API_BASE}/version`（不是 /api/version！）
 */
const API_BASE: string =
  ((import.meta as any).env?.VITE_API_BASE_URL as string) || ''

export interface AppVersionInfo {
  version: string        // "1.2.0"
  build: string          // "53"
  gitSha?: string
  cachedAt: number       // localStorage 里存的时间戳（便于后续加有效期）
}

/** 编译时 fallback（Vite define 注入） */
const FALLBACK: AppVersionInfo = {
  version: (__APP_VERSION__ as string) || 'dev',
  build: (__APP_BUILD__ as string) || '0',
  cachedAt: 0,
}

/** 同步读 —— 组件 render 阶段可直接调用 */
export function getAppVersion(): AppVersionInfo {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return FALLBACK
    const parsed = JSON.parse(raw) as AppVersionInfo
    if (!parsed?.version || !parsed?.build) return FALLBACK
    return parsed
  } catch {
    return FALLBACK
  }
}

/** 启动时异步更新缓存 —— 在 Layout/App 入口调用一次即可 */
export async function refreshAppVersion(): Promise<AppVersionInfo | null> {
  try {
    // API_BASE 已经带 /api 前缀（rebuild_v2.sh 注入 http://43.138.218.55/api）
    // 所以这里用 ${API_BASE}/version → http://43.138.218.55/api/version ✅
    // 浏览器开发环境 API_BASE 为空 → fallback 到 /api/version（Vite proxy 转发）
    const url = API_BASE ? `${API_BASE}/version` : '/api/version'
    const resp = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!resp.ok) return null
    const json = await resp.json()
    const data = json?.data
    if (!data?.version || !data?.buildNumber) return null

    const info: AppVersionInfo = {
      version: String(data.version),
      build: String(data.buildNumber),
      gitSha: data.gitSha,
      cachedAt: Date.now(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(info))
    return info
  } catch {
    // 网络异常不影响主流程，静默失败，组件继续用缓存/fallback
    return null
  }
}

/** 格式化展示："V1.2.0 build53" */
export function formatAppVersion(v?: AppVersionInfo): string {
  const info = v || getAppVersion()
  return `V${info.version} build${info.build}`
}
