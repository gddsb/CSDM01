export function formatVersionNo(version: string | number | undefined): string {
  if (!version || version === '-' || version === '0' || version === 0) return '000'
  const num = Number(version)
  if (isNaN(num)) return String(version).padStart(3, '0')
  return num.toString().padStart(3, '0')
}

export function formatFilmVersion(filmVersion: string | undefined, versionNo: string | undefined): string {
  if (!filmVersion && !versionNo) return ''
  const filmPart = filmVersion ? filmVersion.replace(/[^A-Za-z0-9]/g, '') : ''
  const versionPart = versionNo ? formatVersionNo(versionNo.replace(/^[Vv]/, '')) : ''
  return filmPart + versionPart
}
