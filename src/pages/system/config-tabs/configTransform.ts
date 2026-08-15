export const shiftOptions = [
  { label: '白班', value: '白班' },
  { label: '夜班', value: '夜班' },
]

export function configToFormValues(cfg: Record<string, unknown>): Record<string, unknown> {
  if (!cfg) return {}
  const v = { ...cfg }
  if (typeof v.shift_setting === 'string' && v.shift_setting.length > 0) {
    v.shift_setting = v.shift_setting.split(',').map((s: string) => s.trim()).filter(Boolean)
  } else if (v.shift_setting == null || (Array.isArray(v.shift_setting) && v.shift_setting.length === 0)) {
    v.shift_setting = ['白班']
  }
  ;['device_alarm', 'quality_alarm', 'stock_warning'].forEach((k: string) => {
    if (v[k] != null) v[k] = String(v[k]) === 'true'
  })
  ;['standard_hours', 'defect_warning_threshold', 'microbe_cycle'].forEach((k: string) => {
    if (v[k] != null && v[k] !== '') v[k] = Number(v[k])
  })
  return v
}

export function formValuesToConfig(values: Record<string, unknown>): Record<string, unknown> {
  const cfg = { ...values }
  if (Array.isArray(cfg.shift_setting)) {
    cfg.shift_setting = cfg.shift_setting.join(',')
  }
  ;['device_alarm', 'quality_alarm', 'stock_warning'].forEach((k: string) => {
    if (typeof cfg[k] === 'boolean') cfg[k] = String(cfg[k])
  })
  delete cfg.system_version
  return cfg
}
