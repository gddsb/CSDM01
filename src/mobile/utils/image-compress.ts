/**
 * 浏览器端 Canvas 图片压缩 + 时间水印（零依赖）
 *
 * 目标：把手机拍的 8~15MB 原始 JPEG 压到 ≤1MB（最长边缩到 1920px + quality 0.82）
 *       同时在图片顶部右侧绘制半透明黑底白字水印：日期 时间 用户名
 *
 * 降级策略：
 *   - 只对 image/jpeg image/png 生效（WebP 在 Capacitor WebView 里支持不稳定）
 *   - 无水印需求时（调用方没传 watermark）：≤1MB 原图直接透传
 *   - 有水印需求时：无论大小都走 Canvas 重编码（必须把水印烙进去）
 *   - Canvas API 不可用时（极端旧 WebView）回退原图、不加水印
 */

export interface WatermarkOptions {
  /** 时间戳（毫秒），默认 Date.now() */
  timestamp?: number
  /** 用户名，默认空 */
  username?: string
}

export interface CompressOptions {
  /** 最长边像素（宽或高），默认 1920 */
  maxLongEdge?: number
  /** JPEG quality 0~1，默认 0.82（肉眼基本看不出来，但对体积影响巨大） */
  quality?: number
  /** 仅超过这个体积（字节）才压缩，默认 1MB，避免做无用功 */
  minBytes?: number
  /** 水印配置：传入则强制走 Canvas 重编码，哪怕原图 ≤ minBytes */
  watermark?: WatermarkOptions
}

/** 浏览器环境检测（Capacitor WebView + PC 浏览器都要过） */
function canCompress(): boolean {
  if (typeof document === 'undefined') return false
  const c = document.createElement('canvas')
  return typeof c.getContext === 'function' && typeof (c as any).toBlob === 'function'
}

/**
 * 格式化时间为 YYYY/MM/DD HH:mm（水印样式）
 */
function formatWatermarkTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * 绘制顶部右侧水印（半透明黑底 + 白字）
 * @param ctx   Canvas 2D context
 * @param w     Canvas 宽
 * @param text  水印完整文本（"2026/10/12 15:49 administrator"）
 */
function drawWatermark(ctx: CanvasRenderingContext2D, w: number, text: string): void {
  if (!text) return

  // 字体大小跟随图片宽度自适应（1920px 宽图用 28px，480px 宽用 10px，中间线性插值）
  const fontSize = Math.max(10, Math.round(w / 68))
  ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`

  const paddingH = fontSize * 1.2    // 水平内边距
  const paddingV = fontSize * 0.6    // 垂直内边距
  const marginRight = fontSize * 1.2  // 距右边
  const marginTop = fontSize * 1.2   // 距顶部

  const textWidth = ctx.measureText(text).width
  const boxW = textWidth + paddingH * 2
  const boxH = fontSize + paddingV * 2

  // 半透明黑色背景条
  const bx = w - boxW - marginRight
  const by = marginTop
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
  ctx.fillRect(bx, by, boxW, boxH)

  // 白色文字
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, bx + paddingH, by + boxH / 2)
}

/**
 * 压缩图片 + 可选水印
 * @returns 处理后的 File（和原 file 同名）
 */
export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  const { maxLongEdge = 1920, quality = 0.82, minBytes = 1024 * 1024, watermark } = opts

  // 非 JPEG/PNG 不处理（WebP 在 Capacitor WebView 支持不稳定）
  if (!/image\/(jpeg|png)/i.test(file.type)) return file
  // Canvas 不可用 → 回退原图（极端旧 WebView）
  if (!canCompress()) return file

  // 快速路径：无水印 + 文件足够小 → 原样透传（无损，避免不必要的重编码）
  if (!watermark && file.size <= minBytes) return file

  const bitmap = await createImageBitmap(file).catch(() => {
    // Android 旧 WebView createImageBitmap 可能抛，降级到 Image + objectURL
    const img = new Image()
    return new Promise<HTMLImageElement>((resolve, reject) => {
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = URL.createObjectURL(file)
    })
  })

  const { width: w, height: h } = bitmap as any as { width: number; height: number }

  // 最长边缩放（水印不影响尺寸逻辑）
  const longEdge = Math.max(w, h)
  const target = longEdge > maxLongEdge ? maxLongEdge : longEdge
  const ratio = target / longEdge
  const tw = Math.round(w * ratio)
  const th = Math.round(h * ratio)

  const canvas = document.createElement('canvas')
  canvas.width = tw
  canvas.height = th
  const ctx = canvas.getContext('2d')!

  // 1. 先画原图（可能已缩放）
  ctx.drawImage(bitmap as any, 0, 0, tw, th)

  // 2. 再叠水印（顶部右侧）
  if (watermark) {
    const timeText = formatWatermarkTime(watermark.timestamp ?? Date.now())
    const fullText = watermark.username
      ? `${timeText} ${watermark.username}`
      : timeText
    drawWatermark(ctx, tw, fullText)
  }

  const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => b ? resolve(b) : reject(new Error('canvas toBlob 返回 null')),
      mime,
      quality,
    )
  })

  // 压缩完反而更大 → 无水印场景回退原图；有水印场景返回带水印的新图（必须保留水印）
  if (!watermark && blob.size >= file.size) return file

  return new File([blob], file.name, { type: mime, lastModified: file.lastModified })
}
