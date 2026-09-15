/**
 * 设备故障管理 Service（DeviceFaultController 下沉）
 *
 * 状态流转：新建 → 已分配维修 → 维修中 → 待审批 → 已解决/已关闭
 */
import { Op } from 'sequelize'
import sequelize from '../config/database.js'
import {
  DeviceFault,
  DeviceFaultRepair,
  DeviceImage,
  Device,
} from '../models/index.js'
import { generateDeviceFaultNo } from '../utils/sequence.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import { STATUS_REVERSE, LEVEL_REVERSE } from '../models/DeviceFault.js'
import { nowBeijingDate } from '../utils/date.js'
import { logger } from '../utils/logger.js'

// ---------- 纯函数 ----------

/** 多等级参数解析：兼容数字/"严重"/"中等"/"轻微" */
export function parseFaultLevelParam(level: any): number[] | null {
  if (level === undefined || level === '' || level === null) return null
  const arr = Array.isArray(level) ? level : [level]
  const nums: number[] = []
  for (const l of arr) {
    const parts = typeof l === 'string' && l.includes(',') ? l.split(',') : [l]
    for (const p of parts) {
      const n = LEVEL_REVERSE[p as string] !== undefined
        ? LEVEL_REVERSE[p as string]
        : Number(p)
      if (!Number.isNaN(n)) nums.push(n)
    }
  }
  return nums.length ? nums : null
}

/** 多状态参数解析 */
export function parseFaultStatusParam(status: any): number[] | null {
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

/** 构建故障列表 where */
export function buildFaultWhere(query: any): any {
  const where: any = {}
  const { fault_no, device_id, device_name, device_code, fault_level, status, start_date, end_date } = query

  if (fault_no) where.fault_no = { [Op.like]: `%${fault_no}%` }
  if (device_id) where.device_id = device_id
  if (device_name) where.device_name = { [Op.like]: `%${device_name}%` }
  if (device_code) where.device_code = { [Op.like]: `%${device_code}%` }
  const levelArr = parseFaultLevelParam(fault_level)
  if (levelArr) where.fault_level = { [Op.in]: levelArr }
  const statusArr = parseFaultStatusParam(status)
  if (statusArr) where.status = { [Op.in]: statusArr }
  if (start_date || end_date) {
    where.fault_time = {}
    if (start_date) where.fault_time[Op.gte] = new Date(String(start_date))
    if (end_date) where.fault_time[Op.lte] = new Date(new Date(String(end_date)).getTime() + 86400000)
  }
  return where
}

/** 计算维修成本（纯函数：spare_parts_cost + labor_cost + external_cost） */
export function calcRepairCost(repair: any): any {
  const parts: any[] = Array.isArray(repair.spare_parts_used) ? repair.spare_parts_used : []
  const sparePartsCost = parts.reduce((sum: number, p: any) => {
    return sum + (Number(p?.quantity) || 0) * (Number(p?.unit_price) || 0)
  }, 0)
  const laborHours = Number(repair.labor_hours) || 0
  const laborRate = Number(repair.labor_rate) || 0
  const laborCost = Number((laborHours * laborRate).toFixed(2))
  const externalCost = Number(repair.external_cost) || 0
  const totalCost = Number((sparePartsCost + laborCost + externalCost).toFixed(2))
  return {
    spare_parts_cost: Number(sparePartsCost.toFixed(2)),
    labor_cost: laborCost,
    external_cost: externalCost,
    total_cost: totalCost,
  }
}

// ---------- DB helper ----------

async function getFaultDetail(id: number) {
  const record = await DeviceFault.findOne({
    where: { fault_id: id },
    include: [
      { model: DeviceFaultRepair, as: 'repair_record', required: false, include: [
        { model: DeviceImage, as: 'repair_images', required: false, separate: true, order: [['sort_order', 'ASC'], ['image_id', 'ASC']] },
      ]},
      { model: DeviceImage, as: 'fault_images', required: false, separate: true, order: [['sort_order', 'ASC'], ['image_id', 'ASC']] },
    ],
  })
  return record ? record.toJSON() : null
}

// ---------- Service ----------

export const DeviceFaultService = {
  /** 分页查询故障列表 */
  async list(query: any) {
    const where = buildFaultWhere(query)
    const limit = Math.min(Number(query.page_size) || 20, MAX_PAGE_SIZE)
    const offset = ((Number(query.page) || 1) - 1) * limit

    return await DeviceFault.findAndCountAll({
      where,
      limit,
      offset,
      order: [['fault_time', 'DESC'], ['fault_id', 'DESC']],
    })
  },

  /** 故障详情（含维修记录+图片） */
  async detail(id: number | string) {
    const record = await getFaultDetail(Number(id))
    if (!record) throw new AppError('故障记录不存在', 10002, 404)
    return record
  },

  /** 创建故障（自动编号 + 设备关联校验） */
  async create(body: any, actor?: any) {
    if (!body.device_id) throw new AppError('设备不能为空', 10001, 400)

    const device = await Device.findOne({ where: { device_id: body.device_id } })
    if (!device) throw new AppError('设备不存在', 10002, 404)

    const fault_no = await generateDeviceFaultNo()
    const record = await DeviceFault.create({
      fault_no,
      device_id: body.device_id,
      device_code: (device as any).device_code,
      device_name: (device as any).device_name,
      fault_level: body.fault_level || 1,
      fault_type: body.fault_type || '',
      description: body.description || '',
      fault_time: body.fault_time ? new Date(body.fault_time) : nowBeijingDate(),
      status: 0, // 新建=已报故障
      reporter_id: actor?.userId || null,
      reporter_name: actor?.realName || actor?.username || null,
      remarks: body.remarks,
    } as any)
    return record
  },

  /** 指派维修人（状态 0→1） */
  async assign(id: number | string, body: any, actor?: any) {
    const fault = await DeviceFault.findOne({ where: { fault_id: Number(id) } })
    if (!fault) throw new AppError('故障记录不存在', 10002, 404)

    if ((fault as any).status !== 0) {
      throw new AppError('当前状态不可指派维修人', 20001, 409)
    }

    if (!body.assignee_id) throw new AppError('维修人不能为空', 10001, 400)

    await fault.update({
      status: 1,
      assignee_id: body.assignee_id,
      assignee_name: body.assignee_name || body.assignee_id,
      assign_time: nowBeijingDate(),
      assignor_id: actor?.userId || null,
      assignor_name: actor?.realName || actor?.username || null,
    } as any)
    return fault
  },

  /** 提交维修结果（状态 1→2，事务：写维修记录） */
  async submitRepair(id: number | string, body: any, actor?: any) {
    const fault = await DeviceFault.findOne({ where: { fault_id: Number(id) } })
    if (!fault) throw new AppError('故障记录不存在', 10002, 404)

    if ((fault as any).status !== 1) {
      throw new AppError('当前状态不可提交维修结果', 20001, 409)
    }

    const t = await sequelize.transaction()
    try {
      const repairRecord = await DeviceFaultRepair.create({
        fault_id: Number(id),
        repair_result: body.repair_result || '',
        repair_description: body.repair_description || '',
        labor_hours: Number(body.labor_hours) || 0,
        labor_rate: Number(body.labor_rate) || 0,
        external_cost: Number(body.external_cost) || 0,
        spare_parts_used: body.spare_parts_used || [],
        repair_time: nowBeijingDate(),
        repair_user_id: actor?.userId || null,
        repair_user_name: actor?.realName || actor?.username || null,
      } as any, { transaction: t })

      // 计算维修成本并写入故障主表
      const cost = calcRepairCost(repairRecord)
      await fault.update({
        status: 2,
        repair_id: (repairRecord as any).repair_id,
        repair_time: nowBeijingDate(),
        total_cost: cost.total_cost,
      } as any, { transaction: t })

      await t.commit()
      return await getFaultDetail(Number(id))
    } catch (err) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      throw err
    }
  },

  /** 审批维修结果（状态 2→3 已解决 或 →4 退回） */
  async approve(id: number | string, body: any, actor?: any) {
    const fault = await DeviceFault.findOne({ where: { fault_id: Number(id) } })
    if (!fault) throw new AppError('故障记录不存在', 10002, 404)

    if ((fault as any).status !== 2) {
      throw new AppError('当前状态不可审批', 20001, 409)
    }

    const { approved, remarks } = body
    if (approved === undefined) throw new AppError('必须指定 approved 布尔值', 10001, 400)

    await fault.update({
      status: approved ? 3 : 1, // 3=已解决，退回=1=维修中
      approver_id: actor?.userId || null,
      approver_name: actor?.realName || actor?.username || null,
      approve_time: nowBeijingDate(),
      remarks: remarks !== undefined ? remarks : (fault as any).remarks,
    } as any)

    logger.info(`[DeviceFault] 故障审批: fault_id=${id}, approved=${approved}`)
    return await getFaultDetail(Number(id))
  },

  /** 关闭故障（状态 3/4 → 5） */
  async close(id: number | string, body: any, actor?: any) {
    const fault = await DeviceFault.findOne({ where: { fault_id: Number(id) } })
    if (!fault) throw new AppError('故障记录不存在', 10002, 404)

    const s = (fault as any).status
    if (s !== 3 && s !== 4) {
      throw new AppError('只有已解决或已关闭状态可以关闭', 20001, 409)
    }

    await fault.update({
      status: 5, // 已关闭
      close_time: nowBeijingDate(),
      close_user_id: actor?.userId || null,
      close_user_name: actor?.realName || actor?.username || null,
      close_reason: body.close_reason || '',
    } as any)
    return await getFaultDetail(Number(id))
  },

  /** 删除故障（只有报故障状态 + 无子维修记录可删） */
  async delete(id: number | string) {
    const fault = await DeviceFault.findOne({ where: { fault_id: Number(id) } })
    if (!fault) throw new AppError('故障记录不存在', 10002, 404)

    if ((fault as any).status !== 0) {
      throw new AppError('只有新建状态可以删除', 20001, 409)
    }

    const repairCount = await DeviceFaultRepair.count({ where: { fault_id: Number(id) } })
    if (repairCount > 0) throw new AppError('该故障存在维修记录，无法删除', 20001, 409)

    await fault.destroy()
    return true
  },

  /** 获取故障图片（故障图 + 维修图） */
  async getImages(id: number | string) {
    const faultImages = await DeviceImage.findAll({
      where: { ref_type: 'fault', ref_id: Number(id) },
      order: [['sort_order', 'ASC']],
    })
    const repair = await DeviceFaultRepair.findOne({ where: { fault_id: Number(id) } })
    const repairImages = repair
      ? await DeviceImage.findAll({ where: { ref_type: 'repair', ref_id: (repair as any).repair_id }, order: [['sort_order', 'ASC']] })
      : []
    return { fault_images: faultImages, repair_images: repairImages }
  },
}

export default DeviceFaultService
