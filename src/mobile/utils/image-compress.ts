/**
 * 浏览器端 Canvas 图片压缩（零依赖）
 *
 * 目标：把手机拍的 8~15MB 原始 JPEG 压到 ≤1MB（最长边缩到 1920px + quality 0.82）
 * 用于 ProcessImageUploader.upload 前端预处理，避免触发后端 multer LIMIT_FILE_SIZE
 *
 * 降级策略：
 *   - 只对 image/jpeg image/png 生效（WebP 在 Capacitor WebView 里支持不稳定）
 *   - ≤ 1MB 的原图不压缩，直接透传（无损路径）
 *   - Canvas API 不可用时（极端旧 WebView）回退到原图
 */

export interface CompressOptions {
  /** 最长边像素（宽或高），默认 1920 */
  maxLongEdge?: number
  /** JPEG quality 0~1，默认 0.82（肉眼基本看不出来，但对体积影响巨大） */
  quality?: number
  /** 仅超过这个体积（字节）才压缩，默认 1MB，避免做无用功 */
  minBytes?: number
}

/** 浏览器环境检测（Capacitor WebView + PC 浏览器都要过） */
function canCompress(): boolean {
  if (typeof document === 'undefined') return false
  const c = document.createElement('canvas')
  return typeof c.getContext === 'function' && typeof (c as any).toBlob === 'function'
}

/**
 * 压缩图片
 * @returns 压缩后的 File（和原 file 同名，可能已被压缩）
 */
export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  const { maxLongEdge = 1920, quality = 0.82, minBytes = 1024 * 1024 } = opts

  // 快速路径：太小不压 / 非 JPEG&PNG 不压 / Canvas 不可用回退原图
  if (file.size <= minBytes) return file
  if (!/image\/(jpeg|png)/i.test(file.type)) return file
  if (!canCompress()) return file

  const bitmap = await createImageBitmap(file).catch(() => {
    // Android 旧 WebView createImageBitmap 可能抛，降级
    const img = new Image()
    return new Promise<HTMLImageElement>((resolve, reject) => {
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = URL.createObjectURL(file)
    })
  })

  const { width: w, height: h } = bitmap as any as { width: number; height: number }
  const longEdge = Math.max(w, h)
  // 最长边本来就够短 → 不缩只做重新编码（让浏览器天然压缩 JPEG 的 EXIF 等冗余）
  const target = longEdge > maxLongEdge ? maxLongEdge : longEdge
  const ratio = target / longEdge
  const tw = Math.round(w * ratio)
  const th = Math.round(h * ratio)

  const canvas = document.createElement('canvas')
  canvas.width = tw
  canvas.height = th
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap as any, 0, 0, tw, th)

  const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => b ? resolve(b) : reject(new Error('canvas toBlob 返回 null')),
      mime,
      quality,
    )
  })

  // 压缩完反而更大 → 回退原图（极少发生，如已经高度压缩的图）
  if (blob.size >= file.size) return file

  const compressed = new File([blob], file.name, { type: mime, lastModified: file.lastModified })
  compressed = Object.defineProperty(compressed, '_compressed', {
    value: { from: file.size, to: blob.size, ratio: `${Math.round(blob.size / file.size * 100)}%` },
  }) as File
  return compressed
}
