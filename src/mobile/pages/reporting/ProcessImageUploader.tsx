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
 */
import { useCallback, useMemo } from 'react'
import { ImageUploader, Toast } from 'antd-mobile'
import type { ImageUploadItem } from 'antd-mobile/es/components/image-uploader'
import api from '../../../utils/api'

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

/**
 * 后端 JSON 字段 ↔ antd-mobile ImageUploadItem[] 互转工具
 * ImageUploadItem = { url: string; key?: string }
 */
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
    const fd = new FormData()
    fd.append('files', file)
    try {
      const res: any = await api.post(
        `/production/report-images/${reportNo}/${category}/upload`,
        fd,
        { timeout: 60000 },
      )
      if (!res?.success) throw new Error(res?.message || '上传失败')
      // 后端返回 { url: "..." } 或 { urls: [...] }
      const uploadedUrl: string = res.data?.url
        || (Array.isArray(res.data?.urls) ? res.data.urls[0] : res.data)
        || ''
      if (!uploadedUrl) throw new Error('未返回图片地址')
      return { url: uploadedUrl }
    } catch (e: any) {
      Toast.show({ content: e?.message || '图片上传失败', icon: 'fail', position: 'bottom' })
      throw e // 让 ImageUploader 组件感知失败
    }
  }, [reportNo, category])

  const handleChange = (newItems: ImageUploadItem[]) => {
    onChange(toUrls(newItems))
  }

  return (
    <div>
      {label && (
        <div style={{ fontSize: 12, color: '#666', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          📷 {label}
          <span style={{ color: '#bbb', fontSize: 10 }}>（最多 {maxCount} 张）</span>
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
