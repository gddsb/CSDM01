import ResizableTable from '../../components/ResizableTable'
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Table, Tag, Button, Modal, Input, InputNumber, Select, Space, Row, Col,
  Card, Divider, Popconfirm, DatePicker, TimePicker, Tabs, Upload, Drawer, Image, Form,
} from 'antd'
import { useMessage, useApp } from '../../contexts/AppContext'
import {
  PlusOutlined, DeleteOutlined, UploadOutlined,
  PictureOutlined, SaveOutlined, ReloadOutlined, UpOutlined, DownOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '../../utils/api'
import { formatFilmVersion, formatDateTime, formatTime, formatDate } from '../../utils'
import { reportOrderStatusMap, exceptionCategories, genTempId } from './constants'
import { buildDefectColumns, buildMaterialColumns } from './processColumns'
import { buildExceptionColumns } from './exceptionColumns'
import { buildManpowerColumns } from './manpowerColumns'
import { ProcessDefectTab, GenericRecordTab } from './sections/ProcessTabContent'
import { ReportStatsBar } from './sections/ReportStatsBar'
import CreateReportModal from './sections/CreateReportModal'
import ImageDrawer from './sections/ImageDrawer'
import BatchTagPanel from './sections/BatchTagPanel'
import { calcReportStats as calcReportOrderStats, calcProcessStats as calcPersonSummary } from './reportStats'
import { useReportDetailRecords } from './hooks/useReportDetailRecords'
import type { DefectRecord, ExceptionRecord, ManpowerRecord, MaterialRecord } from './types'
import { getProcessMaterialRule, isMaterialAllowed, sortMaterialsByRule } from '../../utils/processMaterialRules'

export default function ProcessReporting() {
  // 顶部下拉框数据：仅开工状态(status=0)的报工单
  const [reportOrders, setReportOrders] = useState([])
  const [allReportOrders, setAllReportOrders] = useState([])
  const [selectedReport, setSelectedReport] = useState(null)
  const [defectTypes, setDefectTypes] = useState([])
  const [devices, setDevices] = useState([])
  const [lineProcesses, setLineProcesses] = useState([])
  const [loading, setLoading] = useState(false)
  const [finishingReport, setFinishingReport] = useState(false)
  const [finishCheckOpen, setFinishCheckOpen] = useState(false)
  const [finishCheckItems, setFinishCheckItems] = useState<any[]>([])
  const [closingReport, setClosingReport] = useState(false)
  const [breakTimes, setBreakTimes] = useState<any[]>([])
  const [breakTimesLoading, setBreakTimesLoading] = useState(false)
  const [breakTimesDirty, setBreakTimesDirty] = useState(false)
  const [breakTimesSaving, setBreakTimesSaving] = useState(false)
  const [headerCollapsed, setHeaderCollapsed] = useState(false)

  // 新增报工单 Modal
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [creatingReport, setCreatingReport] = useState(false)
  const [orders, setOrders] = useState([])
  const [lines, setLines] = useState([])
  const [createForm] = Form.useForm()
  const [selectedCreateOrder, setSelectedCreateOrder] = useState<any>(null)

  // 三个独立工序选择器（不良/物料/报废 各自维护，互不影响）
  const [defectProcessId, setDefectProcessId] = useState<number | null>(null)
  const [materialProcessId, setMaterialProcessId] = useState<number | null>(null)
  const [scrapProcessId, setScrapProcessId] = useState<number | null>(null)

  const [activeTab, setActiveTab] = useState('production-defect')
  // 🔑 一级分组 Tab：工序记录 / 工单记录
  const [activeGroup, setActiveGroup] = useState<'process' | 'report'>('process')
  // 子 Tab 归属映射 → 切换一级 Tab 时自动落到合理的子 Tab
  const tabToGroup = {
    'production-defect': 'process',
    'production-material': 'process',
    'scrap-defect': 'process',
    'exception': 'report',
    'manpower': 'report',
    'batch-tag': 'report',
  } as const
  const defaultSubTabOfGroup = { process: 'production-defect', report: 'exception' } as const
  const [prevProcessQualifiedQty, setPrevProcessQualifiedQty] = useState(0)

  const [imageDrawerVisible, setImageDrawerVisible] = useState(false)
  const [imageDrawerTitle, setImageDrawerTitle] = useState('')
  const [currentImageList, setCurrentImageList] = useState([])
  const [imageUploadLoading, setImageUploadLoading] = useState(false)
  const [currentImageContext, setCurrentImageContext] = useState(null)

  // 明细列表与处理器由 useReportDetailRecords 提供（在 isEditable 后挂载）
  const [materials, setMaterials] = useState([])

  const savingRef = useRef({})
  // 跟踪被修改但尚未保存的记录 ID（脏标记）
  const [dirtyIds, setDirtyIds] = useState(new Set())

  const markDirty = (id) => {
    if (!id) return
    setDirtyIds(prev => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }

  const clearDirty = (ids) => {
    setDirtyIds(prev => {
      const next = new Set(prev)
      ;(ids || []).forEach(id => next.delete(id))
      return next
    })
  }

  const [stats, setStats] = useState({
    inputQty: 0,
    outputQty: 0,
    defectMaterial: 0,
    defectProcess: 0,
    defectScrap: 0,
    exceptionHours: 0,
    manpowerHours: 0,
    expectedOutput: 0,
  })

  const message = useMessage()
  const { hasPermission } = useApp()

  // 不良类型下拉选项（必须在 fetchAllData 之前定义，避免 TDZ 错误）
  // 制程不良记录页签：检验类型=制程检验类（兼容旧数据"制程检验类型"），不良类型=制程不良或来料不良
  // 按 defectProcessId 过滤关联工序
  const defectTypeOptions = useMemo(() => {
    const seen = new Set()
    return defectTypes
      .filter(d => d.category_name === '制程检验类型'
        && d.defect_type !== '检验报废'
        && d.status === '启用')
      .filter(d => {
        const relatedProcesses = Array.isArray(d.related_processes) ? d.related_processes : []
        if (relatedProcesses.length === 0) return true
        return defectProcessId != null && relatedProcesses.includes(defectProcessId)
      })
      .filter(d => {
        if (seen.has(d.defect_id)) return false
        seen.add(d.defect_id)
        return true
      })
      .map(d => ({
        label: <span><span style={{ fontWeight: 600, color: '#212121' }}>{d.defect_code}</span><span style={{ marginLeft: 8, opacity: 0.5, color: '#9E9E9E', fontSize: 12 }}>{d.defect_type}</span><span style={{ marginLeft: 8, opacity: 0.65, color: '#757575' }}>{d.defect_name}</span></span>,
        value: d.defect_id,
        defect_code: d.defect_code,
        defect_type: d.defect_type,
        defect_name: d.defect_name,
        defect_unit: d.defect_unit || '',
        available_units: d.available_units || '',
      }))
  }, [defectTypes, defectProcessId])

  // 检验报废记录页签：检验类型=制程检验类型，不良类型=检验报废
  // 按 scrapProcessId 过滤关联工序
  const scrapTypeOptions = useMemo(() => {
    const seen = new Set()
    return defectTypes
      .filter(d => d.category_name === '制程检验类型'
        && d.defect_type === '检验报废'
        && d.status === '启用')
      .filter(d => {
        const relatedProcesses = Array.isArray(d.related_processes) ? d.related_processes : []
        if (relatedProcesses.length === 0) return true
        return scrapProcessId != null && relatedProcesses.includes(scrapProcessId)
      })
      .filter(d => {
        if (seen.has(d.defect_id)) return false
        seen.add(d.defect_id)
        return true
      })
      .map(d => ({
        label: <span><span style={{ fontWeight: 600, color: '#212121' }}>{d.defect_code}</span><span style={{ marginLeft: 8, opacity: 0.5, color: '#9E9E9E', fontSize: 12 }}>{d.defect_type}</span><span style={{ marginLeft: 8, opacity: 0.65, color: '#757575' }}>{d.defect_name}</span></span>,
        value: d.defect_id,
        defect_code: d.defect_code,
        defect_type: d.defect_type,
        defect_name: d.defect_name,
        defect_unit: d.defect_unit || '',
        available_units: d.available_units || '',
      }))
  }, [defectTypes, scrapProcessId])

  // 初始加载：不良类型、设备、订单、产线
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const [defectRes, devRes, ordersRes, linesRes] = await Promise.all([
          api.get('/basic/defect-types', { params: { page: 1, pageSize: 1000, status: '启用' } }),
          api.get('/basic/devices', { params: { page: 1, pageSize: 1000 } }),
          api.get('/production/orders', { params: { page: 1, pageSize: 1000, status: '1,2,3' } }),
          api.get('/basic/production-lines', { params: { page: 1, pageSize: 1000 } }),
        ])
        if (cancelled) return
        setDefectTypes(defectRes.data || [])
        setDevices(devRes.data || [])
        setOrders(ordersRes.data || [])
        setLines(linesRes.data || [])
      } catch (err) {
        if (!cancelled) message.error(err.message || '获取基础数据失败')
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  // 获取报工单列表（仅开工状态 status=0），并默认选中最近一条开工报工单
  const fetchReportOrders = useCallback(async () => {
    setLoading(true)
    try {
      const [activeRes, allRes] = await Promise.all([
        api.get('/production/report-orders', { params: { page: 1, pageSize: 1000, status: 0 } }),
        api.get('/production/report-orders', { params: { page: 1, pageSize: 1000 } }),
      ])
      const list = activeRes.data || []
      const allList = allRes.data || []
      setReportOrders(list)
      setAllReportOrders(allList)
      // 默认选中最近一条开工报工单（后端已按 created_at DESC 排序，第一条即最新）
      setSelectedReport(prev => {
        if (prev && list.some(r => r.report_order_id === prev.report_order_id)) return prev
        return list[0] || null
      })
    } catch (err) {
      message.error(err.message || '获取报工单列表失败')
      setReportOrders([])
      setAllReportOrders([])
      setSelectedReport(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReportOrders()
  }, [fetchReportOrders])

  // 获取报工单工序（从报工单工序子表 report_processes 获取）
  const fetchReportProcesses = useCallback(async (reportOrderId) => {
    if (!reportOrderId) {
      setLineProcesses([])
      setDefectProcessId(null)
      setMaterialProcessId(null)
      setScrapProcessId(null)
      return
    }
    try {
      const res = await api.get(`/production/report-orders/${reportOrderId}/processes`)
      const procs = res.data || []
      const sorted = [...procs].sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
      setLineProcesses(sorted)
      const firstId = sorted.length > 0 ? sorted[0].process_id : null
      setDefectProcessId(firstId)
      setMaterialProcessId(firstId)
      setScrapProcessId(firstId)
    } catch (err) {
      setLineProcesses([])
      setDefectProcessId(null)
      setMaterialProcessId(null)
      setScrapProcessId(null)
    }
  }, [])

  const materialOptions = useMemo(() => {
    return materials.map(m => ({
      label: <span><span style={{ fontWeight: 600, color: '#212121' }}>{m.material_code}</span><span style={{ marginLeft: 8, opacity: 0.65, color: '#757575' }}>{m.material_name}</span>{m.specification && <span style={{ marginLeft: 8, opacity: 0.45, color: '#9E9E9E' }}>{m.specification}</span>}</span>,
      value: m.material_id,
      material_code: m.material_code,
      material_name: m.material_name,
      specification: m.specification || '',
      unit_name: m.unit_name || '',
    }))
  }, [materials])

  const parseImages = (images) => {
    if (!images) return []
    if (Array.isArray(images)) return images
    try {
      const parsed = JSON.parse(images)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  const openImageDrawer = (title, imageList, context) => {
    setImageDrawerTitle(title)
    setCurrentImageList([...imageList])
    setCurrentImageContext(context)
    setImageDrawerVisible(true)
  }

  const closeImageDrawer = () => {
    setImageDrawerVisible(false)
    setCurrentImageList([])
    setCurrentImageContext(null)
  }

  const handleImageUpload = async (fileList) => {
    if (!selectedReport) {
      message.warning('请先选择报工单')
      return false
    }
    try {
      setImageUploadLoading(true)
      const formData = new FormData()
      fileList.forEach(file => {
        formData.append('files', file.originFileObj || file)
      })
      const reportNo = selectedReport.report_no || 'REPORT'
      const category = currentImageContext?.category || 'general'
      const res = await api.post(`/production/report-images/${reportNo}/${category}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const uploadedUrls = res.data || []
      const newList = [...currentImageList, ...uploadedUrls]
      setCurrentImageList(newList)
      applyImageChanges(newList)
      message.success(`成功上传${uploadedUrls.length}张图片`)
      return false
    } catch (err) {
      message.error(err.message || '上传失败')
      return false
    } finally {
      setImageUploadLoading(false)
    }
  }

  const handleDeleteImage = (index) => {
    const newList = currentImageList.filter((_, i) => i !== index)
    setCurrentImageList(newList)
    applyImageChanges(newList)
  }

  const applyImageChanges = (newImageList) => {
    if (!currentImageContext) return
    const { listType, recordId, field } = currentImageContext

    const setters = {
      prodDefect: setProdDefectList,
      scrapDefect: setScrapDefectList,
      exception: setExceptionList,
      material: setMaterialList,
    }
    const setList = setters[listType]
    if (!setList) return

    // 图片修改后标记为脏
    markDirty(recordId)
    setList(prev => prev.map(item => {
      if (String(item.id) !== String(recordId)) return item
      return { ...item, [field]: newImageList }
    }))
  }

  const fetchAllData = useCallback(async (reportOrderId) => {
    if (!reportOrderId) return
    if (!defectProcessId && !materialProcessId && !scrapProcessId) return
    try {
      const fetches: Promise<any>[] = []
      // 不良（按 defectProcessId）
      if (defectProcessId != null) {
        fetches.push(api.get('/production/process-defects', {
          params: { report_order_id: reportOrderId, process_id: defectProcessId, page: 1, pageSize: 1000 },
        }))
      } else {
        fetches.push(Promise.resolve({ data: [] }))
      }
      // 报废（按 scrapProcessId，统一走 /process-defects）
      if (scrapProcessId != null) {
        fetches.push(api.get('/production/process-defects', {
          params: { report_order_id: reportOrderId, process_id: scrapProcessId, page: 1, pageSize: 1000 },
        }))
      } else {
        fetches.push(Promise.resolve({ data: [] }))
      }
      // 异常
      fetches.push(api.get('/production/process-exceptions', {
        params: { report_order_id: reportOrderId, page: 1, pageSize: 1000 },
      }))
      // 人员
      fetches.push(api.get('/production/manpower-records', {
        params: { report_order_id: reportOrderId, page: 1, pageSize: 1000 },
      }))
      // 物料（按 materialProcessId）
      if (materialProcessId != null) {
        fetches.push(api.get('/production/process-materials', {
          params: { report_order_id: reportOrderId, process_id: materialProcessId, page: 1, pageSize: 1000 },
        }))
      } else {
        fetches.push(Promise.resolve({ data: [] }))
      }
      // 休息时间
      fetches.push(api.get('/production/break-times', {
        params: { report_order_id: reportOrderId, page: 1, pageSize: 100 },
      }).catch(() => ({ data: [] })))

      const [defectRes, scrapRes, exceptionRes, manpowerRes, materialRes, breakRes] = await Promise.all(fetches)

      setProdDefectList((defectRes.data || []).map(d => {
        let enriched: any = { ...d, id: d.defect_id, defect_images: parseImages(d.defect_images) }
        if ((!enriched.defect_code || !enriched.defect_type) && enriched.defect_type_id) {
          const opt = defectTypeOptions.find(o => String(o.value) === String(enriched.defect_type_id))
          if (opt) {
            if (!enriched.defect_code) enriched.defect_code = opt.defect_code
            if (!enriched.defect_type) enriched.defect_type = opt.defect_type
            if (!enriched.defect_name) enriched.defect_name = opt.defect_name
          }
        }
        return enriched
      }))
      // 报废：从 /process-defects 结果里过滤 defect_type === '检验报废'
      setScrapDefectList((scrapRes.data || []).filter((d: any) => d.defect_type === '检验报废').map((d: any) => {
        let enriched: any = { ...d, id: d.defect_id ?? d.scrap_id, defect_images: parseImages(d.defect_images) }
        if ((!enriched.defect_code || !enriched.defect_type) && enriched.defect_type_id) {
          const opt = scrapTypeOptions.find(o => String(o.value) === String(enriched.defect_type_id))
          if (opt) {
            if (!enriched.defect_code) enriched.defect_code = opt.defect_code
            if (!enriched.defect_type) enriched.defect_type = opt.defect_type
            if (!enriched.defect_name) enriched.defect_name = opt.defect_name
          }
        }
        return enriched
      }))
      setExceptionList((exceptionRes.data || []).map((e: any) => ({ ...e, id: e.exception_id, exception_images: parseImages(e.exception_images) })))
      setManpowerList((manpowerRes.data || []).map((m: any) => ({ ...m, id: m.record_id })))
      setMaterialList((materialRes.data || []).map((m: any) => {
        let enriched: any = { ...m, id: m.material_id, label_images: parseImages(m.label_images) }
        if (!enriched.material_code && enriched.bas_material_id) {
          const mat = materialOptions.find(opt => String(opt.value) === String(enriched.bas_material_id))
          if (mat) {
            if (!enriched.material_code) enriched.material_code = mat.material_code
            if (!enriched.material_name) enriched.material_name = mat.material_name
            if (!enriched.specification) enriched.specification = mat.specification
          }
        }
        return enriched
      }))
      setBreakTimes(breakRes.data || [])
    } catch (err: any) {
      message.error(err.message || '获取数据失败')
    }
  }, [defectProcessId, materialProcessId, scrapProcessId, defectTypeOptions, scrapTypeOptions, materialOptions])

  // 根据报工单信息和人员记录列表计算人工工时（本地计算，用于保存后立即更新）
  const calcManpowerHoursLocal = useCallback((manpowerRecords, reportInfo) => {
    if (!reportInfo || !reportInfo.report_time || !manpowerRecords || manpowerRecords.length === 0) return 0
    const start = dayjs(reportInfo.report_time)
    const end = reportInfo.status === '完工' && reportInfo.finish_time
      ? dayjs(reportInfo.finish_time)
      : dayjs()
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
  }, [])

  // 获取整个报工单的统计数据（直接读后端持久化字段，recalc 钩子已保证与子表聚合一致）
  const fetchReportStats = useCallback(() => {
    if (!selectedReport) return
    try {
      setStats({
        inputQty: Number(selectedReport.total_input_qty ?? 0),
        outputQty: Number(selectedReport.report_qty || 0),
        defectMaterial: Number(selectedReport.total_defect_material ?? 0),
        defectProcess: Number(selectedReport.total_defect_process ?? 0),
        defectScrap: Number(selectedReport.total_defect_scrap ?? 0),
        exceptionHours: Number(selectedReport.total_exception_hours ?? 0),
        manpowerHours: Number(selectedReport.total_manpower_hours ?? 0),
        expectedOutput: Number(selectedReport.expected_output ?? 0),
      })
    } catch {
      // 静默失败
    }
  }, [selectedReport])

  const fetchMaterials = useCallback(async () => {
    try {
      const res = await api.get('/basic/materials', { params: { page: 1, pageSize: 1000 } })
      setMaterials(res.data || [])
    } catch (err) {
      setMaterials([])
    }
  }, [])

  // ===== useEffect 依赖回调函数的部分，必须放在所有 useCallback 之后 =====

  // 报工单切换：拉取工序 + 物料主数据，清空子记录
  useEffect(() => {
    if (!selectedReport) {
      setLineProcesses([])
      setDefectProcessId(null)
      setMaterialProcessId(null)
      setScrapProcessId(null)
      setProdDefectList([])
      setScrapDefectList([])
      setExceptionList([])
      setManpowerList([])
      setMaterialList([])
      setStats({ inputQty: 0, outputQty: 0, defectMaterial: 0, defectProcess: 0, defectScrap: 0, exceptionHours: 0, manpowerHours: 0, expectedOutput: 0 })
      return
    }
    fetchReportProcesses(selectedReport.report_order_id)
    fetchMaterials()
  }, [selectedReport, fetchReportProcesses, fetchMaterials])

  // 报工单级别统计数据（当前报工单汇总，不按工序过滤）
  useEffect(() => {
    if (!selectedReport) {
      setStats({ inputQty: 0, outputQty: 0, defectMaterial: 0, defectProcess: 0, defectScrap: 0, exceptionHours: 0, manpowerHours: 0, expectedOutput: 0 })
      return
    }
    fetchReportStats()
  }, [selectedReport, fetchReportStats])

  // 当前工序列表数据
  useEffect(() => {
    // 切换报工单或工序时清空脏标记
    setDirtyIds(new Set())
    if (!selectedReport) {
      setProdDefectList([])
      setScrapDefectList([])
      setExceptionList([])
      setManpowerList([])
      setMaterialList([])
      return
    }
    fetchAllData(selectedReport.report_order_id)
  }, [selectedReport, defectProcessId, materialProcessId, scrapProcessId, fetchAllData])

  // 报工单状态：'开工'=可编辑，'完工'=只读
  const isEditable = selectedReport?.status === '开工'

  const {
    prodDefectList, scrapDefectList, materialList, exceptionList, manpowerList,
    setProdDefectList, setScrapDefectList, setMaterialList, setExceptionList, setManpowerList,
    processStats: hookProcessStats,
    handleAddProdDefectRow, handleDeleteProdDefect, handleProdDefectChange, handleSaveAllProdDefects,
    handleAddScrapDefectRow, handleDeleteScrapDefect, handleScrapDefectChange, handleSaveAllScrapDefects,
    handleAddMaterialRow, handleDeleteMaterial, handleMaterialChange, handleSaveAllMaterials,
    handleAddExceptionRow, handleDeleteException, handleExceptionChange, handleSaveAllExceptions, handleStartException, handleFinishException,
    handleManpowerChange, handleSaveAllManpowers,
  } = useReportDetailRecords({
    selectedReport: selectedReport as any,
    isEditable,
    defectProcessId,
    materialProcessId,
    scrapProcessId,
    lineProcesses: lineProcesses as any,
    openImageDrawer: openImageDrawer as any,
    message,
    materials,
  })

  // ========== 5 个 Tab 级本地统计（useMemo 即时重算） ==========

  // ① 报废记录（工序级）：总不良 / 来料不良(片/罐) / 制程不良(片/罐)
  const defectTabStats = useMemo(() => {
    const list = prodDefectList.filter(r => r.process_id === defectProcessId && !(r as any)._deleting)
    const sumQty = (pred: (r: any) => boolean) =>
      list.filter(pred).reduce((s, r) => s + (Number(r.quantity || r.defect_quantity) || 0), 0)
    const materialPcs = sumQty(r => r.defect_type === '来料不良' && (r.unit || r.defect_unit) === '片')
    const materialCans = sumQty(r => r.defect_type === '来料不良' && (r.unit || r.defect_unit) === '罐')
    const processPcs = sumQty(r => r.defect_type === '制程不良' && (r.unit || r.defect_unit) === '片')
    const processCans = sumQty(r => r.defect_type === '制程不良' && (r.unit || r.defect_unit) === '罐')
    return {
      materialPcs, materialCans, processPcs, processCans,
      totalDefect: materialPcs + materialCans + processPcs + processCans,
    }
  }, [prodDefectList, defectProcessId])

  // ② 物料使用（工序级）：投入 / 退回 / 净用量
  const materialTabStats = useMemo(() => {
    const list = materialList.filter(r => r.process_id === materialProcessId && !(r as any)._deleting)
    const invest = list.filter(r => r.material_type === '投入').reduce((s, r) => s + (Number(r.quantity) || 0), 0)
    const ret = list.filter(r => r.material_type === '退回').reduce((s, r) => s + (Number(r.quantity) || 0), 0)
    return { invest, returnQty: ret, net: invest - ret }
  }, [materialList, materialProcessId])

  // ③ 质量检验（工序级）：报废数量
  const scrapTabStats = useMemo(() => {
    const list = scrapDefectList.filter(r => r.process_id === scrapProcessId && !(r as any)._deleting)
    return { scrapQty: list.reduce((s, r) => s + (Number(r.quantity || r.defect_quantity) || 0), 0) }
  }, [scrapDefectList, scrapProcessId])

  // ④ 停机停线（工单级）：异常次数 + 异常工时（净时长，已扣休息）
  const exceptionTabStats = useMemo(() => {
    const list = exceptionList.filter((r: any) => !(r as any)._deleting)
    const hours = list.reduce((s: number, r: any) => s + Number(r.net_duration ?? r.duration ?? 0), 0)
    return { count: list.length, hours: Number(hours.toFixed(2)) }
  }, [exceptionList])

  // ⑤ 人员工时（工单级）：总人数 / 净工时 / 休息时间 / 总时间
  const manpowerTabStats = useMemo(() => {
    const list = manpowerList.filter((r: any) => !(r as any)._deleting)
    const totalPeople = list.reduce((s: number, r: any) => s + Number(r.total_people || 0), 0)
    const netHours = list.reduce((s: number, r: any) => s + Number(r.net_hours ?? 0), 0)
    const grossHours = list.reduce((s: number, r: any) => s + Number(r.man_hours ?? 0), 0)
    // 休息时间：从 overlappingBreaks 计算（与 renderTabContent manpower 分支逻辑一致）
    let breakHours = 0
    if (selectedReport) {
      const rs = dayjs(selectedReport.report_time)
      const re = selectedReport.finish_time ? dayjs(selectedReport.finish_time) : dayjs()
      breakHours = breakTimes.reduce((s: number, b: any) => {
        const bs = dayjs(b.start_time)
        const be = dayjs(b.end_time)
        const overlapMs = Math.max(0, Math.min(re.valueOf(), be.valueOf()) - Math.max(rs.valueOf(), bs.valueOf()))
        return s + overlapMs / 3600000
      }, 0)
    }
    return {
      totalPeople,
      netHours: Number(netHours.toFixed(2)),
      breakHours: Number(breakHours.toFixed(2)),
      grossHours: Number(grossHours.toFixed(2)),
    }
  }, [manpowerList, breakTimes, selectedReport])

  // ========== save 后全链路刷新 ==========
  const refreshAfterSave = useCallback(async () => {
    if (!selectedReport) return
    const roId = selectedReport.report_order_id
    try {
      // ① 重拉报工单主数据 → 触发顶部 stats useEffect 重算持久化字段
      const res = await api.get(`/production/report-orders/${roId}`)
      if (res.data) {
        setSelectedReport(res.data as any)
      }
    } catch {
      // 静默：即使主数据重拉失败，子表重拉也已完成
    }
    // ② 重拉所有子表明细（fetchAllData 依赖已在 useEffect 中，report_order_id 未变不会循环触发）
    await fetchAllData(roId)
    // ③ 清空脏标记
    setDirtyIds(new Set())
  }, [selectedReport, fetchAllData])

  // 判断当前选中报工单所属的生产订单是否有未完工的报工单
  const hasUnfinishedReportOfOrder = useMemo(() => {
    if (!selectedReport?.order_id) return false
    return allReportOrders.some(
      r => r.order_id === selectedReport.order_id && (r.status === '开工' || r.status === 0)
    )
  }, [selectedReport, allReportOrders])

  // 检查当前页签是否有未保存记录
  const hasUnsavedChanges = useMemo(() => {
    if (!isEditable) return false
    // 任何 dirtyIds 中的已修改记录都算未保存
    if (dirtyIds.size > 0) return true
    if (activeTab === 'production-defect') {
      return prodDefectList.some(d => d.defect_type_id && !d.defect_id)
    }
    if (activeTab === 'scrap-defect') {
      return scrapDefectList.some(d => d.defect_type_id && !d.scrap_id)
    }
    if (activeTab === 'production-material') {
      return materialList.some(m => m.bas_material_id && (!m.material_id || String(m.id).startsWith('tmp_')))
    }
    if (activeTab === 'exception') {
      return exceptionList.some(e => e.exception_type && !e.exception_id)
    }
    if (activeTab === 'manpower') {
      // 不允许新增，只检查是否有被修改的记录
      return manpowerList.some(m => m.record_id && dirtyIds.has(m.id))
    }
    return false
  }, [activeTab, isEditable, prodDefectList, scrapDefectList, materialList, exceptionList, manpowerList, dirtyIds])

  // 监听浏览器关闭/刷新（仅在当前页签有未保存记录时提示）
  useEffect(() => {
    if (!hasUnsavedChanges) return
    const handler = (e) => {
      e.preventDefault()
      e.returnValue = ''
      return ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsavedChanges])

  // 切换页签前若有未保存记录则提示
  const handleTabChange = (newTab) => {
    if (hasUnsavedChanges) {
      Modal.confirm({
        title: '存在未保存的记录',
        content: '当前页签有未保存的记录，离开将丢失这些数据。是否确认离开？',
        okText: '确认离开',
        okType: 'danger',
        cancelText: '继续编辑',
        onOk: () => { setActiveTab(newTab); setActiveGroup(tabToGroup[newTab as keyof typeof tabToGroup] ?? activeGroup) },
      })
      return
    }
    setActiveTab(newTab)
    setActiveGroup(tabToGroup[newTab as keyof typeof tabToGroup] ?? activeGroup)
  }

  // 🔑 切换一级分组 Tab（工序记录 / 工单记录）
  const handleGroupChange = (group: 'process' | 'report') => {
    if (hasUnsavedChanges) {
      Modal.confirm({
        title: '存在未保存的记录',
        content: '当前页签有未保存的记录，离开将丢失这些数据。是否确认离开？',
        okText: '确认离开',
        okType: 'danger',
        cancelText: '继续编辑',
        onOk: () => { setActiveGroup(group); setActiveTab(defaultSubTabOfGroup[group]) },
      })
      return
    }
    setActiveGroup(group)
    setActiveTab(defaultSubTabOfGroup[group])
  }

  // 打开新增报工 Modal
  const handleOpenCreateModal = () => {
    createForm.resetFields()
    createForm.setFieldsValue({
      report_qty: 0,
      remarks: '',
      report_time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    })
    setSelectedCreateOrder(null)
    setCreateModalOpen(true)
  }

  // 提交新增报工单（支持超额二次确认）
  const handleCreateReport = async (confirmed?: boolean) => {
    try {
      const values = await createForm.validateFields()
      setCreatingReport(true)
      const res = await api.post('/production/report-orders', {
        order_id: values.order_id,
        line_id: values.line_id,
        report_qty: values.report_qty,
        remarks: values.remarks || '',
        confirmed: !!confirmed,
      })
      message.success('报工单创建成功')
      setCreateModalOpen(false)
      await fetchReportOrders()
      if (res.data) {
        // 创建后端会自动从产线工序继承到 report_processes 子表
        setSelectedReport(res.data)
      }
    } catch (err: any) {
      if (err?.errorFields) return // 表单校验失败
      // 后端返回需要二次确认
      if (err?.need_confirm) {
        Modal.confirm({
          title: '确认超额报工',
          content: err.message,
          okText: '确认提交',
          cancelText: '取消',
          onOk: () => handleCreateReport(true),
        })
        return
      }
      message.error(err.message || '创建报工单失败')
    } finally {
      setCreatingReport(false)
    }
  }

  // 完工报工单：预检 → 弹窗 → 确认执行
  const handleFinishReport = async () => {
    if (!selectedReport) return
    try {
      const res: any = await api.get(`/production/report-orders/${selectedReport.report_order_id}/pre-check`)
      const data = res.data || res
      setFinishCheckItems(data.items || [])
      setFinishCheckOpen(true)
    } catch (err: any) {
      message.error(err.message || '预检失败')
    }
  }
  const doFinishReport = async () => {
    if (!selectedReport) return
    try {
      setFinishingReport(true)
      const res: any = await api.post(`/production/report-orders/${selectedReport.report_order_id}/finish`)
      const updated = res.data || { ...selectedReport, status: '完工', finish_time: new Date() }
      setSelectedReport(updated)
      await fetchReportOrders()
      setFinishCheckOpen(false)
      message.success(res.message || '已完工')
    } catch (err: any) {
      message.error(err.message || '操作失败')
    } finally {
      setFinishingReport(false)
    }
  }

  // 关闭报工单（开工 → 完工，单向）
  const handleCloseReport = async () => {
    if (!selectedReport) return
    try {
      setClosingReport(true)
      const res = await api.post(`/production/report-orders/${selectedReport.report_order_id}/close`)
      const updated = res.data || { ...selectedReport, status: '完工', close_time: new Date() }
      setSelectedReport(updated)
      await fetchReportOrders()
      message.success(res.message || '已关闭')
    } catch (err) {
      message.error(err.message || '操作失败')
    } finally {
      setClosingReport(false)
    }
  }

  const deviceOptions = useMemo(() => {
    return devices.map(d => ({ label: `${d.device_code} ${d.device_name}`, value: d.device_id }))
  }, [devices])

  // 新增报工 Modal 的订单下拉选项（"下发"、"开工"、"完工"(但数量未达标) 状态可创建报工单）
  const orderOptions = useMemo(() => {
    const STATUS_MAP: Record<string, string> = {
      '0': '开立', '1': '下发', '2': '开工', '3': '完工', '开立': '开立', '下发': '下发', '开工': '开工', '完工': '完工',
    }
    return orders
      .filter(o => {
        const s = STATUS_MAP[String(o.status)] || String(o.status)
        if (s === '下发' || s === '开工') return true
        if (s === '完工') {
          const planned = Number(o.planned_qty || 0)
          const finished = Number(o.finished_qty || 0)
          return finished < planned
        }
        return false
      })
      .map(o => {
        const s = STATUS_MAP[String(o.status)] || String(o.status)
        return {
          label: `${o.order_no} (${o.material_name || '-'}) [${s}]`,
          value: o.order_id,
          order_no: o.order_no || '',
          material_code: o.material_code || '',
          material_name: o.material_name || '',
          specification: o.specification || '',
          planned_qty: o.planned_qty || 0,
          finished_qty: o.finished_qty || 0,
        }
      })
  }, [orders])

  // 新增报工 Modal 的产线下拉选项（仅运行中）
  const lineOptions = useMemo(() => {
    return lines
      .filter(l => l.status === '运行中')
      .map(l => ({ label: l.line_name, value: l.line_id }))
  }, [lines])

  // 批量保存生产不良记录（新增 + 已修改）

  // 新增一条生产不良记录空行（手动触发，添加前先执行一次保存）

  const prodDefectDisplayList = useMemo(() => {
    // 改为手动添加模式，不再自动追加空行
    return prodDefectList
  }, [prodDefectList])

  const getUnitOptions = (defectTypeId) => {
    const defect = defectTypeOptions.find(d => String(d.value) === String(defectTypeId))
    if (!defect || !defect.available_units) return []
    const units = Array.isArray(defect.available_units)
      ? defect.available_units
      : defect.available_units.split(',')
    return units.map(u => ({ label: (u || '').trim(), value: (u || '').trim() }))
  }

  const getFilteredProdDefectOptions = (currentRecordId) => {
    const selectedIds = prodDefectList
      .filter(d => String(d.id) !== String(currentRecordId) && d.defect_type_id)
      .map(d => String(d.defect_type_id))
    return defectTypeOptions.filter(d => !selectedIds.includes(String(d.value)))
  }

  const prodDefectColumns = buildDefectColumns({
    isEditable,
    options: defectTypeOptions,
    onChange: handleProdDefectChange,
    onDelete: handleDeleteProdDefect,
    getUnitOptions,
    getFilteredOptions: getFilteredProdDefectOptions,
    openImageDrawer,
  })

  // 批量保存检验报废记录（新增 + 已修改）

  // 新增一条检验报废记录空行（手动触发，添加前先执行一次保存）

  const scrapDefectDisplayList = useMemo(() => {
    // 改为手动添加模式，不再自动追加空行
    return scrapDefectList
  }, [scrapDefectList])

  const getScrapUnitOptions = (defectTypeId) => {
    const defect = scrapTypeOptions.find(d => String(d.value) === String(defectTypeId))
    if (!defect || !defect.available_units) return []
    const units = Array.isArray(defect.available_units)
      ? defect.available_units
      : defect.available_units.split(',')
    return units.map(u => ({ label: (u || '').trim(), value: (u || '').trim() }))
  }

  const getFilteredScrapDefectOptions = (currentRecordId) => {
    const selectedIds = scrapDefectList
      .filter(d => String(d.id) !== String(currentRecordId) && d.defect_type_id)
      .map(d => String(d.defect_type_id))
    return scrapTypeOptions.filter(d => !selectedIds.includes(String(d.value)))
  }

  const scrapDefectColumns = buildDefectColumns({
    isEditable,
    options: scrapTypeOptions,
    onChange: handleScrapDefectChange,
    onDelete: handleDeleteScrapDefect,
    getUnitOptions: getScrapUnitOptions,
    getFilteredOptions: getFilteredScrapDefectOptions,
    openImageDrawer,
  })

  // 校验单条生产物料记录（批号、数量为必填项）
  const validateMaterialRecord = (record) => {
    if (!record.bas_material_id) {
      message.warning('请选择料号')
      return false
    }
    if (!record.material_batch || !String(record.material_batch).trim()) {
      message.warning('请填写批号')
      return false
    }
    if (!record.quantity || record.quantity <= 0) {
      message.warning('请填写大于0的数量')
      return false
    }
    return true
  }

  // 批量保存生产物料记录（新增 + 已修改）

  // 新增一条生产物料记录空行（手动触发，添加前先执行一次保存）

  const materialDisplayList = useMemo(() => {
    // 改为手动添加模式，不再自动追加空行
    return materialList
  }, [materialList])

  const isFirstProcess = useMemo(() => {
    if (!lineProcesses.length || defectProcessId == null) return false
    return lineProcesses[0].process_id === defectProcessId
  }, [lineProcesses, defectProcessId])

  // 获取上一道工序的合格数（绑定 defectProcessId，仅不良记录 Tab 用到）
  useEffect(() => {
    if (!selectedReport || defectProcessId == null || !lineProcesses.length || isFirstProcess) {
      setPrevProcessQualifiedQty(0)
      return
    }
    const currentIndex = lineProcesses.findIndex(p => p.process_id === defectProcessId)
    if (currentIndex <= 0) {
      setPrevProcessQualifiedQty(0)
      return
    }
    const prevProcessId = lineProcesses[currentIndex - 1].process_id
    let cancelled = false
    const run = async () => {
      try {
        const [defectRes, materialRes] = await Promise.all([
          api.get('/production/process-defects', { params: { report_order_id: selectedReport.report_order_id, process_id: prevProcessId, page: 1, pageSize: 1000 } }),
          api.get('/production/process-materials', { params: { report_order_id: selectedReport.report_order_id, process_id: prevProcessId, page: 1, pageSize: 1000 } }),
        ])
        if (cancelled) return
        const prevDefects = defectRes.data || []
        const prevMaterials = materialRes.data || []
        let prevInputQty = prevMaterials.reduce((sum, m) => sum + (Number(m.quantity) || 0), 0)
        if (prevMaterials.length > 0) {
          const investQty = prevMaterials.filter(m => m.material_type === '投入').reduce((sum, m) => sum + (Number(m.quantity) || 0), 0)
          const returnQty = prevMaterials.filter(m => m.material_type === '退回').reduce((sum, m) => sum + (Number(m.quantity) || 0), 0)
          prevInputQty = investQty - returnQty
        }
        const prevProcessDefect = prevDefects.filter(d => d.defect_type === '制程不良').reduce((sum, d) => sum + (Number(d.quantity) || 0), 0)
        const prevMaterialDefect = prevDefects.filter(d => d.defect_type === '来料不良').reduce((sum, d) => sum + (Number(d.quantity) || 0), 0)
        const prevQualified = prevInputQty - prevProcessDefect - prevMaterialDefect
        setPrevProcessQualifiedQty(prevQualified > 0 ? Number(prevQualified.toFixed(2)) : 0)
      } catch {
        if (!cancelled) setPrevProcessQualifiedQty(0)
      }
    }
    run()
    return () => { cancelled = true }
  }, [selectedReport, defectProcessId, lineProcesses, isFirstProcess])

  // 当前工序统计数据

  const getFilteredMaterialOptions = (record) => {
    if (record.material_type === '退回') {
      const enteredMaterials = materialList
        .filter(m => m.material_id && m.material_code && m.material_batch && m.package_no)
        .map(m => String(m.bas_material_id))
      return materialOptions.filter(m => enteredMaterials.includes(String(m.value)))
    }
    // 投入场景：根据当前工序 process_code 查规则过滤+排序
    const proc = lineProcesses.find(p => Number(p.process_id) === Number(materialProcessId))
    const rule = getProcessMaterialRule(proc?.process_code)
    if (!rule) return materialOptions // 无规则 → 全量
    let filtered = materialOptions.filter(m =>
      isMaterialAllowed(m.material_code, rule, selectedReport?.material_code)
    )
    filtered = sortMaterialsByRule(filtered, rule)
    return filtered
  }

  const materialColumns = buildMaterialColumns({
    isEditable,
    options: materialOptions,
    onChange: handleMaterialChange,
    onDelete: handleDeleteMaterial,
    getFilteredOptions: getFilteredMaterialOptions,
    openImageDrawer,
    processCode: lineProcesses.find((p: any) => Number(p.process_id) === Number(materialProcessId))?.process_code,
  })

  // 校验单条异常工时记录
  const validateExceptionRecord = (record) => {
    if (!record.exception_type) {
      message.warning('请选择异常类型')
      return false
    }
    // 有结束时间必须有开始时间
    if (record.end_time && !record.start_time) {
      message.warning('有结束时间必须有开始时间')
      return false
    }
    // 结束时间必须晚于开始时间
    if (record.start_time && record.end_time && new Date(record.end_time) <= new Date(record.start_time)) {
      message.warning('结束时间必须晚于开始时间')
      return false
    }
    return true
  }

  // 批量保存异常工时记录（新增 + 已修改）

  // 新增一条异常工时记录空行（手动触发，添加前先执行一次保存）

  const exceptionDisplayList = useMemo(() => {
    // 改为手动添加模式，不再自动追加空行
    return exceptionList
  }, [exceptionList])

  const exceptionColumns = buildExceptionColumns({
    isEditable,
    deviceOptions,
    exceptionCategories,
    exceptionList,
    reportTime: selectedReport?.report_time,
    onChange: handleExceptionChange,
    onDelete: async (record: any) => { await handleDeleteException(record.id); await refreshAfterSave() },
    onStart: async (record: any) => { await handleStartException(record); await refreshAfterSave() },
    onFinish: async (record: any) => { await handleFinishException(record); await refreshAfterSave() },
    openImageDrawer,
  })

  // 异常工时：存在未结束记录时禁用"添加"按钮
  const hasUnfinishedException = useMemo(() => !!exceptionList.find((e: any) => !e.end_time), [exceptionList])

  const saveManpowerItem = async (item) => {
    if (!selectedReport) return
    try {
      // 开始/结束时间由后端从报工单读取（开工状态用当前时间作为结束时间）
      const payload = {
        report_order_id: selectedReport.report_order_id,
        record_date: item.record_date,
        shift: item.shift,
        skilled_count: item.skilled_count,
        general_count: item.general_count,
        labor_count: item.labor_count,
        other_count: item.other_count,
        remarks: item.remarks,
      }
      if (item.record_id) {
        await api.put(`/production/manpower-records/${item.record_id}`, payload)
        setManpowerList(prev => prev.map(m =>
          m.id === item.id ? { ...m, ...payload } : m
        ))
      } else {
        const res = await api.post('/production/manpower-records', payload)
        setManpowerList(prev => prev.map(m =>
          m.id === item.id ? { ...res.data, id: res.data.record_id } : m
        ))
      }
    } catch (err) {
      message.error(err.message || '保存失败')
    }
  }

  // 校验单条人员工时记录
  const validateManpowerRecord = (record) => {
    // 开始/结束时间从报工单读取，无需用户填写；只校验人员数量
    const sk = Number(record.skilled_count) || 0
    const gn = Number(record.general_count) || 0
    const lb = Number(record.labor_count) || 0
    const ot = Number(record.other_count) || 0
    const total = sk + gn + lb + ot
    if (total <= 0) {
      message.warning('请填写至少一项人员数量（技工/普工/劳务/其他）')
      return false
    }
    return true
  }

  // 判断人员工时记录是否为有效记录（至少填写了一项人员数量）
  function isManpowerRecordFilled(m) {
    const sk = Number(m.skilled_count) || 0
    const gn = Number(m.general_count) || 0
    const lb = Number(m.labor_count) || 0
    const ot = Number(m.other_count) || 0
    return (sk + gn + lb + ot) > 0
  }

  // 保存人员工时记录（每个报工单只有一条记录，由后端在开工时自动创建）
  // 前端只允许修改人数，不允许新增

  // 根据报工单时间计算单条人员工时记录的 hours / man_hours
  // 开始时间 = 报工单 report_time；结束时间 = 完工状态取 finish_time，开工状态取当前时间
  const calcManpowerHours = useCallback(() => {
    const reportStart = selectedReport?.report_time
    if (!reportStart) return { start_time: null, end_time: null, hours: 0 }
    const start = dayjs(reportStart)
    // 完工状态用 finish_time；开工状态用当前时间（已投入工时实时计算）
    const end = selectedReport?.status === '完工' && selectedReport?.finish_time
      ? dayjs(selectedReport.finish_time)
      : dayjs()
    const diffMs = end.valueOf() - start.valueOf()
    const hours = diffMs > 0 ? Number((diffMs / 3600000).toFixed(2)) : 0
    return { start_time: reportStart, end_time: end.format('YYYY-MM-DD HH:mm:ss'), hours }
  }, [selectedReport])

  const manpowerDisplayList = useMemo(() => {
    // 改为手动添加模式，不再自动追加空行
    // 工时实时根据报工单时间计算（开工状态结束时间取当前时间）
    const { hours } = calcManpowerHours()
    return manpowerList.map(m => {
      const sk = Number(m.skilled_count) || 0
      const gn = Number(m.general_count) || 0
      const lb = Number(m.labor_count) || 0
      const ot = Number(m.other_count) || 0
      const total_people = sk + gn + lb + ot
      const man_hours = Number((hours * total_people).toFixed(2))
      return { ...m, hours, total_people, man_hours }
    })
  }, [manpowerList, calcManpowerHours])

  const manpowerColumns = buildManpowerColumns({
    isEditable,
    selectedReport,
    onChange: handleManpowerChange,
  })

  // ─── 休息时间编辑 / 保存 / 刷新 ───
  const handleBreakTimeEdit = useCallback((breakTimeId: number | string, field: 'start_time' | 'end_time', value: dayjs.Dayjs | null) => {
    if (!value) return
    setBreakTimes(prev => prev.map(b => {
      if (String(b.break_time_id) !== String(breakTimeId)) return b
      const existing = dayjs(b[field])
      const next = existing.hour(value.hour()).minute(value.minute()).second(0)
      return { ...b, [field]: next.format('YYYY-MM-DD HH:mm:ss') }
    }))
    setBreakTimesDirty(true)
  }, [])

  const saveBreakTimes = useCallback(async () => {
    if (!selectedReport || !breakTimesDirty) return true
    setBreakTimesSaving(true)
    try {
      await api.post('/production/break-times/batch', {
        report_order_id: selectedReport.report_order_id,
        records: breakTimes,
      })
      setBreakTimesDirty(false)
      return true
    } catch (e: any) {
      message.error(e?.message || '休息时间保存失败')
      return false
    } finally {
      setBreakTimesSaving(false)
    }
  }, [selectedReport, breakTimes, breakTimesDirty, message])

  const handleBreakTimeRefresh = useCallback(async () => {
    if (!selectedReport) return
    try {
      const res = await api.get('/system/config')
      const cfgMap: Record<string, any> = res.data || {}
      let patterns = cfgMap.default_break_times
      if (typeof patterns === 'string') patterns = JSON.parse(patterns || '[]')
      const reportDate = dayjs(selectedReport.report_time)
      const newBreaks = patterns.map((p: any) => {
        const [sh, sm] = p.start.split(':').map(Number)
        const [eh, em] = p.end.split(':').map(Number)
        const start = reportDate.hour(sh).minute(sm).second(0)
        const endDayOffset = (eh * 60 + em) < (sh * 60 + sm) ? 1 : 0
        const end = reportDate.add(endDayOffset, 'day').hour(eh).minute(em).second(0)
        return { start_time: start.format('YYYY-MM-DD HH:mm:ss'), end_time: end.format('YYYY-MM-DD HH:mm:ss') }
      })
      await api.post('/production/break-times/batch', {
        report_order_id: selectedReport.report_order_id,
        records: newBreaks,
      })
      setBreakTimes(newBreaks)
      setBreakTimesDirty(false)
      message.success('默认休息时间已刷新')
    } catch (e: any) {
      message.error(e?.message || '刷新失败')
    }
  }, [selectedReport, message])

  // 合并保存：休息时间 + 人员工时
  const handleCombinedSave = useCallback(async () => {
    const breakOk = await saveBreakTimes()
    if (!breakOk) return
    await handleSaveAllManpowers()
  }, [saveBreakTimes, handleSaveAllManpowers])

  // 所有子 Tab（平级定义，分组在下面 groupTabItems 里完成）
  const tabItems = [
    { key: 'production-defect', label: '报废记录' },
    { key: 'production-material', label: '物料使用' },
    { key: 'scrap-defect', label: '质量检验' },
    { key: 'exception', label: '停机停线' },
    { key: 'manpower', label: '人员工时' },
    { key: 'batch-tag', label: '批次标签' },
  ]

  // 🔑 一级 Tab 分组：工序报工 / 工单报工
  const groupTabItems = [
    {
      key: 'process',
      label: '🔧 工序报工',
      children: (
        <>
          <Tabs
            activeKey={activeTab}
            onChange={handleTabChange}
            items={tabItems.filter(t => tabToGroup[t.key as keyof typeof tabToGroup] === 'process')}
          />
          <div style={{ marginTop: 16 }}>
            {renderTabContent(activeTab)}
          </div>
        </>
      ),
    },
    {
      key: 'report',
      label: '📊 工单报工',
      children: (
        <>
          <Tabs
            activeKey={activeTab}
            onChange={handleTabChange}
            items={tabItems.filter(t => tabToGroup[t.key as keyof typeof tabToGroup] === 'report')}
          />
          <div style={{ marginTop: 16 }}>
            {renderTabContent(activeTab)}
          </div>
        </>
      ),
    },
  ]

  function renderTabContent(key: string) {
    switch (key) {
      case 'production-defect':
        return (
          <ProcessDefectTab
            selectedProcessId={defectProcessId}
            processes={lineProcesses}
            onSelectProcess={setDefectProcessId}
            editable={isEditable}
            columns={prodDefectColumns as any}
            data={prodDefectDisplayList}
            onSave={async () => { await handleSaveAllProdDefects(); await refreshAfterSave() }}
            onAdd={handleAddProdDefectRow}
            stats={defectTabStats}
          />
        )
      case 'production-material':
        return (
          <GenericRecordTab
            tableKey="pages_production_ProcessReporting_material"
            title="物料使用"
            editable={isEditable}
            columns={materialColumns as any}
            data={materialDisplayList}
            onSave={async () => { await handleSaveAllMaterials(); await refreshAfterSave() }}
            onAdd={handleAddMaterialRow}
            scrollX={1000}
            showProcessSelector
            selectedProcessId={materialProcessId}
            processes={lineProcesses}
            onSelectProcess={setMaterialProcessId}
            rightExtra={selectedReport && (
              <Space size="middle">
                <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>工序统计：</span>
                <span>投入 <b style={{ color: 'var(--color-primary)' }}>{materialTabStats.invest}</b></span>
                <span>退回 <b style={{ color: 'var(--color-warning)' }}>{materialTabStats.returnQty}</b></span>
                <span>净用量 <b style={{ color: 'var(--color-success)' }}>{materialTabStats.net}</b></span>
              </Space>
            )}
          />
        )
      case 'scrap-defect':
        return (
          <GenericRecordTab
            tableKey="pages_production_ProcessReporting_scrap"
            title="质量检验"
            editable={isEditable}
            columns={scrapDefectColumns as any}
            data={scrapDefectDisplayList}
            onSave={async () => { await handleSaveAllScrapDefects(); await refreshAfterSave() }}
            onAdd={handleAddScrapDefectRow}
            scrollX={800}
            showProcessSelector
            selectedProcessId={scrapProcessId}
            processes={lineProcesses}
            onSelectProcess={setScrapProcessId}
            rightExtra={selectedReport && (
              <Space size="middle">
                <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>工序统计：</span>
                <span>报废数量 <b style={{ color: 'var(--color-error)' }}>{scrapTabStats.scrapQty}</b></span>
              </Space>
            )}
          />
        )
      case 'exception':
        return (
          <GenericRecordTab
            tableKey="pages_production_ProcessReporting_exception"
            title="停机停线"
            editable={isEditable}
            columns={exceptionColumns as any}
            data={exceptionDisplayList}
            onSave={async () => { await handleSaveAllExceptions(); await refreshAfterSave() }}
            onAdd={handleAddExceptionRow}
            disableAdd={hasUnfinishedException}
            scrollX={900}
            rightExtra={selectedReport && (
              <Space size="middle">
                <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>统计：</span>
                <span>异常次数 <b style={{ color: 'var(--color-error)' }}>{exceptionTabStats.count}</b></span>
                <span>异常工时 <b style={{ color: '#eb2f96' }}>{exceptionTabStats.hours}H</b></span>
              </Space>
            )}
          />
        )
      case 'manpower': {
        // 过滤只显示与报工时段重叠的休息时间
        const reportStart = selectedReport ? dayjs(selectedReport.report_time) : null
        const reportEnd = selectedReport
          ? (selectedReport.finish_time ? dayjs(selectedReport.finish_time) : dayjs())
          : null
        const overlappingBreaks = breakTimes.filter((b: any) => {
          if (!reportStart || !reportEnd) return false
          const bs = dayjs(b.start_time)
          const be = dayjs(b.end_time)
          const s = Math.max(reportStart.valueOf(), bs.valueOf())
          const e = Math.min(reportEnd.valueOf(), be.valueOf())
          return e - s > 0
        })

        const breakTableCols = [
          { title: '#', key: 'idx', width: 40, render: (_: any, __: any, i: number) => i + 1 },
          {
            title: '开始时间', dataIndex: 'start_time', key: 'start_time', width: 180,
            render: (v: string, rec: any) => isEditable ? (
              <TimePicker
                size="small" format="HH:mm"
                value={dayjs(v)}
                onChange={(t) => handleBreakTimeEdit(rec.break_time_id, 'start_time', t)}
              />
            ) : <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{formatDateTime(v)}</span>,
          },
          {
            title: '结束时间', dataIndex: 'end_time', key: 'end_time', width: 180,
            render: (v: string, rec: any) => isEditable ? (
              <TimePicker
                size="small" format="HH:mm"
                value={dayjs(v)}
                onChange={(t) => handleBreakTimeEdit(rec.break_time_id, 'end_time', t)}
              />
            ) : <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{formatDateTime(v)}</span>,
          },
        ]

        return (
          <div>
            {/* 统计行 — 休息时间卡片上方靠右 */}
            {selectedReport && (
              <Row style={{ marginBottom: 8 }} justify="end">
                <Col>
                  <Space size="middle" wrap>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>统计：</span>
                    <span>总人数 <b style={{ color: 'var(--color-primary)' }}>{manpowerTabStats.totalPeople}</b></span>
                    <span>总时间 <b style={{ color: '#13c2c2' }}>{manpowerTabStats.grossHours}H</b></span>
                    <span>休息时间 <b style={{ color: 'var(--text-secondary)' }}>{manpowerTabStats.breakHours}H</b></span>
                    <span>净工时 <b style={{ color: 'var(--color-success)' }}>{manpowerTabStats.netHours}H</b></span>
                  </Space>
                </Col>
              </Row>
            )}
            {/* 休息时间区块 */}
            <Card
              size="small"
              title={<span style={{ fontSize: 13, color: 'var(--text-primary)' }}>🛑 默认休息时间</span>}
              style={{ marginBottom: 12 }}
            >
              {overlappingBreaks.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>
                  本报工时段内无重叠休息时间
                </div>
              ) : (
                <Table
                  size="small"
                  pagination={false}
                  rowKey="break_time_id"
                  dataSource={overlappingBreaks}
                  columns={breakTableCols}
                />
              )}
            </Card>
            {/* 班次时间（原人员工时） */}
            <GenericRecordTab
              tableKey="pages_production_ProcessReporting_manpower"
              title="班次时间"
              editable={isEditable}
              columns={manpowerColumns as any}
              data={manpowerDisplayList}
              onSave={async () => { await handleCombinedSave(); await refreshAfterSave() }}
              onAdd={() => {}}
              hideAdd
              hideDefaultActions
              hint=""
              scrollX={800}
              rightExtra={
                isEditable ? (
                  <Space>
                    <Button type="primary" icon={<SaveOutlined />} onClick={async () => { await handleCombinedSave(); await refreshAfterSave() }}>保存</Button>
                    <Button size="small" icon={<ReloadOutlined />} onClick={async () => { await handleBreakTimeRefresh(); await refreshAfterSave() }} loading={breakTimesSaving}>刷新休息</Button>
                  </Space>
                ) : null
              }
            />
          </div>
        )
      }
      case 'batch-tag':
        if (!selectedReport) return null
        return (
          <BatchTagPanel
            reportNo={selectedReport.report_no}
            reportOrderId={selectedReport.report_order_id}
            initialBatch={selectedReport.production_batch}
            initialImageFirst={selectedReport.image_first}
            initialImageLast={selectedReport.image_last}
            editable={isEditable}
            onSaved={(patch) => {
              // 更新本地 selectedReport 状态，避免后续 Tab 切换看不到
              setSelectedReport((prev: any) => ({ ...prev, ...patch }))
              // 同步 allReportOrders 里的对应条（如果有的话）
              setAllReportOrders((list: any[]) => list.map((r: any) =>
                r.report_order_id === selectedReport.report_order_id ? { ...r, ...patch } : r
              ))
              setReportOrders((list: any[]) => list.map((r: any) =>
                r.report_order_id === selectedReport.report_order_id ? { ...r, ...patch } : r
              ))
            }}
          />
        )
      default:
        return null
    }
  }

  const selectedOrderInfo = orders.find((o: any) => o.order_id === selectedReport?.order_id)
  const reportStatItems = [
    { label: '计划数量', value: selectedOrderInfo?.planned_qty != null ? Math.round(Number(selectedOrderInfo.planned_qty)) : '-', color: 'var(--color-primary)' },
    { label: '制程不良', value: stats.defectProcess || 0, color: 'var(--color-warning)' },
    { label: '来料不良', value: stats.defectMaterial || 0, color: 'var(--color-warning)' },
    { label: '报废数量', value: stats.defectScrap || 0, color: 'var(--color-error)' },
    { label: '异常工时', value: `${(stats.exceptionHours || 0).toFixed(1)}H`, color: '#eb2f96' },
    { label: '总工时', value: `${(stats.manpowerHours || 0).toFixed(1)}H`, color: '#13c2c2' },
  ]

  return (
    <div style={{ padding: 16 }}>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle" style={{ marginBottom: 12 }}>
          <Col span={16}>
            <Space>
              <span style={{ fontWeight: 'bold' }}>报工单：</span>
              <Select
                value={selectedReport?.report_order_id || undefined}
                onChange={(val) => {
                  if (hasUnsavedChanges) {
                    Modal.confirm({
                      title: '存在未保存的记录',
                      content: '当前页签有未保存的记录，切换报工单将丢失这些数据。是否确认切换？',
                      okText: '确认切换',
                      okType: 'danger',
                      cancelText: '取消',
                      onOk: () => {
                        const r = reportOrders.find(r => r.report_order_id === val)
                        setSelectedReport(r || null)
                      },
                    })
                    return
                  }
                  const r = reportOrders.find(r => r.report_order_id === val)
                  setSelectedReport(r || null)
                }}
                options={reportOrders.map(r => ({
                  label: `${r.report_no} (${r.order_no || '-'}) ${r.material_name || ''}`,
                  value: r.report_order_id,
                }))}
                style={{ width: 360 }}
                placeholder="请选择报工单"
                showSearch
                optionFilterProp="label"
                popupClassName="mes-select-dropdown"
                loading={loading}
              />
              {!hasUnfinishedReportOfOrder && hasPermission('production:reporting:create') && (
                <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreateModal}>新增报工</Button>
              )}
              {selectedReport && isEditable && hasPermission('production:reporting:finish') && (
                <Popconfirm title="确认完工？完工后数据将变为只读" onConfirm={handleFinishReport}>
                  <Button type="primary" loading={finishingReport}>完工</Button>
                </Popconfirm>
              )}
              {selectedReport && isEditable && hasPermission('production:reporting:close') && (
                <Popconfirm title="确认关闭？关闭前需无不良记录、无物料使用记录、无检验报废记录" onConfirm={handleCloseReport}>
                  <Button danger loading={closingReport}>关闭</Button>
                </Popconfirm>
              )}
            </Space>
          </Col>
          {selectedReport && (
            <Col span={8} style={{ textAlign: 'right' }}>
              <Tag
                color={reportOrderStatusMap[selectedReport.status]?.color || 'default'}
                style={{ fontSize: 13, padding: '2px 10px', margin: 0 }}
              >
                {reportOrderStatusMap[selectedReport.status]?.label || '-'}
              </Tag>
            </Col>
          )}
        </Row>

        {!headerCollapsed && selectedReport && (
          <Row gutter={16}>
            <Col span={4}>
              <Space size={4} align="baseline" wrap={false}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold', whiteSpace: 'nowrap', flexShrink: 0 }}>报工单号</span>
                <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>{selectedReport.report_no}</span>
              </Space>
            </Col>
            <Col span={4}>
              <Space size={4} align="baseline" wrap={false}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold', whiteSpace: 'nowrap', flexShrink: 0 }}>订单编号</span>
                <span style={{ whiteSpace: 'nowrap' }}>{selectedReport.order_no || '-'}</span>
              </Space>
            </Col>
            <Col span={4}>
              <Space size={4} align="baseline" wrap={false}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold', whiteSpace: 'nowrap', flexShrink: 0 }}>生产产线</span>
                <span style={{ whiteSpace: 'nowrap' }}>{selectedReport.line_name || '-'}</span>
              </Space>
            </Col>
            <Col span={4}>
              <Space size={4} align="baseline" wrap={false}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold', whiteSpace: 'nowrap', flexShrink: 0 }}>菲林版本</span>
                <span style={{ whiteSpace: 'nowrap' }}>
                  {formatFilmVersion(selectedReport.order?.film_version, selectedReport.order?.version_no) || '-'}
                </span>
              </Space>
            </Col>
            <Col span={4}>
              <Space size={4} align="baseline" wrap={false}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold', whiteSpace: 'nowrap', flexShrink: 0 }}>条形码</span>
                <span style={{ whiteSpace: 'nowrap' }}>{selectedReport.order?.barcode || '-'}</span>
              </Space>
            </Col>
          </Row>
        )}

        {!headerCollapsed && selectedReport && (
          <Row gutter={16} style={{ marginTop: 12 }}>
            <Col span={4}>
              <Space size={4} align="baseline" wrap={false}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold', whiteSpace: 'nowrap', flexShrink: 0 }}>物料编号</span>
                <span style={{ whiteSpace: 'nowrap' }}>{selectedReport.material_code || '-'}</span>
              </Space>
            </Col>
            <Col span={4}>
              <Space size={4} align="baseline" wrap={false}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold', whiteSpace: 'nowrap', flexShrink: 0 }}>产品规格</span>
                <span style={{ whiteSpace: 'nowrap' }}>{selectedReport.specification || '-'}</span>
              </Space>
            </Col>
            <Col span={8}>
              <Space size={4} align="baseline" wrap={false}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold', whiteSpace: 'nowrap', flexShrink: 0 }}>产品名称</span>
                <span style={{ whiteSpace: 'nowrap' }}>{selectedReport.material_name || '-'}</span>
              </Space>
            </Col>
          </Row>
        )}

        {!headerCollapsed && selectedReport && (
          <Row gutter={16} style={{ marginTop: 12 }}>
            <Col span={4}>
              <Space size={4} align="baseline" wrap={false}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold', whiteSpace: 'nowrap', flexShrink: 0 }}>报工时间</span>
                <span style={{ whiteSpace: 'nowrap' }}>{formatDateTime(selectedReport.report_time)}</span>
              </Space>
            </Col>
            <Col span={4}>
              <Space size={4} align="baseline" wrap={false}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold', whiteSpace: 'nowrap', flexShrink: 0 }}>完工时间</span>
                <span style={{ whiteSpace: 'nowrap' }}>{formatDateTime(selectedReport.finish_time)}</span>
              </Space>
            </Col>
            <Col span={4}>
              <Space size={4} align="baseline" wrap={false}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold', whiteSpace: 'nowrap', flexShrink: 0 }}>报工人</span>
                <span style={{ whiteSpace: 'nowrap' }}>{selectedReport.report_user_name || '-'}</span>
              </Space>
            </Col>
            <Col span={4}>
              <Space size={4} align="baseline" wrap={false}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold', whiteSpace: 'nowrap', flexShrink: 0 }}>完工人</span>
                <span style={{ whiteSpace: 'nowrap' }}>{selectedReport.finish_user_name || '-'}</span>
              </Space>
            </Col>
            <Col span={4}>
              <Space size={4} align="baseline" wrap={false}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold', whiteSpace: 'nowrap', flexShrink: 0 }}>关闭人</span>
                <span style={{ whiteSpace: 'nowrap' }}>{selectedReport.close_user_name || '-'}</span>
              </Space>
            </Col>
          </Row>
        )}

        {selectedReport && (
          <div
            className="section-info-toggle"
            onClick={() => setHeaderCollapsed(c => !c)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setHeaderCollapsed(c => !c) }}
          >
            {headerCollapsed ? <DownOutlined /> : <UpOutlined />}
          </div>
        )}
      </Card>

      {!selectedReport && (
        <Card style={{ textAlign: 'center', padding: 40, marginBottom: 16 }}>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
            {reportOrders.length === 0
              ? '暂无开工状态的报工单，请点击"新增报工"创建'
              : '请从上方下拉框选择一个报工单'}
          </div>
        </Card>
      )}

      {selectedReport && (
        <Card>
    <ReportStatsBar items={reportStatItems} rightSlot={
      <span style={{ fontSize: 13 }}>
        <span style={{ color: 'var(--color-success)' }}>平衡产出 <b>{stats.expectedOutput > 0 ? stats.expectedOutput : 0}</b></span>
        <span style={{ color: 'var(--text-secondary)', margin: '0 4px' }}>/</span>
        <span style={{ color: 'var(--color-primary)' }}>投入 <b>{stats.inputQty || 0}</b></span>
      </span>
    } />

          {/* 🔑 一级分组 Tab：工序记录 / 工单记录，内嵌各自子 Tab */}
          <Tabs
            activeKey={activeGroup}
            onChange={handleGroupChange}
            items={groupTabItems}
          />
        </Card>
      )}

      {/* 新增报工单 Modal */}
      <CreateReportModal
        open={createModalOpen}
        loading={creatingReport}
        form={createForm}
        orderOptions={orderOptions}
        lineOptions={lineOptions}
        selectedOrder={orders.find((o: any) => o.order_id === selectedReport?.order_id) || null}
        onConfirm={() => handleCreateReport(false)}
        onCancel={() => setCreateModalOpen(false)}
        onOrderChange={(option) => {
          setSelectedCreateOrder(option || null)
          if (option) {
            createForm.setFieldsValue({ report_qty: Number(option.planned_qty || 0) - Number(option.finished_qty || 0) })
          }
        }}
      />

      {/* 完工前预检 Modal */}
      <Modal
        title="完工前检查"
        open={finishCheckOpen}
        width={520}
        onCancel={() => setFinishCheckOpen(false)}
        okText="确认完工"
        cancelText="补录继续"
        confirmLoading={finishingReport}
        okButtonProps={{
          disabled: finishCheckItems.some((i: any) => i.level === 'block'),
          danger: finishCheckItems.some((i: any) => i.level === 'block'),
        }}
        onOk={doFinishReport}
      >
        <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
          {finishCheckItems.map((it: any, i: number) => {
            const colorMap: Record<string, string> = { pass: 'var(--color-success)', warn: 'var(--color-warning)', block: 'var(--color-error)' }
            const iconMap: Record<string, string> = { pass: '✅', warn: '⚠️', block: '❌' }
            return (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 13, color: colorMap[it.level] }}>
                  {iconMap[it.level]} {it.label}
                </div>
                {it.detail && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.4 }}>{it.detail}</div>
                )}
              </div>
            )
          })}
        </div>
        {(() => {
          const passCount = finishCheckItems.filter((i: any) => i.level === 'pass').length
          const warnCount = finishCheckItems.filter((i: any) => i.level === 'warn').length
          const blockCount = finishCheckItems.filter((i: any) => i.level === 'block').length
          const hasBlock = blockCount > 0
          return (
            <div style={{
              marginTop: 12, padding: '8px 12px',
              background: hasBlock ? '#fff1f0' : '#f6ffed',
              borderRadius: 6, fontSize: 13,
              color: hasBlock ? 'var(--color-error)' : 'var(--color-success)',
            }}>
              {hasBlock
                ? `❌ ${passCount} 通过 · ${warnCount} 警告 · ${blockCount} 阻断 — 请补录后再完工`
                : `✅ ${passCount} 通过 · ${warnCount} 警告 — 可以完工`}
            </div>
          )
        })()}
      </Modal>

      <Drawer
        title={imageDrawerTitle}
        open={imageDrawerVisible}
        onClose={closeImageDrawer}
        width={600}
      >
        {isEditable && (
          <Upload
            multiple
            listType="picture-card"
            showUploadList={false}
            beforeUpload={() => false}
            onChange={({ fileList }) => {
              const files = fileList.map(f => f.originFileObj || f)
              handleImageUpload(files)
            }}
            accept="image/*"
          >
            <div>
              <UploadOutlined />
              <div style={{ marginTop: 8 }}>上传</div>
            </div>
          </Upload>
        )}
        <Divider>图片列表</Divider>
        <Row gutter={12}>
          {currentImageList.map((url, index) => (
            <Col span={8} key={index} style={{ marginBottom: 12 }}>
              <div style={{ position: 'relative' }}>
                <Image
                  src={url}
                  width="100%"
                  height={120}
                  style={{ objectFit: 'cover' }}
                />
                {isEditable && (
                  <Button
                    type="text"
                    danger
                    size="small"
                    style={{ position: 'absolute', top: 4, right: 4 }}
                    onClick={() => handleDeleteImage(index)}
                  >
                    <DeleteOutlined />
                  </Button>
                )}
              </div>
            </Col>
          ))}
        </Row>
        {currentImageList.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 20 }}>暂无图片</div>
        )}
      </Drawer>
    </div>
  )
}
