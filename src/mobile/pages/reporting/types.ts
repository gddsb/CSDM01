/**
 * 报工页面共享类型定义
 * —— 供主 MobileProcessReporting.tsx 和 6 个 SubPanel 共用
 */

// ========== 基础类型 ==========

/** 报工单工序（从 report_processes 子表来） */
export interface ProcessRow {
  report_process_id: number
  process_id: number
  process_code: string
  process_name: string
  must_report: boolean
  has_material: boolean
  sort_order: number
}

/** 报工单主表（当前操作的报工单） */
export interface ReportOrder {
  report_order_id: number
  report_no: string
  order_id: number
  order_no: string
  line_id: number
  line_name: string
  material_code: string
  material_name: string
  report_qty: number
  status: number | string
  report_time?: string
  finish_time?: string
}

/** 生产订单（选择阶段用） */
export interface OrderRow {
  order_id: number
  order_no: string
  status: string
  material_code: string
  material_name: string
  planned_qty: number
  finished_qty: number
  line_id?: number
  line_name?: string
}

/** 不良类型字典（从 defect_types 来） */
export interface DefectType {
  defect_id: number
  defect_code: string
  defect_type: string
  defect_name: string
  category_name: string
  status: string
  /** 关联工序为空=全工序，有值=仅这些工序可用 */
  related_processes?: number[]
  /** 该不良类型的单位 */
  defect_unit?: string
  /** 可用单位列表（逗号分隔字符串 get 后自动转数组） */
  available_units?: string[]
}

/** 料品主数据（从 /basic/materials 来） */
export interface MaterialMaster {
  bas_material_id: string
  material_code: string
  material_name: string
  specification?: string
}

// ========== 子记录类型 ==========

/** 工序不良记录（后端 production_process_defect） */
export interface DefectRow {
  id?: number | string          // 前端临时用 tmp_xxx，保存后用 defect_id
  defect_id?: number
  report_order_id?: number
  process_id?: number
  defect_type_id?: number | null
  defect_code?: string
  defect_type?: string
  defect_name?: string
  quantity: number
  unit?: string
  defect_images?: string | string[]   // JSON 字段，存图片 URL 数组
  _isNew?: boolean
}

/** 工序物料/投料记录（后端 production_process_material） */
export interface MaterialRow {
  id?: number | string
  material_id?: number
  report_order_id?: number
  process_id?: number
  material_type: '投入' | '退回'
  bas_material_id?: string | null
  material_code?: string
  material_name?: string
  specification?: string
  material_batch?: string
  package_no?: string
  quantity: number
  label_images?: string | string[]
  _isNew?: boolean
}

/** 检验报废记录（工单级，后端 scrap_defects） */
export interface ScrapRow {
  id?: number | string
  scrap_id?: number
  report_order_id?: number
  defect_type_id?: number | null
  defect_code?: string
  defect_name?: string
  defect_type?: string
  quantity: number
  _isNew?: boolean
}

/** 异常工时记录（工单级，后端 process_exceptions） */
export interface ExceptionRow {
  id?: number | string
  exception_id?: number
  report_order_id?: number
  exception_type?: string
  start_time?: string
  end_time?: string | null
  duration?: number | null
  remark?: string | null
  _isNew?: boolean
}

/** 人员工时（工单级，后端 manpower_records） */
export interface ManpowerRow {
  record_id?: number
  report_order_id?: number
  skilled_count: number
  general_count: number
  labor_count: number
  other_count: number
}

// ========== 面板 Props 共用类型 ==========

/** 工序级面板 Props（不良/投料） */
export interface ProcessPanelBaseProps {
  report: ReportOrder
  processes: ProcessRow[]
  activeProcessId: number | null
  editable: boolean
}

/** 工单级面板 Props（报废/工时/人员） */
export interface ReportPanelBaseProps {
  report: ReportOrder
  editable: boolean
}
