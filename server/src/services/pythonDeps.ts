import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

/**
 * Python 采集依赖（ddddocr/PIL）可用性检查
 * - 启动时惰性检查一次并缓存结果，避免在依赖缺失时反复 spawn python 进程、产生大量错误堆栈噪声
 * - 能源/环境采集任务依赖 ddddocr 识别登录验证码
 */
let ddddocrAvailable: boolean | null = null
let checkInFlight: Promise<boolean> | null = null

export async function isDdddocrAvailable(): Promise<boolean> {
  if (ddddocrAvailable !== null) return ddddocrAvailable
  if (checkInFlight) return checkInFlight

  checkInFlight = execFileAsync('python3', ['-c', 'import ddddocr, PIL'], { timeout: 15000 })
    .then(() => true)
    .catch(() => false)
    .then((ok) => {
      ddddocrAvailable = ok
      checkInFlight = null
      return ok
    })

  return checkInFlight
}

/**
 * 重置缓存（主要用于测试或安装依赖后强制复检）
 */
export function resetDdddocrCheck(): void {
  ddddocrAvailable = null
  checkInFlight = null
}

export const DDDDOCR_MISSING_HINT =
  '验证码识别依赖 ddddocr 未安装，无法执行采集。请在服务器执行: pip3 install ddddocr pillow（安装后需重启后端服务）'
