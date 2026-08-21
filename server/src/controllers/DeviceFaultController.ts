import path from 'path'
import fs from 'fs'
import { Op } from 'sequelize'
import {
  DeviceFault,
  DeviceFaultRepair,
  DeviceImage,
  Device,
} from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { generateDeviceFaultNo } from '../utils/sequence.js'
import { logger } from '../utils/logger.js'
import { STATUS_REVERSE, LEVEL_REVERSE } from '../models/DeviceFault.js'

// 状态数值反向映射：字符串状态名 → 数值（model 的 status getter 会把 0/1/2/3/4 转成中文，
// 列表/创建场景下需要把中文/数字混用的查询参数统一为数值集合）
const parseMultiStatus = (status: any): number[] | null => {
  if (status === undefined || status === '' || status === null) return null
  const arr = Array.isArray(status) ? status : [status]
  const nums: number[] = []
  arr.forEach((s: any) => {
    if (typeof s === 'string' && s.includes(',')) {
      s.split(',').forEach((p: string) => {
        const n = STATUS_REVERSE[p] !== undefined ? STATUS_REVERSE[p] : Number(p)
        if (!Number.isNaN(n)) nums.push(n)
      })
    } else {
      const n = STATUS_REVERSE[s] !== undefined ? STATUS_REVERSE[s] : Number(s)
      if (!Number.isNaN(n)) nums.push(n)
    }
  })
  return nums.length ? nums : null
}

const parseMultiLevel = (level: any): number[] | null => {
  if (level === undefined || level === '' || level === null) return null
  const arr = Array.isArray(level) ? level : [level]
  const nums: number[] = []
  arr.forEach((l: any) => {
    if (typeof l === 'string' && l.includes(',')) {
      l.split(',').forEach((p: string) => {
        const n = LEVEL_REVERSE[p] !== undefined ? LEVEL_REVERSE[p] : Number(p)
        if (!Number.isNaN(n)) nums.push(n)
      })
    } else {
      const n = LEVEL_REVERSE[l] !== undefined ? LEVEL_REVERSE[l] : Number(l)
      if (!Number.isNaN(n)) nums.push(n)
    }
  })
  return nums.length ? nums : null
}

// 取数值化的状态值（绕过 model 的 getter），便于状态流转判断
const rawStatus = (record: any): number => {
  return record.getDataValue('status')
}

// 获取故障详情（含维修记录与图片）
async function getDetail(id: number) {
  const record = await DeviceFault.findOne({
    where: { fault_id: id },
    include: [
      {
        model: DeviceFaultRepair,
        as: 'repair_record',
        required: false,
        include: [
          {
            model: DeviceImage,
            as: 'repair_images',
            required: false,
            separate: true,
            order: [['sort_order', 'ASC'], ['image_id', 'ASC']],
          },
        ],
      },
      {
        model: DeviceImage,
        as: 'fault_images',
        required: false,
        separate: true,
        order: [['sort_order', 'ASC'], ['image_id', 'ASC']],
      },
    ],
  })
  return record ? record.toJSON() : null
}

// 计算维修成本：spare_parts_cost / labor_cost / total_cost
function calcRepairCost(repair: any) {
  const parts: any[] = Array.isArray(repair.spare_parts_used) ? repair.spare_parts_used : []
  const sparePartsCost = parts.reduce((sum, p) => {
    const qty = Number(p?.quantity) || 0
    const price = Number(p?.unit_price) || 0
    return sum + qty * price
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

export default {
  /**
   * 分页查询故障列表
   * 支持按编号、设备、等级、状态、日期过滤
   */
  async list(req: any, res: any) {
    try {
      const {
        page = 1,
        page_size = 20,
        fault_no,
        device_id,
        device_name,
        device_code,
        fault_level,
        status,
        start_date,
        end_date,
      } = req.query

      const where: any = {}
      if (fault_no) where.fault_no = { [Op.like]: `%${fault_no}%` }
      if (device_id) where.device_id = device_id
      if (device_name) where.device_name = { [Op.like]: `%${device_name}%` }
      if (device_code) where.device_code = { [Op.like]: `%${device_code}%` }

      const levelArr = parseMultiLevel(fault_level)
      if (levelArr) where.fault_level = { [Op.in]: levelArr }

      const statusArr = parseMultiStatus(status)
      if (statusArr) where.status = { [Op.in]: statusArr }

      if (start_date || end_date) {
        where.fault_time = {}
        if (start_date) where.fault_time[Op.gte] = new Date(String(start_date))
        if (end_date) where.fault_time[Op.lte] = new Date(new Date(String(end_date)).getTime() + 86400000)
      }

      const pageNum = Math.max(1, Number(page) || 1)
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(page_size) || 20))

      const { count, rows } = await DeviceFault.findAndCountAll({
        where,
        order: [['fault_time', 'DESC'], ['fault_id', 'DESC']],
        limit: pageSize,
        offset: (pageNum - 1) * pageSize,
      })

      success(res, { list: rows, total: count, page: pageNum, page_size: pageSize })
    } catch (err: any) {
      logger.error('[DeviceFault] list error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 获取故障详情（包含维修记录和图片）
   */
  async detail(req: any, res: any) {
    try {
      const { id } = req.params
      const record = await getDetail(Number(id))
      if (!record) {
        return fail(res, '故障记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }
      success(res, record)
    } catch (err: any) {
      logger.error('[DeviceFault] detail error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 上报故障
   * - 自动生成编号 F + YYYYMMDD + 3位序号
   * - 故障等级校验：1=一般, 2=严重, 3=紧急
   */
  async create(req: any, res: any) {
    const t = await DeviceFault.sequelize.transaction()
    try {
      const userInfo: any = (req as any).user || {}
      const {
        device_id,
        device_code,
        device_name,
        fault_level = 1,
        fault_desc,
        fault_time,
        impact_desc,
        source = '手工',
        related_inspection_id,
        remarks,
      } = req.body

      if (!device_id) {
        return fail(res, '设备ID不能为空', ErrorCode.PARAM_INVALID)
      }
      if (!fault_desc) {
        return fail(res, '故障现象描述不能为空', ErrorCode.PARAM_INVALID)
      }
      if (!fault_time) {
        return fail(res, '故障发生时间不能为空', ErrorCode.PARAM_INVALID)
      }

      // 故障等级校验：必须是 1/2/3（数值或中文映射都支持，model setter 会处理）
      const rawLevel = typeof fault_level === 'string'
        ? (LEVEL_REVERSE[fault_level] !== undefined ? LEVEL_REVERSE[fault_level] : Number(fault_level))
        : Number(fault_level)
      if (!Number.isInteger(rawLevel) || rawLevel < 1 || rawLevel > 3) {
        return fail(res, '故障等级无效，可选值：1=一般, 2=严重, 3=紧急', ErrorCode.PARAM_INVALID)
      }

      // 自动补全设备冗余字段
      let finalDeviceCode = device_code
      let finalDeviceName = device_name
      if (!finalDeviceCode || !finalDeviceName) {
        const device = await Device.findOne({ where: { device_id }, transaction: t })
        if (!device) {
          return fail(res, '设备不存在', ErrorCode.RECORD_NOT_FOUND)
        }
        finalDeviceCode = finalDeviceCode || (device as any).device_code
        finalDeviceName = finalDeviceName || (device as any).device_name
      }

      const fault_no = await generateDeviceFaultNo()

      const record = await DeviceFault.create({
        fault_no,
        device_id,
        device_code: finalDeviceCode,
        device_name: finalDeviceName,
        fault_level: rawLevel,
        fault_desc,
        fault_time,
        impact_desc: impact_desc || '',
        status: 0,
        reporter_id: userInfo.userId || null,
        reporter_name: userInfo.username || '',
        source: source || '手工',
        related_inspection_id: related_inspection_id || null,
        remarks: remarks || '',
      }, { transaction: t })

      await t.commit()
      const detail = await getDetail(record.fault_id)
      success(res, detail, '创建成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[DeviceFault] create error:', err)
      fail(res, err.message || '创建失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 派工（指派维修人，状态 0=待派工 → 1=维修中）
   */
  async assign(req: any, res: any) {
    const t = await DeviceFault.sequelize.transaction()
    try {
      const { id } = req.params
      const userInfo: any = (req as any).user || {}
      const { repairer_id, repairer_name, assigned_time, remarks } = req.body

      if (!repairer_id && !repairer_name) {
        return fail(res, '维修人不能为空', ErrorCode.PARAM_INVALID)
      }

      const record = await DeviceFault.findOne({ where: { fault_id: id }, transaction: t })
      if (!record) {
        return fail(res, '故障记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const s = rawStatus(record)
      if (s !== 0 && s !== 4) {
        return fail(res, '当前状态不允许派工，仅待派工或已挂起的故障可派工', ErrorCode.BUSINESS_ERROR)
      }

      const updateData: any = {
        status: 1,
        repairer_id: repairer_id || null,
        repairer_name: repairer_name || '',
        assigned_time: assigned_time || new Date(),
      }
      if (remarks !== undefined) updateData.remarks = remarks

      await record.update(updateData, { transaction: t })
      await t.commit()
      const detail = await getDetail(Number(id))
      success(res, detail, '派工成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[DeviceFault] assign error:', err)
      fail(res, err.message || '派工失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 提交维修记录
   * - 记录故障原因、维修方案、备件使用、工时
   * - 成本自动核算：spare_parts_cost = sum(数量×单价); labor_cost = 工时×时薪; total_cost = 三项之和
   * - 状态 1=维修中 → 2=待审批
   */
  async submitRepair(req: any, res: any) {
    const t = await DeviceFault.sequelize.transaction()
    try {
      const { id } = req.params
      const userInfo: any = (req as any).user || {}
      const {
        fault_cause,
        repair_plan,
        repair_detail,
        spare_parts_used = [],
        labor_hours = 0,
        labor_rate = 0,
        external_cost = 0,
        repair_start_time,
        repair_end_time,
      } = req.body

      const record = await DeviceFault.findOne({ where: { fault_id: id }, transaction: t })
      if (!record) {
        return fail(res, '故障记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const s = rawStatus(record)
      if (s !== 1) {
        return fail(res, '当前状态不允许提交维修，仅维修中的故障可提交维修', ErrorCode.BUSINESS_ERROR)
      }

      const costInfo = calcRepairCost({
        spare_parts_used,
        labor_hours,
        labor_rate,
        external_cost,
      })

      // 同一故障仅保留一条维修记录：若已存在则更新，否则创建
      const [repair, created] = await DeviceFaultRepair.findOrCreate({
        where: { fault_id: record.fault_id },
        defaults: {
          fault_id: record.fault_id,
          fault_cause: fault_cause || '',
          repair_plan: repair_plan || '',
          repair_detail: repair_detail || '',
          spare_parts_used,
          spare_parts_cost: costInfo.spare_parts_cost,
          labor_hours: Number(labor_hours) || 0,
          labor_rate: Number(labor_rate) || 0,
          labor_cost: costInfo.labor_cost,
          external_cost: costInfo.external_cost,
          total_cost: costInfo.total_cost,
          approve_status: 0,
        },
        transaction: t,
      })

      if (!created) {
        await repair.update({
          fault_cause: fault_cause || '',
          repair_plan: repair_plan || '',
          repair_detail: repair_detail || '',
          spare_parts_used,
          spare_parts_cost: costInfo.spare_parts_cost,
          labor_hours: Number(labor_hours) || 0,
          labor_rate: Number(labor_rate) || 0,
          labor_cost: costInfo.labor_cost,
          external_cost: costInfo.external_cost,
          total_cost: costInfo.total_cost,
          approve_status: 0,
          approver_id: null,
          approver_name: '',
          approve_time: null,
          approve_remark: '',
        }, { transaction: t })
      }

      // 推进故障状态至待审批，并记录维修起止时间
      const faultUpdate: any = {
        status: 2,
        repair_start_time: repair_start_time || record.getDataValue('repair_start_time') || new Date(),
        repair_end_time: repair_end_time || new Date(),
      }
      // 若未派工却直接提交维修，自动用当前用户兜底维修人字段
      if (!record.getDataValue('repairer_id') && !record.getDataValue('repairer_name')) {
        faultUpdate.repairer_id = userInfo.userId || null
        faultUpdate.repairer_name = userInfo.username || ''
      }
      await record.update(faultUpdate, { transaction: t })

      await t.commit()
      const detail = await getDetail(Number(id))
      success(res, detail, '提交维修成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[DeviceFault] submitRepair error:', err)
      fail(res, err.message || '提交维修失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 审批关闭
   * - 通过：状态 2=待审批 → 3=已关闭，维修记录审批状态 → 已通过
   * - 驳回：状态 2=待审批 → 1=维修中，维修记录审批状态 → 已驳回
   */
  async approve(req: any, res: any) {
    const t = await DeviceFault.sequelize.transaction()
    try {
      const { id } = req.params
      const userInfo: any = (req as any).user || {}
      const { approve_result, approve_remark } = req.body

      if (approve_result === undefined || approve_result === null) {
        return fail(res, '审批结果不能为空（true=通过, false=驳回）', ErrorCode.PARAM_INVALID)
      }
      const isPass = [true, 'true', 'pass', '通过', 1, '1'].includes(approve_result)

      const record = await DeviceFault.findOne({ where: { fault_id: id }, transaction: t })
      if (!record) {
        return fail(res, '故障记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const s = rawStatus(record)
      if (s !== 2) {
        return fail(res, '当前状态不允许审批，仅待审批的故障可审批', ErrorCode.BUSINESS_ERROR)
      }

      const repair = await DeviceFaultRepair.findOne({ where: { fault_id: record.fault_id }, transaction: t })
      const now = new Date()
      const approverId = userInfo.userId || null
      const approverName = userInfo.username || ''

      if (isPass) {
        // 通过：状态推进至已关闭
        await record.update({
          status: 3,
          approver_id: approverId,
          approver_name: approverName,
          approve_time: now,
          approve_remark: approve_remark || '',
          closed_time: now,
        }, { transaction: t })
        if (repair) {
          await repair.update({
            approve_status: 1,
            approver_id: approverId,
            approver_name: approverName,
            approve_time: now,
            approve_remark: approve_remark || '',
          }, { transaction: t })
        }
      } else {
        // 驳回：状态回退至维修中
        await record.update({
          status: 1,
          approver_id: approverId,
          approver_name: approverName,
          approve_time: now,
          approve_remark: approve_remark || '',
        }, { transaction: t })
        if (repair) {
          await repair.update({
            approve_status: 2,
            approver_id: approverId,
            approver_name: approverName,
            approve_time: now,
            approve_remark: approve_remark || '',
          }, { transaction: t })
        }
      }

      await t.commit()
      const detail = await getDetail(Number(id))
      success(res, detail, isPass ? '审批通过' : '审批驳回')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[DeviceFault] approve error:', err)
      fail(res, err.message || '审批失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 直接关闭（不需维修的情况）
   */
  async close(req: any, res: any) {
    const t = await DeviceFault.sequelize.transaction()
    try {
      const { id } = req.params
      const userInfo: any = (req as any).user || {}
      const { approve_remark } = req.body

      const record = await DeviceFault.findOne({ where: { fault_id: id }, transaction: t })
      if (!record) {
        return fail(res, '故障记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const s = rawStatus(record)
      if (s === 3) {
        return fail(res, '故障已关闭', ErrorCode.BUSINESS_ERROR)
      }

      const now = new Date()
      await record.update({
        status: 3,
        approver_id: userInfo.userId || null,
        approver_name: userInfo.username || '',
        approve_time: now,
        approve_remark: approve_remark || '',
        closed_time: now,
      }, { transaction: t })

      await t.commit()
      const detail = await getDetail(Number(id))
      success(res, detail, '关闭成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[DeviceFault] close error:', err)
      fail(res, err.message || '关闭失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 删除故障（级联删除维修记录和图片）
   */
  async delete(req: any, res: any) {
    const t = await DeviceFault.sequelize.transaction()
    try {
      const { id } = req.params
      const record = await DeviceFault.findOne({ where: { fault_id: id }, transaction: t })
      if (!record) {
        return fail(res, '故障记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      // 收集需要清理的物理文件
      const images = await DeviceImage.findAll({
        where: { doc_type: 'fault', doc_id: record.fault_id },
        transaction: t,
      })
      const repairImages = await DeviceImage.findAll({
        where: { doc_type: 'repair', doc_id: record.fault_id },
        transaction: t,
      })
      const allImages = [...images, ...repairImages]

      // 级联删除维修记录（CASCADE）与图片记录
      await DeviceFaultRepair.destroy({ where: { fault_id: record.fault_id }, transaction: t })
      await DeviceImage.destroy({ where: { doc_id: record.fault_id }, transaction: t })
      await record.destroy({ transaction: t })

      await t.commit()

      // 清理物理文件（事务提交后再删除，避免回滚时文件已丢失）
      allImages.forEach((img: any) => {
        const rel = String(img.file_path || '').replace(/^\//, '')
        if (!rel) return
        try { fs.unlinkSync(path.resolve(process.cwd(), rel)) } catch { /* ignore */ }
      })

      success(res, { message: '删除成功' }, '删除成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[DeviceFault] delete error:', err)
      fail(res, err.message || '删除失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 获取故障相关图片（doc_type=fault）
   */
  async getImages(req: any, res: any) {
    try {
      const { id } = req.params
      const exists = await DeviceFault.findOne({ where: { fault_id: id }, attributes: ['fault_id'] })
      if (!exists) {
        return fail(res, '故障记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }
      const images = await DeviceImage.findAll({
        where: { doc_type: 'fault', doc_id: id },
        order: [['sort_order', 'ASC'], ['image_id', 'ASC']],
      })
      success(res, images, '查询成功')
    } catch (err: any) {
      logger.error('[DeviceFault] getImages error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 上传故障图片
   * - 单文件或多文件上传，按 doc_type=fault 入库
   * - 命名规范：{doc_type}_{doc_id}_{序号}_{时间戳}.ext
   * - 路由层已挂载 multer，文件位于 req.files / req.file
   */
  async uploadImage(req: any, res: any) {
    const t = await DeviceFault.sequelize.transaction()
    try {
      const { id } = req.params
      const userInfo: any = (req as any).user || {}

      const record = await DeviceFault.findOne({ where: { fault_id: id }, transaction: t })
      if (!record) {
        // 清理临时文件
        const files = (req as any).files || ((req as any).file ? [(req as any).file] : [])
        files.forEach((f: any) => { try { fs.unlinkSync(f.path) } catch { /* ignore */ } })
        return fail(res, '故障记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const files: any[] = (req as any).files || ((req as any).file ? [(req as any).file] : [])
      if (files.length === 0) {
        return fail(res, '请选择要上传的图片', ErrorCode.PARAM_INVALID)
      }

      const uploadsDir = path.resolve(process.cwd(), 'uploads', 'device', 'fault')
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

      // 当前序号起点
      const existingCount = await DeviceImage.count({
        where: { doc_type: 'fault', doc_id: id },
        transaction: t,
      })

      const created: any[] = []
      const ts = Date.now()
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const seqNum = existingCount + i + 1
        const ext = path.extname(file.originalname) || '.jpg'
        const newName = `fault_${id}_${seqNum}_${ts}${ext}`
        const destPath = path.join(uploadsDir, newName)
        fs.renameSync(file.path, destPath)

        const rel = await DeviceImage.create({
          doc_type: 'fault',
          doc_id: Number(id),
          file_path: `/uploads/device/fault/${newName}`,
          file_name: file.originalname || newName,
          file_size: file.size || null,
          sort_order: seqNum,
          uploaded_by: userInfo.userId || null,
          uploaded_by_name: userInfo.username || '',
        }, { transaction: t })
        created.push(rel)
      }

      await t.commit()
      success(res, created, `成功上传${created.length}张图片`)
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[DeviceFault] uploadImage error:', err)
      fail(res, err.message || '上传失败', ErrorCode.SYSTEM_ERROR)
    }
  },
}
