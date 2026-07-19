import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Table, Tag, Button, Modal, Input, InputNumber, Select, Space, Row, Col,
  Card, Divider, Popconfirm, DatePicker, TimePicker, Tabs, Upload, Drawer, Image, Form,
} from 'antd'
import { useMessage } from '../../contexts/AppContext'
import {
  PlusOutlined, DeleteOutlined, UploadOutlined,
  PictureOutlined, SaveOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '../../utils/api'

// 报工单状态：0=开工，1=完工
const reportOrderStatusMap = {
  0: { label: '开工', color: 'processing' },
  1: { label: '完工', color: 'success' },
}

const exceptionCategories = [
  { label: '换型换线', value: '换型换线' },
  { label: '停机待料', value: '停机待料' },
  { label: '故障维修', value: '故障维修' },
  { label: '其它停机', value: '其它停机' },
]

const genTempId = () => 'tmp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)

export default function ProcessReporting() {
  // 顶部下拉框数据：仅开工状态(status=0)的报工单
  const [reportOrders, setReportOrders] = useState([])
  const [selectedReport, setSelectedReport] = useState(null)
  const [defectTypes, setDefectTypes] = useState([])
  const [devices, setDevices] = useState([])
  const [lineProcesses, setLineProcesses] = useState([])
  const [loading, setLoading] = useState(false)
  const [finishingReport, setFinishingReport] = useState(false)
  const [deletingReport, setDeletingReport] = useState(false)

  // 新增报工单 Modal
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [creatingReport, setCreatingReport] = useState(false)
  const [orders, setOrders] = useState([])
  const [lines, setLines] = useState([])
  const [createForm] = Form.useForm()

  const [selectedProcessId, setSelectedProcessId] = useState(null)
  const [activeTab, setActiveTab] = useState('production-defect')
  const [prevProcessQualifiedQty, setPrevProcessQualifiedQty] = useState(0)

  const [imageDrawerVisible, setImageDrawerVisible] = useState(false)
  const [imageDrawerTitle, setImageDrawerTitle] = useState('')
  const [currentImageList, setCurrentImageList] = useState([])
  const [imageUploadLoading, setImageUploadLoading] = useState(false)
  const [currentImageContext, setCurrentImageContext] = useState(null)

  const [prodDefectList, setProdDefectList] = useState([])
  const [scrapDefectList, setScrapDefectList] = useState([])
  const [exceptionList, setExceptionList] = useState([])
  const [manpowerList, setManpowerList] = useState([])
  const [materialList, setMaterialList] = useState([])
  const [materials, setMaterials] = useState([])

  const savingRef = useRef({})

  const [stats, setStats] = useState({
    inputQty: 0,
    outputQty: 0,
    defectMaterial: 0,
    defectProcess: 0,
    defectScrap: 0,
    exceptionHours: 0,
  })

  const message = useMessage()

  // 不良类型下拉选项（必须在 fetchAllData 之前定义，避免 TDZ 错误）
  const defectTypeOptions = useMemo(() => {
    const seen = new Set()
    return defectTypes
      .filter(d => d.category_name === '制程检验类型' && d.status === '启用' && d.display !== false && d.display !== 0)
      .filter(d => {
        if (seen.has(d.defect_id)) return false
        seen.add(d.defect_id)
        return true
      })
      .map(d => ({
        label: <span><span style={{ fontWeight: 600, color: '#212121' }}>{d.defect_code}</span><span style={{ marginLeft: 8, opacity: 0.65, color: '#757575' }}>{d.defect_name}</span></span>,
        value: d.defect_id,
        defect_code: d.defect_code,
        defect_type: d.defect_type,
        defect_name: d.defect_name,
        defect_unit: d.defect_unit || '',
        available_units: d.available_units || '',
      }))
  }, [defectTypes])

  const scrapTypeOptions = useMemo(() => {
    const seen = new Set()
    return defectTypes
      .filter(d => d.category_name === '制程检验类型' && d.defect_type === '检验报废' && d.status === '启用' && d.display !== false && d.display !== 0)
      .filter(d => {
        if (seen.has(d.defect_id)) return false
        seen.add(d.defect_id)
        return true
      })
      .map(d => ({
        label: <span><span style={{ fontWeight: 600, color: '#212121' }}>{d.defect_code}</span><span style={{ marginLeft: 8, opacity: 0.65, color: '#757575' }}>{d.defect_name}</span></span>,
        value: d.defect_id,
        defect_code: d.defect_code,
        defect_type: d.defect_type,
        defect_name: d.defect_name,
        defect_unit: d.defect_unit || '',
        available_units: d.available_units || '',
      }))
  }, [defectTypes])

  // 初始加载：不良类型、设备、订单、产线
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const [defectRes, devRes, ordersRes, linesRes] = await Promise.all([
          api.get('/basic/defect-types', { params: { page: 1, pageSize: 1000, status: '启用' } }),
          api.get('/basic/devices', { params: { page: 1, pageSize: 1000 } }),
          api.get('/production/orders', { params: { page: 1, pageSize: 1000, status: '下发' } }),
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

  // 获取报工单列表（仅开工状态 status=0）
  const fetchReportOrders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/production/report-orders', { params: { page: 1, pageSize: 1000, status: 0 } })
      setReportOrders(res.data || [])
    } catch (err) {
      message.error(err.message || '获取报工单列表失败')
      setReportOrders([])
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
      return
    }
    try {
      const res = await api.get(`/production/report-orders/${reportOrderId}/processes`)
      const procs = res.data || []
      const sorted = [...procs].sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
      setLineProcesses(sorted)
      if (sorted.length > 0) {
        setSelectedProcessId(sorted[0].process_id)
      } else {
        setSelectedProcessId(null)
      }
    } catch (err) {
      setLineProcesses([])
      setSelectedProcessId(null)
    }
  }, [])

  const materialOptions = useMemo(() => {
    return materials.map(m => ({
      label: <span><span style={{ fontWeight: 600, color: '#212121' }}>{m.material_code}</span><span style={{ marginLeft: 8, opacity: 0.65, color: '#757575' }}>{m.material_name}</span>{m.specification && <span style={{ marginLeft: 8, opacity: 0.45, color: '#9E9E9E' }}>{m.specification}</span>}</span>,
      value: m.material_id,
      material_code: m.material_code,
      material_name: m.material_name,
      specification: m.specification || '',
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

    setList(prev => prev.map(item => {
      if (String(item.id) !== String(recordId)) return item
      return { ...item, [field]: newImageList }
    }))
  }

  const fetchAllData = useCallback(async (reportOrderId) => {
    if (!reportOrderId || !selectedProcessId) return
    try {
      const [defectRes, scrapRes, exceptionRes, manpowerRes, materialRes] = await Promise.all([
        api.get('/production/process-defects', { params: { report_order_id: reportOrderId, process_id: selectedProcessId, page: 1, pageSize: 1000 } }),
        api.get('/production/scrap-defects', { params: { report_order_id: reportOrderId, page: 1, pageSize: 1000 } }),
        api.get('/production/process-exceptions', { params: { report_order_id: reportOrderId, page: 1, pageSize: 1000 } }),
        api.get('/production/manpower-records', { params: { report_order_id: reportOrderId, page: 1, pageSize: 1000 } }),
        api.get('/production/process-materials', { params: { report_order_id: reportOrderId, process_id: selectedProcessId, page: 1, pageSize: 1000 } }),
      ])
      setProdDefectList((defectRes.data || []).map(d => {
        // 历史数据可能缺少 defect_code/defect_type，从下拉选项补充
        let enriched = { ...d, id: d.defect_id, defect_images: parseImages(d.defect_images) }
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
      setScrapDefectList((scrapRes.data || []).map(d => {
        let enriched = { ...d, id: d.scrap_id, defect_images: parseImages(d.defect_images) }
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
      setExceptionList((exceptionRes.data || []).map(e => ({ ...e, id: e.exception_id, exception_images: parseImages(e.exception_images) })))
      setManpowerList((manpowerRes.data || []).map(m => ({ ...m, id: m.record_id })))
      setMaterialList((materialRes.data || []).map(m => {
        let enriched = { ...m, id: m.material_id, label_images: parseImages(m.label_images) }
        // 后端只记录 bas_material_id，从物料主数据补充 material_code/material_name/specification
        if (!enriched.material_code && (enriched.bas_material_id || enriched.material_id)) {
          const mat = materialOptions.find(opt => String(opt.value) === String(enriched.bas_material_id || enriched.material_id))
          if (mat) {
            if (!enriched.material_code) enriched.material_code = mat.material_code
            if (!enriched.material_name) enriched.material_name = mat.material_name
            if (!enriched.specification) enriched.specification = mat.specification
          }
        }
        return enriched
      }))
    } catch (err) {
      message.error(err.message || '获取数据失败')
    }
  }, [selectedProcessId, defectTypeOptions, scrapTypeOptions, materialOptions])

  // 获取整个报工单的统计数据（不按工序过滤）
  const fetchReportStats = useCallback(async (reportOrderId) => {
    if (!reportOrderId) return
    try {
      const [defectRes, scrapRes, exceptionRes, materialRes] = await Promise.all([
        api.get('/production/process-defects', { params: { report_order_id: reportOrderId, page: 1, pageSize: 1000 } }),
        api.get('/production/scrap-defects', { params: { report_order_id: reportOrderId, page: 1, pageSize: 1000 } }),
        api.get('/production/process-exceptions', { params: { report_order_id: reportOrderId, page: 1, pageSize: 1000 } }),
        api.get('/production/process-materials', { params: { report_order_id: reportOrderId, page: 1, pageSize: 1000 } }),
      ])
      const allDefects = defectRes.data || []
      const allScraps = scrapRes.data || []
      const allExceptions = exceptionRes.data || []
      const allMaterials = materialRes.data || []

      // 来料不良
      const defectMaterial = allDefects
        .filter(d => d.defect_type === '来料不良')
        .reduce((sum, d) => sum + (Number(d.quantity) || 0), 0)
      // 制程不良
      const defectProcess = allDefects
        .filter(d => d.defect_type === '制程不良')
        .reduce((sum, d) => sum + (Number(d.quantity) || 0), 0)
      // 检验报废
      const defectScrapTotal = allScraps.reduce((sum, d) => sum + (Number(d.quantity) || 0), 0)
      // 异常工时
      const exceptionHours = allExceptions.reduce((sum, e) => sum + (Number(e.duration) || 0), 0)
      // 投入数量 = 第一道工序的投入-退回
      let inputQty = 0
      if (lineProcesses.length > 0) {
        const firstProcessId = lineProcesses[0].process_id
        const firstProcessMaterials = allMaterials.filter(m => m.process_id === firstProcessId)
        const investQty = firstProcessMaterials.filter(m => m.material_type === '投入').reduce((sum, m) => sum + (Number(m.quantity) || 0), 0)
        const returnQty = firstProcessMaterials.filter(m => m.material_type === '退回').reduce((sum, m) => sum + (Number(m.quantity) || 0), 0)
        inputQty = investQty - returnQty
      }

      setStats({
        inputQty: Number(inputQty.toFixed(2)),
        outputQty: Number(selectedReport?.report_qty || 0),
        defectMaterial: Number(defectMaterial.toFixed(2)),
        defectProcess: Number(defectProcess.toFixed(2)),
        defectScrap: Number(defectScrapTotal.toFixed(2)),
        exceptionHours: Number(exceptionHours.toFixed(2)),
      })
    } catch {
      // 静默失败
    }
  }, [selectedReport, lineProcesses])

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
      setSelectedProcessId(null)
      setProdDefectList([])
      setScrapDefectList([])
      setExceptionList([])
      setManpowerList([])
      setMaterialList([])
      setStats({ inputQty: 0, outputQty: 0, defectMaterial: 0, defectProcess: 0, defectScrap: 0, exceptionHours: 0 })
      return
    }
    fetchReportProcesses(selectedReport.report_order_id)
    fetchMaterials()
  }, [selectedReport, fetchReportProcesses, fetchMaterials])

  // 报工单级别统计数据（当前报工单汇总，不按工序过滤）
  useEffect(() => {
    if (!selectedReport) {
      setStats({ inputQty: 0, outputQty: 0, defectMaterial: 0, defectProcess: 0, defectScrap: 0, exceptionHours: 0 })
      return
    }
    fetchReportStats(selectedReport.report_order_id)
  }, [selectedReport, lineProcesses, fetchReportStats])

  // 当前工序列表数据
  useEffect(() => {
    if (!selectedReport) {
      setProdDefectList([])
      setScrapDefectList([])
      setExceptionList([])
      setManpowerList([])
      setMaterialList([])
      return
    }
    fetchAllData(selectedReport.report_order_id)
  }, [selectedReport, selectedProcessId, fetchAllData])

  // 报工单状态：0=开工（可编辑），1=完工（只读）
  const isEditable = selectedReport?.status === 0

  // 打开新增报工 Modal
  const handleOpenCreateModal = () => {
    createForm.resetFields()
    createForm.setFieldsValue({ report_qty: 0, remarks: '' })
    setCreateModalOpen(true)
  }

  // 提交新增报工单
  const handleCreateReport = async () => {
    try {
      const values = await createForm.validateFields()
      setCreatingReport(true)
      const res = await api.post('/production/report-orders', {
        order_id: values.order_id,
        line_id: values.line_id,
        report_qty: values.report_qty,
        remarks: values.remarks || '',
      })
      message.success('报工单创建成功')
      setCreateModalOpen(false)
      await fetchReportOrders()
      if (res.data) {
        // 创建后端会自动从产线工序继承到 report_processes 子表
        setSelectedReport(res.data)
      }
    } catch (err) {
      if (err?.errorFields) return // 表单校验失败
      message.error(err.message || '创建报工单失败')
    } finally {
      setCreatingReport(false)
    }
  }

  // 完工报工单（开工 → 完工，单向）
  const handleFinishReport = async () => {
    if (!selectedReport) return
    try {
      setFinishingReport(true)
      const res = await api.post(`/production/report-orders/${selectedReport.report_order_id}/finish`)
      const updated = res.data || { ...selectedReport, status: 1, finish_time: new Date() }
      setSelectedReport(updated)
      // 完工后该报工单不再出现在下拉框（只显示开工状态）
      await fetchReportOrders()
      message.success(res.message || '已完工')
    } catch (err) {
      message.error(err.message || '操作失败')
    } finally {
      setFinishingReport(false)
    }
  }

  // 删除报工单（仅开工状态可删，后端会检查关联子记录）
  const handleDeleteReport = async () => {
    if (!selectedReport) return
    try {
      setDeletingReport(true)
      await api.delete(`/production/report-orders/${selectedReport.report_order_id}`)
      message.success('删除成功')
      setSelectedReport(null)
      setReportOrders(prev => prev.filter(r => r.report_order_id !== selectedReport.report_order_id))
    } catch (err) {
      message.error(err.message || '删除失败')
    } finally {
      setDeletingReport(false)
    }
  }

  const deviceOptions = useMemo(() => {
    return devices.map(d => ({ label: `${d.device_code} ${d.device_name}`, value: d.device_id }))
  }, [devices])

  // 新增报工 Modal 的订单下拉选项（仅"下发"状态可创建报工单）
  const orderOptions = useMemo(() => {
    return orders
      .filter(o => o.status === '下发')
      .map(o => ({
        label: `${o.order_no} (${o.material_name || '-'})`,
        value: o.order_id,
        order_no: o.order_no || '',
        material_code: o.material_code || '',
        material_name: o.material_name || '',
        specification: o.specification || '',
      }))
  }, [orders])

  // 新增报工 Modal 的产线下拉选项（仅运行中）
  const lineOptions = useMemo(() => {
    return lines
      .filter(l => l.status === '运行中')
      .map(l => ({ label: l.line_name, value: l.line_id }))
  }, [lines])

  const saveProdDefectItem = async (item) => {
    if (!selectedReport || !selectedProcessId) return
    try {
      if (item.defect_id) {
        await api.put(`/production/process-defects/${item.defect_id}`, {
          defect_name: item.defect_name,
          defect_type_id: item.defect_type_id,
          quantity: item.quantity,
          unit: item.unit,
          defect_images: item.defect_images,
        })
      } else {
        const defect = defectTypeOptions.find(d => d.value === item.defect_type_id)
        const res = await api.post('/production/process-defects', {
          report_order_id: selectedReport.report_order_id,
          process_id: selectedProcessId,
          defect_category: '制程不良',
          defect_type_id: item.defect_type_id,
          defect_name: defect?.defect_name || item.defect_name,
          quantity: item.quantity,
          unit: defect?.defect_unit || item.unit,
          defect_images: item.defect_images,
        })
        setProdDefectList(prev => prev.map(d =>
          d.id === item.id ? { ...res.data, id: res.data.defect_id, defect_images: parseImages(res.data.defect_images) } : d
        ))
      }
      fetchReportStats(selectedReport.report_order_id)
    } catch (err) {
      message.error(err.message || '保存失败')
    }
  }

  const handleProdDefectChange = (recordId, field, value) => {
    if (!isEditable) return
    setProdDefectList(prev => {
      const existingIndex = prev.findIndex(item => String(item.id) === String(recordId))
      let updatedItem = null
      if (existingIndex >= 0) {
        const newlist = prev.map(item => {
          if (String(item.id) !== String(recordId)) return item
          let updated = { ...item, [field]: value }
          if (field === 'defect_type_id' && value) {
            const defect = defectTypeOptions.find(d => String(d.value) === String(value))
            if (defect) {
              updated.defect_name = defect.defect_name
              updated.defect_code = defect.defect_code
              updated.defect_type = defect.defect_type
            }
          }
          updatedItem = updated
          return updated
        })
        return newlist
      } else {
        // 新增记录（空行情况）
        const newItem = {
          id: recordId,
          report_order_id: selectedReport?.report_order_id,
          process_id: selectedProcessId,
          defect_category: '制程不良',
          defect_type_id: null,
          defect_code: '',
          defect_type: '',
          defect_name: '',
          quantity: 0,
          unit: '',
          defect_images: [],
        }
        newItem[field] = value
        if (field === 'defect_type_id' && value) {
          const defect = defectTypeOptions.find(d => String(d.value) === String(value))
          if (defect) {
            newItem.defect_name = defect.defect_name
            newItem.defect_code = defect.defect_code
            newItem.defect_type = defect.defect_type
          }
        }
        return [...prev, newItem]
      }
    })
  }

  // 保存生产不良记录（手动触发）
  const handleSaveProdDefect = async (record) => {
    if (!record.defect_type_id) {
      message.warning('请选择不良编码')
      return
    }
    if (!record.quantity || record.quantity <= 0) {
      message.warning('请填写不良数量')
      return
    }
    await saveProdDefectItem(record)
    message.success('保存成功')
  }

  // 新增一条生产不良记录空行（手动触发）
  const handleAddProdDefectRow = () => {
    if (!selectedReport) {
      message.warning('请先选择报工单')
      return
    }
    setProdDefectList(prev => {
      const hasEmptyRow = prev.some(d => !d.defect_type_id)
      if (hasEmptyRow) return prev
      return [...prev, {
        id: genTempId(),
        report_order_id: selectedReport.report_order_id,
        process_id: selectedProcessId,
        defect_category: '制程不良',
        defect_type_id: null,
        defect_code: '',
        defect_type: '',
        defect_name: '',
        quantity: 0,
        unit: '',
        defect_images: [],
      }]
    })
  }

  const handleDeleteProdDefect = async (item) => {
    if (!item.defect_id) {
      setProdDefectList(prev => prev.filter(d => d.id !== item.id))
      return
    }
    try {
      await api.delete(`/production/process-defects/${item.defect_id}`)
      setProdDefectList(prev => prev.filter(d => d.id !== item.id))
      message.success('删除成功')
      if (selectedReport) fetchReportStats(selectedReport.report_order_id)
    } catch (err) {
      message.error(err.message || '删除失败')
    }
  }

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

  const prodDefectColumns = [
    {
      title: '记录主键', dataIndex: 'defect_id', key: 'defect_id', width: 100,
      render: (val) => val ?? '-',
    },
    {
      title: '不良编码', dataIndex: 'defect_code', key: 'defect_code', width: 120,
      render: (_, record) => isEditable ? (
        <Select
          placeholder="请选择不良编码"
          value={record.defect_type_id || undefined}
          onChange={(val) => {
            handleProdDefectChange(record.id, 'defect_type_id', val)
          }}
          options={getFilteredProdDefectOptions(record.id)}
          style={{ width: '100%' }}
          showSearch
          popupMatchSelectWidth={false}
          popupPlacement="bottomLeft"
          popupClassName="mes-select-dropdown"
          optionLabelRender={(option) => {
            const opt = option as any
            return opt.defect_code
          }}
          filterOption={(input, option) => {
            const code = (option?.defect_code || '').toLowerCase()
            const name = (option?.defect_name || '').toLowerCase()
            const inputLower = input.toLowerCase()
            return code.includes(inputLower) || name.includes(inputLower)
          }}
          size="small"
        />
      ) : record.defect_code || '-',
    },
    {
      title: '不良类型', dataIndex: 'defect_type', key: 'defect_type', width: 120,
      render: (val) => val || '-',
    },
    {
      title: '不良项目', dataIndex: 'defect_name', key: 'defect_name', width: 150,
      render: (val) => val || '-',
    },
    {
      title: '不良数量', dataIndex: 'quantity', key: 'quantity', width: 100,
      render: (val, record) => isEditable ? (
        <InputNumber
          min={1}
          step={1}
          precision={0}
          value={val}
          onChange={(v) => handleProdDefectChange(record.id, 'quantity', v || 0)}
          style={{ width: '100%' }}
          size="small"
          controls={false}
        />
      ) : val,
    },
    {
      title: '单位', dataIndex: 'unit', key: 'unit', width: 100,
      render: (_, record) => isEditable ? (
        <Select
          placeholder="请选择单位"
          value={record.unit || undefined}
          onChange={(val) => handleProdDefectChange(record.id, 'unit', val)}
          options={getUnitOptions(record.defect_type_id)}
          style={{ width: '100%' }}
          size="small"
          disabled={!record.defect_type_id}
          popupClassName="mes-select-dropdown"
        />
      ) : record.unit || '-',
    },
    {
      title: '不良图片', dataIndex: 'defect_images', key: 'defect_images', width: 120,
      render: (val, record) => (
        <Button type="link" size="small" icon={<PictureOutlined />}
          onClick={() => openImageDrawer('不良图片', val || [], { listType: 'prodDefect', recordId: record.id, field: 'defect_images' })}>
          {(val || []).length} 张
        </Button>
      ),
    },
    {
      title: '操作', key: 'action', width: 120,
      render: (_, record) => isEditable ? (
        <Space size="small">
          <Button type="link" size="small" icon={<SaveOutlined />} onClick={() => handleSaveProdDefect(record)}>保存</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDeleteProdDefect(record)}>
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ) : null,
    },
  ]

  const saveScrapDefectItem = async (item) => {
    if (!selectedReport) return
    try {
      if (item.scrap_id) {
        await api.put(`/production/scrap-defects/${item.scrap_id}`, {
          defect_type_id: item.defect_type_id,
          quantity: item.quantity,
          unit: item.unit,
          defect_images: item.defect_images,
        })
      } else {
        const defect = scrapTypeOptions.find(d => d.value === item.defect_type_id)
        const res = await api.post('/production/scrap-defects', {
          report_order_id: selectedReport.report_order_id,
          defect_type_id: item.defect_type_id,
          quantity: item.quantity,
          unit: defect?.defect_unit || item.unit,
          defect_images: item.defect_images,
        })
        setScrapDefectList(prev => prev.map(d =>
          d.id === item.id ? { ...res.data, id: res.data.scrap_id, defect_images: parseImages(res.data.defect_images) } : d
        ))
      }
      fetchReportStats(selectedReport.report_order_id)
    } catch (err) {
      message.error(err.message || '保存失败')
    }
  }

  const handleScrapDefectChange = (recordId, field, value) => {
    if (!isEditable) return
    setScrapDefectList(prev => {
      const existingIndex = prev.findIndex(item => String(item.id) === String(recordId))
      let updatedItem = null
      if (existingIndex >= 0) {
        const newlist = prev.map(item => {
          if (String(item.id) !== String(recordId)) return item
          let updated = { ...item, [field]: value }
          if (field === 'defect_type_id' && value) {
            const defect = scrapTypeOptions.find(d => String(d.value) === String(value))
            if (defect) {
              updated.defect_name = defect.defect_name
              updated.defect_code = defect.defect_code
              updated.defect_type = defect.defect_type
            }
          }
          updatedItem = updated
          return updated
        })
        return newlist
      } else {
        // 新增记录（空行情况）
        const newItem = {
          id: recordId,
          report_order_id: selectedReport?.report_order_id,
          defect_category: '检验报废',
          defect_type_id: null,
          defect_code: '',
          defect_type: '',
          defect_name: '',
          quantity: 0,
          unit: '',
          defect_images: [],
        }
        newItem[field] = value
        if (field === 'defect_type_id' && value) {
          const defect = scrapTypeOptions.find(d => String(d.value) === String(value))
          if (defect) {
            newItem.defect_name = defect.defect_name
            newItem.defect_code = defect.defect_code
            newItem.defect_type = defect.defect_type
          }
        }
        return [...prev, newItem]
      }
    })
  }

  // 保存检验报废记录（手动触发）
  const handleSaveScrapDefect = async (record) => {
    if (!record.defect_type_id) {
      message.warning('请选择不良编码')
      return
    }
    if (!record.quantity || record.quantity <= 0) {
      message.warning('请填写不良数量')
      return
    }
    await saveScrapDefectItem(record)
    message.success('保存成功')
  }

  // 新增一条检验报废记录空行（手动触发）
  const handleAddScrapDefectRow = () => {
    if (!selectedReport) {
      message.warning('请先选择报工单')
      return
    }
    setScrapDefectList(prev => {
      const hasEmptyRow = prev.some(d => !d.defect_type_id)
      if (hasEmptyRow) return prev
      return [...prev, {
        id: genTempId(),
        report_order_id: selectedReport.report_order_id,
        defect_category: '检验报废',
        defect_type_id: null,
        defect_code: '',
        defect_type: '',
        defect_name: '',
        quantity: 0,
        unit: '',
        defect_images: [],
      }]
    })
  }

  const handleDeleteScrapDefect = async (item) => {
    if (!item.scrap_id) {
      setScrapDefectList(prev => prev.filter(d => d.id !== item.id))
      return
    }
    try {
      await api.delete(`/production/scrap-defects/${item.scrap_id}`)
      setScrapDefectList(prev => prev.filter(d => d.id !== item.id))
      message.success('删除成功')
      if (selectedReport) fetchReportStats(selectedReport.report_order_id)
    } catch (err) {
      message.error(err.message || '删除失败')
    }
  }

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

  const scrapDefectColumns = [
    {
      title: '记录主键', dataIndex: 'scrap_id', key: 'scrap_id', width: 100,
      render: (val) => val ?? '-',
    },
    {
      title: '不良编码', dataIndex: 'defect_code', key: 'defect_code', width: 120,
      render: (_, record) => isEditable ? (
        <Select
          placeholder="请选择不良编码"
          value={record.defect_type_id || undefined}
          onChange={(val) => {
            handleScrapDefectChange(record.id, 'defect_type_id', val)
          }}
          options={getFilteredScrapDefectOptions(record.id)}
          style={{ width: '100%' }}
          showSearch
          popupMatchSelectWidth={false}
          popupPlacement="bottomLeft"
          popupClassName="mes-select-dropdown"
          optionLabelRender={(option) => {
            const opt = option as any
            return opt.defect_code
          }}
          filterOption={(input, option) => {
            const code = (option?.defect_code || '').toLowerCase()
            const name = (option?.defect_name || '').toLowerCase()
            const inputLower = input.toLowerCase()
            return code.includes(inputLower) || name.includes(inputLower)
          }}
          size="small"
        />
      ) : record.defect_code || '-',
    },
    {
      title: '不良类型', dataIndex: 'defect_type', key: 'defect_type', width: 120,
      render: (val) => val || '-',
    },
    {
      title: '不良项目', dataIndex: 'defect_name', key: 'defect_name', width: 150,
      render: (val) => val || '-',
    },
    {
      title: '不良数量', dataIndex: 'quantity', key: 'quantity', width: 100,
      render: (val, record) => isEditable ? (
        <InputNumber
          min={1}
          step={1}
          precision={0}
          value={val}
          onChange={(v) => handleScrapDefectChange(record.id, 'quantity', v || 0)}
          style={{ width: '100%' }}
          size="small"
          controls={false}
        />
      ) : val,
    },
    {
      title: '单位', dataIndex: 'unit', key: 'unit', width: 100,
      render: (_, record) => isEditable ? (
        <Select
          placeholder="请选择单位"
          value={record.unit || undefined}
          onChange={(val) => handleScrapDefectChange(record.id, 'unit', val)}
          options={getScrapUnitOptions(record.defect_type_id)}
          style={{ width: '100%' }}
          size="small"
          disabled={!record.defect_type_id}
          popupClassName="mes-select-dropdown"
        />
      ) : record.unit || '-',
    },
    {
      title: '不良图片', dataIndex: 'defect_images', key: 'defect_images', width: 120,
      render: (val, record) => (
        <Button type="link" size="small" icon={<PictureOutlined />}
          onClick={() => openImageDrawer('不良图片', val || [], { listType: 'scrapDefect', recordId: record.id, field: 'defect_images' })}>
          {(val || []).length} 张
        </Button>
      ),
    },
    {
      title: '操作', key: 'action', width: 120,
      render: (_, record) => isEditable ? (
        <Space size="small">
          <Button type="link" size="small" icon={<SaveOutlined />} onClick={() => handleSaveScrapDefect(record)}>保存</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDeleteScrapDefect(record)}>
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ) : null,
    },
  ]

  const saveMaterialItem = async (item) => {
    if (!selectedReport || !selectedProcessId) return
    try {
      if (String(item.id).startsWith('tmp_') === false) {
        await api.put(`/production/process-materials/${item.id}`, {
          material_type: item.material_type,
          bas_material_id: item.bas_material_id,
          material_batch: item.material_batch,
          package_no: item.package_no,
          quantity: item.quantity,
          label_images: item.label_images,
        })
      } else {
        const res = await api.post('/production/process-materials', {
          report_order_id: selectedReport.report_order_id,
          process_id: selectedProcessId,
          material_type: item.material_type || '投入',
          bas_material_id: item.bas_material_id,
          material_batch: item.material_batch,
          package_no: item.package_no,
          quantity: item.quantity,
          label_images: item.label_images,
        })
        setMaterialList(prev => prev.map(m =>
          m.id === item.id ? { ...res.data, id: res.data.material_id, label_images: parseImages(res.data.label_images) } : m
        ))
      }
      fetchReportStats(selectedReport.report_order_id)
    } catch (err) {
      message.error(err.message || '保存失败')
    }
  }

  const handleMaterialChange = (recordId, field, value) => {
    if (!isEditable) return
    setMaterialList(prev => {
      const existingIndex = prev.findIndex(item => String(item.id) === String(recordId))
      let updatedItem = null
      if (existingIndex >= 0) {
        const newlist = prev.map(item => {
          if (String(item.id) !== String(recordId)) return item
          let updated = { ...item, [field]: value }
          if (field === 'material_id' && value) {
            const material = materialOptions.find(m => String(m.value) === String(value))
            if (material) {
              updated.material_code = material.material_code
              updated.material_name = material.material_name
              updated.specification = material.specification
              updated.bas_material_id = value
            }
          }
          updatedItem = updated
          return updated
        })
        // 自动保存：有料号且有数量时保存
        if (updatedItem && updatedItem.material_code && updatedItem.quantity > 0) {
          saveMaterialItem(updatedItem)
        }
        return newlist
      } else {
        // 新增记录（空行情况）
        const newItem = {
          id: recordId,
          report_order_id: selectedReport?.report_order_id,
          process_id: selectedProcessId,
          material_type: '投入',
          material_id: null,
          bas_material_id: null,
          material_code: '',
          material_name: '',
          specification: '',
          material_batch: '',
          package_no: '',
          quantity: 0,
          label_images: [],
        }
        newItem[field] = value
        if (field === 'material_id' && value) {
          const material = materialOptions.find(m => String(m.value) === String(value))
          if (material) {
            newItem.material_code = material.material_code
            newItem.material_name = material.material_name
            newItem.specification = material.specification
            newItem.bas_material_id = value
          }
        }
        // 自动保存：有料号且有数量时保存
        if (newItem.material_code && newItem.quantity > 0) {
          saveMaterialItem(newItem)
        }
        return [...prev, newItem]
      }
    })
  }

  const handleDeleteMaterial = async (item) => {
    if (!item.material_id || String(item.material_id).startsWith('tmp_')) {
      setMaterialList(prev => prev.filter(m => m.id !== item.id))
      return
    }
    try {
      await api.delete(`/production/process-materials/${item.material_id}`)
      setMaterialList(prev => prev.filter(m => m.id !== item.id))
      message.success('删除成功')
      if (selectedReport) fetchReportStats(selectedReport.report_order_id)
    } catch (err) {
      message.error(err.message || '删除失败')
    }
  }

  const materialDisplayList = useMemo(() => {
    if (!isEditable || !selectedReport) return materialList
    const hasEmptyRow = materialList.some(m => !m.material_id)
    if (hasEmptyRow) return materialList
    const emptyRow = {
      id: genTempId(),
      report_order_id: selectedReport.report_order_id,
      process_id: selectedProcessId,
      material_type: '投入',
      material_id: null,
      bas_material_id: null,
      material_code: '',
      material_name: '',
      specification: '',
      material_batch: '',
      package_no: '',
      quantity: 0,
      label_images: [],
    }
    return [...materialList, emptyRow]
  }, [materialList, isEditable, selectedReport, selectedProcessId])

  const isFirstProcess = useMemo(() => {
    if (!lineProcesses.length || !selectedProcessId) return false
    return lineProcesses[0].process_id === selectedProcessId
  }, [lineProcesses, selectedProcessId])

  // 获取上一道工序的合格数
  useEffect(() => {
    if (!selectedReport || !selectedProcessId || !lineProcesses.length || isFirstProcess) {
      setPrevProcessQualifiedQty(0)
      return
    }
    const currentIndex = lineProcesses.findIndex(p => p.process_id === selectedProcessId)
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
  }, [selectedReport, selectedProcessId, lineProcesses, isFirstProcess])

  // 当前工序统计数据
  const processStats = useMemo(() => {
    // 制程不良
    const processDefectQty = prodDefectList
      .filter(d => d.defect_type === '制程不良')
      .reduce((sum, d) => sum + (Number(d.quantity) || 0), 0)
    // 来料不良
    const materialDefectQty = prodDefectList
      .filter(d => d.defect_type === '来料不良')
      .reduce((sum, d) => sum + (Number(d.quantity) || 0), 0)
    // 投入数量
    let inputQty = 0
    if (isFirstProcess) {
      const investQty = materialList.filter(m => m.material_type === '投入').reduce((sum, m) => sum + (Number(m.quantity) || 0), 0)
      const returnQty = materialList.filter(m => m.material_type === '退回').reduce((sum, m) => sum + (Number(m.quantity) || 0), 0)
      inputQty = investQty - returnQty
    } else {
      inputQty = prevProcessQualifiedQty
    }
    // 合格数 = 投入 - 制程不良 - 来料不良
    const qualifiedQty = inputQty - processDefectQty - materialDefectQty
    return {
      inputQty: Number(inputQty.toFixed(2)),
      qualifiedQty: Number((qualifiedQty > 0 ? qualifiedQty : 0).toFixed(2)),
      processDefectQty: Number(processDefectQty.toFixed(2)),
      materialDefectQty: Number(materialDefectQty.toFixed(2)),
    }
  }, [prodDefectList, materialList, isFirstProcess, prevProcessQualifiedQty])

  const getFilteredMaterialOptions = (record) => {
    if (!isFirstProcess) return materialOptions
    if (record.material_type === '退回') {
      const enteredMaterials = materialList
        .filter(m => m.material_id && m.material_code && m.material_batch && m.package_no)
        .map(m => String(m.material_id))
      return materialOptions.filter(m => enteredMaterials.includes(String(m.value)))
    }
    return materialOptions.filter(m =>
      m.material_code.startsWith('Y2') || m.material_code.startsWith('T1')
    )
  }

  const materialColumns = [
    {
      title: '料品主键', dataIndex: 'material_id', key: 'material_id', width: 100,
      render: (val) => val ?? '-',
    },
    {
      title: '物料类型', dataIndex: 'material_type', key: 'material_type', width: 100,
      render: (val, record) => isEditable ? (
        <Select
          placeholder="请选择"
          value={val || undefined}
          onChange={(v) => handleMaterialChange(record.id, 'material_type', v)}
          options={[
            { label: '投入', value: '投入' },
            { label: '退回', value: '退回' },
          ]}
          style={{ width: '100%' }}
          size="small"
          popupClassName="mes-select-dropdown"
        />
      ) : val || '-',
    },
    {
      title: '料号', dataIndex: 'material_code', key: 'material_code', width: 120,
      render: (_, record) => isEditable ? (
        <Select
          placeholder="请选择料号"
          value={record.material_id || undefined}
          onChange={(val) => handleMaterialChange(record.id, 'material_id', val)}
          options={getFilteredMaterialOptions(record)}
          style={{ width: '100%' }}
          showSearch
          popupMatchSelectWidth={false}
          popupPlacement="bottomLeft"
          popupClassName="mes-select-dropdown"
          optionLabelRender={(option) => {
            const opt = option as any
            return opt.material_code
          }}
          filterOption={(input, option) => {
            const code = (option?.material_code || '').toLowerCase()
            const name = (option?.material_name || '').toLowerCase()
            const spec = (option?.specification || '').toLowerCase()
            const inputLower = input.toLowerCase()
            return code.includes(inputLower) || name.includes(inputLower) || spec.includes(inputLower)
          }}
          size="small"
        />
      ) : record.material_code || (materialOptions.find(m => String(m.value) === String(record.bas_material_id || record.material_id))?.material_code) || '-',
    },
    {
      title: '料品名称', dataIndex: 'material_name', key: 'material_name', width: 150,
      render: (val, record) => {
        if (val) return val
        // 从关联数据读取
        const mat = materialOptions.find(m => String(m.value) === String(record.bas_material_id || record.material_id))
        return mat?.material_name || '-'
      },
    },
    {
      title: '规格', dataIndex: 'specification', key: 'specification', width: 150,
      render: (val, record) => {
        if (val) return val
        // 从关联数据读取
        const mat = materialOptions.find(m => String(m.value) === String(record.bas_material_id || record.material_id))
        return mat?.specification || '-'
      },
    },
    {
      title: '批号', dataIndex: 'material_batch', key: 'material_batch', width: 120,
      render: (val, record) => isEditable ? (
        <Input
          placeholder="批号"
          value={val}
          onChange={(e) => handleMaterialChange(record.id, 'material_batch', e.target.value)}
          size="small"
        />
      ) : val || '-',
    },
    {
      title: '包号', dataIndex: 'package_no', key: 'package_no', width: 120,
      render: (val, record) => isEditable ? (
        <Input
          placeholder="包号"
          value={val}
          onChange={(e) => handleMaterialChange(record.id, 'package_no', e.target.value)}
          size="small"
        />
      ) : val || '-',
    },
    {
      title: '数量', dataIndex: 'quantity', key: 'quantity', width: 100,
      render: (val, record) => isEditable ? (
        <InputNumber
          min={1}
          step={1}
          precision={0}
          value={val}
          onChange={(v) => handleMaterialChange(record.id, 'quantity', v || 0)}
          style={{ width: '100%' }}
          size="small"
          controls={false}
        />
      ) : val,
    },
    {
      title: '标签图片', dataIndex: 'label_images', key: 'label_images', width: 120,
      render: (val, record) => (
        <Button type="link" size="small" icon={<PictureOutlined />}
          onClick={() => openImageDrawer('标签图片', val || [], { listType: 'material', recordId: record.id, field: 'label_images' })}>
          {(val || []).length} 张
        </Button>
      ),
    },
    {
      title: '操作', key: 'action', width: 80,
      render: (_, record) => isEditable ? (
        <Popconfirm title="确认删除？" onConfirm={() => handleDeleteMaterial(record)}>
          <Button type="link" size="small" danger>删除</Button>
        </Popconfirm>
      ) : null,
    },
  ]

  const saveExceptionItem = async (item) => {
    if (!selectedReport) return
    try {
      if (item.exception_id) {
        await api.put(`/production/process-exceptions/${item.exception_id}`, {
          exception_type: item.exception_type,
          device_id: item.device_id,
          stop_type: item.stop_type,
          start_time: item.start_time,
          end_time: item.end_time,
          description: item.description,
          exception_images: item.exception_images,
        })
      } else {
        const res = await api.post('/production/process-exceptions', {
          report_order_id: selectedReport.report_order_id,
          exception_type: item.exception_type,
          device_id: item.device_id,
          stop_type: item.stop_type,
          start_time: item.start_time,
          end_time: item.end_time,
          description: item.description,
          exception_images: item.exception_images,
        })
        setExceptionList(prev => prev.map(e =>
          e.id === item.id ? { ...res.data, id: res.data.exception_id, exception_images: parseImages(res.data.exception_images) } : e
        ))
      }
      fetchReportStats(selectedReport.report_order_id)
    } catch (err) {
      message.error(err.message || '保存失败')
    }
  }

  const handleExceptionChange = (recordId, field, value) => {
    if (!isEditable) return
    setExceptionList(prev => {
      const existingIndex = prev.findIndex(item => String(item.id) === String(recordId))
      let updatedItem = null
      if (existingIndex >= 0) {
        const newList = prev.map(item => {
          if (String(item.id) !== String(recordId)) return item
          const updated = { ...item, [field]: value }
          if (field === 'start_time' || field === 'end_time') {
            if (updated.start_time && updated.end_time) {
              const start = new Date(updated.start_time).getTime()
              const end = new Date(updated.end_time).getTime()
              updated.duration = Number(((end - start) / 3600000).toFixed(2))
            }
          }
          updatedItem = updated
          return updated
        })
        // 自动保存：有异常类型且有开始和结束时间时保存
        if (updatedItem && updatedItem.exception_type && updatedItem.start_time && updatedItem.end_time) {
          saveExceptionItem(updatedItem)
        }
        return newList
      } else {
        // 新增记录（空行情况）
        const newItem = {
          id: recordId,
          report_order_id: selectedReport?.report_order_id,
          exception_type: field === 'exception_type' ? value : '',
          device_id: field === 'device_id' ? value : null,
          device_name: '',
          stop_type: '',
          start_time: field === 'start_time' ? value : null,
          end_time: field === 'end_time' ? value : null,
          duration: 0,
          description: '',
          exception_images: [],
        }
        newItem[field] = value
        updatedItem = newItem
        // 自动保存：有异常类型且有开始和结束时间时保存
        if (updatedItem.exception_type && updatedItem.start_time && updatedItem.end_time) {
          saveExceptionItem(updatedItem)
        }
        return [...prev, newItem]
      }
    })
  }

  const handleDeleteException = async (item) => {
    if (!item.exception_id) {
      setExceptionList(prev => prev.filter(e => e.id !== item.id))
      return
    }
    try {
      await api.delete(`/production/process-exceptions/${item.exception_id}`)
      setExceptionList(prev => prev.filter(e => e.id !== item.id))
      message.success('删除成功')
      if (selectedReport) fetchReportStats(selectedReport.report_order_id)
    } catch (err) {
      message.error(err.message || '删除失败')
    }
  }

  const exceptionDisplayList = useMemo(() => {
    if (!isEditable || !selectedReport) return exceptionList
    const hasEmptyRow = exceptionList.some(e => !e.exception_id)
    if (hasEmptyRow) return exceptionList
    const emptyRow = {
      id: genTempId(),
      report_order_id: selectedReport.report_order_id,
      exception_type: '',
      device_id: null,
      device_name: '',
      stop_type: '',
      start_time: null,
      end_time: null,
      duration: 0,
      description: '',
      exception_images: [],
    }
    return [...exceptionList, emptyRow]
  }, [exceptionList, isEditable, selectedReport])

  const exceptionColumns = [
    {
      title: '异常类型', dataIndex: 'exception_type', key: 'exception_type', width: 120,
      render: (val, record) => isEditable ? (
        <Select
          placeholder="请选择"
          value={val || undefined}
          onChange={(v) => handleExceptionChange(record.id, 'exception_type', v)}
          options={exceptionCategories}
          style={{ width: '100%' }}
          size="small"
          popupClassName="mes-select-dropdown"
        />
      ) : val || '-',
    },
    {
      title: '设备', dataIndex: 'device_name', key: 'device_name', width: 150,
      render: (_, record) => isEditable ? (
        <Select
          placeholder="请选择设备"
          value={record.device_id || undefined}
          onChange={(v) => handleExceptionChange(record.id, 'device_id', v)}
          options={deviceOptions}
          style={{ width: '100%' }}
          showSearch
          optionFilterProp="label"
          size="small"
          allowClear
          popupClassName="mes-select-dropdown"
        />
      ) : record.device_name || '-',
    },
    {
      title: '开始时间', dataIndex: 'start_time', key: 'start_time', width: 120,
      render: (val, record) => isEditable ? (
        <TimePicker
          value={val ? dayjs(val) : null}
          onChange={(d) => {
            if (d) {
              const today = dayjs().format('YYYY-MM-DD')
              const timeStr = d.format('HH:mm:ss')
              const newTime = `${today}T${timeStr}`
              // 开始时间不能早于报工时间
              const reportStart = selectedReport?.report_time
              if (reportStart && dayjs(newTime).isBefore(dayjs(reportStart))) {
                message.warning('开始时间不能早于报工时间')
                return
              }
              handleExceptionChange(record.id, 'start_time', newTime)
            } else {
              handleExceptionChange(record.id, 'start_time', null)
            }
          }}
          format="HH:mm"
          style={{ width: '100%' }}
          size="small"
          minuteStep={5}
        />
      ) : val ? dayjs(val).format('HH:mm') : '-',
    },
    {
      title: '结束时间', dataIndex: 'end_time', key: 'end_time', width: 120,
      render: (val, record) => isEditable ? (
        <TimePicker
          value={val ? dayjs(val) : null}
          onChange={(d) => {
            if (d) {
              const today = dayjs().format('YYYY-MM-DD')
              const timeStr = d.format('HH:mm:ss')
              const newTime = `${today}T${timeStr}`
              // 结束时间不能小于开始时间
              const startTime = record.start_time
              if (startTime && dayjs(newTime).isBefore(dayjs(startTime))) {
                message.warning('结束时间不能小于开始时间')
                return
              }
              handleExceptionChange(record.id, 'end_time', newTime)
            } else {
              handleExceptionChange(record.id, 'end_time', null)
            }
          }}
          format="HH:mm"
          style={{ width: '100%' }}
          size="small"
          minuteStep={5}
        />
      ) : val ? dayjs(val).format('HH:mm') : '-',
    },
    { title: '时长(小时)', dataIndex: 'duration', key: 'duration', width: 100 },
    {
      title: '图片', dataIndex: 'exception_images', key: 'exception_images', width: 100,
      render: (val, record) => (
        <Button type="link" size="small" icon={<PictureOutlined />}
          onClick={() => openImageDrawer('异常图片', val || [], { listType: 'exception', recordId: record.id, field: 'exception_images' })}>
          {(val || []).length} 张
        </Button>
      ),
    },
    {
      title: '操作', key: 'action', width: 80,
      render: (_, record) => isEditable ? (
        <Popconfirm title="确认删除？" onConfirm={() => handleDeleteException(record)}>
          <Button type="link" size="small" danger>删除</Button>
        </Popconfirm>
      ) : null,
    },
  ]

  const saveManpowerItem = async (item) => {
    if (!selectedReport) return
    try {
      if (item.record_id) {
        await api.put(`/production/manpower-records/${item.record_id}`, {
          record_date: item.record_date,
          shift: item.shift,
          start_time: item.start_time,
          end_time: item.end_time,
          skilled_count: item.skilled_count,
          general_count: item.general_count,
          labor_count: item.labor_count,
          other_count: item.other_count,
          remarks: item.remarks,
        })
      } else {
        const res = await api.post('/production/manpower-records', {
          report_order_id: selectedReport.report_order_id,
          record_date: item.record_date,
          shift: item.shift,
          start_time: item.start_time,
          end_time: item.end_time,
          skilled_count: item.skilled_count,
          general_count: item.general_count,
          labor_count: item.labor_count,
          other_count: item.other_count,
          remarks: item.remarks,
        })
        setManpowerList(prev => prev.map(m =>
          m.id === item.id ? { ...res.data, id: res.data.record_id } : m
        ))
      }
    } catch (err) {
      message.error(err.message || '保存失败')
    }
  }

  const handleManpowerChange = (recordId, field, value) => {
    if (!isEditable) return
    setManpowerList(prev => {
      const existingIndex = prev.findIndex(item => String(item.id) === String(recordId))
      let updatedItem = null
      if (existingIndex >= 0) {
        const newList = prev.map(item => {
          if (String(item.id) !== String(recordId)) return item
          const updated = { ...item, [field]: value }
          const sk = Number(updated.skilled_count) || 0
          const gn = Number(updated.general_count) || 0
          const lb = Number(updated.labor_count) || 0
          const ot = Number(updated.other_count) || 0
          updated.total_people = sk + gn + lb + ot
          if (updated.start_time && updated.end_time) {
            const start = new Date(updated.start_time).getTime()
            const end = new Date(updated.end_time).getTime()
            const hours = ((end - start) / 3600000)
            updated.hours = hours > 0 ? Number(hours.toFixed(2)) : 0
            updated.man_hours = Number((updated.hours * updated.total_people).toFixed(2))
          }
          updatedItem = updated
          return updated
        })
        // 自动保存：有开始和结束时间且有总人数时保存
        if (updatedItem && updatedItem.start_time && updatedItem.end_time && updatedItem.total_people > 0) {
          saveManpowerItem(updatedItem)
        }
        return newList
      } else {
        // 新增记录（空行情况）
        const newItem = {
          id: recordId,
          report_order_id: selectedReport?.report_order_id,
          record_date: dayjs().format('YYYY-MM-DD'),
          shift: '白班',
          start_time: selectedReport?.report_time || null,
          end_time: null,
          hours: 0,
          skilled_count: 0,
          general_count: 0,
          labor_count: 0,
          other_count: 0,
          total_people: 0,
          man_hours: 0,
          remarks: '',
        }
        newItem[field] = value
        updatedItem = newItem
        // 自动保存：有开始和结束时间且有总人数时保存
        if (updatedItem.start_time && updatedItem.end_time && updatedItem.total_people > 0) {
          saveManpowerItem(updatedItem)
        }
        return [...prev, newItem]
      }
    })
  }

  const handleDeleteManpower = async (item) => {
    if (!item.record_id) {
      setManpowerList(prev => prev.filter(m => m.id !== item.id))
      return
    }
    try {
      await api.delete(`/production/manpower-records/${item.record_id}`)
      setManpowerList(prev => prev.filter(m => m.id !== item.id))
      message.success('删除成功')
    } catch (err) {
      message.error(err.message || '删除失败')
    }
  }

  const manpowerDisplayList = useMemo(() => {
    if (!isEditable || !selectedReport) return manpowerList
    const hasEmptyRow = manpowerList.some(m => !m.record_id)
    if (hasEmptyRow) return manpowerList
    const emptyRow = {
      id: genTempId(),
      report_order_id: selectedReport.report_order_id,
      record_date: dayjs().format('YYYY-MM-DD'),
      shift: '白班',
      start_time: null,
      end_time: null,
      hours: 0,
      skilled_count: 0,
      general_count: 0,
      labor_count: 0,
      other_count: 0,
      total_people: 0,
      man_hours: 0,
      remarks: '',
    }
    return [...manpowerList, emptyRow]
  }, [manpowerList, isEditable, selectedReport])

  const manpowerColumns = [
    {
      title: '日期', dataIndex: 'record_date', key: 'record_date', width: 130,
      render: (val) => val || '-',
    },
    {
      title: '班次', dataIndex: 'shift', key: 'shift', width: 100,
      render: (val) => isEditable ? (
        <Select
          value={val || '白班'}
          disabled
          options={[
            { label: '白班', value: '白班' },
            { label: '夜班', value: '夜班' },
          ]}
          style={{ width: '100%' }}
          size="small"
          popupClassName="mes-select-dropdown"
        />
      ) : val || '-',
    },
    {
      title: '开始时间', dataIndex: 'start_time', key: 'start_time', width: 120,
      render: (val, record) => isEditable ? (
        <TimePicker
          value={val ? dayjs(val) : null}
          onChange={(d) => {
            if (d) {
              const today = dayjs().format('YYYY-MM-DD')
              const timeStr = d.format('HH:mm:ss')
              const newTime = `${today}T${timeStr}`
              // 开始时间不能早于报工时间
              const reportStart = selectedReport?.report_time
              if (reportStart && dayjs(newTime).isBefore(dayjs(reportStart))) {
                message.warning('开始时间不能早于报工时间')
                return
              }
              handleManpowerChange(record.id, 'start_time', newTime)
            } else {
              handleManpowerChange(record.id, 'start_time', null)
            }
          }}
          format="HH:mm"
          style={{ width: '100%' }}
          size="small"
          minuteStep={5}
        />
      ) : val ? dayjs(val).format('HH:mm') : '-',
    },
    {
      title: '结束时间', dataIndex: 'end_time', key: 'end_time', width: 120,
      render: (val, record) => isEditable ? (
        <TimePicker
          value={val ? dayjs(val) : null}
          onChange={(d) => {
            if (d) {
              const today = dayjs().format('YYYY-MM-DD')
              const timeStr = d.format('HH:mm:ss')
              const newTime = `${today}T${timeStr}`
              // 结束时间不能小于开始时间
              const startTime = record.start_time
              if (startTime && dayjs(newTime).isBefore(dayjs(startTime))) {
                message.warning('结束时间不能小于开始时间')
                return
              }
              handleManpowerChange(record.id, 'end_time', newTime)
            } else {
              handleManpowerChange(record.id, 'end_time', null)
            }
          }}
          format="HH:mm"
          style={{ width: '100%' }}
          size="small"
          minuteStep={5}
        />
      ) : val ? dayjs(val).format('HH:mm') : '-',
    },
    { title: '工时(小时)', dataIndex: 'hours', key: 'hours', width: 100 },
    {
      title: '技工', dataIndex: 'skilled_count', key: 'skilled_count', width: 90,
      render: (val, record) => isEditable ? (
        <InputNumber
          min={0}
          value={val}
          onChange={(v) => handleManpowerChange(record.id, 'skilled_count', v || 0)}
          style={{ width: '100%' }}
          size="small"
        />
      ) : val,
    },
    {
      title: '普工', dataIndex: 'general_count', key: 'general_count', width: 90,
      render: (val, record) => isEditable ? (
        <InputNumber
          min={0}
          value={val}
          onChange={(v) => handleManpowerChange(record.id, 'general_count', v || 0)}
          style={{ width: '100%' }}
          size="small"
        />
      ) : val,
    },
    {
      title: '劳务工', dataIndex: 'labor_count', key: 'labor_count', width: 90,
      render: (val, record) => isEditable ? (
        <InputNumber
          min={0}
          value={val}
          onChange={(v) => handleManpowerChange(record.id, 'labor_count', v || 0)}
          style={{ width: '100%' }}
          size="small"
        />
      ) : val,
    },
    {
      title: '其他', dataIndex: 'other_count', key: 'other_count', width: 90,
      render: (val, record) => isEditable ? (
        <InputNumber
          min={0}
          value={val}
          onChange={(v) => handleManpowerChange(record.id, 'other_count', v || 0)}
          style={{ width: '100%' }}
          size="small"
        />
      ) : val,
    },
    { title: '总人数', dataIndex: 'total_people', key: 'total_people', width: 80 },
    { title: '总工时', dataIndex: 'man_hours', key: 'man_hours', width: 100 },
    {
      title: '操作', key: 'action', width: 80,
      render: (_, record) => isEditable ? (
        <Popconfirm title="确认删除？" onConfirm={() => handleDeleteManpower(record)}>
          <Button type="link" size="small" danger>删除</Button>
        </Popconfirm>
      ) : null,
    },
  ]

  const tabItems = [
    { key: 'production-defect', label: '生产不良记录' },
    { key: 'production-material', label: '生产物料记录' },
    { key: 'scrap-defect', label: '检验报废记录' },
    { key: 'exception', label: '异常工时记录' },
    { key: 'manpower', label: '人员工时记录' },
  ]

  const renderTabContent = (key) => {
    switch (key) {
      case 'production-defect':
        return (
          <div>
            <Row style={{ marginBottom: 16 }} align="middle">
              <Col span={12}>
                <Space>
                  <span>选择工序：</span>
                  <Select
                    value={selectedProcessId}
                    onChange={setSelectedProcessId}
                    options={lineProcesses.map(p => ({ label: p.process_name, value: p.process_id }))}
                    style={{ width: 200 }}
                    placeholder="请选择工序"
                    popupClassName="mes-select-dropdown"
                  />
                  {isEditable && (
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAddProdDefectRow}>添加</Button>
                  )}
                </Space>
              </Col>
              <Col span={12} style={{ textAlign: 'right' }}>
                {selectedProcessId && (
                  <Space size="large">
                    <span style={{ color: '#999', fontSize: 12 }}>当前工序统计：</span>
                    <span>投入数量：<b style={{ color: '#1890ff' }}>{processStats.inputQty}</b></span>
                    <span>合格数：<b style={{ color: '#52c41a' }}>{processStats.qualifiedQty}</b></span>
                    <span>制程不良：<b style={{ color: '#fa8c16' }}>{processStats.processDefectQty}</b></span>
                    <span>来料不良：<b style={{ color: '#faad14' }}>{processStats.materialDefectQty}</b></span>
                  </Space>
                )}
              </Col>
            </Row>
            <Table
              columns={prodDefectColumns}
              dataSource={prodDefectDisplayList}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 900 }}
              tableLayout="fixed"
            />
          </div>
        )
      case 'production-material':
        return (
          <div>
            <Row style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Space>
                  <span>选择工序：</span>
                  <Select
                    value={selectedProcessId}
                    onChange={setSelectedProcessId}
                    options={lineProcesses.map(p => ({ label: p.process_name, value: p.process_id }))}
                    style={{ width: 200 }}
                    placeholder="请选择工序"
                    popupClassName="mes-select-dropdown"
                  />
                </Space>
              </Col>
              <Col span={12} style={{ textAlign: 'right' }}>
                {isEditable ? (
                  <Tag color="blue">表格末尾空行可直接录入，修改后自动保存</Tag>
                ) : (
                  <Tag color="default">已完工，数据只读</Tag>
                )}
              </Col>
            </Row>
            <Table
              columns={materialColumns}
              dataSource={materialDisplayList}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 1000 }}
              tableLayout="fixed"
            />
          </div>
        )
      case 'scrap-defect':
        return (
          <div>
            <Row style={{ marginBottom: 16 }} align="middle">
              <Col span={12}>
                <Space>
                  <span style={{ color: '#666' }}>检验报废记录</span>
                  {isEditable && (
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAddScrapDefectRow}>添加</Button>
                  )}
                </Space>
              </Col>
              <Col span={12} style={{ textAlign: 'right' }}>
                {isEditable ? (
                  <Tag color="blue">点击"添加"录入数据后，点"保存"提交</Tag>
                ) : (
                  <Tag color="default">已完工，数据只读</Tag>
                )}
              </Col>
            </Row>
            <Table
              columns={scrapDefectColumns}
              dataSource={scrapDefectDisplayList}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 800 }}
              tableLayout="fixed"
            />
          </div>
        )
      case 'exception':
        return (
          <div>
            <Row style={{ marginBottom: 16 }}>
              <Col span={12}>
                <span style={{ color: '#666' }}>异常工时记录</span>
              </Col>
              <Col span={12} style={{ textAlign: 'right' }}>
                {isEditable ? (
                  <Tag color="blue">表格末尾空行可直接录入，修改后自动保存</Tag>
                ) : (
                  <Tag color="default">已完工，数据只读</Tag>
                )}
              </Col>
            </Row>
            <Table
              columns={exceptionColumns}
              dataSource={exceptionDisplayList}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 900 }}
              tableLayout="fixed"
            />
          </div>
        )
      case 'manpower':
        return (
          <div>
            <Row style={{ marginBottom: 16 }}>
              <Col span={12}>
                <span style={{ color: '#666' }}>人员工时记录</span>
              </Col>
              <Col span={12} style={{ textAlign: 'right' }}>
                {isEditable ? (
                  <Tag color="blue">表格末尾空行可直接录入，修改后自动保存</Tag>
                ) : (
                  <Tag color="default">已完工，数据只读</Tag>
                )}
              </Col>
            </Row>
            <Table
              columns={manpowerColumns}
              dataSource={manpowerDisplayList}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 1200 }}
              tableLayout="fixed"
            />
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle" style={{ marginBottom: 12 }}>
          <Col span={10}>
            <Space>
              <span style={{ fontWeight: 'bold' }}>报工单：</span>
              <Select
                value={selectedReport?.report_order_id || undefined}
                onChange={(val) => {
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
              <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreateModal}>新增报工</Button>
            </Space>
          </Col>
          {selectedReport && (
            <Col span={14} style={{ textAlign: 'right' }}>
              <Space>
                <Tag
                  color={reportOrderStatusMap[selectedReport.status as 0 | 1]?.color || 'default'}
                  style={{ fontSize: 14, padding: '2px 10px' }}
                >
                  {reportOrderStatusMap[selectedReport.status as 0 | 1]?.label || '-'}
                </Tag>
                {isEditable && (
                  <>
                    <Popconfirm title="确认完工？完工后数据将变为只读" onConfirm={handleFinishReport}>
                      <Button type="primary" loading={finishingReport}>完工</Button>
                    </Popconfirm>
                    <Popconfirm title="确认删除该报工单？后端会检查关联子记录" onConfirm={handleDeleteReport}>
                      <Button danger loading={deletingReport}>删除</Button>
                    </Popconfirm>
                  </>
                )}
              </Space>
            </Col>
          )}
        </Row>

        {selectedReport && (
          <Row gutter={16}>
            <Col span={4}>
              <div style={{ color: '#666' }}>报工单号</div>
              <div style={{ fontWeight: 'bold' }}>{selectedReport.report_no}</div>
            </Col>
            <Col span={4}>
              <div style={{ color: '#666' }}>订单编号</div>
              <div>{selectedReport.order_no || '-'}</div>
            </Col>
            <Col span={4}>
              <div style={{ color: '#666' }}>产线</div>
              <div>{selectedReport.line_name || '-'}</div>
            </Col>
            <Col span={4}>
              <div style={{ color: '#666' }}>报工状态</div>
              <Tag color={reportOrderStatusMap[selectedReport.status as 0 | 1]?.color || 'default'}>
                {reportOrderStatusMap[selectedReport.status as 0 | 1]?.label || '-'}
              </Tag>
            </Col>
            <Col span={4}>
              <div style={{ color: '#666' }}>物料名称</div>
              <div>{selectedReport.material_name || '-'}</div>
            </Col>
            <Col span={4}>
              <div style={{ color: '#666' }}>报工数量</div>
              <div>{selectedReport.report_qty ?? 0}</div>
            </Col>
          </Row>
        )}

        {selectedReport && (
          <Row gutter={16} style={{ marginTop: 12 }}>
            <Col span={4}>
              <div style={{ color: '#666' }}>物料编码</div>
              <div>{selectedReport.material_code || '-'}</div>
            </Col>
            <Col span={4}>
              <div style={{ color: '#666' }}>规格</div>
              <div>{selectedReport.specification || '-'}</div>
            </Col>
            <Col span={4}>
              <div style={{ color: '#666' }}>报工时间</div>
              <div>{selectedReport.report_time ? dayjs(selectedReport.report_time).format('YYYY-MM-DD HH:mm') : '-'}</div>
            </Col>
            <Col span={4}>
              <div style={{ color: '#666' }}>完工时间</div>
              <div>{selectedReport.finish_time ? dayjs(selectedReport.finish_time).format('YYYY-MM-DD HH:mm') : '-'}</div>
            </Col>
            <Col span={4}>
              <div style={{ color: '#666' }}>报工人</div>
              <div>{selectedReport.report_user_name || '-'}</div>
            </Col>
            <Col span={4}>
              <div style={{ color: '#666' }}>完工人</div>
              <div>{selectedReport.finish_user_name || '-'}</div>
            </Col>
          </Row>
        )}
      </Card>

      {!selectedReport && (
        <Card style={{ textAlign: 'center', padding: 40, marginBottom: 16 }}>
          <div style={{ color: '#999', marginBottom: 16 }}>
            {reportOrders.length === 0
              ? '暂无开工状态的报工单，请点击"新增报工"创建'
              : '请从上方下拉框选择一个报工单'}
          </div>
        </Card>
      )}

      {selectedReport && (
        <Card>
          <div style={{ marginBottom: 8, fontWeight: 'bold', color: '#333' }}>报工单统计（当前报工单汇总）</div>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={4}>
              <div style={{ color: '#666' }}>投入数量</div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#1890ff' }}>{stats.inputQty}</div>
            </Col>
            <Col span={4}>
              <div style={{ color: '#666' }}>报工数量</div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#52c41a' }}>{stats.outputQty}</div>
            </Col>
            <Col span={4}>
              <div style={{ color: '#666' }}>来料不良汇总</div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#faad14' }}>{stats.defectMaterial}</div>
            </Col>
            <Col span={4}>
              <div style={{ color: '#666' }}>制程不良汇总</div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#fa8c16' }}>{stats.defectProcess}</div>
            </Col>
            <Col span={4}>
              <div style={{ color: '#666' }}>检验报废汇总</div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#ff4d4f' }}>{stats.defectScrap}</div>
            </Col>
            <Col span={4}>
              <div style={{ color: '#666' }}>异常工时汇总</div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#722ed1' }}>{stats.exceptionHours}</div>
            </Col>
          </Row>

          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
          >
          </Tabs>

          <div style={{ marginTop: 16 }}>
            {renderTabContent(activeTab)}
          </div>
        </Card>
      )}

      {/* 新增报工单 Modal */}
      <Modal
        title="新增报工单"
        open={createModalOpen}
        onOk={handleCreateReport}
        onCancel={() => setCreateModalOpen(false)}
        confirmLoading={creatingReport}
        okText="确定"
        cancelText="取消"
        width={520}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" preserve={false}>
          <Form.Item
            name="order_id"
            label="生产订单"
            rules={[{ required: true, message: '请选择生产订单' }]}
          >
            <Select
              placeholder="请选择生产订单（仅下发状态）"
              options={orderOptions}
              showSearch
              optionFilterProp="label"
              popupClassName="mes-select-dropdown"
            />
          </Form.Item>
          <Form.Item
            name="line_id"
            label="产线"
            rules={[{ required: true, message: '请选择产线' }]}
          >
            <Select
              placeholder="请选择产线（仅运行中）"
              options={lineOptions}
              showSearch
              optionFilterProp="label"
              popupClassName="mes-select-dropdown"
            />
          </Form.Item>
          <Form.Item
            name="report_qty"
            label="报工数量"
            rules={[{ required: true, message: '请填写报工数量' }]}
          >
            <InputNumber min={1} step={1} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={2} placeholder="备注（可选）" />
          </Form.Item>
        </Form>
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
          <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>暂无图片</div>
        )}
      </Drawer>
    </div>
  )
}
