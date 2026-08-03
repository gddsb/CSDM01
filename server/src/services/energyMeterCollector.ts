import axios from 'axios'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { fileURLToPath } from 'url'
import EnergyMeterData from '../models/EnergyMeterData.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const execFileAsync = promisify(execFile)

const API_HOST = 'https://nh2api.yunjichaobiao.com'
const FRONTEND_HOST = 'https://nh2.yunjichaobiao.com'

const DEFAULT_CONFIG = {
  listType: 'device',
  dateType: 'mi15',
  areaID: 56552,
  ammeterID: 107799,
  valueType: 'SJZ',
  pageSize: 50,
}

function generateKeyStr(length = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

async function recognizeCaptcha(base64Image: string): Promise<string> {
  const scriptPath = path.join(__dirname, 'ocr', 'captcha_ocr.py')
  try {
    const { stdout } = await execFileAsync('python3', [scriptPath, base64Image], {
      timeout: 15000,
      maxBuffer: 1024 * 1024,
    })
    return stdout.trim()
  } catch (err: any) {
    console.warn('[EnergyCollector] ddddocr 识别失败，尝试备用方案:', err.message)
    throw new Error(`验证码识别失败: ${err.message}`)
  }
}

interface LoginResult {
  token: string
  userInfo: Record<string, any>
}

interface EnergyRecord {
  ReadingDate: string
  AmmeterName?: string
  Address?: string
  ZYGDN?: number | null
  ZWGDN?: number | null
  FYGDN?: number | null
  FWGDN?: number | null
}

export interface EnergyCollectResult {
  success: boolean
  totalRecords: number
  error?: string
}

export class EnergyMeterCollector {
  private token: string | null = null
  private username: string
  private password: string

  constructor(username: string, password: string) {
    this.username = username
    this.password = password
  }

  private async getCaptcha(keyStr: string): Promise<string> {
    const url = `${API_HOST}/api/Account/GetCaptcha?keyStr=${keyStr}`
    const resp = await axios.post(url, { keyStr }, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Origin': FRONTEND_HOST,
        'Referer': `${FRONTEND_HOST}/login.html`,
      },
      timeout: 30000,
    })

    let result = resp.data
    if (typeof result === 'string') result = JSON.parse(result)

    if (result.IsSuccess) {
      const base64Data = String(result.Data).replace(/"/g, '').replace(/\\/g, '')
      return base64Data
    }
    throw new Error(`获取验证码失败: ${result.ErrorMsg || 'Unknown error'}`)
  }

  private async login(keyStr: string, code: string): Promise<boolean> {
    const url = `${API_HOST}/api/Account/Login`
    const loginData = new URLSearchParams({
      UserID: this.username,
      Password: this.password,
      client: '0',
      KeyStr: keyStr,
      Code: code,
      Language: 'en',
    })

    const resp = await axios.post(url, loginData.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': FRONTEND_HOST,
        'Referer': `${FRONTEND_HOST}/login.html`,
      },
      timeout: 30000,
    })

    let result = resp.data
    if (typeof result === 'string') result = JSON.parse(result)

    if (result.IsSuccess) {
      this.token = result.Token
      return true
    }
    console.warn('[EnergyCollector] 登录失败:', result.ErrorMsg)
    return false
  }

  async loginWithCaptcha(maxRetries = 3): Promise<boolean> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[EnergyCollector] 登录尝试 ${attempt}/${maxRetries}`)
      const keyStr = generateKeyStr(12)
      try {
        const base64Image = await this.getCaptcha(keyStr)
        const captchaCode = await recognizeCaptcha(base64Image)
        if (!captchaCode || captchaCode.length < 3) {
          console.warn('[EnergyCollector] 验证码识别结果不完整，重试')
          continue
        }
        if (await this.login(keyStr, captchaCode)) {
          console.log('[EnergyCollector] 登录成功')
          return true
        }
      } catch (err: any) {
        console.warn(`[EnergyCollector] 登录尝试 ${attempt} 失败:`, err.message)
      }
    }
    throw new Error(`登录失败，已重试 ${maxRetries} 次`)
  }

  private async getTotalEnergyData(
    pageIndex = 1,
    pageSize = 50,
    overrides: Partial<typeof DEFAULT_CONFIG> & { startTime?: string; endTime?: string } = {}
  ): Promise<{ list: EnergyRecord[]; count: number; pageCount: number } | null> {
    if (!this.token) throw new Error('未登录')

    const url = `${API_HOST}/api/Monitor/PageForTotalEnergy`
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const fmt = (d: Date) => {
      const p = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
    }

    const params = {
      listType: overrides.listType || DEFAULT_CONFIG.listType,
      pageIndex,
      pageSize,
      dateType: overrides.dateType || DEFAULT_CONFIG.dateType,
      areaID: overrides.areaID || DEFAULT_CONFIG.areaID,
      ammeterID: overrides.ammeterID || DEFAULT_CONFIG.ammeterID,
      startTime: overrides.startTime || fmt(yesterday),
      endTime: overrides.endTime || fmt(tomorrow),
      valueType: overrides.valueType || DEFAULT_CONFIG.valueType,
      PrivAddr: '',
    }

    const resp = await axios.post(url, params, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': `${FRONTEND_HOST}/Energy/ygwgzdn.html`,
      },
      timeout: 30000,
    })

    let result = resp.data
    if (typeof result === 'string') result = JSON.parse(result)

    if (result && result.IsSuccess) {
      let data = result.Data
      if (typeof data === 'string') data = JSON.parse(data)
      return data
    }
    return null
  }

  async collectAllData(): Promise<EnergyRecord[]> {
    const allRecords: EnergyRecord[] = []
    let pageIndex = 1
    let totalPages = 0

    while (true) {
      const data = await this.getTotalEnergyData(pageIndex, DEFAULT_CONFIG.pageSize)
      if (!data || !data.list || data.list.length === 0) break

      allRecords.push(...data.list)
      totalPages = data.pageCount || 1
      console.log(`[EnergyCollector] 第${pageIndex}/${totalPages}页: 获取${data.list.length}条, 累计${allRecords.length}/${data.count}条`)

      if (pageIndex >= totalPages) break
      pageIndex++
      await new Promise(r => setTimeout(r, 500))
    }

    console.log(`[EnergyCollector] 数据采集完成: 共${allRecords.length}条记录`)
    return allRecords
  }

  async saveToDatabase(records: EnergyRecord[], taskSettingId?: number): Promise<number> {
    if (!records || records.length === 0) return 0

    let savedCount = 0
    for (const record of records) {
      try {
        const readingDate = record.ReadingDate ? new Date(record.ReadingDate) : new Date()
        await EnergyMeterData.upsert({
          task_setting_id: taskSettingId,
          reading_date: readingDate,
          device_addr: record.Address || '',
          device_name: record.AmmeterName || '总表',
          forward_active_energy: record.ZYGDN != null ? Number(record.ZYGDN) : null,
          forward_reactive_energy: record.ZWGDN != null ? Number(record.ZWGDN) : null,
          reverse_active_energy: record.FYGDN != null ? Number(record.FYGDN) : null,
          reverse_reactive_energy: record.FWGDN != null ? Number(record.FWGDN) : null,
          raw_data: JSON.stringify(record),
        })
        savedCount++
      } catch (err: any) {
        console.warn('[EnergyCollector] 保存记录失败:', err.message)
      }
    }
    return savedCount
  }

  async collectAndSave(taskSettingId?: number): Promise<EnergyCollectResult> {
    try {
      await this.loginWithCaptcha()
      const records = await this.collectAllData()
      const saved = await this.saveToDatabase(records, taskSettingId)
      return { success: true, totalRecords: saved }
    } catch (err: any) {
      console.error('[EnergyCollector] 采集失败:', err)
      return { success: false, totalRecords: 0, error: err.message || String(err) }
    }
  }
}
