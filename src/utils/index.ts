export function formatVersionNo(version: any): string {
  if (!version || version === '-' || version === '0' || version === 0) return '000'
  const num = Number(version)
  if (isNaN(num)) return String(version).padStart(3, '0')
  return num.toString().padStart(3, '0')
}
