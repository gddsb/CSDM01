/**
 * 报工图片上传组件（通用）
 * —— 不良图片 / 标签图片 共用
 *
 * 技术栈：antd-mobile ImageUploader（预览+删除）+ 两个独立隐藏 <input type="file">
 *   - 📷 拍照按钮：capture="environment" → 强制调起后置相机
 *   - 🖼️ 相册按钮：无 capture → 系统弹图库 / 相册选择器
 *   - 上传接口：POST /production/report-images/:report_no/:category/upload
 *
 * 存储形态：后端 JSON 字段存 string[]，前端 ImageUploadItem[] 自动映射
 *
 * 调试日志：所有上传阶段都带 [IMG-UPLOAD] prefix，真机可在
 *   Android Studio Logcat（tag: chromium）或 chrome://inspect/#devices 看到
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ImageUploader, Toast } from 'antd-mobile'
import type { ImageUploadItem } from 'antd-mobile/es/components/image-uploader'
import api from '../../../utils/api'
import { compressImage } from '../../utils/image-compress'

const LOG_TAG = '[IMG-UPLOAD]'

/** 统一日志入口 —— 真机可抓 Logcat */
const log = {
  info: (...a: any[]) => console.log(LOG_TAG, ...a),
  warn: (...a: any[]) => console.warn(LOG_TAG, ...a),
  error: (...a: any[]) => console.error(LOG_TAG, ...a),
}

interface Props {
  /** 当前报工单号（用于上传路径） */
  reportNo: string
  /** 图片分类：defect / label / inspection 等，决定存储路径 */
  category: string
  /** 图片 URL 数组（从后端 JSON 字段解析出来） */
  value: string[]
  /** 更新后回传 URL 数组 */
  onChange: (urls: string[]) => void
  /** 最多几张，默认 9 */
  maxCount?: number
  /** 标签文本（"不良图片"/"标签图片"） */
  label?: string
}

/** 后端 JSON 字段 ↔ antd-mobile ImageUploadItem[] 互转工具 */
function toItems(urls: string[] | undefined | null): ImageUploadItem[] {
  if (!urls || urls.length === 0) return []
  return urls.filter(Boolean).map((u) => ({ url: u, key: u }))
}
function toUrls(items: ImageUploadItem[]): string[] {
  return items.map((i) => i.url).filter(Boolean)
}

/** 隐藏 input 清空 value，确保下次选同一文件也能触发 change */
function resetInput(input: HTMLInputElement | null) {
  if (input) input.value = ''
}

export function ProcessImageUploader({
  reportNo, category, value, onChange, maxCount = 9, label,
}: Props) {
  /** 当前已上传图片（内部 state，手动管理上传流程） */
  const [items, setItems] = useState<ImageUploadItem[]>(() => toItems(value))

  /** 外部 value 变化 → 同步内部 items（比如父组件重新拉后端数据） */
  useEffect(() => {
    setItems(toItems(value))
  }, [JSON.stringify(value)])

  /** 两个隐藏 input —— 分别对应 📷拍照 / 🖼️相册 */
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const remaining = maxCount - items.length

  // ========== 上传核心逻辑（复用 build41 的压缩 + POST + 日志） ==========
  const upload = useCallback(async (file: File): Promise<ImageUploadItem> => {
    const stageStart = performance.now()
    const ctx = { reportNo, category, fileName: file?.name, size: file?.size, type: file?.type }

    log.info('START', ctx)

    if (!file || !(file instanceof File)) {
      log.error('ABORT — upload 收到的不是 File 实例', file)
      Toast.show({ content: '图片文件异常，请重试', position: 'bottom' })
      throw new Error('invalid file')
    }

    const beforeSize = file.size
    try {
      file = await compressImage(file)
    } catch (err: any) {
      log.warn('COMPRESS_SKIP — 压缩异常，用原图继续：', err?.message)
    }
    const afterSize = file.size
    if (afterSize !== beforeSize) {
      log.info('COMPRESS',
        `${(beforeSize / 1024 / 1024).toFixed(1)}MB → ${(afterSize / 1024 / 1024).toFixed(1)}MB`,
        `(${Math.round(afterSize / beforeSize * 100)}%)`)
    } else {
      log.info('COMPRESS_SKIP', `≤1MB 已是 / 不可压缩 (${(beforeSize / 1024 / 1024).toFixed(1)}MB)`)
    }

    const fd = new FormData()
    fd.append('files', file)
    const url = `/production/report-images/${reportNo}/${category}/upload`
    log.info('REQUEST → POST', url, 'Content-Type=multipart/form-data', `${file.size}B`)

    try {
      const res: any = await api.post(url, fd, { timeout: 60000 })
      const ms = Math.round(performance.now() - stageStart)

      log.info('RESPONSE ✓', `status=${res?.success ? 'ok' : 'fail'}`, `耗时=${ms}ms`, 'data=', res?.data ?? res)

      if (!res?.success) {
        const msg = res?.message || '上传失败'
        log.error('REJECT — 后端返回失败：', msg)
        Toast.show({ content: msg, icon: 'fail', position: 'bottom' })
        throw new Error(msg)
      }

      const uploadedUrl: string = res.data?.url
        || (Array.isArray(res.data?.urls) ? res.data.urls[0] : res.data)
        || ''

      if (!uploadedUrl) {
        log.error('REJECT — 上传成功但未返回 URL：', res?.data)
        Toast.show({ content: '服务器未返回图片地址', icon: 'fail', position: 'bottom' })
        throw new Error('no url returned')
      }

      log.info('DONE ✓', uploadedUrl, `总耗时=${ms}ms`)
      return { url: uploadedUrl }
    } catch (e: any) {
      const ms = Math.round(performance.now() - stageStart)
      const isTimeout = e?.code === 'ECONNABORTED' || /timeout/i.test(String(e?.message))
      const status = e?.response?.status
      log.error('FAIL ✗', `耗时=${ms}ms`,
        isTimeout ? '【超时】' : '',
        status ? `【HTTP ${status}】` : '',
        e?.message,
        e?.stack?.slice(0, 200) ?? '',
      )
      Toast.show({
        content: isTimeout ? '上传超时，请检查网络后重试' : (e?.message || '图片上传失败'),
        icon: 'fail', position: 'bottom',
      })
      throw e
    }
  }, [reportNo, category])

  // ========== 文件处理入口（两个隐藏 input 的 onChange 共用） ==========
  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return

    // 不能传超过剩余数量
    const files = Array.from(fileList).slice(0, remaining)
    if (files.length === 0) {
      Toast.show({ content: `最多 ${maxCount} 张`, position: 'bottom' })
      return
    }

    log.info('HANDLE_FILES', `count=${files.length} remaining=${remaining}`)

    // 顺序上传（避免并发塞爆后端 + 预览图顺序可控）
    for (const file of files) {
      try {
        const result = await upload(file)
        setItems(prev => {
          const next = [...prev, result]
          onChange(toUrls(next))
          log.info('CHANGE', `数量 ${prev.length} → ${next.length}`, 'urls=', toUrls(next))
          return next
        })
      } catch {
        // upload 内部已 Toast，这里静默跳过继续下一张
      }
    }
  }, [upload, remaining, maxCount, onChange])

  // ========== ImageUploader 预览/删除回调 ==========
  const handlePreviewChange = (newItems: ImageUploadItem[]) => {
    // 只处理删除（新增走我们的 handleFiles）
    setItems(newItems)
    onChange(toUrls(newItems))
    log.info('CHANGE(删除)', `数量 ${items.length} → ${newItems.length}`, 'urls=', toUrls(newItems))
  }

  const cellButtonStyle = useMemo(() => ({
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    cursor: 'pointer',
    color: 'var(--m-text-2)',
    fontSize: 11,
  }), [])

  return (
    <div>
      {label && (
        <div style={{ fontSize: 12, color: 'var(--m-text-2)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          📷 {label}
          <span style={{ color: 'var(--m-text-3)', fontSize: 10 }}>（已 {items.length}/{maxCount}）</span>
        </div>
      )}

      {/* 预览 + 删除：ImageUploader 禁用内置 upload，只渲染已有图片 */}
      <ImageUploader
        value={items}
        onChange={handlePreviewChange}
        upload={() => Promise.reject(new Error('disabled'))}
        disableUpload
        maxCount={maxCount}
      />

      {/* 剩余数量 > 0 时显示两个触发按钮 */}
      {remaining > 0 && (
        <div style={{ display: 'flex', gap: 'var(--gap, 12px)', marginTop: 4 }}>
          {/* 📷 拍照 —— capture="environment" 强制后置相机 */}
          <span
            className="adm-image-uploader-cell adm-image-uploader-upload-button"
            style={cellButtonStyle}
            onClick={() => cameraInputRef.current?.click()}
            role="button"
            aria-label="拍照"
          >
            <span style={{ fontSize: 22 }}>📷</span>
            <span>拍照</span>
          </span>

          {/* 🖼️ 相册 —— 无 capture，系统弹图库选择器 */}
          <span
            className="adm-image-uploader-cell adm-image-uploader-upload-button"
            style={cellButtonStyle}
            onClick={() => galleryInputRef.current?.click()}
            role="button"
            aria-label="从相册选择"
          >
            <span style={{ fontSize: 22 }}>🖼️</span>
            <span>相册</span>
          </span>
        </div>
      )}

      {/* 两个隐藏 <input type="file"> —— 用户看不到，被上面按钮的 click() 触发 */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => {
          handleFiles(e.target.files)
          resetInput(e.target)
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          handleFiles(e.target.files)
          resetInput(e.target)
        }}
      />
    </div>
  )
}
