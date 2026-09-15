/**
 * SyncTaskController — 业务逻辑已下沉 AutoTaskService.syncToMasterData / syncProductionOrdersFull
 * routes/auto.ts 只用到两个命名导出
 */
import { syncToMasterData as svcSyncToMasterData, syncProductionOrdersFull as svcSyncProductionOrdersFull } from '../../services/AutoTaskService.js'
import { success, fail, ErrorCode } from '../../utils/response.js'
import { AppError } from '../../utils/error.js'

export const syncToMasterData = async (req: any, res: any) => {
  try {
    const { type } = req.query
    const result = await svcSyncToMasterData((type as string) || 'all')
    return success(res, result, '同步完成')
  } catch (err: any) {
    return fail(res, err?.message || '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const syncProductionOrdersFull = async (req: any, res: any) => {
  try {
    const r = await svcSyncProductionOrdersFull()
    return success(res, r, `订单同步完成：采集 ${r.collected || 0} 条，业务表新增 ${r.migrated?.inserted || 0} 条、更新 ${r.migrated?.updated || 0} 条`)
  } catch (err: any) {
    if (err instanceof AppError) return fail(res, err.message, err.code || ErrorCode.SYSTEM_ERROR, err.statusCode)
    return fail(res, err?.message || '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export default { syncToMasterData, syncProductionOrdersFull }
