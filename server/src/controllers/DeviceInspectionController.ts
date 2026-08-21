import path from 'path'
import fs from 'fs'
import { Op } from 'sequelize'
import {
  DeviceInspectionStandard,
  DeviceInspectionPlan,
  DeviceInspectionRecord,
  Device,
  DeviceFault,
  DeviceImage,
} from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { logger } from '../utils/logger.js'
import { generateDeviceFaultNo } from '../utils/sequence.js'
import { STATUS_REVERSE } from '../models/DeviceInspectionPlan.js'

// 状态数值反向映射：字符串状态名 → 数值（model 的 status getter 会把 0/1/2 转成中文，
// 列表查询场景下需要把中文/数字混用的查询参数统一为数值集合）
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

// 取数值化的状态值（绕过 model 的 getter），便于状态流转判断
const rawStatus = (record: any): number => {
  return record.getDataValue('status')
}

// 当日日期（YYYY-MM-DD）
function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

// 获取点检计划详情（含点检记录和图片）
async function getDetail(id: number) {
  const record = await DeviceInspectionPlan.findOne({
    where: { plan_id: id },
    include: [
      {
        model: DeviceInspectionRecord,
        as: 'records',
        required: false,
        separate: true,
        order: [['sort_order', 'ASC'], ['record_id', 'ASC']],
      },
      {
        model: DeviceImage,
        as: 'inspection_images',
        required: false,
        separate: true,
        order: [['sort_order', 'ASC'], ['image_id', 'ASC']],
      },
    ],
  })
  return record ? record.toJSON() : null
}

export default {
  // ===================== 点检标准 =====================

  /**
   * 查询点检标准列表（按设备筛选）
   */
  async listStandards(req: any, res: any) {
    try {
      const { device_id, status, item_name, keyword } = req.query
      const where: any = {}
      if (device_id) where.device_id = device_id
      if (status !== undefined && status !== '' && status !== null) {
        where.status = Number(status)
      }
      if (item_name) {
        where.item_name = { [Op.like]: `%${item_name}%` }
      } else if (keyword) {
        where.item_name = { [Op.like]: `%${keyword}%` }
      }

      const rows = await DeviceInspectionStandard.findAll({
        where,
        include: [{ model: Device, as: 'device', required: false }],
        order: [['device_id', 'ASC'], ['sort_order', 'ASC'], ['standard_id', 'ASC']],
      })

      success(res, { list: rows, total: rows.length })
    } catch (err: any) {
      logger.error('[DeviceInspection] listStandards error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 创建点检标准
   */
  async createStandard(req: any, res: any) {
    try {
      const { device_id, device_code, device_name, item_name, standard_value, judge_type, unit, sort_order, status, remarks } = req.body

      if (!device_id) {
        return fail(res, '设备ID不能为空', ErrorCode.PARAM_INVALID)
      }
      if (!item_name) {
        return fail(res, '点检项目名称不能为空', ErrorCode.PARAM_INVALID)
      }

      // 自动补全设备冗余字段
      let finalDeviceCode = device_code
      let finalDeviceName = device_name
      if (!finalDeviceCode || !finalDeviceName) {
        const device = await Device.findOne({ where: { device_id } })
        if (!device) {
          return fail(res, '设备不存在', ErrorCode.RECORD_NOT_FOUND)
        }
        finalDeviceCode = finalDeviceCode || (device as any).device_code
        finalDeviceName = finalDeviceName || (device as any).device_name
      }

      const record = await DeviceInspectionStandard.create({
        device_id,
        device_code: finalDeviceCode,
        device_name: finalDeviceName,
        item_name,
        standard_value: standard_value || '',
        judge_type: judge_type || '定性',
        unit: unit || '',
        sort_order: sort_order || 0,
        status: status !== undefined ? status : 1,
        remarks: remarks || '',
      })

      success(res, record, '创建成功')
    } catch (err: any) {
      logger.error('[DeviceInspection] createStandard error:', err)
      fail(res, err.message || '创建失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 更新点检标准
   */
  async updateStandard(req: any, res: any) {
    try {
      const { id } = req.params
      const record = await DeviceInspectionStandard.findOne({ where: { standard_id: id } })
      if (!record) {
        return fail(res, '点检标准不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const { device_id, device_code, device_name, item_name, standard_value, judge_type, unit, sort_order, status, remarks } = req.body

      // 设备冗余字段自动补全
      let finalDeviceCode = device_code
      let finalDeviceName = device_name
      const targetDeviceId = device_id || (record as any).device_id
      if ((device_id || (!device_code && !device_name)) && (!finalDeviceCode || !finalDeviceName)) {
        const device = await Device.findOne({ where: { device_id: targetDeviceId } })
        if (device) {
          finalDeviceCode = finalDeviceCode || (device as any).device_code
          finalDeviceName = finalDeviceName || (device as any).device_name
        }
      }

      await record.update({
        device_id: device_id || (record as any).device_id,
        device_code: finalDeviceCode || (record as any).device_code,
        device_name: finalDeviceName || (record as any).device_name,
        item_name: item_name || undefined,
        standard_value: standard_value !== undefined ? standard_value : undefined,
        judge_type: judge_type || undefined,
        unit: unit !== undefined ? unit : undefined,
        sort_order: sort_order !== undefined ? sort_order : undefined,
        status: status !== undefined ? status : undefined,
        remarks: remarks !== undefined ? remarks : undefined,
      })

      success(res, record, '更新成功')
    } catch (err: any) {
      logger.error('[DeviceInspection] updateStandard error:', err)
      fail(res, err.message || '更新失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 删除点检标准
   */
  async deleteStandard(req: any, res: any) {
    try {
      const { id } = req.params
      const record = await DeviceInspectionStandard.findOne({ where: { standard_id: id } })
      if (!record) {
        return fail(res, '点检标准不存在', ErrorCode.RECORD_NOT_FOUND)
      }
      await record.destroy()
      success(res, { message: '删除成功' }, '删除成功')
    } catch (err: any) {
      logger.error('[DeviceInspection] deleteStandard error:', err)
      fail(res, err.message || '删除失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  // ===================== 点检计划 =====================

  /**
   * 分页查询点检计划（按日期、设备、状态、点检人筛选）
   */
  async listPlans(req: any, res: any) {
    try {
      const {
        page = 1,
        page_size = 20,
        plan_date,
        start_date,
        end_date,
        device_id,
        device_name,
        device_code,
        status,
        inspector_id,
      } = req.query

      const where: any = {}
      if (plan_date) where.plan_date = plan_date
      if (start_date || end_date) {
        where.plan_date = {}
        if (start_date) where.plan_date[Op.gte] = String(start_date)
        if (end_date) where.plan_date[Op.lte] = String(end_date)
      }
      if (device_id) where.device_id = device_id
      if (device_name) where.device_name = { [Op.like]: `%${device_name}%` }
      if (device_code) where.device_code = { [Op.like]: `%${device_code}%` }
      if (inspector_id) where.inspector_id = inspector_id

      const statusArr = parseMultiStatus(status)
      if (statusArr) where.status = { [Op.in]: statusArr }

      const pageNum = Math.max(1, Number(page) || 1)
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(page_size) || 20))

      const { count, rows } = await DeviceInspectionPlan.findAndCountAll({
        where,
        order: [['plan_date', 'DESC'], ['plan_id', 'DESC']],
        limit: pageSize,
        offset: (pageNum - 1) * pageSize,
      })

      success(res, { list: rows, total: count, page: pageNum, page_size: pageSize })
    } catch (err: any) {
      logger.error('[DeviceInspection] listPlans error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 获取点检计划详情（含点检记录和图片）
   */
  async detailPlan(req: any, res: any) {
    try {
      const { id } = req.params
      const record = await getDetail(Number(id))
      if (!record) {
        return fail(res, '点检计划不存在', ErrorCode.RECORD_NOT_FOUND)
      }
      success(res, record)
    } catch (err: any) {
      logger.error('[DeviceInspection] detailPlan error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 手动生成当日点检计划
   * - 查询所有启用状态的点检标准，按设备分组
   * - 为每个设备生成当日点检计划（已存在则跳过，避免重复）
   */
  async generatePlans(req: any, res: any) {
    const t = await DeviceInspectionPlan.sequelize.transaction()
    try {
      const { plan_date } = req.body || {}
      const targetDate = plan_date || todayStr()

      // 查询所有启用的点检标准，按 device_id 在内存中分组去重
      const standards = await DeviceInspectionStandard.findAll({
        where: { status: 1 },
        attributes: ['device_id', 'device_code', 'device_name'],
        transaction: t,
      })

      if (standards.length === 0) {
        await t.commit()
        return success(res, { created: 0, total: 0, message: '没有启用状态的点检标准' }, '生成完成')
      }

      // 按 device_id 分组（冗余字段取首个非空值）
      const deviceMap = new Map<number, { device_code: string | null; device_name: string | null }>()
      standards.forEach((s: any) => {
        const deviceId = s.getDataValue('device_id')
        if (!deviceId || deviceMap.has(deviceId)) return
        deviceMap.set(deviceId, {
          device_code: s.getDataValue('device_code'),
          device_name: s.getDataValue('device_name'),
        })
      })

      // 查询当日已存在的计划，避免重复生成
      const existed = await DeviceInspectionPlan.findAll({
        where: { plan_date: targetDate },
        attributes: ['device_id'],
        transaction: t,
      })
      const existedDeviceIds = new Set(existed.map((p: any) => p.getDataValue('device_id')))

      const toCreate: any[] = []
      deviceMap.forEach((info, deviceId) => {
        if (existedDeviceIds.has(deviceId)) return
        toCreate.push({
          plan_date: targetDate,
          device_id: deviceId,
          device_code: info.device_code,
          device_name: info.device_name,
          status: 0,
        })
      })

      if (toCreate.length === 0) {
        await t.commit()
        return success(res, { created: 0, total: 0, plan_date: targetDate, message: '当日点检计划已存在' }, '生成完成')
      }

      const created = await DeviceInspectionPlan.bulkCreate(toCreate, { transaction: t })
      await t.commit()

      success(res, { created: created.length, total: created.length, plan_date: targetDate }, `成功生成${created.length}条点检计划`)
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[DeviceInspection] generatePlans error:', err)
      fail(res, err.message || '生成失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 提交点检结果
   * - 批量保存各项目结果
   * - 异常项自动创建故障工单（等级=一般, source=点检异常, related_inspection_id=点检记录ID）
   * - 支持上传图片
   * 状态 0=待检 → 1=已完成
   */
  async submitInspection(req: any, res: any) {
    const t = await DeviceInspectionPlan.sequelize.transaction()
    try {
      const { id } = req.params
      const userInfo: any = (req as any).user || {}
      const {
        inspector_id,
        inspector_name,
        inspection_time,
        remarks,
        items = [],
      } = req.body || {}

      const plan = await DeviceInspectionPlan.findOne({ where: { plan_id: id }, transaction: t })
      if (!plan) {
        // 清理可能上传的临时文件
        const files = (req as any).files || ((req as any).file ? [(req as any).file] : [])
        files.forEach((f: any) => { try { fs.unlinkSync(f.path) } catch { /* ignore */ } })
        return fail(res, '点检计划不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const s = rawStatus(plan)
      if (s === 1) {
        return fail(res, '该点检计划已完成', ErrorCode.BUSINESS_ERROR)
      }

      if (!Array.isArray(items) || items.length === 0) {
        return fail(res, '点检项目结果不能为空', ErrorCode.PARAM_INVALID)
      }

      const deviceId = plan.getDataValue('device_id')
      const deviceCode = plan.getDataValue('device_code')
      const deviceName = plan.getDataValue('device_name')
      const finalInspectorId = inspector_id || userInfo.userId || null
      const finalInspectorName = inspector_name || userInfo.username || ''
      const inspectTime = inspection_time ? new Date(inspection_time) : new Date()

      // 先清理旧记录（再次提交场景），再批量写入
      await DeviceInspectionRecord.destroy({ where: { plan_id: id }, transaction: t })

      const records: any[] = []
      let abnormalCount = 0
      for (let i = 0; i < items.length; i++) {
        const it = items[i] || {}
        const isAbnormal = String(it.result || '').trim() === '异常'
        if (isAbnormal) abnormalCount += 1

        const rec = await DeviceInspectionRecord.create({
          plan_id: Number(id),
          device_id: deviceId,
          standard_id: it.standard_id || null,
          item_name: it.item_name || '',
          standard_value: it.standard_value || '',
          actual_value: it.actual_value || '',
          judge_type: it.judge_type || '',
          unit: it.unit || '',
          result: it.result || '',
          abnormal_desc: it.abnormal_desc || '',
          sort_order: it.sort_order !== undefined ? it.sort_order : i,
        }, { transaction: t })
        records.push(rec)

        // 异常项自动创建故障工单
        if (isAbnormal) {
          const fault_no = await generateDeviceFaultNo()
          const faultDesc = `点检异常：${it.item_name || '未知项目'}`
          const desc = it.abnormal_desc ? `${faultDesc} - ${it.abnormal_desc}` : faultDesc
          await DeviceFault.create({
            fault_no,
            device_id: deviceId,
            device_code: deviceCode,
            device_name: deviceName,
            fault_level: 1,
            fault_desc: desc,
            fault_time: inspectTime,
            impact_desc: it.abnormal_desc || '',
            status: 0,
            reporter_id: finalInspectorId,
            reporter_name: finalInspectorName,
            source: '点检异常',
            related_inspection_id: rec.getDataValue('record_id'),
            remarks: `由点检计划#${id}自动生成`,
          }, { transaction: t })
        }
      }

      // 更新计划状态
      await plan.update({
        status: 1,
        inspector_id: finalInspectorId,
        inspector_name: finalInspectorName,
        inspection_time: inspectTime,
        result: abnormalCount > 0 ? '异常' : '正常',
        abnormal_count: abnormalCount,
        remarks: remarks !== undefined ? remarks : (plan as any).remarks,
      }, { transaction: t })

      // 处理可能附带上传的图片（若路由层挂载了 multer）
      const files: any[] = (req as any).files || ((req as any).file ? [(req as any).file] : [])
      if (files.length > 0) {
        const uploadsDir = path.resolve(process.cwd(), 'uploads', 'device', 'inspection')
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
        const existingCount = await DeviceImage.count({
          where: { doc_type: 'inspection', doc_id: Number(id) },
          transaction: t,
        })
        const ts = Date.now()
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          const seqNum = existingCount + i + 1
          const ext = path.extname(file.originalname) || '.jpg'
          const newName = `inspection_${id}_${seqNum}_${ts}${ext}`
          const destPath = path.join(uploadsDir, newName)
          fs.renameSync(file.path, destPath)
          await DeviceImage.create({
            doc_type: 'inspection',
            doc_id: Number(id),
            file_path: `/uploads/device/inspection/${newName}`,
            file_name: file.originalname || newName,
            file_size: file.size || null,
            sort_order: seqNum,
            uploaded_by: finalInspectorId,
            uploaded_by_name: finalInspectorName,
          }, { transaction: t })
        }
      }

      await t.commit()
      const detail = await getDetail(Number(id))
      success(res, detail, abnormalCount > 0 ? `提交成功，发现${abnormalCount}项异常并已转故障` : '提交成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      // 清理已落地的临时文件
      const files = (req as any).files || ((req as any).file ? [(req as any).file] : [])
      files.forEach((f: any) => { try { fs.unlinkSync(f.path) } catch { /* ignore */ } })
      logger.error('[DeviceInspection] submitInspection error:', err)
      fail(res, err.message || '提交失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  // ===================== 点检记录 =====================

  /**
   * 查询点检记录（按计划/设备/结果筛选）
   */
  async listRecords(req: any, res: any) {
    try {
      const { plan_id, device_id, result } = req.query
      const where: any = {}
      if (plan_id) where.plan_id = plan_id
      if (device_id) where.device_id = device_id
      if (result) where.result = result

      const rows = await DeviceInspectionRecord.findAll({
        where,
        order: [['plan_id', 'DESC'], ['sort_order', 'ASC'], ['record_id', 'ASC']],
      })

      success(res, { list: rows, total: rows.length })
    } catch (err: any) {
      logger.error('[DeviceInspection] listRecords error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  // ===================== 点检图片 =====================

  /**
   * 获取点检图片（doc_type=inspection）
   */
  async getImages(req: any, res: any) {
    try {
      const { id } = req.params
      const exists = await DeviceInspectionPlan.findOne({ where: { plan_id: id }, attributes: ['plan_id'] })
      if (!exists) {
        return fail(res, '点检计划不存在', ErrorCode.RECORD_NOT_FOUND)
      }
      const images = await DeviceImage.findAll({
        where: { doc_type: 'inspection', doc_id: id },
        order: [['sort_order', 'ASC'], ['image_id', 'ASC']],
      })
      success(res, images, '查询成功')
    } catch (err: any) {
      logger.error('[DeviceInspection] getImages error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 上传点检图片
   * - 单文件或多文件上传，按 doc_type=inspection 入库
   * - 命名规范：inspection_{plan_id}_{序号}_{时间戳}.ext
   * - 路由层已挂载 multer，文件位于 req.files / req.file
   */
  async uploadImage(req: any, res: any) {
    const t = await DeviceImage.sequelize.transaction()
    try {
      const { id } = req.params
      const userInfo: any = (req as any).user || {}

      const plan = await DeviceInspectionPlan.findOne({ where: { plan_id: id }, transaction: t })
      if (!plan) {
        const files = (req as any).files || ((req as any).file ? [(req as any).file] : [])
        files.forEach((f: any) => { try { fs.unlinkSync(f.path) } catch { /* ignore */ } })
        return fail(res, '点检计划不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const files: any[] = (req as any).files || ((req as any).file ? [(req as any).file] : [])
      if (files.length === 0) {
        return fail(res, '请选择要上传的图片', ErrorCode.PARAM_INVALID)
      }

      const uploadsDir = path.resolve(process.cwd(), 'uploads', 'device', 'inspection')
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

      const existingCount = await DeviceImage.count({
        where: { doc_type: 'inspection', doc_id: Number(id) },
        transaction: t,
      })

      const created: any[] = []
      const ts = Date.now()
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const seqNum = existingCount + i + 1
        const ext = path.extname(file.originalname) || '.jpg'
        const newName = `inspection_${id}_${seqNum}_${ts}${ext}`
        const destPath = path.join(uploadsDir, newName)
        fs.renameSync(file.path, destPath)

        const rel = await DeviceImage.create({
          doc_type: 'inspection',
          doc_id: Number(id),
          file_path: `/uploads/device/inspection/${newName}`,
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
      logger.error('[DeviceInspection] uploadImage error:', err)
      fail(res, err.message || '上传失败', ErrorCode.SYSTEM_ERROR)
    }
  },
}
