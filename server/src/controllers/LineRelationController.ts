import { LineProcess, LineDevice, Process, Device, ProductionLine } from '../models/index.js'
import { success, fail, ErrorCode } from '../utils/response.js'

export const getLineProcesses = async (req, res) => {
  try {
    const { id } = req.params
    const line = await ProductionLine.findOne({ where: { line_id: id } })
    if (!line) return fail(res, '产线不存在', ErrorCode.RECORD_NOT_FOUND)

    const lineProcesses = await LineProcess.findAll({
      where: { line_id: id, status: 1 },
      order: [['sort_order', 'ASC'], ['id', 'ASC']],
    })

    const processIds = [...new Set(lineProcesses.map(lp => lp.process_id))]
    const processes = processIds.length > 0
      ? await Process.findAll({ where: { process_id: processIds } })
      : []
    const processMap = new Map(processes.map(p => [p.process_id, p]))

    const result = lineProcesses.map(lp => {
      const process = processMap.get(lp.process_id)
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

    return success(res, result, '查询成功')
  } catch (err) {
    console.error('查询产线工序关联失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const addLineProcess = async (req, res) => {
  try {
    const { id } = req.params
    const { process_id, sort_order = 0 } = req.body

    if (!process_id) return fail(res, '工序ID不能为空')

    const line = await ProductionLine.findOne({ where: { line_id: id } })
    if (!line) return fail(res, '产线不存在', ErrorCode.RECORD_NOT_FOUND)

    const process = await Process.findOne({ where: { process_id } })
    if (!process) return fail(res, '工序不存在', ErrorCode.RECORD_NOT_FOUND)

    const exists = await LineProcess.findOne({ where: { line_id: id, process_id } })
    if (exists) {
      if (exists.status === 1) return fail(res, '该工序已关联到产线')
      await exists.update({ status: 1, sort_order })
      return success(res, exists, '关联成功')
    }

    const lineProcess = await LineProcess.create({
      line_id: id,
      process_id,
      sort_order,
      status: 1,
    })

    return success(res, lineProcess, '关联成功')
  } catch (err) {
    console.error('添加产线工序关联失败:', err)
    if (err.name === 'SequelizeUniqueConstraintError') {
      return fail(res, '该工序已关联到产线')
    }
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const removeLineProcess = async (req, res) => {
  try {
    const { id, processId } = req.params

    const lineProcess = await LineProcess.findOne({ where: { line_id: id, process_id: processId } })
    if (!lineProcess) return fail(res, '关联不存在', ErrorCode.RECORD_NOT_FOUND)

    await lineProcess.destroy()
    return success(res, null, '移除成功')
  } catch (err) {
    console.error('移除产线工序关联失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const updateLineProcessSort = async (req, res) => {
  try {
    const { id } = req.params
    const { items } = req.body

    if (!items || !Array.isArray(items)) return fail(res, '参数错误')

    for (const item of items) {
      await LineProcess.update(
        { sort_order: item.sort_order },
        { where: { id: item.id } }
      )
    }

    return success(res, null, '排序更新成功')
  } catch (err) {
    console.error('更新产线工序排序失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const getLineDevices = async (req, res) => {
  try {
    const { id } = req.params
    const line = await ProductionLine.findOne({ where: { line_id: id } })
    if (!line) return fail(res, '产线不存在', ErrorCode.RECORD_NOT_FOUND)

    const lineDevices = await LineDevice.findAll({
      where: { line_id: id },
      order: [['sort_order', 'ASC'], ['id', 'ASC']],
    })

    const deviceIds = [...new Set(lineDevices.map(ld => ld.device_id))]
    const processIds = [...new Set(lineDevices.map(ld => ld.process_id).filter(Boolean))]

    const [devices, processes] = await Promise.all([
      deviceIds.length > 0 ? Device.findAll({ where: { device_id: deviceIds } }) : [],
      processIds.length > 0 ? Process.findAll({ where: { process_id: processIds } }) : [],
    ])

    const deviceMap = new Map(devices.map(d => [d.device_id, d]))
    const processMap = new Map(processes.map(p => [p.process_id, p]))

    const result = lineDevices.map(ld => {
      const device = deviceMap.get(ld.device_id)
      const process = ld.process_id ? processMap.get(ld.process_id) : null
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

    return success(res, result, '查询成功')
  } catch (err) {
    console.error('查询产线设备关联失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const addLineDevice = async (req, res) => {
  try {
    const { id } = req.params
    const { device_id, process_id, sort_order = 0 } = req.body

    if (!device_id) return fail(res, '设备ID不能为空')

    const line = await ProductionLine.findOne({ where: { line_id: id } })
    if (!line) return fail(res, '产线不存在', ErrorCode.RECORD_NOT_FOUND)

    const device = await Device.findOne({ where: { device_id } })
    if (!device) return fail(res, '设备不存在', ErrorCode.RECORD_NOT_FOUND)

    if (process_id) {
      const process = await Process.findOne({ where: { process_id } })
      if (!process) return fail(res, '工序不存在', ErrorCode.RECORD_NOT_FOUND)
    }

    const exists = await LineDevice.findOne({
      where: { line_id: id, device_id, process_id: process_id || null },
    })
    if (exists) return fail(res, '该设备已关联到产线')

    const lineDevice = await LineDevice.create({
      line_id: id,
      device_id,
      process_id: process_id || null,
      sort_order,
    })

    return success(res, lineDevice, '关联成功')
  } catch (err) {
    console.error('添加产线设备关联失败:', err)
    if (err.name === 'SequelizeUniqueConstraintError') {
      return fail(res, '该设备已关联到产线')
    }
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const removeLineDevice = async (req, res) => {
  try {
    const { id, deviceId } = req.params

    const lineDevice = await LineDevice.findOne({ where: { line_id: id, device_id: deviceId } })
    if (!lineDevice) return fail(res, '关联不存在', ErrorCode.RECORD_NOT_FOUND)

    await lineDevice.destroy()
    return success(res, null, '移除成功')
  } catch (err) {
    console.error('移除产线设备关联失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export const updateLineDeviceSort = async (req, res) => {
  try {
    const { id } = req.params
    const { items } = req.body

    if (!items || !Array.isArray(items)) return fail(res, '参数错误')

    for (const item of items) {
      await LineDevice.update(
        { sort_order: item.sort_order },
        { where: { id: item.id } }
      )
    }

    return success(res, null, '排序更新成功')
  } catch (err) {
    console.error('更新产线设备排序失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export default {
  getLineProcesses,
  addLineProcess,
  removeLineProcess,
  updateLineProcessSort,
  getLineDevices,
  addLineDevice,
  removeLineDevice,
  updateLineDeviceSort,
}