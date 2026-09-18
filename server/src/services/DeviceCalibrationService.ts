/**
 * 设备校准 Service（DeviceCalibrationController 下沉）
 *
 * 核心对象：DeviceCalibrationPlan（校准计划） + DeviceCalibrationRecord（校准记录）
 * 状态：0=待校准, 1=已校准, 2=逾期, 3=已停用
 * 业务规则：
 * - 创建/更新时根据 calibration_cycle 自动计算 next_calibration_date
 * - 提交校准结果（记录）时自动更新计划 last/next 校准日期
 */
import { Op } from 'sequelize'
import sequelize from '../config/database.js'
import {
  DeviceCalibrationPlan,
  DeviceCalibrationRecord,
  Device,
  DeviceImage,
} from '../models/index.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import { STATUS_REVERSE } from '../models/DeviceCalibrationPlan.js'
import { nowBeijingDate } from '../utils/date.js'
import { logger } from '../utils/logger.js'

// ---------- 纯函数 ----------

/** 日期字符串加月数（YYYY-MM-DD） */
export function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/** 日期字符串加天数 */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** 根据上次校准日期 + 校准周期计算下次校准日期 */
export function calcNextCalibrationDate(lastDate: string | null | undefined, cycleMonths: number): string {
  const base = lastDate ? String(lastDate).slice(0, 10) : nowBeijingDate().toISOString().slice(0, 10)
  return addMonths(base, cycleMonths)
}

/** 状态参数解析 */
export function parseCalibStatusParam(status: any): number[] | null {
  if (status === undefined || status === '' || status === null) return null
  const arr = Array.isArray(status) ? status : [status]
  const nums: number[] = []
  for (const s of arr) {
    const parts = typeof s === 'string' && s.includes(',') ? s.split(',') : [s]
    for (const p of parts) {
      const n = STATUS_REVERSE[p as string] !== undefined
        ? STATUS_REVERSE[p as string]
        : Number(p)
      if (!Number.isNaN(n)) nums.push(n)
    }
  }
  return nums.length ? nums : null
}

/** 构建校准计划列表 where */
export function buildCalibPlanWhere(query: any): any {
  const where: any = {}
  const { asset_id, asset_name, asset_code, status, start_date, end_date, keyword } = query

  if (asset_id) where.asset_id = asset_id
  if (asset_name) where.asset_name = { [Op.like]: `%${asset_name}%` }
  if (asset_code) where.asset_code = { [Op.like]: `%${asset_code}%` }
  if (keyword) {
    where[Op.or] = [
      { asset_name: { [Op.like]: `%${keyword}%` } },
      { asset_code: { [Op.like]: `%${keyword}%` } },
    ]
  }
  const statusArr = parseCalibStatusParam(status)
  if (statusArr) where.status = { [Op.in]: statusArr }
  if (start_date || end_date) {
    where.next_calibration_date = {}
    if (start_date) where.next_calibration_date[Op.gte] = new Date(String(start_date))
    if (end_date) where.next_calibration_date[Op.lte] = new Date(String(end_date))
  }
  return where
}

// ---------- DB helper ----------

async function getCalibPlanDetail(id: number) {
  return await DeviceCalibrationPlan.findOne({
    where: { plan_id: id },
    include: [
      { model: DeviceCalibrationRecord, as: 'records', required: false, separate: true,
        order: [['calibration_date', 'DESC'], ['record_id', 'DESC']],
        include: [{ model: DeviceImage, as: 'calibration_images', required: false, separate: true, order: [['sort_order', 'ASC'], ['image_id', 'ASC']] }] },
      { model: Device, as: 'device', required: false },
    ],
  })
}

// ---------- Service ----------

export const DeviceCalibrationService = {
  /** 校准计划列表 */
  async listPlans(query: any) {
    const where = buildCalibPlanWhere(query)
    const limit = Math.min(Number(query.page_size) || 20, MAX_PAGE_SIZE)
    const offset = ((Number(query.page) || 1) - 1) * limit

    return await DeviceCalibrationPlan.findAndCountAll({
      where,
      limit,
      offset,
      order: [['next_calibration_date', 'ASC'], ['plan_id', 'DESC']],
    })
  },

  /** 校准计划详情 */
  async detailPlan(id: number | string) {
    const record = await getCalibPlanDetail(Number(id))
    if (!record) throw new AppError('校准计划不存在', 10002, 404)
    return record
  },

  /** 创建校准计划（自动计算下次校准日期） */
  async createPlan(body: any) {
    if (!body.asset_id) throw new AppError('设备不能为空', 10001, 400)
    if (!body.calibration_cycle) throw new AppError('校准周期不能为空', 10001, 400)

    const device = await Device.findOne({ where: { device_id: body.asset_id } })
    if (!device) throw new AppError('设备不存在', 10002, 404)

    const cycleMonths = Number(body.calibration_cycle)
    if (!cycleMonths || cycleMonths <= 0) throw new AppError('校准周期必须为正整数（月）', 10001, 400)

    const nextDate = calcNextCalibrationDate(body.last_calibration_date, cycleMonths)

    return await DeviceCalibrationPlan.create({
      asset_id: body.asset_id,
      asset_code: (device as any).device_code,
      asset_name: (device as any).device_name,
      calibration_cycle: cycleMonths,
      calibration_type: body.calibration_type || '内部',
      last_calibration_date: body.last_calibration_date || null,
      next_calibration_date: nextDate,
      status: body.status !== undefined ? body.status : 0,
      responsible_person: body.responsible_person || '',
      remarks: body.remarks || '',
    } as any)
  },

  /** 修改校准计划（同步重算下次日期） */
  async updatePlan(id: number | string, body: any) {
    const plan = await DeviceCalibrationPlan.findOne({ where: { plan_id: Number(id) } })
    if (!plan) throw new AppError('校准计划不存在', 10002, 404)

    const updateData: any = {}
    if (body.calibration_cycle !== undefined) {
      const cycle = Number(body.calibration_cycle)
      if (!cycle || cycle <= 0) throw new AppError('校准周期必须为正整数（月）', 10001, 400)
      updateData.calibration_cycle = cycle
      const baseDate = body.last_calibration_date || (plan as any).last_calibration_date
      updateData.next_calibration_date = calcNextCalibrationDate(baseDate, cycle)
    }
    if (body.asset_id !== undefined) {
      const device = await Device.findOne({ where: { device_id: body.asset_id } })
      if (!device) throw new AppError('设备不存在', 10002, 404)
      updateData.asset_id = body.asset_id
      updateData.asset_code = (device as any).device_code
      updateData.asset_name = (device as any).device_name
    }
    if (body.calibration_type !== undefined) updateData.calibration_type = body.calibration_type
    if (body.last_calibration_date !== undefined) {
      updateData.last_calibration_date = body.last_calibration_date
      const cycle = Number(body.calibration_cycle) || (plan as any).calibration_cycle
      updateData.next_calibration_date = calcNextCalibrationDate(body.last_calibration_date, cycle)
    }
    if (body.status !== undefined) updateData.status = body.status
    if (body.responsible_person !== undefined) updateData.responsible_person = body.responsible_person
    if (body.remarks !== undefined) updateData.remarks = body.remarks

    await plan.update(updateData)
    return plan
  },

  /** 删除校准计划（需无子校准记录） */
  async deletePlan(id: number | string) {
    const plan = await DeviceCalibrationPlan.findOne({ where: { plan_id: Number(id) } })
    if (!plan) throw new AppError('校准计划不存在', 10002, 404)

    const recordCount = await DeviceCalibrationRecord.count({ where: { plan_id: Number(id) } })
    if (recordCount > 0) throw new AppError('该计划存在校准记录，无法删除', 20001, 409)

    await plan.destroy()
    return true
  },

  /** 提交校准结果（写校准记录 + 事务更新计划的 last/next 日期 + 状态改回已校准） */
  async submitCalibration(id: number | string, body: any, actor?: any) {
    const plan = await DeviceCalibrationPlan.findOne({ where: { plan_id: Number(id) } })
    if (!plan) throw new AppError('校准计划不存在', 10002, 404)

    const calibrationDate = body.calibration_date
      ? new Date(body.calibration_date)
      : nowBeijingDate()
    const todayStr = calibrationDate.toISOString().slice(0, 10)

    const t = await sequelize.transaction()
    try {
      await DeviceCalibrationRecord.create({
        plan_id: Number(id),
        calibration_date: calibrationDate,
        calibration_result: body.calibration_result || '合格',
        calibration_value: body.calibration_value || null,
        standard_value: body.standard_value || null,
        deviation: body.deviation || null,
        uncertainty: body.uncertainty || null,
        certificate_no: body.certificate_no || '',
        certificate_url: body.certificate_url || '',
        calibrated_by: actor?.realName || actor?.username || null,
        calibration_org: body.calibration_org || '',
        validity_date: body.validity_date || null,
        remarks: body.remarks || '',
      } as any, { transaction: t })

      // 更新计划：上次日期 + 重算下次日期 + 状态
      const cycle = Number((plan as any).calibration_cycle) || 12
      const nextDate = calcNextCalibrationDate(todayStr, cycle)
      await plan.update({
        last_calibration_date: todayStr,
        next_calibration_date: nextDate,
        status: 1, // 已校准
        calibration_result: body.calibration_result || '合格',
      } as any, { transaction: t })

      await t.commit()
      logger.info(`[DeviceCalibration] 校准提交: plan_id=${id}`)
      return await getCalibPlanDetail(Number(id))
    } catch (err) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      throw err
    }
  },

  /** 列出某计划的校准历史记录 */
  async listRecords(id: number | string) {
    return await DeviceCalibrationRecord.findAll({
      where: { plan_id: Number(id) },
      order: [['calibration_date', 'DESC'], ['record_id', 'DESC']],
    })
  },

  /** 即将到期（默认 30 天内） */
  async getExpiringSoon(days: number = 30) {
    const end = new Date()
    end.setDate(end.getDate() + days)
    return await DeviceCalibrationPlan.findAll({
      where: {
        status: { [Op.ne]: 3 },
        next_calibration_date: {
          [Op.between]: [new Date(), end],
        },
      },
      order: [['next_calibration_date', 'ASC']],
    })
  },

  /** 已逾期（next_calibration_date < 今天 且 status != 已停用） */
  async getOverdue() {
    return await DeviceCalibrationPlan.findAll({
      where: {
        status: { [Op.ne]: 3 },
        next_calibration_date: { [Op.lt]: new Date() },
      },
      order: [['next_calibration_date', 'ASC']],
    })
  },

  // ---------- uploadCertificate DB 操作 ----------

  /** 校验校准计划存在（事务内） */
  async assertPlanExists(planId: number, transaction?: any) {
    const plan = await DeviceCalibrationPlan.findOne({ where: { plan_id: planId }, transaction })
    if (!plan) throw new AppError('校准计划不存在', 10002, 404)
    return plan
  },

  /** 查校准计划下最新一条校准记录（事务内） */
  async findLatestRecordByPlan(planId: number, transaction?: any) {
    return await DeviceCalibrationRecord.findOne({
      where: { plan_id: planId },
      order: [['calibration_date', 'DESC'], ['record_id', 'DESC']],
      transaction,
    })
  },

  /** 统计校准记录已上传证书数量 */
  async countCertImages(recordId: number, transaction?: any) {
    return await DeviceImage.count({ where: { doc_type: 'calibration', doc_id: recordId }, transaction })
  },

  /** 创建校准证书图片记录 */
  async createCertImage(data: any, transaction?: any) {
    return await DeviceImage.create(data, { transaction })
  },

  /** 记录首张证书路径到校准记录 */
  async updateCertificatePath(record: any, path: string, transaction?: any) {
    await record.update({ certificate_path: path }, { transaction })
  },
}

export default DeviceCalibrationService
