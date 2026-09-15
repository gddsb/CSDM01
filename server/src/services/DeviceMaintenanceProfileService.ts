/**
 * 设备保养计划 + 执行记录 Service（DeviceMaintenanceController 核心子模块下沉）
 *
 * 包含：保养计划 CRUD + 可用设备列表 + generateRecords（定时生成执行工单）
 *      + getMatrix（保养矩阵视图）+ 保养记录 CRUD + 工时记录
 *      + initProfiles（定时任务：从保养标准 backfill 档案）
 *
 * 触发模式：daily / weekly / monthly / runtime
 * UNFINISHED_STATUS = [0,1,3]（不含已完成2）
 */
import { Op } from 'sequelize'
import sequelize from '../config/database.js'
import {
  DeviceMaintenanceStandard,
  DeviceMaintenanceProfile,
  DeviceMaintenanceRecord,
  DeviceRuntimeLog,
  Device,
} from '../models/index.js'
import { STATUS_REVERSE } from '../models/DeviceMaintenanceRecord.js'
import {
  todayStr,
  dateOnlyStr,
  dailyPeriodKeys,
  weeklyPeriodKeys,
  monthlyStandardActive,
  buildPeriodKey,
} from '../utils/maintenanceMatrix.js'
import { generateDeviceRecordNo } from '../utils/sequence.js'
import { MAX_PAGE_SIZE } from '../utils/response.js'
import { AppError } from '../utils/error.js'
import { logger } from '../utils/logger.js'
import { UNFINISHED_STATUS, loadDeviceFields, getLatestRuntime, getRecordDetail } from './DeviceMaintenanceStandardService.js'

const rawStatus = (record: any): number => record.getDataValue('status')

// ============================================================
// 保养计划 CRUD
// ============================================================

export const DeviceMaintenanceProfileService = {
  /** 保养计划（档案）列表，含关联标准按 trigger_mode 分组计数 */
  async listProfiles(query: any) {
    const { keyword, status, page = 1, pageSize = 50 } = query
    const where: any = {}
    if (status) where.status = status
    let deviceIds: number[] | null = null
    if (keyword) {
      const devices = await Device.findAll({
        where: { [Op.or]: [
          { device_code: { [Op.like]: `%${keyword}%` } },
          { device_name: { [Op.like]: `%${keyword}%` } },
        ] },
        attributes: ['device_id'],
        raw: true,
      })
      deviceIds = devices.map((d: any) => d.device_id)
      if (deviceIds.length === 0) return { list: [], total: 0 }
      where.device_id = { [Op.in]: deviceIds }
    }
    const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
    const offset = (Number(page) - 1) * limit

    const { rows, count } = await DeviceMaintenanceProfile.findAndCountAll({
      where,
      include: [
        { model: Device, as: 'device', required: false, attributes: ['device_id', 'device_code', 'device_name'] },
        { model: DeviceMaintenanceStandard, as: 'standards', required: false, separate: true,
          attributes: ['standard_id', 'trigger_mode', 'status'] },
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
    return { list, total: count }
  },

  /** 可用设备：尚未创建保养档案的设备 */
  async listAvailableDevices(query: any) {
    const { keyword, entity_type } = query
    const where: any = {}
    if (entity_type && entity_type !== '全部') where.entity_type = entity_type
    const profiles = await DeviceMaintenanceProfile.findAll({
      attributes: ['device_id'],
      raw: true,
    })
    const existSet = new Set(profiles.map((p: any) => p.device_id))
    const allDevices = await Device.findAll({
      where: keyword
        ? { [Op.and]: [where, { [Op.or]: [
            { device_code: { [Op.like]: `%${keyword}%` } },
            { device_name: { [Op.like]: `%${keyword}%` } },
          ] }] }
        : where,
      order: [['device_code', 'ASC']],
    })
    return allDevices.filter((d: any) => !existSet.has(d.getDataValue('device_id')))
  },

  /** 创建保养档案 */
  async createProfile(body: any, actor?: any) {
    const { device_id } = body
    if (!device_id) throw new AppError('设备不能为空', 10001, 400)
    const device = await Device.findOne({ where: { device_id } })
    if (!device) throw new AppError('设备不存在', 10002, 404)
    const exists = await DeviceMaintenanceProfile.findOne({ where: { device_id } })
    if (exists) throw new AppError('该设备已存在保养档案', 20001, 409)

    return await DeviceMaintenanceProfile.create({
      device_id,
      device_code: (device as any).getDataValue('device_code'),
      device_name: (device as any).getDataValue('device_name'),
      status: body.status || '生效',
      version: body.version || 1,
      effective_date: body.effective_date || todayStr(),
      remarks: body.remarks || '',
      created_by: actor?.userId || null,
    } as any)
  },

  /** 档案详情（含关联标准按 mode 分组） */
  async detailProfile(id: number | string) {
    const p = await DeviceMaintenanceProfile.findOne({
      where: { profile_id: Number(id) },
      include: [
        { model: Device, as: 'device', required: false, attributes: ['device_id', 'device_code', 'device_name', 'entity_type'] },
        { model: DeviceMaintenanceStandard, as: 'standards', required: false, separate: true,
          order: [['trigger_mode', 'ASC'], ['sort_order', 'ASC']] },
      ],
    })
    if (!p) throw new AppError('保养档案不存在', 10002, 404)
    return p
  },

  /** 更新档案状态（生效/停用） */
  async updateProfileStatus(id: number | string, body: any) {
    const p = await DeviceMaintenanceProfile.findOne({ where: { profile_id: Number(id) } })
    if (!p) throw new AppError('保养档案不存在', 10002, 404)
    if (body.status) p.status = body.status
    if (body.remarks !== undefined) p.remarks = body.remarks
    if (body.version !== undefined) p.version = body.version
    await p.save()
    return p
  },

  /** 删除档案（只有 status != 生效 可删） */
  async deleteProfile(id: number | string) {
    const p = await DeviceMaintenanceProfile.findOne({ where: { profile_id: Number(id) } })
    if (!p) throw new AppError('保养档案不存在', 10002, 404)
    if (p.getDataValue('status') === '生效') {
      throw new AppError('生效中的档案不能删除，请先停用', 20001, 409)
    }
    await p.destroy()
    return true
  },

  // ============================================================
  // 保养记录生成（generateRecords）
  // ============================================================

  /**
   * 定时生成保养执行工单（核心逻辑）
   *
   * @param mode daily|weekly|monthly|runtime 或数组，默认全部
   * @param targetDate 目标日期（默认今天）
   * @param deviceId 限定单台设备（可选）
   */
  async generateRecords(body: any): Promise<{ created: number; total: number; records: any[] }> {
    const t = await sequelize.transaction()
    try {
      const { mode, target_date, device_id } = body || {}
      const targetDate = target_date ? new Date(target_date) : new Date()
      const targetModes: string[] = mode
        ? (Array.isArray(mode) ? mode : [mode])
        : ['daily', 'weekly', 'monthly', 'runtime']

      const createdList: any[] = []

      // 仅对档案 status='生效' 的设备生成
      const effectiveProfiles = await DeviceMaintenanceProfile.findAll({
        where: { status: '生效' },
        attributes: ['device_id'],
        transaction: t,
      })
      let effectiveDeviceIds: number[] = effectiveProfiles.map((p: any) => p.getDataValue('device_id'))
      if (device_id) effectiveDeviceIds = effectiveDeviceIds.filter(id => id === Number(device_id))
      if (effectiveDeviceIds.length === 0) {
        await t.commit()
        return { created: 0, total: 0, records: [] }
      }

      for (const m of targetModes) {
        if (!['daily', 'weekly', 'monthly', 'runtime'].includes(m)) continue

        const stdWhere: any = { trigger_mode: m, status: 1, device_id: { [Op.in]: effectiveDeviceIds } }
        const standards = await DeviceMaintenanceStandard.findAll({ where: stdWhere, transaction: t })

        const activeStandards: any[] = []

        if (m === 'runtime') {
          // runtime：查未完成执行记录（去重）
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
          const pk = buildPeriodKey(m, targetDate)
          const periodKeys = [pk]
          if (m === 'daily') {
            // 生成今日到月末的所有 daily keys（用于补签）
            const y = targetDate.getFullYear()
            const mo = targetDate.getMonth() + 1
            const allKeys = dailyPeriodKeys(y, mo)
            const fromIdx = allKeys.indexOf(pk)
            if (fromIdx >= 0) periodKeys.push(...allKeys.slice(fromIdx + 1))
          }
          const stdPeriodMap: Record<number, string> = {}
          for (const s of standards) stdPeriodMap[s.getDataValue('standard_id')] = pk

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
              const curPk = stdPeriodMap[sid]
              if (existSet.has(`${sid}|${curPk}`)) continue
              activeStandards.push({ s, periodKey: curPk })
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
          const record = await DeviceMaintenanceRecord.create({
            record_no: recordNo,
            device_id: s.getDataValue('device_id'),
            device_code: finalDeviceCode,
            device_name: finalDeviceName,
            standard_id: s.getDataValue('standard_id'),
            profile_id: null,
            trigger_mode: m,
            period_key: finalPeriodKey,
            sort_order: s.getDataValue('sort_order') || 0,
            status: 0, // 待执行
            result: null,
            actual_value: null,
            standard_value: s.getDataValue('standard_value'),
            executor_id: null,
            executor_name: null,
            start_time: null,
            end_time: null,
            duration_min: null,
            content: s.getDataValue('item_content'),
            item_name: s.getDataValue('item_name'),
            abnormal_desc: null,
            remarks: null,
          } as any, { transaction: t })
          createdList.push(record)

          // runtime 模式：更新 standard.last_trigger_value
          if (m === 'runtime' && currentRuntime !== undefined) {
            await s.update({ last_trigger_value: currentRuntime } as any, { transaction: t })
          }
        }
      }

      await t.commit()
      logger.info(`[DeviceMaintenance] generateRecords: created=${createdList.length}`)
      return { created: createdList.length, total: createdList.length, records: createdList }
    } catch (err) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      throw err
    }
  },

  // ============================================================
  // 保养矩阵视图（getMatrix）
  // ============================================================

  async getMatrix(query: any) {
    const { device_id, year_month, year } = query
    if (!device_id) throw new AppError('设备 ID 不能为空', 10001, 400)

    let ym = year_month
    if (!ym && year) ym = `${year}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    if (!ym) ym = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

    const [yr, mo] = ym.split('-').map(Number)
    const daysInMonth = new Date(yr, mo, 0).getDate()
    const dailyKeys = dailyPeriodKeys(yr, mo)
    const weekKeys = weeklyPeriodKeys(yr, mo)

    // 查全部启用标准
    const standards = await DeviceMaintenanceStandard.findAll({
      where: { device_id, status: 1 },
      order: [['trigger_mode', 'ASC'], ['sort_order', 'ASC'], ['standard_id', 'ASC']],
    })
    const dailyStds: any[] = []
    const weeklyStds: any[] = []
    const monthlyStds: any[] = []
    const runtimeStds: any[] = []
    standards.forEach((s: any) => {
      const tm = s.getDataValue('trigger_mode')
      if (tm === 'daily') dailyStds.push(s)
      else if (tm === 'weekly') weeklyStds.push(s)
      else if (tm === 'monthly') {
        if (monthlyStandardActive(s.getDataValue('monthly_plan'), mo)) monthlyStds.push(s)
      } else if (tm === 'runtime') runtimeStds.push(s)
    })

    // 查该月内所有执行记录
    const dailyStart = dailyKeys[0]
    const dailyEnd = dailyKeys[dailyKeys.length - 1]
    const records = await DeviceMaintenanceRecord.findAll({
      where: {
        device_id,
        [Op.or]: [
          { trigger_mode: 'daily', period_key: { [Op.gte]: dailyStart, [Op.lte]: dailyEnd } },
          { trigger_mode: 'weekly', period_key: { [Op.in]: weekKeys } },
          { trigger_mode: 'monthly', period_key: ym },
        ],
      },
      attributes: ['record_id', 'standard_id', 'trigger_mode', 'period_key',
        'status', 'result', 'actual_value', 'executor_name', 'executor_id',
        'start_time', 'end_time', 'duration_min', 'abnormal_desc'],
    })

    const recordsMap = new Map<string, any>()
    records.forEach((r: any) => {
      const raw = r.toJSON()
      recordsMap.set(`${raw.trigger_mode}|${raw.period_key}|${raw.standard_id}`, raw)
    })

    // 构建矩阵：standards × period_keys 的 cell 数组
    const buildCells = (stds: any[], periodKeys: string[]) => stds.map((s: any) => ({
      standard: {
        standard_id: s.getDataValue('standard_id'),
        standard_name: s.getDataValue('standard_name'),
        item_name: s.getDataValue('item_name'),
        sort_order: s.getDataValue('sort_order'),
        trigger_mode: s.getDataValue('trigger_mode'),
      },
      cells: periodKeys.map(pk => {
        const key = `${s.getDataValue('trigger_mode')}|${pk}|${s.getDataValue('standard_id')}`
        const rec = recordsMap.get(key)
        if (!rec) return { period_key: pk, record: null }
        const statusText = STATUS_REVERSE[rec.status] || String(rec.status)
        return {
          period_key: pk,
          record: {
            record_id: rec.record_id,
            status: rec.status,
            status_text: statusText,
            result: rec.result,
            actual_value: rec.actual_value,
            executor_name: rec.executor_name,
            start_time: rec.start_time,
            end_time: rec.end_time,
            duration_min: rec.duration_min,
          },
        }
      }),
    }))

    return {
      year_month: ym,
      days_in_month: daysInMonth,
      daily_period_keys: dailyKeys,
      weekly_period_keys: weekKeys,
      daily_standards: buildCells(dailyStds, dailyKeys),
      weekly_standards: buildCells(weeklyStds, weekKeys),
      monthly_standards: buildCells(monthlyStds, [ym]),
      runtime_standards: runtimeStds.map((s: any) => ({
        standard_id: s.getDataValue('standard_id'),
        standard_name: s.getDataValue('standard_name'),
        item_name: s.getDataValue('item_name'),
        runtime_threshold: s.getDataValue('runtime_threshold'),
      })),
    }
  },

  // ============================================================
  // 保养执行记录 CRUD
  // ============================================================

  async listRecords(query: any) {
    const { device_id, trigger_mode, status, result, keyword, start_date, end_date, page = 1, pageSize = 20 } = query
    const where: any = {}
    if (device_id) where.device_id = device_id
    if (trigger_mode) where.trigger_mode = trigger_mode
    if (status !== undefined && status !== '') where.status = Number(status)
    if (result) where.result = result
    if (keyword) where[Op.or] = [
      { record_no: { [Op.like]: `%${keyword}%` } },
      { device_name: { [Op.like]: `%${keyword}%` } },
      { content: { [Op.like]: `%${keyword}%` } },
    ]
    if (start_date || end_date) {
      where.created_at = {}
      if (start_date) where.created_at[Op.gte] = new Date(start_date)
      if (end_date) where.created_at[Op.lte] = new Date(new Date(end_date).getTime() + 86400000)
    }
    const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
    const offset = (Number(page) - 1) * limit
    return await DeviceMaintenanceRecord.findAndCountAll({
      where, limit, offset,
      include: [
        { model: Device, as: 'device', required: false, attributes: ['device_id', 'device_code', 'device_name'] },
        { model: DeviceMaintenanceStandard, as: 'standard', required: false, attributes: ['standard_id', 'standard_name', 'item_name'] },
      ],
      order: [['created_at', 'DESC']],
    })
  },

  async detailRecord(id: number | string) {
    const record = await getRecordDetail(Number(id))
    if (!record) throw new AppError('保养执行记录不存在', 10002, 404)
    return record
  },

  /** 开始执行（状态 0→1） */
  async startRecord(id: number | string, actor?: any) {
    const record = await DeviceMaintenanceRecord.findOne({ where: { record_id: Number(id) } })
    if (!record) throw new AppError('保养执行记录不存在', 10002, 404)
    if (rawStatus(record) !== 0) throw new AppError('只有待执行可以开始', 20001, 409)

    await record.update({
      status: 1,
      start_time: new Date(),
      executor_id: actor?.userId || null,
      executor_name: actor?.realName || actor?.username || null,
    } as any)
    return record
  },

  /** 提交执行结果（状态 → 已完成 或 异常） */
  async submitRecord(id: number | string, body: any, actor?: any) {
    const t = await sequelize.transaction()
    try {
      const record = await DeviceMaintenanceRecord.findOne({ where: { record_id: Number(id) }, transaction: t })
      if (!record) throw new AppError('保养执行记录不存在', 10002, 404)

      const { result, actual_value, abnormal_desc, duration_min, end_time, remarks, maintenance_content, spare_parts_used } = body
      if (!result) throw new AppError('执行结果不能为空（正常/异常）', 10001, 400)

      const now = end_time ? new Date(end_time) : new Date()
      let finalDuration = duration_min !== undefined ? duration_min : null
      if (finalDuration === null) {
        const st = record.getDataValue('start_time')
        if (st) finalDuration = Math.max(1, Math.round((now.getTime() - new Date(st).getTime()) / 60000))
      }

      const statusVal = result === '异常' ? 4 : 2 // 4=异常完成, 2=已完成
      await record.update({
        status: statusVal,
        result,
        actual_value: actual_value !== undefined ? actual_value : null,
        end_time: now,
        duration_min: finalDuration,
        abnormal_desc: abnormal_desc || null,
        executor_id: actor?.userId || record.getDataValue('executor_id'),
        executor_name: actor?.realName || actor?.username || record.getDataValue('executor_name'),
        content: maintenance_content || record.getDataValue('content'),
        spare_parts_used: spare_parts_used ? JSON.stringify(spare_parts_used) : null,
        remarks: remarks || null,
      } as any, { transaction: t })

      await t.commit()
      return await getRecordDetail(Number(id))
    } catch (err) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      throw err
    }
  },

  /** 批量提交（遍历调用 submitRecord 逻辑，事务包裹） */
  async batchSubmit(body: any, actor?: any) {
    const { ids, result, abnormal_desc, remarks, duration_min, end_time } = body
    if (!Array.isArray(ids) || ids.length === 0) throw new AppError('请提供记录 ID 列表', 10001, 400)
    if (!result) throw new AppError('执行结果不能为空', 10001, 400)

    const t = await sequelize.transaction()
    try {
      const now = end_time ? new Date(end_time) : new Date()
      const statusVal = result === '异常' ? 4 : 2
      let successCount = 0
      for (const rid of ids) {
        const record = await DeviceMaintenanceRecord.findOne({ where: { record_id: Number(rid) }, transaction: t })
        if (!record) continue
        // 跳过已完成（避免重复提交）
        const st = rawStatus(record)
        if (st === 2 || st === 4) continue

        let finalDuration = duration_min !== undefined ? duration_min : null
        if (finalDuration === null) {
          const rec_st = record.getDataValue('start_time')
          if (rec_st) finalDuration = Math.max(1, Math.round((now.getTime() - new Date(rec_st).getTime()) / 60000))
        }
        await record.update({
          status: statusVal,
          result,
          end_time: now,
          duration_min: finalDuration,
          abnormal_desc: abnormal_desc || null,
          remarks: remarks || null,
          executor_id: actor?.userId || record.getDataValue('executor_id'),
          executor_name: actor?.realName || actor?.username || record.getDataValue('executor_name'),
        } as any, { transaction: t })
        successCount++
      }
      await t.commit()
      return { success_count: successCount, total: ids.length }
    } catch (err) {
      if (t && !(t as any).finished) { try { await t.rollback() } catch (_) { /* ignore */ } }
      throw err
    }
  },

  /** 跳过执行（状态 → 3） */
  async skipRecord(id: number | string, body: any, actor?: any) {
    const record = await DeviceMaintenanceRecord.findOne({ where: { record_id: Number(id) } })
    if (!record) throw new AppError('保养执行记录不存在', 10002, 404)

    const st = rawStatus(record)
    if (st === 2 || st === 4) throw new AppError('已完成的记录不能跳过', 20001, 409)

    await record.update({
      status: 3,
      result: '跳过',
      abnormal_desc: body.abnormal_desc || body.reason || null,
      executor_id: actor?.userId || null,
      executor_name: actor?.realName || actor?.username || null,
      end_time: new Date(),
    } as any)
    return record
  },

  /** 删除执行记录（只有未完成可以删） */
  async deleteRecord(id: number | string) {
    const record = await DeviceMaintenanceRecord.findOne({ where: { record_id: Number(id) } })
    if (!record) throw new AppError('保养执行记录不存在', 10002, 404)
    if (!UNFINISHED_STATUS.includes(rawStatus(record))) {
      throw new AppError('已完成/异常/跳过的记录不能删除', 20001, 409)
    }
    await record.destroy()
    return true
  },

  // ============================================================
  // 运行小时记录
  // ============================================================

  /** 提交设备运行小时（runtime 触发用） */
  async logRuntime(body: any, actor?: any) {
    const { device_id, runtime_hours, note } = body
    if (!device_id) throw new AppError('设备不能为空', 10001, 400)
    if (runtime_hours === undefined || runtime_hours === null) throw new AppError('运行小时不能为空', 10001, 400)

    const device = await Device.findOne({ where: { device_id } })
    if (!device) throw new AppError('设备不存在', 10002, 404)

    const log = await DeviceRuntimeLog.create({
      device_id,
      device_code: (device as any).getDataValue('device_code'),
      device_name: (device as any).getDataValue('device_name'),
      runtime_hours: Number(runtime_hours),
      note: note || '',
      logged_by: actor?.userId || null,
      logged_by_name: actor?.username || actor?.realName || null,
    } as any)
    return log
  },

  /** 查某设备运行小时日志 */
  async getRuntimeLog(deviceId: number | string) {
    return await DeviceRuntimeLog.findAll({
      where: { device_id: Number(deviceId) },
      order: [['created_at', 'DESC'], ['log_id', 'DESC']],
      limit: 200,
    })
  },

  // ============================================================
  // 定时任务：从保养标准 backfill 保养档案
  // ============================================================

  /** export async function initProfiles（原 Controller 同名函数迁移，app.ts 定时任务调用） */
  async initProfiles() {
    try {
      const stdRows = await DeviceMaintenanceStandard.findAll({
        attributes: ['device_id'],
        group: ['device_id'],
        raw: true,
      })
      const stdDeviceIds: number[] = stdRows.map((r: any) => r.device_id).filter(Boolean)
      if (stdDeviceIds.length === 0) return
      const existed = await DeviceMaintenanceProfile.findAll({
        attributes: ['device_id'],
        where: { device_id: { [Op.in]: stdDeviceIds } },
        raw: true,
      })
      const existedSet = new Set(existed.map((p: any) => p.device_id))
      const toCreate = stdDeviceIds.filter(id => !existedSet.has(id))
      if (toCreate.length === 0) return
      const devices = await Device.findAll({
        where: { device_id: { [Op.in]: toCreate } },
        attributes: ['device_id', 'device_code', 'device_name'],
        raw: true,
      })
      const deviceMap = new Map(devices.map((d: any) => [d.device_id, d]))
      const today = new Date().toISOString().slice(0, 10)
      const rows = toCreate.map((id: number) => {
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
      logger.info(`[DeviceMaintenance] initProfiles: backfill ${rows.length} devices`)
    } catch (err: any) {
      logger.error('[DeviceMaintenance] initProfiles error:', err)
    }
  },
}

export default DeviceMaintenanceProfileService
