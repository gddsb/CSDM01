/**
 * 报工图片上传组件（通用）—— ActionSheet + 双隐藏 input 版
 *
 * 核心设计：绕开 antd-mobile ImageUploader 的 upload 状态机，
 * 自绘 "+" cell + ActionSheet 二选一 + 两个隐藏 <input type="file"> 精确控制相机/相册。
 *
 * 为什么不传 upload prop：
 *   - 传了 antd-mobile 就会渲染内置 "+" + 内部隐藏 input，无法精确区分相机/相册
 *   - 还会渲染 uploading cell + 等 Promise resolve，hack 永不 resolve 会永远转圈
 *   - disableUpload 彻底干掉这些副作用，我们完全接管上传链路
 *
 * 后端联动：
 *   - 上传: POST /production/report-images/:reportNo/:category/upload
 *   - 删除单张图: DELETE /production/report-images/by-url?url=xxx (DB+fs 双删)
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActionSheet, ImageUploader, Toast } from 'antd-mobile'
import type { ImageUploadItem } from 'antd-mobile/es/components/image-uploader'
import api from '../../../utils/api'
import { resolveUploadUrl } from '../../../utils/resolveUploadUrl'
import { compressImage } from '../../utils/image-compress'
import { pushLog, flushLogs } from '../../utils/log-queue'

/** 统一日志入口 —— 真机 Logcat 可见 + 同步 localStorage 队列 */
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

/** 重置隐藏 input 的 value —— 让用户选同一个文件也能再次触发 onChange */
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

  // 外部 value 变化时同步（父组件保存后或初始加载）
  useEffect(() => { setItems(toItems(value)) }, [JSON.stringify(value)])

  // flushLogs 挂载时跑一次
  useEffect(() => { flushLogs() }, [])

  // 两个隐藏 <input type="file"> —— 精确控制入口
  // cameraInput: capture="environment" → 直接开后置相机，拍完就返回（不弹选择器）
  // galleryInput: multiple → 只跳相册，支持多选
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const remaining = maxCount - items.length

  // ========== "+" 点击 → ActionSheet 二选一 ==========
  const handleAddClick = useCallback(() => {
    if (remaining <= 0) {
      Toast.show({ content: `已达上限（${maxCount} 张）`, position: 'bottom' })
      return
    }
    ActionSheet.show({
      actions: [
        { text: '📷 相机拍摄', key: 'camera' },
        { text: '🖼️ 相册选择', key: 'gallery' },
      ],
      cancelText: '取消',
      onAction: (action) => {
        log('info', 'ACTION', { target: action.key, remaining })
        if (action.key === 'camera') cameraInputRef.current?.click()
        else if (action.key === 'gallery') galleryInputRef.current?.click()
      },
    })
  }, [remaining, maxCount])

  // ========== 上传核心 —— 单文件 ==========
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

  // ========== 文件处理入口 —— 串行上传剩余名额内的文件 ==========
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

  // ========== 删除图片：乐观更新 + 后端 by-url 端点（DB+fs 双删） ==========
  const handleChange = useCallback(async (newItems: ImageUploadItem[]) => {
    // 只处理删除（新增走 handleFiles，这里不动）
    if (newItems.length >= items.length) return

    const prevKeys = new Set(items.map(getRawUrl))
    const nextKeys = new Set(newItems.map(getRawUrl))
    const removed = items.filter(i => !nextKeys.has(getRawUrl(i)))

    // 乐观更新 UI + 同步父组件
    setItems(newItems)
    onChange(toUrls(newItems))
    log('info', 'UI_DELETE', { removed: removed.map(getRawUrl), remaining: newItems.length })

    // 逐条删后端（失败独立互不影响）
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

      {/*
        disableUpload 干掉 antd-mobile 内置 "+" cell 和内部隐藏 input —— 根因修复。
        我们不传 upload prop，antd-mobile 完全不参与上传状态机：
          ✓ 没有 uploading cell 永不消失的问题
          ✓ 没有内部 input 漏触发直接跳系统选择器的问题
          ✓ 只靠 value={items} 受控渲染已有缩略图
      */}
      <ImageUploader
        value={items}
        onChange={handleChange}
        disableUpload
        maxCount={maxCount}
      />

      {/* 自绘 "+" cell —— 触发 ActionSheet，样式与 antd-mobile 原版一致 */}
      {remaining > 0 && (
        <div
          onClick={handleAddClick}
          style={{
            width: 80, height: 80,
            border: '1px dashed var(--adm-color-border, #cccccc)',
            borderRadius: 8,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--adm-color-weak, #999)',
            fontSize: 36, fontWeight: 300, lineHeight: 1,
            cursor: 'pointer', userSelect: 'none',
            marginLeft: 8, marginTop: 8,
            boxSizing: 'border-box',
          }}
        >+</div>
      )}

      {/* 两个隐藏 <input type="file"> —— 被 ActionSheet 选择后触发 */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => { handleFiles(e.target.files); resetInput(e.target) }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => { handleFiles(e.target.files); resetInput(e.target) }}
      />
    </div>
  )
}
