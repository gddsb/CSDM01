export const formatBytes = (b: number | undefined | null): string => {
  if (!b || b === 0) return '-'
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export const formatUptime = (s: number | undefined | null): string => {
  if (!s || s === 0) return '-'
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}天${h}小时${m}分钟`
  if (h > 0) return `${h}小时${m}分钟`
  return `${m}分钟`
}
