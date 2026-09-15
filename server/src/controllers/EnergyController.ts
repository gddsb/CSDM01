/** 能源 Controller — 业务逻辑下沉 EnergyService（全部是 raw SQL 统计端点） */
import EnergyService from '../services/EnergyService.js'
import { success, fail, ErrorCode } from '../utils/response.js'
import { logger } from '../utils/logger.js'
import type { Request, Response } from 'express'

export async function overview(req: Request, res: Response) {
  try { return success(res, await EnergyService.overview()) }
  catch (err: any) { logger.error('energy/overview error:', err.message); return fail(res, '获取能源概览失败', ErrorCode.SYSTEM_ERROR) }
}

export async function trend(req: Request, res: Response) {
  try { return success(res, await EnergyService.trend(req.query as any)) }
  catch (err: any) { logger.error('energy/trend error:', err.message); return fail(res, '获取能源趋势失败', ErrorCode.SYSTEM_ERROR) }
}

export async function monthTrend(req: Request, res: Response) {
  try { return success(res, await EnergyService.monthTrend(req.query as any)) }
  catch (err: any) { logger.error('energy/month-trend error:', err.message); return fail(res, '获取月度趋势失败', ErrorCode.SYSTEM_ERROR) }
}

export async function meterList(req: Request, res: Response) {
  try { return success(res, await EnergyService.meterList()) }
  catch (err: any) { logger.error('energy/meter-list error:', err.message); return fail(res, '获取电表列表失败', ErrorCode.SYSTEM_ERROR) }
}

export async function online(req: Request, res: Response) {
  try { return success(res, await EnergyService.online()) }
  catch (err: any) { logger.error('energy/online error:', err.message); return fail(res, '获取在线状态失败', ErrorCode.SYSTEM_ERROR) }
}
