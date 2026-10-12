/**
 * 统一解析后端返回的图片 URL 为可直接 <img src> 的完整地址
 *
 * 背景：后端 ReportImage 存的是相对路径 "/uploads/reports/WOxxx.jpg"
 *   - PC 浏览器 origin = http://43.138.218.55/ → 相对路径直接可用
 *   - Capacitor WebView origin = http://localhost/ → 相对路径 404
 *     必须拼成 http://43.138.218.55/uploads/reports/WOxxx.jpg
 *
 * 本函数用 import.meta.env.VITE_API_BASE_URL（构建时注入的服务器地址）
 * 作为拼接基准，检测到相对路径且以 /uploads/ 开头时自动拼全域名。
 * 绝对路径（http(s)://...）原样返回，不做处理。
 */

/** API 服务器基础地址（构建时注入，如 "https://43.138.218.55/api"） */
const API_BASE: string = (import.meta as any).env?.VITE_API_BASE_URL || ''

/** API_BASE 去掉末尾 "/api"，拿纯 origin（如 "https://43.138.218.55"） */
const SERVER_ORIGIN: string = API_BASE.replace(/\/api\/?$/, '')

/**
 * 解析图片 URL
 * @param url 后端返回的 image_url（相对 "/uploads/..." 或绝对 "http(s)://..."）
 * @returns 可直接用于 <img src> 的完整 URL
 */
export function resolveUploadUrl(url: string | null | undefined | unknown): string {
  // 防御：上游可能误传非 string（如 ImageUploadItem 对象、数字等）
  if (typeof url !== 'string' || !url) return ''

  // 已经是绝对 URL → 原样返回
  if (/^https?:\/\//i.test(url)) return url

  // /uploads/... 相对路径 → 拼全域名
  if (url.startsWith('/uploads/')) {
    // 有构建时注入的服务器地址 → 用它（覆盖 Capacitor WebView 的 localhost origin）
    if (SERVER_ORIGIN) return SERVER_ORIGIN + url
    // 兜底：当前页面 origin（PC 浏览器场景够用）
    if (typeof window !== 'undefined') return window.location.origin + url
    return url
  }

  // 其他情况（相对根的非 uploads 路径等） → 原样返回
  return url
}
