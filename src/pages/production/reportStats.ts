import dayjs from 'dayjs'

export interface ReportInfo {
  report_time?: string | Date | null
  finish_time?: string | Date | null
  status?: string | null
  report_qty?: number | string | null
}

export interface ManpowerRecord {
  skilled_count?: number | string
  general_count?: number | string
  labor_count?: number | string
  other_count?: number | string
}

/** 计算人工工时：开工状态取当前时间，完工状态取 finish_time */
export function calcManpowerHours(manpowerRecords: ManpowerRecord[], reportInfo: ReportInfo | null | undefined): number {
  if (!reportInfo || !reportInfo.report_time || !manpowerRecords || manpowerRecords.length === 0) return 0
  const start = dayjs(reportInfo.report_time)
  const end = reportInfo.status === '完工' && reportInfo.finish_time ? dayjs(reportInfo.finish_time) : dayjs()
  const diffMs = end.valueOf() - start.valueOf()
  const hours = diffMs > 0 ? Number((diffMs / 3600000).toFixed(2)) : 0
  const total = manpowerRecords.reduce((sum, m) => {
    const sk = Number(m.skilled_count) || 0
    const gn = Number(m.general_count) || 0
    const lb = Number(m.labor_count) || 0
    const ot = Number(m.other_count) || 0
    return sum + Number((hours * (sk + gn + lb + ot)).toFixed(2))
  }, 0)
  return Number(total.toFixed(2))
}

export interface ProcessStatsInput {
  defects: Array<{ defect_type?: string; quantity?: number | string; process_id?: number | string }>
  scraps: Array<{ defect_type?: string; quantity?: number | string; process_id?: number | string }>
  exceptions: Array<{ duration?: number | string; process_id?: number | string }>
  materials: Array<{ material_type?: string; quantity?: number | string; process_id?: number | string }>
  manpowers: ManpowerRecord[]
  lineProcesses: Array<{ process_id: number | string }>
  selectedProcessId?: number | string | null
  selectedReport?: ReportInfo | null
}

/** 工序维度统计 */
export function calcProcessStats(input: ProcessStatsInput) {
  const { defects, scraps, exceptions, materials, manpowers, lineProcesses, selectedProcessId, selectedReport } = input

  if (lineProcesses.length === 0) {
    return { inputQty: 0, outputQty: 0, defectMaterial: 0, defectProcess: 0, defectScrap: 0, exceptionHours: 0, manpowerHours: 0, expectedOutput: 0 }
  }

  const firstProcessId = lineProcesses[0].process_id
  const pid = selectedProcessId ?? firstProcessId
  const processDefects = defects.filter(d => d.process_id === pid)
  const processMaterials = materials.filter(m => m.process_id === pid)

  const investQty = processMaterials.filter(m => m.material_type === '投入').reduce((sum, m) => sum + (Number(m.quantity) || 0), 0)
  const returnQty = processMaterials.filter(m => m.material_type === '退回').reduce((sum, m) => sum + (Number(m.quantity) || 0), 0)
  const inputQty = investQty - returnQty

  const defectMaterial = processDefects.filter(d => d.defect_type === '来料不良').reduce((sum, d) => sum + (Number(d.quantity) || 0), 0)
  const defectProcess = processDefects.filter(d => d.defect_type === '制程不良').reduce((sum, d) => sum + (Number(d.quantity) || 0), 0)
  const defectScrap = scraps.filter(s => s.process_id === pid && s.defect_type === '检验报废').reduce((sum, s) => sum + (Number(s.quantity) || 0), 0)
  const exceptionHours = exceptions.filter(e => e.process_id === pid).reduce((sum, e) => sum + (Number(e.duration) || 0), 0)

  // 人工工时为整单维度
  const manpowerHours = calcManpowerHours(manpowers, selectedReport)
  const outputQty = pid === firstProcessId ? Number(selectedReport?.report_qty || 0) : 0
  const expectedOutput = pid === firstProcessId ? inputQty - defectMaterial - defectProcess - defectScrap : 0

  return {
    inputQty: Number(inputQty.toFixed(2)),
    outputQty: Number(outputQty.toFixed(2)),
    defectMaterial: Number(defectMaterial.toFixed(2)),
    defectProcess: Number(defectProcess.toFixed(2)),
    defectScrap: Number(defectScrap.toFixed(2)),
    exceptionHours: Number(exceptionHours.toFixed(2)),
    manpowerHours: Number(manpowerHours.toFixed(2)),
    expectedOutput: Number(expectedOutput.toFixed(2)),
  }
}

/** 整单统计 */
export function calcReportStats(input: Omit<ProcessStatsInput, 'selectedProcessId'>) {
  const { defects, scraps, exceptions, materials, manpowers, lineProcesses, selectedReport } = input
  const defectMaterial = defects.filter(d => d.defect_type === '来料不良').reduce((sum, d) => sum + (Number(d.quantity) || 0), 0)
  const defectProcess = defects.filter(d => d.defect_type === '制程不良').reduce((sum, d) => sum + (Number(d.quantity) || 0), 0)
  const defectScrapTotal = scraps.filter(d => d.defect_type === '检验报废').reduce((sum, d) => sum + (Number(d.quantity) || 0), 0)
  const exceptionHours = exceptions.reduce((sum, e) => sum + (Number(e.duration) || 0), 0)
  const manpowerHours = calcManpowerHours(manpowers, selectedReport)

  let inputQty = 0
  if (lineProcesses.length > 0) {
    const firstProcessId = lineProcesses[0].process_id
    const firstProcessMaterials = materials.filter(m => m.process_id === firstProcessId)
    const investQty = firstProcessMaterials.filter(m => m.material_type === '投入').reduce((sum, m) => sum + (Number(m.quantity) || 0), 0)
    const returnQty = firstProcessMaterials.filter(m => m.material_type === '退回').reduce((sum, m) => sum + (Number(m.quantity) || 0), 0)
    inputQty = investQty - returnQty
  }
  const expectedOutput = inputQty - defectMaterial - defectProcess - defectScrapTotal
  return {
    inputQty: Number(inputQty.toFixed(2)),
    outputQty: Number(selectedReport?.report_qty || 0),
    defectMaterial: Number(defectMaterial.toFixed(2)),
    defectProcess: Number(defectProcess.toFixed(2)),
    defectScrap: Number(defectScrapTotal.toFixed(2)),
    exceptionHours: Number(exceptionHours.toFixed(2)),
    manpowerHours: Number(manpowerHours.toFixed(2)),
    expectedOutput: Number(expectedOutput.toFixed(2)),
  }
}

export const genTempId = (): string => 'tmp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)
