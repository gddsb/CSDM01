import { SyncTask } from '../models/index.js'
import { EnvCollector } from './envCollector.js'
import { EnergyMeterCollector } from './energyMeterCollector.js'
import { collectAndSaveWeather } from './weatherCollector.js'
import { exportItems, exportCustomers, exportProductionOrders } from './u9Exporter.js'
import { decryptParamsObj } from '../utils/crypto.js'

export interface TaskProgressUpdater {
  (message: string, percent: number, status?: string, totalRecords?: number): Promise<void>
}

export function createProgressUpdater(taskId: number): TaskProgressUpdater {
  return async (message: string, percent: number, status: string = 'running', totalRecords?: number) => {
    try {
      const task = await SyncTask.findByPk(taskId) as any
      if (!task) return
      const steps = Array.isArray(task.steps) ? [...task.steps] : []
      steps.push({ time: new Date().toISOString(), message, percent })
      task.progress = percent
      task.current_step = message
      task.steps = steps
      task.status = status
      if (totalRecords !== undefined) task.total_records = totalRecords
      if (status === 'completed' || status === 'failed') task.ended_at = new Date()
      await task.save()
    } catch (err) {
      console.error('[TaskExecutor] 更新进度失败:', err)
    }
  }
}

/**
 * 执行真实数据采集任务
 */
export async function executeRealTask(
  taskType: string,
  taskBizId: string,
  taskId: number,
  params?: Record<string, any>
): Promise<{ success: boolean; totalRecords?: number; error?: string }> {
  const updateProgress = createProgressUpdater(taskId)

  try {
    switch (taskType) {
      case 'env_monitor': {
        await updateProgress('连接环境监测平台...', 10)
        const decryptedParams = decryptParamsObj(params || {})
        const loginName = decryptedParams.loginName || process.env.ENV_LOGIN_NAME || '13800138000'
        const password = decryptedParams.password || process.env.ENV_PASSWORD || '123456'
        const collector = new EnvCollector({ loginName, password })
        await updateProgress('获取实时监测数据...', 30)
        const result = await collector.collectAndSave()
        await updateProgress(`数据写入完成（${result.saved} 条记录，${result.alarms} 条报警）`, 100, 'completed', result.saved)
        return { success: true, totalRecords: result.saved }
      }

      case 'weather': {
        await updateProgress('连接气象数据源...', 15)
        const data = await collectAndSaveWeather()
        await updateProgress(
          `气象数据已写入（${data.city}：${data.temperature}℃，湿度${data.humidity}%，气压${data.pressure}hPa）`,
          100, 'completed', 1
        )
        return { success: true, totalRecords: 1 }
      }

      case 'items': {
        const onProgress = async (msg: string, pct: number) => {
          await updateProgress(msg, pct)
        }
        const result = await exportItems(taskBizId, onProgress)
        await updateProgress(`料品同步完成，共 ${result.totalRecords} 条`, 100, 'completed', result.totalRecords)
        return { success: true, totalRecords: result.totalRecords }
      }

      case 'customers': {
        const onProgress = async (msg: string, pct: number) => {
          await updateProgress(msg, pct)
        }
        const result = await exportCustomers(taskBizId, onProgress)
        await updateProgress(`客户同步完成，共 ${result.totalRecords} 条`, 100, 'completed', result.totalRecords)
        return { success: true, totalRecords: result.totalRecords }
      }

      case 'production_orders': {
        const onProgress = async (msg: string, pct: number) => {
          await updateProgress(msg, pct)
        }
        const result = await exportProductionOrders(taskBizId, onProgress)
        await updateProgress(`生产订单同步完成，共 ${result.totalRecords} 条`, 100, 'completed', result.totalRecords)
        return { success: true, totalRecords: result.totalRecords }
      }

      case 'energy_meter': {
        await updateProgress('连接能源采集平台...', 10)
        const decryptedParams = decryptParamsObj(params || {})
        const loginName = decryptedParams.loginName
        const password = decryptedParams.password
        const presetToken = decryptedParams.token
        const captchaSchemeId = decryptedParams.captchaSchemeId
        console.log(`[TaskExecutor] 能源采集任务参数: token=${presetToken ? '已设置' : '未设置'}, loginName=${loginName || '未设置'}, captchaSchemeId=${captchaSchemeId || '未设置'}`)
        // 支持 token 直连模式（跳过登录+验证码），也支持账号密码登录
        if (!presetToken && (!loginName || !password)) {
          const msg = '缺少能源平台凭据：请在任务设置中配置 token 或 loginName+password（推荐 token 模式，因验证码 OCR 识别率低）'
          await updateProgress(msg, 100, 'failed', 0)
          try {
            const task = await SyncTask.findByPk(taskId) as any
            if (task) { task.error_msg = msg; await task.save() }
          } catch (_) { /* noop */ }
          return { success: false, error: msg }
        }
        const collector = new EnergyMeterCollector({ loginName, password, token: presetToken, captchaSchemeId })
        await updateProgress(presetToken ? '使用预置 token 连接平台...' : '正在登录并识别验证码...', 25)
        await updateProgress('获取总表有功/无功总电能数据...', 50)
        // 注意：taskBizId 形如 SCHEM20260802123，不能作为 taskSettingId，
        // 传入 sync_task 主键 taskId 作为与采集记录关联的 trace id
        const result = await collector.collectAndSave(Number(taskId) || 0)
        if (result.saved === 0) {
          const head = (result.errors || []).slice(0, 3).join('；') || '此时间段未采集到任何电能记录'
          const msg = `采集完成但未写入任何数据（fetched=${result.fetched}）：${head}`
          await updateProgress(msg, 100, 'failed', 0)
          return { success: false, error: msg }
        }
        const warn = (result.errors && result.errors.length > 0) ? `，${result.errors.length} 条保存异常` : ''
        await updateProgress(
          `能源数据写入完成（采集 ${result.fetched} 条，成功 ${result.saved} 条${warn}）`,
          100, 'completed', result.saved
        )
        return { success: true, totalRecords: result.saved }
      }

      default:
        await updateProgress(`未知任务类型: ${taskType}`, 100, 'failed')
        return { success: false, error: `未知任务类型: ${taskType}` }
    }
  } catch (err: any) {
    const errorMsg = err.message || String(err)
    console.error(`[TaskExecutor] 任务执行失败 [${taskType}]:`, err)
    try {
      const task = await SyncTask.findByPk(taskId) as any
      if (task) {
        const steps = Array.isArray(task.steps) ? [...task.steps] : []
        steps.push({ time: new Date().toISOString(), message: `失败: ${errorMsg}`, percent: task.progress || 0 })
        task.status = 'failed'
        task.error_msg = errorMsg
        task.steps = steps
        task.ended_at = new Date()
        await task.save()
      }
    } catch (e) {
      console.error('[TaskExecutor] 更新失败状态错误:', e)
    }
    return { success: false, error: errorMsg }
  }
}
