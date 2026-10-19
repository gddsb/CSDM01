/**
 * 报工图片上传组件（通用）—— 原生版 v2
 *
 * 设计：直接用 antd-mobile ImageUploader 原生 upload prop，系统文件选择器自带相机+相册入口，
 *       不再自绘 "+"、不再 ActionSheet、不再隐藏 input —— 极简、稳定、不再转圈。
 *
 * 后端联动：
 *   - 上传: POST /production/report-images/:reportNo/:category/upload
 *   - 删除单张图: DELETE /production/report-images/by-url?url=xxx (DB+fs 双删)
 *   - 删除不良记录: DELETE /production/process-defects/:id
 *     → ProcessDefectService.remove 内部已自动 cleanupImageFiles()（DB+fs 双删）
 */
import { useCallback, useEffect, useState } from 'react'
import { ImageUploader, Toast } from 'antd-mobile'
import type { ImageUploadItem } from 'antd-mobile/es/components/image-uploader'
import api from '../../../utils/api'
import { resolveUploadUrl } from '../../../utils/resolveUploadUrl'
import { compressImage } from '../../utils/image-compress'
import { pushLog, flushLogs } from '../../utils/log-queue'

/** 统一日志入口 —— console 真机 Logcat 可见 + 同步 localStorage 队列 */
function log(level: 'info' | 'warn' | 'error', stage: string, ctx: any) {
  const tag = `[IMG-UPLOAD] [${stage}]`
  if (level === 'info') console.log(tag, ctx)
  else if (level === 'warn') console.warn(tag, ctx)
  else console.error(tag, ctx)

  try {
    pushLog({
      time: new Date().toISOString(),
      stage,
      ctx: typeof ctx === 'object' ? JSON.parse(JSON.stringify(ctx)) : ctx,
      level,
    })
  } catch { /* 循环引用等异常静默跳过 */ }
}

function getCurrentUsername(): string {
  try {
    const raw = localStorage.getItem('mes_user')
    if (!raw) return ''
    return JSON.parse(raw)?.username || ''
  } catch { return '' }
}

interface Props {
  reportNo: string
  category: string
  value: string[]
  onChange: (urls: string[]) => void
  maxCount?: number
  label?: string
}

/** 后端相对路径 ↔ ImageUploadItem[] */
function toItems(urls: string[] | undefined | null): ImageUploadItem[] {
  if (!urls || urls.length === 0) return []
  return urls.filter(Boolean).map((u) => ({ url: resolveUploadUrl(u), key: u }))
}
function toUrls(items: ImageUploadItem[]): string[] {
  return items
    .map((i) => (typeof i.key === 'string' && i.key) ? i.key : (typeof i.url === 'string' ? i.url : ''))
    .filter(Boolean)
}
function getRawUrl(item: ImageUploadItem): string {
  if (typeof item.key === 'string' && item.key) return item.key
  return typeof item.url === 'string' ? item.url : ''
}

export function ProcessImageUploader({
  reportNo, category, value, onChange, maxCount = 9, label,
}: Props) {
  const [items, setItems] = useState<ImageUploadItem[]>(() => toItems(value))

  // 外部 value 变化时同步（父组件保存后或初始加载）
  useEffect(() => { setItems(toItems(value)) }, [JSON.stringify(value)])

  // flushLogs 挂载时跑一次
  useEffect(() => { flushLogs() }, [])

  // ========== 上传核心 —— 直接给 antd-mobile upload prop ==========
  // 签名对齐 antd-mobile：(file: File) => Promise<ImageUploadItem>
  const upload = useCallback(async (file: File): Promise<ImageUploadItem> => {
    const stageStart = performance.now()

    if (!file || !(file instanceof File)) {
      Toast.show({ content: '图片文件异常，请重试', position: 'bottom' })
      throw new Error('invalid file')
    }

    // 压缩
    try {
      file = await compressImage(file, { watermark: { timestamp: Date.now(), username: getCurrentUsername() } })
    } catch { /* 压缩失败静默跳过，用原图继续 */ }

    const fd = new FormData()
    fd.append('files', file)
    const url = `/production/report-images/${reportNo}/${category}/upload`

    try {
      const res: any = await api.post(url, fd, { timeout: 60000 })
      if (!res?.success) {
        Toast.show({ content: res?.message || '上传失败', icon: 'fail', position: 'bottom' })
        throw new Error(res?.message || '上传失败')
      }

      // 兼容后端返回的三种形态：{url: str} / {urls: str[]} / data 本身就是 string[]
      const rawUrl: string = (() => {
        const d = res.data
        if (!d) return ''
        if (typeof d === 'string') return d
        if (Array.isArray(d)) return String(d[0] || '')
        if (typeof d.url === 'string') return d.url
        if (Array.isArray(d.urls)) return String(d.urls[0] || '')
        return String(d)
      })()

      if (!rawUrl) {
        Toast.show({ content: '服务器未返回图片地址', icon: 'fail', position: 'bottom' })
        throw new Error('no url returned')
      }

      log('info', 'UPLOAD_OK', { rawUrl, ms: Math.round(performance.now() - stageStart) })
      // key 存后端相对路径（用来删图时传 by-url 端点）
      return { url: resolveUploadUrl(rawUrl), key: rawUrl }
    } catch (e: any) {
      const isTimeout = e?.code === 'ECONNABORTED' || /timeout/i.test(String(e?.message))
      Toast.show({
        content: isTimeout ? '上传超时，请检查网络后重试' : (e?.message || '图片上传失败'),
        icon: 'fail', position: 'bottom',
      })
      throw e
    }
  }, [reportNo, category])

  // ========== 删除图片：乐观更新 + 后端 by-url 端点（DB+fs 双删） ==========
  const handleChange = useCallback(async (newItems: ImageUploadItem[]) => {
    // 同步父组件（无论新增还是删除，都传当前全集）
    onChange(toUrls(newItems))

    // 只处理删除：diff 出被删的项，逐条调后端 by-url
    if (newItems.length >= items.length) return

    const prevKeys = new Set(items.map(getRawUrl))
    const nextKeys = new Set(newItems.map(getRawUrl))
    const removed = items.filter(i => !nextKeys.has(getRawUrl(i)))

    for (const item of removed) {
      try {
        const encoded = encodeURIComponent(getRawUrl(item))
        await api.delete(`/production/report-images/by-url?url=${encoded}`)
      } catch (e: any) {
        Toast.show({
          content: `图片删除失败：${e?.message || '网络问题'}`,
          icon: 'fail', position: 'bottom',
        })
      }
    }
    setItems(newItems)
  }, [items, onChange])

  return (
    <div>
      {label && (
        <div style={{ fontSize: 12, color: 'var(--m-text-2)', marginBottom: 4,
          display: 'flex', alignItems: 'center', gap: 4 }}>
          📷 {label}
          <span style={{ color: 'var(--m-text-3)', fontSize: 10 }}>（已 {items.length}/{maxCount}）</span>
        </div>
      )}

      {/* 原生 antd-mobile ImageUploader —— upload prop 直接接我们的上传函数
          点 "+" → 系统文件选择器（自带相机+相册）→ upload() → resolve → 缩略图替换 uploading cell */}
      <ImageUploader
        value={items}
        onChange={handleChange}
        upload={upload}
        maxCount={maxCount}
      />
    </div>
  )
}
