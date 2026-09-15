/**
 * SystemConfigService — 配置 CRUD + 60s 内存缓存 + 默认配置种子
 * 原始实现来自 controllers/SystemConfigController.ts（1691 行的大型拆分）
 */
import { SystemConfig } from '../models/index.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..', '..')

const LEGACY_DEFAULT_VALUES: Record<string, string[]> = {
  system_version: ['V1.0.0', 'V1.0.1.722'],
  defect_warning_threshold: ['5'],
  microbe_cycle: ['30'],
}

/** 从 package.json 动态读取版本号，避免硬编码 */
function getPackageVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(ROOT_DIR, 'package.json'), 'utf-8'))
    return 'V' + pkg.version
  } catch {
    return 'V1.0.1.736'
  }
}

export const defaultConfigs = [
  { config_key: 'system_name', config_value: '长沙大满MES', config_desc: '系统名称' },
  { config_key: 'system_version', config_value: 'V1.0.1.736', config_desc: '系统版本（只读）' },
  { config_key: 'company_name', config_value: '东莞市大满包装实业有限公司长沙分公司', config_desc: '公司名称' },
  { config_key: 'contact_phone', config_value: '0731-88888888', config_desc: '联系电话' },
  { config_key: 'default_line', config_value: 'A线', config_desc: '默认产线' },
  { config_key: 'standard_hours', config_value: '8', config_desc: '标准工时' },
  { config_key: 'shift_setting', config_value: '白班', config_desc: '班次设置（默认白班）' },
  { config_key: 'default_standard', config_value: '', config_desc: '默认检验标准' },
  { config_key: 'defect_warning_threshold', config_value: '3', config_desc: '不良率预警阈值(%)' },
  { config_key: 'microbe_cycle', config_value: '7', config_desc: '微生物检测周期(天)' },
  { config_key: 'device_alarm', config_value: 'true', config_desc: '设备故障报警' },
  { config_key: 'quality_alarm', config_value: 'true', config_desc: '质量异常报警' },
  { config_key: 'stock_warning', config_value: 'true', config_desc: '库存预警' },
]

export const ALLOWED_CONFIG_KEYS = new Set(defaultConfigs.map(d => d.config_key).filter(k => k !== 'system_version'))

// ---- 60s 内存缓存 ----
let sysConfigCache: { value: Record<string, any>; expireAt: number } | null = null
const SYSCONFIG_CACHE_TTL = 60 * 1000
export function clearSysConfigCache() { sysConfigCache = null }

// ---- 公开 API ----

export async function getConfig(): Promise<Record<string, any>> {
  if (sysConfigCache && sysConfigCache.expireAt > Date.now()) return sysConfigCache.value
  const configs = await SystemConfig.findAll()
  const result: Record<string, any> = {}
  configs.forEach(c => { result[c.config_key] = c.config_value })
  for (const def of defaultConfigs) {
    if (result[def.config_key] === undefined) result[def.config_key] = def.config_value
  }
  result.system_version = getPackageVersion()
  sysConfigCache = { value: result, expireAt: Date.now() + SYSCONFIG_CACHE_TTL }
  return result
}

export async function saveConfig(payload: Record<string, any>, username: string = 'system'): Promise<void> {
  const configs = { ...payload }
  delete configs.system_version
  for (const [key, value] of Object.entries(configs)) {
    if (!ALLOWED_CONFIG_KEYS.has(key)) continue
    const val = typeof value === 'object' ? JSON.stringify(value) : String(value)
    const [record, created] = await SystemConfig.findOrCreate({
      where: { config_key: key },
      defaults: { config_value: val, config_desc: key, updated_by: username },
    })
    if (!created) await record.update({ config_value: val, updated_by: username })
  }
  clearSysConfigCache()
}

export async function initDefaultConfigs(): Promise<void> {
  for (const def of defaultConfigs) {
    const [record, created] = await SystemConfig.findOrCreate({ where: { config_key: def.config_key }, defaults: def })
    if (created) continue
    const legacy = LEGACY_DEFAULT_VALUES[def.config_key]
    if (legacy && legacy.includes(record.config_value)) {
      await record.update({ config_value: def.config_value, config_desc: def.config_desc })
    }
  }
}

export default { getConfig, saveConfig, initDefaultConfigs, clearSysConfigCache }
