/**
 * 报工图片上传组件（通用）—— 重构版
 *
 * 改动点（对比旧版 build41）：
 *   1. 两个独立按钮（📷 / 🖼️）→ 合并成一个 "+" 上传按钮 + ActionSheet 二选一
 *   2. 删除图片时先调 DELETE /production/report-images/by-url (后端 DB+fs 双删)，再改前端 state
 *   3. 日志同步存 localStorage 队列（log-queue.ts），下次启动批量上报服务器临时目录
 *
 * 后端联动：
 *   - 删除单张图: DELETE /production/report-images/by-url?url=xxx
 *     → ReportImageService.destroy + fs.unlinkSync 物理文件
 *   - 删除不良记录: DELETE /production/process-defects/:id
 *     → ProcessDefectService.remove 内部已自动调 cleanupImageFiles()（DB+fs 双删）
 *     前端 handleDel 不需要额外处理图片清理 ✅
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActionSheet, ImageUploader, Toast } from 'antd-mobile'
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
function resetInput(input: HTMLInputElement | null) {
  if (input) input.value = ''
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
  useEffect(() => { setItems(toItems(value)) }, [JSON.stringify(value)])

  // 隐藏 input —— 被 ActionSheet 选择后触发
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const remaining = maxCount - items.length

  // flushLogs 放 useEffect 只在挂载时跑一次（不能写在 JSX 里每次 render 都跑）
  useEffect(() => { flushLogs() }, [])

  // ========== "+" 按钮点击 → 弹 ActionSheet ==========
  const handleAddClick = useCallback(() => {
    if (remaining <= 0) {
      Toast.show({ content: `已达上限（${maxCount} 张）`, position: 'bottom' })
      return
    }
    ActionSheet.show({
      actions: [
        { text: '📷 相机拍摄', key: 'camera' },
        { text: '🖼️ 从相册选择', key: 'gallery' },
      ],
      cancelText: '取消',
      onAction: (action) => {
        log('info', 'ACTION', { target: action.key, remaining })
        if (action.key === 'camera') cameraInputRef.current?.click()
        else if (action.key === 'gallery') galleryInputRef.current?.click()
      },
    })
  }, [remaining, maxCount])

  // ========== 上传核心 ==========
  const upload = useCallback(async (file: File): Promise<ImageUploadItem> => {
    const stageStart = performance.now()
    const ctx: any = { reportNo, category, fileName: file?.name, size: file?.size, type: file?.type }
    log('info', 'START', ctx)

    if (!file || !(file instanceof File)) {
      log('error', 'ABORT', { reason: 'not a File instance' })
      Toast.show({ content: '图片文件异常，请重试', position: 'bottom' })
      throw new Error('invalid file')
    }

    const beforeSize = file.size
    try {
      file = await compressImage(file, { watermark: { timestamp: Date.now(), username: getCurrentUsername() } })
    } catch (err: any) {
      log('warn', 'COMPRESS_SKIP', { reason: err?.message })
    }
    const afterSize = file.size
    if (afterSize !== beforeSize) {
      log('info', 'COMPRESS', {
        beforeMB: (beforeSize / 1024 / 1024).toFixed(1),
        afterMB: (afterSize / 1024 / 1024).toFixed(1),
        ratio: `${Math.round(afterSize / beforeSize * 100)}%`,
      })
    } else {
      log('info', 'COMPRESS_SKIP', { reason: '≤1MB / 不可压缩' })
    }

    const fd = new FormData()
    fd.append('files', file)
    const url = `/production/report-images/${reportNo}/${category}/upload`
    log('info', 'REQUEST', { method: 'POST', url, bytes: file.size })

    try {
      const res: any = await api.post(url, fd, { timeout: 60000 })
      const ms = Math.round(performance.now() - stageStart)
      log('info', 'RESPONSE', { ok: !!res?.success, ms })

      if (!res?.success) {
        log('error', 'REJECT', { msg: res?.message || '上传失败' })
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
        log('error', 'REJECT', { reason: 'no url in response', data: res?.data })
        Toast.show({ content: '服务器未返回图片地址', icon: 'fail', position: 'bottom' })
        throw new Error('no url returned')
      }

      log('info', 'DONE', { rawUrl, totalMs: ms })
      // key 存后端相对路径（用来删图时传 by-url 端点）
      return { url: resolveUploadUrl(rawUrl), key: rawUrl }
    } catch (e: any) {
      const ms = Math.round(performance.now() - stageStart)
      const isTimeout = e?.code === 'ECONNABORTED' || /timeout/i.test(String(e?.message))
      const status = e?.response?.status
      log('error', 'FAIL', { ms, isTimeout, status, message: e?.message })
      Toast.show({
        content: isTimeout ? '上传超时，请检查网络后重试' : (e?.message || '图片上传失败'),
        icon: 'fail', position: 'bottom',
      })
      throw e
    }
  }, [reportNo, category])

  // ========== 文件处理入口 ==========
  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList).slice(0, remaining)
    if (files.length === 0) {
      Toast.show({ content: `最多 ${maxCount} 张`, position: 'bottom' })
      return
    }
    log('info', 'HANDLE_FILES', { count: files.length, remaining })
    for (const file of files) {
      try {
        const result = await upload(file)
        setItems(prev => {
          const next = [...prev, result]
          onChange(toUrls(next))
          log('info', 'UI_CHANGE', { prev: prev.length, next: next.length })
          return next
        })
      } catch { /* upload 内部已 Toast */ }
    }
  }, [upload, remaining, maxCount, onChange])

  // ========== 删除图片：后端 by-url 端点（DB+fs 双删） ==========
  const deleteSingleImage = useCallback(async (rawUrl: string) => {
    try {
      const encoded = encodeURIComponent(rawUrl)
      await api.delete(`/production/report-images/by-url?url=${encoded}`)
      log('info', 'IMAGE_DELETED', { url: rawUrl })
    } catch (e: any) {
      log('error', 'IMAGE_DELETE_FAIL', { url: rawUrl, msg: e?.message, status: e?.response?.status })
      throw e
    }
  }, [])

  const handlePreviewChange = useCallback(async (newItems: ImageUploadItem[]) => {
    // 新增走 handleFiles，不在这里处理
    if (newItems.length >= items.length) {
      setItems(newItems); onChange(toUrls(newItems)); return
    }

    // diff 出被删的项（ImageUploadItem.key 存的是后端相对路径）
    const prevKeys = new Set(items.map(getRawUrl))
    const nextKeys = new Set(newItems.map(getRawUrl))
    const removed = items.filter(i => !nextKeys.has(getRawUrl(i)))

    // 先乐观更新 UI，再删后端。后端失败则 Toast 但不回滚（删除是破坏性操作）
    setItems(newItems); onChange(toUrls(newItems))
    log('info', 'UI_DELETE', { removed: removed.map(getRawUrl), remaining: newItems.length })

    // 逐条删后端（失败独立互不影响）
    for (const item of removed) {
      try { await deleteSingleImage(getRawUrl(item)) }
      catch (e: any) { Toast.show({ content: `图片删除失败：${e?.message || '网络问题'}`, icon: 'fail', position: 'bottom' }) }
    }
  }, [items, onChange, deleteSingleImage])

  // ========== 样式 ==========

  return (
    <div>
      {label && (
        <div style={{ fontSize: 12, color: 'var(--m-text-2)', marginBottom: 4,
          display: 'flex', alignItems: 'center', gap: 4 }}>
          📷 {label}
          <span style={{ color: 'var(--m-text-3)', fontSize: 10 }}>（已 {items.length}/{maxCount}）</span>
        </div>
      )}

      {/* 内置 "+" cell 直接触发 ActionSheet —— 返回永不 resolve 的 Promise 防止 antd-mobile 走自己的上传 */}
      <ImageUploader
        value={items}
        onChange={handlePreviewChange}
        upload={() => { handleAddClick(); return new Promise(() => {}) }}
        maxCount={maxCount}
      />

      {/* 两个隐藏 <input type="file"> —— 被 ActionSheet 选择后触发 */}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => { handleFiles(e.target.files); resetInput(e.target) }} />
      <input ref={galleryInputRef} type="file" accept="image/*" multiple
        style={{ display: 'none' }}
        onChange={(e) => { handleFiles(e.target.files); resetInput(e.target) }} />
    </div>
  )
}
