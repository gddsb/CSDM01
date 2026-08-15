import { Op, fn, col, where as seqWhere } from 'sequelize'
import {
  TaskSetting, SyncTask, ScheduledTask, U9Item, U9Customer, U9ProductionOrder, U9PurchaseReceipt,
  EnvMonitor, EnvAlarm, WeatherInfo, EnergyMeterData,
  Order, ReportOrder, ReportProcess, ProcessDefect,
  ProductionLine, Device, Material, Process, Customer,
  ProductInspection, IncomingInspection, MicrobeInspection,
  InspectionStandard,
} from '../../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../../utils/response.js'
import { encryptParamsObj, decryptParamsObj } from '../../utils/crypto.js'
import { fetchU9Orgs, DEFAULT_U9_CONFIG } from '../../services/u9Service.js'
import { calcNextRunAt } from '../../services/taskScheduler.js'
import { executeRealTask } from '../../services/taskExecutor.js'
import { syncItemsToBasMaterial, syncProductionOrdersToOrder } from '../../services/u9Exporter.js'
import { formatDateTime, formatDate, nowBeijingStr, nowBeijingDateStr, nowBeijingDate } from '../../utils/date.js'

// 露点温度计算（考虑大气压的增强版 Magnus 公式）
// T:摄氏温度, RH:相对湿度%, P:大气压(hPa，默认1013.25)
function calcDewPoint(T: number, RH: number, P: number = 1013.25): number | null {
  if (T == null || RH == null || Number.isNaN(T) || Number.isNaN(RH)) return null
  // 饱和水汽压（Magnus公式）
  const es = 6.112 * Math.exp((17.67 * T) / (T + 243.5))
  // 增强因子（考虑大气压对饱和水汽压的修正）
  const fw = 1.0016 + 3.15e-6 * P - 0.074 / P
  // 修正后的饱和水汽压
  const ew = fw * es
  // 实际水汽压
  const e = ew * RH / 100
  if (e <= 0 || e >= ew) {
    // RH异常时退化为标准Magnus
    const es2 = 6.112 * Math.exp((17.67 * T) / (T + 243.5))
    const e2 = es2 * Math.min(100, Math.max(0, RH)) / 100
    if (e2 <= 0) return null
    const lnE2 = Math.log(e2 / 6.112)
    const Td2 = (243.5 * lnE2) / (17.67 - lnE2)
    if (Number.isNaN(Td2) || !isFinite(Td2)) return null
    return Math.round(Td2 * 10) / 10
  }
  const lnE = Math.log(e / 6.112)
  const Td = (243.5 * lnE) / (17.67 - lnE)
  if (Number.isNaN(Td) || !isFinite(Td)) return null
  return Math.round(Td * 10) / 10
}

// ============ 任务设置 ============
// ============ 环境监测仪表盘 ============
export const dashboardOverview = async (req, res) => {
  try {
    const latestBatch = await EnvMonitor.findAll({
      order: [['collect_time', 'DESC']],
      limit: 200,
      raw: true,
    })

    const factorLatest = new Map<string, any>()
    for (const r of latestBatch as any[]) {
      if (!factorLatest.has(r.factor_name)) factorLatest.set(r.factor_name, r)
    }

    // 获取最新大气压（task_weather_info 表）
    let pressure = 1013.25
    try {
      const latestWeather = await WeatherInfo.findOne({
        order: [['weather_time', 'DESC']],
        raw: true,
      }) as any
      if (latestWeather && latestWeather.pressure) pressure = Number(latestWeather.pressure)
    } catch (e) {
      console.warn('[dashboardOverview] 读取大气压失败，使用默认值:', (e as any).message)
    }

    // 计算各区域的平均温度、湿度和露点温度（考虑大气压）
    const areaStats: Record<string, { temps: number[]; hums: number[] }> = {}
    for (const f of factorLatest.values()) {
      const name: string = f.factor_name || ''
      if (!name.includes('温度') && !name.includes('湿度')) continue
      const area = name.includes('车间') ? 'workshop' : name.includes('仓库') ? 'warehouse' : null
      if (!area) continue
      if (!areaStats[area]) areaStats[area] = { temps: [], hums: [] }
      if (name.includes('温度') && typeof f.value === 'number') areaStats[area].temps.push(f.value)
      if (name.includes('湿度') && typeof f.value === 'number') areaStats[area].hums.push(f.value)
    }
    const dewPoints: Record<string, number | null> = {}
    for (const [area, s] of Object.entries(areaStats)) {
      const avgT = s.temps.length ? s.temps.reduce((a, b) => a + b, 0) / s.temps.length : NaN
      const avgH = s.hums.length ? s.hums.reduce((a, b) => a + b, 0) / s.hums.length : NaN
      dewPoints[area] = calcDewPoint(avgT, avgH, pressure)
    }

    const totalAlarms = await EnvAlarm.count()
    const unhandledAlarms = await EnvAlarm.count({ where: { is_handled: 0 } })
    const todayStart = nowBeijingDate()
    todayStart.setHours(0, 0, 0, 0)
    const todayAlarms = await EnvAlarm.count({ where: { alarm_time: { [Op.gte]: todayStart } } })

    const recentAlarms = await EnvAlarm.findAll({
      order: [['alarm_time', 'DESC']],
      limit: 15,
      raw: true,
    })

    return success(res, {
      factors: Array.from(factorLatest.values()),
      alarms: { total: totalAlarms, unhandled: unhandledAlarms, today: todayAlarms, recent: recentAlarms },
      dew_points: dewPoints,
      lastUpdate: latestBatch[0]?.collect_time || null,
    })
  } catch (err) {
    console.error('获取仪表盘数据失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 趋势数据（最近12小时，10分钟间隔）
export const dashboardTrend = async (req, res) => {
  try {
    const now = nowBeijingDate()
    const currentSlot = new Date(now)
    currentSlot.setSeconds(0, 0)
    currentSlot.setMinutes(Math.floor(currentSlot.getMinutes() / 10) * 10)
    const startTime = new Date(currentSlot)
    startTime.setMinutes(startTime.getMinutes() - 11 * 60 - 50)

    const rows = await EnvMonitor.findAll({
      where: { collect_time: { [Op.gte]: startTime, [Op.lte]: now } },
      order: [['collect_time', 'ASC']],
      raw: true,
    })

    const slotMarks: Date[] = []
    for (let i = 71; i >= 0; i--) {
      const d = new Date(currentSlot)
      d.setMinutes(d.getMinutes() - i * 10)
      slotMarks.push(d)
    }
    const times = slotMarks.map((d) => formatDateTime(d))

    const getArea = (factorName: string): 'workshop' | 'warehouse' | 'other' => {
      if (factorName.includes('车间')) return 'workshop'
      if (factorName.includes('仓库')) return 'warehouse'
      return 'other'
    }

    type Rec = { time: Date; value: number }
    const grouped = new Map<string, Rec[]>()
    for (const r of rows as any[]) {
      if (!r.factor_name) continue
      const area = getArea(r.factor_name as string)
      const factorType = (r as any).factor_name.includes('温度') ? 'temperature'
        : (r as any).factor_name.includes('湿度') ? 'humidity' : null
      if (!factorType) continue
      const key = `${area}|${factorType}`
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push({ time: new Date((r as any).collect_time), value: (r as any).value })
    }

    function bucketAvg(recs: Rec[], target: Date, windowMs: number = 10 * 60 * 1000): number | null {
      if (recs.length === 0) return null
      const targetTs = target.getTime()
      let sum = 0
      let count = 0
      let fallback: Rec | null = null
      let fallbackDiff = Infinity
      for (const r of recs) {
        const diff = Math.abs(r.time.getTime() - targetTs)
        if (diff <= windowMs / 2) {
          sum += r.value
          count++
        }
        if (diff < fallbackDiff) {
          fallback = r
          fallbackDiff = diff
        }
      }
      if (count > 0) return Number((sum / count).toFixed(2))
      if (fallback && fallbackDiff <= windowMs) return Number(Number(fallback.value).toFixed(2))
      return null
    }

    const areas = ['workshop', 'warehouse'] as const
    const areaSlots: Record<string, { temp: (number | null)[]; hum: (number | null)[]; dew: (number | null)[] }> = {}
    for (const area of areas) {
      const tempRecs = grouped.get(`${area}|temperature`) || []
      const humRecs = grouped.get(`${area}|humidity`) || []
      const temp: (number | null)[] = []
      const hum: (number | null)[] = []
      const dew: (number | null)[] = []
      for (const mark of slotMarks) {
        const tv = bucketAvg(tempRecs, mark)
        const hv = bucketAvg(humRecs, mark)
        temp.push(tv)
        hum.push(hv)
        dew.push(tv !== null && hv !== null ? calcDewPoint(tv, hv) : null)
      }
      areaSlots[area] = { temp, hum, dew }
    }

    const seriesDefs = [
      { area: 'workshop', factor: 'temperature', label: '车间温度', color: '#ff4d4f' },
      { area: 'workshop', factor: 'humidity', label: '车间湿度', color: '#1890ff' },
      { area: 'workshop', factor: 'dew', label: '车间露点', color: '#a855f7' },
      { area: 'warehouse', factor: 'temperature', label: '仓库温度', color: '#fa8c16' },
      { area: 'warehouse', factor: 'humidity', label: '仓库湿度', color: '#13c2c2' },
      { area: 'warehouse', factor: 'dew', label: '仓库露点', color: '#f59e0b' },
    ]

    const series: { name: string; color: string; data: (number | null)[] }[] = []
    for (const s of seriesDefs) {
      const data: (number | null)[] = []
      const slots = areaSlots[s.area] as any
      for (let i = 0; i < 72; i++) {
        if (s.factor === 'temperature') data.push(slots.temp[i])
        else if (s.factor === 'humidity') data.push(slots.hum[i])
        else if (s.factor === 'dew') data.push(slots.dew[i])
      }
      series.push({ name: s.label, color: s.color, data })
    }

    return success(res, { hours: 12, intervalMinutes: 10, times, series })
  } catch (err) {
    console.error('获取趋势数据失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// ============ 生产实时看板数据 ============
export const productionDashboard = async (req, res) => {
  try {
    const todayStart = nowBeijingDate()
    todayStart.setHours(0, 0, 0, 0)
    const thirtyDaysAgo = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000)
    const now = nowBeijingDate()

    // 1. 基础数据：产线、工序、设备
    const productionLines = await ProductionLine.findAll({ order: [['sort_order', 'ASC']], raw: true })
    const devices = await Device.findAll({ raw: true })
    const processes = await Process.findAll({ order: [['sort_order', 'ASC']], raw: true })
    const materials = await Material.findAll({ limit: 50, raw: true })

    // 2. 订单和报工单（工单元数据）
    const orders = await Order.findAll({
      where: {
        [Op.or]: [
          { created_at: { [Op.gte]: todayStart } },
          { release_time: { [Op.gte]: todayStart } },
          { status: { [Op.in]: [0, 1, 2] } },
        ],
      },
      order: [['created_at', 'DESC']],
      limit: 200,
      raw: true,
    })

    const workOrders = await ReportOrder.findAll({
      where: {
        [Op.or]: [
          { report_time: { [Op.gte]: todayStart } },
          { status: { [Op.in]: [0] } },
        ],
      },
      order: [['report_time', 'DESC']],
      limit: 500,
      raw: true,
    })

    // 3. 工序报工数据（今日）
    const processReports = await ReportProcess.findAll({
      where: { created_at: { [Op.gte]: todayStart } },
      order: [['created_at', 'DESC']],
      limit: 2000,
      raw: true,
    })

    const reportOrderIds = processReports.map(p => p.report_order_id).filter(Boolean)
    const processReportOrders = reportOrderIds.length > 0
      ? await ReportOrder.findAll({
          where: { report_order_id: { [Op.in]: reportOrderIds } },
          raw: true,
        })
      : []

    const roMap = new Map()
    processReportOrders.forEach(ro => roMap.set(ro.report_order_id, ro))
    const processReportsWithQty: any[] = processReports.map(pr => {
      const ro = roMap.get(pr.report_order_id)
      return {
        ...pr,
        report_time: ro?.report_time || pr.created_at,
        work_order_id: pr.report_order_id,
        work_order_no: ro?.report_no,
        process_name: pr.process_name,
        input_qty: Number(ro?.report_qty || 0),
        output_qty: Number(ro?.report_qty || 0),
        defect_material: 0,
        defect_process: 0,
        defect_scrap: 0,
      }
    })

    // 4. 不良数据（今日）
    const defects = await ProcessDefect.findAll({
      where: { record_time: { [Op.gte]: todayStart } },
      raw: true,
    })
    defects.forEach(df => {
      const pr = processReportsWithQty.find(p => p.report_order_id === df.report_order_id && p.process_id === df.process_id)
      const qty = Number(df.quantity || 0)
      if (pr) {
        pr.defect_process += qty
      } else if (processReportsWithQty.length > 0) {
        processReportsWithQty[0].defect_material += qty
      }
    })

    // 5. 最近30天：日产线产出数据（趋势图）— 直接从报工单统计
    const reportOrders30d = await ReportOrder.findAll({
      where: { report_time: { [Op.gte]: thirtyDaysAgo } },
      order: [['report_time', 'ASC']],
      limit: 10000,
      raw: true,
    })
    const dailyOutputMap: Record<string, Record<string, number>> = {}
    reportOrders30d.forEach(ro => {
      const t = ro.report_time || ro.created_at
      if (!t) return
      const d = t instanceof Date ? t : new Date(t)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const lineName = ro.line_name || (productionLines[0]?.line_name) || '默认产线'
      if (!dailyOutputMap[dateStr]) dailyOutputMap[dateStr] = {}
      dailyOutputMap[dateStr][lineName] = (dailyOutputMap[dateStr][lineName] || 0) + Number(ro.report_qty || 0)
    })

    const dateList: string[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000)
      dateList.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
    }
    const lineNames = productionLines.map(l => l.line_name).filter(Boolean)
    if (lineNames.length === 0) lineNames.push('默认产线')
    const dailyTrend: any[] = []
    dateList.forEach(dateStr => {
      const item: any = { date: dateStr }
      lineNames.forEach(ln => {
        item[ln] = dailyOutputMap[dateStr]?.[ln] || 0
      })
      dailyTrend.push(item)
    })

    // 6. 最近30天：日能源数据
    const energyData30d = await EnergyMeterData.findAll({
      where: { reading_date: { [Op.gte]: thirtyDaysAgo } },
      order: [['reading_date', 'ASC']],
      raw: true,
    })
    const dailyEnergyMap: Record<string, number> = {}
    energyData30d.forEach(e => {
      const t = e.reading_date
      if (!t) return
      const dateStr = formatDate(t)
      const v = Number(e.forward_active_energy || 0)
      dailyEnergyMap[dateStr] = (dailyEnergyMap[dateStr] || 0) + v
    })
    const dailyEnergy = dateList.map(d => ({ date: d, energy_kwh: Number((dailyEnergyMap[d] || 0).toFixed(2)) }))

    // 7. 最近30天：各工序不良统计（只显示有不良的工序）
    const defects30d = await ProcessDefect.findAll({
      where: { record_time: { [Op.gte]: thirtyDaysAgo } },
      raw: true,
    })
    const processDefectMap: Record<string, { name: string; material: number; process: number; scrap: number; total: number }> = {}
    const processIdToName: Record<string, string> = {}
    processes.forEach(p => { processIdToName[p.process_id] = p.process_name || p.name })
    defects30d.forEach(df => {
      const pname = df.process_name || processIdToName[df.process_id] || '未知工序'
      if (!processDefectMap[pname]) {
        processDefectMap[pname] = { name: pname, material: 0, process: 0, scrap: 0, total: 0 }
      }
      const qty = Number(df.quantity || 0)
      const dtype = String(df.defect_type || df.type || '')
      if (dtype.includes('来料') || dtype.includes('material')) processDefectMap[pname].material += qty
      else if (dtype.includes('报废') || dtype.includes('scrap')) processDefectMap[pname].scrap += qty
      else processDefectMap[pname].process += qty
      processDefectMap[pname].total += qty
    })
    const processDefectList = Object.values(processDefectMap)
      .filter(p => p.total > 0)
      .sort((a, b) => b.total - a.total)

    return success(res, {
      productionLines,
      devices,
      processes,
      materials,
      orders,
      workOrders,
      processReports: processReportsWithQty,
      dailyTrend,
      dailyEnergy,
      processDefectList,
      queryTime: nowBeijingStr(),
      activeDate: formatDate(todayStart),
    })
  } catch (err) {
    console.error('[productionDashboard] 生产看板数据失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// ============ 质量检测中心看板数据 ============
export const qualityDashboard = async (req, res) => {
  try {
    const todayStart = nowBeijingDate()
    todayStart.setHours(0, 0, 0, 0)
    const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000)

    // 1. 四类检验数据
    const [incomingInspections, productInspections, microbeInspections] = await Promise.all([
      IncomingInspection.findAll({
        where: { created_at: { [Op.gte]: sevenDaysAgo } },
        order: [['created_at', 'DESC']],
        limit: 500,
        raw: true,
      }),
      ProductInspection.findAll({
        where: { created_at: { [Op.gte]: sevenDaysAgo } },
        order: [['created_at', 'DESC']],
        limit: 500,
        raw: true,
      }),
      MicrobeInspection.findAll({
        where: { created_at: { [Op.gte]: sevenDaysAgo } },
        order: [['created_at', 'DESC']],
        limit: 500,
        raw: true,
      }),
    ])

    // 成品/环境检验分开
    const finishedInspections = productInspections.filter(i => i.inspection_type === '成品' || i.inspection_type === '制程')
    const envMicrobe = microbeInspections.filter(i => i.object_type === '来料检验' || true)

    // 拆分微生物和环境检验（基于object_type粗略区分）
    const envInspections = microbeInspections.filter(i => i.object_type === '来料检验' ? false : true)

    // 2. 客诉（暂无对应表，返回空数组）
    const complaints: any[] = []

    // 3. 仪器校准（使用Device近似模拟，设备下次校准日期）
    const instrumentsAll = await Device.findAll({ raw: true })
    const instruments = instrumentsAll.map(d => ({
      instrument_id: d.device_id,
      instrument_name: d.device_name,
      instrument_code: d.device_code,
      next_calibration_date: d.next_inspection_date,
      last_calibration_date: d.last_inspection_date,
      status:
        d.status === '运行' ? '正常' :
        d.next_inspection_date && new Date(d.next_inspection_date) < todayStart ? '已超期' :
        d.next_inspection_date && new Date(d.next_inspection_date).getTime() - todayStart.getTime() < 30 * 86400000 ? '即将到期' : '正常',
    }))

    // 4. 检验标准和料品
    const inspectionStandards = await InspectionStandard.findAll({ where: { status: 1 }, raw: true })
    const materials = await Material.findAll({ limit: 200, raw: true })

    return success(res, {
      incomingInspections,
      finishedInspections,
      microbeInspections,
      envInspections,
      complaints,
      instruments,
      inspectionStandards,
      materials,
    })
  } catch (err) {
    console.error('[qualityDashboard] 质量看板数据失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// ============ 经营管理中心看板数据 ============
export const managementDashboard = async (req, res) => {
  try {
    const todayStart = nowBeijingDate()
    todayStart.setHours(0, 0, 0, 0)
    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1)
    const sixMonthsAgo = new Date(todayStart)
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
    sixMonthsAgo.setDate(1)

    // 1. 基础数据
    const [
      orders, workOrders, processReports, productionLines, devices,
      incomingInspections, finishedInspections, microbeInspections, envInspections,
      materials, customers, inspectionStandards,
    ] = await Promise.all([
      Order.findAll({ where: { created_at: { [Op.gte]: sixMonthsAgo } }, order: [['created_at', 'DESC']], limit: 1000, raw: true }),
      ReportOrder.findAll({ where: { report_time: { [Op.gte]: sixMonthsAgo } }, order: [['report_time', 'DESC']], limit: 3000, raw: true }),
      ReportProcess.findAll({ where: { created_at: { [Op.gte]: monthStart } }, limit: 3000, raw: true }),
      ProductionLine.findAll({ order: [['sort_order', 'ASC']], raw: true }),
      Device.findAll({ raw: true }),
      IncomingInspection.findAll({ where: { created_at: { [Op.gte]: sixMonthsAgo } }, limit: 1000, raw: true }),
      ProductInspection.findAll({ where: { created_at: { [Op.gte]: sixMonthsAgo } }, limit: 1000, raw: true }),
      MicrobeInspection.findAll({ where: { created_at: { [Op.gte]: sixMonthsAgo } }, limit: 1000, raw: true }),
      MicrobeInspection.findAll({ where: { created_at: { [Op.gte]: sixMonthsAgo } }, limit: 500, raw: true }),
      Material.findAll({ limit: 200, raw: true }),
      Customer.findAll({ limit: 100, raw: true }),
      InspectionStandard.findAll({ raw: true }),
    ])

    // 工序报工合并数据
    const reportOrderIds = processReports.map(p => p.report_order_id).filter(Boolean)
    const roMap = new Map()
    if (reportOrderIds.length > 0) {
      const ros = await ReportOrder.findAll({ where: { report_order_id: { [Op.in]: reportOrderIds } }, raw: true })
      ros.forEach(ro => roMap.set(ro.report_order_id, ro))
    }
    const processReportsWithQty: any[] = processReports.map(pr => {
      const ro = roMap.get(pr.report_order_id)
      return {
        ...pr,
        report_time: ro?.report_time || pr.created_at,
        work_order_id: pr.report_order_id,
        work_order_no: ro?.report_no,
        process_name: pr.process_name,
        input_qty: Number(ro?.report_qty || 0),
        output_qty: Number(ro?.report_qty || 0),
        defect_material: 0,
        defect_process: 0,
        defect_scrap: 0,
      }
    })

    // 不良数据
    const defects = await ProcessDefect.findAll({ where: { record_time: { [Op.gte]: monthStart } }, raw: true })
    defects.forEach(df => {
      const pr = processReportsWithQty.find(p => p.report_order_id === df.report_order_id && p.process_id === df.process_id)
      const qty = Number(df.quantity || 0)
      if (pr) pr.defect_process += qty
      else if (processReportsWithQty.length > 0) processReportsWithQty[0].defect_material += qty
    })

    // 客诉（暂无对应表）
    const complaints: any[] = []

    // 仪器（设备校准状态）
    const instruments = devices.map(d => ({
      instrument_id: d.device_id,
      instrument_name: d.device_name,
      next_calibration_date: d.next_inspection_date,
      status:
        d.next_inspection_date && new Date(d.next_inspection_date) < todayStart ? '已超期' :
        d.next_inspection_date && new Date(d.next_inspection_date).getTime() - todayStart.getTime() < 30 * 86400000 ? '即将到期' : '正常',
    }))

    return success(res, {
      orders,
      workOrders,
      processReports: processReportsWithQty,
      productionLines,
      devices,
      incomingInspections,
      finishedInspections,
      microbeInspections,
      envInspections,
      complaints,
      instruments,
      materials,
      customers,
      inspectionStandards,
    })
  } catch (err) {
    console.error('[managementDashboard] 经营看板数据失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}


