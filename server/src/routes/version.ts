/**
 * 版本信息接口（公开，无需登录）
 *
 * 移动端（Capacitor Android）冷启动时调用，检查是否有新版本需要更新。
 * 同时为 Web 端 Vite 构建产物提供版本自检入口（PWA 热更新）。
 *
 * 部署说明：
 *  - 首次上线后，移动端 APK 放在服务器 /download/mobile.apk 或 CDN 上
 *  - 每次发布新版本时，修改 MOBILE_VERSION_FILE 或直接 edit releases.json
 *  - Web 端 PWA 版本通过 vite 注入的 __APP_VERSION__ 对比即可判断
 */
import { Router } from 'express'
import { readFileSync, existsSync } from 'fs'
import path from 'path'

const router = Router()

interface ReleaseInfo {
  version: string
  buildNumber: number
  forceUpdate: boolean
  downloadUrl: string
  updateNotes: string
  minNativeVersion?: number
  minAppVersion?: string
  apkSize?: number
  checksum?: string
}

/** releases.json 存放位置（相对于 server/ 目录） */
const RELEASES_FILE = path.resolve(process.cwd(), 'data', 'releases.json')

/** 兜底默认值（releases.json 不存在时使用 package.json 版本） */
function getFallback(): ReleaseInfo {
  try {
    const pkgPath = path.resolve(process.cwd(), '..', 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    return {
      version: pkg.version || '0.0.0',
      buildNumber: 1,
      forceUpdate: false,
      downloadUrl: '/download/mobile.apk',
      updateNotes: '新版本已发布，请更新至最新版获得更好的使用体验',
    }
  } catch {
    return {
      version: '0.0.0',
      buildNumber: 1,
      forceUpdate: false,
      downloadUrl: '/download/mobile.apk',
      updateNotes: '请更新至最新版',
    }
  }
}

router.get('/', (_req, res) => {
  const info = existsSync(RELEASES_FILE)
    ? (() => {
        try { return JSON.parse(readFileSync(RELEASES_FILE, 'utf-8')) as ReleaseInfo }
        catch { return getFallback() }
      })()
    : getFallback()
  res.json({ success: true, data: info })
})

export default router
