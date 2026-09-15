/**
 * 产线关联 Service（LineRelationController 下沉）
 *
 * 两组关联：
 *   LineProcess — ProductionLine ↔ Process
 *   LineDevice  — ProductionLine ↔ Device（可关联可选 Process）
 *
 * 特色逻辑：
 *   - addLineProcess 遇到软删除(status≠1)时走恢复逻辑（update status=1）
 *   - updateLineProcessSort / updateLineDeviceSort 用 Promise.all 并行批量
 *   - SequelizeUniqueConstraintError 在 Service 中统一转为 AppError
 */
import { LineProcess, LineDevice, Process, Device, ProductionLine } from '../models/index.js'
import { AppError } from '../utils/error.js'

// ============================================================
// 产线 — 工序
// ============================================================

export const LineRelationService = {
  /** 查某产线的有效工序列表（带 Process 信息 join） */
  async getLineProcesses(lineId: number) {
    const line = await ProductionLine.findOne({ where: { line_id: lineId } })
    if (!line) throw new AppError('产线不存在', 10002, 404)

    const lineProcesses = await LineProcess.findAll({
      where: { line_id: lineId, status: 1 },
      order: [['sort_order', 'ASC'], ['id', 'ASC']],
    })
    const processIds = [...new Set(lineProcesses.map(lp => (lp as any).process_id))]
    const processes = processIds.length > 0
      ? await Process.findAll({ where: { process_id: processIds } })
      : []
    const processMap = new Map(processes.map(p => [(p as any).process_id, p]))

    return lineProcesses.map((lp: any) => {
      const process = processMap.get(lp.process_id) as any
      return {
        id: lp.id,
        line_id: lp.line_id,
        process_id: lp.process_id,
        process_code: process?.process_code || '',
        process_name: process?.process_name || '',
        sort_order: lp.sort_order,
        status: lp.status,
      }
    })
  },

  /** 关联工序到产线（存在软删除则恢复，存在生效则拒绝） */
  async addLineProcess(lineId: number, processId: number, sortOrder = 0) {
    const line = await ProductionLine.findOne({ where: { line_id: lineId } })
    if (!line) throw new AppError('产线不存在', 10002, 404)
    const process = await Process.findOne({ where: { process_id: processId } })
    if (!process) throw new AppError('工序不存在', 10002, 404)

    const exists = await LineProcess.findOne({ where: { line_id: lineId, process_id: processId } })
    if (exists) {
      if ((exists as any).status === 1) throw new AppError('该工序已关联到产线', 20001, 409)
      await exists.update({ status: 1, sort_order: sortOrder })
      return exists
    }
    try {
      return await LineProcess.create({
        line_id: lineId,
        process_id: processId,
        sort_order: sortOrder,
        status: 1,
      })
    } catch (err: any) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        throw new AppError('该工序已关联到产线', 20001, 409)
      }
      throw err
    }
  },

  async removeLineProcess(lineId: number, processId: number) {
    const lineProcess = await LineProcess.findOne({
      where: { line_id: lineId, process_id: processId },
    })
    if (!lineProcess) throw new AppError('关联不存在', 10002, 404)
    await lineProcess.destroy()
    return true
  },

  /** 批量并行更新工序排序 */
  async updateLineProcessSort(items: Array<{ id?: number; sort_order?: number }>) {
    if (!items || !Array.isArray(items)) throw new AppError('参数错误', 10001, 400)
    await Promise.all(
      items
        .filter(item => item?.id != null)
        .map(item =>
          LineProcess.update(
            { sort_order: item.sort_order } as any,
            { where: { id: item.id } },
          ),
        ),
    )
    return true
  },

  // ============================================================
  // 产线 — 设备
  // ============================================================

  /** 查某产线的设备关联列表（带 Device + Process 信息 join） */
  async getLineDevices(lineId: number) {
    const line = await ProductionLine.findOne({ where: { line_id: lineId } })
    if (!line) throw new AppError('产线不存在', 10002, 404)

    const lineDevices = await LineDevice.findAll({
      where: { line_id: lineId },
      order: [['sort_order', 'ASC'], ['id', 'ASC']],
    })
    const deviceIds = [...new Set(lineDevices.map(ld => (ld as any).device_id))]
    const processIds = [...new Set(lineDevices.map(ld => (ld as any).process_id).filter(Boolean))]

    const [devices, processes] = await Promise.all([
      deviceIds.length > 0 ? Device.findAll({ where: { device_id: deviceIds } }) : Promise.resolve([] as any[]),
      processIds.length > 0 ? Process.findAll({ where: { process_id: processIds } }) : Promise.resolve([] as any[]),
    ])
    const deviceMap = new Map(devices.map(d => [(d as any).device_id, d]))
    const processMap = new Map(processes.map(p => [(p as any).process_id, p]))

    return lineDevices.map((ld: any) => {
      const device = deviceMap.get(ld.device_id) as any
      const process = ld.process_id ? processMap.get(ld.process_id) as any : null
      return {
        id: ld.id,
        line_id: ld.line_id,
        device_id: ld.device_id,
        device_code: device?.device_code || '',
        device_name: device?.device_name || '',
        device_model: device?.device_model || '',
        process_id: ld.process_id,
        process_code: process?.process_code || '',
        process_name: process?.process_name || '',
        sort_order: ld.sort_order,
      }
    })
  },

  /** 关联设备到产线 */
  async addLineDevice(lineId: number, deviceId: number, processId?: number | null, sortOrder = 0) {
    const line = await ProductionLine.findOne({ where: { line_id: lineId } })
    if (!line) throw new AppError('产线不存在', 10002, 404)
    const device = await Device.findOne({ where: { device_id: deviceId } })
    if (!device) throw new AppError('设备不存在', 10002, 404)
    if (processId) {
      const process = await Process.findOne({ where: { process_id: processId } })
      if (!process) throw new AppError('工序不存在', 10002, 404)
    }

    const exists = await LineDevice.findOne({
      where: { line_id: lineId, device_id: deviceId, process_id: processId || null },
    })
    if (exists) throw new AppError('该设备已关联到产线', 20001, 409)

    try {
      return await LineDevice.create({
        line_id: lineId,
        device_id: deviceId,
        process_id: processId || null,
        sort_order: sortOrder,
      })
    } catch (err: any) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        throw new AppError('该设备已关联到产线', 20001, 409)
      }
      throw err
    }
  },

  async removeLineDevice(lineId: number, deviceId: number) {
    const lineDevice = await LineDevice.findOne({
      where: { line_id: lineId, device_id: deviceId },
    })
    if (!lineDevice) throw new AppError('关联不存在', 10002, 404)
    await lineDevice.destroy()
    return true
  },

  /** 批量并行更新设备排序（原 Controller 是串行 for→统一改为 Promise.all） */
  async updateLineDeviceSort(items: Array<{ id?: number; sort_order?: number }>) {
    if (!items || !Array.isArray(items)) throw new AppError('参数错误', 10001, 400)
    await Promise.all(
      items
        .filter(item => item?.id != null)
        .map(item =>
          LineDevice.update(
            { sort_order: item.sort_order } as any,
            { where: { id: item.id } },
          ),
        ),
    )
    return true
  },
}

export default LineRelationService
