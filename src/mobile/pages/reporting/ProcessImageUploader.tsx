/**
 * 报工图片上传组件（通用）
 * —— 不良图片 / 标签图片 共用
 *
 * 技术栈：antd-mobile ImageUploader + HTTP 上传接口
 *   - 生产环境 Android Capacitor 壳中会自动调起原生相机/相册
 *   - Web 环境用 <input type="file"> 弹窗
 *   - 上传接口：POST /production/report-images/:report_no/:category/upload
 *
 * 存储形态：后端 JSON 字段存 string[]，前端 ImageUploadItem[] 自动映射
 *
 * 调试日志：所有上传阶段都带 [IMG-UPLOAD] prefix，真机可在
 *   Android Studio Logcat（tag: chromium）或 chrome://inspect/#devices 看到
 */
import { useCallback, useMemo } from 'react'
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

export function ProcessImageUploader({
  reportNo, category, value, onChange, maxCount = 9, label,
}: Props) {
  const items = useMemo(() => toItems(value), [value])

  // 上传函数：调后端 multipart 接口，返回 ImageUploadItem
  const upload = useCallback(async (file: File): Promise<ImageUploadItem> => {
    const stageStart = performance.now()
    const ctx = { reportNo, category, fileName: file?.name, size: file?.size, type: file?.type }

    log.info('START', ctx)

    // 防御：antd-mobile 在旧版 Android 返回 Blob 而非 File
    if (!file || !(file instanceof File)) {
      log.error('ABORT — upload 收到的不是 File 实例', file)
      Toast.show({ content: '图片文件异常，请重试', position: 'bottom' })
      throw new Error('invalid file')
    }

    // 前端 Canvas 压缩：最长边 1920px + JPEG 0.82
    // 手机拍的 8~15MB 原图一般能压到 0.5~1MB，避免触发后端 LIMIT_FILE_SIZE
    const beforeSize = file.size
    try {
      file = await compressImage(file)
    } catch (err: any) {
      log.warn('COMPRESS_SKIP — 压缩异常，用原图继续：', err?.message)
    }
    const afterSize = file.size
    if (afterSize !== beforeSize) {
      log.info('COMPRESS', `${(beforeSize / 1024 / 1024).toFixed(1)}MB → ${(afterSize / 1024 / 1024).toFixed(1)}MB`,
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

      // 后端返回 { url } 或 { urls: [...] }
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
      // 区分：网络错 / HTTP 错 / 超时
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

  const handleChange = (newItems: ImageUploadItem[]) => {
    const before = items.length
    const after = newItems.length
    log.info('CHANGE', `数量 ${before} → ${after}`, 'urls=', toUrls(newItems))
    onChange(toUrls(newItems))
  }

  return (
    <div>
      {label && (
        <div style={{ fontSize: 12, color: 'var(--m-text-2)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          📷 {label}
          <span style={{ color: 'var(--m-text-3)', fontSize: 10 }}>（最多 {maxCount} 张）</span>
        </div>
      )}
      <ImageUploader
        value={items}
        onChange={handleChange}
        upload={upload}
        maxCount={maxCount}
        multiple
        capture="environment"
        showUpload={items.length < maxCount}
      />
    </div>
  )
}
