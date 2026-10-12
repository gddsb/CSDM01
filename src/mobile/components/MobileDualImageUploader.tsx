/**
 * 移动端双通道图片上传组件（通用）
 * —— 同时提供 📷拍照 和 🖼️相册 两个独立入口
 *
 * 设计思路：
 *   antd-mobile ImageUploader 只做「预览 + 删除」（disableUpload）
 *   两个隐藏 <input type="file"> 分别处理：
 *     拍照 → capture="environment" → 强制后置相机
 *     相册 → 无 capture + multiple → 系统图库选择器
 *
 *   上传逻辑由调用方通过 upload(file) => Promise<{ url }> 注入
 *   —— 离线场景传 () => ({ url: URL.createObjectURL(file) })
 *   —— 在线场景传真实 POST 后端的函数
 *
 * 用法：
 *   <MobileDualImageUploader
 *     value={items}  onChange={setItems}
 *     upload={async (f) => { ...真实上传...; return { url: realUrl } }}
 *     maxCount={6} label="现场照片"
 *   />
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ImageUploader, Toast } from 'antd-mobile'
import type { ImageUploadItem } from 'antd-mobile/es/components/image-uploader'

const LOG_TAG = '[DUAL-IMG]'
const log = {
  info: (...a: any[]) => console.log(LOG_TAG, ...a),
  warn: (...a: any[]) => console.warn(LOG_TAG, ...a),
  error: (...a: any[]) => console.error(LOG_TAG, ...a),
}

interface Props {
  /** 当前已上传图片 */
  value: ImageUploadItem[]
  /** 变化回调（新增 / 删除） */
  onChange: (items: ImageUploadItem[]) => void
  /** 上传函数：接收 File，返回 { url } 形式的 ImageUploadItem */
  upload: (file: File) => Promise<ImageUploadItem>
  /** 最多几张，默认 9 */
  maxCount?: number
  /** 标签文本（"不良图片"/"现场照片"等） */
  label?: string
}

/** 隐藏 input 清空 value，确保下次选同一文件也能触发 change */
function resetInput(input: HTMLInputElement | null) {
  if (input) input.value = ''
}

export function MobileDualImageUploader({
  value, onChange, upload, maxCount = 9, label,
}: Props) {
  const [items, setItems] = useState<ImageUploadItem[]>(value)

  /** 外部 value 变化 → 同步（父组件重新拉数据等场景） */
  useEffect(() => {
    setItems(value)
  }, [JSON.stringify(value)])

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const remaining = maxCount - items.length

  // ========== 文件处理入口 ==========
  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return

    const files = Array.from(fileList).slice(0, remaining)
    if (files.length === 0) {
      Toast.show({ content: `最多 ${maxCount} 张`, position: 'bottom' })
      return
    }

    log.info('HANDLE_FILES', `count=${files.length} remaining=${remaining}`)

    // 顺序上传（避免并发 + 预览图顺序可控）
    for (const file of files) {
      try {
        const result = await upload(file)
        setItems(prev => {
          const next = [...prev, result]
          onChange(next)
          log.info('CHANGE', `数量 ${prev.length} → ${next.length}`)
          return next
        })
      } catch (e: any) {
        log.error('UPLOAD FAIL ✗', e?.message || e)
        // upload 内部自己弹 Toast，这里静默跳过继续下一张
      }
    }
  }, [upload, remaining, maxCount, onChange])

  // ========== 删除回调（ImageUploader 内部删） ==========
  const handlePreviewChange = (newItems: ImageUploadItem[]) => {
    setItems(newItems)
    onChange(newItems)
    log.info('CHANGE(删除)', `数量 ${items.length} → ${newItems.length}`)
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

      {/* 预览 + 删除：disableUpload 禁用内置上传，只用它的网格展示 */}
      <ImageUploader
        value={items}
        onChange={handlePreviewChange}
        upload={() => Promise.reject(new Error('disabled'))}
        disableUpload
        maxCount={maxCount}
      />

      {/* 剩余数量 > 0 才显示两个触发按钮 */}
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

      {/* 两个隐藏 <input> —— 被上面按钮的 click() 触发 */}
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
