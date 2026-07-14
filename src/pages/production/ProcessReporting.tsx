import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Table, Tag, Button, Modal, Input, InputNumber, Select, Space, Row, Col,
  Card, Divider, Popconfirm, DatePicker, Tabs, Upload, Drawer, Image,
} from 'antd'
import { useMessage } from '../../contexts/AppContext'
import {
  PlusOutlined, DeleteOutlined, UploadOutlined,
  PictureOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '../../utils/api'

const woStatusColorMap = {
  '开立': 'default',
  '开工': 'processing',
  '关闭': 'warning',
}

const reportStatusColorMap = {
  '开始报工': 'processing',
  '结束报工': 'success',
}

const exceptionCategories = [
  { label: '换型换线', value: '换型换线' },
  { label: '停机待料', value: '停机待料' },
  { label: '故障维修', value: '故障维修' },
  { label: '其它停机', value: '其它停机' },
]

const genTempId = () => 'tmp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)

export default function ProcessReporting() {
  const [workOrders, setWorkOrders] = useState([])
  const [selectedWO, setSelectedWO] = useState(null)
  const [reportList, setReportList] = useState([])
  const [selectedReport, setSelectedReport] = useState(null)
  const [reportStatus, setReportStatus] = useState('开始报工')
  const [defectTypes, setDefectTypes] = useState([])
  const [devices, setDevices] = useState([])
  const [lineProcesses, setLineProcesses] = useState([])
  const [loading, setLoading] = useState(false)
  const [togglingStatus, setTogglingStatus] = useState(false)
  const [creatingReport, setCreatingReport] = useState(false)

  const [selectedProcessId, setSelectedProcessId] = useState(null)
  const [activeTab, setActiveTab] = useState('production-defect')

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

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const [defectRes, devRes] = await Promise.all([
          api.get('/basic/defect-types', { params: { page: 1, pageSize: 1000, status: '启用' } }),
          api.get('/basic/devices', { params: { page: 1, pageSize: 1000 } }),
        ])
        if (cancelled) return
        setDefectTypes(defectRes.data || [])
        setDevices(devRes.data || [])
      } catch (err) {
        if (!cancelled) message.error(err.message || '获取基础数据失败')
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const res = await api.get('/production/work-orders', { params: { page: 1, pageSize: 1000, status: '开工' } })
        if (cancelled) return
        setWorkOrders(res.data || [])
      } catch (err) {
        if (!cancelled) {
          message.error(err.message || '获取工单列表失败')
          setWorkOrders([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!selectedWO) {
      setReportList([])
      setSelectedReport(null)
      setLineProcesses([])
      setSelectedProcessId(null)
      setProdDefectList([])
      setScrapDefectList([])
      setExceptionList([])
      setManpowerList([])
      setMaterialList([])
      setStats({ inputQty: 0, outputQty: 0, defectMaterial: 0, defectProcess: 0, defectScrap: 0, exceptionHours: 0 })
      setReportStatus('开始报工')
      return
    }
    fetchLineProcesses(selectedWO.line_id)
    fetchReportList(selectedWO.work_order_id)
    fetchMaterials()
  }, [selectedWO])

  useEffect(() => {
    if (!selectedReport) {
      setProdDefectList([])
      setScrapDefectList([])
      setExceptionList([])
      setManpowerList([])
      setMaterialList([])
      setStats({ inputQty: 0, outputQty: 0, defectMaterial: 0, defectProcess: 0, defectScrap: 0, exceptionHours: 0 })
      setReportStatus('开始报工')
      return
    }
    setReportStatus(selectedReport.status || '开始报工')
    fetchAllData(selectedReport.report_id)
  }, [selectedReport, selectedProcessId])

  const fetchLineProcesses = useCallback(async (lineId) => {
    if (!lineId) {
      setLineProcesses([])
      return
    }
    try {
      const res = await api.get(`/basic/production-lines/${lineId}/processes`)
      const procs = res.data || []
      const sorted = [...procs].sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
      setLineProcesses(sorted)
      if (sorted.length > 0) {
        setSelectedProcessId(sorted[0].process_id)
      }
    } catch (err) {
      setLineProcesses([])
    }
  }, [])

  const fetchReportList = useCallback(async (woId) => {
    try {
      const res = await api.get('/production/process-reports', { params: { work_order_id: woId, page: 1, pageSize: 1000 } })
      const list = res.data || []
      setReportList(list)
      if (list.length > 0) {
        setSelectedReport(list[0])
      } else {
        setSelectedReport(null)
      }
    } catch (err) {
      message.error(err.message || '获取报工单列表失败')
      setReportList([])
      setSelectedReport(null)
    }
  }, [])

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

  const fetchAllData = useCallback(async (reportId) => {
    if (!reportId || !selectedProcessId) return
    try {
      const [defectRes, scrapRes, exceptionRes, manpowerRes, materialRes] = await Promise.all([
        api.get('/production/process-defects', { params: { report_id: reportId, process_id: selectedProcessId, page: 1, pageSize: 1000 } }),
        api.get('/production/scrap-defects', { params: { report_id: reportId, page: 1, pageSize: 1000 } }),
        api.get('/production/process-exceptions', { params: { report_id: reportId, page: 1, pageSize: 1000 } }),
        api.get('/production/manpower-records', { params: { report_id: reportId, page: 1, pageSize: 1000 } }),
        api.get('/production/process-materials', { params: { report_id: reportId, process_id: selectedProcessId, page: 1, pageSize: 1000 } }),
      ])
      setProdDefectList((defectRes.data || []).map(d => ({ ...d, id: d.defect_id, defect_images: parseImages(d.defect_images) })))
      setScrapDefectList((scrapRes.data || []).map(d => ({ ...d, id: d.scrap_id, defect_images: parseImages(d.defect_images) })))
      setExceptionList((exceptionRes.data || []).map(e => ({ ...e, id: e.exception_id, exception_images: parseImages(e.exception_images) })))
      setManpowerList((manpowerRes.data || []).map(m => ({ ...m, id: m.record_id })))
      setMaterialList((materialRes.data || []).map(m => ({ ...m, id: m.material_id, label_images: parseImages(m.label_images) })))

      const defectTotal = (defectRes.data || []).reduce((sum, d) => sum + (Number(d.quantity) || 0), 0)
      const scrapTotal = (scrapRes.data || []).reduce((sum, d) => sum + (Number(d.quantity) || 0), 0)
      const exceptionTotal = (exceptionRes.data || []).reduce((sum, e) => sum + (Number(e.duration) || 0), 0)

      let inputQty = 0
      if (materialRes.data) {
        inputQty = (materialRes.data || []).reduce((sum, m) => sum + (Number(m.quantity) || 0), 0)
      }

      setStats({
        inputQty,
        outputQty: selectedReport?.output_qty || 0,
        defectMaterial: 0,
        defectProcess: defectTotal,
        defectScrap: scrapTotal,
        exceptionHours: exceptionTotal,
      })
    } catch (err) {
      message.error(err.message || '获取数据失败')
    }
  }, [selectedReport, selectedProcessId])

  const fetchMaterials = useCallback(async () => {
    try {
      const res = await api.get('/basic/materials', { params: { page: 1, pageSize: 1000 } })
      setMaterials(res.data || [])
    } catch (err) {
      setMaterials([])
    }
  }, [])

  const isEditable = reportStatus === '开始报工'

  const handleCreateReport = async () => {
    if (!selectedWO) {
      message.warning('请先选择生产工单')
      return
    }
    try {
      setCreatingReport(true)
      const res = await api.post('/production/process-reports', {
        work_order_id: selectedWO.work_order_id,
      })
      message.success('报工单创建成功')
      await fetchReportList(selectedWO.work_order_id)
      if (res.data) {
        setSelectedReport(res.data)
      }
    } catch (err) {
      message.error(err.message || '创建报工单失败')
    } finally {
      setCreatingReport(false)
    }
  }

  const handleToggleReportStatus = () => {
    if (!selectedReport) return
    const action = reportStatus === '开始报工' ? 'end' : 'start'
    const title = action === 'end' ? '确认结束报工' : '确认开始报工'
    const content = action === 'end' ? '结束报工后所有数据将变为只读，确认继续？' : '开始报工后数据可编辑，确认继续？'
    Modal.confirm({
      title,
      content,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          setTogglingStatus(true)
          const res = await api.post(`/production/process-reports/${selectedReport.report_id}/toggle-status`, { action })
          const newStatus = res.data?.status || (action === 'end' ? '结束报工' : '开始报工')
          setReportStatus(newStatus)
          setSelectedReport(prev => prev ? { ...prev, status: newStatus } : null)
          setReportList(prev => prev.map(r => r.report_id === selectedReport.report_id ? { ...r, status: newStatus } : r))
          message.success(res.message || '操作成功')
          fetchAllData(selectedReport.report_id)
        } catch (err) {
          message.error(err.message || '操作失败')
        } finally {
          setTogglingStatus(false)
        }
      },
    })
  }

  const defectTypeOptions = useMemo(() => {
    const seen = new Set()
    return defectTypes
      .filter(d => d.defect_type === '制程不良' && d.status === '启用')
      .filter(d => {
        if (seen.has(d.defect_id)) return false
        seen.add(d.defect_id)
        return true
      })
      .map(d => ({
        label: `${d.defect_code} ${d.defect_type} ${d.defect_name}`,
        value: d.defect_id,
        defect_code: d.defect_code,
        defect_type: d.defect_type,
        defect_name: d.defect_name,
        defect_unit: d.defect_unit || '',
      }))
  }, [defectTypes])

  const scrapTypeOptions = useMemo(() => {
    const seen = new Set()
    return defectTypes
      .filter(d => d.defect_type === '检验报废' && d.status === '启用')
      .filter(d => {
        if (seen.has(d.defect_id)) return false
        seen.add(d.defect_id)
        return true
      })
      .map(d => ({
        label: `${d.defect_code} ${d.defect_name}`,
        value: d.defect_id,
        defect_code: d.defect_code,
        defect_name: d.defect_name,
        defect_unit: d.defect_unit || '',
      }))
  }, [defectTypes])

  const deviceOptions = useMemo(() => {
    return devices.map(d => ({ label: `${d.device_code} ${d.device_name}`, value: d.device_id }))
  }, [devices])

  const materialOptions = useMemo(() => {
    return materials.map(m => ({
      label: `${m.material_code} ${m.material_name}`,
      value: m.material_id,
      material_code: m.material_code,
      material_name: m.material_name,
      specification: m.specification || '',
    }))
  }, [materials])

  const debouncedSave = (key, saveFn) => {
    if (savingRef.current[key]) {
      clearTimeout(savingRef.current[key])
    }
    savingRef.current[key] = setTimeout(() => {
      saveFn()
    }, 800)
  }

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
          report_id: selectedReport.report_id,
          work_order_id: selectedWO.work_order_id,
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
    } catch (err) {
      message.error(err.message || '保存失败')
    }
  }

  const handleProdDefectChange = (recordId, field, value) => {
    if (!isEditable) return
    setProdDefectList(prev => prev.map(item => {
      if (String(item.id) !== String(recordId)) return item
      let updated = { ...item, [field]: value }
      if (field === 'defect_type_id' && value) {
        const defect = defectTypeOptions.find(d => d.value === value)
        if (defect) {
          updated.defect_name = defect.defect_name
          updated.unit = defect.defect_unit
        }
      }
      return updated
    }))
    const item = prodDefectList.find(d => String(d.id) === String(recordId))
    if (!item) return
    const updatedItem = { ...item, [field]: value }
    if (field === 'defect_type_id' && value) {
      const defect = defectTypeOptions.find(d => d.value === value)
      if (defect) {
        updatedItem.defect_name = defect.defect_name
        updatedItem.unit = defect.defect_unit
      }
    }
    const hasContent = updatedItem.defect_type_id && Number(updatedItem.quantity) > 0
    if (hasContent) {
      debouncedSave(`prod-defect-${recordId}`, () => saveProdDefectItem(updatedItem))
    }
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
    } catch (err) {
      message.error(err.message || '删除失败')
    }
  }

  const prodDefectDisplayList = useMemo(() => {
    if (!isEditable || !selectedReport) return prodDefectList
    const hasEmptyRow = prodDefectList.some(d => !d.defect_id)
    if (hasEmptyRow) return prodDefectList
    const emptyRow = {
      id: genTempId(),
      report_id: selectedReport.report_id,
      work_order_id: selectedWO?.work_order_id,
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
    return [...prodDefectList, emptyRow]
  }, [prodDefectList, isEditable, selectedReport, selectedWO, selectedProcessId])

  const prodDefectColumns = [
    { title: '不良类型', dataIndex: 'defect_category', key: 'defect_category', width: 100 },
    {
      title: '不良项目', dataIndex: 'defect_name', key: 'defect_name', minWidth: 200,
      render: (_, record) => isEditable ? (
        <Select
          placeholder="请选择不良项目"
          value={record.defect_type_id || undefined}
          onChange={(val) => handleProdDefectChange(record.id, 'defect_type_id', val)}
          options={defectTypeOptions}
          style={{ width: '100%' }}
          showSearch
          optionFilterProp="label"
          size="small"
        />
      ) : record.defect_name || '-',
    },
    {
      title: '不良数量', dataIndex: 'quantity', key: 'quantity', width: 120,
      render: (val, record) => isEditable ? (
        <InputNumber
          min={0}
          value={val}
          onChange={(v) => handleProdDefectChange(record.id, 'quantity', v || 0)}
          style={{ width: '100%' }}
          size="small"
        />
      ) : val,
    },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 80 },
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
      title: '操作', key: 'action', width: 80,
      render: (_, record) => isEditable ? (
        <Popconfirm title="确认删除？" onConfirm={() => handleDeleteProdDefect(record)}>
          <Button type="link" size="small" danger>删除</Button>
        </Popconfirm>
      ) : null,
    },
  ]

  const saveScrapDefectItem = async (item) => {
    if (!selectedReport) return
    try {
      if (item.scrap_id) {
        await api.put(`/production/scrap-defects/${item.scrap_id}`, {
          quantity: item.quantity,
          unit: item.unit,
          defect_images: item.defect_images,
        })
      } else {
        const defect = scrapTypeOptions.find(d => d.value === item.defect_type_id)
        const res = await api.post('/production/scrap-defects', {
          report_id: selectedReport.report_id,
          work_order_id: selectedWO.work_order_id,
          defect_type_id: item.defect_type_id,
          quantity: item.quantity,
          unit: defect?.defect_unit || item.unit,
          defect_images: item.defect_images,
        })
        setScrapDefectList(prev => prev.map(d =>
          d.id === item.id ? { ...res.data, id: res.data.scrap_id, defect_images: parseImages(res.data.defect_images) } : d
        ))
      }
    } catch (err) {
      message.error(err.message || '保存失败')
    }
  }

  const handleScrapDefectChange = (recordId, field, value) => {
    if (!isEditable) return
    setScrapDefectList(prev => prev.map(item => {
      if (String(item.id) !== String(recordId)) return item
      let updated = { ...item, [field]: value }
      if (field === 'defect_type_id' && value) {
        const defect = scrapTypeOptions.find(d => d.value === value)
        if (defect) {
          updated.defect_name = defect.defect_name
          updated.unit = defect.defect_unit
        }
      }
      return updated
    }))
    const item = scrapDefectList.find(d => String(d.id) === String(recordId))
    if (!item) return
    const updatedItem = { ...item, [field]: value }
    if (field === 'defect_type_id' && value) {
      const defect = scrapTypeOptions.find(d => d.value === value)
      if (defect) {
        updatedItem.defect_name = defect.defect_name
        updatedItem.unit = defect.defect_unit
      }
    }
    const hasContent = updatedItem.defect_type_id && Number(updatedItem.quantity) > 0
    if (hasContent) {
      debouncedSave(`scrap-defect-${recordId}`, () => saveScrapDefectItem(updatedItem))
    }
  }

  const handleDeleteScrapDefect = async (item) => {
    if (!item.scrap_id) {
      setScrapDefectList(prev => prev.filter(d => d.id !== item.id))
      return
    }
    try {
      await api.delete(`/production/process-defects/${item.scrap_id}`)
      setScrapDefectList(prev => prev.filter(d => d.id !== item.id))
      message.success('删除成功')
    } catch (err) {
      message.error(err.message || '删除失败')
    }
  }

  const scrapDefectDisplayList = useMemo(() => {
    if (!isEditable || !selectedReport) return scrapDefectList
    const hasEmptyRow = scrapDefectList.some(d => !d.scrap_id)
    if (hasEmptyRow) return scrapDefectList
    const emptyRow = {
      id: genTempId(),
      report_id: selectedReport.report_id,
      work_order_id: selectedWO?.work_order_id,
      defect_category: '检验报废',
      defect_type_id: null,
      defect_name: '',
      quantity: 0,
      unit: '',
      defect_images: [],
    }
    return [...scrapDefectList, emptyRow]
  }, [scrapDefectList, isEditable, selectedReport, selectedWO])

  const scrapDefectColumns = [
    {
      title: '报废项目', dataIndex: 'defect_name', key: 'defect_name', minWidth: 200,
      render: (_, record) => isEditable ? (
        <Select
          placeholder="请选择报废项目"
          value={record.defect_type_id || undefined}
          onChange={(val) => handleScrapDefectChange(record.id, 'defect_type_id', val)}
          options={scrapTypeOptions}
          style={{ width: '100%' }}
          showSearch
          optionFilterProp="label"
          size="small"
        />
      ) : record.defect_name || '-',
    },
    {
      title: '报废数量', dataIndex: 'quantity', key: 'quantity', width: 120,
      render: (val, record) => isEditable ? (
        <InputNumber
          min={0}
          value={val}
          onChange={(v) => handleScrapDefectChange(record.id, 'quantity', v || 0)}
          style={{ width: '100%' }}
          size="small"
        />
      ) : val,
    },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 80 },
    {
      title: '图片', dataIndex: 'defect_images', key: 'defect_images', width: 120,
      render: (val, record) => (
        <Button type="link" size="small" icon={<PictureOutlined />}
          onClick={() => openImageDrawer('报废图片', val || [], { listType: 'scrapDefect', recordId: record.id, field: 'defect_images' })}>
          {(val || []).length} 张
        </Button>
      ),
    },
    {
      title: '操作', key: 'action', width: 80,
      render: (_, record) => isEditable ? (
        <Popconfirm title="确认删除？" onConfirm={() => handleDeleteScrapDefect(record)}>
          <Button type="link" size="small" danger>删除</Button>
        </Popconfirm>
      ) : null,
    },
  ]

  const saveMaterialItem = async (item) => {
    if (!selectedReport || !selectedProcessId) return
    try {
      if (item.material_id && String(item.material_id).startsWith('tmp_') === false) {
        await api.put(`/production/process-materials/${item.material_id}`, {
          material_type: item.material_type,
          material_code: item.material_code,
          material_name: item.material_name,
          specification: item.specification,
          material_batch: item.material_batch,
          quantity: item.quantity,
          label_images: item.label_images,
        })
      } else {
        const res = await api.post('/production/process-materials', {
          report_id: selectedReport.report_id,
          work_order_id: selectedWO.work_order_id,
          process_id: selectedProcessId,
          material_type: item.material_type || '投入物料',
          material_code: item.material_code,
          material_name: item.material_name,
          specification: item.specification,
          material_batch: item.material_batch,
          quantity: item.quantity,
          label_images: item.label_images,
        })
        setMaterialList(prev => prev.map(m =>
          m.id === item.id ? { ...res.data, id: res.data.material_id, label_images: parseImages(res.data.label_images) } : m
        ))
      }
    } catch (err) {
      message.error(err.message || '保存失败')
    }
  }

  const handleMaterialChange = (recordId, field, value) => {
    if (!isEditable) return
    setMaterialList(prev => prev.map(item => {
      if (String(item.id) !== String(recordId)) return item
      return { ...item, [field]: value }
    }))
    const item = materialList.find(m => String(m.id) === String(recordId))
    if (!item) return
    const updatedItem = { ...item, [field]: value }
    const hasContent = updatedItem.material_name && Number(updatedItem.quantity) > 0
    if (hasContent) {
      debouncedSave(`material-${recordId}`, () => saveMaterialItem(updatedItem))
    }
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
    } catch (err) {
      message.error(err.message || '删除失败')
    }
  }

  const materialDisplayList = useMemo(() => {
    if (!isEditable || !selectedReport) return materialList
    const hasEmptyRow = materialList.some(m => !m.material_id || String(m.material_id).startsWith('tmp_'))
    if (hasEmptyRow) return materialList
    const emptyRow = {
      id: genTempId(),
      report_id: selectedReport.report_id,
      work_order_id: selectedWO?.work_order_id,
      process_id: selectedProcessId,
      material_type: '投入物料',
      material_code: '',
      material_name: '',
      specification: '',
      material_batch: '',
      quantity: 0,
      label_images: [],
    }
    return [...materialList, emptyRow]
  }, [materialList, isEditable, selectedReport, selectedWO, selectedProcessId])

  const materialColumns = [
    { title: '物料类型', dataIndex: 'material_type', key: 'material_type', width: 100 },
    {
      title: '物料名称', dataIndex: 'material_name', key: 'material_name', minWidth: 200,
      render: (_, record) => isEditable ? (
        <Input
          placeholder="请输入物料名称"
          value={record.material_name}
          onChange={(e) => handleMaterialChange(record.id, 'material_name', e.target.value)}
          size="small"
        />
      ) : record.material_name || '-',
    },
    {
      title: '规格型号', dataIndex: 'specification', key: 'specification', width: 120,
      render: (val, record) => isEditable ? (
        <Input
          placeholder="规格"
          value={val}
          onChange={(e) => handleMaterialChange(record.id, 'specification', e.target.value)}
          size="small"
        />
      ) : val || '-',
    },
    {
      title: '批次号', dataIndex: 'material_batch', key: 'material_batch', width: 120,
      render: (val, record) => isEditable ? (
        <Input
          placeholder="批次号"
          value={val}
          onChange={(e) => handleMaterialChange(record.id, 'material_batch', e.target.value)}
          size="small"
        />
      ) : val || '-',
    },
    {
      title: '数量', dataIndex: 'quantity', key: 'quantity', width: 100,
      render: (val, record) => isEditable ? (
        <InputNumber
          min={0}
          value={val}
          onChange={(v) => handleMaterialChange(record.id, 'quantity', v || 0)}
          style={{ width: '100%' }}
          size="small"
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
          report_id: selectedReport.report_id,
          work_order_id: selectedWO.work_order_id,
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
    } catch (err) {
      message.error(err.message || '保存失败')
    }
  }

  const handleExceptionChange = (recordId, field, value) => {
    if (!isEditable) return
    setExceptionList(prev => prev.map(item => {
      if (String(item.id) !== String(recordId)) return item
      const updated = { ...item, [field]: value }
      if (field === 'start_time' || field === 'end_time') {
        if (updated.start_time && updated.end_time) {
          const start = new Date(updated.start_time)
          const end = new Date(updated.end_time)
          updated.duration = Number(((end - start) / 3600000).toFixed(2))
        }
      }
      return updated
    }))
    const item = exceptionList.find(e => String(e.id) === String(recordId))
    if (!item) return
    const updatedItem = { ...item, [field]: value }
    if (field === 'start_time' || field === 'end_time') {
      if (updatedItem.start_time && updatedItem.end_time) {
        const start = new Date(updatedItem.start_time)
        const end = new Date(updatedItem.end_time)
        updatedItem.duration = Number(((end - start) / 3600000).toFixed(2))
      }
    }
    const hasContent = updatedItem.exception_type && updatedItem.start_time
    if (hasContent) {
      debouncedSave(`exception-${recordId}`, () => saveExceptionItem(updatedItem))
    }
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
      report_id: selectedReport.report_id,
      work_order_id: selectedWO?.work_order_id,
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
  }, [exceptionList, isEditable, selectedReport, selectedWO])

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
        />
      ) : record.device_name || '-',
    },
    {
      title: '开始时间', dataIndex: 'start_time', key: 'start_time', width: 170,
      render: (val, record) => isEditable ? (
        <DatePicker
          showTime
          value={val ? dayjs(val) : null}
          onChange={(d) => handleExceptionChange(record.id, 'start_time', d ? d.toISOString() : null)}
          style={{ width: '100%' }}
          size="small"
        />
      ) : val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '结束时间', dataIndex: 'end_time', key: 'end_time', width: 170,
      render: (val, record) => isEditable ? (
        <DatePicker
          showTime
          value={val ? dayjs(val) : null}
          onChange={(d) => handleExceptionChange(record.id, 'end_time', d ? d.toISOString() : null)}
          style={{ width: '100%' }}
          size="small"
        />
      ) : val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-',
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
          report_id: selectedReport.report_id,
          work_order_id: selectedWO.work_order_id,
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
    setManpowerList(prev => prev.map(item => {
      if (String(item.id) !== String(recordId)) return item
      const updated = { ...item, [field]: value }
      const sk = Number(updated.skilled_count) || 0
      const gn = Number(updated.general_count) || 0
      const lb = Number(updated.labor_count) || 0
      const ot = Number(updated.other_count) || 0
      updated.total_people = sk + gn + lb + ot
      if (updated.start_time && updated.end_time) {
        const start = new Date(updated.start_time)
        const end = new Date(updated.end_time)
        const hours = ((end - start) / 3600000)
        updated.hours = hours > 0 ? Number(hours.toFixed(2)) : 0
        updated.man_hours = Number((updated.hours * updated.total_people).toFixed(2))
      }
      return updated
    }))
    const item = manpowerList.find(m => String(m.id) === String(recordId))
    if (!item) return
    const updatedItem = { ...item, [field]: value }
    const sk = Number(updatedItem.skilled_count) || 0
    const gn = Number(updatedItem.general_count) || 0
    const lb = Number(updatedItem.labor_count) || 0
    const ot = Number(updatedItem.other_count) || 0
    updatedItem.total_people = sk + gn + lb + ot
    if (updatedItem.start_time && updatedItem.end_time) {
      const start = new Date(updatedItem.start_time)
      const end = new Date(updatedItem.end_time)
      const hours = ((end - start) / 3600000)
      updatedItem.hours = hours > 0 ? Number(hours.toFixed(2)) : 0
      updatedItem.man_hours = Number((updatedItem.hours * updatedItem.total_people).toFixed(2))
    }
    const hasContent = updatedItem.record_date && updatedItem.total_people > 0
    if (hasContent) {
      debouncedSave(`manpower-${recordId}`, () => saveManpowerItem(updatedItem))
    }
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
      report_id: selectedReport.report_id,
      work_order_id: selectedWO?.work_order_id,
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
  }, [manpowerList, isEditable, selectedReport, selectedWO])

  const manpowerColumns = [
    {
      title: '日期', dataIndex: 'record_date', key: 'record_date', width: 130,
      render: (val, record) => isEditable ? (
        <DatePicker
          value={val ? dayjs(val) : null}
          onChange={(d) => handleManpowerChange(record.id, 'record_date', d ? d.format('YYYY-MM-DD') : null)}
          style={{ width: '100%' }}
          size="small"
        />
      ) : val || '-',
    },
    {
      title: '班次', dataIndex: 'shift', key: 'shift', width: 100,
      render: (val, record) => isEditable ? (
        <Select
          value={val || undefined}
          onChange={(v) => handleManpowerChange(record.id, 'shift', v)}
          options={[
            { label: '白班', value: '白班' },
            { label: '夜班', value: '夜班' },
          ]}
          style={{ width: '100%' }}
          size="small"
        />
      ) : val || '-',
    },
    {
      title: '开始时间', dataIndex: 'start_time', key: 'start_time', width: 150,
      render: (val, record) => isEditable ? (
        <DatePicker
          showTime
          value={val ? dayjs(val) : null}
          onChange={(d) => handleManpowerChange(record.id, 'start_time', d ? d.toISOString() : null)}
          style={{ width: '100%' }}
          size="small"
        />
      ) : val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '结束时间', dataIndex: 'end_time', key: 'end_time', width: 150,
      render: (val, record) => isEditable ? (
        <DatePicker
          showTime
          value={val ? dayjs(val) : null}
          onChange={(d) => handleManpowerChange(record.id, 'end_time', d ? d.toISOString() : null)}
          style={{ width: '100%' }}
          size="small"
        />
      ) : val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-',
    },
    { title: '工时(小时)', dataIndex: 'hours', key: 'hours', width: 100 },
    {
      title: '熟练工', dataIndex: 'skilled_count', key: 'skilled_count', width: 90,
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
                  />
                </Space>
              </Col>
              <Col span={12} style={{ textAlign: 'right' }}>
                {isEditable ? (
                  <Tag color="blue">表格末尾空行可直接录入，修改后自动保存</Tag>
                ) : (
                  <Tag color="default">已结束报工，数据只读</Tag>
                )}
              </Col>
            </Row>
            <Table
              columns={prodDefectColumns}
              dataSource={prodDefectDisplayList}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 800 }}
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
                  />
                </Space>
              </Col>
              <Col span={12} style={{ textAlign: 'right' }}>
                {isEditable ? (
                  <Tag color="blue">表格末尾空行可直接录入，修改后自动保存</Tag>
                ) : (
                  <Tag color="default">已结束报工，数据只读</Tag>
                )}
              </Col>
            </Row>
            <Table
              columns={materialColumns}
              dataSource={materialDisplayList}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 900 }}
            />
          </div>
        )
      case 'scrap-defect':
        return (
          <div>
            <Row style={{ marginBottom: 16 }}>
              <Col span={12}>
                <span style={{ color: '#666' }}>检验报废记录</span>
              </Col>
              <Col span={12} style={{ textAlign: 'right' }}>
                {isEditable ? (
                  <Tag color="blue">表格末尾空行可直接录入，修改后自动保存</Tag>
                ) : (
                  <Tag color="default">已结束报工，数据只读</Tag>
                )}
              </Col>
            </Row>
            <Table
              columns={scrapDefectColumns}
              dataSource={scrapDefectDisplayList}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 700 }}
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
                  <Tag color="default">已结束报工，数据只读</Tag>
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
                  <Tag color="default">已结束报工，数据只读</Tag>
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
              <span style={{ fontWeight: 'bold' }}>生产工单：</span>
              <Select
                value={selectedWO?.work_order_id || undefined}
                onChange={(val) => {
                  const wo = workOrders.find(w => w.work_order_id === val)
                  setSelectedWO(wo || null)
                }}
                options={workOrders.map(w => ({ label: `${w.work_order_no} ${w.material_name}`, value: w.work_order_id }))}
                style={{ width: 320 }}
                placeholder="请选择生产工单"
                showSearch
                optionFilterProp="label"
              />
            </Space>
          </Col>
          {selectedWO && (
            <>
              <Col span={8}>
                <Space>
                  <span style={{ fontWeight: 'bold' }}>报工单：</span>
                  <Select
                    value={selectedReport?.report_id || undefined}
                    onChange={(val) => {
                      const r = reportList.find(r => r.report_id === val)
                      setSelectedReport(r || null)
                    }}
                    options={reportList.map(r => ({
                      label: `${r.report_no} (${r.status})`,
                      value: r.report_id,
                    }))}
                    style={{ width: 260 }}
                    placeholder="请选择报工单"
                    allowClear
                  />
                </Space>
              </Col>
              <Col span={6} style={{ textAlign: 'right' }}>
                {selectedReport ? (
                  <Space>
                    <Tag color={reportStatusColorMap[reportStatus]} style={{ fontSize: 14, padding: '2px 10px' }}>
                      {reportStatus}
                    </Tag>
                    <Button
                      type={isEditable ? 'default' : 'primary'}
                      onClick={handleToggleReportStatus}
                      loading={togglingStatus}
                    >
                      {isEditable ? '结束报工' : '开始报工'}
                    </Button>
                  </Space>
                ) : (
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleCreateReport}
                    loading={creatingReport}
                  >
                    新增报工单
                  </Button>
                )}
              </Col>
            </>
          )}
        </Row>

        {selectedReport && (
          <Row gutter={16}>
            <Col span={4}>
              <div style={{ color: '#666' }}>生产报工单号</div>
              <div style={{ fontWeight: 'bold' }}>{selectedReport.report_no}</div>
            </Col>
            <Col span={4}>
              <div style={{ color: '#666' }}>产线</div>
              <div>{selectedReport.line_name || selectedWO.line_name}</div>
            </Col>
            <Col span={4}>
              <div style={{ color: '#666' }}>工单状态</div>
              <Tag color={woStatusColorMap[selectedWO.status]}>{selectedWO.status}</Tag>
            </Col>
            <Col span={4}>
              <div style={{ color: '#666' }}>物料名称</div>
              <div>{selectedReport.material_name || selectedWO.material_name}</div>
            </Col>
            <Col span={4}>
              <div style={{ color: '#666' }}>计划数量</div>
              <div>{selectedReport.planned_qty || selectedWO.planned_qty}</div>
            </Col>
            <Col span={4}>
              <div style={{ color: '#666' }}>报工日期</div>
              <div>{selectedReport.report_date ? dayjs(selectedReport.report_date).format('YYYY-MM-DD') : '-'}</div>
            </Col>
          </Row>
        )}
      </Card>

      {selectedWO && !selectedReport && reportList.length === 0 && (
        <Card style={{ textAlign: 'center', padding: 40, marginBottom: 16 }}>
          <div style={{ color: '#999', marginBottom: 16 }}>该工单暂无报工单，请点击"新增报工单"创建</div>
        </Card>
      )}

      {selectedWO && selectedReport && (
        <Card>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={4}>
              <div style={{ color: '#666' }}>投入数量</div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#1890ff' }}>{stats.inputQty}</div>
            </Col>
            <Col span={4}>
              <div style={{ color: '#666' }}>产出数量</div>
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
