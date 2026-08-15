import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { fileURLToPath } from 'url'
import EnergyMeterData from '../models/EnergyMeterData.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const execFileAsync = promisify(execFile)

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
  private username: string
  private password: string

  constructor(username: string, password: string) {
    this.username = username
    this.password = password
  }

  async collectAndSave(taskSettingId?: number): Promise<EnergyCollectResult> {
    const scriptPath = path.join(__dirname, 'energy_collect.py')
    const args = [this.username, this.password]
    if (taskSettingId != null) args.push(String(taskSettingId))

    try {
      const { stdout, stderr } = await execFileAsync('python3', [scriptPath, ...args], {
        timeout: 300000,
        maxBuffer: 10 * 1024 * 1024,
      })

      if (stderr) {
        const lines = stderr.trim().split('\n')
        for (const line of lines) {
          console.log('[EnergyCollector] ' + line)
        }
      }

      let result: any
      try {
        result = JSON.parse(stdout.trim())
      } catch {
        const lastLine = stdout.trim().split('\n').pop() || ''
        result = JSON.parse(lastLine)
      }

      if (!result.success) {
        return { success: false, totalRecords: 0, error: result.error || '采集失败' }
      }

      const records: EnergyRecord[] = result.records || []
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

      return { success: true, totalRecords: savedCount }
    } catch (err: any) {
      console.error('[EnergyCollector] 采集失败:', err)
      return { success: false, totalRecords: 0, error: err.message || String(err) }
    }
  }
}
