import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Table, Tag, Button, Modal, Form, Input, InputNumber, Select, Space, Row, Col,
  message, Card, Divider, Popconfirm, DatePicker, Tabs, Upload, Radio, Drawer, Image,
} from 'antd'
import {
  ProfileOutlined, PlusOutlined, DeleteOutlined, SaveOutlined, UploadOutlined,
  PictureOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '../../utils/api'

const woStatusColorMap = {
  '未开工': 'default',
  '已开工': 'processing',
  '已关闭': 'warning',
}

const exceptionCategories = [
  { label: '换型换线', value: '换型换线' },
  { label: '停机待料', value: '停机待料' },
  { label: '故障维修', value: '故障维修' },
  { label: '其它停机', value: '其它停机' },
]

export default function ProcessReporting() {
  const [workOrders, setWorkOrders] = useState([])
  const [selectedWO, setSelectedWO] = useState(null)
  const [defectTypes, setDefectTypes] = useState([])
  const [devices, setDevices] = useState([])
  const [lineProcesses, setLineProcesses] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

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

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const [stats, setStats] = useState({
    inputQty: 0,
    outputQty: 0,
    defectMaterial: 0,
    defectProcess: 0,
    defectScrap: 0,
    exceptionHours: 0,
  })

  const markUnsaved = () => {
    setHasUnsavedChanges(true)
  }

  const clearUnsaved = () => {
    setHasUnsavedChanges(false)
  }

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
        const res = await api.get('/production/work-orders', { params: { page: 1, pageSize: 1000, status: '已开工,已关闭' } })
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
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = '当前页面存在未保存的数据，离开后将丢失。'
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hasUnsavedChanges])

  useEffect(() => {
    if (!selectedWO) {
      setLineProcesses([])
      setSelectedProcessId(null)
      setProdDefectList([])
      setScrapDefectList([])
      setExceptionList([])
      setManpowerList([])
      setMaterialList([])
      setStats({ inputQty: 0, outputQty: 0, defectMaterial: 0, defectProcess: 0, defectScrap: 0 })
      return
    }
    fetchLineProcesses(selectedWO.line_id)
    fetchAllData(selectedWO.work_order_id)
    fetchMaterials()
  }, [selectedWO])

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
    if (!selectedWO) {
      message.warning('请先选择工单')
      return false
    }
    try {
      setImageUploadLoading(true)
      const formData = new FormData()
      fileList.forEach(file => {
        formData.append('files', file.originFileObj || file)
      })
      const reportNo = selectedWO.work_order_no || 'REPORT'
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

  const fetchAllData = useCallback(async (woId) => {
    try {
      const [defectRes, scrapRes, exceptionRes, manpowerRes, materialRes] = await Promise.all([
        api.get('/production/process-defects', { params: { work_order_id: woId, page: 1, pageSize: 1000 } }),
        api.get('/production/scrap-defects', { params: { work_order_id: woId, page: 1, pageSize: 1000 } }),
        api.get('/production/process-exceptions', { params: { work_order_id: woId, page: 1, pageSize: 1000 } }),
        api.get('/production/manpower-records', { params: { work_order_id: woId, page: 1, pageSize: 1000 } }),
        api.get('/production/process-materials', { params: { work_order_id: woId, page: 1, pageSize: 1000 } }),
      ])
      setProdDefectList((defectRes.data || []).map(d => ({ ...d, id: d.defect_id, defect_images: parseImages(d.defect_images) })))
      setScrapDefectList((scrapRes.data || []).map(d => ({ ...d, id: d.scrap_id, defect_images: parseImages(d.defect_images) })))
      setExceptionList((exceptionRes.data || []).map(e => ({ ...e, id: e.exception_id, exception_images: parseImages(e.exception_images) })))
      setManpowerList(manpowerRes.data || [])
      setMaterialList((materialRes.data || []).map(m => ({ ...m, id: m.id, label_images: parseImages(m.label_images) })))

      const defectTotal = (defectRes.data || []).reduce((sum, d) => sum + (Number(d.quantity) || 0), 0)
      const scrapTotal = (scrapRes.data || []).reduce((sum, d) => sum + (Number(d.quantity) || 0), 0)
      const exceptionTotal = (exceptionRes.data || []).reduce((sum, e) => sum + (Number(e.duration) || 0), 0)

      let inputQty = 0
      if (lineProcesses.length > 0 && materialRes.data) {
        const firstProcessId = lineProcesses[0].process_id
        inputQty = (materialRes.data || []).reduce((sum, m) => {
          if (m.process_id === firstProcessId) {
            return sum + (Number(m.quantity) || 0)
          }
          return sum
        }, 0)
      }

      setStats({
        inputQty,
        outputQty: selectedWO?.finished_qty || 0,
        defectMaterial: defectTotal,
        defectProcess: defectTotal,
        defectScrap: scrapTotal,
        exceptionHours: exceptionTotal,
      })
    } catch (err) {
      message.error(err.message || '获取数据失败')
    }
  }, [selectedWO, lineProcesses])

  const fetchMaterials = useCallback(async () => {
    try {
      const res = await api.get('/basic/materials', { params: { page: 1, pageSize: 1000 } })
      setMaterials(res.data || [])
    } catch (err) {
      setMaterials([])
    }
  }, [])

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

  const usedDefectIds = useMemo(() => {
    return new Set(prodDefectList.map(d => d.defect_type_id))
  }, [prodDefectList])

  const addProdDefect = () => {
    const newItem = {
      id: Date.now(),
      work_order_id: selectedWO.work_order_id,
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
    setProdDefectList([...prodDefectList, newItem])
    markUnsaved()
  }

  const updateProdDefect = (id, field, value) => {
    setProdDefectList(prodDefectList.map(item => {
      if (item.id !== id) return item
      const updated = { ...item, [field]: value }
      if (field === 'defect_type_id') {
        const defect = defectTypeOptions.find(d => d.value === value)
        if (defect) {
          updated.defect_code = defect.defect_code
          updated.defect_type = defect.defect_type
          updated.defect_name = defect.defect_name
          updated.unit = defect.defect_unit || '默认单位'
        }
      }
      return updated
    }))
    markUnsaved()
  }

  const deleteProdDefect = (id) => {
    setProdDefectList(prodDefectList.filter(item => item.id !== id))
    markUnsaved()
  }

  const saveProdDefects = async () => {
    const validItems = prodDefectList.filter(d => d.defect_type_id && d.quantity > 0)
    if (validItems.length === 0) {
      message.warning('请填写有效的不良记录')
      return
    }
    try {
      setSaving(true)
      for (const item of validItems) {
        if (item.defect_id) {
          await api.put(`/production/process-defects/${item.defect_id}`, {
            quantity: item.quantity,
            unit: item.unit,
            defect_images: item.defect_images,
          })
        } else {
          await api.post('/production/process-defects', {
            work_order_id: item.work_order_id,
            process_id: item.process_id,
            defect_type_id: item.defect_type_id,
            quantity: item.quantity,
            unit: item.unit,
            defect_images: item.defect_images,
          })
        }
      }
      message.success('保存成功')
      fetchAllData(selectedWO.work_order_id)
      clearUnsaved()
    } catch (err) {
      message.error(err.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const addScrapDefect = () => {
    const newItem = {
      id: Date.now(),
      work_order_id: selectedWO.work_order_id,
      defect_type_id: null,
      defect_code: '',
      defect_name: '',
      quantity: 0,
      unit: '',
      defect_images: [],
    }
    setScrapDefectList([...scrapDefectList, newItem])
    markUnsaved()
  }

  const updateScrapDefect = (id, field, value) => {
    setScrapDefectList(scrapDefectList.map(item => {
      if (item.id !== id) return item
      const updated = { ...item, [field]: value }
      if (field === 'defect_type_id') {
        const defect = scrapTypeOptions.find(d => d.value === value)
        if (defect) {
          updated.defect_code = defect.defect_code
          updated.defect_name = defect.defect_name
          updated.unit = defect.defect_unit || '默认单位'
        }
      }
      return updated
    }))
    markUnsaved()
  }

  const deleteScrapDefect = (id) => {
    setScrapDefectList(scrapDefectList.filter(item => item.id !== id))
    markUnsaved()
  }

  const saveScrapDefects = async () => {
    const validItems = scrapDefectList.filter(d => d.defect_type_id && d.quantity > 0)
    if (validItems.length === 0) {
      message.warning('请填写有效的报废记录')
      return
    }
    try {
      setSaving(true)
      for (const item of validItems) {
        if (item.scrap_id) {
          await api.put(`/production/scrap-defects/${item.scrap_id}`, {
            quantity: item.quantity,
            unit: item.unit,
            defect_images: item.defect_images,
          })
        } else {
          await api.post('/production/scrap-defects', {
            work_order_id: item.work_order_id,
            defect_type_id: item.defect_type_id,
            quantity: item.quantity,
            unit: item.unit,
            defect_images: item.defect_images,
          })
        }
      }
      message.success('保存成功')
      fetchAllData(selectedWO.work_order_id)
      clearUnsaved()
    } catch (err) {
      message.error(err.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const addException = () => {
    const newItem = {
      id: Date.now(),
      work_order_id: selectedWO.work_order_id,
      exception_type: '',
      start_time: dayjs(),
      end_time: null,
      description: '',
      device_id: null,
      exception_images: [],
    }
    setExceptionList([...exceptionList, newItem])
    markUnsaved()
  }

  const updateException = (id, field, value) => {
    setExceptionList(exceptionList.map(item => item.id !== id ? item : { ...item, [field]: value }))
    markUnsaved()
  }

  const deleteException = (id) => {
    setExceptionList(exceptionList.filter(item => item.id !== id))
    markUnsaved()
  }

  const saveExceptions = async () => {
    const validItems = exceptionList.filter(e => e.exception_type && e.start_time)
    if (validItems.length === 0) {
      message.warning('请填写有效的异常记录')
      return
    }
    try {
      setSaving(true)
      for (const item of validItems) {
        if (item.exception_id) {
          await api.put(`/production/process-exceptions/${item.exception_id}`, {
            exception_type: item.exception_type,
            start_time: item.start_time.format ? item.start_time.format('YYYY-MM-DD HH:mm:ss') : item.start_time,
            end_time: item.end_time?.format ? item.end_time.format('YYYY-MM-DD HH:mm:ss') : item.end_time,
            description: item.description,
            device_id: item.device_id,
            exception_images: item.exception_images,
          })
        } else {
          await api.post('/production/process-exceptions', {
            work_order_id: item.work_order_id,
            exception_type: item.exception_type,
            start_time: item.start_time.format ? item.start_time.format('YYYY-MM-DD HH:mm:ss') : item.start_time,
            end_time: item.end_time?.format ? item.end_time.format('YYYY-MM-DD HH:mm:ss') : item.end_time,
            description: item.description,
            device_id: item.device_id,
            exception_images: item.exception_images,
          })
        }
      }
      message.success('保存成功')
      fetchAllData(selectedWO.work_order_id)
      clearUnsaved()
    } catch (err) {
      message.error(err.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const addManpower = () => {
    if (manpowerList.length >= 1) {
      message.warning('一个生产报工单只允许添加一条人员工时记录')
      return
    }
    const newItem = {
      id: Date.now(),
      work_order_id: selectedWO.work_order_id,
      record_date: dayjs(),
      shift: '白班',
      start_time: dayjs(),
      end_time: null,
      skilled_count: 0,
      general_count: 0,
      labor_count: 0,
      other_count: 0,
    }
    setManpowerList([...manpowerList, newItem])
  }

  const updateManpower = (id, field, value) => {
    setManpowerList(manpowerList.map(item => item.id !== id ? item : { ...item, [field]: value }))
    markUnsaved()
  }

  const deleteManpower = (id) => {
    setManpowerList(manpowerList.filter(item => item.id !== id))
    markUnsaved()
  }

  const saveManpower = async () => {
    const validItems = manpowerList.filter(m => {
      const total = (m.skilled_count || 0) + (m.general_count || 0) + (m.labor_count || 0) + (m.other_count || 0)
      return total > 0
    })
    if (validItems.length === 0) {
      message.warning('请填写有效的人员记录')
      return
    }
    try {
      setSaving(true)
      for (const item of validItems) {
        if (item.record_id) {
          await api.put(`/production/manpower-records/${item.record_id}`, {
            record_date: item.record_date.format ? item.record_date.format('YYYY-MM-DD') : item.record_date,
            shift: item.shift,
            start_time: item.start_time.format ? item.start_time.format('YYYY-MM-DD HH:mm:ss') : item.start_time,
            end_time: item.end_time?.format ? item.end_time.format('YYYY-MM-DD HH:mm:ss') : item.end_time,
            skilled_count: item.skilled_count,
            general_count: item.general_count,
            labor_count: item.labor_count,
            other_count: item.other_count,
          })
        } else {
          await api.post('/production/manpower-records', {
            work_order_id: item.work_order_id,
            record_date: item.record_date.format ? item.record_date.format('YYYY-MM-DD') : item.record_date,
            shift: item.shift,
            start_time: item.start_time.format ? item.start_time.format('YYYY-MM-DD HH:mm:ss') : item.start_time,
            end_time: item.end_time?.format ? item.end_time.format('YYYY-MM-DD HH:mm:ss') : item.end_time,
            skilled_count: item.skilled_count,
            general_count: item.general_count,
            labor_count: item.labor_count,
            other_count: item.other_count,
          })
        }
      }
      message.success('保存成功')
      fetchAllData(selectedWO.work_order_id)
      clearUnsaved()
    } catch (err) {
      message.error(err.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const addMaterial = () => {
    const newItem = {
      id: Date.now(),
      work_order_id: selectedWO.work_order_id,
      process_id: selectedProcessId,
      material_id: null,
      material_code: '',
      material_name: '',
      specification: '',
      material_batch: '',
      box_no: '',
      quantity: 0,
      label_images: [],
    }
    setMaterialList([...materialList, newItem])
    markUnsaved()
  }

  const updateMaterial = (id, field, value) => {
    setMaterialList(materialList.map(item => {
      if (item.id !== id) return item
      const updated = { ...item, [field]: value }
      if (field === 'material_id') {
        const material = materialOptions.find(m => m.value === value)
        if (material) {
          updated.material_code = material.material_code
          updated.material_name = material.material_name
          updated.specification = material.specification
        }
      }
      return updated
    }))
    markUnsaved()
  }

  const deleteMaterial = (id) => {
    setMaterialList(materialList.filter(item => item.id !== id))
    markUnsaved()
  }

  const saveMaterials = async () => {
    const validItems = materialList.filter(m => m.material_id && m.quantity > 0)
    if (validItems.length === 0) {
      message.warning('请填写有效的物料记录')
      return
    }
    try {
      setSaving(true)
      for (const item of validItems) {
        if (item.material_id) {
          if (item.id && typeof item.id === 'number') {
            await api.put(`/production/process-materials/${item.id}`, {
              process_id: item.process_id,
              material_type: '原材料',
              material_code: item.material_code,
              material_name: item.material_name,
              specification: item.specification,
              material_batch: item.material_batch,
              box_no: item.box_no,
              quantity: item.quantity,
              label_images: item.label_images,
            })
          } else {
            await api.post('/production/process-materials', {
              work_order_id: item.work_order_id,
              process_id: item.process_id,
              material_type: '原材料',
              material_code: item.material_code,
              material_name: item.material_name,
              specification: item.specification,
              material_batch: item.material_batch,
              quantity: item.quantity,
              label_images: item.label_images,
            })
          }
        }
      }
      message.success('保存成功')
      fetchAllData(selectedWO.work_order_id)
      clearUnsaved()
    } catch (err) {
      message.error(err.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const prodDefectColumns = [
    {
      title: '不良类型', key: 'defect_type',
      render: (_, r) => <Tag color="purple">{r.defect_type || '-'}</Tag>,
    },
    {
      title: '不良项目', key: 'defect_name',
      render: (_, r) => (
        <Select
          value={r.defect_type_id}
          onChange={(v) => updateProdDefect(r.id, 'defect_type_id', v)}
          placeholder="请选择不良项目"
          options={defectTypeOptions.filter(d => !usedDefectIds.has(d.value) || d.value === r.defect_type_id)}
        />
      ),
    },
    {
      title: '不良数量', key: 'quantity', align: 'right',
      render: (_, r) => (
        <InputNumber
          min={0}
          value={r.quantity}
          onChange={(v) => updateProdDefect(r.id, 'quantity', v)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '单位', key: 'unit',
      render: (_, r) => (
        <Select
          value={r.unit}
          onChange={(v) => updateProdDefect(r.id, 'unit', v)}
          options={[{ label: '默认单位', value: '默认单位' }]}
        />
      ),
    },
    {
      title: '不良图片', key: 'defect_images',
      render: (_, r) => (
        <Button
          type="link"
          icon={<PictureOutlined />}
          onClick={() => openImageDrawer('不良图片', r.defect_images || [], {
            listType: 'prodDefect',
            recordId: r.id,
            field: 'defect_images',
            category: 'defect',
          })}
        >
          {(r.defect_images || []).length} 张
        </Button>
      ),
    },
    {
      title: '操作', key: 'action',
      render: (_, r) => (
        <Popconfirm title="确认删除？" onConfirm={() => deleteProdDefect(r.id)}>
          <Button type="link" danger size="small"><DeleteOutlined /></Button>
        </Popconfirm>
      ),
    },
  ]

  const scrapDefectColumns = [
    {
      title: '不良编码', key: 'defect_code',
      render: (_, r) => r.defect_code || '-',
    },
    {
      title: '不良项目', key: 'defect_name',
      render: (_, r) => (
        <Select
          value={r.defect_type_id}
          onChange={(v) => updateScrapDefect(r.id, 'defect_type_id', v)}
          placeholder="请选择不良项目"
          options={scrapTypeOptions}
        />
      ),
    },
    {
      title: '不良数量', key: 'quantity', align: 'right',
      render: (_, r) => (
        <InputNumber
          min={0}
          value={r.quantity}
          onChange={(v) => updateScrapDefect(r.id, 'quantity', v)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '单位', key: 'unit',
      render: (_, r) => (
        <Select
          value={r.unit}
          onChange={(v) => updateScrapDefect(r.id, 'unit', v)}
          options={[{ label: '默认单位', value: '默认单位' }]}
        />
      ),
    },
    {
      title: '不良图片', key: 'defect_images',
      render: (_, r) => (
        <Button
          type="link"
          icon={<PictureOutlined />}
          onClick={() => openImageDrawer('不良图片', r.defect_images || [], {
            listType: 'scrapDefect',
            recordId: r.id,
            field: 'defect_images',
            category: 'scrap',
          })}
        >
          {(r.defect_images || []).length} 张
        </Button>
      ),
    },
    {
      title: '操作', key: 'action',
      render: (_, r) => (
        <Popconfirm title="确认删除？" onConfirm={() => deleteScrapDefect(r.id)}>
          <Button type="link" danger size="small"><DeleteOutlined /></Button>
        </Popconfirm>
      ),
    },
  ]

  const exceptionColumns = [
    {
      title: '异常类型', key: 'exception_type',
      render: (_, r) => (
        <Select
          value={r.exception_type}
          onChange={(v) => updateException(r.id, 'exception_type', v)}
          placeholder="请选择异常类型"
          options={exceptionCategories}
        />
      ),
    },
    {
      title: '开始时间', key: 'start_time',
      render: (_, r) => (
        <DatePicker
          showTime={{ format: 'HH:mm' }}
          format="YYYY-MM-DD HH:mm"
          value={r.start_time}
          onChange={(v) => updateException(r.id, 'start_time', v)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '恢复时间', key: 'end_time',
      render: (_, r) => (
        <DatePicker
          showTime={{ format: 'HH:mm' }}
          format="YYYY-MM-DD HH:mm"
          value={r.end_time}
          onChange={(v) => updateException(r.id, 'end_time', v)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '异常描述', key: 'description',
      render: (_, r) => (
        <Input
          value={r.description}
          onChange={(e) => updateException(r.id, 'description', e.target.value)}
          placeholder="请输入异常描述"
        />
      ),
    },
    {
      title: '维修设备', key: 'device_id',
      render: (_, r) => (
        <Select
          value={r.device_id}
          onChange={(v) => updateException(r.id, 'device_id', v)}
          placeholder="请选择设备"
          options={deviceOptions}
          disabled={r.exception_type !== '故障维修'}
        />
      ),
    },
    {
      title: '异常图片', key: 'exception_images',
      render: (_, r) => (
        <Button
          type="link"
          icon={<PictureOutlined />}
          onClick={() => openImageDrawer('异常图片', r.exception_images || [], {
            listType: 'exception',
            recordId: r.id,
            field: 'exception_images',
            category: 'exception',
          })}
        >
          {(r.exception_images || []).length} 张
        </Button>
      ),
    },
    {
      title: '操作', key: 'action',
      render: (_, r) => (
        <Popconfirm title="确认删除？" onConfirm={() => deleteException(r.id)}>
          <Button type="link" danger size="small"><DeleteOutlined /></Button>
        </Popconfirm>
      ),
    },
  ]

  const manpowerColumns = [
    {
      title: '日期', key: 'record_date',
      render: (_, r) => (
        <DatePicker
          format="YYYY-MM-DD"
          value={r.record_date}
          onChange={(v) => updateManpower(r.id, 'record_date', v)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '班次', key: 'shift',
      render: (_, r) => (
        <Select
          value={r.shift}
          onChange={(v) => updateManpower(r.id, 'shift', v)}
          options={[{ label: '白班', value: '白班' }, { label: '夜班', value: '夜班' }]}
        />
      ),
    },
    {
      title: '开始时间', key: 'start_time',
      render: (_, r) => (
        <DatePicker
          showTime={{ format: 'HH:mm' }}
          format="HH:mm"
          value={r.start_time}
          onChange={(v) => updateManpower(r.id, 'start_time', v)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '结束时间', key: 'end_time',
      render: (_, r) => (
        <DatePicker
          showTime={{ format: 'HH:mm' }}
          format="HH:mm"
          value={r.end_time}
          onChange={(v) => updateManpower(r.id, 'end_time', v)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '技工', key: 'skilled_count', align: 'right',
      render: (_, r) => (
        <InputNumber
          min={0}
          value={r.skilled_count}
          onChange={(v) => updateManpower(r.id, 'skilled_count', v)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '普工', key: 'general_count', align: 'right',
      render: (_, r) => (
        <InputNumber
          min={0}
          value={r.general_count}
          onChange={(v) => updateManpower(r.id, 'general_count', v)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '劳务工', key: 'labor_count', align: 'right',
      render: (_, r) => (
        <InputNumber
          min={0}
          value={r.labor_count}
          onChange={(v) => updateManpower(r.id, 'labor_count', v)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '其他', key: 'other_count', align: 'right',
      render: (_, r) => (
        <InputNumber
          min={0}
          value={r.other_count}
          onChange={(v) => updateManpower(r.id, 'other_count', v)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '操作', key: 'action',
      render: (_, r) => (
        <Popconfirm title="确认删除？" onConfirm={() => deleteManpower(r.id)}>
          <Button type="link" danger size="small"><DeleteOutlined /></Button>
        </Popconfirm>
      ),
    },
  ]

  const materialColumns = [
    {
      title: '料号', key: 'material_code',
      render: (_, r) => r.material_code || '-',
    },
    {
      title: '料品名称', key: 'material_name',
      render: (_, r) => (
        <Select
          value={r.material_id}
          onChange={(v) => updateMaterial(r.id, 'material_id', v)}
          placeholder="请选择料品"
          options={materialOptions}
        />
      ),
    },
    {
      title: '规格', key: 'specification',
      render: (_, r) => r.specification || '-',
    },
    {
      title: '批号', key: 'material_batch',
      render: (_, r) => (
        <Input
          value={r.material_batch}
          onChange={(e) => updateMaterial(r.id, 'material_batch', e.target.value)}
          placeholder="请输入批号"
        />
      ),
    },
    {
      title: '包(箱)号', key: 'box_no',
      render: (_, r) => (
        <Input
          value={r.box_no}
          onChange={(e) => updateMaterial(r.id, 'box_no', e.target.value)}
          placeholder="请输入包(箱)号"
        />
      ),
    },
    {
      title: '数量', key: 'quantity', align: 'right',
      render: (_, r) => (
        <InputNumber
          min={0}
          value={r.quantity}
          onChange={(v) => updateMaterial(r.id, 'quantity', v)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '标签图片', key: 'label_images',
      render: (_, r) => (
        <Button
          type="link"
          icon={<PictureOutlined />}
          onClick={() => openImageDrawer('标签图片', r.label_images || [], {
            listType: 'material',
            recordId: r.id,
            field: 'label_images',
            category: 'label',
          })}
        >
          {(r.label_images || []).length} 张
        </Button>
      ),
    },
    {
      title: '操作', key: 'action',
      render: (_, r) => (
        <Popconfirm title="确认删除？" onConfirm={() => deleteMaterial(r.id)}>
          <Button type="link" danger size="small"><DeleteOutlined /></Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <div className="page-container">
      <Card className="page-header-card">
        <div style={{ marginBottom: 16 }}>
          <label style={{ marginRight: 8, fontWeight: 500 }}>选择生产工单：</label>
          <Select
          value={selectedWO?.work_order_id}
          onChange={(v) => {
            if (hasUnsavedChanges) {
              Modal.confirm({
                title: '提示',
                content: '当前页面存在未保存的数据，切换工单后将丢失。是否继续？',
                okText: '继续切换',
                cancelText: '取消',
                onOk: () => {
                  setSelectedWO(workOrders.find(w => w.work_order_id === v))
                  clearUnsaved()
                },
              })
            } else {
              setSelectedWO(workOrders.find(w => w.work_order_id === v))
            }
          }}
          placeholder="请选择生产工单"
          style={{ minWidth: 400 }}
          loading={loading}
          popupMatchSelectWidth={false}
          options={workOrders.map(w => ({
            label: `${w.work_order_no} ${w.material_name}`,
            value: w.work_order_id,
          }))}
        />
        </div>

        {selectedWO && (
          <div style={{ fontSize: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '120px' }}>
                <div className="stat-label" style={{ fontSize: '14px', color: '#999', marginBottom: 4 }}>生产报工单号</div>
                <div className="stat-value" style={{ fontSize: '16px', fontWeight: 600 }}>{selectedWO.work_order_no}</div>
              </div>
              <div style={{ width: '120px' }}>
                <div className="stat-label" style={{ fontSize: '14px', color: '#999', marginBottom: 4 }}>物料编码</div>
                <div className="stat-value" style={{ fontSize: '16px', fontWeight: 600 }}>{selectedWO.material_code}</div>
              </div>
              <div style={{ width: '80px' }}>
                <div className="stat-label" style={{ fontSize: '14px', color: '#999', marginBottom: 4 }}>产线</div>
                <div className="stat-value" style={{ fontSize: '16px', fontWeight: 600 }}>{selectedWO.line_name}</div>
              </div>
              <div style={{ width: '100px' }}>
                <div className="stat-label" style={{ fontSize: '14px', color: '#999', marginBottom: 4 }}>状态</div>
                <div className="stat-value" style={{ fontSize: '16px', fontWeight: 600 }}>
                  <Tag color={woStatusColorMap[selectedWO.status]} style={{ fontSize: '14px' }}>{selectedWO.status}</Tag>
                </div>
              </div>
              <div style={{ minWidth: '200px', flex: 1 }}>
                <div className="stat-label" style={{ fontSize: '14px', color: '#999', marginBottom: 4 }}>物料名称</div>
                <div className="stat-value" style={{ fontSize: '16px', fontWeight: 600 }}>{selectedWO.material_name}</div>
              </div>
            </div>
            <Divider style={{ margin: '12px 0' }} />
            <Row gutter={16}>
              <Col span={3}>
                <div className="stat-item" style={{ fontSize: '16px' }}>
                  <div className="stat-label" style={{ fontSize: '14px', color: '#999', marginBottom: 4 }}>计划数量</div>
                  <div className="stat-value" style={{ fontSize: '16px', fontWeight: 600 }}>{selectedWO.planned_qty}</div>
                </div>
              </Col>
              <Col span={3}>
                <div className="stat-item" style={{ fontSize: '16px' }}>
                  <div className="stat-label" style={{ fontSize: '14px', color: '#999', marginBottom: 4 }}>投入数量</div>
                  <div className="stat-value" style={{ fontSize: '16px', fontWeight: 600 }}>{stats.inputQty}</div>
                </div>
              </Col>
              <Col span={3}>
                <div className="stat-item" style={{ fontSize: '16px' }}>
                  <div className="stat-label" style={{ fontSize: '14px', color: '#999', marginBottom: 4 }}>产出数量</div>
                  <div className="stat-value" style={{ fontSize: '16px', fontWeight: 600 }}>{stats.outputQty}</div>
                </div>
              </Col>
              <Col span={3}>
                <div className="stat-item" style={{ fontSize: '16px' }}>
                  <div className="stat-label" style={{ fontSize: '14px', color: '#999', marginBottom: 4 }}>来料不良汇总</div>
                  <div className="stat-value" style={{ fontSize: '16px', fontWeight: 600 }}>{stats.defectMaterial}</div>
                </div>
              </Col>
              <Col span={3}>
                <div className="stat-item" style={{ fontSize: '16px' }}>
                  <div className="stat-label" style={{ fontSize: '14px', color: '#999', marginBottom: 4 }}>制程不良汇总</div>
                  <div className="stat-value" style={{ fontSize: '16px', fontWeight: 600 }}>{stats.defectProcess}</div>
                </div>
              </Col>
              <Col span={3}>
                <div className="stat-item" style={{ fontSize: '16px' }}>
                  <div className="stat-label" style={{ fontSize: '14px', color: '#999', marginBottom: 4 }}>检验报废汇总</div>
                  <div className="stat-value" style={{ fontSize: '16px', fontWeight: 600 }}>{stats.defectScrap}</div>
                </div>
              </Col>
              <Col span={3}>
                <div className="stat-item" style={{ fontSize: '16px' }}>
                  <div className="stat-label" style={{ fontSize: '14px', color: '#999', marginBottom: 4 }}>异常工时汇总</div>
                  <div className="stat-value" style={{ fontSize: '16px', fontWeight: 600 }}>{stats.exceptionHours}</div>
                </div>
              </Col>
            </Row>
          </div>
        )}
      </Card>

      {selectedWO && (
        <Card>
          <Tabs 
          activeKey={activeTab} 
          onChange={(key) => {
            if (hasUnsavedChanges) {
              Modal.confirm({
                title: '提示',
                content: '当前页面存在未保存的数据，离开后将丢失。是否继续？',
                okText: '继续离开',
                cancelText: '取消',
                onOk: () => {
                  setActiveTab(key)
                  clearUnsaved()
                },
              })
            } else {
              setActiveTab(key)
            }
          }} 
          size="small"
        >
            <Tabs.TabPane tab="生产不良记录" key="production-defect">
              <div style={{ marginBottom: 16 }}>
                <label style={{ marginRight: 8, fontWeight: 500 }}>选择工序：</label>
                <Select
                  value={selectedProcessId}
                  onChange={setSelectedProcessId}
                  placeholder="请选择工序"
                  style={{ width: 250 }}
                  options={lineProcesses.map(p => ({
                    label: `${p.process_code} ${p.process_name}`,
                    value: p.process_id,
                  }))}
                />
                <Button type="primary" icon={<PlusOutlined />} onClick={addProdDefect} style={{ marginLeft: 16 }}>
                  添加不良记录
                </Button>
                <Button icon={<SaveOutlined />} onClick={saveProdDefects} loading={saving} style={{ marginLeft: 8 }}>
                  保存
                </Button>
              </div>
              <Table
                dataSource={prodDefectList}
                columns={prodDefectColumns}
                rowKey="id"
                pagination={false}
                bordered
                scroll={{ x: 'max-content' }}
              />
            </Tabs.TabPane>

            <Tabs.TabPane tab="检验报废记录" key="scrap-defect">
              <div style={{ marginBottom: 16 }}>
                <Button type="primary" icon={<PlusOutlined />} onClick={addScrapDefect}>
                  添加报废记录
                </Button>
                <Button icon={<SaveOutlined />} onClick={saveScrapDefects} loading={saving} style={{ marginLeft: 8 }}>
                  保存
                </Button>
              </div>
              <Table
                dataSource={scrapDefectList}
                columns={scrapDefectColumns}
                rowKey="id"
                pagination={false}
                bordered
                scroll={{ x: 'max-content' }}
              />
            </Tabs.TabPane>

            <Tabs.TabPane tab="生产物料记录" key="material">
              <div style={{ marginBottom: 16 }}>
                <label style={{ marginRight: 8, fontWeight: 500 }}>选择工序：</label>
                <Select
                  value={selectedProcessId}
                  onChange={setSelectedProcessId}
                  placeholder="请选择工序"
                  style={{ width: 250 }}
                  options={lineProcesses.map(p => ({
                    label: `${p.process_code} ${p.process_name}`,
                    value: p.process_id,
                  }))}
                />
                <Button type="primary" icon={<PlusOutlined />} onClick={addMaterial} style={{ marginLeft: 16 }}>
                  添加物料记录
                </Button>
                <Button icon={<SaveOutlined />} onClick={saveMaterials} loading={saving} style={{ marginLeft: 8 }}>
                  保存
                </Button>
              </div>
              <Table
                dataSource={materialList}
                columns={materialColumns}
                rowKey="id"
                pagination={false}
                bordered
                scroll={{ x: 'max-content' }}
              />
            </Tabs.TabPane>

            <Tabs.TabPane tab="异常工时记录" key="exception">
              <div style={{ marginBottom: 16 }}>
                <Button type="primary" icon={<PlusOutlined />} onClick={addException}>
                  添加异常记录
                </Button>
                <Button icon={<SaveOutlined />} onClick={saveExceptions} loading={saving} style={{ marginLeft: 8 }}>
                  保存
                </Button>
              </div>
              <Table
                dataSource={exceptionList}
                columns={exceptionColumns}
                rowKey="id"
                pagination={false}
                bordered
                scroll={{ x: 'max-content' }}
              />
            </Tabs.TabPane>

            <Tabs.TabPane tab="人员工时记录" key="manpower">
              <div style={{ marginBottom: 16 }}>
                <Button type="primary" icon={<PlusOutlined />} onClick={addManpower}>
                  添加人员记录
                </Button>
                <Button icon={<SaveOutlined />} onClick={saveManpower} loading={saving} style={{ marginLeft: 8 }}>
                  保存
                </Button>
              </div>
              <Table
                dataSource={manpowerList}
                columns={manpowerColumns}
                rowKey="id"
                pagination={false}
                bordered
                scroll={{ x: 'max-content' }}
              />
            </Tabs.TabPane>
          </Tabs>
        </Card>
      )}

      <Drawer
        title={imageDrawerTitle}
        placement="right"
        width={600}
        open={imageDrawerVisible}
        onClose={closeImageDrawer}
      >
        <div style={{ marginBottom: 16 }}>
          <Upload
            multiple
            listType="picture-card"
            showUploadList={false}
            accept="image/*"
            beforeUpload={() => false}
            onChange={(info) => {
              if (info.fileList.length > 0) {
                handleImageUpload(info.fileList)
              }
            }}
            disabled={imageUploadLoading}
          >
            <div>
              <UploadOutlined />
              <div style={{ marginTop: 8 }}>上传图片</div>
            </div>
          </Upload>
        </div>
        <Divider style={{ margin: '16px 0' }} />
        {currentImageList.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>
            暂无图片
          </div>
        ) : (
          <Row gutter={[12, 12]}>
            {currentImageList.map((img, index) => (
              <Col span={12} key={index}>
                <div style={{ position: 'relative' }}>
                  <Image
                    src={img}
                    width="100%"
                    style={{ borderRadius: 4 }}
                  />
                  <Button
                    type="primary"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                    }}
                    onClick={() => handleDeleteImage(index)}
                  />
                </div>
              </Col>
            ))}
          </Row>
        )}
      </Drawer>
    </div>
  )
}