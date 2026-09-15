/**
 * 检验业务共用状态流转 Service
 *
 * IncomingInspection（来料检验）和 ProductInspection（产品检验）
 * 共用同一套状态机：待检(0) → 检验中(1) → 审核中(2) → 已完成(3)
 *
 * 两个业务的 start/submit/review 逻辑 100% 相同，
 * 差异仅在于数据源 Model 和 detail 组装方式，
 * 这部分由各业务 Service 注入。
 */
import { nowBeijingDate } from '../utils/date.js'
import { AppError } from '../utils/error.js'

export const INSPECTION_STATUS = {
  PENDING: 0,       // 待检
  INSPECTING: 1,    // 检验中
  REVIEWING: 2,     // 审核中
  COMPLETED: 3,     // 已完成
  CLOSED: 4,        // 已关闭（预留）
} as const

export interface InspectionRecord {
  inspection_id: number
  status: number | string
  update(data: any): Promise<any>
}

/** 从 model getter（可能返回中文）中取出状态数值 */
export function toStatusNum(record: any): number {
  const raw = typeof record.status === 'number'
    ? record.status
    : Number(record.status)
  if (!Number.isNaN(raw)) return raw
  // 中文映射兜底（model getter 可能返回中文）
  const map: Record<string, number> = { '待检': 0, '检验中': 1, '审核中': 2, '已完成': 3, '已关闭': 4 }
  return map[String(record.status)] !== undefined ? map[String(record.status)] : raw
}

export const InspectionWorkflowService = {
  /**
   * 开检：待检 → 检验中
   * @returns 更新后的字段（调用方负责 save）
   */
  buildStartPayload(actor?: any) {
    const now = nowBeijingDate()
    return {
      status: INSPECTION_STATUS.INSPECTING,
      inspector_id: actor?.userId || null,
      inspector_name: actor?.realName || actor?.username || '',
      inspection_time: now,
    }
  },

  /** 校验：只有待检状态可以开检 */
  assertCanStart(record: any) {
    const s = toStatusNum(record)
    if (s !== INSPECTION_STATUS.PENDING) {
      throw new AppError('只有待检状态可以开检', 20001, 409)
    }
  },

  /** 校验：只有检验中状态可以报审 */
  assertCanSubmit(record: any) {
    const s = toStatusNum(record)
    if (s !== INSPECTION_STATUS.INSPECTING) {
      throw new AppError('只有检验中状态可以报审', 20001, 409)
    }
  },

  /** 校验：只有审核中状态可以审核 */
  assertCanReview(record: any) {
    const s = toStatusNum(record)
    if (s !== INSPECTION_STATUS.REVIEWING) {
      throw new AppError('只有审核中状态可以审核', 20001, 409)
    }
  },

  /** 校验：审核结果必须为 合格/不合格 */
  assertValidReviewResult(result: string) {
    if (result !== '合格' && result !== '不合格') {
      throw new AppError('审核结果必须为合格或不合格', 10001, 400)
    }
  },

  /** 校验：只有待检状态可以删除 */
  assertCanDelete(record: any) {
    const s = toStatusNum(record)
    if (s !== INSPECTION_STATUS.PENDING) {
      throw new AppError('只有待检状态可以删除', 20001, 409)
    }
  },

  /** 校验：审核中及以后不可修改 */
  assertCanEdit(record: any) {
    const s = toStatusNum(record)
    if (s >= INSPECTION_STATUS.REVIEWING) {
      throw new AppError('审核中及以后的状态不可修改', 20001, 409)
    }
  },

  /** 构建审核 payload（合格→已完成，不合格→检验中） */
  buildReviewPayload(record: any, result: string, remarks?: string, actor?: any) {
    const targetStatus = result === '合格'
      ? INSPECTION_STATUS.COMPLETED
      : INSPECTION_STATUS.INSPECTING
    return {
      status: targetStatus,
      result,
      reviewer_id: actor?.userId || null,
      reviewer_name: actor?.realName || actor?.username || '',
      review_time: nowBeijingDate(),
      remarks: remarks !== undefined ? remarks : (record as any).remarks,
    }
  },
}

export default InspectionWorkflowService
