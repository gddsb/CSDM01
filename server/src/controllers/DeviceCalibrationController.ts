import path from 'path'
import fs from 'fs'
import { Op } from 'sequelize'
import {
  DeviceCalibrationPlan,
  DeviceCalibrationRecord,
  Device,
  DeviceImage,
} from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { logger } from '../utils/logger.js'
import { STATUS_REVERSE } from '../models/DeviceCalibrationPlan.js'

// 状态数值反向映射：字符串状态名 → 数值（model 的 status getter 会把 0/1/2/3 转成中文，
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

// 日期字符串加月数（YYYY-MM-DD）
function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

// 日期字符串加天数（YYYY-MM-DD）
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

// 根据上次校准日期（或当天）与校准周期计算下次校准日期
function calcNextDate(lastDate: string | null | undefined, cycle: number): string {
  const base = lastDate ? String(lastDate).slice(0, 10) : todayStr()
  return addMonths(base, cycle)
}

// 获取校准计划详情（含历史校准记录与证书图片）
async function getDetail(id: number) {
  const record = await DeviceCalibrationPlan.findOne({
    where: { plan_id: id },
    include: [
      {
        model: DeviceCalibrationRecord,
        as: 'records',
        required: false,
        separate: true,
        order: [['calibration_date', 'DESC'], ['record_id', 'DESC']],
        include: [
          {
            model: DeviceImage,
            as: 'calibration_images',
            required: false,
            separate: true,
            order: [['sort_order', 'ASC'], ['image_id', 'ASC']],
          },
        ],
      },
      { model: Device, as: 'device', required: false },
    ],
  })
  return record ? record.toJSON() : null
}

export default {
  /**
   * 分页查询校准计划（按设备、状态、到期日期筛选）
   */
  async listPlans(req: any, res: any) {
    try {
      const {
        page = 1,
        page_size = 20,
        device_id,
        device_name,
        device_code,
        status,
        start_date,
        end_date,
        keyword,
      } = req.query

      const where: any = {}
      if (device_id) where.device_id = device_id
      if (device_name) where.device_name = { [Op.like]: `%${device_name}%` }
      if (device_code) where.device_code = { [Op.like]: `%${device_code}%` }
      if (keyword) {
        where[Op.or] = [
          { device_name: { [Op.like]: `%${keyword}%` } },
          { device_code: { [Op.like]: `%${keyword}%` } },
        ]
      }
      if (start_date || end_date) {
        where.next_calibration_date = {}
        if (start_date) where.next_calibration_date[Op.gte] = String(start_date)
        if (end_date) where.next_calibration_date[Op.lte] = String(end_date)
      }

      const statusArr = parseMultiStatus(status)
      if (statusArr) where.status = { [Op.in]: statusArr }

      const pageNum = Math.max(1, Number(page) || 1)
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(page_size) || 20))

      const { count, rows } = await DeviceCalibrationPlan.findAndCountAll({
        where,
        order: [['next_calibration_date', 'ASC'], ['plan_id', 'DESC']],
        limit: pageSize,
        offset: (pageNum - 1) * pageSize,
      })

      success(res, { list: rows, total: count, page: pageNum, page_size: pageSize })
    } catch (err: any) {
      logger.error('[DeviceCalibration] listPlans error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 获取校准计划详情（含历史校准记录与证书）
   */
  async detailPlan(req: any, res: any) {
    try {
      const { id } = req.params
      const record = await getDetail(Number(id))
      if (!record) {
        return fail(res, '校准计划不存在', ErrorCode.RECORD_NOT_FOUND)
      }
      success(res, record)
    } catch (err: any) {
      logger.error('[DeviceCalibration] detailPlan error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 创建校准计划（自动计算下次校准日期）
   */
  async createPlan(req: any, res: any) {
    try {
      const {
        device_id,
        device_code,
        device_name,
        calibration_cycle,
        last_calibration_date,
        calibration_org,
        calibration_items,
        status,
        remarks,
      } = req.body || {}

      if (!device_id) {
        return fail(res, '设备ID不能为空', ErrorCode.PARAM_INVALID)
      }
      const cycle = Number(calibration_cycle)
      if (!cycle || cycle <= 0) {
        return fail(res, '校准周期必须为正整数', ErrorCode.PARAM_INVALID)
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

      const lastDate = last_calibration_date ? String(last_calibration_date).slice(0, 10) : null
      const nextDate = calcNextDate(lastDate, cycle)

      const record = await DeviceCalibrationPlan.create({
        device_id,
        device_code: finalDeviceCode,
        device_name: finalDeviceName,
        calibration_cycle: cycle,
        last_calibration_date: lastDate,
        next_calibration_date: nextDate,
        calibration_org: calibration_org || '',
        calibration_items: calibration_items || null,
        status: status !== undefined ? status : 0,
        remarks: remarks || '',
      })

      success(res, record, '创建成功')
    } catch (err: any) {
      logger.error('[DeviceCalibration] createPlan error:', err)
      fail(res, err.message || '创建失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 更新校准计划（校准周期或上次校准日期变化时自动重算下次校准日期）
   */
  async updatePlan(req: any, res: any) {
    try {
      const { id } = req.params
      const plan = await DeviceCalibrationPlan.findOne({ where: { plan_id: id } })
      if (!plan) {
        return fail(res, '校准计划不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const {
        device_id,
        device_code,
        device_name,
        calibration_cycle,
        last_calibration_date,
        calibration_org,
        calibration_items,
        status,
        remarks,
      } = req.body || {}

      // 设备冗余字段自动补全
      let finalDeviceCode = device_code
      let finalDeviceName = device_name
      const targetDeviceId = device_id || (plan as any).device_id
      if (device_id && (!finalDeviceCode || !finalDeviceName)) {
        const device = await Device.findOne({ where: { device_id: targetDeviceId } })
        if (device) {
          finalDeviceCode = finalDeviceCode || (device as any).device_code
          finalDeviceName = finalDeviceName || (device as any).device_name
        }
      }

      const oldCycle = Number((plan as any).calibration_cycle)
      const newCycle = calibration_cycle !== undefined ? Number(calibration_cycle) : oldCycle
      const oldLastDate = (plan as any).last_calibration_date
        ? String((plan as any).last_calibration_date).slice(0, 10)
        : null
      const newLastDate = last_calibration_date !== undefined
        ? (last_calibration_date ? String(last_calibration_date).slice(0, 10) : null)
        : oldLastDate

      const update: any = {}
      if (device_id !== undefined) update.device_id = device_id
      if (finalDeviceCode !== undefined) update.device_code = finalDeviceCode || (plan as any).device_code
      if (finalDeviceName !== undefined) update.device_name = finalDeviceName || (plan as any).device_name
      if (calibration_cycle !== undefined) update.calibration_cycle = newCycle
      if (last_calibration_date !== undefined) update.last_calibration_date = newLastDate
      if (calibration_org !== undefined) update.calibration_org = calibration_org
      if (calibration_items !== undefined) update.calibration_items = calibration_items
      if (status !== undefined) update.status = status
      if (remarks !== undefined) update.remarks = remarks

      // 周期或上次校准日期变化时重算下次校准日期
      if (calibration_cycle !== undefined || last_calibration_date !== undefined) {
        update.next_calibration_date = calcNextDate(newLastDate, newCycle)
      }

      await plan.update(update)
      success(res, plan, '更新成功')
    } catch (err: any) {
      logger.error('[DeviceCalibration] updatePlan error:', err)
      fail(res, err.message || '更新失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 删除校准计划（级联删除其校准记录与证书图片）
   */
  async deletePlan(req: any, res: any) {
    const t = await DeviceCalibrationPlan.sequelize.transaction()
    try {
      const { id } = req.params
      const plan = await DeviceCalibrationPlan.findOne({ where: { plan_id: id }, transaction: t })
      if (!plan) {
        await t.rollback()
        return fail(res, '校准计划不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      // 删除关联的校准证书图片（doc_type=calibration, doc_id=各记录ID）
      const records = await DeviceCalibrationRecord.findAll({
        where: { plan_id: id },
        attributes: ['record_id'],
        transaction: t,
      })
      const recordIds = records.map((r: any) => r.getDataValue('record_id'))
      if (recordIds.length > 0) {
        await DeviceImage.destroy({
          where: { doc_type: 'calibration', doc_id: { [Op.in]: recordIds } },
          transaction: t,
        })
      }
      await DeviceCalibrationRecord.destroy({ where: { plan_id: id }, transaction: t })
      await plan.destroy({ transaction: t })

      await t.commit()
      success(res, { message: '删除成功' }, '删除成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch { /* ignore */ } }
      logger.error('[DeviceCalibration] deletePlan error:', err)
      fail(res, err.message || '删除失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 提交校准结果
   * - 创建校准记录
   * - 更新计划的 last_calibration_date 与 next_calibration_date
   * - 计划状态置为已校准（1）；若不合格则保持待校准并标记备注
   * - 若请求中携带证书文件（multer），则保存为 DeviceImage(doc_type=calibration)
   */
  async submitCalibration(req: any, res: any) {
    const t = await DeviceCalibrationPlan.sequelize.transaction()
    try {
      const { id } = req.params
      const userInfo: any = (req as any).user || {}
      const {
        calibration_date,
        calibration_result,
        calibration_org,
        certificate_no,
        valid_until,
        cost,
        calibration_items,
        operator_id,
        operator_name,
        remarks,
      } = req.body || {}

      const plan = await DeviceCalibrationPlan.findOne({ where: { plan_id: id }, transaction: t })
      if (!plan) {
        const files = (req as any).files || ((req as any).file ? [(req as any).file] : [])
        files.forEach((f: any) => { try { fs.unlinkSync(f.path) } catch { /* ignore */ } })
        await t.rollback()
        return fail(res, '校准计划不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      if (!calibration_date) {
        const files = (req as any).files || ((req as any).file ? [(req as any).file] : [])
        files.forEach((f: any) => { try { fs.unlinkSync(f.path) } catch { /* ignore */ } })
        await t.rollback()
        return fail(res, '校准日期不能为空', ErrorCode.PARAM_INVALID)
      }

      const cycle = Number((plan as any).calibration_cycle) || 12
      const calDate = String(calibration_date).slice(0, 10)
      const nextDate = calcNextDate(calDate, cycle)

      // 校准结果：1=合格, 2=不合格
      let resultNum: number
      if (typeof calibration_result === 'number') {
        resultNum = calibration_result
      } else if (typeof calibration_result === 'string') {
        resultNum = calibration_result === '不合格' ? 2 : 1
      } else {
        resultNum = 1
      }

      const deviceId = plan.getDataValue('device_id')
      const deviceCode = plan.getDataValue('device_code')
      const deviceName = plan.getDataValue('device_name')
      const finalOperatorId = operator_id || userInfo.userId || null
      const finalOperatorName = operator_name || userInfo.username || ''

      // 处理可能附带上传的证书文件（若路由层挂载了 multer）
      const files: any[] = (req as any).files || ((req as any).file ? [(req as any).file] : [])
      let certificatePath: string | null = null

      // 创建校准记录
      const record = await DeviceCalibrationRecord.create({
        plan_id: Number(id),
        device_id: deviceId,
        device_code: deviceCode,
        device_name: deviceName,
        calibration_date: calDate,
        calibration_org: calibration_org || (plan as any).calibration_org || '',
        calibration_result: resultNum,
        certificate_no: certificate_no || '',
        certificate_path: certificatePath,
        valid_until: valid_until ? String(valid_until).slice(0, 10) : nextDate,
        cost: cost !== undefined && cost !== null && cost !== '' ? cost : null,
        calibration_items: calibration_items || (plan as any).calibration_items || null,
        operator_id: finalOperatorId,
        operator_name: finalOperatorName,
        remarks: remarks || '',
      }, { transaction: t })

      // 保存证书文件并关联到该记录
      if (files.length > 0) {
        const uploadsDir = path.resolve(process.cwd(), 'uploads', 'device', 'calibration')
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
        const recordId = record.getDataValue('record_id')
        const ts = Date.now()
        let primaryPath: string | null = null
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          const seqNum = i + 1
          const ext = path.extname(file.originalname) || '.jpg'
          const newName = `calibration_${recordId}_${seqNum}_${ts}${ext}`
          const destPath = path.join(uploadsDir, newName)
          fs.renameSync(file.path, destPath)
          const relPath = `/uploads/device/calibration/${newName}`
          await DeviceImage.create({
            doc_type: 'calibration',
            doc_id: recordId,
            file_path: relPath,
            file_name: file.originalname || newName,
            file_size: file.size || null,
            sort_order: seqNum,
            uploaded_by: finalOperatorId,
            uploaded_by_name: finalOperatorName,
          }, { transaction: t })
          if (i === 0) primaryPath = relPath
        }
        if (primaryPath) {
          await record.update({ certificate_path: primaryPath }, { transaction: t })
        }
      }

      // 更新计划：上次/下次校准日期、状态
      await plan.update({
        last_calibration_date: calDate,
        next_calibration_date: nextDate,
        status: resultNum === 1 ? 1 : 0,
        calibration_org: calibration_org || (plan as any).calibration_org,
        remarks: remarks !== undefined ? remarks : (plan as any).remarks,
      }, { transaction: t })

      await t.commit()
      const detail = await getDetail(Number(id))
      success(res, detail, resultNum === 1 ? '校准提交成功' : '校准结果不合格，请尽快复校')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch { /* ignore */ } }
      const files = (req as any).files || ((req as any).file ? [(req as any).file] : [])
      files.forEach((f: any) => { try { fs.unlinkSync(f.path) } catch { /* ignore */ } })
      logger.error('[DeviceCalibration] submitCalibration error:', err)
      fail(res, err.message || '提交失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 查询校准记录（按计划/设备/结果/日期筛选）
   */
  async listRecords(req: any, res: any) {
    try {
      const { plan_id, device_id, calibration_result, start_date, end_date } = req.query
      const where: any = {}
      if (plan_id) where.plan_id = plan_id
      if (device_id) where.device_id = device_id
      if (calibration_result) {
        // 兼容中文/数字
        if (calibration_result === '合格' || calibration_result === 1 || calibration_result === '1') {
          where.calibration_result = 1
        } else if (calibration_result === '不合格' || calibration_result === 2 || calibration_result === '2') {
          where.calibration_result = 2
        }
      }
      if (start_date || end_date) {
        where.calibration_date = {}
        if (start_date) where.calibration_date[Op.gte] = String(start_date)
        if (end_date) where.calibration_date[Op.lte] = String(end_date)
      }

      const rows = await DeviceCalibrationRecord.findAll({
        where,
        order: [['calibration_date', 'DESC'], ['record_id', 'DESC']],
      })

      success(res, { list: rows, total: rows.length })
    } catch (err: any) {
      logger.error('[DeviceCalibration] listRecords error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 获取即将到期（30天内）的校准计划
   */
  async getExpiringSoon(req: any, res: any) {
    try {
      const today = todayStr()
      const deadline = addDays(today, 30)
      const rows = await DeviceCalibrationPlan.findAll({
        where: {
          next_calibration_date: { [Op.gte]: today, [Op.lte]: deadline },
          status: { [Op.notIn]: [1, 3] },
        },
        order: [['next_calibration_date', 'ASC'], ['plan_id', 'DESC']],
      })
      success(res, { list: rows, total: rows.length, deadline })
    } catch (err: any) {
      logger.error('[DeviceCalibration] getExpiringSoon error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 获取已超期的校准计划
   */
  async getOverdue(req: any, res: any) {
    try {
      const today = todayStr()
      const rows = await DeviceCalibrationPlan.findAll({
        where: {
          next_calibration_date: { [Op.lt]: today },
          status: { [Op.notIn]: [1, 3] },
        },
        order: [['next_calibration_date', 'ASC'], ['plan_id', 'DESC']],
      })
      success(res, { list: rows, total: rows.length })
    } catch (err: any) {
      logger.error('[DeviceCalibration] getOverdue error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 上传校准证书
   * - 路由层已挂载 multer，文件位于 req.files / req.file
   * - 证书关联到该计划最近一次校准记录（doc_type=calibration, doc_id=record_id）
   * - 同时回写 record.certificate_path（首张证书）
   */
  async uploadCertificate(req: any, res: any) {
    const t = await DeviceImage.sequelize.transaction()
    try {
      const { id } = req.params
      const userInfo: any = (req as any).user || {}

      const plan = await DeviceCalibrationPlan.findOne({ where: { plan_id: id }, transaction: t })
      if (!plan) {
        const files = (req as any).files || ((req as any).file ? [(req as any).file] : [])
        files.forEach((f: any) => { try { fs.unlinkSync(f.path) } catch { /* ignore */ } })
        await t.rollback()
        return fail(res, '校准计划不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const files: any[] = (req as any).files || ((req as any).file ? [(req as any).file] : [])
      if (files.length === 0) {
        await t.rollback()
        return fail(res, '请选择要上传的证书文件', ErrorCode.PARAM_INVALID)
      }

      // 找到该计划最近一次校准记录
      const record = await DeviceCalibrationRecord.findOne({
        where: { plan_id: id },
        order: [['calibration_date', 'DESC'], ['record_id', 'DESC']],
        transaction: t,
      })
      if (!record) {
        const files2 = (req as any).files || ((req as any).file ? [(req as any).file] : [])
        files2.forEach((f: any) => { try { fs.unlinkSync(f.path) } catch { /* ignore */ } })
        await t.rollback()
        return fail(res, '请先提交校准结果后再上传证书', ErrorCode.BUSINESS_ERROR)
      }

      const recordId = record.getDataValue('record_id')
      const uploadsDir = path.resolve(process.cwd(), 'uploads', 'device', 'calibration')
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

      const existingCount = await DeviceImage.count({
        where: { doc_type: 'calibration', doc_id: recordId },
        transaction: t,
      })

      const created: any[] = []
      const ts = Date.now()
      let primaryPath: string | null = null
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const seqNum = existingCount + i + 1
        const ext = path.extname(file.originalname) || '.jpg'
        const newName = `calibration_${recordId}_${seqNum}_${ts}${ext}`
        const destPath = path.join(uploadsDir, newName)
        fs.renameSync(file.path, destPath)
        const relPath = `/uploads/device/calibration/${newName}`
        const rel = await DeviceImage.create({
          doc_type: 'calibration',
          doc_id: recordId,
          file_path: relPath,
          file_name: file.originalname || newName,
          file_size: file.size || null,
          sort_order: seqNum,
          uploaded_by: userInfo.userId || null,
          uploaded_by_name: userInfo.username || '',
        }, { transaction: t })
        created.push(rel)
        if (i === 0) primaryPath = relPath
      }

      // 回写记录的证书路径（若原为空）
      const currentPath = record.getDataValue('certificate_path')
      if (primaryPath && !currentPath) {
        await record.update({ certificate_path: primaryPath }, { transaction: t })
      }

      await t.commit()
      success(res, created, `成功上传${created.length}个证书`)
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch { /* ignore */ } }
      const files = (req as any).files || ((req as any).file ? [(req as any).file] : [])
      files.forEach((f: any) => { try { fs.unlinkSync(f.path) } catch { /* ignore */ } })
      logger.error('[DeviceCalibration] uploadCertificate error:', err)
      fail(res, err.message || '上传失败', ErrorCode.SYSTEM_ERROR)
    }
  },
}
