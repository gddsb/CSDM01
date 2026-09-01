import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import sharp from 'sharp'
import { Op } from 'sequelize'
import {
  DeviceMaintenanceStandard,
  DeviceMaintenanceProfile,
  DeviceMaintenanceRecord,
  DeviceRuntimeLog,
  Device,
  DeviceImage,
  DeviceFault,
} from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import { generateDeviceFaultNo, generateDeviceRecordNo } from '../utils/sequence.js'
import { logger } from '../utils/logger.js'
import { STATUS_REVERSE } from '../models/DeviceMaintenanceRecord.js'
import {
  todayStr,
  dateOnlyStr,
  getISOWeek,
  buildPeriodKey,
  parseMultiStatus,
  dailyPeriodKeys,
  weeklyPeriodKeys,
  parseMonthlyPlan,
  monthlyStandardActive,
} from '../utils/maintenanceMatrix.js'

// 未完成工单状态集合：0=待执行, 1=执行中, 3=跳过（不含 2=已完成）
const UNFINISHED_STATUS = [0, 1, 3]

// ============================================================
// 工具函数（纯函数已移至 maintenanceMatrix.ts）
// ============================================================

// 取数值化的 status（绕过 model getter）
const rawStatus = (record: any): number => record.getDataValue('status')

// 自动补全设备冗余字段
async function loadDeviceFields(
  deviceId: number | undefined | null,
  deviceCode?: string,
  deviceName?: string,
  t?: any,
): Promise<{ finalDeviceCode: string | null; finalDeviceName: string | null }> {
  let finalDeviceCode = deviceCode
  let finalDeviceName = deviceName
  if ((!finalDeviceCode || !finalDeviceName) && deviceId) {
    const device = await Device.findOne({ where: { device_id: deviceId }, transaction: t })
    if (device) {
      finalDeviceCode = finalDeviceCode || (device as any).device_code
      finalDeviceName = finalDeviceName || (device as any).device_name
    }
  }
  return { finalDeviceCode: finalDeviceCode || null, finalDeviceName: finalDeviceName || null }
}

// 获取设备最新累计运行时长
async function getLatestRuntime(deviceId: number, t?: any): Promise<number> {
  const log = await DeviceRuntimeLog.findOne({
    where: { device_id: deviceId },
    order: [['created_at', 'DESC'], ['log_id', 'DESC']],
    transaction: t,
  })
  return log ? Number((log as any).getDataValue('runtime_hours')) : 0
}

// period_key 生成（复用公共函数，已测试）
export { buildPeriodKey } from '../utils/maintenanceMatrix.js'

// ============================================================
// 图片处理工具（压缩 + 水印 + 哈希去重 + 统一命名）
// ============================================================

/** 计算文件 SHA256（用于去重） */
function sha256File(p: string): string {
  const hash = crypto.createHash('sha256')
  hash.update(fs.readFileSync(p))
  return hash.digest('hex')
}

/** 渲染时间水印 SVG（白色半透明描边黑色，底部右对齐） */
function buildWatermarkSvg(text: string, width: number, height: number, density: number): string {
  const fontSize = Math.max(14, Math.round(width * 0.018 * density))
  const padding = Math.round(width * 0.025 * density)
  const svgW = width * density
  const svgH = height * density
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">
      <text x="${svgW - padding}" y="${svgH - padding}" font-family="sans-serif"
        font-size="${fontSize}" fill="rgba(255,255,255,0.85)" stroke="rgba(0,0,0,0.55)"
        stroke-width="2" text-anchor="end" font-weight="500">${escape(text)}</text>
    </svg>`.trim()
}

/** 处理单张图片：压缩 + 水印 + 返回 { buffer, hash, width, height, size } */
async function processImage(srcPath: string, watermarkText: string): Promise<{
  buffer: Buffer; hash: string; width: number; height: number; size: number;
}> {
  const meta = await sharp(srcPath).metadata()
  const w = meta.width || 0
  const h = meta.height || 0
  const orient = meta.orientation || 1

  // 压缩：长边 <= 1600，JPEG 质量 82（WebP 太新，老设备不识别；PNG 无损大）
  let out = sharp(srcPath).rotate() // 纠正 EXIF 方向
  if (Math.max(w, h) > 1600) {
    out = out.resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
  }
  const resizedMeta = await out.metadata()
  const rw = resizedMeta.width || w
  const rh = resizedMeta.height || h
  const density = 2 // SVG 渲染密度
  const svg = buildWatermarkSvg(watermarkText, rw, rh, density)

  const buffer = await out
    .composite([{ input: Buffer.from(svg), gravity: 'southeast' }])
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer()

  // 返回处理后元数据
  const finalMeta = await sharp(buffer).metadata()
  const hash = crypto.createHash('sha256').update(buffer).digest('hex')
  return { buffer, hash, width: finalMeta.width || rw, height: finalMeta.height || rh, size: buffer.length }
}

/** 生成统一文件名：BMIMG_{yyyymmdd}_{recordId}_{seq}_{shortHash}.jpg */
function buildImageName(recordId: number, seq: number, hash: string): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `BMIMG_${y}${m}${day}_${recordId}_${String(seq).padStart(2, '0')}_${hash.slice(0, 8)}.jpg`
}

// ============================================================
// 标准详情（含图片）
// ============================================================
async function getRecordDetail(id: number) {
  const record = await DeviceMaintenanceRecord.findOne({
    where: { record_id: id },
    include: [
      { model: DeviceMaintenanceStandard, as: 'standard', required: false },
      {
        model: DeviceImage,
        as: 'maintenance_images',
        required: false,
        separate: true,
        order: [['sort_order', 'ASC'], ['image_id', 'ASC']],
      },
    ],
  })
  return record ? record.toJSON() : null
}

// ============================================================
// 保养标准 CRUD
// ============================================================
export default {
  /**
   * 查询保养标准列表
   * 支持按设备、触发频率、关键字、状态筛选
   */
  async listStandards(req: any, res: any) {
    try {
      const { device_id, trigger_mode, status, item_name, standard_name, mechanism, keyword } = req.query
      const where: any = {}
      if (device_id) where.device_id = device_id
      if (trigger_mode) where.trigger_mode = trigger_mode
      if (status !== undefined && status !== '' && status !== null) where.status = Number(status)
      if (item_name) where.item_name = { [Op.like]: `%${item_name}%` }
      else if (standard_name) where.item_name = { [Op.like]: `%${standard_name}%` }
      else if (keyword) {
        where[Op.or] = [
          { item_name: { [Op.like]: `%${keyword}%` } },
          { mechanism: { [Op.like]: `%${keyword}%` } },
          { component: { [Op.like]: `%${keyword}%` } },
        ]
      }
      if (mechanism) where.mechanism = { [Op.like]: `%${mechanism}%` }

      const rows = await DeviceMaintenanceStandard.findAll({
        where,
        include: [{ model: Device, as: 'device', required: false }],
        order: [['device_id', 'ASC'], ['trigger_mode', 'ASC'], ['sort_order', 'ASC'], ['standard_id', 'ASC']],
      })

      success(res, { list: rows, total: rows.length })
    } catch (err: any) {
      logger.error('[DeviceMaintenance] listStandards error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 创建保养标准
   * trigger_mode 四种互斥：daily / weekly / monthly / runtime
   * - monthly 模式：monthly_plan 必须提供 12 位布尔数组
   * - runtime 模式：runtime_threshold 必须有效
   */
  async createStandard(req: any, res: any) {
    const t = await DeviceMaintenanceStandard.sequelize.transaction()
    try {
      const {
        device_id, device_code, device_name,
        item_name, mechanism, component, location, maintenance_method, maintenance_content,
        judge_type = '定性', standard_value, unit,
        point_count = 1, time_per_point = 0,
        trigger_mode = 'daily', monthly_plan, runtime_threshold,
        status = 1, remarks,
      } = req.body

      if (!device_id) return fail(res, '设备ID不能为空', ErrorCode.PARAM_INVALID)
      // 每日点检模式必须填写保养项名称；其他模式保养项名称可为空
      if (trigger_mode === 'daily' && !item_name) return fail(res, '每日点检模式保养项名称不能为空', ErrorCode.PARAM_INVALID)

      // trigger_mode 校验
      if (!['daily', 'weekly', 'monthly', 'runtime'].includes(trigger_mode)) {
        return fail(res, '触发频率无效，可选值：daily / weekly / monthly / runtime', ErrorCode.PARAM_INVALID)
      }
      if (trigger_mode === 'monthly') {
        if (!Array.isArray(monthly_plan) || monthly_plan.length !== 12) {
          return fail(res, '月度计划必须提供 12 位布尔数组，表示1月~12月', ErrorCode.PARAM_INVALID)
        }
      }
      if (trigger_mode === 'runtime' && (!runtime_threshold || Number(runtime_threshold) <= 0)) {
        return fail(res, '运行时长模式必须填写有效的运行时长阈值', ErrorCode.PARAM_INVALID)
      }

      const { finalDeviceCode, finalDeviceName } = await loadDeviceFields(device_id, device_code, device_name, t)

      const record = await DeviceMaintenanceStandard.create({
        device_id,
        device_code: finalDeviceCode,
        device_name: finalDeviceName,
        item_name,
        mechanism: mechanism || null,
        component: component || null,
        location: location || null,
        maintenance_method: maintenance_method || null,
        maintenance_content: maintenance_content || null,
        judge_type,
        standard_value: standard_value || null,
        unit: unit || null,
        point_count: point_count !== undefined ? point_count : 1,
        time_per_point: time_per_point !== undefined ? time_per_point : 0,
        trigger_mode,
        monthly_plan: trigger_mode === 'monthly' ? monthly_plan : null,
        runtime_threshold: trigger_mode === 'runtime' ? runtime_threshold : null,
        last_trigger_value: null,
        sort_order: (req.body as any).sort_order !== undefined ? (req.body as any).sort_order : 0,
        status,
        remarks: remarks || null,
      }, { transaction: t })

      await t.commit()
      success(res, record, '创建成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[DeviceMaintenance] createStandard error:', err)
      fail(res, err.message || '创建失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 更新保养标准
   */
  async updateStandard(req: any, res: any) {
    const t = await DeviceMaintenanceStandard.sequelize.transaction()
    try {
      const { id } = req.params
      const record = await DeviceMaintenanceStandard.findOne({ where: { standard_id: id }, transaction: t })
      if (!record) return fail(res, '保养标准不存在', ErrorCode.RECORD_NOT_FOUND)

      const {
        device_id, device_code, device_name,
        item_name, mechanism, component, location, maintenance_method, maintenance_content,
        judge_type, standard_value, unit,
        point_count, time_per_point,
        trigger_mode, monthly_plan, runtime_threshold,
        sort_order, status, remarks,
      } = req.body

      if (trigger_mode !== undefined && !['daily', 'weekly', 'monthly', 'runtime'].includes(trigger_mode)) {
        return fail(res, '触发频率无效', ErrorCode.PARAM_INVALID)
      }
      if (trigger_mode === 'monthly' && monthly_plan !== undefined && monthly_plan !== null) {
        if (!Array.isArray(monthly_plan) || monthly_plan.length !== 12) {
          return fail(res, '月度计划必须提供 12 位布尔数组', ErrorCode.PARAM_INVALID)
        }
      }

      // 设备冗余字段自动补全
      const targetDeviceId = device_id !== undefined ? device_id : (record as any).getDataValue('device_id')
      if (device_id !== undefined || (device_code !== undefined && !device_name) || (device_name !== undefined && !device_code)) {
        const { finalDeviceCode, finalDeviceName } = await loadDeviceFields(targetDeviceId, device_code, device_name, t)
        req.body.device_code = finalDeviceCode
        req.body.device_name = finalDeviceName
      }

      const updateData: any = {}
      if (device_id !== undefined) updateData.device_id = device_id
      if (device_code !== undefined) updateData.device_code = device_code
      if (device_name !== undefined) updateData.device_name = device_name
      if (item_name !== undefined) updateData.item_name = item_name
      if (mechanism !== undefined) updateData.mechanism = mechanism
      if (component !== undefined) updateData.component = component
      if (location !== undefined) updateData.location = location
      if (maintenance_method !== undefined) updateData.maintenance_method = maintenance_method
      if (maintenance_content !== undefined) updateData.maintenance_content = maintenance_content
      if (judge_type !== undefined) updateData.judge_type = judge_type
      if (standard_value !== undefined) updateData.standard_value = standard_value
      if (unit !== undefined) updateData.unit = unit
      if (point_count !== undefined) updateData.point_count = point_count
      if (time_per_point !== undefined) updateData.time_per_point = time_per_point
      if (trigger_mode !== undefined) updateData.trigger_mode = trigger_mode
      if (monthly_plan !== undefined) updateData.monthly_plan = monthly_plan
      if (runtime_threshold !== undefined) updateData.runtime_threshold = runtime_threshold
      if (sort_order !== undefined) updateData.sort_order = sort_order
      if (status !== undefined) updateData.status = status
      if (remarks !== undefined) updateData.remarks = remarks

      await record.update(updateData, { transaction: t })
      await t.commit()
      success(res, record, '更新成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[DeviceMaintenance] updateStandard error:', err)
      fail(res, err.message || '更新失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 删除保养标准
   */
  async deleteStandard(req: any, res: any) {
    try {
      const { id } = req.params
      const record = await DeviceMaintenanceStandard.findOne({ where: { standard_id: id } })
      if (!record) return fail(res, '保养标准不存在', ErrorCode.RECORD_NOT_FOUND)
      await record.destroy()
      success(res, { message: '删除成功' }, '删除成功')
    } catch (err: any) {
      logger.error('[DeviceMaintenance] deleteStandard error:', err)
      fail(res, err.message || '删除失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  // ============================================================
  // 设备维护标准档案（设备级，承载编制/生效/停用状态）
  // ============================================================
  /**
   * 档案列表：每行=一台设备，返回已有档案的设备 + 标准项数量 + 状态
   */
  async listProfiles(req: any, res: any) {
    try {
      const { keyword, status, page = 1, pageSize = 50 } = req.query
      const where: any = {}
      if (status) where.status = status
      let deviceIds: number[] | null = null
      if (keyword) {
        const devices = await Device.findAll({
          where: {
            [Op.or]: [
              { device_code: { [Op.like]: `%${keyword}%` } },
              { device_name: { [Op.like]: `%${keyword}%` } },
            ],
          },
          attributes: ['device_id'],
          raw: true,
        })
        deviceIds = devices.map(d => d.device_id)
        if (deviceIds.length === 0) return success(res, { list: [], total: 0 }, '查询成功', 0)
        where.device_id = { [Op.in]: deviceIds }
      }
      const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
      const offset = (Number(page) - 1) * limit
      const { rows, count } = await DeviceMaintenanceProfile.findAndCountAll({
        where,
        include: [
          { model: Device, as: 'device', required: false, attributes: ['device_id', 'device_code', 'device_name'] },
          {
            model: DeviceMaintenanceStandard, as: 'standards', required: false, separate: true,
            attributes: ['standard_id', 'trigger_mode', 'status'],
          },
        ],
        limit, offset,
        order: [['updated_at', 'DESC'], ['profile_id', 'DESC']],
        distinct: true,
      })
      const list = rows.map((p: any) => {
        const stds = p.getDataValue('standards') || []
        const byMode: Record<string, number> = { daily: 0, weekly: 0, monthly: 0, runtime: 0 }
        stds.forEach((s: any) => { const m = s.getDataValue('trigger_mode'); if (byMode[m] !== undefined) byMode[m] += 1 })
        return {
          profile_id: p.getDataValue('profile_id'),
          device_id: p.getDataValue('device_id'),
          device_code: p.getDataValue('device_code') || p.getDataValue('device')?.device_code,
          device_name: p.getDataValue('device_name') || p.getDataValue('device')?.device_name,
          status: p.getDataValue('status'),
          version: p.getDataValue('version'),
          effective_date: p.getDataValue('effective_date'),
          remarks: p.getDataValue('remarks'),
          updated_at: p.getDataValue('updated_at'),
          created_at: p.getDataValue('created_at'),
          std_count: stds.length,
          std_by_mode: byMode,
        }
      })
      return success(res, { list, total: count }, '查询成功', count)
    } catch (err: any) {
      logger.error('[DeviceMaintenance] listProfiles error:', err)
      return fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 可用设备列表：返回尚未创建档案的设备，供新增档案选择
   */
  async listAvailableDevices(req: any, res: any) {
    try {
      const { keyword } = req.query
      const devWhere: any = {}
      if (keyword) {
        devWhere[Op.or] = [
          { device_code: { [Op.like]: `%${keyword}%` } },
          { device_name: { [Op.like]: `%${keyword}%` } },
        ]
      }
      const existed = await DeviceMaintenanceProfile.findAll({ attributes: ['device_id'], raw: true })
      const existedSet = new Set(existed.map(p => p.device_id))
      const devices = await Device.findAll({
        where: { ...devWhere, device_id: { [Op.notIn]: Array.from(existedSet) || [0] } },
        attributes: ['device_id', 'device_code', 'device_name'],
        order: [['device_code', 'ASC']],
      })
      return success(res, devices, '查询成功')
    } catch (err: any) {
      logger.error('[DeviceMaintenance] listAvailableDevices error:', err)
      return fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 创建档案：为指定设备创建档案（状态=编制）
   */
  async createProfile(req: any, res: any) {
    const t = await DeviceMaintenanceProfile.sequelize.transaction()
    try {
      const { device_id, remarks } = req.body || {}
      if (!device_id) return fail(res, '设备ID不能为空', ErrorCode.PARAM_INVALID)
      const exists = await DeviceMaintenanceProfile.findOne({ where: { device_id }, transaction: t })
      if (exists) return fail(res, '该设备已存在维护标准档案', ErrorCode.RECORD_EXISTS)
      const device = await Device.findOne({ where: { device_id }, transaction: t })
      if (!device) return fail(res, '设备不存在', ErrorCode.RECORD_NOT_FOUND)
      const profile = await DeviceMaintenanceProfile.create({
        device_id,
        device_code: (device as any).device_code,
        device_name: (device as any).device_name,
        status: '编制',
        version: 1,
        remarks,
      }, { transaction: t })
      await t.commit()
      return success(res, profile, '档案创建成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[DeviceMaintenance] createProfile error:', err)
      return fail(res, err.message || '创建失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 档案详情：含该设备所有标准项
   */
  async detailProfile(req: any, res: any) {
    try {
      const { deviceId } = req.params
      const profile = await DeviceMaintenanceProfile.findOne({
        where: { device_id: deviceId },
        include: [
          { model: Device, as: 'device', required: false, attributes: ['device_id', 'device_code', 'device_name', 'device_model', 'serial_no', 'location'] },
          {
            model: DeviceMaintenanceStandard, as: 'standards', required: false, separate: false,
            order: [['sort_order', 'ASC'], ['standard_id', 'ASC']],
          },
        ],
      })
      if (!profile) return fail(res, '档案不存在', ErrorCode.RECORD_NOT_FOUND)
      return success(res, profile, '查询成功')
    } catch (err: any) {
      logger.error('[DeviceMaintenance] detailProfile error:', err)
      return fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 切换档案状态：编制→生效、生效→停用、停用→生效
   * 生效时 effective_date=今天，version+1
   */
  async updateProfileStatus(req: any, res: any) {
    const t = await DeviceMaintenanceProfile.sequelize.transaction()
    try {
      const { deviceId } = req.params
      const { status } = req.body || {}
      if (!['编制', '生效', '停用'].includes(status)) {
        return fail(res, '状态无效，可选值：编制 / 生效 / 停用', ErrorCode.PARAM_INVALID)
      }
      const profile = await DeviceMaintenanceProfile.findOne({ where: { device_id: deviceId }, transaction: t })
      if (!profile) return fail(res, '档案不存在', ErrorCode.RECORD_NOT_FOUND)
      const patch: any = { status }
      if (status === '生效') {
        patch.effective_date = new Date().toISOString().slice(0, 10)
        patch.version = (profile.getDataValue('version') || 1) + 1
      }
      await profile.update(patch, { transaction: t })
      await t.commit()
      return success(res, profile, '状态更新成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[DeviceMaintenance] updateProfileStatus error:', err)
      return fail(res, err.message || '更新失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 删除档案：同时删除该设备的所有标准项（档案接管的标准项清理）
   */
  async deleteProfile(req: any, res: any) {
    const t = await DeviceMaintenanceProfile.sequelize.transaction()
    try {
      const { deviceId } = req.params
      const profile = await DeviceMaintenanceProfile.findOne({ where: { device_id: deviceId }, transaction: t })
      if (!profile) return fail(res, '档案不存在', ErrorCode.RECORD_NOT_FOUND)
      await DeviceMaintenanceStandard.destroy({ where: { device_id: deviceId }, transaction: t })
      await profile.destroy({ transaction: t })
      await t.commit()
      return success(res, null, '删除成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[DeviceMaintenance] deleteProfile error:', err)
      return fail(res, err.message || '删除失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  // ============================================================
  // 生成执行记录（四分支）
  // ============================================================
  /**
   * 按 trigger_mode 生成执行记录
   * 请求体可选：
   *   { mode }              — 'daily' | 'weekly' | 'monthly' | 'runtime' | undefined(全部)
   *   { target_date }       — 指定日期，默认今天
   *   { device_id }         — 限定单台设备
   *
   * 唯一性：(standard_id, period_key) 唯一约束保证不会重复生成
   */
  async generateRecords(req: any, res: any) {
    const t = await DeviceMaintenanceRecord.sequelize.transaction()
    try {
      const { mode, target_date, device_id } = req.body || {}
      const targetDate = target_date ? new Date(target_date) : new Date()
      const today = todayStr()
      const targetModes: string[] = mode
        ? (Array.isArray(mode) ? mode : [mode])
        : ['daily', 'weekly', 'monthly', 'runtime']

      const createdList: any[] = []

      // 仅对档案状态=生效的设备生成执行记录
      const effectiveProfiles = await DeviceMaintenanceProfile.findAll({
        where: { status: '生效' },
        attributes: ['device_id'],
        transaction: t,
      })
      let effectiveDeviceIds = effectiveProfiles.map((p: any) => p.getDataValue('device_id'))
      // 若限定单台设备，进一步取交集
      if (device_id) {
        effectiveDeviceIds = effectiveDeviceIds.filter(id => id === Number(device_id))
      }
      if (effectiveDeviceIds.length === 0) {
        await t.commit()
        return success(res, { created: 0, total: 0, records: [] }, '无生效档案，跳过生成')
      }

      for (const m of targetModes) {
        if (!['daily', 'weekly', 'monthly', 'runtime'].includes(m)) continue

        const stdWhere: any = { trigger_mode: m, status: 1, device_id: { [Op.in]: effectiveDeviceIds } }

        const standards = await DeviceMaintenanceStandard.findAll({ where: stdWhere, transaction: t })

        // 预先查已有未完成的执行记录（runtime 模式用 period_key 不固定，所以按 (standard_id, status != 2) 查）
        const activeStandards: any[] = []

        if (m === 'runtime') {
          // runtime 模式：查已有未完成的执行记录
          const unfinished = await DeviceMaintenanceRecord.findAll({
            where: {
              standard_id: { [Op.in]: standards.map((s: any) => s.getDataValue('standard_id')) },
              status: { [Op.in]: UNFINISHED_STATUS },
            },
            attributes: ['standard_id'],
            transaction: t,
          })
          const unfinishedSet = new Set(unfinished.map((r: any) => r.getDataValue('standard_id')))

          for (const s of standards) {
            const sid = s.getDataValue('standard_id')
            if (unfinishedSet.has(sid)) continue
            const threshold = Number(s.getDataValue('runtime_threshold')) || 0
            if (!threshold) continue
            const currentRuntime = await getLatestRuntime(s.getDataValue('device_id'), t)
            const lastVal = Number(s.getDataValue('last_trigger_value')) || 0
            if (currentRuntime - lastVal < threshold) continue
            activeStandards.push({ s, currentRuntime })
          }
        } else {
          // daily/weekly/monthly：按 period_key 去重
          const periodKeys: string[] = []
          const stdPeriodMap: Record<number, string> = {}
          for (const s of standards) {
            const pk = buildPeriodKey(m, targetDate)
            periodKeys.push(pk)
            stdPeriodMap[s.getDataValue('standard_id')] = pk
          }
          if (periodKeys.length > 0) {
            const existing = await DeviceMaintenanceRecord.findAll({
              where: {
                standard_id: { [Op.in]: standards.map((s: any) => s.getDataValue('standard_id')) },
                period_key: { [Op.in]: periodKeys },
              },
              attributes: ['standard_id', 'period_key'],
              transaction: t,
            })
            const existSet = new Set(existing.map((r: any) => `${r.getDataValue('standard_id')}|${r.getDataValue('period_key')}`))
            for (const s of standards) {
              const sid = s.getDataValue('standard_id')
              const pk = stdPeriodMap[sid]
              if (existSet.has(`${sid}|${pk}`)) continue
              activeStandards.push({ s, periodKey: pk })
            }
          }
        }

        // 批量创建
        for (const { s, periodKey, currentRuntime } of activeStandards) {
          const { finalDeviceCode, finalDeviceName } = await loadDeviceFields(
            s.getDataValue('device_id'),
            s.getDataValue('device_code'),
            s.getDataValue('device_name'),
            t,
          )
          let finalPeriodKey = periodKey
          if (m === 'runtime') {
            finalPeriodKey = buildPeriodKey('runtime', new Date(), s.getDataValue('standard_id'), s.getDataValue('device_id'), Number(s.getDataValue('runtime_threshold')))
          }

          const recordNo = await generateDeviceRecordNo()
          const created = await DeviceMaintenanceRecord.create({
            record_no: recordNo,
            standard_id: s.getDataValue('standard_id'),
            device_id: s.getDataValue('device_id'),
            device_code: finalDeviceCode,
            device_name: finalDeviceName,
            trigger_mode: m,
            period_key: finalPeriodKey,
            status: 0,
            remarks: m === 'runtime'
              ? `运行时长${currentRuntime}h 达阈值${s.getDataValue('runtime_threshold')}h，自动生成`
              : '自动生成',
          }, { transaction: t })
          createdList.push(created)

          // runtime 模式推进 last_trigger_value
          if (m === 'runtime') {
            await s.update({ last_trigger_value: String(currentRuntime) }, { transaction: t })
          }
        }
      }

      await t.commit()
      success(res, {
        created: createdList.length,
        total: createdList.length,
        records: createdList.map(r => ({ record_id: r.record_id, record_no: r.record_no })),
      }, `成功生成 ${createdList.length} 条执行记录`)
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[DeviceMaintenance] generateRecords error:', err)
      fail(res, err.message || '生成失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  // ============================================================
  // 矩阵查询接口（前端矩阵视图直接消费的数据结构）
  // ============================================================
  async getMatrix(req: any, res: any) {
    try {
      const { device_id, year_month, year } = req.query
      if (!device_id) return fail(res, '设备ID不能为空', ErrorCode.PARAM_INVALID)

      let ym = year_month
      if (!ym && year) ym = `${year}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
      if (!ym) ym = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

      const [yr, mo] = ym.split('-').map(Number)
      const daysInMonth = new Date(yr, mo, 0).getDate()

      // 提前计算 period_keys 集（纯工具函数，已测试）
      const dailyKeys = dailyPeriodKeys(yr, mo)
      const weekKeys = weeklyPeriodKeys(yr, mo)

      // 1. 查该设备全部启用标准
      const standards = await DeviceMaintenanceStandard.findAll({
        where: { device_id, status: 1 },
        order: [['trigger_mode', 'ASC'], ['sort_order', 'ASC'], ['standard_id', 'ASC']],
      })

      // 2. 按 trigger_mode 分组
      const dailyStds: any[] = []
      const weeklyStds: any[] = []
      const monthlyStds: any[] = []
      const runtimeStds: any[] = []
      standards.forEach((s: any) => {
        const tm = s.getDataValue('trigger_mode')
        if (tm === 'daily') dailyStds.push(s)
        else if (tm === 'weekly') weeklyStds.push(s)
        else if (tm === 'monthly') {
          const mp = s.getDataValue('monthly_plan')
          if (monthlyStandardActive(mp, mo)) monthlyStds.push(s)
        } else if (tm === 'runtime') runtimeStds.push(s)
      })

      // 3. 查该设备在该月内的所有执行记录
      const dailyStart = dailyKeys[0]
      const dailyEnd = dailyKeys[dailyKeys.length - 1]

      const records = await DeviceMaintenanceRecord.findAll({
        where: {
          device_id,
          [Op.or]: [
            // daily: period_key 落在这个月
            { trigger_mode: 'daily', period_key: { [Op.gte]: dailyStart, [Op.lte]: dailyEnd } },
            // weekly: period_key = YYYY-Www，取这个月里覆盖到的周
            { trigger_mode: 'weekly', period_key: { [Op.in]: weekKeys } },
            // monthly: period_key = YYYY-MM
            { trigger_mode: 'monthly', period_key: ym },
          ],
        },
        attributes: ['record_id', 'standard_id', 'trigger_mode', 'period_key',
          'status', 'result', 'actual_value', 'executor_name', 'executor_id',
          'start_time', 'end_time', 'duration_min', 'abnormal_desc'],
      })

      // 构建 recordsMap: (trigger_mode, period_key, standard_id) → record
      const recordsMap = new Map<string, any>()
      records.forEach((r: any) => {
        const raw = r.toJSON()
        const key = `${raw.trigger_mode}|${raw.period_key}|${raw.standard_id}`
        recordsMap.set(key, raw)
      })

      // 4. 组装矩阵
      const buildMatrixRecords = (std: any, mode: string, periodKeys: string[]): Record<string, any> => {
        const out: Record<string, any> = {}
        periodKeys.forEach(pk => {
          const rec = recordsMap.get(`${mode}|${pk}|${std.getDataValue('standard_id')}`)
          out[pk] = rec ? {
            record_id: rec.record_id,
            status: rec.status,
            result: rec.result,
            actual_value: rec.actual_value,
            executor: rec.executor_name,
            start_time: rec.start_time,
            end_time: rec.end_time,
            duration_min: rec.duration_min,
            abnormal_desc: rec.abnormal_desc,
          } : null
        })
        return out
      }

      const resultDaily: any[] = dailyStds.map((s: any) => ({
        standard_id: s.getDataValue('standard_id'),
        item_name: s.getDataValue('item_name'),
        mechanism: s.getDataValue('mechanism'),
        component: s.getDataValue('component'),
        location: s.getDataValue('location'),
        maintenance_method: s.getDataValue('maintenance_method'),
        judge_type: s.getDataValue('judge_type'),
        standard_value: s.getDataValue('standard_value'),
        unit: s.getDataValue('unit'),
        sort_order: s.getDataValue('sort_order'),
        point_count: s.getDataValue('point_count'),
        time_per_point: s.getDataValue('time_per_point'),
        records: buildMatrixRecords(s, 'daily', dailyKeys),
      }))

      const resultWeekly: any[] = weeklyStds.map((s: any) => ({
        standard_id: s.getDataValue('standard_id'),
        item_name: s.getDataValue('item_name'),
        mechanism: s.getDataValue('mechanism'),
        component: s.getDataValue('component'),
        location: s.getDataValue('location'),
        maintenance_method: s.getDataValue('maintenance_method'),
        judge_type: s.getDataValue('judge_type'),
        standard_value: s.getDataValue('standard_value'),
        unit: s.getDataValue('unit'),
        point_count: s.getDataValue('point_count'),
        time_per_point: s.getDataValue('time_per_point'),
        maintenance_content: s.getDataValue('maintenance_content'),
        sort_order: s.getDataValue('sort_order'),
        records: buildMatrixRecords(s, 'weekly', weekKeys),
      }))

      const resultMonthly: any[] = monthlyStds.map((s: any) => ({
        standard_id: s.getDataValue('standard_id'),
        item_name: s.getDataValue('item_name'),
        mechanism: s.getDataValue('mechanism'),
        component: s.getDataValue('component'),
        location: s.getDataValue('location'),
        maintenance_method: s.getDataValue('maintenance_method'),
        judge_type: s.getDataValue('judge_type'),
        standard_value: s.getDataValue('standard_value'),
        unit: s.getDataValue('unit'),
        point_count: s.getDataValue('point_count'),
        time_per_point: s.getDataValue('time_per_point'),
        maintenance_content: s.getDataValue('maintenance_content'),
        monthly_plan: s.getDataValue('monthly_plan'),
        sort_order: s.getDataValue('sort_order'),
        records: buildMatrixRecords(s, 'monthly', [ym]),
      }))

      // 5. 汇总统计
      const completedCount = (items: any[]) => items.reduce((acc, it) => {
        return acc + Object.values(it.records).filter((v: any) => v && v.status === '已完成').length
      }, 0)
      const pendingCount = (items: any[]) => items.reduce((acc, it) => {
        return acc + Object.values(it.records).filter((v: any) => v === null || v.status === '待执行').length
      }, 0)
      const abnormalCount = (items: any[]) => items.reduce((acc, it) => {
        return acc + Object.values(it.records).filter((v: any) => v && v.result === '异常').length
      }, 0)

      const dailyTotal = resultDaily.length * daysInMonth
      const dailyCompleted = completedCount(resultDaily)
      const weeklyTotal = resultWeekly.length * weekKeys.length
      const weeklyCompleted = completedCount(resultWeekly)
      const monthlyTotal = resultMonthly.length
      const monthlyCompleted = completedCount(resultMonthly)

      // 设备基础信息
      const device = await Device.findOne({ where: { device_id } })

      success(res, {
        device_id: Number(device_id),
        device_code: (device as any)?.getDataValue('device_code') || null,
        device_name: (device as any)?.getDataValue('device_name') || null,
        year_month: ym,
        year: yr,
        month: mo,
        days_in_month: daysInMonth,
        week_keys: weekKeys,
        daily: { items: resultDaily },
        weekly: { items: resultWeekly },
        monthly: { items: resultMonthly },
        summary: {
          daily_total: dailyTotal,
          daily_completed: dailyCompleted,
          daily_rate: dailyTotal > 0 ? Math.round((dailyCompleted / dailyTotal) * 100) : 0,
          weekly_total: weeklyTotal,
          weekly_completed: weeklyCompleted,
          weekly_rate: weeklyTotal > 0 ? Math.round((weeklyCompleted / weeklyTotal) * 100) : 0,
          monthly_total: monthlyTotal,
          monthly_completed: monthlyCompleted,
          monthly_rate: monthlyTotal > 0 ? Math.round((monthlyCompleted / monthlyTotal) * 100) : 0,
          abnormal_count: abnormalCount([...resultDaily, ...resultWeekly, ...resultMonthly]),
        },
      })
    } catch (err: any) {
      logger.error('[DeviceMaintenance] getMatrix error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  // ============================================================
  // 执行记录 CRUD
  // ============================================================
  async listRecords(req: any, res: any) {
    try {
      const {
        page = 1, page_size = 20,
        record_no, device_id, device_name, device_code,
        trigger_mode, status, period_key,
        start_date, end_date,
      } = req.query

      const where: any = {}
      if (record_no) where.record_no = { [Op.like]: `%${record_no}%` }
      if (device_id) where.device_id = device_id
      if (device_name) where.device_name = { [Op.like]: `%${device_name}%` }
      if (device_code) where.device_code = { [Op.like]: `%${device_code}%` }
      if (trigger_mode) where.trigger_mode = trigger_mode
      if (period_key) where.period_key = period_key

      const statusArr = parseMultiStatus(status, STATUS_REVERSE)
      if (statusArr) where.status = { [Op.in]: statusArr }

      if (start_date || end_date) {
        where.created_at = {}
        if (start_date) where.created_at[Op.gte] = new Date(start_date as string)
        if (end_date) where.created_at[Op.lte] = new Date(`${end_date} 23:59:59`)
      }

      const pageNum = Math.max(1, Number(page) || 1)
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(page_size) || 20))

      const { count, rows } = await DeviceMaintenanceRecord.findAndCountAll({
        where,
        order: [['created_at', 'DESC'], ['record_id', 'DESC']],
        limit: pageSize,
        offset: (pageNum - 1) * pageSize,
        include: [{ model: DeviceMaintenanceStandard, as: 'standard', required: false }],
      })

      success(res, { list: rows, total: count, page: pageNum, page_size: pageSize })
    } catch (err: any) {
      logger.error('[DeviceMaintenance] listRecords error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async detailRecord(req: any, res: any) {
    try {
      const { id } = req.params
      const detail = await getRecordDetail(Number(id))
      if (!detail) return fail(res, '执行记录不存在', ErrorCode.RECORD_NOT_FOUND)
      success(res, detail)
    } catch (err: any) {
      logger.error('[DeviceMaintenance] detailRecord error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 开始执行（状态 0=待执行 → 1=执行中）
   */
  async startRecord(req: any, res: any) {
    const t = await DeviceMaintenanceRecord.sequelize.transaction()
    try {
      const { id } = req.params
      const userInfo: any = (req as any).user || {}
      const { start_time, executor_id, executor_name } = req.body || {}

      const record = await DeviceMaintenanceRecord.findOne({ where: { record_id: id }, transaction: t })
      if (!record) return fail(res, '执行记录不存在', ErrorCode.RECORD_NOT_FOUND)

      const s = rawStatus(record)
      if (s !== 0 && s !== 3) {
        return fail(res, '当前状态不允许开始执行', ErrorCode.BUSINESS_ERROR)
      }

      await record.update({
        status: 1,
        start_time: start_time ? new Date(start_time) : new Date(),
        executor_id: executor_id || userInfo.userId || null,
        executor_name: executor_name || userInfo.username || '',
      }, { transaction: t })

      await t.commit()
      const detail = await getRecordDetail(Number(id))
      success(res, detail, '开始执行成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[DeviceMaintenance] startRecord error:', err)
      fail(res, err.message || '操作失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 提交执行结果（单条）
   * - 异常时自动创建故障工单（source='保养异常', related_record_id=本记录ID）
   */
  async submitRecord(req: any, res: any) {
    const t = await DeviceMaintenanceRecord.sequelize.transaction()
    try {
      const { id } = req.params
      const userInfo: any = (req as any).user || {}
      const {
        result, actual_value, abnormal_desc, executor_id, executor_name,
        maintenance_content, spare_parts_used, duration_min, end_time, remarks,
      } = req.body || {}

      const record = await DeviceMaintenanceRecord.findOne({ where: { record_id: id }, transaction: t })
      if (!record) {
        const files = (req as any).files || ((req as any).file ? [(req as any).file] : [])
        files.forEach((f: any) => { try { fs.unlinkSync(f.path) } catch { /* ignore */ } })
        return fail(res, '执行记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      if (!result) return fail(res, '执行结果不能为空（正常/异常）', ErrorCode.PARAM_INVALID)

      const now = end_time ? new Date(end_time) : new Date()
      const deviceId = record.getDataValue('device_id')
      const deviceCode = record.getDataValue('device_code')
      const deviceName = record.getDataValue('device_name')

      // 计算耗时
      let finalDuration = duration_min !== undefined ? duration_min : null
      if (finalDuration === null) {
        const st = record.getDataValue('start_time')
        if (st) finalDuration = Math.max(1, Math.round((now.getTime() - new Date(st).getTime()) / 60000))
      }

      const recordUpdate: any = {
        status: 2,
        result,
        actual_value: actual_value || null,
        abnormal_desc: result === '异常' ? (abnormal_desc || '') : '',
        maintenance_content: maintenance_content || null,
        spare_parts_used: Array.isArray(spare_parts_used) ? spare_parts_used : null,
        end_time: now,
        duration_min: finalDuration,
        remarks: remarks !== undefined ? remarks : (record as any).remarks,
      }
      if (!record.getDataValue('executor_id') && !record.getDataValue('executor_name')) {
        recordUpdate.executor_id = executor_id || userInfo.userId || null
        recordUpdate.executor_name = executor_name || userInfo.username || ''
      } else {
        if (executor_id !== undefined) recordUpdate.executor_id = executor_id
        if (executor_name !== undefined) recordUpdate.executor_name = executor_name
      }

      await record.update(recordUpdate, { transaction: t })

      // 异常自动创建故障工单
      if (result === '异常') {
        const standard = record.getDataValue('standard_id')
          ? await DeviceMaintenanceStandard.findOne({ where: { standard_id: record.getDataValue('standard_id') }, transaction: t })
          : null
        const itemName = standard?.getDataValue('item_name') || '未知保养项'
        const faultNo = await generateDeviceFaultNo()
        await DeviceFault.create({
          fault_no: faultNo,
          device_id: deviceId,
          device_code: deviceCode,
          device_name: deviceName,
          fault_level: 1,
          fault_desc: `保养异常：${itemName}`,
          fault_time: now,
          impact_desc: abnormal_desc || '',
          status: 0,
          reporter_id: recordUpdate.executor_id || null,
          reporter_name: recordUpdate.executor_name || '',
          source: '保养异常',
          related_inspection_id: Number(id),
          remarks: `由保养执行记录#${id}自动生成`,
        }, { transaction: t })
      }

      // 处理上传图片
      const files: any[] = (req as any).files || ((req as any).file ? [(req as any).file] : [])
      if (files.length > 0) {
        const uploadsDir = path.resolve(process.cwd(), 'uploads', 'device', 'maintenance')
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
        const existingCount = await DeviceImage.count({
          where: { doc_type: 'maintenance', doc_id: Number(id) },
          transaction: t,
        })
        const ts = Date.now()
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          const seqNum = existingCount + i + 1
          const ext = path.extname(file.originalname) || '.jpg'
          const newName = `record_${id}_${seqNum}_${ts}${ext}`
          const destPath = path.join(uploadsDir, newName)
          fs.renameSync(file.path, destPath)
          await DeviceImage.create({
            doc_type: 'maintenance',
            doc_id: Number(id),
            file_path: `/uploads/device/maintenance/${newName}`,
            file_name: file.originalname || newName,
            file_size: file.size || null,
            sort_order: seqNum,
            uploaded_by: recordUpdate.executor_id || null,
            uploaded_by_name: recordUpdate.executor_name || '',
          }, { transaction: t })
        }
      }

      await t.commit()
      const detail = await getRecordDetail(Number(id))
      success(res, detail, result === '异常' ? '提交成功，已自动转故障' : '提交成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      const files = (req as any).files || ((req as any).file ? [(req as any).file] : [])
      files.forEach((f: any) => { try { fs.unlinkSync(f.path) } catch { /* ignore */ } })
      logger.error('[DeviceMaintenance] submitRecord error:', err)
      fail(res, err.message || '提交失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 批量提交执行结果（矩阵视图中勾选多条一起填）
   * 每条只做最小更新：result, actual_value, abnormal_desc, executor, end_time
   */
  async batchSubmit(req: any, res: any) {
    const t = await DeviceMaintenanceRecord.sequelize.transaction()
    try {
      const userInfo: any = (req as any).user || {}
      const items = Array.isArray(req.body?.records) ? req.body.records : []
      if (items.length === 0) return fail(res, '提交项不能为空', ErrorCode.PARAM_INVALID)

      const updated: any[] = []
      const abnormalFaults: any[] = []

      for (const payload of items) {
        const record = await DeviceMaintenanceRecord.findOne({ where: { record_id: payload.record_id }, transaction: t })
        if (!record) continue
        const newStatus = payload.status || 2
        const now = new Date()

        const updateData: any = {
          status: newStatus,
        }
        if (payload.result !== undefined) updateData.result = payload.result
        if (payload.actual_value !== undefined) updateData.actual_value = payload.actual_value || null
        if (payload.abnormal_desc !== undefined && payload.result === '异常') {
          updateData.abnormal_desc = payload.abnormal_desc
        }
        if (newStatus === 2) {
          updateData.end_time = now
          if (!record.getDataValue('executor_id') && (payload.executor_id || userInfo.userId)) {
            updateData.executor_id = payload.executor_id || userInfo.userId
            updateData.executor_name = payload.executor_name || userInfo.username || ''
          }
        }

        await record.update(updateData, { transaction: t })
        updated.push({ record_id: payload.record_id, status: newStatus })

        // 异常自动转故障
        if (payload.result === '异常') {
          const standard = record.getDataValue('standard_id')
            ? await DeviceMaintenanceStandard.findOne({ where: { standard_id: record.getDataValue('standard_id') }, transaction: t })
            : null
          const itemName = standard?.getDataValue('item_name') || '未知保养项'
          const faultNo = await generateDeviceFaultNo()
          const fault = await DeviceFault.create({
            fault_no: faultNo,
            device_id: record.getDataValue('device_id'),
            device_code: record.getDataValue('device_code'),
            device_name: record.getDataValue('device_name'),
            fault_level: 1,
            fault_desc: `保养异常：${itemName}`,
            fault_time: now,
            impact_desc: payload.abnormal_desc || '',
            status: 0,
            reporter_id: updateData.executor_id || null,
            reporter_name: updateData.executor_name || '',
            source: '保养异常',
            related_inspection_id: record.getDataValue('record_id'),
            remarks: `由保养执行记录#${payload.record_id}自动生成（批量提交）`,
          }, { transaction: t })
          abnormalFaults.push({ fault_id: fault.fault_id, fault_no: fault.fault_no })
        }
      }

      await t.commit()
      success(res, {
        updated: updated.length,
        abnormal_count: abnormalFaults.length,
        abnormal_faults: abnormalFaults,
      }, `批量提交成功，更新 ${updated.length} 条${abnormalFaults.length > 0 ? `，发现 ${abnormalFaults.length} 项异常已转故障` : ''}`)
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[DeviceMaintenance] batchSubmit error:', err)
      fail(res, err.message || '批量提交失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 标记为跳过（0 或 1 → 3）
   */
  async skipRecord(req: any, res: any) {
    try {
      const { id } = req.params
      const record = await DeviceMaintenanceRecord.findOne({ where: { record_id: id } })
      if (!record) return fail(res, '执行记录不存在', ErrorCode.RECORD_NOT_FOUND)
      const s = rawStatus(record)
      if (s === 1) return fail(res, '执行中的记录不允许跳过，请到完成保养后提交结果', ErrorCode.BUSINESS_ERROR)
      if (s === 2) return fail(res, '已完成的记录不能跳过', ErrorCode.BUSINESS_ERROR)
      await record.update({ status: 3 })
      success(res, null, '已标记为跳过')
    } catch (err: any) {
      logger.error('[DeviceMaintenance] skipRecord error:', err)
      fail(res, err.message || '操作失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  /**
   * 删除执行记录（级联删除图片）
   */
  async deleteRecord(req: any, res: any) {
    const t = await DeviceMaintenanceRecord.sequelize.transaction()
    try {
      const { id } = req.params
      const record = await DeviceMaintenanceRecord.findOne({ where: { record_id: id }, transaction: t })
      if (!record) return fail(res, '执行记录不存在', ErrorCode.RECORD_NOT_FOUND)

      const s = rawStatus(record)
      if (s === 1) return fail(res, '执行中的保养记录不允许删除，请先完成或跳过', ErrorCode.BUSINESS_ERROR)
      if (s === 2) return fail(res, '已完成的保养记录不允许删除', ErrorCode.BUSINESS_ERROR)

      // 级联删图片
      await DeviceImage.destroy({ where: { doc_type: 'maintenance', doc_id: id }, transaction: t })
      await record.destroy({ transaction: t })

      await t.commit()
      success(res, { message: '删除成功' }, '删除成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[DeviceMaintenance] deleteRecord error:', err)
      fail(res, err.message || '删除失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  // ============================================================
  // 图片
  // ============================================================
  async getImages(req: any, res: any) {
    try {
      const { id } = req.params
      const exists = await DeviceMaintenanceRecord.findOne({ where: { record_id: id }, attributes: ['record_id'] })
      if (!exists) return fail(res, '执行记录不存在', ErrorCode.RECORD_NOT_FOUND)
      const images = await DeviceImage.findAll({
        where: { doc_type: 'maintenance', doc_id: id },
        order: [['sort_order', 'ASC'], ['image_id', 'ASC']],
      })
      success(res, images, '查询成功')
    } catch (err: any) {
      logger.error('[DeviceMaintenance] getImages error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async uploadImage(req: any, res: any) {
    const t = await DeviceImage.sequelize.transaction()
    try {
      const { id } = req.params
      const userInfo: any = (req as any).user || {}
      const record = await DeviceMaintenanceRecord.findOne({ where: { record_id: id }, transaction: t })
      if (!record) {
        const files = (req as any).files || ((req as any).file ? [(req as any).file] : [])
        files.forEach((f: any) => { try { fs.unlinkSync(f.path) } catch { /* ignore */ } })
        return fail(res, '执行记录不存在', ErrorCode.RECORD_NOT_FOUND)
      }

      const files: any[] = (req as any).files || ((req as any).file ? [(req as any).file] : [])
      if (files.length === 0) return fail(res, '请选择要上传的图片', ErrorCode.PARAM_INVALID)

      // 专用目录：uploads/device/maintenance/YYYY-MM-DD/
      const d = new Date()
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const uploadsDir = path.resolve(process.cwd(), 'uploads', 'device', 'maintenance', ymd)
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

      const recordId = Number(id)
      const existingCount = await DeviceImage.count({
        where: { doc_type: 'maintenance', doc_id: recordId },
        transaction: t,
      })

      // 收集本次待处理图片的已存在 hash（用于跨本次上传去重）
      const existingHashSet = new Set<string>()
      const existedImages = await DeviceImage.findAll({
        where: { doc_type: 'maintenance', doc_id: recordId },
        attributes: ['file_path'],
        transaction: t,
      })
      for (const img of existedImages) {
        const p = path.resolve(process.cwd(), img.getDataValue('file_path').replace(/^\//, ''))
        if (fs.existsSync(p)) {
          try { existingHashSet.add(sha256File(p)) } catch { /* ignore */ }
        }
      }

      const nowStr = d.toLocaleString('zh-CN', { hour12: false })
      let seqNum = existingCount
      const saved: any[] = []
      const skipped: string[] = [] // 被去重跳过的文件名

      for (const file of files) {
        try {
          // 处理：压缩 + 水印（水印包含当前时间、设备编号，便于追溯）
          const watermarkText = `${nowStr}  ${record.device_code || ''}  ${record.getDataValue('trigger_mode') || ''}`.trim()
          const processed = await processImage(file.path, watermarkText)

          // 同记录内去重（与已存在图片比对）
          if (existingHashSet.has(processed.hash)) {
            skipped.push(file.originalname || file.filename || '(未命名)')
            continue
          }
          existingHashSet.add(processed.hash)

          seqNum += 1
          const newName = buildImageName(recordId, seqNum, processed.hash)
          const destPath = path.join(uploadsDir, newName)
          fs.writeFileSync(destPath, processed.buffer)

          const img = await DeviceImage.create({
            doc_type: 'maintenance',
            doc_id: recordId,
            file_path: `/uploads/device/maintenance/${ymd}/${newName}`,
            file_name: file.originalname || newName,
            file_size: processed.size,
            sort_order: seqNum,
            uploaded_by: userInfo.userId || null,
            uploaded_by_name: userInfo.username || '',
          }, { transaction: t })
          saved.push(img)
        } catch (procErr: any) {
          logger.warn('[DeviceMaintenance] uploadImage skip one:', procErr?.message || procErr)
        } finally {
          // 删除 multer 临时文件
          try { fs.unlinkSync(file.path) } catch { /* ignore */ }
        }
      }

      await t.commit()
      const msgParts = [`成功上传 ${saved.length} 张`]
      if (skipped.length > 0) msgParts.push(`${skipped.length} 张重复图片已跳过`)
      success(res, saved, msgParts.join('，'))
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[DeviceMaintenance] uploadImage error:', err)
      fail(res, err.message || '上传失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  // ============================================================
  // 运行时长（保留旧功能）
  // ============================================================
  async logRuntime(req: any, res: any) {
    const t = await DeviceRuntimeLog.sequelize.transaction()
    try {
      const userInfo: any = (req as any).user || {}
      const { device_id, runtime_hours, remarks } = req.body || {}
      if (!device_id) return fail(res, '设备ID不能为空', ErrorCode.PARAM_INVALID)
      if (!runtime_hours || Number(runtime_hours) <= 0) {
        return fail(res, '运行时长必须为有效正数（小时）', ErrorCode.PARAM_INVALID)
      }

      const { finalDeviceCode, finalDeviceName } = await loadDeviceFields(device_id, undefined, undefined, t)
      const currentHours = Number(runtime_hours)
      const previousHours = await getLatestRuntime(device_id, t)
      const delta = currentHours > previousHours ? Number((currentHours - previousHours).toFixed(2)) : 0

      const log = await DeviceRuntimeLog.create({
        device_id,
        device_code: finalDeviceCode,
        device_name: finalDeviceName,
        runtime_hours: currentHours,
        previous_hours: previousHours,
        delta_hours: delta,
        logged_by: userInfo.userId || null,
        logged_by_name: userInfo.username || '',
        remarks: remarks || '',
      }, { transaction: t })

      await t.commit()
      success(res, log, '运行时长录入成功')
    } catch (err: any) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      logger.error('[DeviceMaintenance] logRuntime error:', err)
      fail(res, err.message || '录入失败', ErrorCode.SYSTEM_ERROR)
    }
  },

  async getRuntimeLog(req: any, res: any) {
    try {
      const { device_id, page = 1, page_size = 20 } = req.query
      const where: any = {}
      if (device_id) where.device_id = device_id

      const pageNum = Math.max(1, Number(page) || 1)
      const pageSizeN = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(page_size) || 20))

      const { count, rows } = await DeviceRuntimeLog.findAndCountAll({
        where,
        order: [['created_at', 'DESC'], ['log_id', 'DESC']],
        limit: pageSizeN,
        offset: (pageNum - 1) * pageSizeN,
      })

      success(res, { list: rows, total: count, page: pageNum, page_size: pageSizeN })
    } catch (err: any) {
      logger.error('[DeviceMaintenance] getRuntimeLog error:', err)
      fail(res, err.message || '查询失败', ErrorCode.SYSTEM_ERROR)
    }
  },
}

// ============================================================
// 启动时 backfill：为已有标准但无档案的设备创建"生效"档案
// 保证存量标准在引入档案机制后仍能继续生成执行记录
// ============================================================
export async function initProfiles() {
  try {
    const stdRows = await DeviceMaintenanceStandard.findAll({
      attributes: ['device_id'],
      group: ['device_id'],
      raw: true,
    }) as any[]
    const stdDeviceIds: number[] = stdRows.map(r => r.device_id).filter(Boolean)
    if (stdDeviceIds.length === 0) return
    const existed = await DeviceMaintenanceProfile.findAll({
      attributes: ['device_id'],
      where: { device_id: { [Op.in]: stdDeviceIds } },
      raw: true,
    }) as any[]
    const existedSet = new Set(existed.map(p => p.device_id))
    const toCreate = stdDeviceIds.filter(id => !existedSet.has(id))
    if (toCreate.length === 0) return
    const devices = await Device.findAll({
      where: { device_id: { [Op.in]: toCreate } },
      attributes: ['device_id', 'device_code', 'device_name'],
      raw: true,
    }) as any[]
    const deviceMap = new Map(devices.map(d => [d.device_id, d]))
    const today = new Date().toISOString().slice(0, 10)
    const rows = toCreate.map(id => {
      const d = deviceMap.get(id)
      return {
        device_id: id,
        device_code: d?.device_code || null,
        device_name: d?.device_name || null,
        status: '生效',
        version: 1,
        effective_date: today,
      }
    })
    await DeviceMaintenanceProfile.bulkCreate(rows)
    console.log(`✅ 维护标准档案 backfill: ${rows.length} 台设备`)
  } catch (err: any) {
    logger.error('[DeviceMaintenance] initProfiles error:', err)
  }
}
