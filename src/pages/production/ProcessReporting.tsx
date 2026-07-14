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
  const [reportStatus, setReportStatus] = useState('开始报工')
  const [defectTypes, setDefectTypes] = useState([])
  const [devices, setDevices] = useState([])
  const [lineProcesses, setLineProcesses] = useState([])
  const [loading, setLoading] = useState(false)
  const [togglingStatus, setTogglingStatus] = useState(false)

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
      setLineProcesses([])
      setSelectedProcessId(null)
      setProdDefectList([])
      setScrapDefectList([])
      setExceptionList([])
      setManpowerList([])
      setMaterialList([])
      setStats({ inputQty: 0, outputQty: 0, defectMaterial: 0, defectProcess: 0, defectScrap: 0 })
      setReportStatus('开始报工')
      return
    }
    setReportStatus(selectedWO.report_status || '开始报工')
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
      setManpowerList((manpowerRes.data || []).map(m => ({ ...m, id: m.record_id })))
      setMaterialList((materialRes.data || []).map(m => ({ ...m, id: m.material_id, label_images: parseImages(m.label_images) })))

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

  const isEditable = reportStatus === '开始报工'

  const handleToggleReportStatus = () => {
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
          const res = await api.post(`/production/work-orders/${selectedWO.work_order_id}/report-status`, { action })
          setReportStatus(res.data?.report_status || (action === 'end' ? '结束报工' : '开始报工'))
          setSelectedWO(prev => prev ? { ...prev, report_status: res.data?.report_status } : null)
          message.success(res.message || '操作成功')
          fetchAllData(selectedWO.work_order_id)
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

  const usedDefectIds = useMemo(() => {
    return new Set(prodDefectList.filter(d => d.defect_type_id).map(d => d.defect_type_id))
  }, [prodDefectList])

  const debouncedSave = (key, saveFn) => {
    if (savingRef.current[key]) {
      clearTimeout(savingRef.current[key])
    }
    savingRef.current[key] = setTimeout(() => {
      saveFn()
    }, 800)
  }

  const saveProdDefectItem = async (item) => {
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
        const res = await api.post('/production/process-defects', {
          work_order_id: item.work_order_id,
          process_id: item.process_id,
          defect_category: item.defect_type || item.defect_category,
          defect_name: item.defect_name,
          defect_type_id: item.defect_type_id,
          quantity: item.quantity,
          unit: item.unit,
          defect_images: item.defect_images,
        })
        setProdDefectList(prev => prev.map(d => {
          if (d.id === item.id && !d.defect_id) {
          return { ...d, defect_id: res.data?.defect_id, id: res.data?.defect_id || d.id }
        }
          return d
        }))
      }
    } catch (err) {
      message.error(err.message || '保存失败')
    }
  }

  const updateProdDefect = (id, field, value) => {
    if (!isEditable) return
    setProdDefectList(prev => {
      const updated = prev.map(item => {
        if (item.id !== id) return item
        const newItem = { ...item, [field]: value }
        if (field === 'defect_type_id') {
          const defect = defectTypeOptions.find(d => d.value === value)
          if (defect) {
            newItem.defect_code = defect.defect_code
            newItem.defect_type = defect.defect_type
            newItem.defect_name = defect.defect_name
            newItem.unit = defect.defect_unit || '默认单位'
          }
        }
        return newItem
      })

      const isEmptyRow = !prev.find(item => item.id === id)?.defect_id
      const current = updated.find(item => item.id === id)
      const hasContent = current?.defect_type_id && current?.quantity > 0

      if (isEmptyRow && hasContent) {
        const newEmptyRow = {
          id: genTempId(),
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
        debouncedSave(id, () => saveProdDefectItem(current))
        return [...updated, newEmptyRow]
      }

      if (!isEmptyRow) {
        debouncedSave(id, () => saveProdDefectItem(current))
      }

      return updated
    })
  }

  const deleteProdDefect = async (id) => {
    const item = prodDefectList.find(d => d.id === id)
    if (item?.defect_id) {
      try {
        await api.delete(`/production/process-defects/${item.defect_id}`)
        message.success('删除成功')
      } catch (err) {
        message.error(err.message || '删除失败')
        return
      }
    }
    setProdDefectList(prev => prev.filter(d => d.id !== id))
  }

  const prodDefectDisplayList = useMemo(() => {
    if (!isEditable || !selectedWO) return prodDefectList
    const hasEmptyRow = prodDefectList.some(d => !d.defect_id)
    if (hasEmptyRow) return prodDefectList
    const emptyRow = {
      id: genTempId(),
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
    return [...prodDefectList, emptyRow]
  }, [prodDefectList, isEditable, selectedWO, selectedProcessId])

  const prodDefectColumns = [
    {
      title: '不良类型', key: 'defect_type', width: 100,
      render: (_, r) => <Tag color="purple">{r.defect_type || '-'}</Tag>,
    },
    {
      title: '不良项目', key: 'defect_name', width: 280,
      render: (_, r) => (
        <Select
          value={r.defect_type_id || undefined}
          onChange={(v) => updateProdDefect(r.id, 'defect_type_id', v)}
          placeholder="请选择不良项目"
          options={defectTypeOptions.filter(d => !usedDefectIds.has(d.value) || d.value === r.defect_type_id)}
          disabled={!isEditable}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '不良数量', key: 'quantity', width: 120, align: 'right',
      render: (_, r) => (
        <InputNumber
          min={0}
          value={r.quantity}
          onChange={(v) => updateProdDefect(r.id, 'quantity', v)}
          style={{ width: '100%' }}
          disabled={!isEditable}
        />
      ),
    },
    {
      title: '单位', key: 'unit', width: 100,
      render: (_, r) => (
        <Select
          value={r.unit || undefined}
          onChange={(v) => updateProdDefect(r.id, 'unit', v)}
          options={[{ label: '默认单位', value: '默认单位' }]}
          disabled={!isEditable}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '不良图片', key: 'defect_images', width: 100,
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
      title: '操作', key: 'action', width: 60,
      render: (_, r) => {
        if (!r.defect_id) return null
        return (
          <Popconfirm title="确认删除？" onConfirm={() => deleteProdDefect(r.id)} disabled={!isEditable}>
            <Button type="link" danger size="small" disabled={!isEditable}><DeleteOutlined /></Button>
          </Popconfirm>
        )
      },
    },
  ]

  const saveScrapDefectItem = async (item) => {
    try {
      if (item.scrap_id) {
        await api.put(`/production/scrap-defects/${item.scrap_id}`, {
          quantity: item.quantity,
          unit: item.unit,
          defect_images: item.defect_images,
        })
      } else {
        const res = await api.post('/production/scrap-defects', {
          work_order_id: item.work_order_id,
          defect_type_id: item.defect_type_id,
          quantity: item.quantity,
          unit: item.unit,
          defect_images: item.defect_images,
        })
        setScrapDefectList(prev => prev.map(d => {
          if (d.id === item.id && !d.scrap_id) {
            return { ...d, scrap_id: res.data?.scrap_id, id: res.data?.scrap_id || d.id }
          }
          return d
        }))
      }
    } catch (err) {
      message.error(err.message || '保存失败')
    }
  }

  const updateScrapDefect = (id, field, value) => {
    if (!isEditable) return
    setScrapDefectList(prev => {
      const updated = prev.map(item => {
        if (item.id !== id) return item
        const newItem = { ...item, [field]: value }
        if (field === 'defect_type_id') {
          const defect = scrapTypeOptions.find(d => d.value === value)
          if (defect) {
            newItem.defect_code = defect.defect_code
            newItem.defect_name = defect.defect_name
            newItem.unit = defect.defect_unit || '默认单位'
          }
        }
        return newItem
      })

      const isEmptyRow = !prev.find(item => item.id === id)?.scrap_id
      const current = updated.find(item => item.id === id)
      const hasContent = current?.defect_type_id && current?.quantity > 0

      if (isEmptyRow && hasContent) {
        const newEmptyRow = {
          id: genTempId(),
          work_order_id: selectedWO?.work_order_id,
          defect_type_id: null,
          defect_code: '',
          defect_name: '',
          quantity: 0,
          unit: '',
          defect_images: [],
        }
        debouncedSave(id, () => saveScrapDefectItem(current))
        return [...updated, newEmptyRow]
      }

      if (!isEmptyRow) {
        debouncedSave(id, () => saveScrapDefectItem(current))
      }

      return updated
    })
  }

  const deleteScrapDefect = async (id) => {
    const item = scrapDefectList.find(d => d.id === id)
    if (item?.scrap_id) {
      try {
        await api.delete(`/production/scrap-defects/${item.scrap_id}`)
        message.success('删除成功')
      } catch (err) {
        message.error(err.message || '删除失败')
        return
      }
    }
    setScrapDefectList(prev => prev.filter(d => d.id !== id))
  }

  const scrapDefectDisplayList = useMemo(() => {
    if (!isEditable || !selectedWO) return scrapDefectList
    const hasEmptyRow = scrapDefectList.some(d => !d.scrap_id)
    if (hasEmptyRow) return scrapDefectList
    const emptyRow = {
      id: genTempId(),
      work_order_id: selectedWO.work_order_id,
      defect_type_id: null,
      defect_code: '',
      defect_name: '',
      quantity: 0,
      unit: '',
      defect_images: [],
    }
    return [...scrapDefectList, emptyRow]
  }, [scrapDefectList, isEditable, selectedWO])

  const scrapDefectColumns = [
    {
      title: '不良编码', key: 'defect_code', width: 100,
      render: (_, r) => r.defect_code || '-',
    },
    {
      title: '不良项目', key: 'defect_name', width: 250,
      render: (_, r) => (
        <Select
          value={r.defect_type_id || undefined}
          onChange={(v) => updateScrapDefect(r.id, 'defect_type_id', v)}
          placeholder="请选择不良项目"
          options={scrapTypeOptions}
          disabled={!isEditable}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '不良数量', key: 'quantity', width: 120, align: 'right',
      render: (_, r) => (
        <InputNumber
          min={0}
          value={r.quantity}
          onChange={(v) => updateScrapDefect(r.id, 'quantity', v)}
          style={{ width: '100%' }}
          disabled={!isEditable}
        />
      ),
    },
    {
      title: '单位', key: 'unit', width: 100,
      render: (_, r) => (
        <Select
          value={r.unit || undefined}
          onChange={(v) => updateScrapDefect(r.id, 'unit', v)}
          options={[{ label: '默认单位', value: '默认单位' }]}
          disabled={!isEditable}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '不良图片', key: 'defect_images', width: 100,
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
      title: '操作', key: 'action', width: 60,
      render: (_, r) => {
        if (!r.scrap_id) return null
        return (
          <Popconfirm title="确认删除？" onConfirm={() => deleteScrapDefect(r.id)} disabled={!isEditable}>
            <Button type="link" danger size="small" disabled={!isEditable}><DeleteOutlined /></Button>
          </Popconfirm>
        )
      },
    },
  ]

  const saveExceptionItem = async (item) => {
    try {
      const payload = {
        exception_type: item.exception_type,
        start_time: item.start_time?.format ? item.start_time.format('YYYY-MM-DD HH:mm:ss') : item.start_time,
        end_time: item.end_time?.format ? item.end_time.format('YYYY-MM-DD HH:mm:ss') : item.end_time,
        description: item.description,
        device_id: item.device_id,
        exception_images: item.exception_images,
      }
      if (item.exception_id) {
        await api.put(`/production/process-exceptions/${item.exception_id}`, payload)
      } else {
        const res = await api.post('/production/process-exceptions', {
          work_order_id: item.work_order_id,
          ...payload,
        })
        setExceptionList(prev => prev.map(e => {
          if (e.id === item.id && !e.exception_id) {
            return { ...e, exception_id: res.data?.exception_id, id: res.data?.exception_id || e.id }
          }
          return e
        }))
      }
    } catch (err) {
      message.error(err.message || '保存失败')
    }
  }

  const updateException = (id, field, value) => {
    if (!isEditable) return
    setExceptionList(prev => {
      const updated = prev.map(item => item.id !== id ? item : { ...item, [field]: value })

      const isEmptyRow = !prev.find(item => item.id === id)?.exception_id
      const current = updated.find(item => item.id === id)
      const hasContent = current?.exception_type

      if (isEmptyRow && hasContent) {
        const newEmptyRow = {
          id: genTempId(),
          work_order_id: selectedWO?.work_order_id,
          exception_type: '',
          start_time: dayjs(),
          end_time: null,
          description: '',
          device_id: null,
          exception_images: [],
        }
        debouncedSave(id, () => saveExceptionItem(current))
        return [...updated, newEmptyRow]
      }

      if (!isEmptyRow) {
        debouncedSave(id, () => saveExceptionItem(current))
      }

      return updated
    })
  }

  const deleteException = async (id) => {
    const item = exceptionList.find(e => e.id === id)
    if (item?.exception_id) {
      try {
        await api.delete(`/production/process-exceptions/${item.exception_id}`)
        message.success('删除成功')
      } catch (err) {
        message.error(err.message || '删除失败')
        return
      }
    }
    setExceptionList(prev => prev.filter(e => e.id !== id))
  }

  const exceptionDisplayList = useMemo(() => {
    if (!isEditable || !selectedWO) return exceptionList
    const hasEmptyRow = exceptionList.some(e => !e.exception_id)
    if (hasEmptyRow) return exceptionList
    const emptyRow = {
      id: genTempId(),
      work_order_id: selectedWO.work_order_id,
      exception_type: '',
      start_time: dayjs(),
      end_time: null,
      description: '',
      device_id: null,
      exception_images: [],
    }
    return [...exceptionList, emptyRow]
  }, [exceptionList, isEditable, selectedWO])

  const exceptionColumns = [
    {
      title: '异常类型', key: 'exception_type', width: 130,
      render: (_, r) => (
        <Select
          value={r.exception_type || undefined}
          onChange={(v) => updateException(r.id, 'exception_type', v)}
          placeholder="请选择异常类型"
          options={exceptionCategories}
          disabled={!isEditable}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '开始时间', key: 'start_time', width: 170,
      render: (_, r) => (
        <DatePicker
          showTime={{ format: 'HH:mm' }}
          format="YYYY-MM-DD HH:mm"
          value={r.start_time}
          onChange={(v) => updateException(r.id, 'start_time', v)}
          style={{ width: '100%' }}
          disabled={!isEditable}
        />
      ),
    },
    {
      title: '恢复时间', key: 'end_time', width: 170,
      render: (_, r) => (
        <DatePicker
          showTime={{ format: 'HH:mm' }}
          format="YYYY-MM-DD HH:mm"
          value={r.end_time}
          onChange={(v) => updateException(r.id, 'end_time', v)}
          style={{ width: '100%' }}
          disabled={!isEditable}
        />
      ),
    },
    {
      title: '异常描述', key: 'description', width: 200,
      render: (_, r) => (
        <Input
          value={r.description}
          onChange={(e) => updateException(r.id, 'description', e.target.value)}
          placeholder="请输入异常描述"
          disabled={!isEditable}
        />
      ),
    },
    {
      title: '维修设备', key: 'device_id', width: 180,
      render: (_, r) => (
        <Select
          value={r.device_id || undefined}
          onChange={(v) => updateException(r.id, 'device_id', v)}
          placeholder="请选择设备"
          options={deviceOptions}
          disabled={!isEditable || r.exception_type !== '故障维修'}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '异常图片', key: 'exception_images', width: 100,
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
      title: '操作', key: 'action', width: 60,
      render: (_, r) => {
        if (!r.exception_id) return null
        return (
          <Popconfirm title="确认删除？" onConfirm={() => deleteException(r.id)} disabled={!isEditable}>
            <Button type="link" danger size="small" disabled={!isEditable}><DeleteOutlined /></Button>
          </Popconfirm>
        )
      },
    },
  ]

  const saveManpowerItem = async (item) => {
    try {
      const payload = {
        record_date: item.record_date?.format ? item.record_date.format('YYYY-MM-DD') : item.record_date,
        shift: item.shift,
        start_time: item.start_time?.format ? item.start_time.format('YYYY-MM-DD HH:mm:ss') : item.start_time,
        end_time: item.end_time?.format ? item.end_time.format('YYYY-MM-DD HH:mm:ss') : item.end_time,
        skilled_count: item.skilled_count,
        general_count: item.general_count,
        labor_count: item.labor_count,
        other_count: item.other_count,
      }
      if (item.record_id) {
        await api.put(`/production/manpower-records/${item.record_id}`, payload)
      } else {
        const res = await api.post('/production/manpower-records', {
          work_order_id: item.work_order_id,
          ...payload,
        })
        setManpowerList(prev => prev.map(m => {
          if (m.id === item.id && !m.record_id) {
            return { ...m, record_id: res.data?.record_id, id: res.data?.record_id || m.id }
          }
          return m
        }))
      }
    } catch (err) {
      message.error(err.message || '保存失败')
    }
  }

  const updateManpower = (id, field, value) => {
    if (!isEditable) return
    setManpowerList(prev => {
      const updated = prev.map(item => item.id !== id ? item : { ...item, [field]: value })

      const isEmptyRow = !prev.find(item => item.id === id)?.record_id
      const current = updated.find(item => item.id === id)
      const total = (current?.skilled_count || 0) + (current?.general_count || 0) + (current?.labor_count || 0) + (current?.other_count || 0)
      const hasContent = total > 0

      if (isEmptyRow && hasContent) {
        const newEmptyRow = {
          id: genTempId(),
          work_order_id: selectedWO?.work_order_id,
          record_date: dayjs(),
          shift: '白班',
          start_time: dayjs(),
          end_time: null,
          skilled_count: 0,
          general_count: 0,
          labor_count: 0,
          other_count: 0,
        }
        debouncedSave(id, () => saveManpowerItem(current))
        return [...updated, newEmptyRow]
      }

      if (!isEmptyRow) {
        debouncedSave(id, () => saveManpowerItem(current))
      }

      return updated
    })
  }

  const deleteManpower = async (id) => {
    const item = manpowerList.find(m => m.id === id)
    if (item?.record_id) {
      try {
        await api.delete(`/production/manpower-records/${item.record_id}`)
        message.success('删除成功')
      } catch (err) {
        message.error(err.message || '删除失败')
        return
      }
    }
    setManpowerList(prev => prev.filter(m => m.id !== id))
  }

  const manpowerDisplayList = useMemo(() => {
    if (!isEditable || !selectedWO) return manpowerList
    const hasEmptyRow = manpowerList.some(m => !m.record_id)
    if (hasEmptyRow) return manpowerList
    const emptyRow = {
      id: genTempId(),
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
    return [...manpowerList, emptyRow]
  }, [manpowerList, isEditable, selectedWO])

  const manpowerColumns = [
    {
      title: '日期', key: 'record_date', width: 140,
      render: (_, r) => (
        <DatePicker
          format="YYYY-MM-DD"
          value={r.record_date}
          onChange={(v) => updateManpower(r.id, 'record_date', v)}
          style={{ width: '100%' }}
          disabled={!isEditable}
        />
      ),
    },
    {
      title: '班次', key: 'shift', width: 100,
      render: (_, r) => (
        <Select
          value={r.shift}
          onChange={(v) => updateManpower(r.id, 'shift', v)}
          options={[{ label: '白班', value: '白班' }, { label: '夜班', value: '夜班' }]}
          disabled={!isEditable}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '开始时间', key: 'start_time', width: 130,
      render: (_, r) => (
        <DatePicker
          showTime={{ format: 'HH:mm' }}
          format="HH:mm"
          value={r.start_time}
          onChange={(v) => updateManpower(r.id, 'start_time', v)}
          style={{ width: '100%' }}
          disabled={!isEditable}
        />
      ),
    },
    {
      title: '结束时间', key: 'end_time', width: 130,
      render: (_, r) => (
        <DatePicker
          showTime={{ format: 'HH:mm' }}
          format="HH:mm"
          value={r.end_time}
          onChange={(v) => updateManpower(r.id, 'end_time', v)}
          style={{ width: '100%' }}
          disabled={!isEditable}
        />
      ),
    },
    {
      title: '技工', key: 'skilled_count', width: 90, align: 'right',
      render: (_, r) => (
        <InputNumber
          min={0}
          value={r.skilled_count}
          onChange={(v) => updateManpower(r.id, 'skilled_count', v)}
          style={{ width: '100%' }}
          disabled={!isEditable}
        />
      ),
    },
    {
      title: '普工', key: 'general_count', width: 90, align: 'right',
      render: (_, r) => (
        <InputNumber
          min={0}
          value={r.general_count}
          onChange={(v) => updateManpower(r.id, 'general_count', v)}
          style={{ width: '100%' }}
          disabled={!isEditable}
        />
      ),
    },
    {
      title: '劳务工', key: 'labor_count', width: 90, align: 'right',
      render: (_, r) => (
        <InputNumber
          min={0}
          value={r.labor_count}
          onChange={(v) => updateManpower(r.id, 'labor_count', v)}
          style={{ width: '100%' }}
          disabled={!isEditable}
        />
      ),
    },
    {
      title: '其他', key: 'other_count', width: 90, align: 'right',
      render: (_, r) => (
        <InputNumber
          min={0}
          value={r.other_count}
          onChange={(v) => updateManpower(r.id, 'other_count', v)}
          style={{ width: '100%' }}
          disabled={!isEditable}
        />
      ),
    },
    {
      title: '操作', key: 'action', width: 60,
      render: (_, r) => {
        if (!r.record_id) return null
        return (
          <Popconfirm title="确认删除？" onConfirm={() => deleteManpower(r.id)} disabled={!isEditable}>
            <Button type="link" danger size="small" disabled={!isEditable}><DeleteOutlined /></Button>
          </Popconfirm>
        )
      },
    },
  ]

  const saveMaterialItem = async (item) => {
    try {
      const payload = {
        process_id: item.process_id,
        material_type: '原材料',
        material_code: item.material_code,
        material_name: item.material_name,
        specification: item.specification,
        material_batch: item.material_batch,
        box_no: item.box_no,
        quantity: item.quantity,
        label_images: item.label_images,
      }
      if (item.material_id) {
        await api.put(`/production/process-materials/${item.material_id}`, payload)
      } else {
        const res = await api.post('/production/process-materials', {
          work_order_id: item.work_order_id,
          ...payload,
        })
        setMaterialList(prev => prev.map(m => {
          if (m.id === item.id && !m.material_id) {
            return { ...m, material_id: res.data?.material_id, id: res.data?.material_id || m.id }
          }
          return m
        }))
      }
    } catch (err) {
      message.error(err.message || '保存失败')
    }
  }

  const updateMaterial = (id, field, value) => {
    if (!isEditable) return
    setMaterialList(prev => {
      const updated = prev.map(item => {
        if (item.id !== id) return item
        const newItem = { ...item, [field]: value }
        if (field === 'material_id') {
          const material = materialOptions.find(m => m.value === value)
          if (material) {
            newItem.material_code = material.material_code
            newItem.material_name = material.material_name
            newItem.specification = material.specification
          }
        }
        return newItem
      })

      const isEmptyRow = !prev.find(item => item.id === id)?.material_id
      const current = updated.find(item => item.id === id)
      const hasContent = current?.material_id && current?.quantity > 0

      if (isEmptyRow && hasContent) {
        const newEmptyRow = {
          id: genTempId(),
          work_order_id: selectedWO?.work_order_id,
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
        debouncedSave(id, () => saveMaterialItem(current))
        return [...updated, newEmptyRow]
      }

      if (!isEmptyRow) {
        debouncedSave(id, () => saveMaterialItem(current))
      }

      return updated
    })
  }

  const deleteMaterial = async (id) => {
    const item = materialList.find(m => m.id === id)
    if (item?.material_id) {
      try {
        await api.delete(`/production/process-materials/${item.material_id}`)
        message.success('删除成功')
      } catch (err) {
        message.error(err.message || '删除失败')
        return
      }
    }
    setMaterialList(prev => prev.filter(m => m.id !== id))
  }

  const materialDisplayList = useMemo(() => {
    if (!isEditable || !selectedWO) return materialList
    const hasEmptyRow = materialList.some(m => !m.material_id)
    if (hasEmptyRow) return materialList
    const emptyRow = {
      id: genTempId(),
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
    return [...materialList, emptyRow]
  }, [materialList, isEditable, selectedWO, selectedProcessId])

  const materialColumns = [
    {
      title: '料号', key: 'material_code', width: 120,
      render: (_, r) => r.material_code || '-',
    },
    {
      title: '料品名称', key: 'material_name', width: 250,
      render: (_, r) => (
        <Select
          value={r.material_id || undefined}
          onChange={(v) => updateMaterial(r.id, 'material_id', v)}
          placeholder="请选择料品"
          options={materialOptions}
          disabled={!isEditable}
          showSearch
          optionFilterProp="label"
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '规格', key: 'specification', width: 120,
      render: (_, r) => r.specification || '-',
    },
    {
      title: '批号', key: 'material_batch', width: 120,
      render: (_, r) => (
        <Input
          value={r.material_batch}
          onChange={(e) => updateMaterial(r.id, 'material_batch', e.target.value)}
          placeholder="请输入批号"
          disabled={!isEditable}
        />
      ),
    },
    {
      title: '包(箱)号', key: 'box_no', width: 120,
      render: (_, r) => (
        <Input
          value={r.box_no}
          onChange={(e) => updateMaterial(r.id, 'box_no', e.target.value)}
          placeholder="请输入包(箱)号"
          disabled={!isEditable}
        />
      ),
    },
    {
      title: '数量', key: 'quantity', width: 100, align: 'right',
      render: (_, r) => (
        <InputNumber
          min={0}
          value={r.quantity}
          onChange={(v) => updateMaterial(r.id, 'quantity', v)}
          style={{ width: '100%' }}
          disabled={!isEditable}
        />
      ),
    },
    {
      title: '标签图片', key: 'label_images', width: 100,
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
      title: '操作', key: 'action', width: 60,
      render: (_, r) => {
        if (!r.material_id) return null
        return (
          <Popconfirm title="确认删除？" onConfirm={() => deleteMaterial(r.id)} disabled={!isEditable}>
            <Button type="link" danger size="small" disabled={!isEditable}><DeleteOutlined /></Button>
          </Popconfirm>
        )
      },
    },
  ]

  return (
    <div className="page-container">
      <Card className="page-header-card">
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontWeight: 500 }}>选择生产工单：</label>
          <Select
            value={selectedWO?.work_order_id}
            onChange={(v) => {
              setSelectedWO(workOrders.find(w => w.work_order_id === v))
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
          {selectedWO && (
            <Space>
              <Tag color={reportStatusColorMap[reportStatus]} style={{ fontSize: 14, padding: '2px 10px' }}>
                报工状态：{reportStatus}
              </Tag>
              <Button
                type={isEditable ? 'default' : 'primary'}
                onClick={handleToggleReportStatus}
                loading={togglingStatus}
              >
                {isEditable ? '结束报工' : '开始报工'}
              </Button>
            </Space>
          )}
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
                <div className="stat-label" style={{ fontSize: '14px', color: '#999', marginBottom: 4 }}>工单状态</div>
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
            onChange={setActiveTab}
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
                <span style={{ marginLeft: 16, color: '#999', fontSize: 13 }}>
                  {isEditable ? '表格末尾空行可直接录入，修改后自动保存' : '已结束报工，数据只读'}
                </span>
              </div>
              <Table
                dataSource={prodDefectDisplayList}
                columns={prodDefectColumns}
                rowKey="id"
                pagination={false}
                bordered
                size="small"
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
                <span style={{ marginLeft: 16, color: '#999', fontSize: 13 }}>
                  {isEditable ? '表格末尾空行可直接录入，修改后自动保存' : '已结束报工，数据只读'}
                </span>
              </div>
              <Table
                dataSource={materialDisplayList}
                columns={materialColumns}
                rowKey="id"
                pagination={false}
                bordered
                size="small"
                scroll={{ x: 'max-content' }}
              />
            </Tabs.TabPane>

            <Tabs.TabPane tab="检验报废记录" key="scrap-defect">
              <div style={{ marginBottom: 16 }}>
                <span style={{ color: '#999', fontSize: 13 }}>
                  {isEditable ? '表格末尾空行可直接录入，修改后自动保存' : '已结束报工，数据只读'}
                </span>
              </div>
              <Table
                dataSource={scrapDefectDisplayList}
                columns={scrapDefectColumns}
                rowKey="id"
                pagination={false}
                bordered
                size="small"
                scroll={{ x: 'max-content' }}
              />
            </Tabs.TabPane>

            <Tabs.TabPane tab="异常工时记录" key="exception">
              <div style={{ marginBottom: 16 }}>
                <span style={{ color: '#999', fontSize: 13 }}>
                  {isEditable ? '表格末尾空行可直接录入，修改后自动保存' : '已结束报工，数据只读'}
                </span>
              </div>
              <Table
                dataSource={exceptionDisplayList}
                columns={exceptionColumns}
                rowKey="id"
                pagination={false}
                bordered
                size="small"
                scroll={{ x: 'max-content' }}
              />
            </Tabs.TabPane>

            <Tabs.TabPane tab="人员工时记录" key="manpower">
              <div style={{ marginBottom: 16 }}>
                <span style={{ color: '#999', fontSize: 13 }}>
                  {isEditable ? '表格末尾空行可直接录入，修改后自动保存' : '已结束报工，数据只读'}
                </span>
              </div>
              <Table
                dataSource={manpowerDisplayList}
                columns={manpowerColumns}
                rowKey="id"
                pagination={false}
                bordered
                size="small"
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
            disabled={imageUploadLoading || !isEditable}
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
                  {isEditable && (
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
                  )}
                </div>
              </Col>
            ))}
          </Row>
        )}
      </Drawer>
    </div>
  )
}
