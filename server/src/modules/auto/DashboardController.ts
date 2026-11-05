/**
 * DashboardController — 大屏展示（无需登录），业务逻辑已下沉 DashboardService
 * routes/auto.ts 直接导入 5 个命名导出
 */
import DashboardService from '../../services/DashboardService.js'
import { getDashboardTodos } from '../../services/TodoService.js'
import { success, fail, ErrorCode } from '../../utils/response.js'
import { logger } from "../../utils/logger.js"

const wrap = (fn: (req: any) => Promise<any>) => async (req: any, res: any) => {
  try { return success(res, await fn(req)) }
  catch (err: any) { logger.error('[Dashboard]', err.message); return fail(res, err?.message || '服务器错误', ErrorCode.SYSTEM_ERROR) }
}

export const dashboardOverview = wrap(() => DashboardService.dashboardOverview())
export const dashboardTrend = wrap(() => DashboardService.dashboardTrend())
export const productionDashboard = wrap(() => DashboardService.productionDashboard())
export const qualityDashboard = wrap(() => DashboardService.qualityDashboard())
export const managementDashboard = wrap(() => DashboardService.managementDashboard())
/** 待办事项统一口径（需登录，按当前用户统计） */
export const dashboardTodos = wrap((req: any) => getDashboardTodos((req as any).user))

export default { dashboardOverview, dashboardTrend, productionDashboard, qualityDashboard, managementDashboard, dashboardTodos }
