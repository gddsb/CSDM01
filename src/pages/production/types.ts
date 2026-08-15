export interface ProcessReportRecord {
  id: number | string
  [key: string]: unknown
}

export type DefectRecord = ProcessReportRecord
export type MaterialRecord = ProcessReportRecord
export type ExceptionRecord = ProcessReportRecord
export type ManpowerRecord = ProcessReportRecord

export interface ReportItem {
  report_order_id: number | string
  report_time?: string | Date | null
  [key: string]: unknown
}
