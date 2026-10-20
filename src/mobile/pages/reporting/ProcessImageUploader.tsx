/**
 * 报工图片上传 —— MobileImageUploader 的业务薄包装
 *
 * 只负责绑定报工特有的 URL 规则 + 水印 + log-queue 日志上报。
 * 核心上传/压缩/删图/ActionSheet 全由 MobileImageUploader 通用组件处理。
 */
import { useEffect } from 'react'
import { MobileImageUploader } from '../../components/MobileImageUploader'
import { pushLog, flushLogs } from '../../utils/log-queue'

interface Props {
  reportNo: string
  category: string
  value: string[]
  onChange: (urls: string[]) => void
  maxCount?: number
  label?: string
}

function getCurrentUsername(): string {
  try {
    const raw = localStorage.getItem('mes_user')
    if (!raw) return ''
    return JSON.parse(raw)?.username || ''
  } catch { return '' }
}

export function ProcessImageUploader({
  reportNo, category, value, onChange, maxCount = 9, label,
}: Props) {
  // flushLogs 挂载时跑一次（log-queue 批量上报到服务器临时目录）
  useEffect(() => { flushLogs() }, [])

  return (
    <MobileImageUploader
      uploadUrl={`/production/report-images/${reportNo}/${category}/upload`}
      deleteUrl={(rawUrl) => `/production/report-images/by-url?url=${encodeURIComponent(rawUrl)}`}
      value={value}
      onChange={onChange}
      maxCount={maxCount}
      label={label}
      compress={true}
      watermark={{ username: getCurrentUsername(), timestamp: true }}
      onLog={(level, stage, ctx) => {
        pushLog({
          time: new Date().toISOString(),
          stage,
          ctx: typeof ctx === 'object' ? JSON.parse(JSON.stringify(ctx)) : ctx,
          level,
        })
      }}
    />
  )
}
